import { ingestionErrorSummary } from "../../ingestion/errors.js"
import { type CopyEngine } from "./copy-engine.js"
import { classifyRefreshTables, copyTriggeredOperationalTables, privateTables, refreshPolicy } from "./policy.js"

export type RefreshEndpoints = {
  sourcePrimary: string
  targetPrimary: string
  targetPassageSearch: string
  targetWeb: string
  targetMcp: string
}

export type RefreshValidation = {
  migrations: boolean
  extensions: boolean
  counts: boolean
  foreignKeys: boolean
  privateData: boolean
  passageIndex: boolean
  search: boolean
  webReadiness: boolean
  mcpSmoke: boolean
}

export type RefreshSequenceState = {
  name: string
  value: string
  called: boolean
}

export type RefreshStore = {
  catalog: () => Promise<readonly string[]>
  excludedFingerprints: (tables: readonly string[]) => Promise<ReadonlyMap<string, string>>
  beginSourceSnapshot: () => Promise<string>
  endSourceSnapshot: () => Promise<void>
  readSequences: () => Promise<readonly RefreshSequenceState[]>
  writeSequences: (sequences: readonly RefreshSequenceState[]) => Promise<void>
  clear: (tables: readonly string[]) => Promise<void>
  rebuild: (tables: readonly string[], targetPassageSearch: string) => Promise<void>
  seedFixtures: (seed: DeterministicFixtureSeed) => Promise<void>
  auditEmpty: (tables: readonly string[]) => Promise<void>
  validate: (endpoints: RefreshEndpoints) => Promise<RefreshValidation>
  terminateStaleTargetConnections: () => Promise<void>
}

export type RefreshHooks = {
  acquireLock: () => Promise<() => Promise<void>>
  assertMigrationLeaseAvailable: () => Promise<void>
  setMaintenance: (unavailable: boolean, reason: string) => Promise<void>
  alert: (message: string) => Promise<void>
}

export type RefreshLogger = (event: string, details: Readonly<Record<string, unknown>>) => void

export type DeterministicFixtureSeed = {
  version: 1
  namespace: "staging-refresh"
  generatedAt: "2000-01-01T00:00:00.000Z"
}

export const deterministicFixtureSeed: DeterministicFixtureSeed = {
  version: 1,
  namespace: "staging-refresh",
  generatedAt: "2000-01-01T00:00:00.000Z"
}

function validateEndpoints(endpoints: RefreshEndpoints) {
  const databaseUrls = [endpoints.sourcePrimary, endpoints.targetPrimary, endpoints.targetPassageSearch].map(
    (endpoint) => new URL(endpoint)
  )
  const serviceUrls = [endpoints.targetWeb, endpoints.targetMcp].map((endpoint) => new URL(endpoint))
  if (
    databaseUrls.some((endpoint) => !endpoint.protocol.startsWith("postgres")) ||
    serviceUrls.some((endpoint) => !["http:", "https:"].includes(endpoint.protocol)) ||
    new Set(databaseUrls.map((endpoint) => endpoint.href)).size !== databaseUrls.length
  ) {
    throw new Error("Refresh requires distinct explicit PostgreSQL endpoints and explicit staging service endpoints")
  }
}

function assertValidation(validation: RefreshValidation) {
  const failures = Object.entries(validation)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  if (failures.length > 0) {
    throw new Error(`Staging refresh validation failed: ${failures.join(", ")}`)
  }
}

export async function refreshStaging(input: {
  endpoints: RefreshEndpoints
  source: RefreshStore
  target: RefreshStore
  copyEngine: CopyEngine
  hooks: RefreshHooks
  logger?: RefreshLogger
}) {
  validateEndpoints(input.endpoints)
  const log = input.logger ?? (() => undefined)
  const release = await input.hooks.acquireLock()
  let snapshotOpen = false
  let maintenanceEntered = false
  try {
    await input.hooks.assertMigrationLeaseAvailable()
    await input.hooks.setMaintenance(true, "staging database refresh")
    maintenanceEntered = true
    await input.target.terminateStaleTargetConnections()
    const [sourceCatalog, targetCatalog] = await Promise.all([input.source.catalog(), input.target.catalog()])
    classifyRefreshTables(sourceCatalog)
    classifyRefreshTables(targetCatalog)
    const before = await input.target.excludedFingerprints(refreshPolicy.exclude)
    const snapshot = await input.source.beginSourceSnapshot()
    snapshotOpen = true
    await input.target.clear([...refreshPolicy.copy, ...refreshPolicy.clear, ...refreshPolicy.rebuild])
    const receipt = await input.copyEngine.copy({
      sourceEndpoint: input.endpoints.sourcePrimary,
      targetEndpoint: input.endpoints.targetPrimary,
      snapshot,
      tables: refreshPolicy.copy
    })
    await input.target.writeSequences(await input.source.readSequences())
    await input.source.endSourceSnapshot()
    snapshotOpen = false
    // Copying canonical rows can fire target-side operational outbox triggers.
    // Re-clear those independent queues before the sanitization audit.
    await input.target.clear(copyTriggeredOperationalTables)
    await input.target.auditEmpty([...privateTables, ...refreshPolicy.clear.slice(privateTables.length)])
    const after = await input.target.excludedFingerprints(refreshPolicy.exclude)
    if ([...before].some(([table, fingerprint]) => after.get(table) !== fingerprint)) {
      throw new Error("Staging-owned excluded data changed during refresh")
    }
    await input.target.seedFixtures(deterministicFixtureSeed)
    await input.target.rebuild(refreshPolicy.rebuild, input.endpoints.targetPassageSearch)
    const validation = await input.target.validate(input.endpoints)
    assertValidation(validation)
    log("refresh.complete", { engine: receipt.engine, tables: receipt.tables.length, validation })
    await input.hooks.setMaintenance(false, "staging database refresh validated")
    maintenanceEntered = false
    return { receipt, validation }
  } catch (error) {
    const summary = ingestionErrorSummary(error)
    log("refresh.failed", { error: summary, stagingUnavailable: maintenanceEntered })
    if (maintenanceEntered) {
      await input.hooks.setMaintenance(true, "staging refresh failed validation").catch((maintenanceError: unknown) => {
        log("refresh.maintenance-failed", { error: ingestionErrorSummary(maintenanceError) })
      })
    }
    await input.hooks.alert(summary).catch((alertError: unknown) => {
      log("refresh.alert-failed", { error: ingestionErrorSummary(alertError) })
    })
    throw new Error(`Staging refresh failed: ${summary}`, { cause: error })
  } finally {
    if (snapshotOpen) {
      await input.source.endSourceSnapshot().catch(() => undefined)
    }
    await release().catch(() => undefined)
  }
}
