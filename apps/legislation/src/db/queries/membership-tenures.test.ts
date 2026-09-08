import { describe, expect, it } from "vitest"
import { resolveMembershipTenures } from "./entities.js"

const historical = {
  id: "membership:historical",
  organizationId: "organization:historical",
  personId: "person:historical",
  sourceId: "107:historical",
  legislativeSessionId: "session:us:107",
  tenureOrdinal: 1,
  isActive: false,
  endedReason: "historical_at_first_observation",
  detectedStartDate: null,
  detectedEndDate: null,
  lastObservedDate: null,
  effectiveStartDate: null,
  effectiveEndDate: null
} as const

describe("historical membership tenure continuity", () => {
  it("keeps unknown dates and one stable tenure across repeated archival observations", () => {
    expect(resolveMembershipTenures([historical], [])).toEqual([historical])
    expect(resolveMembershipTenures([historical], [historical])).toEqual([historical])
  })
  it("does not reactivate an already historical tenure when a later active assignment appears", () => {
    expect(
      resolveMembershipTenures([{ ...historical, endedReason: null, isActive: true }], [historical])
    ).toMatchObject([{ id: "membership:historical:tenure:2", tenureOrdinal: 2, isActive: true, endedReason: null }])
  })
  it("rejects relabeling a previously observed active tenure as first encountered historical", () => {
    expect(() =>
      resolveMembershipTenures([historical], [{ ...historical, isActive: true, endedReason: null }])
    ).toThrow("conflicts with previously observed")
    expect(() => resolveMembershipTenures([historical], [historical, { ...historical, tenureOrdinal: 2 }])).toThrow(
      "conflicts with previously observed"
    )
  })
})
