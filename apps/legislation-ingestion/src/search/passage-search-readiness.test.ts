import { describe, expect, it, vi } from "vitest"
import { inspectPassageSearchReadiness } from "./passage-search-readiness.js"
import { type ReplicationConnection } from "./passage-search-replication.js"

const sourceState = {
  observed_at: "2026-09-12 20:00:00+00",
  backfill_complete: true,
  after_document_id: "last-document",
  pending: "0",
  failed: "0",
  oldest_pending_at: null
}
const targetState = {
  observed_at: "2026-09-12 20:00:01+00",
  database_name: "legislation_passage_search",
  index_valid: true,
  index_ready: true
}
function connection(row: unknown) {
  return {
    query: vi.fn<ReplicationConnection["query"]>(async (query) => ({
      rows: query.startsWith("select statement_timestamp()") ? [row] : []
    }))
  }
}

describe("passage synchronization readiness", () => {
  it("does not approve cutover even when synchronization prerequisites pass", async () => {
    const source = connection(sourceState)
    const target = connection(targetState)
    const result = await inspectPassageSearchReadiness(source, target)
    expect(result.synchronizationCaughtUpAtObservation).toBe(true)
    expect(result.cutoverApproved).toBe(false)
    expect(result.remainingAcceptance).toContain("corpus_parity")
    for (const client of [source, target]) {
      expect(client.query.mock.calls[0]).toEqual(["begin read only"])
      expect(client.query.mock.calls.at(-1)).toEqual(["rollback"])
      expect(client.query).toHaveBeenCalledWith("set local statement_timeout='10s'")
    }
  })

  it("does not mistake an empty queue for a completed backfill", async () => {
    const result = await inspectPassageSearchReadiness(
      connection({ ...sourceState, backfill_complete: false, after_document_id: null }),
      connection(targetState)
    )
    expect(result.blockers).toEqual(["backfill_incomplete"])
    expect(result.synchronizationCaughtUpAtObservation).toBe(false)
  })

  it("includes retries regardless of whether they are due yet", async () => {
    const source = connection({ ...sourceState, pending: "3", failed: "1", oldest_pending_at: sourceState.observed_at })
    const result = await inspectPassageSearchReadiness(source, connection(targetState))
    expect(result.blockers).toEqual(["pending_changes", "failed_changes"])
    expect(result.source.oldest_pending_at).toBe(sourceState.observed_at)
    expect(
      source.query.mock.calls.find(([query]) => query.startsWith("select statement_timestamp()"))?.[0]
    ).not.toContain("retry_at<=")
  })

  it.each([{ index_valid: false }, { index_ready: false }])("blocks an unusable ranked index: %j", async (state) => {
    const result = await inspectPassageSearchReadiness(
      connection(sourceState),
      connection({ ...targetState, ...state })
    )
    expect(result.blockers).toEqual(["ranked_index_unavailable"])
  })

  it("rejects another database and malformed observations", async () => {
    await expect(
      inspectPassageSearchReadiness(connection(sourceState), connection({ ...targetState, database_name: "canonical" }))
    ).rejects.toThrow(/database_name/)
    await expect(
      inspectPassageSearchReadiness(connection({ ...sourceState, pending: "unknown" }), connection(targetState))
    ).rejects.toThrow(/pending/)
  })

  it("releases the read transaction on query failure and does not return success", async () => {
    const source = connection(sourceState)
    source.query.mockRejectedValueOnce(new Error("offline"))
    await expect(inspectPassageSearchReadiness(source, connection(targetState))).rejects.toThrow("offline")
    const target = connection(targetState)
    target.query.mockImplementation(async (query) => {
      if (query.startsWith("select statement_timestamp()")) {
        throw new Error("timeout")
      }
      return { rows: [] }
    })
    await expect(inspectPassageSearchReadiness(connection(sourceState), target)).rejects.toThrow("timeout")
    expect(target.query.mock.calls.at(-1)).toEqual(["rollback"])
  })

  it("rejects a shared connection", async () => {
    const source = connection(sourceState)
    await expect(inspectPassageSearchReadiness(source, source)).rejects.toThrow("separate")
    expect(source.query).not.toHaveBeenCalled()
  })
})
