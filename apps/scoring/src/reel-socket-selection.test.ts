import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { reelSocketSelection, validateReelSocketSelection } from "./reel-socket-selection.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M4-10 reel-socket selection", () => {
  it("freezes the exact central-apparatus component selection without releasing it", () => {
    expect(Object.isFrozen(reelSocketSelection)).toBe(true)
    expect(Object.isFrozen(reelSocketSelection.decision)).toBe(true)
    expect(Object.isFrozen(reelSocketSelection.decision.candidates)).toBe(true)
    expect(reelSocketSelection.workUnit).toBe("M4-10")
    expect(reelSocketSelection.releaseState).toBe("deny")
    expect(reelSocketSelection.procurementAuthorized).toBe(false)
    expect(reelSocketSelection.decision.status).toBe("component-selected-validation-unresolved")
    expect(reelSocketSelection.decision.selectedCandidate).toMatchObject({
      manufacturer: "Stäubli Electrical Connectors",
      family: "SLB4-F/A",
      role: expect.stringContaining("central-apparatus female socket"),
      selectedParts: [
        expect.objectContaining({ apparatusPosition: "left", color: "Red", mpn: "23.3070-22", quantityPerFiePort: 3 }),
        expect.objectContaining({ apparatusPosition: "right", color: "Blue", mpn: "23.3070-23", quantityPerFiePort: 3 })
      ]
    })
    expect(reelSocketSelection.decision.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ manufacturer: "Favero", mpn: "900-09", role: expect.stringContaining("reel-case") }),
        expect.objectContaining({ manufacturer: "Allstar/Uhlmann", mpn: null }),
        expect.objectContaining({
          manufacturer: "OK FENCING",
          mpn: "17-2017-03",
          role: "bodywire/fencer-end socket candidate only"
        })
      ])
    )
    expect(reelSocketSelection.decision.requestedColorOptions).toEqual([
      expect.objectContaining({
        apparatusPosition: "left",
        requestedColor: "Red",
        colorSuffix: "-22",
        mpn: "23.3070-22"
      }),
      expect.objectContaining({
        apparatusPosition: "right",
        requestedColor: "Blue",
        colorSuffix: "-23",
        mpn: "23.3070-23"
      })
    ])
  })

  it("keeps the FIE geometry, panel drawing contract, and qualification targets explicit", () => {
    expect(reelSocketSelection.normativeInterface).toMatchObject({
      plugPins: 3,
      pinDiameterMm: 4,
      arrangement: "straight line",
      outerPinOffsetFromCentreMm: [15, 20]
    })
    expect(reelSocketSelection.centralApparatusPort).toMatchObject({
      assembly: expect.stringContaining("Three Stäubli SLB4-F/A sockets"),
      selectedSocketMechanicalFacts: {
        plugSystemDiameterMm: 4,
        panelCutoutDiameterMm: 12.2,
        overallLengthMm: null,
        overallLengthDrawingConflictMm: {
          manufacturerDataSheet: 30.5,
          manufacturerMainCatalogue: 30.7
        },
        frontFlangeDiameterMm: 14.5
      }
    })
    expect(reelSocketSelection.centralApparatusPort.contactCoordinatesMm).toEqual([
      { position: "outer-near-15 mm", xFromCentre: -15, yFromCentre: 0 },
      { position: "centre", xFromCentre: 0, yFromCentre: 0 },
      { position: "outer-far-20 mm", xFromCentre: 20, yFromCentre: 0 }
    ])
    expect(reelSocketSelection.candidateSocketFacts.manufacturerPublished).toMatchObject({
      contactResistanceMilliOhm: null,
      contactMaterialOrPlating: "CuZn contact with Ni surface treatment",
      panelCutoutMm: 12.2,
      terminalStyle: "4.8 mm by 0.8 mm flat connecting tab"
    })
    expect(reelSocketSelection.candidateSocketFacts.manufacturerPublished.retentionForceN).toBeNull()
    expect(
      reelSocketSelection.centralApparatusPort.selectedSocketMechanicalFacts.overallLengthDrawingConflictMm.resolution
    ).toContain("unresolved")
    expect(reelSocketSelection.candidateSocketFacts.engineeringTargets).toMatchObject({
      initialPerContactResistanceMaximumMilliOhm: 50,
      postQualificationPerContactResistanceMaximumMilliOhm: 100,
      axialRetentionMinimumN: 30,
      matingCycles: 5000
    })
    expect(reelSocketSelection.sweatSaltExposurePlan.status).toBe("planned, not executed")
    expect(reelSocketSelection.physicalEvidenceGates.length).toBeGreaterThanOrEqual(6)
  })

  it("binds the selected component to acquired primary manufacturer evidence without treating it as plug-fit evidence", () => {
    const selected = reelSocketSelection.decision.selectedCandidate
    if (selected === null) throw new Error("M4-10 selected component is missing")

    expect(selected.primaryEvidence).toHaveLength(3)
    expect(selected.primaryEvidence.map((source) => source.kind)).toEqual([
      "manufacturer-item-data-sheet",
      "manufacturer-item-data-sheet",
      "manufacturer-main-catalogue"
    ])
    expect(selected.primaryEvidence[0]!.relevantPages).toEqual([1])
    expect(selected.primaryEvidence[1]!.relevantPages).toEqual([1])
    expect(selected.primaryEvidence[2]!.relevantPages).toEqual([6, 82])
    expect(selected.primaryEvidence.map((source) => [source.documentRevision, source.depictedOverallLengthMm])).toEqual(
      [
        ["02.2022", 30.5],
        ["02.2024", 30.7],
        ["Index O; 01.2026", 30.7]
      ]
    )
    expect(selected.primaryEvidence.map((source) => source.markers)).toEqual([
      ["02.2022", "30.5"],
      ["02.2024", "30.7"],
      ["01.2026", "23.3070-*", "22", "23", "30.7"]
    ])
    for (const source of selected.primaryEvidence) {
      const bytes = readFileSync(new URL(`../${source.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      expect(bytes.byteLength).toBe(source.contentLengthBytes)
      expect(source.sourceUrl).toMatch(/^https:\/\/(?:www\.staubli\.com|media\.ec\.staubli\.com)\//u)
    }
    expect(reelSocketSelection.centralApparatusPort.selectedSocketMechanicalFacts.overallLengthMm).toBeNull()
    expect(reelSocketSelection.centralApparatusPort.selectedSocketMechanicalFacts.overallLengthEvidence).toEqual([
      expect.objectContaining({ documentRevision: "02.2022", depictedOverallLengthMm: 30.5 }),
      expect.objectContaining({ documentRevision: "02.2024", depictedOverallLengthMm: 30.7 }),
      expect.objectContaining({ documentRevision: "Index O; 01.2026", depictedOverallLengthMm: 30.7 })
    ])
    expect(reelSocketSelection.manufacturerQueryHandoff.status).toBe("required-before-enclosure-or-footprint-release")
    expect(reelSocketSelection.manufacturerQueryHandoff.request).toHaveLength(5)
    expect(reelSocketSelection.manufacturerQueryHandoff.sampleMeasurement).toHaveLength(3)
    expect(selected.releaseLimitation).toContain("not a plug-fit")
    expect(reelSocketSelection.matingPlugStudy.fitEvidenceState).toBe("none collected; no release or purchase")
  })

  it("validates only the exact frozen data graph", () => {
    expect(validateReelSocketSelection(reelSocketSelection)).toBe(true)

    const copy = structuredClone(reelSocketSelection)
    expect(validateReelSocketSelection(copy)).toBe(true)

    replaceDataProperty(copy.decision.candidates[0], "mpn", "wrong-part")
    expect(validateReelSocketSelection(copy)).toBe(false)

    const relaxed = structuredClone(reelSocketSelection)
    replaceDataProperty(relaxed.candidateSocketFacts.engineeringTargets, "matingCycles", 100)
    expect(validateReelSocketSelection(relaxed)).toBe(false)
  })
})
