import { describe, expect, it } from "vitest"
import {
  bp032Ftsh10501LDv007KFootprintEvidence,
  validateBp032Ftsh10501LDv007KFootprintEvidence
} from "./bp032-ftsh-105-01-l-dv-007-k-footprint.js"

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function mutableClone(): Mutable<typeof bp032Ftsh10501LDv007KFootprintEvidence> {
  return structuredClone(bp032Ftsh10501LDv007KFootprintEvidence) as Mutable<
    typeof bp032Ftsh10501LDv007KFootprintEvidence
  >
}

describe("BP-032 Samtec FTSH-105-01-L-DV-007-K footprint evidence", () => {
  it("binds J_STM_SWD to the exact 2x5 keyed orderable", () => {
    const { connector } = bp032Ftsh10501LDv007KFootprintEvidence
    expect(connector.manufacturerPartNumber).toBe("FTSH-105-01-L-DV-007-K")
    expect(connector.exactOrderableCode).toMatchObject({
      positionsPerRow: 5,
      leadStyle: "01",
      leadLengthMm: 3.05,
      plating: "L: 10 microinch selective gold contact area, matte tin tail",
      tailOption: "DV: double vertical",
      omittedPosition: 7,
      keyingOption: "K: keying notch for mating with FFSD"
    })
    expect(connector.package).toMatchObject({
      positions: 10,
      rows: 2,
      populatedPads: 9,
      pitchMm: 1.27,
      rowCenterSpanMm: 3.429,
      orientation: "vertical",
      termination: "surface-mount",
      omittedPins: [7],
      pinNumbering: "pin 1 lower-left, pin 2 upper-left, then odd pins on lower row and even pins on upper row"
    })
  })

  it("retains the BP-124 pin order and pin-one datum", () => {
    expect(bp032Ftsh10501LDv007KFootprintEvidence.reference).toBe("J_STM_SWD")
    expect(bp032Ftsh10501LDv007KFootprintEvidence.pinMap).toEqual([
      { pin: 1, signal: "SCORING_3V3_SENSE", direction: "adapter-sense", electricalClass: "sense-only" },
      { pin: 2, signal: "SWDIO", direction: "bidirectional", electricalClass: "3V3_CMOS" },
      { pin: 3, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
      { pin: 4, signal: "SWCLK", direction: "adapter-to-target", electricalClass: "3V3_CMOS" },
      { pin: 5, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
      { pin: 6, signal: "NC_SWD_SWO_RESERVED", direction: "not-connected", electricalClass: "unconnected" },
      { pin: 8, signal: "NC_SWD_RESERVED", direction: "not-connected", electricalClass: "unconnected" },
      { pin: 9, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
      { pin: 10, signal: "SCORING_NRST_N", direction: "adapter-open-drain-sink", electricalClass: "3V3_RESET" }
    ])
    expect(bp032Ftsh10501LDv007KFootprintEvidence.projectFootprint.pinOne).toMatchObject({
      pad: 1,
      orientationStatus: "pending-independent-review"
    })
  })

  it("retains the reviewed manufacturer pages and immutable source identities", () => {
    expect(bp032Ftsh10501LDv007KFootprintEvidence.manufacturerLandPattern.sourceDocuments).toEqual([
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-vertical-smt-footprint.pdf",
        sha256: "CAA205B92560423F3B0AEA9C69D6C38340D1B7F01B0655092994450E935EDCB3",
        printedPages: [1, 2]
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-vertical-smt-print.pdf",
        sha256: "EF2961377445B9AD10762EA27519E7B59E5CBB5847DC0058D8E35C0D97C446A3",
        printedPages: [1, 2]
      },
      {
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-smt-catalog.pdf",
        sha256: "F918233908DD8D2FC733C6BBF6582018BE9ACAD50F1E193C27F8DC1E734EE754",
        printedPages: [1]
      }
    ])
    expect(bp032Ftsh10501LDv007KFootprintEvidence.mating.source).toMatchObject({
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-ffsd-05-d-06-00-01-n.html",
      sha256: "F5E68A077171E9C38D26D812B440138A236E6145167EA4914F82D1D8956D7933"
    })
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence()).toEqual([])
  })

  it("records the nine-pad manufacturer geometry and denies downstream rules", () => {
    expect(bp032Ftsh10501LDv007KFootprintEvidence.manufacturerLandPattern.copper).toEqual({
      padCount: 9,
      padWidthMm: 0.5334,
      padLengthMm: 2.794,
      padPitchMm: 1.27,
      rowCenterSpanMm: 3.429,
      omittedPin: 7,
      dimensions: {
        padWidth: "0.021 in [0.53 mm] derived from 0.050 in [1.27 mm] pitch minus 0.029 in [0.74 mm] inter-pad gap",
        padLength: "0.110 in [2.79 mm]"
      }
    })
    expect(bp032Ftsh10501LDv007KFootprintEvidence.manufacturerLandPattern.solderMask.authority).toBe("deny")
    expect(bp032Ftsh10501LDv007KFootprintEvidence.manufacturerLandPattern.paste.authority).toBe("deny")
    expect(bp032Ftsh10501LDv007KFootprintEvidence.manufacturerLandPattern.courtyard.authority).toBe("deny")
    expect(bp032Ftsh10501LDv007KFootprintEvidence.projectFootprint).toMatchObject({
      state: "review-only",
      omittedPins: [7],
      accepted: false,
      fabricationAuthority: "deny",
      pinOne: {
        pad: 1,
        datum: "zero board rotation, lower-left pad in the Samtec top-view convention",
        orientationStatus: "pending-independent-review"
      },
      solderMask: { state: "review-only", authority: "deny" },
      paste: { state: "review-only", authority: "deny" },
      courtyard: { state: "review-only", authority: "deny" },
      artwork: { state: "not-generated", authority: "deny" }
    })
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence()).toEqual([])
  })

  it("reconciles the exact FFSD mating candidate from BP-124", () => {
    expect(bp032Ftsh10501LDv007KFootprintEvidence.mating).toMatchObject({
      manufacturer: "Samtec",
      manufacturerPartNumber: "FFSD-05-D-06.00-01-N",
      positions: 10,
      rows: 2,
      pitchMm: 1.27,
      lengthInches: 6,
      polarization: "keyed"
    })
    expect(bp032Ftsh10501LDv007KFootprintEvidence.mating.source.sha256).toMatch(/^[0-9A-F]{64}$/u)
  })

  it("fails closed on source, pad, mating, and CAD drift", () => {
    const sourceDrift = mutableClone()
    sourceDrift.manufacturerLandPattern.sourceDocuments[0].sha256 = "0".repeat(64)
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence(sourceDrift)).toContain(
      "retained Samtec drawing identity drifted"
    )

    const padDrift = mutableClone()
    padDrift.projectFootprint.pads[0].signal = "WRONG"
    padDrift.projectFootprint.pads[1].pin = 1
    padDrift.projectFootprint.pinOne.orientationStatus = "approved"
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence(padDrift)).toEqual(
      expect.arrayContaining([
        "project footprint pin 1 signal drifted",
        "project footprint contains duplicate pin 1",
        "pin-one datum and orientation must remain pending independent review"
      ])
    )

    const gateDrift = mutableClone()
    gateDrift.manufacturerCad.authority = "allow"
    gateDrift.mating.manufacturerPartNumber = "WRONG"
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence(gateDrift)).toEqual(
      expect.arrayContaining([
        "manufacturer CAD must remain denied and unacquired",
        "exact FFSD mating identity or geometry drifted"
      ])
    )
  })

  it("fails closed on exact package, source-page, orientation, and downstream-rule drift", () => {
    const packageDrift = mutableClone()
    packageDrift.connector.package.rows = 1
    packageDrift.connector.exactOrderableCode.omittedPosition = 6
    packageDrift.manufacturerLandPattern.sourceDocuments[0].printedPages[0] = 3
    packageDrift.projectFootprint.pinOne.datum = "rotated"
    packageDrift.projectFootprint.solderMask.authority = "allow"
    packageDrift.projectFootprint.paste.state = "released"
    packageDrift.projectFootprint.courtyard.authority = "allow"
    const errors = validateBp032Ftsh10501LDv007KFootprintEvidence(packageDrift)
    expect(errors).toEqual(
      expect.arrayContaining([
        "exact 2x5 orderable code, omitted pin, or keying drifted",
        "2x5 package, omitted pin, key, or orientation identity drifted",
        "retained Samtec drawing identity drifted",
        "pin-one datum and orientation must remain pending independent review",
        "project mask, paste, courtyard, and artwork dispositions must remain denied"
      ])
    )
  })

  it("fails closed when any upstream BP-124 identity binding changes", () => {
    const upstreamDrift = mutableClone()
    upstreamDrift.sourceControl.upstreamSources[2].sha256 = "0".repeat(64)
    expect(validateBp032Ftsh10501LDv007KFootprintEvidence(upstreamDrift)).toContain(
      "BP-124 upstream source bindings drifted"
    )
  })
})
