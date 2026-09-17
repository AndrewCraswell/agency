import { describe, expect, it } from "vitest"
import { completeMembershipObservationDates } from "./membership-observation-repair.js"

describe("Open States membership observation date repair", () => {
  const sourceRetrievedAt = new Date("2026-09-17T06:32:06.271Z")

  it("derives a missing observation interval from retained retrieval evidence", () => {
    expect(
      completeMembershipObservationDates({
        detectedStartDate: null,
        id: "membership",
        lastObservedDate: null,
        sourceRetrievedAt
      })
    ).toEqual({ detectedStartDate: "2026-09-17", lastObservedDate: "2026-09-17" })
  })

  it("preserves existing bounds and cannot invert the interval", () => {
    expect(
      completeMembershipObservationDates({
        detectedStartDate: "2026-09-18",
        id: "membership",
        lastObservedDate: null,
        sourceRetrievedAt
      })
    ).toEqual({ detectedStartDate: "2026-09-18", lastObservedDate: "2026-09-18" })
    expect(
      completeMembershipObservationDates({
        detectedStartDate: null,
        id: "membership",
        lastObservedDate: "2026-09-16",
        sourceRetrievedAt
      })
    ).toEqual({ detectedStartDate: "2026-09-16", lastObservedDate: "2026-09-16" })
  })
})
