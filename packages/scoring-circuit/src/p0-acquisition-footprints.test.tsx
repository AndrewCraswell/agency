import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import {
  P0Ada4177Footprint,
  P0Ads8881Footprint,
  P0Ref5025Footprint,
  P0Sn74Hcs595Footprint,
  P0T521BFootprint,
  P0Tpd4e05u06Footprint,
  P0Tps60400Footprint,
  P0Tmux1208Footprint,
  p0AcquisitionFootprintEvidence,
  validateP0AcquisitionFootprintEvidence
} from "./p0-acquisition-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isSmtPad(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_smtpad"; shape: "rect" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isCourtyard(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

const cases = [
  ["TPD4E05U06DQAR", <P0Tpd4e05u06Footprint name="U_TEST" />, 10, 0.5, 0.835, 1.9, 3.1],
  ["TMUX1208PWR", <P0Tmux1208Footprint name="U_TEST" />, 16, 0.65, 5.8, 7.8, 5.6],
  ["SN74HCS595PWR", <P0Sn74Hcs595Footprint name="U_TEST" />, 16, 0.65, 5.8, 7.8, 5.6],
  ["ADS8881IDGS", <P0Ads8881Footprint name="U_TEST" />, 10, 0.5, 4.4, 6.35, 3.6],
  ["REF5025AQDRQ1", <P0Ref5025Footprint name="U_TEST" />, 8, 1.27, 5.4, 7.45, 5.5],
  ["ADA4177-1ARZ", <P0Ada4177Footprint name="U_TEST" />, 8, 1.27, 4.93, 5.5, 7.41],
  ["TPS60400DBVR", <P0Tps60400Footprint name="U_TEST" />, 5, 0.95, 2.6, 4.2, 3.55],
  ["T521B106M025ATE100", <P0T521BFootprint name="U_TEST" />, 2, 2.9, 2.9, 4.2, 3.3]
] as const satisfies readonly [string, ReactElement, number, number, number, number, number][]

describe("P0-06 acquisition footprints", () => {
  it("keeps every footprint placement record internally consistent", () => {
    expect(validateP0AcquisitionFootprintEvidence()).toEqual([])
    expect(p0AcquisitionFootprintEvidence.placementState).toBe("approved")
    expect(p0AcquisitionFootprintEvidence.placementReviewer).toBe("root-final-reviewer")
    expect(p0AcquisitionFootprintEvidence.fabricationAuthority).toBe("deny")
  })

  it.each(cases)(
    "renders the %s footprint with the reviewed pad geometry",
    (_mpn, element, padCount, pitch, rowSpan, courtyardWidth, courtyardHeight) => {
      const rendered = renderTestCircuit(element)
      expect(rendered.filter((item) => item.type.endsWith("_error"))).toEqual([])
      const pads = rendered.filter(isSmtPad)
      expect(pads).toHaveLength(padCount)
      expect(pads[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) })
      const xCoordinates = [...new Set(pads.map((pad) => pad.x))].sort((a, b) => a - b)
      const minimumX = xCoordinates[0]
      const maximumX = xCoordinates.at(-1)
      if (minimumX === undefined || maximumX === undefined) throw new Error("footprint has no x coordinates")
      expect(Math.abs(maximumX - minimumX)).toBeGreaterThanOrEqual(rowSpan - pitch)
      expect(Math.max(courtyardWidth, courtyardHeight)).toBeGreaterThan(0)
      expect(rendered.filter(isCourtyard)).toEqual([
        expect.objectContaining({ width: courtyardWidth, height: courtyardHeight, center: { x: 0, y: 0 } })
      ])
    }
  )

  it("binds the exact manufacturer evidence and retains review-only authority", () => {
    expect(p0AcquisitionFootprintEvidence.components.TPD4E05U06DQAR.source).toMatchObject({
      retainedArtifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf",
      retainedSha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
      reviewedPdfPages: [4, 20, 28, 29, 30, 37]
    })
    expect(p0AcquisitionFootprintEvidence.components.TMUX1208PWR.source).toMatchObject({
      retainedArtifactPath: "packages/scoring-circuit/docs/evidence/p0-06/ti-tmux1208-scds389c-rev-c.pdf",
      retainedSha256: "C2683E83F693C8D94472063003F391C52F5390BD44F558F1CE18079C615B10D3",
      reviewedPdfPages: [3, 34, 35]
    })
    expect(p0AcquisitionFootprintEvidence.components.SN74HCS595PWR.source).toMatchObject({
      retainedArtifactPath: "packages/scoring-circuit/docs/evidence/p0-06/ti-sn74hcs595-scls803b-rev-b.pdf",
      retainedSha256: "6B173EC05957620F336AD80DCF344B558A53BBDF7764AB349B6DBE27ADDA6E88",
      reviewedPdfPages: [3, 31, 32]
    })
    expect(p0AcquisitionFootprintEvidence.components.REF5025AQDRQ1.source).toMatchObject({
      evidenceGap: expect.stringContaining("does not publish a dedicated PCB land pattern")
    })
    expect(p0AcquisitionFootprintEvidence.components.REF5025AQDRQ1.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin: 1, name: "DNC" }),
        expect.objectContaining({ pin: 8, name: "DNC" })
      ])
    )
    expect(p0AcquisitionFootprintEvidence.resistors.sourceAndSink470).toMatchObject({
      manufacturerPartNumber: "TNPW0603470RBEEA",
      resistanceOhms: 470,
      tolerancePercent: 0.1,
      temperatureCoefficientPpmPerK: 25,
      package: "TNPW0603 e3 / 0603 (1608 metric)"
    })
  })
})
