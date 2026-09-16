import { createHash } from "node:crypto"
import { resolve } from "node:path"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import type { LegislationConfig } from "../../config/config.js"
import { decodeArchiveRecords, MAXIMUM_ARCHIVE_BYTES } from "../archive.js"
import { AzureBlobArtifactStore, LocalArtifactStore, type ArtifactStore } from "../documents/artifact-store.js"
import { GovInfoClient } from "../govinfo/client.js"
import { importGovInfoPackages } from "../govinfo/import.js"
import { RetryingHttpClient } from "../http-client.js"
import { runIngestionJob, type JobResult } from "../job.js"
import { openStatesJurisdictionNames } from "../openstates/coverage.js"
import { importOpenStatesRecords, type OpenStatesImportResult } from "../openstates/import.js"
import { parseOpenStatesManifest, type OpenStatesManifest } from "../openstates/manifest.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../source-store.js"

export const DEFAULT_GOVINFO_BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"] as const

export type OpenStatesArchiveImportInput = Readonly<{
  archive: Readonly<{ jurisdictionCode: string; session: string; stream?: string; url: URL }>
  config: LegislationConfig
  correlationId: string
  database: LegislationDatabase
  force?: boolean
  workflowExecutionId?: string
}>

export type OpenStatesHistoricalArchiveInput = Readonly<{
  config: LegislationConfig
  manifestBlob: string
  jurisdictions: readonly string[]
}>

export type OpenStatesHistoricalArchive = Readonly<{
  jurisdictionCode: string
  session: string
  stream: string
  url: string
}>

export type GovInfoHistoricalImportInput = Readonly<{
  billTypes?: readonly string[]
  config: LegislationConfig
  correlationId: string
  database: LegislationDatabase
  endCongress?: number
  force?: boolean
  startCongress?: number
  workflowExecutionId?: string
}>

export type BackfillProgressEvent = Readonly<Record<string, unknown>>

interface ArchiveDownloadClient {
  getBytes(url: URL, maximumBytes: number): Promise<Uint8Array>
}

type GovInfoBackfillClient = Pick<GovInfoClient, "discover" | "getBillStatus">

export type OpenStatesBackfillDependencies = Readonly<{
  archiveClient?: ArchiveDownloadClient
  artifactStore?: ArtifactStore
  decodeArchiveRecords?: typeof decodeArchiveRecords
  importOpenStatesRecords?: typeof importOpenStatesRecords
  onProgress?: (event: BackfillProgressEvent) => void
  runIngestionJob?: typeof runIngestionJob
  sourceStore?: SourceStore
}>

export type GovInfoBackfillDependencies = Readonly<{
  govInfoClient?: GovInfoBackfillClient
  importGovInfoPackages?: typeof importGovInfoPackages
  onProgress?: (event: BackfillProgressEvent) => void
  runIngestionJob?: typeof runIngestionJob
  sourceStore?: SourceStore
}>

/**
 * Imports a single OpenStates archive using the same stream checkpoint as the
 * existing `openstates:import` command. This makes a Trigger retry resume the
 * archive rather than start it from record zero.
 */
export async function executeOpenStatesArchiveImport(
  input: OpenStatesArchiveImportInput,
  dependencies: OpenStatesBackfillDependencies = {}
): Promise<JobResult> {
  const archive = normalizeOpenStatesArchive(input.archive)
  const run = dependencies.runIngestionJob ?? runIngestionJob
  const sourceStore = dependencies.sourceStore ?? createSourceStore(input.config, "state")

  return run(
    input.database,
    withWorkflowExecution(
      {
        correlationId: input.correlationId,
        operation: "historical-import",
        scope: { stream: archive.stream },
        scopeKey: `stream:${archive.stream}`,
        source: "openstates"
      },
      input.workflowExecutionId
    ),
    async () => importOpenStatesArchive(input, archive, sourceStore, dependencies)
  )
}

/**
 * Expands a retained manifest into independent archive units. Each resulting
 * task owns one durable stream checkpoint and lease, so large jurisdictions do
 * not become the long tail of a rebuild.
 */
export async function listOpenStatesHistoricalArchives(
  input: OpenStatesHistoricalArchiveInput,
  dependencies: Pick<OpenStatesBackfillDependencies, "artifactStore"> = {}
): Promise<OpenStatesHistoricalArchive[]> {
  const requestedJurisdictions = new Set(input.jurisdictions.map((jurisdiction) => normalizeJurisdiction(jurisdiction)))
  requestedJurisdictions.delete(undefined)
  const artifactStore = dependencies.artifactStore ?? createArtifactStore(input.config, "state")
  const manifest = parseOpenStatesManifest(new TextDecoder().decode(await artifactStore.read(input.manifestBlob)))
  const archives = matchingArchives(manifest).filter((archive) => requestedJurisdictions.has(archive.jurisdictionCode))
  if (archives.length === 0) {
    throw new Error("Open States manifest contains no matching supported archives")
  }
  return archives.map((archive) => ({
    jurisdictionCode: archive.jurisdictionCode,
    session: archive.session,
    stream: archive.stream,
    url: archive.url.href
  }))
}

/**
 * Discovers and imports a Congress range directly in the Trigger runtime. The
 * stream format is identical to `govinfo:import`, preserving its package index
 * checkpoint across local and Trigger.dev execution.
 */
export async function executeGovInfoHistoricalImport(
  input: GovInfoHistoricalImportInput,
  dependencies: GovInfoBackfillDependencies = {}
): Promise<JobResult> {
  const scope = normalizeGovInfoScope(input)
  const client = dependencies.govInfoClient ?? createGovInfoClient(input.config)
  const sourceStore = dependencies.sourceStore ?? createSourceStore(input.config, "federal")
  const importPackages = dependencies.importGovInfoPackages ?? importGovInfoPackages
  const run = dependencies.runIngestionJob ?? runIngestionJob

  return run(
    input.database,
    withWorkflowExecution(
      {
        correlationId: input.correlationId,
        operation: "bill-status-sync",
        scope: { billTypes: scope.billTypes, end: scope.end, start: scope.start },
        scopeKey: "bill-status:all",
        source: "govinfo"
      },
      input.workflowExecutionId
    ),
    async () => {
      const packages = await client.discover(scope.congresses, scope.billTypes)
      if (packages.length === 0) {
        throw new Error("GovInfo discovery returned no BILLSTATUS packages for the requested backfill scope")
      }
      dependencies.onProgress?.({
        billTypes: scope.billTypes,
        congresses: scope.congresses,
        event: "packages_discovered",
        packages: packages.length,
        provider: "govinfo"
      })
      return importPackages(input.database, client, packages, {
        concurrency: input.config.ingestion.concurrency,
        force: input.force,
        sourceStore,
        stream: `${scope.start}-${scope.end}-${scope.billTypes.join("-")}`
      })
    }
  )
}

async function importOpenStatesArchive(
  input: Readonly<{
    config: LegislationConfig
    database: LegislationDatabase
    force?: boolean
  }>,
  archive: NormalizedOpenStatesArchive,
  sourceStore: SourceStore,
  dependencies: OpenStatesBackfillDependencies
): Promise<OpenStatesImportResult> {
  const client = dependencies.archiveClient ?? createOpenStatesArchiveClient(input.config)
  const content = await client.getBytes(archive.url, MAXIMUM_ARCHIVE_BYTES)
  const contentHash = createHash("sha256").update(content).digest("hex")
  await sourceStore.put("openstates", archive.stream, content, { sourceUrl: archive.url.href })
  const importRecords = dependencies.importOpenStatesRecords ?? importOpenStatesRecords
  return importRecords(
    input.database,
    { jurisdictionCode: archive.jurisdictionCode, jurisdictionName: archive.jurisdictionName },
    (dependencies.decodeArchiveRecords ?? decodeArchiveRecords)(content),
    {
      batchSize: 96,
      concurrency: input.config.ingestion.concurrency,
      contentHash,
      force: input.force,
      stream: archive.stream
    }
  )
}

type NormalizedOpenStatesArchive = Readonly<{
  jurisdictionCode: string
  jurisdictionName: string
  session: string
  stream: string
  url: URL
}>

function matchingArchives(manifest: OpenStatesManifest): NormalizedOpenStatesArchive[] {
  return manifest.archives.flatMap((archive) => {
    const jurisdictionName = jurisdictionNameFor(archive.jurisdictionCode)
    if (jurisdictionName === undefined) {
      return []
    }
    return [
      {
        jurisdictionCode: archive.jurisdictionCode,
        jurisdictionName,
        session: archive.session,
        stream: `${archive.jurisdictionCode}-${archive.session}`,
        url: new URL(archive.url)
      }
    ]
  })
}

function normalizeOpenStatesArchive(archive: OpenStatesArchiveImportInput["archive"]): NormalizedOpenStatesArchive {
  const jurisdictionCode = normalizeJurisdiction(archive.jurisdictionCode)
  if (jurisdictionCode === undefined) {
    throw new Error("Open States archive jurisdiction is required")
  }
  const jurisdictionName = jurisdictionNameFor(jurisdictionCode)
  if (jurisdictionName === undefined) {
    throw new Error(`Unsupported Open States jurisdiction: ${archive.jurisdictionCode}`)
  }
  const session = archive.session.trim()
  if (session === "") {
    throw new Error("Open States archive session is required")
  }
  const stream = archive.stream?.trim() || `${jurisdictionCode}-${session}`
  return {
    jurisdictionCode,
    jurisdictionName,
    session,
    stream,
    url: archive.url
  }
}

function normalizeJurisdiction(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized === "" ? undefined : normalized
}

function jurisdictionNameFor(code: string): string | undefined {
  return Object.hasOwn(openStatesJurisdictionNames, code)
    ? openStatesJurisdictionNames[code as keyof typeof openStatesJurisdictionNames]
    : undefined
}

function normalizeGovInfoScope(input: GovInfoHistoricalImportInput): Readonly<{
  billTypes: string[]
  congresses: number[]
  end: number
  start: number
}> {
  const start = input.startCongress ?? input.config.ingestion.federalStartCongress
  const end = input.endCongress ?? input.config.ingestion.federalEndCongress
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(end) || end < 1) {
    throw new Error("GovInfo Congress bounds must be positive integers")
  }
  if (start > end) {
    throw new Error("GovInfo start Congress must not exceed end Congress")
  }
  const billTypes = (input.billTypes ?? DEFAULT_GOVINFO_BILL_TYPES).map((billType) => billType.trim()).filter(Boolean)
  if (billTypes.length === 0) {
    throw new Error("At least one GovInfo bill type is required")
  }
  return {
    billTypes,
    congresses: Array.from({ length: end - start + 1 }, (_, index) => start + index),
    end,
    start
  }
}

function createOpenStatesArchiveClient(config: LegislationConfig): ArchiveDownloadClient {
  return new RetryingHttpClient({
    maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
    minimumIntervalMs: 750,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
}

function createGovInfoClient(config: LegislationConfig): GovInfoBackfillClient {
  return new GovInfoClient(
    new RetryingHttpClient({
      maxAttempts: config.ingestion.maxAttempts,
      requestTimeoutMs: config.ingestion.requestTimeoutMs
    })
  )
}

function createArtifactStore(config: LegislationConfig, kind: "federal" | "state"): ArtifactStore {
  if (config.azure.storageAccount !== undefined) {
    const container = kind === "federal" ? config.azure.federalSourceContainer : config.azure.stateSourceContainer
    return new AzureBlobArtifactStore(config.azure.storageAccount, container)
  }
  return new LocalArtifactStore(resolve(config.ingestion.sourceDirectory, kind))
}

function createSourceStore(config: LegislationConfig, kind: "federal" | "state"): SourceStore {
  if (config.azure.storageAccount !== undefined) {
    return new ArtifactSourceStore(createArtifactStore(config, kind))
  }
  return new LocalSourceStore(resolve(config.ingestion.sourceDirectory, kind))
}

function withWorkflowExecution<T extends Readonly<Record<string, unknown>>>(
  input: T,
  workflowExecutionId: string | undefined
): T & Readonly<{ workflowExecutionId?: string }> {
  return workflowExecutionId === undefined ? input : { ...input, workflowExecutionId }
}
