import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import type { LegislationDatabase } from "./database.js"

const migrationsFolder = fileURLToPath(new URL("./migrations/", import.meta.url))

export async function migrateDatabase(database: LegislationDatabase): Promise<void> {
  await migrate(database, {
    migrationsFolder,
    migrationsSchema: "legislation_migrations",
    migrationsTable: "migrations"
  })
}
