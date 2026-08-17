import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { Command } from "commander"
import { createWorkosAuthenticator } from "../auth/workos.js"
import { loadConfig, type LegislationConfig } from "../config/config.js"
import { compareCoverageReports, generateCoverageReport, isCoverageReport } from "../coverage/report.js"
import { createDatabase, databasePoolSnapshot, type LegislationDatabase } from "../db/database.js"
import { migrateDatabase } from "../db/migrate.js"
import { replaceEntitySnapshot } from "../db/queries/entities.js"
import { upsertEventSnapshots } from "../db/queries/events.js"
import { isDatabaseReady, waitForDatabase } from "../db/readiness.js"
import { decodeArchiveRecords, MAXIMUM_ARCHIVE_BYTES } from "../ingestion/archive.js"
import { CongressClient } from "../ingestion/congress/client.js"
import { normalizeCongressCommittees, normalizeCongressMembers } from "../ingestion/congress/entities.js"
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
import {
  createJobCounts,
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
import { normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "../ingestion/openstates/entities.js"
import { normalizeOpenStatesEvent } from "../ingestion/openstates/events.js"
import { importOpenStatesRecords } from "../ingestion/openstates/import.js"
import { parseOpenStatesManifest } from "../ingestion/openstates/manifest.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../ingestion/source-store.js"
import { LegislationQueryService } from "../legislation/query-service.js"
import { close, createLegislationServer, listen } from "../mcp/server.js"
import { createLegislationMcpHandler } from "../mcp/tools.js"
import { OpenRouterEmbeddingClient } from "../models/openrouter-embeddings.js"
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
  .command("documents:process")
  .description("Acquire and process pending official bill documents")
  .option("--bill-id <id>")
  .option("--document-id <id>")
  .option("--all", "continue until every pending document has been attempted")
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
  .option("--all", "continue until every missing bill and section embedding is created")
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

program
  .command("jobs:recover")
  .description("Release a bounded lease left by a confirmed interrupted job execution")
  .requiredOption("--before <iso-date-time>")
  .requiredOption("--operation <operation>")
  .requiredOption("--source <source>")
  .action(recoverJob)

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
            resource: config.auth.audience
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

async function recoverJob(options: { before: string; operation: string; source: string }) {
  const before = parseDate(options.before, "before")
  if (before > new Date()) {
    throw new InvalidJobInput("before must not be in the future")
  }
  await withDatabase(async (database) => {
    const result = await recoverInterruptedIngestionJob(database, {
      before,
      operation: options.operation.trim(),
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
    throw new InvalidJobInput("OPENSTATE_API_KEY is required for openstates:sync")
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
    throw new InvalidJobInput("OPENSTATE_API_KEY is required for openstates:entities")
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
            const normalizedPeople = normalizeOpenStatesPeople(rawPeople, { jurisdictionCode: code })
            const normalizedCommittees = normalizeOpenStatesCommittees(rawCommittees, { jurisdictionCode: code })
            const peopleById = new Map(
              [...normalizedPeople.people, ...normalizedCommittees.people].map((person) => [person.id, person])
            )
            const termsById = new Map(
              [...normalizedPeople.terms, ...normalizedCommittees.terms].map((term) => [term.id, term])
            )
            await replaceEntitySnapshot(database, `jurisdiction:${code}`, {
              memberships: normalizedCommittees.memberships,
              organizations: normalizedCommittees.organizations,
              people: [...peopleById.values()],
              terms: [...termsById.values()]
            })
            const records =
              peopleById.size +
              termsById.size +
              normalizedCommittees.organizations.length +
              normalizedCommittees.memberships.length
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
    throw new InvalidJobInput("OPENSTATE_API_KEY is required for openstates:events")
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
              const snapshots = page.flatMap((record) => {
                try {
                  return [normalizeOpenStatesEvent(record, { jurisdictionCode: code })]
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
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      {
        ...jobExecutionContext(),
        operation: "historical-import",
        scope: { archives: archives.length, jurisdiction: requestedCode },
        source: "openstates"
      },
      async () => {
        const counts = createJobCounts()
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        const archiveResults = await mapConcurrent(archives, 4, async (archive) => {
          try {
            const url = new URL(archive.url)
            const content = await providerHttp.getBytes(url, MAXIMUM_ARCHIVE_BYTES)
            const contentHash = createHash("sha256").update(content).digest("hex")
            const stream = `${archive.jurisdictionCode}-${archive.session}`
            await sourceStore.put("openstates", stream, content, { sourceUrl: url.href })
            return await importOpenStatesRecords(
              database,
              {
                jurisdictionCode: archive.jurisdictionCode,
                jurisdictionName:
                  openStatesJurisdictionNames[archive.jurisdictionCode as keyof typeof openStatesJurisdictionNames]
              },
              decodeArchiveRecords(content),
              { batchSize: 96, concurrency: config.ingestion.concurrency, contentHash, force: options.force, stream }
            )
          } catch (error) {
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
      { ...jobExecutionContext(), operation: "incremental-sync", scope: { ...options }, source: "congress" },
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
        const memberSnapshots = rawMembers.map(({ congress, records }) => normalizeCongressMembers(records, congress))
        const committeeSnapshot = normalizeCongressCommittees(rawCommittees)
        const peopleById = new Map(
          memberSnapshots.flatMap((snapshot) => snapshot.people).map((person) => [person.id, person])
        )
        const termsById = new Map(memberSnapshots.flatMap((snapshot) => snapshot.terms).map((term) => [term.id, term]))
        const organizationsById = new Map(
          committeeSnapshot.organizations.map((organization) => [organization.id, organization])
        )
        await replaceEntitySnapshot(database, "jurisdiction:us", {
          memberships: [],
          organizations: [...organizationsById.values()],
          people: [...peopleById.values()],
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

async function processDocuments(options: {
  all?: boolean
  billId?: string
  documentId?: string
  force?: boolean
  jurisdictionId?: string
  limit: string
  status?: string
}) {
  const config = loadConfig()
  if (options.all === true && options.status !== undefined) {
    throw new InvalidJobInput("--all cannot be combined with --status")
  }
  await withDatabase(async (database) => {
    const result = await runIngestionJob(
      database,
      { ...jobExecutionContext(), operation: "process-documents", scope: { ...options }, source: "documents" },
      async () => {
        const limit = parseInteger(options.limit, "limit")
        const counts = { ...createJobCounts(), processed: 0, unsupported: 0 }
        const failures: Array<Readonly<{ identifier?: string; message: string; retryable: boolean }>> = []
        const artifactStore = createArtifactStore(config, "documents")
        let status: "failed" | "pending" | "unsupported" | undefined
        if (options.all === true) {
          status = "pending"
        } else if (options.status !== undefined) {
          status = parseDocumentStatus(options.status)
        }
        let hasMoreDocuments = true
        do {
          const processed = await processPendingDocuments(database, {
            artifactStore,
            billId: options.billId,
            concurrency: config.ingestion.concurrency,
            documentId: options.documentId,
            force: options.force,
            jurisdictionId: options.jurisdictionId,
            limit,
            status,
            timeoutMs: config.ingestion.requestTimeoutMs
          })
          for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
            counts[key] += processed.counts[key]
          }
          failures.push(...processed.failures)
          hasMoreDocuments = options.all === true && processed.counts.discovered === limit
        } while (hasMoreDocuments)
        return { counts, failures }
      }
    )
    printJobResult(result)
  }, config)
}

async function runEmbeddings(options: { all?: boolean; billId?: string; documentId?: string; limit: string }) {
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
        { ...jobExecutionContext(), operation: "refresh-embeddings", scope: { limit }, source: "openrouter" },
        async () => {
          let embedded = 0
          let skipped = 0
          let hasMoreEmbeddings = true
          do {
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
            embedded += bills.embedded + sections.embedded
            skipped += bills.skipped + sections.skipped
            hasMoreEmbeddings = options.all === true && (bills.embedded > 0 || sections.embedded > 0)
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

function openStatesHttpClient(config: LegislationConfig) {
  return new RetryingHttpClient({
    maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
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
