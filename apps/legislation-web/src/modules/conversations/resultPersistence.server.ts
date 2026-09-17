import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { createLegislationResearchTools } from "@repo/legislation-core/research/tools"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../configuration/config"
import { getResearchRuntime } from "../search/research-runtime"
import type { ResultPersistence } from "./resultStore"

let connection: ReturnType<typeof createDatabase> | undefined
function pool() {
  connection ??= createDatabase({ ...loadConfig().database, maxConnections: 1 })
  return connection.pool
}

export const resultPersistence: ResultPersistence = {
  async save(id, snapshot) {
    const client = await pool().connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT set_config('statement_timeout', '5000', true)")
      await client.query("DELETE FROM legislation.research_result_snapshots WHERE expires_at < now()")
      await client.query(
        "INSERT INTO legislation.research_result_snapshots (id, session_key, snapshot, expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET snapshot=excluded.snapshot, expires_at=excluded.expires_at WHERE research_result_snapshots.session_key=excluded.session_key",
        [id, snapshot.sessionKey, JSON.stringify(snapshot), new Date(snapshot.expiresAt)]
      )
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
  },
  async load(tool, input, signal) {
    return await getResearchRuntime().run(async (service) => {
      const definition = createLegislationResearchTools(
        service,
        createLogger({ service: "result-recovery", level: "warn" })
      ).find((item) => item.name === tool)
      if (!definition) {
        throw new Error("Stored result tool is unavailable")
      }
      const result = await definition.execute(input)
      return z.object({ structuredContent: z.object({ data: z.unknown() }) }).parse(result).structuredContent.data
    }, signal)
  }
}
