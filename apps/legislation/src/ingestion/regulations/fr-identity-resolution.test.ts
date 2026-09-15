import { describe, expect, it } from "vitest"
import { digest } from "./contracts.js"
import { planFrIdentityResolution } from "./fr-identity-resolution.js"

const rule = {
  documentNumber: "00-113",
  date: "2000-01-18",
  volume: 65,
  startPage: 2537,
  endPage: 2538,
  kind: "Rule",
  title: "Revision of Class D Airspace; Hobbs, NM"
}
const notice = {
  ...rule,
  startPage: 2639,
  endPage: 2639,
  kind: "Notice",
  title: "Notice of Filing of Plat of an Island; Minnesota"
}
const source = (evidence: typeof rule, sourceLocator: string) => ({
  evidence,
  sourceLocator,
  artifactHash: digest("fixture issue")
})
describe("FR identity collision resolution plans", () => {
  it("preserves both same-number publications and matches metadata only to its own citation", () => {
    const report = planFrIdentityResolution({
      texts: [source(rule, "/FEDREG/RULE[1]"), source(notice, "/FEDREG/NOTICE[1]")],
      metadata: [notice]
    })
    expect(report.matched).toBe(1)
    expect(report.unresolved).toBe(1)
    expect(report.resolutions.map((row) => row.status)).toEqual(["unmatched_metadata", "matched"])
    expect(report.resolutions.every((row) => row.isNumberAmbiguous)).toBe(true)
    expect(new Set(report.resolutions.map((row) => row.citationKey)).size).toBe(2)
    expect(report.ambiguousAliases[0]?.sourceObservationKeys).toHaveLength(2)
    expect(report.publicationReady).toBe(false)
  })
  it("does not resolve duplicate citations using arbitrary suffixes or source order", () => {
    const report = planFrIdentityResolution({ texts: [source(rule, "/one"), source(rule, "/two")], metadata: [rule] })
    expect(report.resolutions.every((row) => row.status === "ambiguous_citation" && row.citationKey === null)).toBe(
      true
    )
  })
  it("rejects repeated source observations and refuses contradictory metadata", () => {
    expect(() =>
      planFrIdentityResolution({ texts: [source(rule, "/one"), source(rule, "/one")], metadata: [] })
    ).toThrow("duplicate_fr_source_observation")
    expect(
      planFrIdentityResolution({ texts: [source(rule, "/one")], metadata: [{ ...rule, endPage: 2539 }] }).unresolved
    ).toBe(1)
    expect(
      planFrIdentityResolution({ texts: [source(rule, "/one")], metadata: [rule, rule] }).resolutions[0]?.status
    ).toBe("ambiguous_metadata")
  })
})
