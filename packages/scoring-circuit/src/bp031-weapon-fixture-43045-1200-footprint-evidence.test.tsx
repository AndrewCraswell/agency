import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031WeaponFixture430451200Footprint,
  bp031WeaponFixture430451200FootprintEvidence,
  validateBp031WeaponFixture430451200FootprintEvidence
} from "./bp031-weapon-fixture-43045-1200-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function sha256(path: URL) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase()
}

function renderedArtworkDigest() {
  const rendered = renderTestCircuit(<Bp031WeaponFixture430451200Footprint />)
  const geometry: Array<Record<string, unknown>> = []
  for (const element of rendered) {
    if (isPlatedHole(element)) {
      geometry.push({
        hole_diameter: element.hole_diameter,
        rect_border_radius: element.rect_border_radius,
        rect_pad_height: element.rect_pad_height,
        rect_pad_width: element.rect_pad_width,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        x: element.x,
        y: element.y
      })
    }
    if (isCircularHole(element)) {
      geometry.push({ hole_diameter: element.hole_diameter, type: element.type, x: element.x, y: element.y })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

type RenderedPlatedHole = CircuitElement & {
  readonly hole_diameter: number
  readonly rect_border_radius: number
  readonly rect_pad_height: number
  readonly rect_pad_width: number
  readonly type: "pcb_plated_hole"
}

type RenderedCircularHole = CircuitElement & { readonly hole_diameter: number; readonly type: "pcb_hole" }

function isPlatedHole(element: CircuitElement): element is RenderedPlatedHole {
  return (
    element.type === "pcb_plated_hole" &&
    "hole_diameter" in element &&
    "rect_border_radius" in element &&
    "rect_pad_height" in element &&
    "rect_pad_width" in element
  )
}

function isCircularHole(element: CircuitElement): element is RenderedCircularHole {
  return element.type === "pcb_hole" && "hole_diameter" in element
}

describe("BP-031 Molex 43045-1200 weapon-fixture footprint evidence", () => {
  it("hash-binds the exact retained Molex sources and canonical BP-031/BP-104 identity", () => {
    expect(validateBp031WeaponFixture430451200FootprintEvidence()).toBe(true)
    const { sources } = bp031WeaponFixture430451200FootprintEvidence
    expect(sha256(new URL("../docs/evidence/bp-104/assets/43045-1200-drawing.pdf", import.meta.url))).toBe(
      sources.manufacturerDrawing.sha256
    )
    expect(sha256(new URL("../docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf", import.meta.url))).toBe(
      sources.manufacturerCadPreview.sha256
    )
    expect(sha256(new URL("./bench-prototype-fixture-harness.ts", import.meta.url))).toBe(sources.bp104Identity.sha256)
    expect(sha256(new URL("./bench-prototype-analog-footprint-closure.ts", import.meta.url))).toBe(
      sources.bp031Identity.sha256
    )
    expect(sha256(new URL("./bench-prototype-connector-preorder.ts", import.meta.url))).toBe(
      sources.externalBoundary.sha256
    )
    expect(sha256(new URL("./bench-prototype-direct-wire-weapon-landing.ts", import.meta.url))).toBe(
      sources.prototypeHandoffBoundary.sha256
    )
    expect(bp031WeaponFixture430451200FootprintEvidence.canonicalIdentity).toMatchObject({
      sourceContract: "BP-104",
      boardReference: "J_WEAPON_FIXTURE",
      manufacturerPartNumber: "43045-1200",
      positions: 12,
      rows: 2,
      scope: "internal-bp104-fixture-harness-only"
    })
  })

  it("separates the internal 43045 fixture harness from the external three-banana interface", () => {
    const { interfaceBoundary } = bp031WeaponFixture430451200FootprintEvidence
    expect(interfaceBoundary.internalFixtureHarness).toMatchObject({
      boardReference: "J_WEAPON_FIXTURE",
      headerMpn: "43045-1200",
      internalMateMpn: "43025-1200",
      testPlugMpn: "44242-0005",
      populatedFixturePins: [1, 2, 3, 4, 5, 6, 7],
      unpopulatedFixturePins: [8, 9, 10, 11, 12],
      pisteFixturePin: 7,
      externalThreeBananaInterface: false
    })
    expect(interfaceBoundary.externalWeaponMating).toMatchObject({
      role: "per-side three-banana external weapon mating interface",
      supplier: "OK Fencing",
      conductorCount: 3,
      conductorOrder: ["A", "B", "C"],
      cableCompatibility: "owner-validated-compatible-with-existing-boxes",
      representedBy430451200: false,
      socketIdentity: null,
      boardEndConnectorIdentity: null,
      productionRequirement: "custom mechanically supported mating interface",
      productionStatus: "open",
      prototypeAllowedHandoffs: ["user-attached-sockets", "soldered-wires-or-pigtails"]
    })
    expect(interfaceBoundary.explicitNonEquivalence).toEqual([
      "Molex 43045-1200 is only the internal BP-104 J_WEAPON_FIXTURE board header.",
      "Molex 43025-1200 is only its internal fixture-harness receptacle mate.",
      "Neither Molex part is a three-banana external weapon socket, cable, or production mating interface.",
      "The validated OK Fencing cable does not select a board connector, socket MPN, footprint, or mechanical carrier."
    ])
  })

  it("locks circuit 1, the 12-circuit numbering, manufacturer holes, edge rule, and orientation", () => {
    const { manufacturerGeometry, orientation } = bp031WeaponFixture430451200FootprintEvidence
    expect(manufacturerGeometry.contactLayout.circuitOneDatum).toEqual({
      pin: 1,
      xMm: 0,
      yMm: 0,
      drawingMark: "CIRCUIT 1"
    })
    expect(manufacturerGeometry.contactLayout.pins).toEqual([
      { pin: 1, xMm: 0, yMm: 0 },
      { pin: 2, xMm: -3, yMm: 0 },
      { pin: 3, xMm: -6, yMm: 0 },
      { pin: 4, xMm: -9, yMm: 0 },
      { pin: 5, xMm: -12, yMm: 0 },
      { pin: 6, xMm: -15, yMm: 0 },
      { pin: 7, xMm: 0, yMm: -3 },
      { pin: 8, xMm: -3, yMm: -3 },
      { pin: 9, xMm: -6, yMm: -3 },
      { pin: 10, xMm: -9, yMm: -3 },
      { pin: 11, xMm: -12, yMm: -3 },
      { pin: 12, xMm: -15, yMm: -3 }
    ])
    expect(manufacturerGeometry.contactLayout.contactHoleDiameterMm).toEqual({ nominal: 1.02, tolerance: 0.05 })
    expect(manufacturerGeometry.retention).toMatchObject({
      holeDiameterMm: { nominal: 3, tolerance: 0.05 },
      contactToRetentionRowMm: { nominal: 4.32, tolerance: 0.08 },
      endInsetMm: { nominal: 2.15, tolerance: 0.05 },
      retentionHoleSpanMm: { nominal: 10.7, tolerance: 0.08 },
      holes: [
        { name: "retention-a", xMm: -2.15, yMm: 4.32 },
        { name: "retention-b", xMm: -12.85, yMm: 4.32 }
      ]
    })
    expect(manufacturerGeometry.bodyAndMating.boardEdgeRule.maximumDistanceMm).toBe(10.16)
    expect(manufacturerGeometry.bodyAndMating.mate).toMatchObject({ manufacturerPartNumber: "43025-1200" })
    expect(orientation).toMatchObject({
      boardRotationDegrees: 0,
      pinOne: { pin: 1, xMm: 0, yMm: 0 },
      polarizedToMate: true,
      latchLock: true,
      independentPhysicalReview: "pending"
    })
  })

  it("renders the bounded project artwork and locks its digest", () => {
    const rendered = renderTestCircuit(<Bp031WeaponFixture430451200Footprint />)
    const contacts = rendered.filter(isPlatedHole)
    expect(contacts).toHaveLength(12)
    expect(contacts.map(({ x, y, hole_diameter }) => ({ x, y, hole_diameter }))).toEqual(
      bp031WeaponFixture430451200FootprintEvidence.manufacturerGeometry.contactLayout.pins.map(({ xMm, yMm }) => ({
        x: xMm,
        y: yMm,
        hole_diameter: 1.02
      }))
    )
    expect(rendered.filter(isCircularHole)).toEqual([
      expect.objectContaining({ x: -2.15, y: 4.32, hole_diameter: 3 }),
      expect.objectContaining({ x: -12.85, y: 4.32, hole_diameter: 3 })
    ])
    expect(rendered.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(renderedArtworkDigest()).toBe(bp031WeaponFixture430451200FootprintEvidence.renderedArtwork.digest)
  })

  it("binds prototype-only solder handoff points, strain relief, and miswire gates", () => {
    const { prototypeHandoff, strainReliefAndMiswireGates } = bp031WeaponFixture430451200FootprintEvidence
    expect(prototypeHandoff).toMatchObject({
      state: "prototype-only-review-input",
      powerState: "off-and-discharged",
      perSide: [
        {
          side: "left",
          externalInterface: "LEFT_THREE_BANANA",
          boardHarnessReference: "J_WEAPON_HARNESS_L",
          fixturePins: [1, 2, 3],
          conductors: [
            { external: "A", boardNet: "LEFT_WEAPON_A", landingPoint: "P_WEAPON_L_A", testPoint: "TP_WEAPON_L_A" },
            { external: "B", boardNet: "LEFT_WEAPON_B", landingPoint: "P_WEAPON_L_B", testPoint: "TP_WEAPON_L_B" },
            { external: "C", boardNet: "LEFT_WEAPON_C", landingPoint: "P_WEAPON_L_C", testPoint: "TP_WEAPON_L_C" }
          ]
        },
        {
          side: "right",
          externalInterface: "RIGHT_THREE_BANANA",
          boardHarnessReference: "J_WEAPON_HARNESS_R",
          fixturePins: [4, 5, 6]
        }
      ],
      notThisFootprint: expect.stringContaining("not additional 43045 pads")
    })
    expect(prototypeHandoff.solderRule).toContain("de-energized board rework")
    expect(prototypeHandoff.solderRule).toContain("solder joints and plated holes must never carry pull or bend loads")
    expect(prototypeHandoff.forbidden).toEqual([
      "Do not solder an external banana socket or weapon cable to the 43045-1200 footprint as if it were a three-pin interface.",
      "Do not land a return, ground, shield, piste, or fourth conductor on an A/B/C prototype point.",
      "Do not use a temporary pigtail as a field-service or production connector."
    ])
    expect(strainReliefAndMiswireGates).toMatchObject({
      strainRelief: { required: true, status: "open", acceptance: "deny-until-photographed-and-physically-verified" },
      miswire: {
        requiredPowerState: "off-and-discharged",
        testPlugMpn: "44242-0005",
        requiredNegativeCases: ["BP104-NEG-SWAP", "BP104-NEG-OPEN", "BP104-NEG-RETURN-BOND", "BP104-NEG-REVERSED-MATE"],
        status: "open"
      }
    })
    expect(strainReliefAndMiswireGates.miswire.requiredScreens).toHaveLength(4)
  })

  it("keeps manufacturer evidence separate from project inputs and denies release", () => {
    const { acceptance, projectReviewInputs, sources } = bp031WeaponFixture430451200FootprintEvidence
    expect(sources.manufacturerCadPreview.disposition).toBe("exact-retained-cad-preview-not-footprint-approval")
    expect(projectReviewInputs).toMatchObject({
      copperForRenderedContacts: { status: "project-input-not-published-by-molex" },
      solderMaskForRenderedContacts: { status: "project-input-not-published-by-molex" },
      courtyard: { state: "not-selected" },
      boardPlacement: { state: "not-integrated" }
    })
    expect(acceptance).toMatchObject({
      accepted: false,
      fabricationAuthority: "deny",
      physicalAuthority: "deny",
      mechanicalAuthority: "deny",
      externalMatingAuthority: "deny"
    })
    expect(Object.isFrozen(bp031WeaponFixture430451200FootprintEvidence)).toBe(true)
    expect(Object.isFrozen(bp031WeaponFixture430451200FootprintEvidence.interfaceBoundary)).toBe(true)
    expect(Object.isFrozen(bp031WeaponFixture430451200FootprintEvidence.prototypeHandoff)).toBe(true)
    expect(() => validateBp031WeaponFixture430451200FootprintEvidence({})).toThrow(RangeError)
  })

  it.each([
    [
      "promotes the internal header to the external interface",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.interfaceBoundary.internalFixtureHarness, "externalThreeBananaInterface", true)
    ],
    [
      "binds the external interface to the 43045 header",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.interfaceBoundary.externalWeaponMating, "representedBy430451200", true)
    ],
    [
      "adds a socket MPN that was not sourced",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.interfaceBoundary.externalWeaponMating, "socketIdentity", "UNREVIEWED")
    ],
    [
      "moves the solder handoff onto the footprint",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.prototypeHandoff, "notThisFootprint", "43045 pads are external solder points")
    ],
    [
      "accepts external mechanical evidence",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.acceptance, "mechanicalAuthority", "accept")
    ],
    [
      "changes the retained geometry",
      (copy: typeof bp031WeaponFixture430451200FootprintEvidence) =>
        Reflect.set(copy.manufacturerGeometry.retention.holes[0], "xMm", -2.05)
    ]
  ])("rejects an adversarial drift that %s", (_name, mutate) => {
    const copy = structuredClone(bp031WeaponFixture430451200FootprintEvidence)
    mutate(copy)
    expect(() => validateBp031WeaponFixture430451200FootprintEvidence(copy)).toThrow(RangeError)
  })

  it("keeps the frozen public graph independent while rejecting a cloned adversarial graph", () => {
    expect(Object.isFrozen(bp031WeaponFixture430451200FootprintEvidence)).toBe(true)
    const copy = structuredClone(bp031WeaponFixture430451200FootprintEvidence)
    expect(validateBp031WeaponFixture430451200FootprintEvidence(copy)).toBe(true)
    expect(copy).not.toBe(bp031WeaponFixture430451200FootprintEvidence)
    expect(Object.isFrozen(copy)).toBe(false)
    Reflect.set(copy.interfaceBoundary.externalWeaponMating, "conductorCount", 4)
    expect(() => validateBp031WeaponFixture430451200FootprintEvidence(copy)).toThrow(RangeError)
    expect(bp031WeaponFixture430451200FootprintEvidence.interfaceBoundary.externalWeaponMating.conductorCount).toBe(3)
    expect(validateBp031WeaponFixture430451200FootprintEvidence()).toBe(true)
  })
})
