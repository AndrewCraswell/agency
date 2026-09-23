import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { ingestionErrorSummary } from "../../ingestion/errors.js"

export type CopyRequest = {
  sourceEndpoint: string
  targetEndpoint: string
  snapshot: string
  tables: readonly string[]
}

export type CopyReceipt = {
  engine: "bulk"
  tables: readonly string[]
  counts: Readonly<Record<string, string>>
}

export type CopyEngine = {
  copy: (request: CopyRequest) => Promise<CopyReceipt>
}

type SpawnProcess = (
  command: string,
  arguments_: readonly string[],
  environment: NodeJS.ProcessEnv
) => ChildProcessWithoutNullStreams

type CopyLogger = (event: string, details: Readonly<Record<string, unknown>>) => void

const identifier = /^[a-z][a-z0-9_]*$/

function assertRequest(request: CopyRequest) {
  if (
    request.tables.length === 0 ||
    request.tables.some((table) => !identifier.test(table)) ||
    new Set(request.tables).size !== request.tables.length ||
    !/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/.test(request.snapshot)
  ) {
    throw new Error("Invalid refresh copy request")
  }
  const source = new URL(request.sourceEndpoint)
  const target = new URL(request.targetEndpoint)
  if (
    !["postgres:", "postgresql:"].includes(source.protocol) ||
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    (source.hostname.toLowerCase() === target.hostname.toLowerCase() &&
      (source.port || "5432") === (target.port || "5432") &&
      decodeURIComponent(source.pathname) === decodeURIComponent(target.pathname))
  ) {
    throw new Error("Refresh copy requires distinct PostgreSQL endpoints")
  }
}

function bulkLoadStatements(table: string) {
  const qualified = `legislation."${table}"`
  return [
    "begin",
    `lock table ${qualified} in access exclusive mode`,
    `create temporary table refresh_indexes on commit drop as
      select index_relation.relname name,pg_get_indexdef(index_record.indexrelid) definition,
        obj_description(index_record.indexrelid,'pg_class') description,index_record.indisclustered clustered
      from pg_index index_record
      join pg_class index_relation on index_relation.oid=index_record.indexrelid
      where index_record.indrelid='${qualified}'::regclass and not index_record.indisunique
        and not exists(select 1 from pg_constraint where conindid=index_record.indexrelid)`,
    `create temporary table refresh_index_statistics on commit drop as
      select index_relation.relname name,attribute.attnum number,attribute.attstattarget target
      from pg_attribute attribute
      join pg_class index_relation on index_relation.oid=attribute.attrelid
      join pg_namespace namespace on namespace.oid=index_relation.relnamespace
      join refresh_indexes saved on saved.name=index_relation.relname
      where namespace.nspname='legislation' and attribute.attstattarget>=0`,
    `create temporary table refresh_triggers on commit drop as
      select tgname name,tgenabled enabled from pg_trigger where tgrelid='${qualified}'::regclass`,
    `do $$ declare item record; begin
      for item in select name from refresh_indexes order by name loop
        execute format('drop index legislation.%I',item.name);
      end loop;
    end $$`,
    `alter table ${qualified} disable trigger all`,
    `copy ${qualified} from stdin with (format binary)`,
    `do $$ declare item record; begin
      for item in select * from refresh_indexes order by name loop
        execute item.definition;
        if item.description is not null then
          execute format('comment on index legislation.%I is %L',item.name,item.description);
        end if;
        if item.clustered then
          execute format('alter table ${qualified} cluster on %I',item.name);
        end if;
      end loop;
      for item in select * from refresh_index_statistics order by name,number loop
        execute format('alter index legislation.%I alter column %s set statistics %s',item.name,item.number,item.target);
      end loop;
      for item in select name,enabled from refresh_triggers order by name loop
        execute format('alter table ${qualified} %s trigger %I',
          case item.enabled when 'D' then 'disable' when 'R' then 'enable replica'
            when 'A' then 'enable always' else 'enable' end,item.name);
      end loop;
    end $$`,
    `analyze ${qualified}`,
    "commit"
  ]
}

async function copyTable(
  left: ChildProcessWithoutNullStreams,
  right: ChildProcessWithoutNullStreams,
  table: string,
  log: CopyLogger
) {
  const started = Date.now()
  let bytes = 0
  let errors = ""
  let output = ""
  let count: string | undefined
  let failed = false
  const fail = (message: string) => {
    failed = true
    errors = `${errors}\n${message}`.slice(-16_384)
    left.kill()
    right.kill()
  }
  const wait = (child: ChildProcessWithoutNullStreams) =>
    new Promise<number>((resolve) => {
      child.once("error", (error) => {
        fail(error.message)
        resolve(1)
      })
      child.once("close", (code) => {
        if (code !== 0) fail(`Copy subprocess exited with ${code}`)
        resolve(code ?? 1)
      })
      child.stderr.on("data", (chunk: Buffer) => {
        errors = (errors + chunk.toString()).slice(-16_384)
      })
    })
  const completion = Promise.all([wait(left), wait(right)])
  left.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length
  })
  left.stdout.on("error", (error) => fail(error.message))
  right.stdin.on("error", (error) => fail(error.message))
  right.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString()
    const lines = output.split(/\r?\n/u)
    output = lines.pop() ?? ""
    for (const line of lines) {
      const match = /^COPY (\d+)$/u.exec(line)
      if (match?.[1] !== undefined) {
        count = match[1]
        log("refresh.copy.indexes", { table, rows: count, elapsedMs: Date.now() - started })
      }
    }
  })
  const timer = setInterval(() => {
    log("refresh.copy.progress", {
      table,
      bytes,
      phase: count === undefined ? "copy" : "indexes",
      elapsedMs: Date.now() - started
    })
  }, 30_000)
  const cancel = () => fail("Bulk copy interrupted")
  process.once("SIGTERM", cancel)
  process.once("SIGINT", cancel)
  left.stdout.pipe(right.stdin)
  try {
    const codes = await completion
    if (failed || codes.some((code) => code !== 0) || count === undefined) {
      throw new Error(
        `Bulk copy of legislation.${table} failed: ${ingestionErrorSummary(errors || "Missing COPY row count")}`
      )
    }
    log("refresh.copy.complete", { table, rows: count, bytes, elapsedMs: Date.now() - started })
    return count
  } finally {
    clearInterval(timer)
    process.off("SIGTERM", cancel)
    process.off("SIGINT", cancel)
    left.stdout.unpipe(right.stdin)
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
    PGOPTIONS: "-c statement_timeout=3600000 -c lock_timeout=2000",
    PGSSLMODE: url.searchParams.get("sslmode") ?? undefined
  }
}

export function createBulkCopyEngine(
  spawnProcess: SpawnProcess = defaultSpawn,
  log: CopyLogger = (event, details) => {
    process.stdout.write(`${JSON.stringify({ event, ...details })}\n`)
  }
): CopyEngine {
  return {
    async copy(request) {
      assertRequest(request)
      const counts: Record<string, string> = {}
      for (const [index, table] of request.tables.entries()) {
        log("refresh.copy.start", { table, ordinal: index + 1, total: request.tables.length })
        const sourceSql = `begin isolation level repeatable read read only; set transaction snapshot '${request.snapshot}'; copy legislation."${table}" to stdout with (format binary)`
        counts[table] = await copyTable(
          spawnProcess(
            "psql",
            ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "-c", sourceSql],
            postgresEnvironment(request.sourceEndpoint, "legislation-staging-refresh-source")
          ),
          spawnProcess(
            "psql",
            ["--no-psqlrc", "--set", "ON_ERROR_STOP=1", ...bulkLoadStatements(table).flatMap((sql) => ["-c", sql])],
            postgresEnvironment(request.targetEndpoint, "legislation-staging-refresh-target")
          ),
          table,
          log
        )
      }
      return { engine: "bulk", tables: request.tables, counts }
    }
  }
}
