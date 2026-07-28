import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { parseDatabaseUrl } from "../session-storage.server"
import * as schema from "./schema.server"

export const databasePool = new pg.Pool({
  connectionString: parseDatabaseUrl(process.env.DATABASE_URL),
  max: 10,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000
})

export const database = drizzle(databasePool, { schema })
export type BlogWriterDatabase = typeof database
