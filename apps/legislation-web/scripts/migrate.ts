import { createDatabase } from "@repo/legislation-core/database/database"
import { migrateDatabase } from "@repo/legislation-core/database/migrate"
import { waitForDatabase } from "@repo/legislation-core/database/readiness"
import { z } from "zod"

async function releaseMigrations(): Promise<void> {
  const config = z
    .object({
      url: z.url({ protocol: /^postgres(?:ql)?$/ }),
      connectionTimeoutMs: z.coerce.number().int().positive(),
      idleTimeoutMs: z.coerce.number().int().positive(),
      maxConnections: z.literal(1)
    })
    .safeParse({
      url: process.env.DATABASE_URL,
      connectionTimeoutMs: process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
      idleTimeoutMs: process.env.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
      maxConnections: 1
    })

  if (!config.success) {
    process.stderr.write(
      "Invalid migration configuration. Set DATABASE_URL to a PostgreSQL URL in legislation-web/.env or the release environment, and use positive database timeout values.\n"
    )
    process.exitCode = 1
    return
  }

  const { database, pool } = createDatabase(config.data)
  try {
    await waitForDatabase(pool)
    await migrateDatabase(database)
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
