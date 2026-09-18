import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { sql } from "drizzle-orm"
import { loadConfig } from "../configuration/config"

export type ResearchSnapshotPersistence = {
  save: (id: string, snapshot: { sessionKey: string; expiresAt: number }) => Promise<void>
  read: (sessionKey: string, id: string) => Promise<unknown>
}

let connection: ReturnType<typeof createDatabase> | undefined
function pool() {
  connection ??= createDatabase({ ...loadConfig().database, maxConnections: 1 })
  return connection.pool
}

export const researchSnapshotPersistence: ResearchSnapshotPersistence = {
  async save(id, snapshot) {
    const client = await pool().connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT set_config('statement_timeout', '5000', true)")
      await client.query("DELETE FROM legislation.research_result_snapshots WHERE expires_at < now()")
      const result = await client.query(
        "INSERT INTO legislation.research_result_snapshots (id, session_key, snapshot, expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET snapshot=excluded.snapshot, expires_at=excluded.expires_at WHERE research_result_snapshots.session_key=excluded.session_key",
        [id, snapshot.sessionKey, JSON.stringify(snapshot), new Date(snapshot.expiresAt)]
      )
      if (result.rowCount !== 1) {
        throw new Error("Research snapshot ownership mismatch")
      }
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  },
  async read(sessionKey, id) {
    return await withReadOnlyDatabase(pool(), 5000, async (database) => {
      const result = await database.execute(
        sql`select snapshot from legislation.research_result_snapshots where id=${id}::uuid and session_key=${sessionKey}::uuid and expires_at > now()`
      )
      return result.rows[0]?.snapshot
    })
  }
}
