import type pg from "pg"

export async function isDatabaseAvailable(pool: pg.Pool): Promise<boolean> {
  try {
    await pool.query("select 1")
    return true
  } catch {
    return false
  }
}

export async function isDatabaseReady(pool: pg.Pool): Promise<boolean> {
  try {
    const result = await pool.query<{ is_ready: boolean }>(
      "select exists (select 1 from pg_extension where extname = 'vector') and to_regnamespace('legislation') is not null as is_ready"
    )

    return result.rows[0]?.is_ready === true
  } catch {
    return false
  }
}

export async function waitForDatabase(
  pool: pg.Pool,
  options: Readonly<{ intervalMs?: number; timeoutMs?: number }> = {}
): Promise<void> {
  const intervalMs = options.intervalMs ?? 500
  const timeoutMs = options.timeoutMs ?? 30_000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await isDatabaseAvailable(pool)) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Database was not ready within ${timeoutMs}ms`)
}
