import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import P0Esp32Wroom1Footprint, { p0Esp32Wroom1FootprintMetadata } from "./p0-esp32-wroom-1-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type DxfEntity = {
  readonly type: string
  readonly pairs: readonly (readonly [string, string])[]
}

type Bounds = {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

function retainedArtifactUrl(artifactPath: string): URL {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function sha256(artifactPath: string): string {
  return createHash("sha256")
    .update(readFileSync(retainedArtifactUrl(artifactPath)))
    .digest("hex")
    .toUpperCase()
}

function dxfEntitiesInSection(text: string, sectionName: string): readonly DxfEntity[] {
  const lines = text.split(/\r?\n/u)
  const sectionValueIndex = lines.findIndex((line) => line.trim() === sectionName)
  if (sectionValueIndex < 1 || lines[sectionValueIndex - 1]?.trim() !== "2") {
    throw new RangeError(`DXF section ${sectionName} was not found`)
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

function entityValues(entity: DxfEntity, code: string): readonly number[] {
  return entity.pairs.filter(([pairCode]) => pairCode === code).map(([, value]) => Number(value))
}

function entityLayer(entity: DxfEntity): string | undefined {
  return entity.pairs.find(([code]) => code === "8")?.[1]
}

function bounds(entity: DxfEntity): Bounds {
  const xs = entityValues(entity, "10")
  const ys = entityValues(entity, "20")
  if (xs.length === 0 || ys.length === 0) throw new RangeError(`DXF ${entity.type} has no XY bounds`)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

function width(rect: Bounds): number {
  return rect.maxX - rect.minX
}

function height(rect: Bounds): number {
  return rect.maxY - rect.minY
}

function closeTo(actual: number, expected: number, tolerance = 0.001): boolean {
  return Math.abs(actual - expected) <= tolerance
}

function footprintArtifacts() {
  const json = renderTestCircuit(
    <board width="100mm" height="100mm">
      <P0Esp32Wroom1Footprint pcbX={0} pcbY={0} />
    </board>
  )
  const source = json.find((element) => element.type === "source_component" && element.name === "U_APP")
  expect(source).toBeDefined()
  if (source === undefined || !("source_component_id" in source)) throw new RangeError("U_APP source is missing")
  const pcb = json.find(
    (element) =>
      element.type === "pcb_component" &&
      "source_component_id" in element &&
      element.source_component_id === source.source_component_id
  )
  expect(pcb).toBeDefined()
  if (pcb === undefined || !("pcb_component_id" in pcb)) throw new RangeError("U_APP PCB component is missing")
  return {
    json,
    artifacts: json.filter(
      (element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id
    )
  }
}

describe("P0-06 ESP32-S3-WROOM-1-N16R2 official footprint reconciliation", () => {
  it("binds the exact orderable, pin map, package dimensions, and antenna policy", () => {
    expect(Object.isFrozen(p0Esp32Wroom1FootprintMetadata)).toBe(true)
    expect(Object.isFrozen(p0Esp32Wroom1FootprintMetadata.landPattern.perimeterPads)).toBe(true)
    expect(p0Esp32Wroom1FootprintMetadata).toMatchObject({
      workUnit: "P0-06",
      canonicalReference: "U_APP",
      manufacturerPartNumber: "ESP32-S3-WROOM-1-N16R2",
      exactSelection: {
        flash: "16 MB Quad SPI",
        psram: "2 MB Quad SPI",
        antenna: "integrated on-module PCB antenna"
      },
      package: {
        bodyMm: { width: 18, length: 25.5, height: 3.1 },
        perimeterPadCount: 40,
        exposedGroundPad: 41
      },
      antenna: {
        areaMm: { width: 18, length: 6 },
        fallbackHostBoardClearanceMm: 15,
        terminalEscapeCorridorMm: { width: 19.5, length: 15, centerYmm: 2 },
        fallbackProhibited: ["copper", "routing", "components"]
      },
      projectGeometry: {
        status: "official-cad-overlaid-placement-approved",
        placementAuthorized: true,
        placementReviewer: "root-final-reviewer",
        fabricationAuthorized: false
      }
    })
    expect(p0Esp32Wroom1FootprintMetadata.landPattern.perimeterPads.map(({ number }) => number)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1)
    )
    expect(p0Esp32Wroom1FootprintMetadata.orientation.pinOne).toEqual({ pad: 1, xMm: -8.75, yMm: 8.255 })
  })

  it("binds and hashes the retained official datasheet, DXF, and STEP artifacts", () => {
    const sources = p0Esp32Wroom1FootprintMetadata.officialSources
    expect(sha256(sources.datasheet.artifactPath)).toBe(sources.datasheet.sha256)
    expect(sha256(sources.footprintDxf.artifactPath)).toBe(sources.footprintDxf.sha256)
    expect(sha256(sources.mechanicalStep.artifactPath)).toBe(sources.mechanicalStep.sha256)
    expect(readFileSync(retainedArtifactUrl(sources.datasheet.artifactPath), "utf8")).toContain("%PDF")
    const step = readFileSync(retainedArtifactUrl(sources.mechanicalStep.artifactPath), "utf8")
    expect(step).toContain("ISO-10303-21;")
    expect(step).toContain("ESP32-S3-WROOM-1")
  })

  it("overlays the official DXF mask topology and published dimensions", () => {
    const source = p0Esp32Wroom1FootprintMetadata.officialSources.footprintDxf
    const dxf = readFileSync(retainedArtifactUrl(source.artifactPath), "utf8")
    const entities = dxfEntitiesInSection(dxf, "ENTITIES")
    const blocks = dxfEntitiesInSection(dxf, "BLOCKS")
    const layers = new Set([...entities, ...blocks].map(entityLayer))
    expect([...layers]).toEqual(expect.arrayContaining([...source.reviewedLayers]))

    const masks = entities.filter((entity) => entityLayer(entity) === "SOLDERMASKTOP_P")
    const moduleMasks = masks.filter((entity) => {
      const rectangle = bounds(entity)
      return rectangle.minX > 713 && rectangle.maxX < 734 && rectangle.minY > -190 && rectangle.maxY < -169
    })
    const perimeterMasks = moduleMasks.filter((entity) => {
      const rectangle = bounds(entity)
      return (
        (closeTo(width(rectangle), 1.5) && closeTo(height(rectangle), 0.9)) ||
        (closeTo(width(rectangle), 0.9) && closeTo(height(rectangle), 1.5))
      )
    })
    const exposedGroundViaMasks = moduleMasks.filter((entity) => {
      const rectangle = bounds(entity)
      return (
        closeTo(width(rectangle), 0.9) &&
        closeTo(height(rectangle), 0.9) &&
        entity.pairs.some(([code, value]) => code === "48" && closeTo(Number(value), 0.05, 0.0001))
      )
    })
    expect(perimeterMasks).toHaveLength(40)
    expect(exposedGroundViaMasks).toHaveLength(9)

    const dimensions = entities
      .filter((entity) => entity.type === "DIMENSION")
      .flatMap((entity) => entityValues(entity, "42"))
    for (const expected of [18, 25.5, 6, 16.51, 1.27, 3.7, 0.9, 0.5]) {
      expect(dimensions.some((actual) => closeTo(actual, expected, 0.01))).toBe(true)
    }
  })

  it("renders the official 40-land topology, EPAD vias, and antenna keepout with a terminal escape corridor", () => {
    const { artifacts, json } = footprintArtifacts()
    expect(json.filter((element) => element.type.includes("error"))).toEqual([])
    expect(artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(49)
    expect(json.filter((element) => element.type === "pcb_via")).toHaveLength(9)
    expect(json.filter((element) => element.type === "pcb_keepout")).toHaveLength(3)
    expect(json.filter((element) => element.type === "pcb_keepout")).toEqual([
      expect.objectContaining({ center: { x: 0, y: 20 }, width: 48, height: 21 }),
      expect.objectContaining({ center: { x: -16.875, y: 2 }, width: 14.25, height: 15 }),
      expect.objectContaining({ center: { x: 16.875, y: 2 }, width: 14.25, height: 15 })
    ])
    const pads = artifacts.filter((element) => element.type === "pcb_smtpad")
    const vias = json.filter((element) => element.type === "pcb_via")
    expect(pads[0]).toMatchObject({ x: -8.75, y: 8.255, width: 1.5, height: 0.9 })
    expect(pads[14]).toMatchObject({ x: -6.985, y: -9.5, width: 0.9, height: 1.5 })
    expect(vias[4]).toMatchObject({ x: -1.5, y: 0.5 })
  })
})
