import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry,
  BenchPrototypeBp032Esp32Wroom1uFootprint,
  validateBenchPrototypeBp032Esp32Wroom1uFootprint
} from "./bench-prototype-bp032-esp32-s3-wroom-1u-footprint.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { renderTestCircuit } from "./test-helper.js"

const geometry = benchPrototypeBp032Esp32Wroom1uFootprintGeometry

type DxfEntity = {
  readonly type: string
  readonly pairs: readonly (readonly [string, string])[]
}

type DxfBounds = {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

function retainedArtifactUrl(artifactPath: string): URL {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function dxfEntitiesInSection(text: string, sectionName: string): readonly DxfEntity[] {
  const lines = text.split(/\r?\n/u)
  const sectionValueIndex = lines.findIndex((line) => line.trim() === sectionName)
  if (sectionValueIndex < 1 || lines[sectionValueIndex - 1]?.trim() !== "2") {
    throw new RangeError(`DXF section ${sectionName} was not found as a group-code 2 value`)
  }
  const entities: DxfEntity[] = []
  let entity: { type: string; pairs: [string, string][] } | undefined
  for (let index = sectionValueIndex + 1; index + 1 < lines.length; index += 2) {
    const code = lines[index]?.trim()
    const value = lines[index + 1]?.trim()
    if (code === "0") {
      if (value === "ENDSEC") {
        if (entity !== undefined) entities.push(entity)
        break
      }
      if (entity !== undefined) entities.push(entity)
      entity = { type: value ?? "", pairs: [] }
    } else if (entity !== undefined && code !== undefined && value !== undefined) {
      entity.pairs.push([code, value])
    }
  }
  return entities
}

function entityLayer(entity: DxfEntity): string | undefined {
  return entity.pairs.find(([code]) => code === "8")?.[1]
}

function entityNumbers(entity: DxfEntity, code: string): readonly number[] {
  return entity.pairs.filter(([pairCode]) => pairCode === code).map(([, value]) => Number(value))
}

function entityBounds(entity: DxfEntity): DxfBounds {
  const xs = entityNumbers(entity, "10")
  const ys = entityNumbers(entity, "20")
  if (xs.length === 0 || ys.length === 0) throw new RangeError(`DXF ${entity.type} has no XY geometry`)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

function closeTo(actual: number, expected: number, tolerance = 0.000001): boolean {
  return Math.abs(actual - expected) <= tolerance
}

function dxfEntityWidth(bounds: DxfBounds): number {
  return bounds.maxX - bounds.minX
}

function dxfEntityHeight(bounds: DxfBounds): number {
  return bounds.maxY - bounds.minY
}

function roundedValues(values: readonly number[]): readonly number[] {
  return [...new Set(values.map((value) => Math.round(value * 1000) / 1000))].sort((a, b) => a - b)
}

describe("BP-032 exact ESP32-S3-WROOM-1U-N16R2 candidate footprint", () => {
  it("derives the 18 x 19.2 mm module perimeter and 41-pad ground topology", () => {
    expect(validateBenchPrototypeBp032Esp32Wroom1uFootprint(geometry)).toBe(true)
    expect(geometry.manufacturerPartNumber).toBe("ESP32-S3-WROOM-1U-N16R2")
    expect(geometry.package.bodyEnvelopeMm).toEqual({ widthMm: 18, lengthMm: 19.2, heightMm: 3.2 })
    expect(geometry.landPattern.perimeterCopper.pads).toHaveLength(40)
    expect(geometry.landPattern.perimeterCopper.pads.map((pad) => pad.pad)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1)
    )
    expect(geometry.landPattern.perimeterCopper.pads.filter((pad) => pad.xMm === -8.75)).toHaveLength(14)
    expect(geometry.landPattern.perimeterCopper.pads.filter((pad) => pad.xMm === 8.75)).toHaveLength(14)
    expect(geometry.landPattern.perimeterCopper.pads.filter((pad) => pad.yMm === -9.5)).toHaveLength(12)
    expect(geometry.landPattern.exposedGroundPad).toMatchObject({
      arrayCenterMm: { xMm: -1.5, yMm: 0.5 },
      copperEnvelopeMm: { widthMm: 3.7, lengthMm: 3.7 },
      viaCount: 9,
      viaPitchMm: 1.4,
      viaCopperSquareMm: 0.9,
      finishedDrillDiameterMm: 0.5
    })
    expect(geometry.orientation.pinOne).toMatchObject({ pad: 1, xMm: -8.75, yMm: 8.255 })
  })

  it("binds the exact Espressif artifacts and records CAD gaps without substitutions", () => {
    expect(geometry.upstreamSelection).toMatchObject({
      moduleMpn: "ESP32-S3-WROOM-1U-N16R2",
      sourceContract: "BP-121 exact module-pad allocation",
      sourceSha256: "F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B"
    })
    for (const source of geometry.officialSources) {
      const bytes = readFileSync(retainedArtifactUrl(source.artifactPath))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      expect(source.url).toMatch(/^https:\/\//u)
    }
    const stepSource = geometry.officialSources.find((source) => source.id === "espressif-esp32-s3-wroom-1u-step")
    expect(stepSource).toBeDefined()
    if (stepSource !== undefined) {
      const stepText = readFileSync(retainedArtifactUrl(stepSource.artifactPath), "utf8")
      expect(stepText).toContain("ISO-10303-21;")
      expect(stepText).toContain("ESP32-S3-WROOM-1U_20220720-2.STEP")
      expect(stepText).toContain("SHAPE_REPRESENTATION")
    }
    expect(geometry.manufacturerCad).toMatchObject({
      state: "retained-exact-official-cad",
      copper: "manufacturer-CAD-and-datasheet",
      solderMask: "manufacturer-CAD-top-layer",
      paste: "not-published-by-Espressif",
      courtyard: "not-published-by-Espressif"
    })
    expect(geometry.landPattern.solderMask).toMatchObject({
      sourceLayer: "SOLDERMASKTOP_P",
      perimeterOpening: { widthMm: 1.5, heightMm: 0.9, count: 40 },
      exposedGroundPadViaOpening: { widthMm: 0.9, heightMm: 0.9, count: 9 }
    })
    expect(geometry.landPattern.paste).toEqual({
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-stencil-apertures-from-copper-or-mask"
    })
    expect(geometry.landPattern.courtyard.status).toBe("not-published")
    expect(geometry.externalAntenna).toMatchObject({
      antennaMode: "external-antenna-connector-integrated",
      pcbAntennaKeepout: "not-applicable-to-WROOM-1U",
      state: "pending-external-antenna-cable-enclosure-review"
    })
    expect(geometry.externalAntenna.connector).toMatchObject({
      generation: "first-generation",
      compatibleMates: ["U.FL series", "MHF I", "AMC"],
      shellTopViewMm: { widthMm: 2.6, lengthMm: 2.6, toleranceMm: 0.15 }
    })
    expect(geometry.fabricationAuthority).toBe("deny")
    expect(geometry.accepted).toBe(false)
  })

  it("hashes BP-121 bytes and fail-closes on the retained ASCII DXF geometry", () => {
    expect(validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)).toBe(true)
    expect(benchPrototypeEsp32Allocation.moduleMpn).toBe(geometry.upstreamSelection.moduleMpn)
    const upstreamBytes = readFileSync(retainedArtifactUrl(geometry.upstreamSelection.sourcePath))
    expect(createHash("sha256").update(upstreamBytes).digest("hex").toUpperCase()).toBe(
      geometry.upstreamSelection.sourceSha256
    )

    const dxfSource = geometry.officialSources.find(
      (source) => source.id === "espressif-esp32-s3-wroom-1u-pcb-footprint-dxf"
    )
    expect(dxfSource).toBeDefined()
    if (dxfSource === undefined) return
    const dxfText = readFileSync(retainedArtifactUrl(dxfSource.artifactPath), "utf8")
    const entities = dxfEntitiesInSection(dxfText, "ENTITIES")
    const blockEntities = dxfEntitiesInSection(dxfText, "BLOCKS")
    const layers = new Set([...entities, ...blockEntities].map(entityLayer))
    expect([...layers]).toEqual(expect.arrayContaining(["PADS_TOP", "PART_TOP_COPPER_01", "SOLDERMASKTOP_P"]))

    const copper = blockEntities.filter((entity) => entityLayer(entity) === "PART_TOP_COPPER_01")
    expect(copper.filter((entity) => entity.type === "INSERT")).toHaveLength(28)
    const copperOutline = copper.filter((entity) => entity.type === "LWPOLYLINE")
    expect(copperOutline).toHaveLength(1)
    expect(copperOutline[0]?.pairs.find(([code]) => code === "90")?.[1]).toBe("28")
    expect(Number(copperOutline[0]?.pairs.find(([code]) => code === "43")?.[1])).toBeCloseTo(0.254, 6)

    const maskPolylines = entities.filter(
      (entity) => entity.type === "LWPOLYLINE" && entityLayer(entity) === "SOLDERMASKTOP_P"
    )
    const moduleMask = maskPolylines.filter((entity) => {
      const bounds = entityBounds(entity)
      return bounds.minX >= 725 && bounds.maxX <= 744.6 && bounds.minY >= -183.4 && bounds.maxY <= -164.3
    })
    const perimeterMask = moduleMask.filter((entity) => {
      const bounds = entityBounds(entity)
      const width = dxfEntityWidth(bounds)
      const height = dxfEntityHeight(bounds)
      return (closeTo(width, 1.5) && closeTo(height, 0.9)) || (closeTo(width, 0.9) && closeTo(height, 1.5))
    })
    expect(perimeterMask).toHaveLength(40)

    const exposedGroundMask = moduleMask.filter((entity) => {
      const bounds = entityBounds(entity)
      return (
        closeTo(dxfEntityWidth(bounds), 0.9) &&
        closeTo(dxfEntityHeight(bounds), 0.9) &&
        entity.pairs.some(([code, value]) => code === "48" && closeTo(Number(value), 0.05))
      )
    })
    expect(exposedGroundMask).toHaveLength(9)
    expect(
      roundedValues(
        exposedGroundMask.map((entity) => {
          const bounds = entityBounds(entity)
          return (bounds.minX + bounds.maxX) / 2
        })
      )
    ).toEqual([732.163, 733.563, 734.963])
    expect(
      roundedValues(
        exposedGroundMask.map((entity) => {
          const bounds = entityBounds(entity)
          return (bounds.minY + bounds.maxY) / 2
        })
      )
    ).toEqual([-173.94, -172.54, -171.14])
    expect(geometry.landPattern.solderMask.perimeterOpening.count).toBe(perimeterMask.length)
    expect(geometry.landPattern.solderMask.exposedGroundPadViaOpening.count).toBe(exposedGroundMask.length)
  })

  it("rejects selection, geometry, and fabrication-authority drift", () => {
    const selectionDrift = structuredClone(geometry)
    Reflect.set(selectionDrift, "manufacturerPartNumber", "ESP32-S3-WROOM-1U-N8")
    expect(() => validateBenchPrototypeBp032Esp32Wroom1uFootprint(selectionDrift)).toThrow(RangeError)

    const geometryDrift = structuredClone(geometry)
    Reflect.set(geometryDrift.landPattern.perimeterCopper.pads[0], "xMm", -8.7)
    expect(() => validateBenchPrototypeBp032Esp32Wroom1uFootprint(geometryDrift)).toThrow(RangeError)

    const authorityDrift = structuredClone(geometry)
    Reflect.set(authorityDrift, "accepted", true)
    expect(() => validateBenchPrototypeBp032Esp32Wroom1uFootprint(authorityDrift)).toThrow(RangeError)
  })

  it("renders only the review candidate geometry and no inferred paste or courtyard", () => {
    const json = renderTestCircuit(<BenchPrototypeBp032Esp32Wroom1uFootprint />)
    const source = json.find(
      (element) => element.type === "source_component" && element.name === "U_BP032_ESP32_S3_WROOM_1U_N16R2"
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
          shape: "rect",
          x: -8.75,
          y: 8.255,
          width: 1.5,
          height: 0.9,
          soldermask_margin: 0
        }),
        expect.objectContaining({
          type: "pcb_smtpad",
          shape: "rect",
          x: -6.985,
          y: -9.5,
          width: 0.9,
          height: 1.5,
          soldermask_margin: 0
        }),
        expect.objectContaining({
          type: "pcb_plated_hole",
          shape: "circular_hole_with_rect_pad",
          x: -2.9,
          y: -0.9,
          hole_diameter: 0.5,
          rect_pad_width: 0.9,
          rect_pad_height: 0.9,
          soldermask_margin: 0
        })
      ])
    )
    expect(artifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(artifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
  })
})
