import type pg from "pg"

const ACQUIRE_INDEX_MAINTENANCE_LOCK_QUERY = `
  select pg_try_advisory_lock(hashtextextended('legislation:index-maintenance', 0)) as acquired
`

const RELEASE_INDEX_MAINTENANCE_LOCK_QUERY = `
  select pg_advisory_unlock(hashtextextended('legislation:index-maintenance', 0))
`

const ACTIVE_INDEX_BUILD_QUERY = `
  select exists (
    select 1
    from pg_stat_progress_create_index
    where pid <> pg_backend_pid()
  ) as active
`

export async function acquireIndexMaintenanceLock(client: pg.PoolClient): Promise<void> {
  const lockResult = await client.query<{ acquired: boolean }>(ACQUIRE_INDEX_MAINTENANCE_LOCK_QUERY)
  if (lockResult.rows[0]?.acquired !== true) {
    throw new Error("Another legislation index-maintenance operation owns the database maintenance lock")
  }

  try {
    const progressResult = await client.query<{ active: boolean }>(ACTIVE_INDEX_BUILD_QUERY)
    if (progressResult.rows[0]?.active === true) {
      throw new Error("Another PostgreSQL index build is active; index maintenance was not started")
    }
  } catch (error) {
    await releaseIndexMaintenanceLock(client)
    throw error
  }
}

export async function releaseIndexMaintenanceLock(client: pg.PoolClient): Promise<void> {
  await client.query(RELEASE_INDEX_MAINTENANCE_LOCK_QUERY)
}
