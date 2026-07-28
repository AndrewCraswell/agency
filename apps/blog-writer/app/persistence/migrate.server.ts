import { fileURLToPath } from "node:url"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { database, databasePool } from "./database.server"

try {
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/migrations/", import.meta.url))
  await migrate(database, { migrationsFolder, migrationsSchema: "blog_writer", migrationsTable: "migrations" })
  process.stdout.write("Applied Blog Writer migrations.\n")
} finally {
  await databasePool.end()
}
