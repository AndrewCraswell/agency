import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { migrateDatabase } from "./migrate"
import * as schema from "./schema/schema"

const databaseUrl = process.env.LEGISLATION_CORE_TEST_DATABASE_URL
if (databaseUrl) {
  const target = new URL(databaseUrl)
  if (target.pathname !== "/legislation_core_test" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)) {
    throw new Error("Migration integration requires a local disposable legislation_core_test database")
  }
}

describe.skipIf(!databaseUrl).sequential("canonical PostgreSQL baseline", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrateDatabase(database)
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("installs regulatory storage, preparation, provenance and capture triggers in one migration", async () => {
    const tables = [
      "legal_annual_source_observations",
      "legal_copy_revisions",
      "legal_discovery_checkpoints",
      "legal_discovery_dispatches",
      "legal_discovery_pages",
      "legal_discovery_units",
      "legal_fr_issue_preparations",
      "legal_fr_issue_renditions",
      "legal_passage_generations",
      "legal_passage_preparation_items",
      "legal_passage_preparations",
      "legal_passage_source_provenance",
      "legal_passages",
      "legal_preparation_dispatches",
      "legal_preparation_plans",
      "legal_provision_source_reviews",
      "regulatory_source_documents",
      "regulatory_source_inventories",
      "regulatory_source_renditions",
      "regulatory_source_reviews"
    ]
    const installed = await pool.query<{ name: string }>(
      "select tablename as name from pg_tables where schemaname='legislation' and tablename=any($1::text[]) order by tablename",
      [tables]
    )
    expect(installed.rows.map((row) => row.name)).toEqual([...tables].sort())
    const constraints = await pool.query<{ name: string; definition: string }>(
      `select conname as name, pg_get_constraintdef(oid) as definition from pg_constraint
       where conrelid='legislation.legal_import_generations'::regclass and conname='legal_import_generations_state_check'`
    )
    expect(constraints.rows[0]?.definition).toContain("'observed'::text")
    const columns = await pool.query<{ name: string }>(
      `select column_name as name from information_schema.columns where table_schema='legislation'
       and table_name='legal_passage_preparation_items' and column_name in ('failed_at','failure_code') order by column_name`
    )
    expect(columns.rows.map((row) => row.name)).toEqual(["failed_at", "failure_code"])
    const triggers = await pool.query<{ name: string }>(
      `select tgname as name from pg_trigger where not tgisinternal and tgrelid='legislation.legal_passages'::regclass order by tgname`
    )
    expect(triggers.rows.map((row) => row.name)).toEqual(["legal_copy_passage_revision", "legal_copy_passage_truncate"])
    const journal = await pool.query("select hash from legislation_migrations.migrations")
    expect(journal.rows).toHaveLength(2)
  })

  it("reconciles legacy event vocabulary before validating old constraints", async () => {
    await pool.query(
      `alter table legislation.legislative_events
       drop constraint legislative_events_classification_vocabulary_check,
       drop constraint legislative_events_status_vocabulary_check`
    )
    await pool.query(
      `insert into legislation.jurisdictions(id,name,classification,country_code)
       values ('migration-event-vocabulary','Migration event vocabulary','state','US')
       on conflict(id) do nothing`
    )
    const classifications = [
      ["markup", "meeting"],
      ["committee-meeting", "meeting"],
      ["open hearing", "hearing"],
      ["event", "other"],
      ["open business meeting", "meeting"],
      ["closed hearing", "hearing"],
      ["closed markup session", "session"],
      ["closed business meeting", "meeting"],
      ["joint open hearing", "hearing"],
      ["open markup session", "session"]
    ] as const
    const statuses = [
      ["rescheduled", "postponed"],
      ["confirmed", "scheduled"],
      ["tentative", "scheduled"]
    ] as const
    await pool.query(
      `insert into legislation.legislative_events
         (id,jurisdiction_id,source_id,name,classification,status,start_at)
       select 'migration-classification-' || ordinal,
              'migration-event-vocabulary',
              'migration-classification-' || ordinal,
              'Legacy classification ' || ordinal,
              classification,
              'scheduled',
              '2026-09-18T00:00:00Z'::timestamptz
       from unnest($1::text[]) with ordinality as legacy(classification,ordinal)`,
      [classifications.map(([source]) => source)]
    )
    await pool.query(
      `insert into legislation.legislative_events
         (id,jurisdiction_id,source_id,name,classification,status,start_at)
       select 'migration-status-' || ordinal,
              'migration-event-vocabulary',
              'migration-status-' || ordinal,
              'Legacy status ' || ordinal,
              'meeting',
              status,
              '2026-09-18T00:00:00Z'::timestamptz
       from unnest($1::text[]) with ordinality as legacy(status,ordinal)`,
      [statuses.map(([source]) => source)]
    )
    await pool.query(
      `insert into legislation.legislative_events
         (id,jurisdiction_id,source_id,name,classification,status,start_at)
       values ('migration-overlapping-vocabulary',
               'migration-event-vocabulary',
               'migration-overlapping-vocabulary',
               'Overlapping legacy vocabulary',
               'markup',
               'confirmed',
               '2026-09-18T00:00:00Z'::timestamptz)`
    )
    await pool.query(
      `alter table legislation.legislative_events
       add constraint legislative_events_classification_vocabulary_check
         check(classification is null or classification in ('meeting','hearing','session','other')) not valid,
       add constraint legislative_events_status_vocabulary_check
         check(status in ('scheduled','completed','cancelled','postponed','other')) not valid`
    )
    await pool.query("delete from legislation_migrations.migrations where created_at=$1", [1789761185934])

    await migrateDatabase(database)

    const actualClassifications = await pool.query<{ classification: string }>(
      `select classification from legislation.legislative_events
       where id like 'migration-classification-%'
       order by right(id,length(id)-length('migration-classification-'))::integer`
    )
    expect(actualClassifications.rows.map(({ classification }) => classification)).toEqual(
      classifications.map(([, expected]) => expected)
    )
    const actualStatuses = await pool.query<{ status: string }>(
      `select status from legislation.legislative_events
       where id like 'migration-status-%'
       order by right(id,length(id)-length('migration-status-'))::integer`
    )
    expect(actualStatuses.rows.map(({ status }) => status)).toEqual(statuses.map(([, expected]) => expected))
    expect(
      (
        await pool.query<{ classification: string; status: string }>(
          `select classification,status from legislation.legislative_events
           where id='migration-overlapping-vocabulary'`
        )
      ).rows
    ).toEqual([{ classification: "meeting", status: "scheduled" }])
    const constraints = await pool.query<{ conname: string; convalidated: boolean }>(
      `select conname,convalidated from pg_constraint
       where conrelid='legislation.legislative_events'::regclass
         and conname in ('legislative_events_classification_vocabulary_check','legislative_events_status_vocabulary_check')
       order by conname`
    )
    expect(constraints.rows).toEqual([
      { conname: "legislative_events_classification_vocabulary_check", convalidated: true },
      { conname: "legislative_events_status_vocabulary_check", convalidated: true }
    ])
  })

  it("preserves existing rows and the ledger on a repeated release", async () => {
    await pool.query(
      "insert into legislation.legal_sources(id,publisher,authority) values ('baseline-test','Test publisher','official')"
    )
    const before = await pool.query("select * from legislation_migrations.migrations")
    await migrateDatabase(database)
    expect((await pool.query("select * from legislation_migrations.migrations")).rows).toEqual(before.rows)
    expect((await pool.query("select publisher from legislation.legal_sources where id='baseline-test'")).rows).toEqual(
      [{ publisher: "Test publisher" }]
    )
  })

  it.each(["changed hash", "historical timestamp"])("rejects %s before changing the database", async (kind) => {
    const client = await pool.connect()
    try {
      await client.query("begin")
      if (kind === "changed hash") {
        await client.query("update legislation_migrations.migrations set hash='unreconciled'")
      } else {
        await client.query("update legislation_migrations.migrations set created_at=1")
      }
      const before = await client.query("select * from legislation_migrations.migrations")
      await expect(migrateDatabase(drizzle(client, { schema }))).rejects.toThrow("history does not match")
      expect((await client.query("select * from legislation_migrations.migrations")).rows).toEqual(before.rows)
      expect(
        (await client.query("select publisher from legislation.legal_sources where id='baseline-test'")).rows
      ).toEqual([{ publisher: "Test publisher" }])
    } finally {
      await client.query("rollback")
      client.release()
    }
  })
})
