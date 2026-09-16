import { resolve } from "node:path"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import { DEFAULT_GOVINFO_BILL_TYPES } from "../backfill/backfill.js"
import { AzureBlobArtifactStore } from "../documents/artifact-store.js"
import { RetryingHttpClient } from "../http-client.js"
import { runIngestionJob, type JobResult } from "../job.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../source-store.js"
import { GovInfoApiClient } from "./api-client.js"
import { GovInfoClient } from "./client.js"
import { importGovInfoPackages } from "./import.js"

const INITIAL_LOOKBACK_MILLISECONDS = 7 * 86_400_000
const REPLAY_WINDOW_MILLISECONDS = 24 * 3_600_000

type GovInfoCurrentClient = Pick<GovInfoApiClient, "discoverModified"> & Pick<GovInfoClient, "getBillStatus">

export type GovInfoCurrentSynchronizationInput = Readonly<{
  billTypes?: readonly string[]
  config: LegislationConfig
  congress: number
  correlationId: string
  database: LegislationDatabase
  workflowExecutionId?: string
}>

export type GovInfoCurrentSynchronizationDependencies = Readonly<{
  client?: GovInfoCurrentClient
  importPackages?: typeof importGovInfoPackages
  now?: () => Date
  readObservedThrough?: (database: LegislationDatabase, stream: string) => Promise<Date | undefined>
  runIngestionJob?: typeof runIngestionJob
  sourceStore?: SourceStore
}>

/** Synchronizes new and revised BILLSTATUS packages for one current Congress. */
export async function executeGovInfoCurrentSynchronization(
  input: GovInfoCurrentSynchronizationInput,
  dependencies: GovInfoCurrentSynchronizationDependencies = {}
): Promise<JobResult> {
  if (!Number.isSafeInteger(input.congress) || input.congress < 1) {
    throw new Error("GovInfo current Congress must be a positive integer")
  }
  const billTypes = (input.billTypes ?? DEFAULT_GOVINFO_BILL_TYPES)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (billTypes.length === 0) {
    throw new Error("At least one GovInfo bill type is required")
  }

  const now = dependencies.now?.() ?? new Date()
  const observedThrough = new Date(Math.floor(now.getTime() / 1_000) * 1_000)
  const stream = `govinfo:bill-status:${input.congress}`
  const readCursor = dependencies.readObservedThrough ?? readObservedThroughCheckpoint
  const client = dependencies.client ?? createClient(input.config)
  const sourceStore = dependencies.sourceStore ?? createSourceStore(input.config)
  const importPackages = dependencies.importPackages ?? importGovInfoPackages
  const run = dependencies.runIngestionJob ?? runIngestionJob
  const jobInput = {
    checkpointStream: stream,
    correlationId: input.correlationId,
    operation: "bill-status-sync",
    scope: {
      billTypes,
      congress: input.congress,
      observedAt: observedThrough.toISOString(),
      replayWindowHours: REPLAY_WINDOW_MILLISECONDS / 3_600_000
    },
    scopeKey: "bill-status:all",
    source: "govinfo"
  }

  return run(
    input.database,
    input.workflowExecutionId === undefined
      ? jobInput
      : { ...jobInput, workflowExecutionId: input.workflowExecutionId },
    async () => {
      const previousObservation = await readCursor(input.database, stream)
      const modifiedSince = new Date(
        previousObservation === undefined
          ? observedThrough.getTime() - INITIAL_LOOKBACK_MILLISECONDS
          : Math.min(previousObservation.getTime(), observedThrough.getTime()) - REPLAY_WINDOW_MILLISECONDS
      )
      const packages = await client.discoverModified(input.congress, billTypes, modifiedSince, observedThrough)
      const imported = await importPackages(input.database, client, packages, {
        concurrency: input.config.ingestion.concurrency,
        force: true,
        persistCheckpoint: false,
        sourceStore,
        stream
      })
      return {
        ...imported,
        checkpoint: {
          billTypes,
          congress: input.congress,
          observedThrough: observedThrough.toISOString()
        }
      }
    }
  )
}

async function readObservedThroughCheckpoint(database: LegislationDatabase, stream: string): Promise<Date | undefined> {
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "govinfo"), eq(syncCheckpoints.stream, stream))
  })
  const value = checkpoint?.cursor.observedThrough
  if (typeof value !== "string") {
    return undefined
  }
  const observedThrough = new Date(value)
  return Number.isNaN(observedThrough.getTime()) ? undefined : observedThrough
}

function createClient(config: LegislationConfig): GovInfoCurrentClient {
  const apiKey = config.ingestion.govInfoApiKey
  if (apiKey === undefined) {
    throw new Error("GOVINFO_API_KEY is required for recurring GovInfo synchronization")
  }
  const http = new RetryingHttpClient({
    maxAttempts: config.ingestion.maxAttempts,
    minimumIntervalMs: 100,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
  const api = new GovInfoApiClient({ apiKey, baseUrl: new URL(config.ingestion.govInfoApiUrl), http })
  const bulk = new GovInfoClient(http)
  return {
    discoverModified: api.discoverModified.bind(api),
    getBillStatus: bulk.getBillStatus.bind(bulk)
  }
}

function createSourceStore(config: LegislationConfig): SourceStore {
  if (config.azure.storageAccount !== undefined) {
    return new ArtifactSourceStore(
      new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.federalSourceContainer)
    )
  }
  return new LocalSourceStore(resolve(config.ingestion.sourceDirectory, "federal"))
}
