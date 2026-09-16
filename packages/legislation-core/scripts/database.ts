import { z } from "zod"
import { createDatabase } from "../src/database/database.js"
import { migrateDatabase } from "../src/database/migrate.js"
import { waitForDatabase } from "../src/database/readiness.js"

const operation = z.enum(["migrate", "wait"]).parse(process.argv[2])
const config = z
  .object({
    url: z.url({ protocol: /^postgres(?:ql)?$/ }),
    connectionTimeoutMs: z.coerce.number().int().positive(),
    idleTimeoutMs: z.coerce.number().int().positive(),
    maxConnections: z.literal(1)
  })
  .parse({
    url: process.env.DATABASE_URL ?? "postgresql://legislation:legislation@127.0.0.1:55432/legislation",
    connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
    idleTimeoutMs: process.env.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
    maxConnections: 1
  })
const { database, pool } = createDatabase(config)

try {
  await waitForDatabase(pool)
  if (operation === "migrate") {
    await migrateDatabase(database)
  }
} finally {
  await pool.end()
}
