import { logger, task } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { acquireIndexMaintenanceLock, releaseIndexMaintenanceLock } from "../../db/index-maintenance.js"

const apiPerformanceIndexMaintenancePayloadSchema = z
  .object({
    maintenanceId: z.string().trim().min(1)
  })
  .strict()

const API_PERFORMANCE_INDEXES = [
  {
    create:
      "create index concurrently if not exists bills_identifier_lower_idx on legislation.bills (lower(identifier), id asc)",
    name: "bills_identifier_lower_idx"
  },
  {
    create:
      "create index concurrently if not exists bills_global_introduced_idx on legislation.bills (introduced_at desc nulls first, id asc)",
    name: "bills_global_introduced_idx"
  },
  {
    create:
      "create index concurrently if not exists bill_documents_amendment_date_idx on legislation.bill_documents (classification asc, (document_date is null) asc, document_date desc nulls first, id asc)",
    name: "bill_documents_amendment_date_idx"
  },
  {
    create:
      "create index concurrently if not exists bill_sponsors_name_search_gin_idx on legislation.bill_sponsors using gin (to_tsvector('english', name))",
    name: "bill_sponsors_name_search_gin_idx"
  }
] as const

const INVALID_API_PERFORMANCE_INDEX_QUERY = `
  select index_class.relname as index_name
  from pg_index index_state
  join pg_class index_class on index_class.oid = index_state.indexrelid
  join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
  where index_namespace.nspname = 'legislation'
    and not index_state.indisvalid
    and index_class.relname in (${API_PERFORMANCE_INDEXES.map(({ name }) => `'${name}'`).join(", ")})
`

export const apiPerformanceIndexMaintenance = task({
  id: "api-performance-index-maintenance",
  maxDuration: 86_400,
  queue: { concurrencyLimit: 1, name: "legislation-api-performance-index-maintenance" },
  run: async (unparsedPayload: unknown) => {
    const payload = apiPerformanceIndexMaintenancePayloadSchema.parse(unparsedPayload)
    const config = loadConfig()
    const { pool } = createDatabase({ ...config.database, maxConnections: 1 })
    const client = await pool.connect()
    let acquired = false

    try {
      await acquireIndexMaintenanceLock(client)
      acquired = true

      await client.query("set maintenance_work_mem = '32MB'")
      await client.query("set max_parallel_maintenance_workers = 2")

      const invalidIndexes = await client.query<{ index_name: string }>(INVALID_API_PERFORMANCE_INDEX_QUERY)
      const statements = apiPerformanceIndexMaintenanceStatements(
        invalidIndexes.rows.map(({ index_name }) => index_name)
      )
      for (const statement of statements) {
        await client.query(statement)
      }

      await client.query("analyze legislation.bills")
      await client.query("analyze legislation.bill_documents")
      await client.query("analyze legislation.bill_sponsors")
      logger.info("API performance indexes are valid and analyzed", { maintenanceId: payload.maintenanceId })
    } finally {
      try {
        if (acquired) {
          await releaseIndexMaintenanceLock(client)
        }
      } finally {
        client.release()
        await pool.end()
      }
    }

    return { maintenanceId: payload.maintenanceId, status: "completed" as const }
  }
})

export function apiPerformanceIndexMaintenanceStatements(invalidIndexNames: readonly string[]): string[] {
  const invalid = new Set(invalidIndexNames)
  return API_PERFORMANCE_INDEXES.flatMap(({ create, name }) => [
    ...(invalid.has(name) ? [`drop index concurrently if exists legislation.${name}`] : []),
    create
  ])
}
