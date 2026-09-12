import { describe, expect, it } from "vitest"
import { diagnosticPlan } from "./ranked-update-diagnostic.js"

describe("update diagnostic plan validation", () => {
  it("keeps complete plan evidence", () => {
    const plan = { "Execution Time": 2, Plan: { "Custom Scan Provider": "TopKScanExecState" } }
    expect(diagnosticPlan([{ "QUERY PLAN": [plan] }], "ranked")).toEqual(plan)
  })
  it.each([[], [{ "QUERY PLAN": [] }], [{ "QUERY PLAN": [{ "Execution Time": "2" }] }]])(
    "rejects missing or malformed timings",
    (raw) => {
      expect(() => diagnosticPlan(raw, "native")).toThrow(/.+/)
    }
  )
  it.each(["Seq Scan", "TopKScanExecState heap_filter"])("rejects ranked fallback %s", (provider) => {
    expect(() => diagnosticPlan([{ "QUERY PLAN": [{ "Execution Time": 2, provider }] }], "ranked")).toThrow(
      "indexed top-K"
    )
  })
})
