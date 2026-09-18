import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { LegislationDatabase } from "./database"

const migrationsFolder = fileURLToPath(new URL("./migrations/", import.meta.url))

export async function migrateDatabase(database: LegislationDatabase): Promise<void> {
  const available = readMigrationFiles({ migrationsFolder })
  const ledger = await database.execute<{ exists: boolean }>(
    sql`select to_regclass('legislation_migrations.migrations') is not null as exists`
  )
  if (ledger.rows[0]?.exists) {
    const applied = await database.execute<{ hash: string; created_at: string }>(
      sql`select hash, created_at from legislation_migrations.migrations order by created_at`
    )
    const hasUnknownHistory = applied.rows.some(
      (entry, index) =>
        entry.hash !== available[index]?.hash || Number(entry.created_at) !== available[index]?.folderMillis
    )
    if (hasUnknownHistory) {
      throw new Error(
        "Database migration history does not match the canonical files. Verify and reconcile the deployed schema and ledger before releasing migrations; do not reset a populated database."
      )
    }
  }
  await migrate(database, {
    migrationsFolder,
    migrationsSchema: "legislation_migrations",
    migrationsTable: "migrations"
  })
}
