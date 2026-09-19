import { describe, expect, it, vi } from "vitest"
import {
  requireStateContentActivation,
  requireStateRepairScope,
  requireSuccessfulStateContentResult,
  runStateContentContinuations,
  stateContentPayload,
  stateContentSchedulePlan
} from "./state-content-policy.js"

describe("state content hosted boundaries", () => {
  it("keeps extraction repairs inside the exact approved session", () => {
    const repair = {
      documentId: "document:fixture",
      billId: "bill:nc:2017e1:hb:1",
      sourceUrl: "https://www.ncleg.gov/test.pdf",
      sourceSha256: "a".repeat(64),
      previousTextHash: "b".repeat(32)
    }
    expect(() => requireStateRepairScope("nc", "2017E1", [repair])).not.toThrow()
    expect(() => requireStateRepairScope("ak", "34", [repair])).toThrow("outside")
    expect(() => requireStateRepairScope("nc", undefined, [repair])).toThrow("exact session")
    expect(() => requireStateRepairScope("nc", "2017E1", [repair, repair])).toThrow("Duplicate")
    expect(() =>
      stateContentPayload.parse({ state: "nc", extractionRepairs: Array.from({ length: 11 }, () => repair) })
    ).toThrow(/Too big/)
  })
  it("requires an explicitly approved state and exact session for scheduled resumption", () => {
    expect(stateContentSchedulePlan("nc:2017E1", "nc")).toMatchObject({
      identity: "nc:2017E1",
      payload: { state: "nc", session: "2017E1", maxContinuations: 1 }
    })
    expect(stateContentSchedulePlan("ak:34", "ak").payload.session).toBe("34")
    for (const invalid of [undefined, "nc", "ca:2025", "ak:34:extra", "nc:../2025"]) {
      expect(() => stateContentSchedulePlan(invalid, "nc,ak")).toThrow(/Invalid/)
    }
    expect(() => stateContentSchedulePlan("ak:34", "nc")).toThrow("not approved")
  })
  it("throws recorded failures at the worker boundary and retains successful batch evidence", () => {
    const result = {
      status: "succeeded",
      checkpoint: { scanRoundComplete: false, ingestionComplete: false, nextWork: { kind: "continue" } },
      counts: { updated: 2 }
    }
    expect(requireSuccessfulStateContentResult(result)).toBe(result)
    for (const status of ["failed", "partial", "running"]) {
      expect(() => requireSuccessfulStateContentResult({ ...result, status })).toThrow(/Invalid/)
    }
    expect(() =>
      requireSuccessfulStateContentResult({ ...result, checkpoint: { ...result.checkpoint, ingestionComplete: true } })
    ).toThrow(/Invalid/)
  })
  it("requires explicit activation and rejects other jurisdictions or extra payload fields", () => {
    expect(() => requireStateContentActivation("nc", undefined)).toThrow("not approved")
    expect(() => requireStateContentActivation("ak", "nc")).toThrow("not approved")
    expect(() => requireStateContentActivation("nc", "nc,ca")).toThrow(/Invalid option/)
    expect(() => requireStateContentActivation("ak", "nc, ak")).not.toThrow()
    expect(() => stateContentPayload.parse({ state: "nc", databaseUrl: "override" })).toThrow(/Unrecognized key/)
  })
  it("uses bounded sequential children without calling a scan round ingestion complete", async () => {
    const run = vi.fn<Parameters<typeof runStateContentContinuations>[1]>().mockResolvedValue({
      ok: true,
      output: {
        status: "succeeded",
        checkpoint: { scanRoundComplete: true, ingestionComplete: false, nextWork: { kind: "continue" } }
      }
    })
    expect(await runStateContentContinuations(2, run)).toEqual({
      reason: "continuation_budget",
      continuations: 2,
      scanRounds: 2,
      ingestionComplete: false,
      nextWork: { kind: "continue" }
    })
    expect(run.mock.calls).toEqual([[0], [1]])
  })
  it.each([
    { kind: "drained" },
    { kind: "blocked", records: 2 },
    { kind: "deferred", retryAt: "2026-09-19T02:00:00.000Z" }
  ])("stops repeating a scan when backlog says $kind", async (nextWork) => {
    const run = vi.fn().mockResolvedValue({
      ok: true,
      output: {
        status: "succeeded",
        checkpoint: { scanRoundComplete: true, ingestionComplete: false, nextWork }
      }
    })
    expect(await runStateContentContinuations(100, run)).toMatchObject({
      reason: nextWork.kind,
      continuations: 1,
      nextWork,
      ingestionComplete: false
    })
    expect(run).toHaveBeenCalledOnce()
  })
  it("yields at a time budget instead of starting another potentially long child", async () => {
    const clock = vi.fn().mockReturnValueOnce(0).mockReturnValue(600_000)
    const run = vi.fn().mockResolvedValue({
      ok: true,
      output: {
        status: "succeeded",
        checkpoint: { scanRoundComplete: false, ingestionComplete: false, nextWork: { kind: "continue" } }
      }
    })
    expect(await runStateContentContinuations(100, run, clock)).toMatchObject({
      reason: "time_budget",
      continuations: 1,
      nextWork: { kind: "continue" }
    })
    expect(run).toHaveBeenCalledOnce()
  })
  it("rejects a stop claim before the scan completes", async () => {
    await expect(
      runStateContentContinuations(1, async () => ({
        ok: true,
        output: {
          status: "succeeded",
          checkpoint: { scanRoundComplete: false, ingestionComplete: false, nextWork: { kind: "drained" } }
        }
      }))
    ).rejects.toThrow("complete content scan")
  })
  it("stops after a failed or malformed child instead of admitting more work", async () => {
    const run = vi.fn<Parameters<typeof runStateContentContinuations>[1]>().mockResolvedValue({ ok: false })
    await expect(runStateContentContinuations(3, run)).rejects.toThrow("child failed")
    expect(run).toHaveBeenCalledOnce()
    await expect(
      runStateContentContinuations(1, async () => ({ ok: true, output: { status: "partial" } }))
    ).rejects.toThrow(/Invalid/)
  })
})
