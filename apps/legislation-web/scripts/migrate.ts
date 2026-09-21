import { createDatabase, createDatabaseClient } from "@repo/legislation-core/database/database"
import { migrateDatabase } from "@repo/legislation-core/database/migrate"
import { waitForDatabase } from "@repo/legislation-core/database/readiness"
import { z } from "zod"

async function releaseMigrations(): Promise<void> {
  const config = z
    .object({
      url: z.url({ protocol: /^postgres(?:ql)?$/ }),
      connectionTimeoutMs: z.coerce.number().int().positive(),
      idleTimeoutMs: z.coerce.number().int().positive(),
      maxConnections: z.literal(1),
      migrationLockTimeoutMs: z.coerce.number().int().min(1_000).max(300_000)
    })
    .safeParse({
      url: process.env.DATABASE_URL,
      connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
      idleTimeoutMs: process.env.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
      maxConnections: 1,
      migrationLockTimeoutMs: process.env.LEGISLATION_MIGRATION_LOCK_TIMEOUT_MS ?? "30000"
    })

  if (!config.success) {
    process.stderr.write(
      "Invalid migration configuration. Set DATABASE_URL to a PostgreSQL URL in legislation-web/.env or the release environment, and use positive database timeout values.\n"
    )
    process.exitCode = 1
    return
  }

  const { pool } = createDatabase(config.data)
  try {
    await waitForDatabase(pool)
    const client = await pool.connect()
    let locked = false
    try {
      await client.query("select set_config('lock_timeout', $1, false)", [`${config.data.migrationLockTimeoutMs}ms`])
      await client.query("select pg_advisory_lock(hashtextextended('legislation-schema-migration', 0))")
      locked = true
      await migrateDatabase(createDatabaseClient(client))
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

await releaseMigrations().catch(() => {
  process.stderr.write(
    "Migration release failed. Check database connectivity, migration permissions, and the core migration files. Connection details have not been logged.\n"
  )
  process.exitCode = 1
})
