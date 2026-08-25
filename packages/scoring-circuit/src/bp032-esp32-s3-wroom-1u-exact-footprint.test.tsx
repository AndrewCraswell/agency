import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import {
  benchPrototypeBp032Esp32S3Wroom1uExactFootprint,
  BenchPrototypeBp032Esp32S3Wroom1uExactFootprint,
  validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint
} from "./bp032-esp32-s3-wroom-1u-exact-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const candidate = benchPrototypeBp032Esp32S3Wroom1uExactFootprint

function cloneWithReviewDescriptors<T>(value: T, configurableKey?: PropertyKey): T {
  const seen = new WeakMap<object, object>()
  const clone = (input: unknown): unknown => {
    if (typeof input !== "object" || input === null) return input
    const existing = seen.get(input)
    if (existing !== undefined) return existing
    const output = Array.isArray(input) ? [] : Object.create(Object.getPrototypeOf(input))
    seen.set(input, output)
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)
      if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("data descriptor expected")
      Object.defineProperty(output, key, {
        ...descriptor,
        configurable: descriptor.configurable || key === configurableKey,
        value: clone(descriptor.value)
      })
    }
    return output
  }
  return clone(value) as T
}

function retainedArtifactUrl(artifactPath: string): URL {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(retainedArtifactUrl(path)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-032 exact ESP32-S3-WROOM-1U-N16R2 candidate", () => {
  it("binds U_APP, the exact orderable, BP-121 pad map, and BP-125 source", () => {
    expect(validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(candidate)).toBe(true)
    expect(Object.isFrozen(candidate)).toBe(true)
    expect(candidate).toMatchObject({
      workUnit: "BP-032",
      canonicalReference: "U_APP",
      manufacturer: "Espressif Systems",
      manufacturerPartNumber: "ESP32-S3-WROOM-1U-N16R2",
      exactOrderable: {
        package: "ESP32-S3-WROOM-1U module",
        flash: "16 MB Quad SPI",
        psram: "2 MB Quad SPI",
        antennaVariant: "external-antenna-connector"
      },
      fabricationAuthority: "deny",
      releaseState: "deny",
      accepted: false,
      sourceBinding: {
        canonicalReference: "U_APP",
        candidatePath: "packages/scoring-circuit/src/bp032-esp32-s3-wroom-1u-exact-footprint.tsx",
        bp121ModuleMpn: "ESP32-S3-WROOM-1U-N16R2",
        bp121SourceSha256: "F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B",
        bp125SourceSha256: "3FF36883B336525E50503DF8F45E70F6E6CD453A9FE57070470C597FDD5130C1",
        integrationCommit: "8f0739b9d4ff3a8d19bc211c07490c94c7cdca12"
      }
    })
    expect(candidate.bp121AllocationSnapshot.padMap).toHaveLength(41)
    expect(candidate.bp121AllocationSnapshot.padMap.map(({ pad }) => pad)).toEqual(
      Array.from({ length: 41 }, (_, index) => index + 1)
    )
    expect(candidate.bp121AllocationSnapshot.padMap[27]).toMatchObject({
      pad: 28,
      pin: "GPIO35",
      signal: "IR_RX",
      group: "ir-receiver"
    })
    expect(candidate.bp121AllocationSnapshot.padMap[40]).toMatchObject({
      pad: 41,
      pin: "GND_EP",
      signal: "APP_GND",
      group: "power"
    })
    expect(validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)).toBe(true)
    expect(benchPrototypeEsp32Allocation.moduleMpn).toBe(candidate.manufacturerPartNumber)
    expect(candidate.bp121AllocationSnapshot.padMap).toEqual(benchPrototypeEsp32Allocation.pads)
    expect(sha256(candidate.sourceBinding.bp121SourcePath)).toBe(candidate.sourceBinding.bp121SourceSha256)
    expect(sha256(candidate.sourceBinding.bp125SourcePath)).toBe(candidate.sourceBinding.bp125SourceSha256)
  })

  it("binds retained primary PDF, DXF, and STEP evidence to exact pages and hashes", () => {
    const pdf = candidate.officialSources.find((source) => source.id === "espressif-esp32-s3-wroom-1u-datasheet-v1-8")
    const dxf = candidate.officialSources.find(
      (source) => source.id === "espressif-esp32-s3-wroom-1u-pcb-footprint-dxf"
    )
    const step = candidate.officialSources.find((source) => source.id === "espressif-esp32-s3-wroom-1u-step")
    expect(pdf).toBeDefined()
    expect(dxf).toBeDefined()
    expect(step).toBeDefined()
    if (pdf === undefined || dxf === undefined || step === undefined) return
    expect(pdf.reviewedPages).toEqual({
      exactVariant: [3],
      pinsAndSupply: [10, 11, 12],
      resetAndExposedPad: [41],
      moduleDimensionsAndConnector: [42, 43],
      recommendedLandPattern: [45, 46]
    })
    for (const source of [pdf, dxf, step]) {
      expect(source.authority).toBe("manufacturer-primary")
      expect(source.url).toMatch(/^https:\/\//u)
      expect(sha256(source.artifactPath)).toBe(source.sha256)
    }
    expect(readFileSync(retainedArtifactUrl(step.artifactPath), "utf8")).toContain("ISO-10303-21;")
    expect(candidate.artworkProvenance).toMatchObject({
      sourceArtifactSha256: dxf.sha256,
      sourceLayers: ["PART_TOP_COPPER_01", "SOLDERMASKTOP_P", "PADS_TOP"],
      generatedEntities: {
        topCopperPerimeter: 40,
        exposedGroundPlatedHoles: 9,
        pasteApertures: 0,
        courtyardOutlines: 0
      }
    })
  })

  it("records complete footprint geometry, EPAD, antenna boundary, orientation, and keepout provenance", () => {
    const { projectGeometry, manufacturerFacts } = candidate
    expect(manufacturerFacts.bodyEnvelopeMm).toEqual({ widthMm: 18, lengthMm: 19.2, heightMm: 3.2 })
    expect(projectGeometry.bodyEnvelopeMm).toEqual(manufacturerFacts.bodyEnvelopeMm)
    expect(projectGeometry.perimeterCopper.pads).toHaveLength(40)
    expect(projectGeometry.perimeterCopper.pads.map(({ pad }) => pad)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1)
    )
    expect(projectGeometry.perimeterCopper.pads.filter(({ xMm }) => xMm === -8.75)).toHaveLength(14)
    expect(projectGeometry.perimeterCopper.pads.filter(({ xMm }) => xMm === 8.75)).toHaveLength(14)
    expect(projectGeometry.perimeterCopper.pads.filter(({ yMm }) => yMm === -9.5)).toHaveLength(12)
    expect(projectGeometry.exposedGroundPad).toMatchObject({
      pad: 41,
      net: "APP_GND",
      arrayCenterMm: { xMm: -1.5, yMm: 0.5 },
      copperEnvelopeMm: { widthMm: 3.7, lengthMm: 3.7 },
      viaCount: 9,
      viaPitchMm: 1.4
    })
    expect(projectGeometry.exposedGroundPad.vias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ xMm: -2.9, yMm: -0.9, copperWidthMm: 0.9, drillDiameterMm: 0.5 }),
        expect.objectContaining({ xMm: -1.5, yMm: 0.5, copperWidthMm: 0.9, drillDiameterMm: 0.5 }),
        expect.objectContaining({ xMm: -0.1, yMm: 1.9, copperWidthMm: 0.9, drillDiameterMm: 0.5 })
      ])
    )
    expect(projectGeometry.orientation).toMatchObject({
      pinOne: { pad: 1, xMm: -8.75, yMm: 8.255 },
      nominalBoardRotationDegrees: 0,
      independentOverlay: "pending",
      placementApproval: "deny"
    })
    expect(projectGeometry.antennaBoundary).toMatchObject({
      mode: "external-antenna-connector-integrated",
      pcbAntennaKeepout: "not-applicable-to-WROOM-1U",
      compatibleMates: ["U.FL series", "MHF I", "AMC"],
      hostBoardClearance: "not-published; do not infer",
      cableExitAndEnclosureReview: "pending",
      rfMeasurement: "deny"
    })
    expect(projectGeometry.keepout).toMatchObject({
      moduleBody: "body-envelope-only; host courtyard not published",
      pcbAntenna: "not-applicable-to-WROOM-1U",
      approval: "deny"
    })
    expect(projectGeometry.paste).toEqual({
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-stencil-apertures-from-copper-or-mask"
    })
    expect(projectGeometry.courtyard.status).toBe("not-published")
  })

  it("renders 40 perimeter lands and nine EPAD vias without paste or courtyard", () => {
    const json = renderTestCircuit(<BenchPrototypeBp032Esp32S3Wroom1uExactFootprint />)
    const source = json.find(
      (element) =>
        element.type === "source_component" && element.name === "U_BP032_ESP32_S3_WROOM_1U_N16R2_EXACT_CANDIDATE"
    )
    expect(source).toMatchObject({ manufacturer_part_number: "ESP32-S3-WROOM-1U-N16R2" })
    const pcb = json.find(
      (element) =>
        element.type === "pcb_component" &&
        source !== undefined &&
        "source_component_id" in source &&
        element.source_component_id === source.source_component_id
    )
    expect(pcb).toBeDefined()
    if (pcb === undefined || !("pcb_component_id" in pcb)) return
    const artifacts = json.filter(
      (element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id
    )
    expect(artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(40)
    expect(artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(9)
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pcb_smtpad",
          x: -8.75,
          y: 8.255,
          width: 1.5,
          height: 0.9,
          soldermask_margin: 0
        }),
        expect.objectContaining({
          type: "pcb_plated_hole",
          x: -1.5,
          y: 0.5,
          hole_diameter: 0.5,
          rect_pad_width: 0.9,
          rect_pad_height: 0.9
        })
      ])
    )
    expect(artifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(artifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
  })

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["array", []]
  ])("fails closed for %s descriptors", (_label, value) => {
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(value)).toThrow(RangeError)
  })

  it("rejects descriptor-flag, sparse-array, and null-prototype drift", () => {
    const descriptorDrift = cloneWithReviewDescriptors(candidate, "manufacturerPartNumber")
    const manufacturerPartNumberDescriptor = Object.getOwnPropertyDescriptor(descriptorDrift, "manufacturerPartNumber")
    if (manufacturerPartNumberDescriptor === undefined || !("value" in manufacturerPartNumberDescriptor)) return
    Object.defineProperty(descriptorDrift, "manufacturerPartNumber", {
      ...manufacturerPartNumberDescriptor,
      enumerable: false
    })
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(descriptorDrift)).toThrow(RangeError)

    const sparsePadArray = cloneWithReviewDescriptors(candidate, "1")
    expect(Reflect.deleteProperty(sparsePadArray.projectGeometry.perimeterCopper.pads, 1)).toBe(true)
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(sparsePadArray)).toThrow(RangeError)

    const nullPrototypeDrift = cloneWithReviewDescriptors(candidate)
    Object.setPrototypeOf(nullPrototypeDrift, null)
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(nullPrototypeDrift)).toThrow(RangeError)
  })

  it("rejects selection, map, geometry, authority, alias, cycle, symbol, prototype, and accessor drift", () => {
    const selectionDrift = structuredClone(candidate)
    Reflect.set(selectionDrift, "manufacturerPartNumber", "ESP32-S3-WROOM-1U-N8")
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(selectionDrift)).toThrow(RangeError)

    const mapDrift = structuredClone(candidate)
    Reflect.set(mapDrift.bp121AllocationSnapshot.padMap[0], "signal", "APP_3V3")
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(mapDrift)).toThrow(RangeError)

    const geometryDrift = structuredClone(candidate)
    Reflect.set(geometryDrift.projectGeometry.perimeterCopper.pads[0], "xMm", -8.7)
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(geometryDrift)).toThrow(RangeError)

    const authorityDrift = structuredClone(candidate)
    Reflect.set(authorityDrift.authority, "fabrication", "allow")
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(authorityDrift)).toThrow(RangeError)

    const aliasDrift = structuredClone(candidate)
    Reflect.set(aliasDrift.projectGeometry.perimeterCopper.pads, 1, aliasDrift.projectGeometry.perimeterCopper.pads[0])
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(aliasDrift)).toThrow(RangeError)

    const cycleDrift = structuredClone(candidate)
    Reflect.set(cycleDrift.projectGeometry, "keepout", cycleDrift.projectGeometry)
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(cycleDrift)).toThrow(RangeError)

    const symbolDrift = structuredClone(candidate)
    const symbol = Symbol("unreviewed")
    Object.defineProperty(symbolDrift, symbol, { value: true, enumerable: false })
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(symbolDrift)).toThrow(RangeError)

    const prototypeDrift = structuredClone(candidate)
    Object.setPrototypeOf(prototypeDrift, null)
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(prototypeDrift)).toThrow(RangeError)

    let getterCalled = false
    const accessorDrift = structuredClone(candidate)
    Object.defineProperty(accessorDrift, "manufacturerPartNumber", {
      configurable: true,
      get: () => {
        getterCalled = true
        throw new Error("accessor executed")
      }
    })
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(accessorDrift)).toThrow(RangeError)
    expect(getterCalled).toBe(false)

    const ownKeysTrap = new Proxy(structuredClone(candidate), {
      ownKeys: () => {
        throw new Error("ownKeys executed")
      }
    })
    expect(() => validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(ownKeysTrap)).toThrow(RangeError)
  })
})
