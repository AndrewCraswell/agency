import { describe, expect, it, vi } from "vitest"
import {
  FIE_TIMING_BANDS,
  getFieTimingBandEndpointUs,
  loadTimingTable,
  resolveTimingTable,
  validateTimingTable
} from "./timing-table.js"

function timingTableCandidate() {
  return {
    revision: "timing-1",
    epee: { contactMinimumUs: 2_000, doubleHitWindowUs: 45_000 },
    foil: { contactBreakMinimumUs: 13_000, lockoutUs: 300_000 },
    sabre: {
      bladeRegistrationLatestUs: 5_000,
      bladeRecoveryUs: 20_000,
      controlBreakUs: 3_000,
      lockoutUs: 170_000,
      maximumBladeContactInterruptions: 10,
      minimumContactUs: 100,
      sensitivityTestPointUs: 1_000
    }
  }
}

describe("versioned immutable timing-table loader", () => {
  it("loads the deterministic timing-1 table without consulting wall-clock state", () => {
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("Timing-table loading must not read the wall clock")
    })
    const first = loadTimingTable("timing-1")
    const second = loadTimingTable("timing-1")

    clock.mockRestore()

    expect(first).toBe(second)
    expect(first).toEqual(timingTableCandidate())
    expect(first.epee.contactMinimumUs).toBe(2_000)
    expect(first.foil.lockoutUs).toBe(300_000)
    expect(first.sabre.lockoutUs).toBe(170_000)
  })

  it("fails closed for unknown or malformed revisions", () => {
    expect(() => loadTimingTable("timing-2")).toThrow(new RangeError("Unknown timing-table revision"))
    expect(() => loadTimingTable(undefined)).toThrow(new TypeError("Timing-table revision must be a string"))
    expect(() => validateTimingTable({ ...timingTableCandidate(), revision: "timing-2" })).toThrow(
      new RangeError("Unknown timing-table revision")
    )
  })

  it("rejects values outside their FIE-derived approved envelopes", () => {
    const epeeTooEarly = timingTableCandidate()
    epeeTooEarly.epee.doubleHitWindowUs = 39_999
    expect(() => validateTimingTable(epeeTooEarly)).toThrow(
      new RangeError("Timing table epee.doubleHitWindowUs must be within 40000..50000 microseconds")
    )

    const foilTooLate = timingTableCandidate()
    foilTooLate.foil.lockoutUs = 325_001
    expect(() => validateTimingTable(foilTooLate)).toThrow(
      new RangeError("Timing table foil.lockoutUs must be within 275000..325000 microseconds")
    )

    const sabreTooShort = timingTableCandidate()
    sabreTooShort.sabre.minimumContactUs = 99
    expect(() => validateTimingTable(sabreTooShort)).toThrow(
      new RangeError("Timing table sabre.minimumContactUs must be within 100..unbounded microseconds")
    )

    const sabreRecoveryTooEarly = timingTableCandidate()
    sabreRecoveryTooEarly.sabre.bladeRecoveryUs = 9_999
    expect(() => validateTimingTable(sabreRecoveryTooEarly)).toThrow(
      new RangeError("Timing table sabre.bladeRecoveryUs must be within 10000..20000 microseconds")
    )
  })

  it("rejects unreviewed changes even when they fall inside an FIE tolerance or uncertain endpoint", () => {
    const alternateSelection = timingTableCandidate()
    alternateSelection.epee.doubleHitWindowUs = 40_000

    expect(() => validateTimingTable(alternateSelection)).toThrow(
      new RangeError("Timing table epee.doubleHitWindowUs must equal the approved timing-1 value 45000")
    )

    const uncertainEndpoint = timingTableCandidate()
    uncertainEndpoint.sabre.bladeRegistrationLatestUs = 4_000

    expect(() => validateTimingTable(uncertainEndpoint)).toThrow(
      new RangeError("Timing table sabre.bladeRegistrationLatestUs must equal the approved timing-1 value 5000")
    )
  })

  it("publishes immutable FIE bands with endpoint uncertainty beside the exact product table", () => {
    expect(FIE_TIMING_BANDS).toEqual({
      epee: {
        contactMinimumUs: {
          earliestUs: 2_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 10_000
        },
        doubleHitWindowUs: {
          earliestUs: 40_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 50_000
        }
      },
      foil: {
        contactBreakMinimumUs: {
          earliestUs: 13_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 15_000
        },
        lockoutUs: {
          earliestUs: 275_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 325_000
        }
      },
      sabre: {
        bladeRecoveryUs: {
          earliestUs: 10_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 20_000
        },
        bladeRegistrationLatestUs: {
          earliestUs: 0,
          endpointUncertainty: "published-endpoint-needs-product-policy",
          latestUs: 5_000
        },
        controlBreakUs: {
          earliestUs: 1_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 5_000
        },
        lockoutUs: {
          earliestUs: 160_000,
          endpointUncertainty: "fie-tolerance-requires-product-selection",
          latestUs: 180_000
        },
        minimumContactUs: {
          earliestUs: 100,
          endpointUncertainty: "published-endpoint-needs-product-policy",
          latestUs: null
        },
        sensitivityTestPointUs: {
          earliestUs: 1_000,
          endpointUncertainty: "exact-published-endpoint",
          latestUs: 1_000
        }
      }
    })
    expect(Object.isFrozen(FIE_TIMING_BANDS)).toBe(true)
    expect(Object.isFrozen(FIE_TIMING_BANDS.sabre.bladeRecoveryUs)).toBe(true)
  })

  it("returns a deeply immutable table that cannot be changed by a consumer", () => {
    const table = loadTimingTable("timing-1")

    expect(Object.isFrozen(table)).toBe(true)
    expect(Object.isFrozen(table.epee)).toBe(true)
    expect(Object.isFrozen(table.foil)).toBe(true)
    expect(Object.isFrozen(table.sabre)).toBe(true)
    expect(() => {
      ;(table.epee as { contactMinimumUs: number }).contactMinimumUs = 9_999
    }).toThrow(TypeError)
    expect(loadTimingTable("timing-1").epee.contactMinimumUs).toBe(2_000)
  })

  it("canonicalizes an explicit validated table before a scorer can use it", () => {
    const copiedTable = timingTableCandidate()

    validateTimingTable(copiedTable)

    expect(resolveTimingTable(copiedTable)).toBe(loadTimingTable("timing-1"))
  })

  it("rejects a request for an unbounded FIE endpoint", () => {
    expect(() => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.minimumContactUs, "latest")).toThrow(
      new RangeError("Requested FIE timing endpoint is unbounded")
    )
  })

  it("rejects missing and unrecognized table fields", () => {
    const missingField = timingTableCandidate()
    delete (missingField.sabre as Partial<typeof missingField.sabre>).lockoutUs
    expect(() => validateTimingTable(missingField)).toThrow(
      new TypeError("Timing table sabre has missing or unrecognized fields")
    )

    const extraField = { ...timingTableCandidate(), extra: true }
    expect(() => validateTimingTable(extraField)).toThrow(
      new TypeError("Timing table has missing or unrecognized fields")
    )

    const symbolKey = Symbol("unrecognized")
    const symbolField = timingTableCandidate()
    Object.defineProperty(symbolField, symbolKey, { value: true })
    expect(() => validateTimingTable(symbolField)).toThrow(
      new TypeError("Timing table has missing or unrecognized fields")
    )
  })

  it("rejects non-object, fractional, negative, and non-numeric timing values", () => {
    expect(() => validateTimingTable(null)).toThrow(new TypeError("Timing table must be an object"))

    const fractional = timingTableCandidate()
    fractional.epee.contactMinimumUs = 2_000.5
    expect(() => validateTimingTable(fractional)).toThrow(
      new RangeError("Timing table epee.contactMinimumUs must be a non-negative safe integer microsecond value")
    )

    const negative = timingTableCandidate()
    negative.epee.contactMinimumUs = -1
    expect(() => validateTimingTable(negative)).toThrow(
      new RangeError("Timing table epee.contactMinimumUs must be a non-negative safe integer microsecond value")
    )

    const nonNumeric = { ...timingTableCandidate(), epee: { contactMinimumUs: null, doubleHitWindowUs: 45_000 } }
    expect(() => validateTimingTable(nonNumeric)).toThrow(
      new RangeError("Timing table epee.contactMinimumUs must be a non-negative safe integer microsecond value")
    )

    const negativeCount = timingTableCandidate()
    negativeCount.sabre.maximumBladeContactInterruptions = -1
    expect(() => validateTimingTable(negativeCount)).toThrow(
      new RangeError(
        "Timing table sabre.maximumBladeContactInterruptions must be a non-negative safe integer count value"
      )
    )
  })
})
