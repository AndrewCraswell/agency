import { describe, expect, it } from "vitest"
import {
  bp034DirectWireWeaponFootprint,
  Bp034DirectWireWeaponFootprint,
  validateBp034DirectWireWeaponFootprint
} from "./bp034-direct-wire-weapon-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderedFootprint() {
  return renderTestCircuit(<Bp034DirectWireWeaponFootprint />)
}

function hasHoleDiameter(value: unknown): value is { readonly hole_diameter: number } {
  return (
    typeof value === "object" && value !== null && "hole_diameter" in value && typeof value.hole_diameter === "number"
  )
}

describe("BP-034 direct-wire weapon footprint", () => {
  it("derives all six named solder landings and six separate labeled test points from the direct-wire contract", () => {
    expect(validateBp034DirectWireWeaponFootprint()).toBe(true)
    expect(bp034DirectWireWeaponFootprint).toMatchObject({
      workUnit: "BP-034",
      prototypeOnly: true,
      derivedFrom: { geometryAuthority: "project-derived-review-input-not-manufacturer-cad" },
      review: {
        state: "root-approved-p0-interface",
        reviewer: "root-final-reviewer",
        projectGeometryAccepted: true,
        orientationAccepted: true,
        physicalEvidenceAccepted: false
      },
      normalPower: { interface: "USB-C PD", unchanged: true },
      solderLandings: { count: 6, pitchMm: 3.81 },
      testPoints: { count: 6, placement: expect.stringContaining("separate labeled") },
      strainReliefAnchors: { count: 4, material: "non-plated-through-hole cable-tie anchor pair per pigtail" },
      boardImport: { state: "accepted-p0" },
      physicalEvidence: { state: "open" },
      productionSocket: { state: "open" },
      fabricationAuthority: "p0-only",
      releaseState: "accepted-p0"
    })
    expect(bp034DirectWireWeaponFootprint.solderLandings.entries).toEqual([
      expect.objectContaining({
        boardNet: "LEFT_WEAPON_A",
        landingPadReference: "P_WEAPON_L_A",
        boardLabel: "LEFT WEAPON A"
      }),
      expect.objectContaining({
        boardNet: "LEFT_WEAPON_B",
        landingPadReference: "P_WEAPON_L_B",
        boardLabel: "LEFT WEAPON B"
      }),
      expect.objectContaining({
        boardNet: "LEFT_WEAPON_C",
        landingPadReference: "P_WEAPON_L_C",
        boardLabel: "LEFT WEAPON C"
      }),
      expect.objectContaining({
        boardNet: "RIGHT_WEAPON_A",
        landingPadReference: "P_WEAPON_R_A",
        boardLabel: "RIGHT WEAPON A"
      }),
      expect.objectContaining({
        boardNet: "RIGHT_WEAPON_B",
        landingPadReference: "P_WEAPON_R_B",
        boardLabel: "RIGHT WEAPON B"
      }),
      expect.objectContaining({
        boardNet: "RIGHT_WEAPON_C",
        landingPadReference: "P_WEAPON_R_C",
        boardLabel: "RIGHT WEAPON C"
      })
    ])
    expect(bp034DirectWireWeaponFootprint.testPoints.entries.map((entry) => entry.testPadReference)).toEqual([
      "TP_WEAPON_L_A",
      "TP_WEAPON_L_B",
      "TP_WEAPON_L_C",
      "TP_WEAPON_R_A",
      "TP_WEAPON_R_B",
      "TP_WEAPON_R_C"
    ])
  })

  it("renders six electrical solder PTHs, six separate electrical test PTHs, and four non-electrical anchors", () => {
    const json = renderedFootprint()
    const source = json.find((element) => element.type === "source_component" && element.name === "J_WEAPON_DIRECT")
    expect(source).toMatchObject({ manufacturer_part_number: undefined })
    const platedHoles = json.filter((element) => element.type === "pcb_plated_hole")
    const mechanicalHoles = json.filter((element) => element.type === "pcb_hole")
    expect(platedHoles).toHaveLength(12)
    expect(mechanicalHoles).toHaveLength(4)
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)

    const landingHoles = platedHoles.filter((hole) => hasHoleDiameter(hole) && hole.hole_diameter === 1.3)
    const testHoles = platedHoles.filter((hole) => hasHoleDiameter(hole) && hole.hole_diameter === 1)
    expect(landingHoles).toHaveLength(6)
    expect(testHoles).toHaveLength(6)
    expect(landingHoles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 0, y: 0, rect_pad_width: 2.8, rect_pad_height: 2.8 }),
        expect.objectContaining({ x: 3.81, y: 0, rect_pad_width: 2.8, rect_pad_height: 2.8 }),
        expect.objectContaining({ x: 7.62, y: 0, rect_pad_width: 2.8, rect_pad_height: 2.8 }),
        expect.objectContaining({ x: 0, y: 18, rect_pad_width: 2.8, rect_pad_height: 2.8 }),
        expect.objectContaining({ x: 3.81, y: 18, rect_pad_width: 2.8, rect_pad_height: 2.8 }),
        expect.objectContaining({ x: 7.62, y: 18, rect_pad_width: 2.8, rect_pad_height: 2.8 })
      ])
    )
    expect(testHoles.map((hole) => hole.y).toSorted((left, right) => left - right)).toEqual([5, 5, 5, 23, 23, 23])
    expect(mechanicalHoles.filter(hasHoleDiameter)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hole_diameter: 3.2 }),
        expect.objectContaining({ hole_diameter: 3.2 }),
        expect.objectContaining({ hole_diameter: 3.2 }),
        expect.objectContaining({ hole_diameter: 3.2 })
      ])
    )
    expect(
      json
        .filter((element) => element.type === "source_port")
        .filter((port) => port.name.endsWith("_TEST"))
        .map((port) => port.name)
        .toSorted()
    ).toEqual([
      "LEFT_WEAPON_A_TEST",
      "LEFT_WEAPON_B_TEST",
      "LEFT_WEAPON_C_TEST",
      "RIGHT_WEAPON_A_TEST",
      "RIGHT_WEAPON_B_TEST",
      "RIGHT_WEAPON_C_TEST"
    ])
  })

  it("keeps project-derived wire, copper, probe, and anchor geometry conservative", () => {
    const footprint = bp034DirectWireWeaponFootprint
    expect(footprint.wireAssumption).toMatchObject({
      intendedConductor: "22 AWG stranded copper pigtail",
      permittedReviewRange: expect.stringContaining("20 to 24 AWG")
    })
    expect(footprint.solderLandings.platedThroughHole).toMatchObject({
      finishedHoleDiameterMm: 1.3,
      copperPadDiameterMm: 2.8,
      annularRingMm: 0.75,
      pasteOpeningDiameterMm: 0
    })
    expect(footprint.testPoints.platedThroughHole).toMatchObject({
      finishedHoleDiameterMm: 1,
      copperPadDiameterMm: 2.4,
      annularRingMm: 0.7,
      pasteOpeningDiameterMm: 0
    })
    expect(footprint.solderLandings.solderMaskWebMm).toBeGreaterThanOrEqual(
      footprint.constraints.projectMinimumSolderMaskBridgeMm
    )
    expect(footprint.testPoints.landingToTestPointClearanceMm).toBeGreaterThanOrEqual(
      footprint.testPoints.requiredProbeKeepoutMm
    )
    expect(footprint.strainReliefAnchors.minimumAnchorToLandingCopperClearanceMm).toBeGreaterThanOrEqual(
      footprint.constraints.projectMountingHoleCopperKeepoutMm
    )
    expect(footprint.strainReliefAnchors.loadPath).toContain("no pull or bend load")
  })

  it("fails closed if identity, electrical labels, clearance floors, or denied gates drift", () => {
    const labelDrift = structuredClone(bp034DirectWireWeaponFootprint)
    Reflect.set(labelDrift.testPoints.entries[0]!, "testPadReference", "TP_FORGED")
    expect(() => validateBp034DirectWireWeaponFootprint(labelDrift)).toThrow(RangeError)

    const clearanceDrift = structuredClone(bp034DirectWireWeaponFootprint)
    Reflect.set(clearanceDrift.solderLandings, "solderMaskWebMm", 0)
    expect(() => validateBp034DirectWireWeaponFootprint(clearanceDrift)).toThrow(RangeError)

    const authorityDrift = structuredClone(bp034DirectWireWeaponFootprint)
    Reflect.set(authorityDrift.boardImport, "state", "production")
    expect(() => validateBp034DirectWireWeaponFootprint(authorityDrift)).toThrow(RangeError)

    const forgedReview = structuredClone(bp034DirectWireWeaponFootprint)
    Reflect.set(forgedReview.review, "reviewer", "implementation-agent")
    expect(() => validateBp034DirectWireWeaponFootprint(forgedReview)).toThrow(RangeError)
  })
})
