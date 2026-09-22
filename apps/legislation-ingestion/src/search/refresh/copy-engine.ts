import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { ingestionErrorSummary } from "../../ingestion/errors.js"

export type CopyRequest = {
  sourceEndpoint: string
  targetEndpoint: string
  snapshot: string
  tables: readonly string[]
}

export type CopyReceipt = {
  engine: "direct" | "pg-dump"
  tables: readonly string[]
}

export type CopyEngine = {
  copy: (request: CopyRequest) => Promise<CopyReceipt>
}

type SpawnProcess = (
  command: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv
) => ChildProcessWithoutNullStreams

const identifier = /^[a-z][a-z0-9_]*$/
const snapshot = /^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/

function assertRequest(request: CopyRequest) {
  if (
    request.tables.length === 0 ||
    request.tables.some((table) => !identifier.test(table)) ||
    !snapshot.test(request.snapshot)
  ) {
    throw new Error("Invalid refresh copy request")
  }
  const source = new URL(request.sourceEndpoint)
  const target = new URL(request.targetEndpoint)
  if (
    !source.protocol.startsWith("postgres") ||
    !target.protocol.startsWith("postgres") ||
    source.href === target.href
  ) {
    throw new Error("Refresh copy requires distinct PostgreSQL endpoints")
  }
}

async function pipeline(
  left: ChildProcessWithoutNullStreams,
  right: ChildProcessWithoutNullStreams,
  description: string
) {
  left.stdout.pipe(right.stdin)
  let errors = ""
  left.stderr.on("data", (chunk: Buffer) => {
    errors += chunk.toString()
  })
  right.stderr.on("data", (chunk: Buffer) => {
    errors += chunk.toString()
  })
  const wait = (child: ChildProcessWithoutNullStreams) =>
    new Promise<number>((resolve, reject) => {
      child.once("error", reject)
      child.once("close", (code) => resolve(code ?? 1))
    })
  const [leftCode, rightCode] = await Promise.all([wait(left), wait(right)])
  if (leftCode !== 0 || rightCode !== 0) {
    throw new Error(`${description} failed: ${ingestionErrorSummary(errors)}`)
  }
}

function defaultSpawn(command: string, arguments_: readonly string[], environment: NodeJS.ProcessEnv) {
  return spawn(command, arguments_, {
    env: environment,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  })
}

function postgresEnvironment(endpoint: string, applicationName: string): NodeJS.ProcessEnv {
  const url = new URL(endpoint)
  return {
    ...process.env,
    PGAPPNAME: applicationName,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGOPTIONS: "-c statement_timeout=900000 -c lock_timeout=2000",
    PGSSLMODE: url.searchParams.get("sslmode") ?? undefined
  }
}

export function createDirectCopyEngine(spawnProcess: SpawnProcess = defaultSpawn): CopyEngine {
  return {
    async copy(request) {
      assertRequest(request)
      for (const table of request.tables) {
        const qualified = `legislation.${table}`
        const sourceSql = `begin isolation level repeatable read read only; set transaction snapshot '${request.snapshot}'; copy ${qualified} to stdout with (format binary)`
        const targetSql = `copy ${qualified} from stdin with (format binary)`
        const sourceEnvironment = postgresEnvironment(request.sourceEndpoint, "legislation-staging-refresh-source")
        const targetEnvironment = postgresEnvironment(request.targetEndpoint, "legislation-staging-refresh-target")
        await pipeline(
          spawnProcess(
            "psql",
            ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "-c", sourceSql],
            sourceEnvironment
          ),
          spawnProcess(
            "psql",
            ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "-c", targetSql],
            targetEnvironment
          ),
          `Direct copy of legislation.${table}`
        )
      }
      return { engine: "direct", tables: request.tables }
    }
  }
}

export function createPgDumpCopyEngine(spawnProcess: SpawnProcess = defaultSpawn): CopyEngine {
  return {
    async copy(request) {
      assertRequest(request)
      const tableArguments = request.tables.flatMap((table) => ["--table", `legislation.${table}`])
      const targetEnvironment = postgresEnvironment(
        request.targetEndpoint,
        "legislation-staging-refresh-fallback-target"
      )
      await pipeline(
        spawnProcess(
          "pg_dump",
          [
            "--format=custom",
            "--data-only",
            "--no-owner",
            "--no-privileges",
            `--snapshot=${request.snapshot}`,
            ...tableArguments
          ],
          postgresEnvironment(request.sourceEndpoint, "legislation-staging-refresh-fallback-source")
        ),
        spawnProcess(
          "pg_restore",
          [
            "--dbname",
            targetEnvironment.PGDATABASE!,
            "--data-only",
            "--disable-triggers",
            "--no-owner",
            "--no-privileges",
            "--exit-on-error"
          ],
          targetEnvironment
        ),
        "pg_dump/pg_restore fallback"
      )
      return { engine: "pg-dump", tables: request.tables }
    }
  }
}

export function createFallbackCopyEngine(
  primary: CopyEngine,
  fallback: CopyEngine,
  resetTarget: () => Promise<void>
): CopyEngine {
  return {
    async copy(request) {
      try {
        return await primary.copy(request)
      } catch (primaryError) {
        await resetTarget()
        try {
          return await fallback.copy(request)
        } catch (fallbackError) {
          throw new Error(
            `Direct copy failed: ${ingestionErrorSummary(primaryError)}; fallback failed: ${ingestionErrorSummary(fallbackError)}`
          )
        }
      }
    }
  }
}
