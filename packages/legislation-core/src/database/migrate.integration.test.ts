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
    expect(journal.rows).toHaveLength(1)
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
