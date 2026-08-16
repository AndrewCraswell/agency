import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { Command } from "commander"
import { createWorkosAuthenticator } from "../auth/workos.js"
import { loadConfig, type LegislationConfig } from "../config/config.js"
import { compareCoverageReports, generateCoverageReport, isCoverageReport } from "../coverage/report.js"
import { createDatabase, databasePoolSnapshot, type LegislationDatabase } from "../db/database.js"
import { migrateDatabase } from "../db/migrate.js"
import { isDatabaseReady, waitForDatabase } from "../db/readiness.js"
import { decodeArchiveRecords, MAXIMUM_ARCHIVE_BYTES } from "../ingestion/archive.js"
import { CongressClient } from "../ingestion/congress/client.js"
import { synchronizeCongress } from "../ingestion/congress/sync.js"
import {
  AzureBlobArtifactStore,
  LocalArtifactStore,
  type ArtifactStore
} from "../ingestion/documents/artifact-store.js"
import { processPendingDocuments } from "../ingestion/documents/jobs.js"
import { embedBills, embedDocumentSections } from "../ingestion/embeddings/jobs.js"
import { GovInfoClient } from "../ingestion/govinfo/client.js"
import { importGovInfoPackages } from "../ingestion/govinfo/import.js"
import { RetryingHttpClient } from "../ingestion/http-client.js"
import { createJobCounts, JOB_EXIT_CODE, runIngestionJob, type JobResult } from "../ingestion/job.js"
import { createOpenStatesCoverageManifest } from "../ingestion/openstates/coverage.js"
import { discoverOpenStatesArchives } from "../ingestion/openstates/discover.js"
import { importOpenStatesRecords } from "../ingestion/openstates/import.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../ingestion/source-store.js"
import { LegislationQueryService } from "../legislation/query-service.js"
import { close, createLegislationServer, listen } from "../mcp/server.js"
import { createLegislationMcpHandler } from "../mcp/tools.js"
import { OpenRouterEmbeddingClient } from "../models/openrouter-embeddings.js"
import { createLogger, errorContext } from "../observability/logger.js"
import { createTelemetry } from "../observability/telemetry.js"
import { validateCorpus } from "../validation/corpus.js"

class InvalidJobInput extends Error {}

function jobCorrelationId(): string {
  return process.env.WORKFLOW_EXECUTION_ID?.trim() || randomUUID()
}

const program = new Command()
  .name("legislation")
  .description("Legislative intelligence application commands")
  .showHelpAfterError()

program.command("serve").description("Start the legislation HTTP and MCP service").action(serve)
program.command("db:migrate").description("Apply legislation database migrations").action(migrate)
program.command("db:wait").description("Wait for the legislation database to become ready").action(wait)

program
  .command("openstates:discover")
  .description("Discover Open States archives and compare them with the coverage policy")
  .option("--index-url <https-url>", "authenticated or public archive index URL")
  .requiredOption("--output <path>")
  .option("--since-year <year>", "earliest session start year", "2017")
  .action(discoverOpenStates)

program
  .command("openstates:import")
  .description("Import an Open States JSON, JSONL, gzip, or ZIP archive")
  .option("--file <path>", "local archive path")
  .option("--url <https-url>", "remote archive URL")
  .requiredOption("--jurisdiction <code>")
  .requiredOption("--jurisdiction-name <name>")
  .requiredOption("--stream <jurisdiction-session>")
  .option("--force", "restart the archive from its first record")
  .action(importOpenStates)

program
  .command("govinfo:import")
  .description("Discover and import GovInfo BILLSTATUS XML")
  .option("--bill-types <types>", "comma-separated bill types", "hr,s,hjres,sjres,hconres,sconres,hres,sres")
  .option("--end-congress <number>")
  .option("--force", "restart the configured range")
  .option("--start-congress <number>")
  .action(importGovInfo)

program
  .command("congress:sync")
  .description("Synchronize changed bills from Congress.gov")
  .option("--dry-run")
  .option("--from <iso-date-time>")
  .option("--to <iso-date-time>")
  .action(syncCongress)

program
  .command("documents:process")
  .description("Acquire and process pending official bill documents")
  .option("--bill-id <id>")
  .option("--document-id <id>")
  .option("--force", "download and process even when an artifact is already complete")
  .option("--jurisdiction-id <id>")
  .option("--limit <number>", "maximum documents", "100")
  .option("--status <status>", "limit to pending, failed, or unsupported documents")
  .action(processDocuments)

program
  .command("embeddings:run")
  .description("Create missing or stale bill and passage embeddings")
  .option("--bill-id <id>", "limit bill and section work to one canonical bill")
  .option("--document-id <id>", "limit section work to one document")
  .option("--limit <number>", "maximum records per kind", "64")
  .action(runEmbeddings)

program
  .command("coverage:report")
  .description("Write the machine-readable corpus coverage report")
  .requiredOption("--output <path>")
  .option("--blob-path <path>", "also store the report in the configured Azure reports container")
  .action(writeCoverageReport)

program
  .command("corpus:validate")
  .description("Run deterministic corpus integrity and completion checks")
  .action(validate)

async function serve() {
  const config = loadConfig()
  const logger = createLogger({ level: config.logging.level, service: "legislation" })
  const telemetry = createTelemetry(config)
  const { database, pool } = createDatabase(config.database)
  const embeddingClient =
    config.model.apiKey === undefined
      ? undefined
      : new OpenRouterEmbeddingClient({ apiKey: config.model.apiKey, baseUrl: new URL(config.model.baseUrl) })
  const mcp = createLegislationMcpHandler(new LegislationQueryService(database, embeddingClient), logger, telemetry)
  const authenticate = config.auth.mode === "workos" ? createWorkosAuthenticator(config.auth) : undefined
  const server = createLegislationServer({
    authenticate,
    isReady: () => isDatabaseReady(pool),
    logger,
    mcpHandler: mcp.nodeHandler,
    protectedResourceMetadata:
      config.auth.mode === "workos"
        ? {
            authorizationServer: config.auth.issuer,
            resource: config.auth.audience,
            scopes: config.auth.requiredScopes
          }
        : undefined,
    readinessDetails: () => ({ databasePool: databasePoolSnapshot(pool) }),
    requestBodyBytes: config.server.requestBodyBytes
  })

  await listen(server, config.server)
  logger.info("server started", { host: config.server.host, port: config.server.port })

  let isShuttingDown = false
  function handleSignal(signal: NodeJS.Signals) {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true
    logger.info("server stopping", { signal })
    const timeout = setTimeout(() => {
      logger.error("server shutdown timed out")
      process.exitCode = 1
    }, config.server.shutdownTimeoutMs)
    timeout.unref()
    Promise.all([close(server), mcp.close(), pool.end(), telemetry.shutdown()])
      .catch((error: unknown) => {
        logger.error("server shutdown failed", errorContext(error))
        process.exitCode = 1
      })
      .finally(() => clearTimeout(timeout))
  }

  process.once("SIGINT", handleSignal)
  process.once("SIGTERM", handleSignal)
}

async function migrate() {
  await withDatabase(async (database) => {
    await migrateDatabase(database)
    createCommandLogger().info("database migrations applied")
  })
}

async function wait() {
  const config = loadConfig()
  const logger = createCommandLogger(config)
  const { pool } = createDatabase(config.database)
  try {
    await waitForDatabase(pool)
    logger.info("database ready")
  } finally {
    await pool.end()
  }
}

async function discoverOpenStates(options: { indexUrl?: string; output: string; sinceYear: string }) {
  const config = loadConfig()
  const indexUrl =
    options.indexUrl === undefined
      ? new URL("https://open.pluralpolicy.com/data/session-json/")
      : parseHttpsUrl(options.indexUrl, "index URL")
  const archives = await discoverOpenStatesArchives(httpClient(config), indexUrl)
  if (archives.length === 0) {
    throw new InvalidJobInput("Open States archive index returned no archives; authenticate or verify the index URL")
  }
  const report = createOpenStatesCoverageManifest(archives, parseInteger(options.sinceYear, "since year"))
  const output = resolve(options.output)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  process.stdout.write(
    `${JSON.stringify({ archives: report.archives.length, missingJurisdictions: report.missingJurisdictions.length, output })}\n`
  )
}

async function importOpenStates(options: {
  file?: string
  force?: boolean
  jurisdiction: string
  jurisdictionName: string
  stream: string
  url?: string
}) {
  const config = loadConfig()
  if ((options.file === undefined) === (options.url === undefined)) {
    throw new InvalidJobInput("provide exactly one of --file or --url")
  }
  const sourceUrl = options.url === undefined ? undefined : parseHttpsUrl(options.url, "url")
  const content =
    sourceUrl === undefined
      ? await readLocalArchive(resolve(options.file ?? ""))
      : await httpClient(config).getBytes(sourceUrl, MAXIMUM_ARCHIVE_BYTES)
  const contentHash = createHash("sha256").update(content).digest("hex")
  const sourceStore = createSourceStore(config, "state")
  await sourceStore.put("openstates", options.stream, content, {
    originalPath: options.file === undefined ? undefined : resolve(options.file),
    sourceUrl: sourceUrl?.href
  })
  const records = decodeArchiveRecords(content)
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        correlationId: jobCorrelationId(),
        operation: "historical-import",
        scope: { stream: options.stream },
        source: "openstates"
      },
      async () => {
        const imported = await importOpenStatesRecords(
          database,
          { jurisdictionCode: options.jurisdiction, jurisdictionName: options.jurisdictionName },
          records,
          {
            concurrency: config.ingestion.concurrency,
            contentHash,
            force: options.force,
            stream: options.stream
          }
        )
        return { checkpoint: imported.checkpoint, counts: imported.counts, failures: imported.failures }
      }
    )
    printJobResult(result)
  }, config)
}

async function readLocalArchive(path: string): Promise<Uint8Array> {
  const metadata = await stat(path)
  if (metadata.size > MAXIMUM_ARCHIVE_BYTES) {
    throw new InvalidJobInput(`archive exceeds the ${MAXIMUM_ARCHIVE_BYTES} byte limit`)
  }
  return new Uint8Array(await readFile(path))
}

async function importGovInfo(options: {
  billTypes: string
  endCongress?: string
  force?: boolean
  startCongress?: string
}) {
  const config = loadConfig()
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const congresses = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  const billTypes = options.billTypes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const providerHttp = httpClient(config)
  const client = new GovInfoClient(providerHttp)
  const packages = await client.discover(congresses, billTypes)
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        correlationId: jobCorrelationId(),
        operation: "historical-import",
        scope: { billTypes, end, start },
        source: "govinfo"
      },
      async () =>
        importGovInfoPackages(database, client, packages, {
          force: options.force,
          sourceStore: createSourceStore(config, "federal"),
          stream: `${start}-${end}`
        })
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "govinfo" })
}

async function syncCongress(options: { dryRun?: boolean; from?: string; to?: string }) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:sync")
  }
  const providerHttp = httpClient(config)
  const logger = createCommandLogger(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp,
    onPage: (progress) => logger.info("congress page progress", progress)
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      { correlationId: jobCorrelationId(), operation: "incremental-sync", scope: { ...options }, source: "congress" },
      async () =>
        synchronizeCongress(database, client, {
          dryRun: options.dryRun,
          from: options.from === undefined ? undefined : parseDate(options.from, "from"),
          onProgress: (progress) => logger.info("congress sync progress", progress),
          sourceStore: createSourceStore(config, "federal"),
          to: options.to === undefined ? undefined : parseDate(options.to, "to")
        })
    )
    printJobResult(result)
  }, config)
  logger.info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function processDocuments(options: {
  billId?: string
  documentId?: string
  force?: boolean
  jurisdictionId?: string
  limit: string
  status?: string
}) {
  const config = loadConfig()
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      { correlationId: jobCorrelationId(), operation: "process-documents", scope: { ...options }, source: "documents" },
      async () => {
        const processed = await processPendingDocuments(database, {
          artifactStore: createArtifactStore(config, "documents"),
          billId: options.billId,
          concurrency: config.ingestion.concurrency,
          documentId: options.documentId,
          force: options.force,
          jurisdictionId: options.jurisdictionId,
          limit: parseInteger(options.limit, "limit"),
          status: options.status === undefined ? undefined : parseDocumentStatus(options.status),
          timeoutMs: config.ingestion.requestTimeoutMs
        })
        return { counts: processed.counts, failures: processed.failures }
      }
    )
    printJobResult(result)
  }, config)
}

async function runEmbeddings(options: { billId?: string; documentId?: string; limit: string }) {
  const config = loadConfig()
  if (config.model.apiKey === undefined) {
    throw new InvalidJobInput("OPENROUTER_API_KEY is required for embeddings:run")
  }
  const client = new OpenRouterEmbeddingClient({
    apiKey: config.model.apiKey,
    baseUrl: new URL(config.model.baseUrl),
    maximumAttempts: config.ingestion.maxAttempts,
    timeoutMs: config.ingestion.requestTimeoutMs
  })
  const limit = parseInteger(options.limit, "limit")
  const telemetry = createTelemetry(config)
  await withDatabase(async (database) => {
    try {
      const result = await runIngestionJob(
        database,
        { correlationId: jobCorrelationId(), operation: "refresh-embeddings", scope: { limit }, source: "openrouter" },
        async () => {
          const bills = await telemetry.observe(
            "embedding.bills",
            { batchLimit: limit, model: config.model.embeddingModel },
            () => embedBills(database, client, { billId: options.billId, limit })
          )
          const sections = await telemetry.observe(
            "embedding.sections",
            { batchLimit: limit, model: config.model.embeddingModel },
            () =>
              embedDocumentSections(database, client, {
                billId: options.billId,
                documentId: options.documentId,
                limit
              })
          )
          return {
            counts: createJobCounts({
              inserted: bills.embedded + sections.embedded,
              skipped: bills.skipped + sections.skipped
            }),
            failures: []
          }
        }
      )
      createCommandLogger(config).info("embedding request metrics", {
        ...client.metrics,
        reused: result.counts.skipped,
        source: "openrouter"
      })
      printJobResult(result)
    } finally {
      await telemetry.shutdown()
    }
  }, config)
}

async function writeCoverageReport(options: { blobPath?: string; output: string }) {
  const config = loadConfig()
  await withDatabase(async (database) => {
    const report = await generateCoverageReport(database)
    const output = resolve(options.output)
    let comparison
    try {
      const previous: unknown = JSON.parse(await readFile(output, "utf8"))
      if (isCoverageReport(previous)) {
        comparison = compareCoverageReports(previous, report)
      }
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
        throw error
      }
    }
    const outputReport = comparison === undefined ? report : { ...report, comparison }
    const bytes = new TextEncoder().encode(`${JSON.stringify(outputReport, null, 2)}\n`)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, bytes)
    if (comparison !== undefined) {
      const logger = createCommandLogger(config)
      logger.info("coverage changes", { ...comparison })
      if (comparison.regressions.length > 0) {
        logger.warn("coverage regression detected", { regressions: comparison.regressions })
      }
    }
    if (options.blobPath !== undefined) {
      if (config.azure.storageAccount === undefined) {
        throw new InvalidJobInput("AZURE_STORAGE_ACCOUNT is required with --blob-path")
      }
      await createArtifactStore(config, "reports").put(options.blobPath, bytes)
    }
    process.stdout.write(
      `${JSON.stringify({ blobPath: options.blobPath, output, status: "succeeded", totals: outputReport.totals })}\n`
    )
  }, config)
}

async function validate() {
  await withDatabase(async (database) => {
    const report = await validateCorpus(database)
    process.stdout.write(`${JSON.stringify(report)}\n`)
    if (!report.valid) {
      process.exitCode = JOB_EXIT_CODE.failed
    }
  })
}

function httpClient(config: LegislationConfig) {
  return new RetryingHttpClient({
    maxAttempts: config.ingestion.maxAttempts,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
}

function createArtifactStore(
  config: LegislationConfig,
  kind: "documents" | "federal" | "reports" | "state"
): ArtifactStore {
  if (config.azure.storageAccount !== undefined) {
    let container = config.azure.stateSourceContainer
    if (kind === "documents") {
      container = config.azure.normalizedDocumentContainer
    } else if (kind === "federal") {
      container = config.azure.federalSourceContainer
    } else if (kind === "reports") {
      container = config.azure.reportContainer
    }
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

async function withDatabase<T>(
  operation: (database: LegislationDatabase) => Promise<T>,
  config = loadConfig()
): Promise<T> {
  const { database, pool } = createDatabase(config.database)
  try {
    return await operation(database)
  } finally {
    await pool.end()
  }
}

function createCommandLogger(config = loadConfig()) {
  return createLogger({ level: config.logging.level, service: "legislation" })
}

function parseInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new InvalidJobInput(`${name} must be a positive integer`)
  }
  return parsed
}

function parseDate(value: string, name: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new InvalidJobInput(`${name} must be an ISO date-time`)
  }
  return parsed
}

function parseDocumentStatus(value: string): "failed" | "pending" | "unsupported" {
  if (value !== "failed" && value !== "pending" && value !== "unsupported") {
    throw new InvalidJobInput("status must be pending, failed, or unsupported")
  }
  return value
}

function parseHttpsUrl(value: string, name: string): URL {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") {
      throw new Error()
    }
    return url
  } catch {
    throw new InvalidJobInput(`${name} must be an HTTPS URL`)
  }
}

function printJobResult(result: JobResult) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
  process.exitCode = JOB_EXIT_CODE[result.status]
}

program.parseAsync().catch((error: unknown) => {
  const logger = createLogger({ level: "error", service: "legislation" })
  logger.error("command failed", errorContext(error))
  process.exitCode = error instanceof InvalidJobInput ? JOB_EXIT_CODE.invalid : JOB_EXIT_CODE.failed
})
