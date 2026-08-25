import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorFootprints,
  validateBenchPrototypeProcessorFootprints
} from "./bench-prototype-processor-footprints.js"
import {
  Bp032YageoRc0603Fr07100KlFootprint,
  Bp032YageoRc0603Fr0710KlFootprint,
  bp032YageoRc0603FootprintEvidenceFor,
  bp032YageoRc0603ResistorFootprintEvidence,
  validateBp032YageoRc0603ResistorFootprintEvidence
} from "./bp032-yageo-rc0603-resistor-footprint-evidence.js"
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

function retainedBytes(path: string) {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

function renderedGeometryHash(component: ReactElement) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(component)) {
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

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function mutableClone(): Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence> {
  return structuredClone(bp032YageoRc0603ResistorFootprintEvidence) as unknown as Mutable<
    typeof bp032YageoRc0603ResistorFootprintEvidence
  >
}

describe("BP-032 exact Yageo RC0603 resistor candidate footprint", () => {
  it("binds both exact orderables to the 16 audited references", () => {
    expect(validateBp032YageoRc0603ResistorFootprintEvidence()).toEqual([])
    expect(bp032YageoRc0603ResistorFootprintEvidence).toMatchObject({
      artifactKind: "bp032-yageo-rc0603-resistor-footprint-evidence",
      workUnit: "BP-032",
      sourceContracts: ["BP-123", "BP-125", "BP-033"],
      manufacturer: "Yageo",
      affectedReferences: [
        "R_STM_WD_CWD",
        "R_ESP_WD_CWD",
        "R_STM_NRST_PULLUP",
        "R_ESP_EN_PULLUP",
        "R_APP_SUPERVISOR_RESET_PULLUP",
        "R_W5500_RESET_PULLUP",
        "R_STM_RESET_ISO_SERIES",
        "R_STM_RESET_GATE",
        "R_DEBUG_RESET_GATE",
        "R_STM_BOOT0",
        "R_ESP_BOOT_PULLUP",
        "R_STM_WDI_PULLUP",
        "R_ESP_WDI_PULLUP",
        "R_STM_RESET_ISO_PD",
        "R_STM_RESET_GATE_PD",
        "R_DEBUG_RESET_GATE_PD"
      ],
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
    expect(bp032YageoRc0603ResistorFootprintEvidence.exactParts).toEqual([
      expect.objectContaining({
        manufacturerPartNumber: "RC0603FR-0710KL",
        resistanceOhms: 10000,
        sourceOwner: "BP-125",
        references: expect.arrayContaining(["R_STM_BOOT0", "R_ESP_EN_PULLUP"])
      }),
      expect.objectContaining({
        manufacturerPartNumber: "RC0603FR-07100KL",
        resistanceOhms: 100000,
        sourceOwner: "BP-033",
        references: expect.arrayContaining(["R_STM_WDI_PULLUP", "R_DEBUG_RESET_GATE_PD"])
      })
    ])
  })

  it("hash-binds only the exact retained official BP-125 and BP-033 PDFs", () => {
    for (const source of bp032YageoRc0603ResistorFootprintEvidence.sources) {
      const bytes = retainedBytes(source.artifactPath)
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      const bytesAsLatin1 = bytes.toString("latin1")
      expect(bytesAsLatin1).toContain(source.manufacturerPartNumber)
      expect(source.pageBinding.markers).toEqual(expect.arrayContaining([source.manufacturerPartNumber]))
      const otherSource = bp032YageoRc0603ResistorFootprintEvidence.sources.find(
        (candidate) => candidate.id !== source.id
      )
      if (otherSource === undefined) throw new Error("exact Yageo source fixtures are incomplete")
      expect(bytesAsLatin1).not.toContain(otherSource.manufacturerPartNumber)
    }
    expect(bp032YageoRc0603ResistorFootprintEvidence.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerWorkUnit: "BP-125", manufacturerPartNumber: "RC0603FR-0710KL" }),
        expect.objectContaining({ ownerWorkUnit: "BP-033", manufacturerPartNumber: "RC0603FR-07100KL" })
      ])
    )
  })

  it("keeps manufacturer land-pattern and CAD claims absent while deriving review geometry", () => {
    expect(bp032YageoRc0603ResistorFootprintEvidence.manufacturerLandPattern).toMatchObject({
      sourceScope: "retained exact-part product specifications; land-pattern guidance not published",
      copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published", lengthMm: null, widthMm: null }
    })
    expect(bp032YageoRc0603ResistorFootprintEvidence.projectFootprint).toMatchObject({
      state: "review-only",
      geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
      pads: [
        { pad: "1", terminal: "A", xMm: -0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 },
        { pad: "2", terminal: "B", xMm: 0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 }
      ],
      solderMask: { openingLengthMm: 1, openingWidthMm: 1, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.8, openingWidthMm: 0.8, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 2.4, widthMm: 1.4 },
      accepted: false,
      fabricationAuthority: "deny"
    })
    expect(bp032YageoRc0603ResistorFootprintEvidence.orientation).toMatchObject({
      state: "pending-independent-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null
    })
  })

  it.each([
    ["RC0603FR-0710KL", <Bp032YageoRc0603Fr0710KlFootprint />],
    ["RC0603FR-07100KL", <Bp032YageoRc0603Fr07100KlFootprint />]
  ])("renders exact %s project copper, mask, paste, courtyard, and ports", (mpn, component) => {
    const json = renderTestCircuit(component)
    expect(json.filter(isRectSmtPad)).toHaveLength(2)
    expect(json.filter(isRectPaste)).toHaveLength(2)
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.4 })])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["pin2"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(mpn).toBeTruthy()
  })

  it("binds the rendered review artwork digest and reconciles all 16 BP-032 ledger rows", () => {
    const tenKJson = renderTestCircuit(<Bp032YageoRc0603Fr0710KlFootprint />)
    const hundredKJson = renderTestCircuit(<Bp032YageoRc0603Fr07100KlFootprint />)
    expect(renderedGeometryHash(<Bp032YageoRc0603Fr0710KlFootprint />)).toBe(
      bp032YageoRc0603ResistorFootprintEvidence.artwork.sha256
    )
    expect(renderedGeometryHash(<Bp032YageoRc0603Fr07100KlFootprint />)).toBe(
      bp032YageoRc0603ResistorFootprintEvidence.artwork.sha256
    )
    expect(tenKJson.filter(isRectSmtPad)).toHaveLength(2)
    expect(hundredKJson.filter(isRectSmtPad)).toHaveLength(2)
    expect(validateBenchPrototypeProcessorFootprints(benchPrototypeProcessorFootprints)).toBe(true)
    for (const binding of bp032YageoRc0603ResistorFootprintEvidence.referenceBindings) {
      const row =
        benchPrototypeProcessorFootprints.processorSupportReferences.find(
          (candidate) => candidate.reference === binding.reference
        ) ??
        benchPrototypeProcessorFootprints.populatedReferences.find(
          (candidate) => candidate.reference === binding.reference
        )
      expect(row).toMatchObject({
        reference: binding.reference,
        mpn: binding.manufacturerPartNumber,
        evidence: {
          footprintEvidence: bp032YageoRc0603FootprintEvidenceFor(binding.manufacturerPartNumber, binding.reference)
        }
      })
    }
  })

  it.each([
    [
      "exact MPN",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.exactParts[0], "manufacturerPartNumber", "FORGED")
    ],
    [
      "cross-MPN reference binding",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.referenceBindings[0], "manufacturerPartNumber", "RC0603FR-07100KL")
    ],
    [
      "retained source hash",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "project geometry",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.projectFootprint.pads[0], "widthMm", 1)
    ],
    [
      "orientation",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.orientation, "polarity", "polar")
    ],
    [
      "manufacturer CAD disposition",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "artwork digest",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.artwork, "sha256", "0".repeat(64))
    ],
    [
      "forged root review",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) =>
        Reflect.set(copy.review, "projectGeometryAccepted", true)
    ],
    [
      "fabrication acceptance",
      (copy: Mutable<typeof bp032YageoRc0603ResistorFootprintEvidence>) => Reflect.set(copy, "accepted", true)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = mutableClone()
    mutate(copy)
    expect(
      validateBp032YageoRc0603ResistorFootprintEvidence(
        copy as unknown as typeof bp032YageoRc0603ResistorFootprintEvidence
      )
    ).not.toEqual([])
  })
})
