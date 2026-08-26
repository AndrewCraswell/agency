import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { Command } from "commander"
import { createLegislationApiHandler } from "../api/handlers.js"
import { createRepresentativeLookupApi } from "../api/representative-lookup.js"
import {
  createCanonicalResearchEvidenceRetriever,
  createOpenRouterResearchAnswerGenerator,
  createResearchAnswerService
} from "../api/research-answers.js"
import {
  createAes256GcmIdempotencyCipher,
  PostgresSubscriptionRepository,
  SubscriptionIdempotencyTransaction
} from "../api/subscription-repository.js"
import { createAes256GcmWebhookSecretProtector } from "../api/subscriptions.js"
import { CensusAddressGeocoder, UsRepresentativeLookupProvider } from "../api/us-representative-lookup-provider.js"
import { PostgresWebhookReadRepository } from "../api/webhook-read-repository.js"
import { createWorkosAuthenticator } from "../auth/workos.js"
import { decodeIdempotencyEncryptionKey, loadConfig, type LegislationConfig } from "../config/config.js"
import { compareCoverageReports, generateCoverageReport, isCoverageReport } from "../coverage/report.js"
import { createDatabase, databasePoolSnapshot, type LegislationDatabase } from "../db/database.js"
import { migrateDatabase } from "../db/migrate.js"
import { replaceEntitySnapshot } from "../db/queries/entities.js"
import { upsertEventSnapshots } from "../db/queries/events.js"
import { isDatabaseReady, waitForDatabase } from "../db/readiness.js"
import { decodeArchiveRecords, MAXIMUM_ARCHIVE_BYTES } from "../ingestion/archive.js"
import { synchronizeCongressAmendments } from "../ingestion/congress/amendments-sync.js"
import { CongressClient } from "../ingestion/congress/client.js"
import { normalizeCongressCommittees } from "../ingestion/congress/entities.js"
import { synchronizeCongressEvents } from "../ingestion/congress/events-sync.js"
import { hydrateCongressMemberSnapshot } from "../ingestion/congress/member-details.js"
import { synchronizeCongressCommitteeReports } from "../ingestion/congress/reports-sync.js"
import { synchronizeCongress } from "../ingestion/congress/sync.js"
import { synchronizeCongressHouseVotes } from "../ingestion/congress/votes-sync.js"
import {
  AzureBlobArtifactStore,
  LocalArtifactStore,
  type ArtifactStore
} from "../ingestion/documents/artifact-store.js"
import { processCaliforniaPubinfoArchive } from "../ingestion/documents/california-pubinfo-job.js"
import { downloadDocument } from "../ingestion/documents/download.js"
import {
  classifyTerminalDocumentFailures,
  DOCUMENT_REMEDIATION_COHORTS,
  prepareDocumentRemediation,
  processPendingDocuments,
  requeueInterruptedDocuments,
  type DocumentRemediationCohort
} from "../ingestion/documents/jobs.js"
import { AzureDocumentIntelligenceClient } from "../ingestion/documents/ocr-client.js"
import { processOcrRequiredDocuments } from "../ingestion/documents/ocr-jobs.js"
import { DOCUMENT_FAILURE_CATEGORIES, type DocumentFailureCategory } from "../ingestion/documents/process.js"
import {
  processPendingSupportingMaterials,
  requeueFailedSupportingMaterials
} from "../ingestion/documents/supporting-material-jobs.js"
import {
  embedAmendments,
  embedBills,
  embedDocumentSections,
  embedSupportingMaterialSections
} from "../ingestion/embeddings/jobs.js"
import { GovInfoClient } from "../ingestion/govinfo/client.js"
import { importGovInfoPackages } from "../ingestion/govinfo/import.js"
import { RetryingHttpClient } from "../ingestion/http-client.js"
import {
  createJobCounts,
  JobAlreadyRunningError,
  JOB_EXIT_CODE,
  mapConcurrent,
  recoverInterruptedIngestionJob,
  runIngestionJob,
  type JobResult
} from "../ingestion/job.js"
import { OpenStatesClient } from "../ingestion/openstates/client.js"
import {
  createOpenStatesCoverageManifest,
  openStatesJurisdictionId,
  openStatesJurisdictionNames,
  supportedOpenStatesJurisdictions
} from "../ingestion/openstates/coverage.js"
import { discoverOpenStatesArchives } from "../ingestion/openstates/discover.js"
import {
  mergeOpenStatesEntitySnapshots,
  normalizeOpenStatesCommittees,
  normalizeOpenStatesPeople
} from "../ingestion/openstates/entities.js"
import { normalizeOpenStatesEvent } from "../ingestion/openstates/events.js"
import { importOpenStatesRecords } from "../ingestion/openstates/import.js"
import { parseOpenStatesManifest } from "../ingestion/openstates/manifest.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../ingestion/source-store.js"
import { LegislationQueryService } from "../legislation/query-service.js"
import { close, createLegislationServer, listen } from "../mcp/server.js"
import { createLegislationMcpHandler } from "../mcp/tools.js"
import { embeddingRouteFor } from "../models/embedding-routing.js"
import { OpenRouterEmbeddingClient } from "../models/openrouter-embeddings.js"
import { OpenRouterRetrievalClient } from "../models/openrouter-retrieval.js"
import { createLogger, errorContext } from "../observability/logger.js"
import { createTelemetry } from "../observability/telemetry.js"
import { validateCorpus } from "../validation/corpus.js"

class InvalidJobInput extends Error {}

function jobExecutionContext(): { correlationId: string; workflowExecutionId?: string } {
  const workflowExecutionId = process.env.WORKFLOW_EXECUTION_ID?.trim() || undefined
  const correlationId = process.env.CORRELATION_ID?.trim() || workflowExecutionId || randomUUID()
  return workflowExecutionId === undefined ? { correlationId } : { correlationId, workflowExecutionId }
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
  .command("openstates:sync")
  .description("Synchronize changed state bills from the Open States API")
  .option("--from <iso-date-time>")
  .option("--jurisdiction <code>")
  .action(syncOpenStates)

program
  .command("openstates:bootstrap")
  .description("Import all state archives in an Azure Blob manifest")
  .requiredOption("--manifest-blob <path>")
  .option("--force", "restart matching archives from their first record")
  .option("--jurisdiction <code>")
  .action(bootstrapOpenStates)

program
  .command("openstates:entities")
  .description("Synchronize current Open States people, terms, committees, and memberships")
  .option("--jurisdiction <code>")
  .action(syncOpenStatesEntities)

program
  .command("openstates:events")
  .description("Synchronize a rolling Open States legislative event window")
  .option("--from <iso-date-time>")
  .option("--jurisdiction <code>")
  .option("--to <iso-date-time>")
  .action(syncOpenStatesEvents)

program
  .command("govinfo:discover")
  .description("Discover and retain a GovInfo BILLSTATUS package manifest")
  .option("--bill-types <types>", "comma-separated bill types", "hr,s,hjres,sjres,hconres,sconres,hres,sres")
  .option("--blob-path <path>", "also store the manifest in the configured federal source container")
  .option("--end-congress <number>")
  .requiredOption("--output <path>")
  .option("--start-congress <number>")
  .action(discoverGovInfo)

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
  .command("congress:entities")
  .description("Synchronize federal members, terms, committees, and subcommittees")
  .option("--end-congress <number>")
  .option("--start-congress <number>")
  .action(syncCongressEntities)

program
  .command("congress:amendments")
  .description("Synchronize federal amendments, actions, sponsors, related bills, and available text")
  .option("--end-congress <number>")
  .option("--limit <number>", "maximum amendments per Congress")
  .option("--restart", "restart each configured Congress from its first amendment")
  .option("--start-congress <number>")
  .action(syncCongressAmendmentData)

program
  .command("congress:events")
  .description("Synchronize federal committee meetings and published hearings")
  .option("--domain <domain>", "meetings, hearings, or both", "both")
  .option("--end-congress <number>")
  .option("--limit <number>", "maximum records per domain and Congress")
  .option("--rematerialize", "restart and re-upsert events even when Congress.gov reports no newer update")
  .option("--restart", "restart each domain and Congress from its first record")
  .option("--start-congress <number>")
  .action(syncCongressEventData)

program
  .command("congress:reports")
  .description("Synchronize federal committee reports, related bills, committees, and available text")
  .option("--end-congress <number>")
  .option("--limit <number>", "maximum committee reports per Congress")
  .option("--restart", "restart each configured Congress from its first committee report")
  .option("--start-congress <number>")
  .action(syncCongressCommitteeReportData)

program
  .command("congress:house-votes")
  .description("Synchronize House roll-call votes and member positions")
  .option("--end-congress <number>")
  .option("--limit <number>", "maximum votes per session and Congress")
  .option("--restart", "restart each session and Congress from its first vote")
  .option("--session <number>", "limit to session 1 or 2")
  .option("--start-congress <number>")
  .action(syncCongressHouseVoteData)

program
  .command("documents:process")
  .description("Acquire and process pending official bill documents")
  .option("--bill-id <id>")
  .option("--document-id <id>")
  .option("--failure-category <category>", "limit failed retries to one recorded failure category")
  .option("--all", "continue until every pending document has been attempted")
  .option("--async-commit", "use resumable asynchronous PostgreSQL commits for this ingestion run")
  .option("--force", "download and process even when an artifact is already complete")
  .option("--jurisdiction-id <id>")
  .option("--limit <number>", "maximum documents", "100")
  .option("--shard-count <number>", "number of disjoint document workers", "1")
  .option("--shard-index <number>", "zero-based document worker index", "0")
  .option("--status <status>", "limit to pending, failed, or unsupported documents")
  .action(processDocuments)

program
  .command("documents:process-california-pubinfo")
  .description("Process California documents from one official PUBINFO session archive")
  .requiredOption("--archive <path>", "local PUBINFO session ZIP")
  .requiredOption("--session-start-year <year>", "odd first year of the two-year session")
  .option("--concurrency <number>", "parallel artifact persistence operations", "4")
  .option("--limit <number>", "maximum matching documents", "50000")
  .action(processCaliforniaPubinfo)

program
  .command("documents:ocr")
  .description("OCR retained image-only bill documents")
  .option("--document-id <id>", "process one exact document")
  .option("--limit <number>", "maximum documents", "10")
  .action(processOcrDocuments)

program
  .command("documents:classify-terminal")
  .description("Classify legacy failed and unsupported documents and make terminal dispositions explicit")
  .option("--limit <number>", "maximum unclassified documents to inspect", "100000")
  .action(classifyTerminalDocuments)

program
  .command("documents:prepare-remediation")
  .description("Prepare one known document defect cohort for bounded reprocessing")
  .requiredOption("--cohort <cohort>", `one of ${DOCUMENT_REMEDIATION_COHORTS.join(", ")}`)
  .option("--limit <number>", "maximum documents to prepare", "10000")
  .action(prepareKnownDocumentRemediation)

program
  .command("documents:recover-interrupted")
  .description("Move stale processing documents back to pending after a confirmed interrupted worker")
  .requiredOption("--before <iso-date-time>")
  .option("--shard-count <number>", "document backfill shard count", "1")
  .option("--shard-index <number>", "zero-based document backfill shard index", "0")
  .action(recoverInterruptedDocuments)

program
  .command("materials:process")
  .description("Acquire and process pending supporting materials")
  .option("--material-id <id>")
  .option("--all", "continue until every pending supporting material has been attempted")
  .option("--force", "download and process even when an artifact is already complete")
  .option("--jurisdiction-id <id>")
  .option("--limit <number>", "maximum supporting materials", "100")
  .option("--status <status>", "limit to pending, failed, or unsupported materials")
  .action(processSupportingMaterials)

program
  .command("materials:requeue-failed")
  .description("Move failed supporting materials back to pending for one bounded replay")
  .action(requeueSupportingMaterials)

program
  .command("embeddings:run")
  .description("Create missing or stale embeddings using the canonical per-product model routes")
  .option("--amendment-id <id>", "limit structured amendment work to one canonical amendment")
  .option("--bill-id <id>", "limit bill and section work to one canonical bill")
  .option("--document-id <id>", "limit section work to one document")
  .option("--material-id <id>", "limit supporting-material section work to one material")
  .option("--all", "continue until every missing bill and section embedding is created")
  .option("--limit <number>", "maximum records per kind", "64")
  .option("--shard-count <number>", "number of disjoint embedding workers", "1")
  .option("--shard-index <number>", "zero-based embedding worker index", "0")
  .action(runEmbeddings)

program
  .command("embeddings:document-sections")
  .description("Create missing or stale embeddings for one document's sections only")
  .requiredOption("--document-id <id>", "canonical bill-document ID")
  .option("--limit <number>", "maximum sections per embedding-provider request", "64")
  .action(runDocumentSectionEmbeddings)

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

program
  .command("jobs:recover")
  .description("Release a bounded lease left by a confirmed interrupted job execution")
  .requiredOption("--before <iso-date-time>")
  .requiredOption("--operation <operation>")
  .requiredOption("--scope-key <scope-key>")
  .requiredOption("--source <source>")
  .action(recoverJob)

async function serve() {
  const config = loadConfig()
  const logger = createLogger({ level: config.logging.level, service: "legislation" })
  const telemetry = createTelemetry(config)
  const { database, pool } = createDatabase(config.database)
  const retrievalClient =
    config.model.apiKey === undefined
      ? undefined
      : new OpenRouterRetrievalClient({ apiKey: config.model.apiKey, baseUrl: new URL(config.model.baseUrl) })
  const queryService = new LegislationQueryService(database, retrievalClient)
  const representativeLookupApi =
    config.ingestion.openStatesApiKey === undefined
      ? undefined
      : createRepresentativeLookupApi(
          new UsRepresentativeLookupProvider({
            apiBaseUrl: config.server.publicApiBaseUrl,
            geocoder: new CensusAddressGeocoder({ timeoutMs: config.ingestion.requestTimeoutMs }),
            openStates: new OpenStatesClient({
              apiKey: config.ingestion.openStatesApiKey,
              baseUrl: new URL(config.ingestion.openStatesApiUrl),
              http: openStatesHttpClient(config)
            })
          })
        )
  const researchAnswerApi =
    retrievalClient === undefined
      ? undefined
      : createResearchAnswerService(
          createCanonicalResearchEvidenceRetriever(queryService, config.server.publicApiBaseUrl),
          createOpenRouterResearchAnswerGenerator(retrievalClient, config.model.researchAnswerModel)
        )
  const mcp = createLegislationMcpHandler(queryService, logger, telemetry)
  const apiAuthenticate =
    config.auth.mode === "workos"
      ? createWorkosAuthenticator({
          m2m: {
            audience: [config.auth.apiAudience, config.auth.mcpAudience],
            issuer: config.auth.issuer,
            jwksUrl: config.auth.jwksUrl
          },
          userSession: config.auth.userSession
        })
      : undefined
  const mcpAuthenticate =
    config.auth.mode === "workos"
      ? createWorkosAuthenticator({
          m2m: {
            audience: config.auth.mcpAudience,
            issuer: config.auth.issuer,
            jwksUrl: config.auth.jwksUrl
          }
        })
      : undefined
  const server = createLegislationServer({
    apiHandler: createLegislationApiHandler(queryService, {
      apiBaseUrl: config.server.publicApiBaseUrl,
      documentDatabase: database,
      ...(representativeLookupApi === undefined ? {} : { representativeLookupApi }),
      researchAnswerApi,
      ...(config.security.idempotencyEncryptionKey === undefined
        ? {}
        : {
            subscriptionMutationExecutor: new SubscriptionIdempotencyTransaction(
              database,
              createAes256GcmIdempotencyCipher(decodeIdempotencyEncryptionKey(config.security.idempotencyEncryptionKey))
            )
          }),
      ...(config.security.idempotencyEncryptionKey === undefined ||
      config.security.webhookSecretEncryptionKey === undefined
        ? {}
        : {
            webhookMutationExecutor: new SubscriptionIdempotencyTransaction(
              database,
              createAes256GcmIdempotencyCipher(decodeIdempotencyEncryptionKey(config.security.idempotencyEncryptionKey))
            ),
            webhookSecretProtector: createAes256GcmWebhookSecretProtector(
              decodeIdempotencyEncryptionKey(config.security.webhookSecretEncryptionKey)
            )
          }),
      subscriptionRepository: new PostgresSubscriptionRepository(database),
      webhookReadRepository: new PostgresWebhookReadRepository(database)
    }),
    apiAuthenticate,
    documentFetchRelay:
      process.env.DOCUMENT_FETCH_RELAY_TOKEN === undefined
        ? undefined
        : {
            fetch: async (sourceUrl) =>
              await downloadDocument(sourceUrl, {
                detectContentType: false,
                fetch,
                timeoutMs: config.ingestion.requestTimeoutMs
              }),
            token: process.env.DOCUMENT_FETCH_RELAY_TOKEN
          },
    isReady: () => isDatabaseReady(pool),
    logger,
    mcpAuthenticate,
    mcpHandler: mcp.nodeHandler,
    protectedResourceMetadata:
      config.auth.mode === "workos"
        ? {
            authorizationServer: config.auth.issuer,
            resource: config.auth.mcpAudience
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

async function recoverJob(options: { before: string; operation: string; scopeKey: string; source: string }) {
  const before = parseDate(options.before, "before")
  if (before > new Date()) {
    throw new InvalidJobInput("before must not be in the future")
  }
  await withDatabase(async (database) => {
    const result = await recoverInterruptedIngestionJob(database, {
      before,
      operation: options.operation.trim(),
      scopeKey: options.scopeKey.trim(),
      source: options.source.trim()
    })
    if (!result.releasedLease) {
      throw new InvalidJobInput("no matching interrupted job lease was acquired before the cutoff")
    }
    process.stdout.write(
      `${JSON.stringify({
        before: before.toISOString(),
        operation: options.operation.trim(),
        recoveredRunIds: result.runIds,
        scopeKey: options.scopeKey.trim(),
        source: options.source.trim()
      })}\n`
    )
  })
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
        ...jobExecutionContext(),
        operation: "historical-import",
        scope: { stream: options.stream },
        scopeKey: `stream:${options.stream}`,
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

async function syncOpenStates(options: { from?: string; jurisdiction?: string }) {
  const config = loadConfig()
  if (config.ingestion.openStatesApiKey === undefined) {
    throw new InvalidJobInput("OPENSTATES_API_KEY is required for openstates:sync")
  }
  const from = options.from === undefined ? new Date(Date.now() - 7 * 86_400_000) : parseDate(options.from, "from")
  const requestedCode = options.jurisdiction?.trim().toLowerCase()
  const jurisdictions =
    requestedCode === undefined
      ? [...supportedOpenStatesJurisdictions]
      : supportedOpenStatesJurisdictions.filter((code) => code === requestedCode)
  if (jurisdictions.length === 0) {
    throw new InvalidJobInput(`unsupported Open States jurisdiction: ${options.jurisdiction}`)
  }
  const providerHttp = openStatesHttpClient(config)
  const client = new OpenStatesClient({
    apiKey: config.ingestion.openStatesApiKey,
    baseUrl: new URL(config.ingestion.openStatesApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "incremental-sync",
        scope: { from: from.toISOString(), jurisdictions },
        scopeKey: `bills:${requestedCode ?? "all"}`,
        source: "openstates"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        for (const code of jurisdictions) {
          let page = 1
          for await (const records of client.bills({
            from,
            jurisdiction: openStatesJurisdictionNames[code]
          })) {
            const contentHash = createHash("sha256").update(JSON.stringify(records)).digest("hex")
            const imported = await importOpenStatesRecords(
              database,
              { jurisdictionCode: code, jurisdictionName: openStatesJurisdictionNames[code] },
              records,
              {
                concurrency: config.ingestion.concurrency,
                contentHash,
                stream: `api-${code}-${from.toISOString()}-${page}`
              }
            )
            for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
              counts[key] += imported.counts[key]
            }
            failures.push(...imported.failures)
            page += 1
          }
        }
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "openstates" })
}

async function syncOpenStatesEntities(options: { jurisdiction?: string }) {
  const config = loadConfig()
  if (config.ingestion.openStatesApiKey === undefined) {
    throw new InvalidJobInput("OPENSTATES_API_KEY is required for openstates:entities")
  }
  const requestedCode = options.jurisdiction?.trim().toLowerCase()
  const jurisdictionCodes =
    requestedCode === undefined
      ? [...supportedOpenStatesJurisdictions]
      : supportedOpenStatesJurisdictions.filter((code) => code === requestedCode)
  if (jurisdictionCodes.length === 0) {
    throw new InvalidJobInput(`unsupported Open States jurisdiction: ${options.jurisdiction}`)
  }
  const providerHttp = openStatesHttpClient(config)
  const client = new OpenStatesClient({
    apiKey: config.ingestion.openStatesApiKey,
    baseUrl: new URL(config.ingestion.openStatesApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "current-entities",
        scope: { jurisdictions: jurisdictionCodes },
        scopeKey: `entities:${requestedCode ?? "all"}`,
        source: "openstates"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        for (const code of jurisdictionCodes) {
          try {
            const jurisdictionId = openStatesJurisdictionId(code)
            const rawPeople: unknown[] = []
            const rawCommittees: unknown[] = []
            for await (const page of client.people({ jurisdictionId })) {
              rawPeople.push(...page)
            }
            for await (const page of client.committees({ jurisdictionId })) {
              rawCommittees.push(...page)
            }
            const retrievedAt = new Date()
            const normalizedPeople = normalizeOpenStatesPeople(rawPeople, { jurisdictionCode: code, retrievedAt })
            const normalizedCommittees = normalizeOpenStatesCommittees(rawCommittees, {
              jurisdictionCode: code,
              retrievedAt
            })
            const snapshot = mergeOpenStatesEntitySnapshots(normalizedPeople, normalizedCommittees)
            await replaceEntitySnapshot(database, `jurisdiction:${code}`, snapshot)
            const records =
              snapshot.people.length +
              snapshot.terms.length +
              snapshot.organizations.length +
              snapshot.memberships.length
            counts.discovered += records
            counts.read += records
            counts.updated += records
          } catch (error) {
            counts.failed += 1
            failures.push({
              identifier: code,
              message: error instanceof Error ? error.message : "Unknown Open States entity synchronization failure",
              retryable: true
            })
          }
        }
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "openstates" })
}

async function syncOpenStatesEvents(options: { from?: string; jurisdiction?: string; to?: string }) {
  const config = loadConfig()
  if (config.ingestion.openStatesApiKey === undefined) {
    throw new InvalidJobInput("OPENSTATES_API_KEY is required for openstates:events")
  }
  const from = options.from === undefined ? new Date(Date.now() - 30 * 86_400_000) : parseDate(options.from, "from")
  const to = options.to === undefined ? new Date(Date.now() + 90 * 86_400_000) : parseDate(options.to, "to")
  if (from >= to) {
    throw new InvalidJobInput("event window start must precede its end")
  }
  const requestedCode = options.jurisdiction?.trim().toLowerCase()
  const jurisdictionCodes =
    requestedCode === undefined
      ? [...supportedOpenStatesJurisdictions]
      : supportedOpenStatesJurisdictions.filter((code) => code === requestedCode)
  if (jurisdictionCodes.length === 0) {
    throw new InvalidJobInput(`unsupported Open States jurisdiction: ${options.jurisdiction}`)
  }
  const providerHttp = openStatesHttpClient(config)
  const client = new OpenStatesClient({
    apiKey: config.ingestion.openStatesApiKey,
    baseUrl: new URL(config.ingestion.openStatesApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "events-sync",
        scope: { from: from.toISOString(), jurisdictions: jurisdictionCodes, to: to.toISOString() },
        scopeKey: `events:${requestedCode ?? "all"}`,
        source: "openstates"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        for (const code of jurisdictionCodes) {
          try {
            for await (const page of client.events({
              from,
              jurisdictionId: openStatesJurisdictionId(code),
              to
            })) {
              counts.discovered += page.length
              const retrievedAt = new Date()
              const snapshots = page.flatMap((record) => {
                try {
                  return [normalizeOpenStatesEvent(record, { jurisdictionCode: code, retrievedAt })]
                } catch (error) {
                  counts.failed += 1
                  failures.push({
                    identifier: code,
                    message: error instanceof Error ? error.message : "Unknown Open States event normalization failure",
                    retryable: false
                  })
                  return []
                }
              })
              await upsertEventSnapshots(database, snapshots)
              counts.read += snapshots.length
              counts.updated += snapshots.length
            }
          } catch (error) {
            counts.failed += 1
            failures.push({
              identifier: code,
              message: error instanceof Error ? error.message : "Unknown Open States event synchronization failure",
              retryable: true
            })
          }
        }
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "openstates" })
}

async function bootstrapOpenStates(options: { force?: boolean; jurisdiction?: string; manifestBlob: string }) {
  const config = loadConfig()
  const manifestBytes = await createArtifactStore(config, "state").read(options.manifestBlob)
  const manifest = parseOpenStatesManifest(new TextDecoder().decode(manifestBytes))
  const requestedCode = options.jurisdiction?.trim().toLowerCase()
  const archives = manifest.archives.filter(
    (archive) =>
      archive.jurisdictionCode in openStatesJurisdictionNames &&
      (requestedCode === undefined || archive.jurisdictionCode === requestedCode)
  )
  if (archives.length === 0) {
    throw new InvalidJobInput("Open States manifest contains no matching supported archives")
  }
  const providerHttp = openStatesHttpClient(config)
  const sourceStore = createSourceStore(config, "state")
  const logger = createCommandLogger(config)
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "historical-import",
        scope: { archives: archives.length, jurisdiction: requestedCode },
        scopeKey: `bootstrap:${requestedCode ?? "all"}`,
        source: "openstates"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        const archiveResults = await mapConcurrent(archives, 4, async (archive) => {
          const stream = `${archive.jurisdictionCode}-${archive.session}`
          logger.info("openstates archive progress", { event: "archive_started", stream })
          try {
            const url = new URL(archive.url)
            const content = await providerHttp.getBytes(url, MAXIMUM_ARCHIVE_BYTES)
            const contentHash = createHash("sha256").update(content).digest("hex")
            await sourceStore.put("openstates", stream, content, { sourceUrl: url.href })
            const imported = await importOpenStatesRecords(
              database,
              {
                jurisdictionCode: archive.jurisdictionCode,
                jurisdictionName:
                  openStatesJurisdictionNames[archive.jurisdictionCode as keyof typeof openStatesJurisdictionNames]
              },
              decodeArchiveRecords(content),
              { batchSize: 96, concurrency: config.ingestion.concurrency, contentHash, force: options.force, stream }
            )
            logger.info("openstates archive progress", {
              counts: imported.counts,
              event: "archive_completed",
              stream
            })
            return imported
          } catch (error) {
            logger.error("openstates archive failed", {
              errorMessage: error instanceof Error ? error.message : "Unknown Open States archive failure",
              stream
            })
            return {
              failure: {
                identifier: `${archive.jurisdictionCode}-${archive.session}`,
                message: error instanceof Error ? error.message : "Unknown Open States archive failure",
                retryable: true
              }
            }
          }
        })
        for (const archiveResult of archiveResults) {
          if ("failure" in archiveResult) {
            counts.failed += 1
            failures.push(archiveResult.failure)
          } else {
            for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
              counts[key] += archiveResult.counts[key]
            }
            failures.push(...archiveResult.failures)
          }
        }
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "openstates" })
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
  const { billTypes, congresses, end, start } = parseGovInfoScope(options, config)
  const providerHttp = httpClient(config)
  const client = new GovInfoClient(providerHttp)
  const packages = await client.discover(congresses, billTypes)
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "historical-import",
        scope: { billTypes, end, start },
        scopeKey: `congress:${start}-${end}`,
        source: "govinfo"
      },
      async () =>
        importGovInfoPackages(database, client, packages, {
          concurrency: config.ingestion.concurrency,
          force: options.force,
          sourceStore: createSourceStore(config, "federal"),
          stream: `${start}-${end}-${billTypes.join("-")}`
        })
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "govinfo" })
}

async function discoverGovInfo(options: {
  billTypes: string
  blobPath?: string
  endCongress?: string
  output: string
  startCongress?: string
}) {
  const config = loadConfig()
  const { billTypes, congresses, end, start } = parseGovInfoScope(options, config)
  const providerHttp = httpClient(config)
  const packages = await new GovInfoClient(providerHttp).discover(congresses, billTypes)
  if (packages.length === 0) {
    throw new InvalidJobInput("GovInfo discovery returned no BILLSTATUS packages")
  }
  const manifest = {
    billTypes,
    discoveredAt: new Date().toISOString(),
    endCongress: end,
    packages: packages.map((item) => ({
      archiveEntry: item.archiveEntry,
      archiveUrl: item.archiveUrl?.href,
      billType: item.billType,
      congress: item.congress,
      packageId: item.packageId,
      url: item.url.href
    })),
    source: "govinfo",
    startCongress: start,
    version: 1
  } as const
  const bytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
  const output = resolve(options.output)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, bytes)
  const stored =
    options.blobPath === undefined
      ? undefined
      : await createArtifactStore(config, "federal").put(options.blobPath, bytes)
  process.stdout.write(`${JSON.stringify({ blobPath: options.blobPath, output, packages: packages.length, stored })}\n`)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "govinfo" })
}

function parseGovInfoScope(
  options: { billTypes: string; endCongress?: string; startCongress?: string },
  config: LegislationConfig
) {
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
  if (billTypes.length === 0) {
    throw new InvalidJobInput("at least one bill type is required")
  }
  return { billTypes, congresses, end, start }
}

async function syncCongress(options: { dryRun?: boolean; from?: string; to?: string }) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:sync")
  }
  const providerHttp = congressBootstrapHttpClient(config)
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
      {
        ...jobExecutionContext(),
        operation: "incremental-sync",
        scope: { ...options },
        scopeKey: "bills:current",
        source: "congress"
      },
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

async function syncCongressEntities(options: { endCongress?: string; startCongress?: string }) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:entities")
  }
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const congresses = Array.from({ length: end - start + 1 }, (_value, index) => start + index)
  const providerHttp = httpClient(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "current-entities",
        scope: { endCongress: end, startCongress: start },
        scopeKey: start === end ? `entities:${start}` : "entities:all",
        source: "congress"
      },
      async () => {
        const counts = createJobCounts()
        const rawMembers: Array<{ congress: number; records: unknown[] }> = []
        const rawCommittees: unknown[] = []
        for (const congress of congresses) {
          const members: unknown[] = []
          for await (const page of client.members(congress)) {
            members.push(...page)
          }
          rawMembers.push({ congress, records: members })
          for await (const page of client.committees(congress)) {
            rawCommittees.push(...page)
          }
        }
        const entityContext = { retrievedAt: new Date() }
        const memberDetailCache = new Map<string, unknown>()
        const memberSnapshots = []
        for (const { congress, records } of rawMembers) {
          memberSnapshots.push(
            await hydrateCongressMemberSnapshot(records, congress, entityContext, client, memberDetailCache)
          )
        }
        const committeeSnapshot = normalizeCongressCommittees(rawCommittees, entityContext)
        const peopleById = new Map(
          memberSnapshots.flatMap((snapshot) => snapshot.people).map((person) => [person.id, person])
        )
        const termsById = new Map(memberSnapshots.flatMap((snapshot) => snapshot.terms).map((term) => [term.id, term]))
        const organizationsById = new Map(
          committeeSnapshot.organizations.map((organization) => [organization.id, organization])
        )
        const personDetailsByPersonId = new Map(
          memberSnapshots.flatMap((snapshot) => snapshot.personDetails ?? []).map((detail) => [detail.personId, detail])
        )
        const personJurisdictionsByIdentity = new Map(
          memberSnapshots
            .flatMap((snapshot) => snapshot.personJurisdictions ?? [])
            .map((jurisdiction) => [
              `${jurisdiction.personId}:${jurisdiction.jurisdictionId}:${jurisdiction.sourceIdentity}`,
              jurisdiction
            ])
        )
        await replaceEntitySnapshot(database, "jurisdiction:us", {
          memberships: [],
          organizations: [...organizationsById.values()],
          personAliasPersonIds: [],
          personAliases: [],
          personDetailPersonIds: [...personDetailsByPersonId.keys()],
          personDetailSourceProvider: "congress",
          personDetails: [...personDetailsByPersonId.values()],
          personJurisdictions: [...personJurisdictionsByIdentity.values()],
          people: [...peopleById.values()],
          termPersonIds: [...new Set(memberSnapshots.flatMap((snapshot) => snapshot.termPersonIds ?? []))],
          termSourceProvider: "congress",
          terms: [...termsById.values()]
        })
        const records = peopleById.size + termsById.size + organizationsById.size
        Object.assign(counts, { discovered: records, read: records, updated: records })
        return { counts, failures: [] }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function syncCongressAmendmentData(options: {
  endCongress?: string
  limit?: string
  restart?: boolean
  startCongress?: string
}) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:amendments")
  }
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const limit = options.limit === undefined ? undefined : parseInteger(options.limit, "limit")
  const providerHttp = congressBootstrapHttpClient(config)
  const logger = createCommandLogger(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp,
    onPage: (progress) => logger.info("congress amendment page progress", progress)
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "amendments-bootstrap",
        scope: { endCongress: end, startCongress: start },
        scopeKey: start === end ? `amendments:${start}` : "amendments:all",
        source: "congress"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        let checkpoint: Readonly<Record<string, unknown>> | undefined
        for (let congress = start; congress <= end; congress += 1) {
          const synchronized = await synchronizeCongressAmendments(database, client, congress, {
            limit,
            restart: options.restart,
            sourceStore: createSourceStore(config, "federal")
          })
          for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
            counts[key] += synchronized.counts[key]
          }
          failures.push(...synchronized.failures)
          checkpoint = { congress, ...synchronized.checkpoint }
        }
        return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  logger.info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function syncCongressCommitteeReportData(options: {
  endCongress?: string
  limit?: string
  restart?: boolean
  startCongress?: string
}) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:reports")
  }
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const limit = options.limit === undefined ? undefined : parseInteger(options.limit, "limit")
  const providerHttp = congressBootstrapHttpClient(config)
  const logger = createCommandLogger(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp,
    onPage: (progress) => logger.info("congress committee report page progress", progress)
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "committee-reports-bootstrap",
        scope: { endCongress: end, startCongress: start },
        scopeKey: start === end ? `committee-reports:${start}` : "committee-reports:all",
        source: "congress"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        let checkpoint: Readonly<Record<string, unknown>> | undefined
        for (let congress = start; congress <= end; congress += 1) {
          const synchronized = await synchronizeCongressCommitteeReports(database, client, congress, {
            limit,
            restart: options.restart,
            sourceStore: createSourceStore(config, "federal")
          })
          for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
            counts[key] += synchronized.counts[key]
          }
          failures.push(...synchronized.failures)
          checkpoint = { congress, ...synchronized.checkpoint }
        }
        return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  logger.info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function syncCongressEventData(options: {
  domain: string
  endCongress?: string
  limit?: string
  rematerialize?: boolean
  restart?: boolean
  startCongress?: string
}) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:events")
  }
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const domains: Array<"hearings" | "meetings"> = []
  if (options.domain === "both" || options.domain === "meetings") {
    domains.push("meetings")
  }
  if (options.domain === "both" || options.domain === "hearings") {
    domains.push("hearings")
  }
  if (domains.length === 0) {
    throw new InvalidJobInput("domain must be meetings, hearings, or both")
  }
  const limit = options.limit === undefined ? undefined : parseInteger(options.limit, "limit")
  const providerHttp = congressBootstrapHttpClient(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "events-bootstrap",
        scope: { domains, endCongress: end, startCongress: start },
        scopeKey: start === end ? `events:${start}` : "events:all",
        source: "congress"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        let checkpoint: Readonly<Record<string, unknown>> | undefined
        for (let congress = start; congress <= end; congress += 1) {
          for (const domain of domains) {
            const synchronized = await synchronizeCongressEvents(database, client, congress, domain, {
              forceRematerialize: options.rematerialize,
              limit,
              restart: options.restart === true || options.rematerialize === true,
              sourceStore: createSourceStore(config, "federal")
            })
            for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
              counts[key] += synchronized.counts[key]
            }
            failures.push(...synchronized.failures)
            checkpoint = { congress, domain, ...synchronized.checkpoint }
          }
        }
        return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function syncCongressHouseVoteData(options: {
  endCongress?: string
  limit?: string
  restart?: boolean
  session?: string
  startCongress?: string
}) {
  const config = loadConfig()
  if (config.ingestion.congressApiKey === undefined) {
    throw new InvalidJobInput("CONGRESS_API_KEY is required for congress:house-votes")
  }
  const start = parseInteger(options.startCongress ?? String(config.ingestion.federalStartCongress), "start Congress")
  const end = parseInteger(options.endCongress ?? String(config.ingestion.federalEndCongress), "end Congress")
  if (start > end) {
    throw new InvalidJobInput("start Congress must not exceed end Congress")
  }
  const sessions = options.session === undefined ? [1, 2] : [parseInteger(options.session, "session")]
  if (sessions.some((session) => session !== 1 && session !== 2)) {
    throw new InvalidJobInput("session must be 1 or 2")
  }
  const limit = options.limit === undefined ? undefined : parseInteger(options.limit, "limit")
  const providerHttp = congressBootstrapHttpClient(config)
  const client = new CongressClient({
    apiKey: config.ingestion.congressApiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: providerHttp
  })
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "house-votes-bootstrap",
        scope: { endCongress: end, sessions, startCongress: start },
        scopeKey: start === end ? `house-votes:${start}` : "house-votes:all",
        source: "congress"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        let checkpoint: Readonly<Record<string, unknown>> | undefined
        for (let congress = start; congress <= end; congress += 1) {
          for (const session of sessions) {
            const synchronized = await synchronizeCongressHouseVotes(database, client, congress, session, {
              concurrency: config.ingestion.concurrency,
              limit,
              restart: options.restart,
              sourceStore: createSourceStore(config, "federal")
            })
            for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
              counts[key] += synchronized.counts[key]
            }
            failures.push(...synchronized.failures)
            checkpoint = { congress, session, ...synchronized.checkpoint }
          }
        }
        return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
      }
    )
    printJobResult(result)
  }, config)
  createCommandLogger(config).info("provider request metrics", { ...providerHttp.metrics, source: "congress" })
}

async function processDocuments(options: {
  all?: boolean
  asyncCommit?: boolean
  billId?: string
  documentId?: string
  failureCategory?: string
  force?: boolean
  jurisdictionId?: string
  limit: string
  shardCount: string
  shardIndex: string
  status?: string
}) {
  const config = loadConfig()
  const logger = createCommandLogger(config)
  if (options.all === true && options.status !== undefined) {
    throw new InvalidJobInput("--all cannot be combined with --status")
  }
  if (options.failureCategory !== undefined && options.status !== "failed") {
    throw new InvalidJobInput("--failure-category requires --status failed")
  }
  const shardCount = parseInteger(options.shardCount, "shard count")
  const shardIndex = Number(options.shardIndex)
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new InvalidJobInput("shard index must be a zero-based integer smaller than shard count")
  }
  if (shardCount > 1 && (options.all !== true || options.billId !== undefined || options.documentId !== undefined)) {
    throw new InvalidJobInput("document sharding requires --all and cannot be combined with targeted IDs")
  }
  await withDatabase(
    async (database) => {
      const result = await runIngestionJob(
        database,
        {
          ...jobExecutionContext(),
          operation: shardCount === 1 ? "process-documents" : `process-documents-shard-${shardIndex}`,
          scope: { ...options },
          scopeKey: shardCount === 1 ? "all" : `shard:${shardIndex}-of-${shardCount}`,
          source: "documents"
        },
        async () => {
          const limit = parseInteger(options.limit, "limit")
          const counts = { ...createJobCounts(), processed: 0, unsupported: 0 }
          const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
          const artifactStore = createArtifactStore(config, "documents")
          let status: "failed" | "pending" | "unsupported" | undefined
          const failureCategory =
            options.failureCategory === undefined ? undefined : parseDocumentFailureCategory(options.failureCategory)
          if (options.all === true) {
            status = "pending"
          } else if (options.status !== undefined) {
            status = parseDocumentStatus(options.status)
          }
          let hasMoreDocuments = true
          let batches = 0
          do {
            const processed = await processPendingDocuments(database, {
              artifactStore,
              billId: options.billId,
              concurrency: config.ingestion.concurrency,
              documentId: options.documentId,
              failureCategory,
              force: options.force,
              jurisdictionId: options.jurisdictionId,
              limit,
              maximumAttempts: config.ingestion.maxAttempts,
              shardCount,
              shardIndex,
              status,
              timeoutMs: config.ingestion.requestTimeoutMs
            })
            for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
              counts[key] += processed.counts[key]
            }
            failures.push(...processed.failures.slice(0, Math.max(0, 20 - failures.length)))
            batches += 1
            logger.info("document processing progress", { batches, counts, shardCount, shardIndex })
            hasMoreDocuments = options.all === true && processed.counts.discovered === limit
          } while (hasMoreDocuments)
          return { counts, failures }
        }
      )
      printJobResult(result)
    },
    config,
    options.asyncCommit === true ? { synchronousCommit: "off" } : undefined
  )
}

async function processCaliforniaPubinfo(options: {
  archive: string
  concurrency: string
  limit: string
  sessionStartYear: string
}) {
  const config = loadConfig()
  const archivePath = resolve(options.archive)
  const archiveStat = await stat(archivePath)
  if (!archiveStat.isFile() || archiveStat.size === 0) {
    throw new InvalidJobInput("California PUBINFO archive must be a non-empty file")
  }
  const sessionStartYear = parseInteger(options.sessionStartYear, "session start year")
  const concurrency = parseInteger(options.concurrency, "concurrency")
  const limit = parseInteger(options.limit, "limit")
  if (concurrency > 32) {
    throw new InvalidJobInput("concurrency must not exceed 32")
  }
  if (limit > 50_000) {
    throw new InvalidJobInput("limit must not exceed 50000")
  }

  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: `process-california-pubinfo-${sessionStartYear}`,
        scope: { archivePath, concurrency, limit, sessionStartYear },
        scopeKey: `california-pubinfo:${sessionStartYear}`,
        source: "documents"
      },
      async () => {
        const processed = await processCaliforniaPubinfoArchive(
          database,
          createArtifactStore(config, "documents"),
          () => createReadStream(archivePath),
          {
            concurrency,
            limit,
            maximumAttempts: config.ingestion.maxAttempts,
            sessionStartYear
          }
        )
        return {
          checkpoint: { complete: processed.claimed < limit, sessionStartYear },
          counts: createJobCounts({
            discovered: processed.claimed,
            failed: processed.failed,
            read: processed.processed + processed.failed,
            skipped: processed.missing,
            updated: processed.processed
          }),
          failures:
            processed.failed === 0
              ? []
              : [
                  {
                    message: `${processed.failed} California PUBINFO documents failed processing`,
                    retryable: false
                  }
                ]
        }
      }
    )
    printJobResult(result)
  }, config)
}

async function processOcrDocuments(options: { documentId?: string; limit: string }) {
  const config = loadConfig()
  const limit = parseInteger(options.limit, "limit")
  if (config.ocr.endpoint === undefined) {
    throw new InvalidJobInput("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT is required for OCR")
  }
  const ocrEndpoint = config.ocr.endpoint
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "ocr-documents",
        scope: { ...options, limit },
        scopeKey: options.documentId ?? "all",
        source: "documents"
      },
      async () => {
        const ocr = await processOcrRequiredDocuments(database, {
          artifactStore: createArtifactStore(config, "documents"),
          batchSize: limit,
          concurrency: 1,
          documentId: options.documentId,
          maximumAttempts: config.ocr.maximumAttempts,
          ocr: new AzureDocumentIntelligenceClient(ocrEndpoint)
        })
        return {
          checkpoint: { complete: ocr.claimed < limit, pages: ocr.pages },
          counts: createJobCounts({
            discovered: ocr.claimed,
            failed: ocr.failed,
            read: ocr.processed + ocr.failed,
            updated: ocr.processed
          }),
          failures: ocr.failures
        }
      }
    )
    printJobResult(result)
  }, config)
}

async function classifyTerminalDocuments(options: { limit: string }) {
  const config = loadConfig()
  const limit = parseInteger(options.limit, "limit")
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "classify-terminal",
        scope: { limit },
        scopeKey: "all",
        source: "documents"
      },
      async () => {
        const classified = await classifyTerminalDocumentFailures(database, limit)
        return {
          counts: createJobCounts({
            discovered: classified.inspected,
            skipped: classified.inspected - classified.updated,
            updated: classified.updated
          }),
          failures: []
        }
      }
    )
    printJobResult(result)
  }, config)
}

async function prepareKnownDocumentRemediation(options: { cohort: string; limit: string }) {
  const config = loadConfig()
  const cohort = parseDocumentRemediationCohort(options.cohort)
  const limit = parseInteger(options.limit, "limit")
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: `prepare-remediation-${cohort}`,
        scope: { cohort, limit },
        scopeKey: cohort,
        source: "documents"
      },
      async () => {
        const prepared = await prepareDocumentRemediation(database, cohort, limit)
        return {
          checkpoint: { cohort, identifiers: prepared.identifiers },
          counts: createJobCounts({ discovered: prepared.prepared, updated: prepared.prepared }),
          failures: []
        }
      }
    )
    printJobResult(result)
  }, config)
}

async function recoverInterruptedDocuments(options: { before: string; shardCount: string; shardIndex: string }) {
  const config = loadConfig()
  const before = parseDate(options.before, "before")
  if (before > new Date()) {
    throw new InvalidJobInput("before must not be in the future")
  }
  const shardCount = parseInteger(options.shardCount, "shard count")
  const shardIndex = parseInteger(options.shardIndex, "shard index")
  if (shardCount < 1) {
    throw new InvalidJobInput("shard count must be at least 1")
  }
  if (shardIndex < 0 || shardIndex >= shardCount) {
    throw new InvalidJobInput("shard index must be non-negative and less than shard count")
  }
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "recover-interrupted",
        scope: { before: before.toISOString(), shardCount, shardIndex },
        scopeKey: `shard:${shardIndex}-of-${shardCount}`,
        source: "documents"
      },
      async () => {
        const requeued = await requeueInterruptedDocuments(database, before, 10_000, {
          count: shardCount,
          index: shardIndex
        })
        return { counts: createJobCounts({ discovered: requeued, updated: requeued }), failures: [] }
      }
    )
    printJobResult(result)
  }, config)
}

async function processSupportingMaterials(options: {
  all?: boolean
  force?: boolean
  jurisdictionId?: string
  limit: string
  materialId?: string
  status?: string
}) {
  const config = loadConfig()
  const logger = createCommandLogger(config)
  if (options.all === true && options.status !== undefined) {
    throw new InvalidJobInput("--all cannot be combined with --status")
  }
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "process-supporting-materials",
        scope: { ...options },
        scopeKey: "all",
        source: "documents"
      },
      async () => {
        const limit = parseInteger(options.limit, "limit")
        const counts = { ...createJobCounts(), processed: 0, unsupported: 0 }
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        const artifactStore = createArtifactStore(config, "documents")
        let status: "failed" | "pending" | "unsupported" | undefined
        if (options.all === true) {
          // The default selection includes pending records and only the due,
          // retryable failed records that still have an attempt remaining.
          status = undefined
        } else if (options.status !== undefined) {
          status = parseDocumentStatus(options.status)
        }
        let hasMoreMaterials = true
        let batches = 0
        do {
          const processed = await processPendingSupportingMaterials(database, {
            artifactStore,
            concurrency: config.ingestion.concurrency,
            force: options.force,
            jurisdictionId: options.jurisdictionId,
            limit,
            materialId: options.materialId,
            status,
            timeoutMs: config.ingestion.requestTimeoutMs
          })
          for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
            counts[key] += processed.counts[key]
          }
          failures.push(...processed.failures)
          batches += 1
          logger.info("supporting material processing progress", { batches, counts })
          hasMoreMaterials = options.all === true && processed.counts.discovered === limit
        } while (hasMoreMaterials)
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
}

async function requeueSupportingMaterials() {
  const config = loadConfig()
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "requeue-failed",
        scope: {},
        scopeKey: "all",
        source: "supporting-materials"
      },
      async () => {
        const requeued = await requeueFailedSupportingMaterials(database, config.ingestion.maxAttempts)
        return { counts: createJobCounts({ discovered: requeued, updated: requeued }), failures: [] }
      }
    )
    printJobResult(result)
  }, config)
}

async function runEmbeddings(options: {
  all?: boolean
  amendmentId?: string
  billId?: string
  documentId?: string
  limit: string
  materialId?: string
  shardCount: string
  shardIndex: string
}) {
  const config = loadConfig()
  if (config.model.apiKey === undefined) {
    throw new InvalidJobInput("OPENROUTER_API_KEY is required for embeddings:run")
  }
  const apiKey = config.model.apiKey
  const createClient = (product: Parameters<typeof embeddingRouteFor>[0]) =>
    new OpenRouterEmbeddingClient({
      apiKey,
      baseUrl: new URL(config.model.baseUrl),
      maximumAttempts: config.ingestion.maxAttempts,
      route: embeddingRouteFor(product),
      timeoutMs: config.ingestion.requestTimeoutMs
    })
  const clients = {
    amendments: createClient("structured-amendment"),
    bills: createClient("bill"),
    materials: createClient("supporting-material-section"),
    sections: createClient("document-section")
  }
  const limit = parseInteger(options.limit, "limit")
  const shardCount = parseInteger(options.shardCount, "shard count")
  const shardIndex = Number(options.shardIndex)
  if (!Number.isSafeInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new InvalidJobInput("shard index must be a zero-based integer smaller than shard count")
  }
  if (
    shardCount > 1 &&
    (options.all !== true ||
      options.amendmentId !== undefined ||
      options.billId !== undefined ||
      options.documentId !== undefined ||
      options.materialId !== undefined)
  ) {
    throw new InvalidJobInput("embedding sharding requires --all and cannot be combined with targeted IDs")
  }
  const telemetry = createTelemetry(config)
  const logger = createCommandLogger(config)
  const executionContext = jobExecutionContext()
  await withDatabase(async (database) => {
    try {
      const result = await runIngestionJob(
        database,
        {
          ...executionContext,
          operation: shardCount === 1 ? "refresh-embeddings" : `refresh-embeddings-shard-${shardIndex}`,
          scope: { limit, shardCount, shardIndex },
          scopeKey: shardCount === 1 ? "all" : `shard:${shardIndex}-of-${shardCount}`,
          source: "openrouter"
        },
        async () => {
          let embedded = 0
          let amendmentCursor = ""
          let batches = 0
          let billCursor = ""
          let materialCursor = ""
          let sectionCursor = ""
          let skipped = 0
          let hasMoreEmbeddings = true
          do {
            const amendmentRoute = embeddingRouteFor("structured-amendment")
            const amendmentRows = await telemetry.observe(
              "embedding.amendments",
              { batchLimit: limit, model: amendmentRoute.model },
              () =>
                embedAmendments(database, clients.amendments, {
                  afterId: amendmentCursor,
                  amendmentId: options.amendmentId,
                  limit,
                  rolloutId: executionContext.correlationId,
                  shardCount,
                  shardIndex
                })
            )
            const billRoute = embeddingRouteFor("bill")
            const bills = await telemetry.observe(
              "embedding.bills",
              { batchLimit: limit, model: billRoute.model },
              () =>
                embedBills(database, clients.bills, {
                  afterId: billCursor,
                  billId: options.billId,
                  limit,
                  rolloutId: executionContext.correlationId,
                  shardCount,
                  shardIndex
                })
            )
            const sectionRoute = embeddingRouteFor("document-section")
            const sections = await telemetry.observe(
              "embedding.sections",
              { batchLimit: limit, model: sectionRoute.model },
              () =>
                embedDocumentSections(database, clients.sections, {
                  afterId: sectionCursor,
                  billId: options.billId,
                  documentId: options.documentId,
                  limit,
                  rolloutId: executionContext.correlationId,
                  shardCount,
                  shardIndex
                })
            )
            const materialRoute = embeddingRouteFor("supporting-material-section")
            const materials = await telemetry.observe(
              "embedding.supporting_material_sections",
              { batchLimit: limit, model: materialRoute.model },
              () =>
                embedSupportingMaterialSections(database, clients.materials, {
                  afterId: materialCursor,
                  limit,
                  materialId: options.materialId,
                  rolloutId: executionContext.correlationId,
                  shardCount,
                  shardIndex
                })
            )
            embedded += amendmentRows.embedded + bills.embedded + sections.embedded + materials.embedded
            skipped += amendmentRows.skipped + bills.skipped + sections.skipped + materials.skipped
            batches += 1
            amendmentCursor = amendmentRows.cursor
            billCursor = bills.cursor
            materialCursor = materials.cursor
            sectionCursor = sections.cursor
            hasMoreEmbeddings =
              options.all === true &&
              !(amendmentRows.complete && bills.complete && sections.complete && materials.complete)
            if (batches % 10 === 0 || !hasMoreEmbeddings) {
              logger.info("embedding progress", { batches, embedded, shardCount, shardIndex, skipped })
            }
          } while (hasMoreEmbeddings)
          return {
            counts: createJobCounts({
              inserted: embedded,
              skipped
            }),
            failures: []
          }
        }
      )
      createCommandLogger(config).info("embedding request metrics", {
        amendments: clients.amendments.metrics,
        bills: clients.bills.metrics,
        materials: clients.materials.metrics,
        reused: result.counts.skipped,
        sections: clients.sections.metrics,
        source: "openrouter"
      })
      printJobResult(result)
    } finally {
      await telemetry.shutdown()
    }
  }, config)
}

async function runDocumentSectionEmbeddings(options: { documentId: string; limit: string }) {
  const limit = parseInteger(options.limit, "limit")
  if (limit > 64) {
    throw new InvalidJobInput("limit must not exceed 64 for document-section embeddings")
  }
  const config = loadConfig()
  if (config.model.apiKey === undefined) {
    throw new InvalidJobInput("OPENROUTER_API_KEY is required for embeddings:document-sections")
  }
  const client = new OpenRouterEmbeddingClient({
    apiKey: config.model.apiKey,
    baseUrl: new URL(config.model.baseUrl),
    maximumAttempts: config.ingestion.maxAttempts,
    route: embeddingRouteFor("document-section"),
    timeoutMs: config.ingestion.requestTimeoutMs
  })
  const telemetry = createTelemetry(config)
  const executionContext = jobExecutionContext()
  await withDatabase(async (database) => {
    try {
      const result = await runIngestionJob(
        database,
        {
          ...executionContext,
          operation: "refresh-document-section-embeddings",
          scope: { documentId: options.documentId, limit },
          scopeKey: options.documentId,
          source: "openrouter"
        },
        async () => {
          let afterId = ""
          let embedded = 0
          let scanned = 0
          let skipped = 0
          let complete = false
          while (!complete) {
            const sections = await telemetry.observe(
              "embedding.document_sections",
              { batchLimit: limit, model: embeddingRouteFor("document-section").model },
              async () =>
                await embedDocumentSections(database, client, {
                  afterId,
                  documentId: options.documentId,
                  limit,
                  rolloutId: executionContext.correlationId
                })
            )
            if (!sections.complete && sections.cursor === afterId) {
              throw new Error("Document-section embedding cursor did not advance")
            }
            afterId = sections.cursor
            complete = sections.complete
            embedded += sections.embedded
            scanned += sections.scanned
            skipped += sections.skipped
          }
          if (scanned === 0) {
            throw new InvalidJobInput("Document has no sections to embed")
          }
          return {
            counts: createJobCounts({ discovered: scanned, inserted: embedded, skipped }),
            failures: []
          }
        }
      )
      createCommandLogger(config).info("document-section embedding request metrics", {
        documentId: options.documentId,
        embedded: result.counts.inserted,
        provider: client.metrics,
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

function openStatesHttpClient(config: LegislationConfig) {
  return new RetryingHttpClient({
    maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
    minimumIntervalMs: 750,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
}

function congressBootstrapHttpClient(config: LegislationConfig) {
  return new RetryingHttpClient({
    maxAttempts: config.ingestion.maxAttempts,
    minimumIntervalMs: 750,
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
  config = loadConfig(),
  session?: Parameters<typeof createDatabase>[1]
): Promise<T> {
  const { database, pool } = createDatabase(config.database, session)
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

function parseDocumentFailureCategory(value: string): DocumentFailureCategory {
  if (!DOCUMENT_FAILURE_CATEGORIES.includes(value as DocumentFailureCategory)) {
    throw new InvalidJobInput(`failure category must be one of ${DOCUMENT_FAILURE_CATEGORIES.join(", ")}`)
  }
  return value as DocumentFailureCategory
}

function parseDocumentRemediationCohort(value: string): DocumentRemediationCohort {
  if (!DOCUMENT_REMEDIATION_COHORTS.includes(value as DocumentRemediationCohort)) {
    throw new InvalidJobInput(`remediation cohort must be one of ${DOCUMENT_REMEDIATION_COHORTS.join(", ")}`)
  }
  return value as DocumentRemediationCohort
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
  if (error instanceof JobAlreadyRunningError) {
    process.stdout.write(
      `${JSON.stringify({ operation: error.operation, scopeKey: error.scopeKey, source: error.source, status: "overlap_skipped" })}\n`
    )
    process.exitCode = JOB_EXIT_CODE.succeeded
    return
  }
  const logger = createLogger({ level: "error", service: "legislation" })
  logger.error("command failed", errorContext(error))
  process.exitCode = error instanceof InvalidJobInput ? JOB_EXIT_CODE.invalid : JOB_EXIT_CODE.failed
})
