import { describe, expect, it } from "vitest"
import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import {
  findFootprintReleaseEvidence,
  footprintReleaseEvidence,
  type FootprintEvidenceCategory
} from "./footprint-release-evidence.js"

const categories: readonly FootprintEvidenceCategory[] = ["copper", "courtyard", "paste", "solder-mask"]

describe("fabrication footprint release evidence ledger", () => {
  it("covers each exact gated MPN without creating a second release contract", () => {
    expect(footprintReleaseEvidence).toHaveLength(fabricationFootprintGates.length)
    expect(new Set(footprintReleaseEvidence.map((evidence) => evidence.mpn)).size).toBe(footprintReleaseEvidence.length)

    for (const gate of fabricationFootprintGates) {
      const evidence = findFootprintReleaseEvidence(gate.mpn)
      expect(evidence).toMatchObject({
        eligibleForPcb: false,
        gateReferences: gate.references,
        mpn: gate.mpn,
        releaseState: "deny"
      })
      expect(evidence?.missingReleaseData.length).toBeGreaterThan(0)
    }
  })

  it("reports all four manufacturing categories and preserves the adapter blockers", () => {
    for (const evidence of footprintReleaseEvidence) {
      expect(Object.keys(evidence.categories).sort()).toEqual([...categories].sort())
      expect(evidence.missingReleaseData.every((category) => categories.includes(category))).toBe(true)
    }

    expect(findFootprintReleaseEvidence("TPS25730ADREFR")).toMatchObject({
      categories: {
        copper: "manufacturer-verified",
        courtyard: "not-published",
        paste: "manufacturer-example",
        "solder-mask": "not-published"
      },
      library: "usb-pd",
      missingReleaseData: expect.arrayContaining(["courtyard", "solder-mask"])
    })
    expect(findFootprintReleaseEvidence("T523H107M035APE070")).toMatchObject({
      categories: {
        copper: "manufacturer-verified",
        courtyard: "manufacturer-verified",
        paste: "not-published",
        "solder-mask": "not-published"
      },
      library: "merged",
      missingReleaseData: expect.arrayContaining(["paste", "solder-mask"])
    })
    expect(findFootprintReleaseEvidence("LMR43620MSC3RPERQ1")).toMatchObject({
      categories: {
        copper: "transcribed",
        courtyard: "not-published",
        paste: "manufacturer-specified",
        "solder-mask": "manufacturer-specified"
      },
      library: "power-stage",
      missingReleaseData: expect.arrayContaining(["copper", "courtyard"])
    })
  })

  it("keeps unsupported part-specific data visibly absent", () => {
    expect(findFootprintReleaseEvidence("GRM32ER7YA106KA12L")).toMatchObject({
      categories: {
        copper: "not-imported",
        courtyard: "not-published",
        paste: "not-published",
        "solder-mask": "not-published"
      },
      library: "power-stage",
      missingReleaseData: categories,
      reviewOnlyPadCount: 0
    })
    expect(findFootprintReleaseEvidence("UNKNOWN-MPN")).toBeUndefined()
  })
})
