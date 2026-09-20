import { describe, expect, it, vi } from "vitest"
import { readQueryStatistics, type QueryStatisticsClient } from "./query-statistics"

function clientWithRows(extensionSchema: string | null): QueryStatisticsClient {
  return {
    query: vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            database_name: "legislation",
            extension_schema: extensionSchema,
            track_io_timing: "on"
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [{ stats_reset: "2026-09-20T12:00:00.000Z" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            blk_read_time_ms: "12.5",
            blk_write_time_ms: "0",
            calls: "7",
            max_exec_time_ms: "3100",
            mean_exec_time_ms: "440",
            mean_plan_time_ms: "1.5",
            query_id: "-123456789",
            rows_per_call: "20",
            shared_blks_hit: "900",
            shared_blks_read: "10",
            temp_blks_read: "0",
            temp_blks_written: "4",
            total_exec_time_ms: "3080",
            total_plan_time_ms: "10.5",
            wal_bytes: "0"
          }
        ]
      })
  }
}

describe("readQueryStatistics", () => {
  it("returns numeric query metrics without SQL text", async () => {
    const client = clientWithRows("public")

    await expect(readQueryStatistics(client, { limit: 10, sort: "mean" })).resolves.toEqual({
      database: "legislation",
      queryTextIncluded: false,
      statistics: [
        {
          blockReadTimeMs: 12.5,
          blockWriteTimeMs: 0,
          calls: 7,
          maxExecutionTimeMs: 3100,
          meanExecutionTimeMs: 440,
          meanPlanningTimeMs: 1.5,
          queryId: "-123456789",
          rowsPerCall: 20,
          sharedBlocksHit: 900,
          sharedBlocksRead: 10,
          temporaryBlocksRead: 0,
          temporaryBlocksWritten: 4,
          totalExecutionTimeMs: 3080,
          totalPlanningTimeMs: 10.5,
          walBytes: 0
        }
      ],
      statsReset: new Date("2026-09-20T12:00:00.000Z"),
      trackIoTiming: true
    })
    expect(vi.mocked(client.query).mock.calls[2]?.[0]).not.toContain(" query,")
    expect(vi.mocked(client.query).mock.calls[2]?.[0]).toContain("order by mean_exec_time desc")
    expect(vi.mocked(client.query).mock.calls[2]?.[1]).toEqual([10])
  })

  it("fails explicitly when the extension is unavailable", async () => {
    await expect(readQueryStatistics(clientWithRows(null))).rejects.toThrow(
      "pg_stat_statements is not installed in this database"
    )
  })

  it.each([0, 101, 1.5])("rejects an unsafe limit: %s", async (limit) => {
    await expect(readQueryStatistics(clientWithRows("public"), { limit })).rejects.toThrow(RangeError)
  })
})
