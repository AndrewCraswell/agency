import { describe, expect, it } from "vitest"
import { reelSocketSelection, validateReelSocketSelection } from "./reel-socket-selection.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M4-10 reel-socket selection", () => {
  it("freezes the deny-until-evidence study without falsely selecting a socket", () => {
    expect(Object.isFrozen(reelSocketSelection)).toBe(true)
    expect(Object.isFrozen(reelSocketSelection.decision)).toBe(true)
    expect(Object.isFrozen(reelSocketSelection.decision.candidates)).toBe(true)
    expect(reelSocketSelection.workUnit).toBe("M4-10")
    expect(reelSocketSelection.releaseState).toBe("deny")
    expect(reelSocketSelection.procurementAuthorized).toBe(false)
    expect(reelSocketSelection.decision.status).toBe("unresolved")
    expect(reelSocketSelection.decision.selectedCandidate).toBeNull()
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
      expect.objectContaining({ apparatusPosition: "left", requestedColor: "Red", colorSuffix: null }),
      expect.objectContaining({ apparatusPosition: "right", requestedColor: "Blue", colorSuffix: null })
    ])
  })

  it("keeps the FIE geometry and qualification targets explicit", () => {
    expect(reelSocketSelection.normativeInterface).toMatchObject({
      plugPins: 3,
      pinDiameterMm: 4,
      arrangement: "straight line",
      outerPinOffsetFromCentreMm: [15, 20]
    })
    expect(reelSocketSelection.candidateSocketFacts.manufacturerPublished.contactResistanceMilliOhm).toBeNull()
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
