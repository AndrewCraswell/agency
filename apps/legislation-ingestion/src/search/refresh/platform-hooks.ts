import { spawn } from "node:child_process"
import { appendFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import pg from "pg"
import { ingestionErrorSummary } from "../../ingestion/errors.js"
import { replicatePassageDocuments } from "../passage-search-replication.js"
import { nodePostgresEndpoint } from "./config.js"
import { type ExternalHook } from "./external-hook.js"
import { type DeterministicFixtureSeed, type RefreshHooks } from "./refresh.js"

type RailwayMaintenanceConfig = {
  project: string
  environment: string
  services: readonly {
    id: string
    scale: readonly string[]
  }[]
}

export const stagingSchemaLeaseScriptPath = fileURLToPath(
  new URL("../../../../../scripts/legislation-staging-schema-lease.mjs", import.meta.url)
)

async function run(
  command: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...arguments_], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.once("error", reject)
    child.once("close", (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`${command} failed: ${ingestionErrorSummary(stderr || stdout)}`))
    })
  })
}

function parseScale(value: string) {
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (
    entries.length === 0 ||
    entries.some((entry) => !/^[a-z0-9-]+=[1-9][0-9]*$/.test(entry)) ||
    new Set(entries.map((entry) => entry.split("=")[0])).size !== entries.length
  ) {
    throw new Error("Railway scale must be a comma-separated region=replicas list with positive replica counts")
  }
  return entries
}

export function railwayServiceScale(value: string) {
  return parseScale(value)
}

export function railwayScaleArguments(
  project: string,
  environment: string,
  service: string,
  assignments: readonly string[]
) {
  return ["scale", "-p", project, "-e", environment, "-s", service, "--json", "--", ...assignments]
}

export function railwayMaintenanceEnvironment(environment: NodeJS.ProcessEnv) {
  const maintenanceEnvironment = { ...environment }
  delete maintenanceEnvironment.RAILWAY_TOKEN
  return maintenanceEnvironment
}

export function createRailwayMaintenanceController(config: RailwayMaintenanceConfig) {
  let unavailable = false
  const scale = async (available: boolean) => {
    for (const service of config.services) {
      const assignments = available
        ? service.scale
        : service.scale.map((entry) => `${entry.slice(0, entry.indexOf("="))}=0`)
      await run(
        "railway",
        railwayScaleArguments(config.project, config.environment, service.id, assignments),
        railwayMaintenanceEnvironment(process.env)
      )
    }
    unavailable = !available
  }
  return {
    async set(unavailable_: boolean) {
      if (unavailable_ !== unavailable) await scale(!unavailable_)
    },
    async prepareValidation() {
      if (!unavailable) throw new Error("Staging must be unavailable before service validation")
      await scale(true)
    }
  }
}

export function createPostgresLockHook(endpoint: string): RefreshHooks["acquireLock"] {
  return async () => {
    const client = new pg.Client({
      connectionString: nodePostgresEndpoint(endpoint),
      application_name: "legislation-staging-refresh-lock"
    })
    await client.connect()
    const result = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtextextended('legislation-staging-refresh',0)) acquired"
    )
    if (result.rows[0]?.acquired !== true) {
      await client.end()
      throw new Error("Another staging refresh owns the PostgreSQL advisory lock")
    }
    return async () => {
      try {
        await client.query("select pg_advisory_unlock(hashtextextended('legislation-staging-refresh',0))")
      } finally {
        await client.end()
      }
    }
  }
}

export async function assertSchemaLeaseAvailable() {
  const output = await run("node", [stagingSchemaLeaseScriptPath, "--command", "read"])
  const lease = JSON.parse(output) as { expiresAt?: unknown } | null
  if (lease !== null) {
    if (typeof lease.expiresAt !== "string" || !Number.isFinite(Date.parse(lease.expiresAt))) {
      throw new Error("Staging migration lease returned an invalid expiration")
    }
    if (Date.parse(lease.expiresAt) > Date.now()) {
      throw new Error("Staging migration lease is active")
    }
  }
}

async function withClient<Result>(endpoint: string, operation: (client: pg.Client) => Promise<Result>) {
  const client = new pg.Client({ connectionString: nodePostgresEndpoint(endpoint) })
  await client.connect()
  try {
    return await operation(client)
  } finally {
    await client.end()
  }
}

export function createDeterministicFixtureHook(endpoint: string): ExternalHook {
  return async (arguments_) => {
    const seed = JSON.parse(arguments_[1] ?? "{}") as Partial<DeterministicFixtureSeed>
    if (
      arguments_[0] !== "seed" ||
      seed.version !== 1 ||
      seed.namespace !== "staging-refresh" ||
      seed.generatedAt !== "2000-01-01T00:00:00.000Z"
    ) {
      throw new Error("Invalid deterministic staging fixture seed")
    }
    await withClient(endpoint, async (client) => {
      await client.query("begin")
      try {
        await client.query(
          `insert into legislation.webhooks
            (id,owner_user_id,name,url,event_types,secret_last_four)
           values
            ('webhook:staging-refresh-fixture','staging-refresh','Staging refresh fixture',
             'https://staging.invalid/refresh-fixture',array['bill.updated'],'0000')
           on conflict(id) do update set name=excluded.name,url=excluded.url,event_types=excluded.event_types;
           insert into legislation.webhook_signing_keys
            (id,webhook_id,secret_ciphertext)
           values
            ('webhook-key:staging-refresh-fixture','webhook:staging-refresh-fixture',
             'synthetic-staging-refresh-fixture')
           on conflict(id) do update set secret_ciphertext=excluded.secret_ciphertext`
        )
        await client.query("commit")
      } catch (error) {
        await client.query("rollback")
        throw error
      }
    })
    return "seeded"
  }
}

export function createPassageRebuildHook(primaryEndpoint: string, passageSearchEndpoint: string): ExternalHook {
  return async (arguments_) => {
    if (arguments_[0] !== "rebuild" || arguments_[2] !== passageSearchEndpoint) {
      throw new Error("Invalid passage rebuild request")
    }
    const primary = new pg.Client({ connectionString: nodePostgresEndpoint(primaryEndpoint) })
    const search = new pg.Client({ connectionString: nodePostgresEndpoint(passageSearchEndpoint) })
    await Promise.all([primary.connect(), search.connect()])
    try {
      const documents = await primary.query<{ id: string }>(
        "select id from legislation.bill_documents where processing_status='processed' order by id"
      )
      await search.query("truncate table legislation.document_sections cascade")
      for (let offset = 0; offset < documents.rows.length; offset += 100) {
        await replicatePassageDocuments(
          primary,
          search,
          documents.rows.slice(offset, offset + 100).map((row) => row.id)
        )
      }
    } finally {
      await Promise.allSettled([primary.end(), search.end()])
    }
    return "rebuilt"
  }
}

export function createServiceSmokeHook(input: {
  webEndpoint: string
  mcpEndpoint: string
  prepareValidation: () => Promise<void>
}): ExternalHook {
  return async (arguments_) => {
    if (arguments_[0] !== "validate" || arguments_[1] !== input.webEndpoint || arguments_[2] !== input.mcpEndpoint) {
      throw new Error("Invalid staging service validation request")
    }
    await input.prepareValidation()
    await run("node", ["apps/legislation-web/scripts/wait-readiness.mjs"], {
      ...process.env,
      LEGISLATION_READINESS_BASE_URL: input.webEndpoint
    })
    await run("node", ["apps/legislation-mcp/scripts/smoke-deployment.mjs"], {
      ...process.env,
      LEGISLATION_MCP_SMOKE_BASE_URL: input.mcpEndpoint
    })
    return "true,true"
  }
}

export async function emitRefreshAlert(message: string) {
  const safe = ingestionErrorSummary(message).replaceAll("\r", " ").replaceAll("\n", " ")
  process.stderr.write(`::error title=Legislation staging refresh failed::${safe}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n## Staging refresh failed\n\n${safe}\n`)
  }
}
