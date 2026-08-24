import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"

describe("BP-146 IR receiver footprint source evidence", () => {
  it("accepts the canonical reviewed source record", () => {
    expect(validateBenchPrototypeIrReceiverFootprintEvidence(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
  })

  it.each([
    ["retrievedAtUtc", "2026-08-24T08:17:00Z"],
    ["retrievedAtUtc", "2026-08-24T08:17:00.000+00:00"],
    ["reviewedAtUtc", "2026-02-30T08:17:00.000Z"]
  ])("rejects a non-canonical source timestamp (%s)", (field, value) => {
    const candidate = structuredClone(benchPrototypeIrReceiverFootprintEvidence)
    Object.defineProperty(candidate.sources[0], field, { value, enumerable: true, writable: true, configurable: true })
    expect(() => validateBenchPrototypeIrReceiverFootprintEvidence(candidate)).toThrow(RangeError)
  })
})
