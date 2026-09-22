import pg from "pg"
import { z } from "zod"
import { nodePostgresEndpoint } from "./config.js"
import { type ExternalHook } from "./external-hook.js"
import { privateTables, refreshPolicy } from "./policy.js"
import {
  type DeterministicFixtureSeed,
  type RefreshEndpoints,
  type RefreshSequenceState,
  type RefreshStore,
  type RefreshValidation
} from "./refresh.js"

const identifier = /^[a-z][a-z0-9_]*$/
const countSchema = z.object({ count: z.string().regex(/^\d+$/) })
const booleanSchema = z.object({ passed: z.boolean() })

function names(tables: readonly string[]) {
  if (tables.length === 0 || tables.some((table) => !identifier.test(table))) {
    throw new Error("Invalid refresh table list")
  }
  return tables.map((table) => `legislation."${table}"`).join(",")
}

async function connect(endpoint: string) {
  const client = new pg.Client({
    connectionString: nodePostgresEndpoint(endpoint),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000,
    application_name: "legislation-staging-refresh"
  })
  await client.connect()
  return client
}

async function queryFingerprint(client: pg.Client, table: string) {
  if (!identifier.test(table)) {
    throw new Error("Invalid refresh table")
  }
  const response = await client.query(
    `select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) fingerprint
     from legislation."${table}" t`
  )
  return z.object({ fingerprint: z.string() }).parse(response.rows[0]).fingerprint
}

async function compareRows(source: pg.Client, target: pg.Client, sql: string) {
  const [left, right] = await Promise.all([source.query(sql), target.query(sql)])
  return JSON.stringify(left.rows) === JSON.stringify(right.rows)
}

async function countsMatch(source: pg.Client, target: pg.Client) {
  for (const table of refreshPolicy.copy) {
    const sql = `select count(*)::text count from legislation."${table}"`
    const [sourceCount, targetCount] = await Promise.all([source.query(sql), target.query(sql)])
    if (countSchema.parse(sourceCount.rows[0]).count !== countSchema.parse(targetCount.rows[0]).count) {
      return false
    }
  }
  return true
}

async function foreignKeysPass(target: pg.Client) {
  const constraints = await target.query<{
    child_table: string
    parent_table: string
    child_columns: string[]
    parent_columns: string[]
    convalidated: boolean
  }>(`select child.relname child_table,parent.relname parent_table,
      array_agg(child_column.attname::text order by key.ordinality) child_columns,
      array_agg(parent_column.attname::text order by key.ordinality) parent_columns,
      constraint_record.convalidated
    from pg_constraint constraint_record
    join pg_class child on child.oid=constraint_record.conrelid
    join pg_namespace child_namespace on child_namespace.oid=child.relnamespace
    join pg_class parent on parent.oid=constraint_record.confrelid
    cross join lateral unnest(constraint_record.conkey,constraint_record.confkey)
      with ordinality key(child_number,parent_number,ordinality)
    join pg_attribute child_column on child_column.attrelid=child.oid and child_column.attnum=key.child_number
    join pg_attribute parent_column on parent_column.attrelid=parent.oid and parent_column.attnum=key.parent_number
    where constraint_record.contype='f' and child_namespace.nspname='legislation'
    group by constraint_record.oid,child.relname,parent.relname,constraint_record.convalidated`)
  for (const constraint of constraints.rows) {
    if (
      !constraint.convalidated ||
      !identifier.test(constraint.child_table) ||
      !identifier.test(constraint.parent_table) ||
      constraint.child_columns.some((column) => !identifier.test(column)) ||
      constraint.parent_columns.some((column) => !identifier.test(column))
    ) {
      return false
    }
    const join = constraint.child_columns
      .map((column, index) => `child."${column}"=parent."${constraint.parent_columns[index]}"`)
      .join(" and ")
    const populated = constraint.child_columns.map((column) => `child."${column}" is not null`).join(" and ")
    const orphan = await target.query(
      `select exists(select 1 from legislation."${constraint.child_table}" child
       where ${populated} and not exists(
         select 1 from legislation."${constraint.parent_table}" parent where ${join}
       )) as passed`
    )
    if (booleanSchema.parse(orphan.rows[0]).passed) {
      return false
    }
  }
  return true
}

export function createPostgresRefreshStore(input: {
  endpoint: string
  sourceEndpoint?: string
  passageSearchEndpoint?: string
  rebuildHook: ExternalHook
  fixtureHook: ExternalHook
  smokeHook: ExternalHook
}): RefreshStore & { close: () => Promise<void> } {
  let clientPromise: Promise<pg.Client> | undefined
  let snapshotClient: pg.Client | undefined
  const client = () => (clientPromise ??= connect(input.endpoint))
  return {
    async catalog() {
      const connection = await client()
      const largeObjects = await connection.query("select count(*)::text count from pg_largeobject_metadata")
      if (countSchema.parse(largeObjects.rows[0]).count !== "0") {
        throw new Error("Refresh policy does not permit PostgreSQL large objects")
      }
      const response = await connection.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema='legislation' and table_type='BASE TABLE' order by table_name"
      )
      return response.rows.map((row) => row.table_name)
    },
    async excludedFingerprints(tables) {
      const connection = await client()
      return new Map(
        await Promise.all(tables.map(async (table) => [table, await queryFingerprint(connection, table)] as const))
      )
    },
    async beginSourceSnapshot() {
      if (snapshotClient !== undefined) {
        throw new Error("Refresh source snapshot is already open")
      }
      // Reuse the catalog connection so the protected production role stays
      // within its two-connection ceiling while psql owns the copy connection.
      snapshotClient = await client()
      await snapshotClient.query("begin isolation level repeatable read read only")
      await snapshotClient.query("set local lock_timeout='2s'")
      const response = await snapshotClient.query("select pg_export_snapshot() snapshot")
      return z.object({ snapshot: z.string().regex(/^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+$/) }).parse(response.rows[0])
        .snapshot
    },
    async endSourceSnapshot() {
      if (snapshotClient !== undefined) {
        const connection = snapshotClient
        snapshotClient = undefined
        await connection.query("rollback")
      }
    },
    async readSequences() {
      const connection = snapshotClient ?? (await client())
      const listed = await connection.query<{ sequence_name: string }>(
        `select sequence.relname sequence_name
         from pg_class sequence
         join pg_namespace sequence_namespace on sequence_namespace.oid=sequence.relnamespace
         join pg_depend dependency on dependency.objid=sequence.oid and dependency.deptype in ('a','i')
         join pg_class owner_table on owner_table.oid=dependency.refobjid
         join pg_namespace owner_namespace on owner_namespace.oid=owner_table.relnamespace
         where sequence.relkind='S' and sequence_namespace.nspname='legislation'
           and owner_namespace.nspname='legislation' and owner_table.relname=any($1::text[])
         order by sequence.relname`,
        [refreshPolicy.copy]
      )
      const states: RefreshSequenceState[] = []
      for (const row of listed.rows) {
        if (!identifier.test(row.sequence_name)) {
          throw new Error("Invalid application sequence name")
        }
        const state = await connection.query<{ last_value: string; is_called: boolean }>(
          `select last_value::text,is_called from legislation."${row.sequence_name}"`
        )
        const parsed = z
          .object({ last_value: z.string().regex(/^-?\d+$/), is_called: z.boolean() })
          .parse(state.rows[0])
        states.push({
          name: `legislation.${row.sequence_name}`,
          value: parsed.last_value,
          called: parsed.is_called
        })
      }
      return states
    },
    async writeSequences(sequences) {
      const connection = await client()
      for (const sequence of sequences) {
        if (!/^legislation\.[a-z][a-z0-9_]*$/.test(sequence.name) || !/^-?\d+$/.test(sequence.value)) {
          throw new Error("Invalid application sequence state")
        }
        await connection.query("select setval($1::regclass,$2::bigint,$3)", [
          sequence.name,
          sequence.value,
          sequence.called
        ])
      }
    },
    async clear(tables) {
      await (await client()).query(`truncate table ${names(tables)} restart identity`)
    },
    async rebuild(tables, targetPassageSearch) {
      await input.rebuildHook(["rebuild", JSON.stringify(tables), targetPassageSearch])
    },
    async seedFixtures(seed: DeterministicFixtureSeed) {
      await input.fixtureHook(["seed", JSON.stringify(seed)])
    },
    async auditEmpty(tables) {
      const connection = await client()
      for (const table of tables) {
        const result = await connection.query(`select count(*)::text count from ${names([table])}`)
        if (countSchema.parse(result.rows[0]).count !== "0") {
          throw new Error(`Sanitization audit failed for legislation.${table}`)
        }
      }
    },
    async validate(endpoints: RefreshEndpoints): Promise<RefreshValidation> {
      if (input.sourceEndpoint === undefined || input.passageSearchEndpoint === undefined) {
        throw new Error("Target validation requires explicit source and passage-search endpoints")
      }
      const [source, search] = await Promise.all([connect(input.sourceEndpoint), connect(input.passageSearchEndpoint)])
      const target = await client()
      try {
        const extensions = await compareRows(
          source,
          target,
          "select extname,extversion from pg_extension where extname not in ('plpgsql') order by extname"
        )
        const migrations = await compareRows(
          source,
          target,
          "select hash,created_at::text from legislation_migrations.migrations order by created_at"
        )
        const counts = await countsMatch(source, target)
        const foreignKeys = await foreignKeysPass(target)
        let privateData = true
        for (const table of privateTables) {
          const result = await target.query(`select count(*)::text count from ${names([table])}`)
          if (countSchema.parse(result.rows[0]).count !== "0") {
            privateData = false
            break
          }
        }
        const [sourcePassages, targetPassages, index] = await Promise.all([
          source.query(`select count(*)::text count from legislation.document_sections section
            join legislation.bill_documents document on document.id=section.document_id
            where document.processing_status='processed'`),
          search.query("select count(*)::text count from legislation.document_sections"),
          search.query<{ passed: boolean }>(`select exists(
            select 1 from pg_indexes where schemaname='legislation' and tablename='document_sections'
            and indexdef ilike '%using paradedb%'
          ) passed`)
        ])
        const passageIndex =
          countSchema.parse(sourcePassages.rows[0]).count === countSchema.parse(targetPassages.rows[0]).count &&
          booleanSchema.parse(index.rows[0]).passed
        const sample = await search.query<{ text: string }>(
          "select text from legislation.document_sections where length(text)>3 order by id limit 1"
        )
        const term = sample.rows[0]?.text.match(/[\p{L}\p{N}]{4,}/u)?.[0]
        let searchPassed = false
        if (term !== undefined) {
          const ranked = await search.query<{ id: string }>(
            `select id from legislation.document_sections
             where id @@@ pdb.parse($1,lenient=>false,conjunction_mode=>true)
             order by pdb.score(id) desc,id collate "C" limit 1`,
            [`body:${term}`]
          )
          const rankedId = ranked.rows[0]?.id
          if (rankedId !== undefined) {
            const hydrated = await target.query<{ passed: boolean }>(
              "select exists(select 1 from legislation.document_sections where id=$1) passed",
              [rankedId]
            )
            searchPassed = booleanSchema.parse(hydrated.rows[0]).passed
          }
        }
        const smoke = await input.smokeHook(["validate", endpoints.targetWeb, endpoints.targetMcp])
        const [webReadiness, mcpSmoke] = smoke.split(",").map((value) => value.trim() === "true")
        return {
          migrations,
          extensions,
          counts,
          foreignKeys,
          privateData,
          passageIndex,
          search: searchPassed,
          webReadiness: webReadiness ?? false,
          mcpSmoke: mcpSmoke ?? false
        }
      } finally {
        await Promise.allSettled([source.end(), search.end()])
      }
    },
    async terminateStaleTargetConnections() {
      await (
        await client()
      ).query(`select pg_terminate_backend(pid) from pg_stat_activity
        where datname=current_database() and pid<>pg_backend_pid()
        and application_name not in ('legislation-staging-refresh','legislation-staging-refresh-lock')`)
    },
    async close() {
      await this.endSourceSnapshot()
      if (clientPromise !== undefined) {
        await (await clientPromise).end()
      }
    }
  }
}
