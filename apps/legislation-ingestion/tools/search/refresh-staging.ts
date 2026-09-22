import { Command } from "commander"
import { productionRefreshEndpoint } from "../../src/search/refresh/config.js"
import { createBulkCopyEngine } from "../../src/search/refresh/copy-engine.js"
import {
  assertSchemaLeaseAvailable,
  createDeterministicFixtureHook,
  createPassageRebuildHook,
  createPostgresLockHook,
  createRailwayMaintenanceController,
  createServiceSmokeHook,
  emitRefreshAlert,
  railwayServiceScale
} from "../../src/search/refresh/platform-hooks.js"
import { createPostgresRefreshStore } from "../../src/search/refresh/postgres-store.js"
import { refreshStaging, type RefreshEndpoints, type RefreshHooks } from "../../src/search/refresh/refresh.js"

const program = new Command()
  .requiredOption("--target-primary <url>")
  .requiredOption("--target-passage-search <url>")
  .requiredOption("--target-web <url>")
  .requiredOption("--target-mcp <url>")
  .requiredOption("--railway-project <id>")
  .requiredOption("--railway-environment <id>")
  .requiredOption("--web-service <id>")
  .requiredOption("--web-scale <region=replicas,...>")
  .requiredOption("--mcp-service <id>")
  .requiredOption("--mcp-scale <region=replicas,...>")
  .option("--apply", "perform the destructive refresh", false)
  .parse()

const options = program.opts<{
  targetPrimary: string
  targetPassageSearch: string
  targetWeb: string
  targetMcp: string
  railwayProject: string
  railwayEnvironment: string
  webService: string
  webScale: string
  mcpService: string
  mcpScale: string
  apply: boolean
}>()

if (!options.apply) {
  throw new Error("Refusing destructive staging refresh without --apply")
}

const endpoints: RefreshEndpoints = {
  sourcePrimary: productionRefreshEndpoint(process.env),
  targetPrimary: options.targetPrimary,
  targetPassageSearch: options.targetPassageSearch,
  targetWeb: options.targetWeb,
  targetMcp: options.targetMcp
}
const maintenance = createRailwayMaintenanceController({
  project: options.railwayProject,
  environment: options.railwayEnvironment,
  services: [
    { id: options.webService, scale: railwayServiceScale(options.webScale), endpoint: endpoints.targetWeb },
    { id: options.mcpService, scale: railwayServiceScale(options.mcpScale), endpoint: endpoints.targetMcp }
  ]
})
const rebuildHook = createPassageRebuildHook(endpoints.targetPrimary, endpoints.targetPassageSearch)
const fixtureHook = createDeterministicFixtureHook(endpoints.targetPrimary)
const smokeHook = createServiceSmokeHook({
  webEndpoint: endpoints.targetWeb,
  mcpEndpoint: endpoints.targetMcp,
  prepareValidation: () => maintenance.prepareValidation()
})
const source = createPostgresRefreshStore({
  endpoint: endpoints.sourcePrimary,
  rebuildHook,
  fixtureHook,
  smokeHook
})
const target = createPostgresRefreshStore({
  endpoint: endpoints.targetPrimary,
  sourceEndpoint: endpoints.sourcePrimary,
  passageSearchEndpoint: endpoints.targetPassageSearch,
  rebuildHook,
  fixtureHook,
  smokeHook
})
const copyEngine = createBulkCopyEngine()
const hooks: RefreshHooks = {
  acquireLock: createPostgresLockHook(endpoints.targetPrimary),
  assertMigrationLeaseAvailable: assertSchemaLeaseAvailable,
  async setMaintenance(unavailable) {
    await maintenance.set(unavailable)
  },
  async alert(message) {
    await emitRefreshAlert(message)
  }
}

try {
  await refreshStaging({
    endpoints,
    source,
    target,
    copyEngine,
    hooks,
    logger: (event, details) => {
      process.stdout.write(`${JSON.stringify({ event, ...details })}\n`)
    }
  })
} finally {
  await Promise.allSettled([source.close(), target.close()])
}
