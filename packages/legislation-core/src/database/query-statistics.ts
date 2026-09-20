import type { QueryResultRow } from "pg"
import { z } from "zod"

const statisticRowSchema = z.object({
  blk_read_time_ms: z.coerce.number().finite().nonnegative(),
  blk_write_time_ms: z.coerce.number().finite().nonnegative(),
  calls: z.coerce.number().int().nonnegative(),
  max_exec_time_ms: z.coerce.number().finite().nonnegative(),
  mean_exec_time_ms: z.coerce.number().finite().nonnegative(),
  mean_plan_time_ms: z.coerce.number().finite().nonnegative(),
  query_id: z.coerce.string().min(1),
  rows_per_call: z.coerce.number().finite().nonnegative(),
  shared_blks_hit: z.coerce.number().int().nonnegative(),
  shared_blks_read: z.coerce.number().int().nonnegative(),
  temp_blks_read: z.coerce.number().int().nonnegative(),
  temp_blks_written: z.coerce.number().int().nonnegative(),
  total_exec_time_ms: z.coerce.number().finite().nonnegative(),
  total_plan_time_ms: z.coerce.number().finite().nonnegative(),
  wal_bytes: z.coerce.number().finite().nonnegative()
})

const extensionRowSchema = z.object({
  database_name: z.string().min(1),
  extension_schema: z
    .string()
    .regex(/^[a-z_][a-z0-9_$]*$/iu)
    .nullable(),
  track_io_timing: z.enum(["on", "off"])
})

export type QueryStatisticsSort = "calls" | "mean" | "total"

export type QueryStatisticsReport = Readonly<{
  database: string
  queryTextIncluded: false
  statistics: readonly Readonly<{
    blockReadTimeMs: number
    blockWriteTimeMs: number
    calls: number
    maxExecutionTimeMs: number
    meanExecutionTimeMs: number
    meanPlanningTimeMs: number
    queryId: string
    rowsPerCall: number
    sharedBlocksHit: number
    sharedBlocksRead: number
    temporaryBlocksRead: number
    temporaryBlocksWritten: number
    totalExecutionTimeMs: number
    totalPlanningTimeMs: number
    walBytes: number
  }>[]
  statsReset: Date | null
  trackIoTiming: boolean
}>

export interface QueryStatisticsClient {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<Readonly<{ rows: Row[] }>>
}

const sortColumns = {
  calls: "calls",
  mean: "mean_exec_time",
  total: "total_exec_time"
} as const satisfies Record<QueryStatisticsSort, string>

export async function readQueryStatistics(
  client: QueryStatisticsClient,
  options: Readonly<{ limit?: number; sort?: QueryStatisticsSort }> = {}
): Promise<QueryStatisticsReport> {
  const limit = options.limit ?? 25
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Query statistics limit must be an integer from 1 through 100")
  }
  const sort = options.sort ?? "total"
  const extension = extensionRowSchema.parse(
    (
      await client.query<{
        database_name: string
        extension_schema: string | null
        stats_reset: Date | null
        track_io_timing: "on" | "off"
      }>(`
        select
          current_database() as database_name,
          (select n.nspname
             from pg_extension e
             join pg_namespace n on n.oid = e.extnamespace
            where e.extname = 'pg_stat_statements') as extension_schema,
          current_setting('track_io_timing') as track_io_timing
      `)
    ).rows[0]
  )
  if (extension.extension_schema === null) {
    throw new Error("pg_stat_statements is not installed in this database")
  }
  const relation = `"${extension.extension_schema}"."pg_stat_statements"`
  const informationRelation = `"${extension.extension_schema}"."pg_stat_statements_info"`
  const information = z
    .object({ stats_reset: z.coerce.date().nullable() })
    .parse((await client.query<{ stats_reset: Date | null }>(`select stats_reset from ${informationRelation}`)).rows[0])
  const rows = await client.query(
    `
      select
        queryid::text as query_id,
        calls,
        total_plan_time as total_plan_time_ms,
        mean_plan_time as mean_plan_time_ms,
        total_exec_time as total_exec_time_ms,
        mean_exec_time as mean_exec_time_ms,
        max_exec_time as max_exec_time_ms,
        case when calls = 0 then 0 else rows::numeric / calls end as rows_per_call,
        shared_blks_hit,
        shared_blks_read,
        temp_blks_read,
        temp_blks_written,
        shared_blk_read_time as blk_read_time_ms,
        shared_blk_write_time as blk_write_time_ms,
        wal_bytes
      from ${relation}
      where dbid = (select oid from pg_database where datname = current_database())
        and queryid is not null
      order by ${sortColumns[sort]} desc, queryid asc
      limit $1
    `,
    [limit]
  )
  return {
    database: extension.database_name,
    queryTextIncluded: false,
    statistics: z
      .array(statisticRowSchema)
      .parse(rows.rows)
      .map((row) => ({
        blockReadTimeMs: row.blk_read_time_ms,
        blockWriteTimeMs: row.blk_write_time_ms,
        calls: row.calls,
        maxExecutionTimeMs: row.max_exec_time_ms,
        meanExecutionTimeMs: row.mean_exec_time_ms,
        meanPlanningTimeMs: row.mean_plan_time_ms,
        queryId: row.query_id,
        rowsPerCall: row.rows_per_call,
        sharedBlocksHit: row.shared_blks_hit,
        sharedBlocksRead: row.shared_blks_read,
        temporaryBlocksRead: row.temp_blks_read,
        temporaryBlocksWritten: row.temp_blks_written,
        totalExecutionTimeMs: row.total_exec_time_ms,
        totalPlanningTimeMs: row.total_plan_time_ms,
        walBytes: row.wal_bytes
      })),
    statsReset: information.stats_reset,
    trackIoTiming: extension.track_io_timing === "on"
  }
}
