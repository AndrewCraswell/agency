import { createDatabase } from "@repo/legislation-core/database/database"
import { migrateDatabase } from "@repo/legislation-core/database/migrate"
import { waitForDatabase } from "@repo/legislation-core/database/readiness"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import { z } from "zod"

async function releaseProductionMigrations(): Promise<void> {
  const config = z
    .object({
      url: z.url({ protocol: /^postgres(?:ql)?$/ }),
      connectionTimeoutMs: z.coerce.number().int().positive(),
      idleTimeoutMs: z.coerce.number().int().positive(),
      lockTimeoutMs: z.coerce.number().int().min(1_000).max(300_000),
      maxConnections: z.literal(1)
    })
    .safeParse({
      url: process.env.DATABASE_URL,
      connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
      idleTimeoutMs: process.env.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
      lockTimeoutMs: process.env.LEGISLATION_MIGRATION_LOCK_TIMEOUT_MS ?? "30000",
      maxConnections: 1
    })
  if (!config.success) {
    throw new Error("Invalid production migration configuration")
  }

  const { pool } = createDatabase(config.data)
  try {
    await waitForDatabase(pool)
    const client = await pool.connect()
    let locked = false
    try {
      await client.query("select set_config('lock_timeout', $1, false)", [`${config.data.lockTimeoutMs}ms`])
      await client.query("select pg_advisory_lock(hashtextextended('legislation-schema-migration', 0))")
      locked = true
      await migrateDatabase(drizzle(client, { schema }))
    } finally {
      try {
        if (locked) {
          await client.query("select pg_advisory_unlock(hashtextextended('legislation-schema-migration', 0))")
        }
      } finally {
        client.release()
      }
    }
  } finally {
    await pool.end()
  }
}

await releaseProductionMigrations().catch(() => {
  process.stderr.write(
    "Production migration failed. Check direct database connectivity, lock contention, migration permissions, and canonical migration history. Connection details have not been logged.\n"
  )
  process.exitCode = 1
})
