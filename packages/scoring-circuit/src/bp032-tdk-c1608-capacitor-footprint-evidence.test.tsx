import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorFootprints,
  validateBenchPrototypeProcessorFootprints
} from "./bench-prototype-processor-footprints.js"
import {
  Bp032TdkC1608CapacitorFootprint,
  bp032TdkC1608CapacitorFootprintEvidence,
  bp032TdkC1608FootprintEvidenceFor,
  validateBp032TdkC1608CapacitorFootprintEvidence
} from "./bp032-tdk-c1608-capacitor-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp032TdkC1608CapacitorFootprint />)) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isRectPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

function retainedBytes(path: string) {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

describe("BP-032 exact TDK C1608X5R1A105K080AC capacitor candidate footprint", () => {
  it("binds the exact MPN to C_ESP_EN_DELAY and keeps release denied", () => {
    expect(validateBp032TdkC1608CapacitorFootprintEvidence()).toEqual([])
    expect(bp032TdkC1608CapacitorFootprintEvidence).toMatchObject({
      artifactKind: "bp032-tdk-c1608-capacitor-footprint-evidence",
      workUnit: "BP-032",
      manufacturer: "TDK",
      exactPart: {
        manufacturerPartNumber: "C1608X5R1A105K080AC",
        value: "1 uF X5R, 10 V, ±10%",
        package: "0603",
        references: ["C_ESP_EN_DELAY"]
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      review: {
        status: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        exactSourcePagesVisuallyReviewed: true,
        projectGeometryAccepted: false
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    const row = benchPrototypeProcessorFootprints.processorSupportReferences.find(
      (candidate) => candidate.reference === "C_ESP_EN_DELAY"
    )
    expect(row).toMatchObject({
      reference: "C_ESP_EN_DELAY",
      mpn: "TBD",
      selectedMpn: "C1608X5R1A105K080AC",
      package: "0603",
      reconciliation: "selected-by-BP-123",
      evidence: { footprintEvidence: bp032TdkC1608FootprintEvidenceFor("C1608X5R1A105K080AC", "C_ESP_EN_DELAY") }
    })
  })

  it("hash-binds the exact TDK characterization and family land-pattern PDFs", () => {
    for (const source of bp032TdkC1608CapacitorFootprintEvidence.sources) {
      const bytes = retainedBytes(source.artifactPath)
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      expect(source.sha256).toMatch(/^[0-9A-F]{64}$/u)
    }
    const exactSource = bp032TdkC1608CapacitorFootprintEvidence.sources[0]
    expect(exactSource.pageBinding.markers).toEqual(
      expect.arrayContaining(["C1608X5R1A105K080AC", "C1608 [EIA CC0603]"])
    )
    const landSource = bp032TdkC1608CapacitorFootprintEvidence.sources[1]
    expect(landSource).toMatchObject({
      reviewedPages: [13],
      pageBinding: { retainedPdfPageCount: 30, landPatternPage: 13, printedPageLabel: "12" }
    })
  })

  it("records manufacturer land guidance separately from project review geometry", () => {
    expect(bp032TdkC1608CapacitorFootprintEvidence.manufacturerLandPattern).toMatchObject({
      sourceScope: "TDK C1608/CC0603 family-level reflow guidance",
      method: "reflow",
      A: { minimumMm: 0.6, maximumMm: 0.8 },
      B: { minimumMm: 0.6, maximumMm: 0.8 },
      C: { minimumMm: 0.6, maximumMm: 0.8 },
      disposition: "manufacturer-guidance-retained-project-input-not-manufacturer-cad"
    })
    expect(bp032TdkC1608CapacitorFootprintEvidence.projectFootprint).toMatchObject({
      state: "review-only",
      geometryAuthority: "project-review-input-derived-from-manufacturer-land-guidance",
      pads: [
        { pad: "1", xMm: -0.7, yMm: 0, widthMm: 0.7, heightMm: 0.7 },
        { pad: "2", xMm: 0.7, yMm: 0, widthMm: 0.7, heightMm: 0.7 }
      ],
      solderMask: { openingLengthMm: 0.8, openingWidthMm: 0.8, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.6, openingWidthMm: 0.6, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 2.4, widthMm: 1.3 },
      accepted: false,
      fabricationAuthority: "deny"
    })
    expect(bp032TdkC1608CapacitorFootprintEvidence.orientation).toMatchObject({
      state: "pending-independent-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null
    })
  })

  it("renders review-only copper, mask, paste, courtyard, and non-polar ports", () => {
    const json = renderTestCircuit(<Bp032TdkC1608CapacitorFootprint />)
    expect(json.filter(isRectSmtPad)).toHaveLength(2)
    expect(json.filter(isRectPaste)).toHaveLength(2)
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.3 })])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["pin2"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(renderedGeometryHash()).toBe(bp032TdkC1608CapacitorFootprintEvidence.artwork.sha256)
  })

  it("keeps the full BP-032 processor ledger valid", () => {
    expect(validateBenchPrototypeProcessorFootprints(benchPrototypeProcessorFootprints)).toBe(true)
  })
})
