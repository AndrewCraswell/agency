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
        overallLengthMm: 30.5,
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
    expect(reelSocketSelection.candidateSocketFacts.engineeringTargets).toMatchObject({
      initialPerContactResistanceMaximumMilliOhm: 50,
      postQualificationPerContactResistanceMaximumMilliOhm: 100,
      axialRetentionMinimumN: 30,
      matingCycles: 5000
    })
    expect(reelSocketSelection.sweatSaltExposurePlan.status).toBe("planned, not executed")
    expect(reelSocketSelection.physicalEvidenceGates.length).toBeGreaterThanOrEqual(6)
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
