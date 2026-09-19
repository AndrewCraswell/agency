import { describe, expect, it } from "vitest"
import { nextStateContentWork } from "./state-content-backlog.js"

const empty = { due: "0", processing: "0", blocked: "0", retry_at: null, checked_at: "2026-09-19T02:00:00Z" }
describe("state content backlog decisions", () => {
  it("drains only when no eligible, in-flight or blocked work remains", () => {
    expect(nextStateContentWork(empty)).toEqual({ kind: "drained" })
    expect(nextStateContentWork({ ...empty, blocked: "2" })).toEqual({ kind: "blocked", records: 2 })
  })
  it("processes eligible work before reporting other blocked records", () => {
    expect(nextStateContentWork({ ...empty, due: "1", blocked: "2" })).toEqual({ kind: "continue" })
  })
  it("defers to the earliest retry without busy polling", () => {
    expect(nextStateContentWork({ ...empty, retry_at: "2026-09-19T02:05:00Z" })).toEqual({
      kind: "deferred",
      retryAt: "2026-09-19T02:05:00.000Z"
    })
    expect(nextStateContentWork({ ...empty, processing: "1", retry_at: "2026-09-19T02:05:00Z" })).toEqual({
      kind: "deferred",
      retryAt: "2026-09-19T02:01:00.000Z"
    })
    expect(nextStateContentWork({ ...empty, processing: "1", retry_at: "2026-09-19T02:00:30Z" })).toEqual({
      kind: "deferred",
      retryAt: "2026-09-19T02:00:30.000Z"
    })
  })
  it("rejects missing or invalid inventory rather than claiming drained", () => {
    expect(() => nextStateContentWork(undefined)).toThrow()
    expect(() => nextStateContentWork({ ...empty, due: -1 })).toThrow()
  })
})
