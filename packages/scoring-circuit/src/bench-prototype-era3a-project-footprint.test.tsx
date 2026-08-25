import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeEra3aProjectFootprintGeometry,
  BenchPrototypeEra3aProjectFootprint,
  validateBenchPrototypeEra3aProjectFootprint
} from "./bench-prototype-era3a-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function renderProjectFootprint() {
  return renderTestCircuit(<BenchPrototypeEra3aProjectFootprint />)
}

function artifactBytes(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return readFileSync(new URL(`../${packageRelativePath}`, import.meta.url))
}

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase()
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
  return sha256(JSON.stringify(geometry))
}

function mutableClone(): Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry> {
  return structuredClone(benchPrototypeEra3aProjectFootprintGeometry) as unknown as Mutable<
    typeof benchPrototypeEra3aProjectFootprintGeometry
  >
}

describe("BP-031 Panasonic ERA3AEB2491V project footprint", () => {
  it("binds the exact MPN, package, and exactly seven R_SOURCE references", () => {
    expect(validateBenchPrototypeEra3aProjectFootprint()).toEqual([])
    expect(benchPrototypeEra3aProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp031-era3aeb2491v-project-footprint",
      workUnit: "BP-031",
      manufacturer: "Panasonic Industry",
      manufacturerPartNumber: "ERA3AEB2491V",
      sourceContract: "BP-102",
      role: "reference excitation series resistor",
      affectedReferences: [
        "R_SOURCE_1",
        "R_SOURCE_2",
        "R_SOURCE_3",
        "R_SOURCE_4",
        "R_SOURCE_5",
        "R_SOURCE_6",
        "R_SOURCE_7"
      ],
      package: {
        designation: "ERA3A / 1608 (0603)",
        caseSize: "EIA 0603 / IEC 1608",
        resistanceOhms: 2490,
        tolerancePercent: 0.1,
        tcrPpmPerK: 25,
        lengthMm: { nominal: 1.6, tolerance: 0.2 },
        widthMm: { nominal: 0.8, tolerance: 0.2 }
      },
      manufacturerCad: {
        state: "not-acquired",
        availability: "not-published",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-cad.html",
        authority: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("hash-binds retained source bytes, page bindings, CAD status, and canonical upstream sources", () => {
    expect(benchPrototypeEra3aProjectFootprintGeometry.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "panasonic-era3a-package",
          documentNumber: "AOA0000C309",
          reviewedPages: [1, 2, 3],
          pageBinding: expect.objectContaining({
            retainedPdfPageCount: 7,
            exactOrderableEvidencePage: 2,
            packageDrawingPage: 3
          }),
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
          sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79"
        }),
        expect.objectContaining({
          id: "panasonic-1608-rectangular-land-pattern",
          documentNumber: "DMM0000COL20",
          reviewedPages: [1],
          pageBinding: expect.objectContaining({ retainedPdfPageCount: 3, landPatternPage: 1 }),
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf",
          sha256: "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D"
        }),
        expect.objectContaining({
          id: "panasonic-era3a-product-identity",
          artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-product.html",
          sha256: "BB9C4A4BE74D7F700378C41A63089E158FFE929FA6EA3943427C27AD89BC6048"
        })
      ])
    )
    for (const source of benchPrototypeEra3aProjectFootprintGeometry.sources) {
      expect(sha256(artifactBytes(source.artifactPath))).toBe(source.sha256)
    }
    expect(sha256(artifactBytes(benchPrototypeEra3aProjectFootprintGeometry.manufacturerCad.artifactPath))).toBe(
      benchPrototypeEra3aProjectFootprintGeometry.manufacturerCad.sha256
    )
    expect(benchPrototypeEra3aProjectFootprintGeometry.sourceControl).toEqual({
      basisCommit: "c6a0723a719551c1632ff2eff5b528409b4cac57",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496D8727B33209C03B31F2B1F203397C7CAB364F40D00EDF2EC8B1BDF227E55D"
        },
        {
          path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
          sha256: "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
        },
        {
          path: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
          sha256: "298F04737136BA41B9F909ECF838342DF5D2DA1173778BD42A64AC0048D9E9CE"
        }
      ]
    })
    for (const source of benchPrototypeEra3aProjectFootprintGeometry.sourceControl.upstreamSources) {
      expect(sha256(artifactBytes(source.path))).toBe(source.sha256)
    }
  })

  it("keeps Panasonic land guidance separate from project geometry", () => {
    const {
      manufacturerLandPattern,
      package: packageSpec,
      projectSelection
    } = benchPrototypeEra3aProjectFootprintGeometry
    expect(manufacturerLandPattern).toMatchObject({
      sourceId: "panasonic-1608-rectangular-land-pattern",
      reviewedPage: 1,
      sourceScope: "manufacturer-recommended guidance, not exact-orderable CAD",
      aPadLengthMm: { minimum: 0.7, maximum: 0.9 },
      bOverallLandSpanMm: { minimum: 2, maximum: 2.2 },
      cPadWidthMm: { minimum: 0.8, maximum: 1 }
    })
    expect(packageSpec).toMatchObject({
      lengthMm: { nominal: 1.6, tolerance: 0.2 },
      widthMm: { nominal: 0.8, tolerance: 0.2 },
      terminalLengthMm: { nominal: 0.3, tolerance: 0.2 }
    })
    expect(projectSelection).toMatchObject({
      manufacturerParameterSelectionMm: { aPadLength: 0.8, bOverallLandSpan: 2.1, cPadWidth: 0.9 },
      copperPad: { lengthMm: 0.8, widthMm: 0.9 },
      overallLandSpanMm: 2.1,
      derivedCopperPadGapMm: 0.5,
      derivedCopperPadCenterXMm: 0.65,
      solderMask: { openingLengthMm: 0.9, openingWidthMm: 1, marginMm: 0.05 },
      paste: { openingLengthMm: 0.7, openingWidthMm: 0.8, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 2.4, widthMm: 1.3, minimumClearanceMm: 0.15 }
    })
  })

  it("binds two non-polar terminals with no pin-one claim", () => {
    expect(benchPrototypeEra3aProjectFootprintGeometry.terminals).toEqual([
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.65, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.65, yMm: 0 }
    ])
    expect(benchPrototypeEra3aProjectFootprintGeometry.orientation).toMatchObject({
      state: "pending-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      rotationEquivalence: "180-degree rotationally equivalent"
    })
  })

  it("renders exact copper, mask, paste, courtyard, ports, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(json.find((element) => element.type === "source_component")).toMatchObject({
      name: "R_BP031_ERA3AEB2491V",
      manufacturer_part_number: "ERA3AEB2491V"
    })
    expect(pads).toHaveLength(2)
    expect(
      pads.map(({ x, y, width, height, soldermask_margin }) => ({ x, y, width, height, soldermask_margin }))
    ).toEqual([
      { x: -0.65, y: 0, width: 0.8, height: 0.9, soldermask_margin: 0.05 },
      { x: 0.65, y: 0, width: 0.8, height: 0.9, soldermask_margin: 0.05 }
    ])
    const paste = json.filter(isRectPaste)
    expect(paste).toHaveLength(2)
    expect(paste.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: -0.65, y: 0, width: expect.closeTo(0.7, 10), height: 0.8 },
      { x: 0.65, y: 0, width: expect.closeTo(0.7, 10), height: 0.8 }
    ])
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pin_number: 1,
          name: "A",
          port_hints: expect.arrayContaining(["non-polar", "pin1"])
        }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["non-polar", "pin2"]) })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.3 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the canonical rendered geometry hash while keeping all release gates denied", () => {
    expect(renderedGeometryHash()).toBe(benchPrototypeEra3aProjectFootprintGeometry.artwork.sha256)
    expect(benchPrototypeEra3aProjectFootprintGeometry.artwork.authority).toBe("deny")
    expect(benchPrototypeEra3aProjectFootprintGeometry.authority).toMatchObject({
      manufacturerCadImported: false,
      independentOrientationAccepted: false,
      projectArtworkAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
  })

  it("runtime-freezes the exported graph and rejects direct mutation", () => {
    const evidence = benchPrototypeEra3aProjectFootprintGeometry
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.sources)).toBe(true)
    expect(Object.isFrozen(evidence.sources[0])).toBe(true)
    expect(Object.isFrozen(evidence.manufacturerCad)).toBe(true)
    expect(Reflect.set(evidence, "accepted", true)).toBe(false)
    expect(Reflect.set(evidence.manufacturerCad, "authority", "allow")).toBe(false)
    expect(Reflect.set(evidence.sources[0], "sha256", "0".repeat(64))).toBe(false)
    expect(validateBenchPrototypeEra3aProjectFootprint()).toEqual([])
  })

  it.each([
    [
      "MPN",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy, "manufacturerPartNumber", "OTHER")
    ],
    [
      "reference scope",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy, "affectedReferences", ["R_SOURCE_1"])
    ],
    [
      "source hash",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "PDF page",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.sources[0].pageBinding, "packageDrawingPage", 4)
    ],
    [
      "CAD provenance",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "package",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.package, "resistanceOhms", 2491)
    ],
    [
      "project geometry",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.projectFootprint.pads[0], "widthMm", 0.9)
    ],
    [
      "orientation",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.orientation, "polarity", "polar")
    ],
    [
      "artwork hash",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) =>
        Reflect.set(copy.artwork, "sha256", "0".repeat(64))
    ],
    [
      "release",
      (copy: Mutable<typeof benchPrototypeEra3aProjectFootprintGeometry>) => Reflect.set(copy, "accepted", true)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = mutableClone()
    mutate(copy)
    expect(validateBenchPrototypeEra3aProjectFootprint(copy)).not.toEqual([])
  })

  it("fails closed on hidden, symbol, getter, prototype, cycle, and alias graph mutations", () => {
    expect(validateBenchPrototypeEra3aProjectFootprint(null)).not.toEqual([])
    expect(validateBenchPrototypeEra3aProjectFootprint({})).not.toEqual([])

    const hidden = mutableClone()
    Object.defineProperty(hidden.sources[0], "hidden", { configurable: true, enumerable: false, value: "drift" })
    expect(validateBenchPrototypeEra3aProjectFootprint(hidden)).not.toEqual([])

    const symbol = mutableClone()
    Object.defineProperty(symbol.sources[0], Symbol("drift"), { configurable: true, enumerable: false, value: "drift" })
    expect(validateBenchPrototypeEra3aProjectFootprint(symbol)).not.toEqual([])

    let getterInvoked = false
    const getter = mutableClone()
    Object.defineProperty(getter.sources[0], "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return "0".repeat(64)
      }
    })
    expect(validateBenchPrototypeEra3aProjectFootprint(getter)).not.toEqual([])
    expect(getterInvoked).toBe(false)

    const prototype = mutableClone()
    Object.setPrototypeOf(prototype.sources[0], null)
    expect(validateBenchPrototypeEra3aProjectFootprint(prototype)).not.toEqual([])

    const cycle = mutableClone()
    Reflect.set(cycle, "cycle", cycle)
    expect(validateBenchPrototypeEra3aProjectFootprint(cycle)).not.toEqual([])

    const alias = mutableClone()
    Reflect.set(alias, "manufacturerCad", alias.sources[0])
    expect(validateBenchPrototypeEra3aProjectFootprint(alias)).not.toEqual([])
  })
})
