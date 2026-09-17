import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const databaseUrl = process.env.LEGISLATION_CORE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/legislation_core_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("LEGISLATION_CORE_TEST_DATABASE_URL must target a local disposable legislation_core_test database")
  }
}

const migrationsFolder = fileURLToPath(new URL("./migrations/", import.meta.url))
const convergedTables = [
  "legal_annual_source_observations",
  "legal_copy_revisions",
  "legal_discovery_checkpoints",
  "legal_discovery_dispatches",
  "legal_discovery_pages",
  "legal_discovery_units",
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
] as const

describe.skipIf(databaseUrl === undefined).sequential("regulatory schema convergence migration", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
  let originalMigrationsFolder = ""

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")

    originalMigrationsFolder = await mkdtemp(join(tmpdir(), "legislation-migrations-before-convergence-"))
    await cp(migrationsFolder, originalMigrationsFolder, { recursive: true })
    const journalPath = join(originalMigrationsFolder, "meta", "_journal.json")
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      entries: { tag: string }[]
    }
    journal.entries = journal.entries.filter((entry) => entry.tag !== "0049_regulatory-schema-convergence")
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`)
    await rm(join(originalMigrationsFolder, "0049_regulatory-schema-convergence.sql"))
    await rm(join(originalMigrationsFolder, "meta", "0049_snapshot.json"))

    await migrate(drizzle(pool), {
      migrationsFolder: originalMigrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })

    await pool.query(`drop table ${convergedTables.map((table) => `legislation.${table}`).join(", ")} cascade`)
    await pool.query(
      "alter table legislation.legal_edition_provisions drop constraint legal_edition_provisions_edition_id_version_id_key"
    )
    await pool.query(
      "alter table legislation.legal_import_generations drop constraint legal_import_generations_state_check"
    )
    await pool.query(
      `alter table legislation.legal_import_generations add constraint legal_import_generations_state_check
       check(state in ('staging','validated','materialized','published','blocked'))`
    )

    await migrate(drizzle(pool), {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  }, 120_000)

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
    if (originalMigrationsFolder !== "") await rm(originalMigrationsFolder, { force: true, recursive: true })
  })

  it("repairs databases that recorded the original regulatory storage migration", async () => {
    const tables = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='legislation' and table_name=any($1::text[])
       order by table_name`,
      [[...convergedTables]]
    )
    expect(tables.rows.map((row) => row.table_name)).toEqual([...convergedTables].sort())

    const constraints = await pool.query<{ definition: string; name: string }>(
      `select conname as name, pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conrelid in (
         'legislation.legal_edition_provisions'::regclass,
         'legislation.legal_import_generations'::regclass
       ) and conname=any($1::text[])
       order by conname`,
      [["legal_edition_provisions_edition_id_version_id_key", "legal_import_generations_state_check"]]
    )
    expect(constraints.rows).toEqual([
      {
        definition: "UNIQUE (edition_id, version_id)",
        name: "legal_edition_provisions_edition_id_version_id_key"
      },
      {
        definition:
          "CHECK ((state = ANY (ARRAY['staging'::text, 'validated'::text, 'materialized'::text, 'published'::text, 'blocked'::text, 'observed'::text])))",
        name: "legal_import_generations_state_check"
      }
    ])
  })
})
