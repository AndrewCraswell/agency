import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031032C0603C104K3RactuFootprintEvidence,
  bp031032C0603C104K3RactuFootprintEvidence,
  bp031032C0603C104K3RactuFootprintEvidenceFor,
  validateBp031032C0603C104K3RactuFootprintEvidence
} from "./bp031-032-c0603c104k3ractu-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
const expectedRenderedArtworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"

function renderProjectFootprint() {
  return renderTestCircuit(<Bp031032C0603C104K3RactuFootprintEvidence />)
}

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
  for (const element of renderProjectFootprint()) {
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
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
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
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

function retainedBytes(path: string) {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function mutableClone(): Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence> {
  return structuredClone(bp031032C0603C104K3RactuFootprintEvidence) as unknown as Mutable<
    typeof bp031032C0603C104K3RactuFootprintEvidence
  >
}

describe("BP-031/BP-032 exact C0603C104K3RACTU footprint evidence", () => {
  it("binds the exact MPN, package, and complete cross-work-unit reference sets", () => {
    expect(validateBp031032C0603C104K3RactuFootprintEvidence()).toEqual([])
    expect(bp031032C0603C104K3RactuFootprintEvidence).toMatchObject({
      artifactKind: "bp031-032-c0603c104k3ractu-footprint-evidence",
      workUnits: ["BP-031", "BP-032"],
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0603C104K3RACTU",
      package: {
        designation: "0603 (1608 metric) ceramic chip capacitor",
        caseSize: "EIA 0603 / IEC 1608",
        dielectric: "X7R",
        capacitanceNf: 100,
        tolerancePercent: 10,
        ratedVoltageVdc: 25
      },
      affectedReferences: [
        "C_REF_REG_HF_1",
        "C_REF_REG_HF_2",
        "C_REF_REG_HF_3",
        "C_REF_REG_HF_4",
        "C_REF_REG_HF_5",
        "C_REF_REG_HF_6",
        "C_REF_REG_HF_7",
        "C_STM_SUPERVISOR_CT",
        "C_STM_SUPERVISOR_BYPASS",
        "C_STM_WD_BYPASS",
        "C_STM_NRST_FILTER",
        "C_ESP_SUPERVISOR_CT",
        "C_ESP_SUPERVISOR_BYPASS",
        "C_ESP_WD_BYPASS",
        "C_APP_RESET_FANOUT_BYPASS"
      ],
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("hash-binds the retained exact-part PDF, PDF page, and canonical upstream sources", () => {
    const source = bp031032C0603C104K3RactuFootprintEvidence.sources[0]
    expect(source).toMatchObject({
      id: "yageo-kemet-c0603c104k3ractu-datasheet",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
      sha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
      reviewedPages: [1],
      pageBinding: {
        retainedPdfPageCount: 4,
        exactOrderablePdfPage: 1,
        printedPageLabel: "1",
        manufacturerPartNumber: "C0603C104K3RACTU",
        package: "0603 / 1608"
      }
    })
    expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
      source.sha256
    )
    for (const upstream of bp031032C0603C104K3RactuFootprintEvidence.sourceControl.upstreamSources) {
      expect(createHash("sha256").update(retainedBytes(upstream.path)).digest("hex")).toBe(upstream.sha256)
    }
  })

  it("keeps manufacturer land guidance absent and project mask, paste, and courtyard explicit", () => {
    expect(bp031032C0603C104K3RactuFootprintEvidence.manufacturerLandPattern).toMatchObject({
      sourceScope: "retained exact-part product specification; land-pattern guidance not published",
      densityLevel: null,
      copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published", lengthMm: null, widthMm: null }
    })
    expect(bp031032C0603C104K3RactuFootprintEvidence.projectSelection).toMatchObject({
      copperPad: { lengthMm: 0.9, widthMm: 0.9, gapMm: 0.5, centerSpanMm: 1.4 },
      solderMask: {
        openingLengthMm: 1,
        openingWidthMm: 1,
        marginPerEdgeMm: 0.05,
        status: "project-input-not-manufacturer-specification"
      },
      paste: {
        openingLengthMm: 0.8,
        openingWidthMm: 0.8,
        reductionPerEdgeMm: 0.05,
        status: "project-input-not-manufacturer-specification"
      },
      courtyard: {
        lengthMm: 2.4,
        widthMm: 1.4,
        status: "project-review-input-not-manufacturer-specification"
      }
    })
  })

  it("renders two actual rectangular pads, mask, paste, courtyard, ports, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(2)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.7, y: 0, width: 0.9, height: 0.9, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.7, y: 0, width: 0.9, height: 0.9, soldermask_margin: 0.05 })
      ])
    )
    const paste = json.filter(isRectPaste)
    expect(paste).toHaveLength(2)
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.7, y: 0, width: 0.8, height: 0.8 }),
        expect.objectContaining({ x: 0.7, y: 0, width: 0.8, height: 0.8 })
      ])
    )
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
  })

  it("binds the rendered geometry hash and explicit non-polar orientation", () => {
    expect(renderedGeometryHash()).toBe(expectedRenderedArtworkSha256)
    expect(bp031032C0603C104K3RactuFootprintEvidence.artwork.sha256).toBe(expectedRenderedArtworkSha256)
    expect(bp031032C0603C104K3RactuFootprintEvidence.orientation).toMatchObject({
      state: "pending-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      rotationEquivalence: "180-degree rotationally equivalent"
    })
  })

  it("runtime-freezes the exported evidence and rejects direct provenance or deny-state mutation", () => {
    const evidence = bp031032C0603C104K3RactuFootprintEvidence
    const expectDirectMutationDenied = (target: object, key: PropertyKey, value: unknown) => {
      expect(Reflect.set(target, key, value)).toBe(false)
      expect(validateBp031032C0603C104K3RactuFootprintEvidence()).toEqual([])
    }

    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.sourceControl)).toBe(true)
    expect(Object.isFrozen(evidence.sourceControl.upstreamSources)).toBe(true)
    expect(Object.isFrozen(evidence.sources)).toBe(true)
    expect(Object.isFrozen(evidence.sources[0])).toBe(true)
    expect(Object.isFrozen(evidence.artwork)).toBe(true)
    expect(Object.isFrozen(evidence.projectFootprint)).toBe(true)

    expectDirectMutationDenied(evidence, "releaseState", "allow")
    expectDirectMutationDenied(evidence.projectFootprint, "fabricationAuthority", "allow")
    expectDirectMutationDenied(evidence.sources[0], "sha256", "0".repeat(64))
    expectDirectMutationDenied(evidence.artwork, "sha256", "0".repeat(64))
  })

  it("rejects hidden, symbol, getter, prototype, cycle, and alias graph drift without invoking getters", () => {
    const expectGraphDrift = (mutate: (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) => void) => {
      const copy = mutableClone()
      mutate(copy)
      expect(
        validateBp031032C0603C104K3RactuFootprintEvidence(
          copy as unknown as typeof bp031032C0603C104K3RactuFootprintEvidence
        )
      ).not.toEqual([])
    }

    expectGraphDrift((copy) => {
      Object.defineProperty(copy.sources[0], "hidden", { configurable: true, enumerable: false, value: "drift" })
    })
    expectGraphDrift((copy) => {
      Object.defineProperty(copy.sources[0], Symbol("drift"), { configurable: true, enumerable: false, value: "drift" })
    })
    let getterInvoked = false
    const getterCopy = mutableClone()
    Object.defineProperty(getterCopy.sources[0], "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064"
      }
    })
    expect(
      validateBp031032C0603C104K3RactuFootprintEvidence(
        getterCopy as unknown as typeof bp031032C0603C104K3RactuFootprintEvidence
      )
    ).not.toEqual([])
    expect(getterInvoked).toBe(false)
    expectGraphDrift((copy) => Object.setPrototypeOf(copy.sources[0], null))
    expectGraphDrift((copy) => {
      Reflect.set(copy, "sourceBinding", copy)
    })
    expectGraphDrift((copy) => {
      Reflect.set(copy, "projectFootprint", copy.projectSelection)
    })
  })

  it("returns review-only BP-123 evidence for exactly the eight BP-032 references", () => {
    const references = bp031032C0603C104K3RactuFootprintEvidence.referenceSets.bp032.references
    expect(references).toHaveLength(8)
    for (const reference of references) {
      expect(bp031032C0603C104K3RactuFootprintEvidenceFor("C0603C104K3RACTU", reference)).toMatchObject({
        exactMpn: "C0603C104K3RACTU",
        reference,
        sourceId: "yageo-kemet-c0603c104k3ractu-datasheet",
        sourceOwner: "M4-04",
        upstreamContract: "BP-123",
        sourceSha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
        projectFootprintId: "c0603c104k3ractu-project-review",
        manufacturerCad: "not-acquired",
        manufacturerLandPattern: "not-published",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }
    expect(bp031032C0603C104K3RactuFootprintEvidenceFor("C0603C104K3RACTU", "C_REF_REG_HF_1")).toBe(null)
    expect(bp031032C0603C104K3RactuFootprintEvidenceFor("OTHER", references[0])).toBe(null)
  })

  it.each([
    [
      "MPN",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy, "manufacturerPartNumber", "OTHER")
    ],
    [
      "reference set",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy, "affectedReferences", ["C_REF_REG_HF_1"])
    ],
    [
      "source hash",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "PDF page",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.sources[0].pageBinding, "exactOrderablePdfPage", 2)
    ],
    [
      "project geometry",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.projectFootprint.pads[0], "widthMm", 1)
    ],
    [
      "artwork hash",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.artwork, "sha256", "0".repeat(64))
    ],
    [
      "orientation",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.orientation, "polarity", "polar")
    ],
    [
      "CAD disposition",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) =>
        Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "fabrication acceptance",
      (copy: Mutable<typeof bp031032C0603C104K3RactuFootprintEvidence>) => Reflect.set(copy, "accepted", true)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = mutableClone()
    mutate(copy)
    expect(
      validateBp031032C0603C104K3RactuFootprintEvidence(
        copy as unknown as typeof bp031032C0603C104K3RactuFootprintEvidence
      )
    ).not.toEqual([])
  })
})
