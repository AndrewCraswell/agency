import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp032TiResetWatchdogFootprintGeometry,
  BenchPrototypeBp032TiTps3431sdrbrFootprint,
  BenchPrototypeBp032TiTps389033dserFootprint,
  validateBenchPrototypeBp032TiResetWatchdogFootprints
} from "./bench-prototype-bp032-ti-reset-watchdog-footprints.js"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import { renderTestCircuit } from "./test-helper.js"

const geometry = benchPrototypeBp032TiResetWatchdogFootprintGeometry

function retainedArtifactUrl(artifactPath: string): URL {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return new URL(`../${packageRelativePath}`, import.meta.url)
}

function verifySourceHash(source: { readonly artifactPath: string; readonly sha256: string }): void {
  const bytes = readFileSync(retainedArtifactUrl(source.artifactPath))
  expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
}

describe("BP-032 exact TI reset/watchdog candidate footprints", () => {
  it("binds exact MPNs, packages, pin maps, land dimensions, and source hashes", () => {
    expect(validateBenchPrototypeBp032TiResetWatchdogFootprints(geometry)).toBe(true)
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
    const tps3431 = geometry.candidates.TPS3431SDRBR
    const tps3890 = geometry.candidates.TPS389033DSER

    expect(tps3431).toMatchObject({
      manufacturerPartNumber: "TPS3431SDRBR",
      package: { family: "VSON-8", packageDrawing: "DRB0008A", pinCount: 8, exposedThermalPad: true }
    })
    expect(tps3431.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "VDD"],
      [2, "CWD"],
      [3, "EN"],
      [4, "GND"],
      [5, "SET1"],
      [6, "WDI"],
      [7, "WDO"],
      [8, "ENOUT"]
    ])
    expect(tps3431.landPattern.perimeterCopper).toMatchObject({
      padCount: 8,
      padDimensionsMm: { lengthMm: 0.6, widthMm: 0.31 },
      sideRowPitchMm: 0.65,
      sideRowSpanMm: 1.95
    })
    expect(tps3431.landPattern.exposedThermalPad).toMatchObject({
      copperEnvelopeMm: { widthMm: 1.5, lengthMm: 1.75 },
      viaCount: 4,
      viaLocations: [
        { xMm: 0, yMm: 0.625, drillDiameterMm: 0.2 },
        { xMm: -0.625, yMm: 0, drillDiameterMm: 0.2 },
        { xMm: 0.625, yMm: 0, drillDiameterMm: 0.2 },
        { xMm: 0, yMm: -0.625, drillDiameterMm: 0.2 }
      ]
    })
    expect(tps3431.landPattern.paste.thermalPad).toMatchObject({
      stencilThicknessMm: 0.125,
      printedCoveragePercent: 84,
      drawnEnvelopeMm: { widthMm: 1.34, lengthMm: 1.55 }
    })

    expect(tps3890).toMatchObject({
      manufacturerPartNumber: "TPS389033DSER",
      package: { family: "WSON-6", packageDrawing: "DSE0006A", pinCount: 6, exposedThermalPad: false }
    })
    expect(tps3890.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "SENSE"],
      [2, "GND"],
      [3, "MR"],
      [4, "VDD"],
      [5, "CT"],
      [6, "RESET"]
    ])
    expect(tps3890.landPattern.perimeterCopper).toMatchObject({
      padCount: 6,
      padDimensionsMm: { lengthMm: 0.7, widthMm: 0.25 },
      sideRowPitchMm: 0.5,
      sideRowSpanMm: 1
    })
    expect(tps3890.landPattern.paste).toMatchObject({
      stencilThicknessMm: 0.125,
      apertureMm: { lengthMm: 0.7, widthMm: 0.25, count: 6 }
    })

    for (const source of [...tps3431.officialSources, ...tps3890.officialSources]) verifySourceHash(source)

    const upstreamBytes = readFileSync(retainedArtifactUrl(geometry.upstreamSelection.sourcePath))
    expect(createHash("sha256").update(upstreamBytes).digest("hex").toUpperCase()).toBe(
      geometry.upstreamSelection.sourceSha256
    )
    expect(benchPrototypeResetWatchdog.parts).toEqual(
      expect.arrayContaining(
        geometry.upstreamSelection.parts.map((expected) =>
          expect.objectContaining({ reference: expected.reference, mpn: expected.manufacturerPartNumber })
        )
      )
    )
  })

  it("records mask, orientation, and CAD limits without releasing fabrication geometry", () => {
    const tps3431 = geometry.candidates.TPS3431SDRBR
    const tps3890 = geometry.candidates.TPS389033DSER
    expect(tps3431.landPattern.solderMask).toMatchObject({
      preferredDefinition: "NSMD",
      nsmdOpeningExpansionMaxMm: 0.07,
      smdOpeningOverlapMinMm: 0.07
    })
    expect(tps3890.landPattern.solderMask).toMatchObject({
      pads1to3: { definition: "SMD", openingOverlapMinMm: 0.05 },
      pads4to6: { definition: "NSMD preferred", openingExpansionMaxMm: 0.05 }
    })
    expect(tps3431.orientation.pinOne).toMatchObject({ number: 1, xMm: -1.1, yMm: 0.975 })
    expect(tps3890.orientation.pinOne).toMatchObject({ number: 1, xMm: -0.6, yMm: 0.5 })
    for (const candidate of [tps3431, tps3890]) {
      expect(candidate.manufacturerCad).toMatchObject({
        state: "not-retained-official-cad",
        officialCadArtifact: null,
        courtyard: "not-published-by-TI"
      })
      expect(candidate.landPattern.courtyard).toEqual({
        status: "not-published",
        geometry: null,
        disposition: "do-not-infer-courtyard-from-package-outline"
      })
      expect(candidate.fabricationAuthority).toBe("deny")
      expect(candidate.accepted).toBe(false)
    }
  })

  it("renders the bounded copper candidates without an unreviewed courtyard", () => {
    const tps3431Json = renderTestCircuit(<BenchPrototypeBp032TiTps3431sdrbrFootprint />)
    const tps3890Json = renderTestCircuit(<BenchPrototypeBp032TiTps389033dserFootprint />)

    const countArtifacts = (json: ReturnType<typeof renderTestCircuit>, partNumber: string) => {
      const source = json.find(
        (element) => element.type === "source_component" && element.manufacturer_part_number === partNumber
      )
      expect(source).toBeDefined()
      const pcb = json.find(
        (element) =>
          element.type === "pcb_component" &&
          source !== undefined &&
          "source_component_id" in source &&
          element.source_component_id === source.source_component_id
      )
      expect(pcb).toBeDefined()
      if (pcb === undefined || !("pcb_component_id" in pcb)) return []
      return json.filter(
        (element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id
      )
    }

    const tps3431Artifacts = countArtifacts(tps3431Json, "TPS3431SDRBR")
    expect(tps3431Artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(9)
    expect(tps3431Artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(4)
    expect(tps3431Artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pcb_smtpad",
          shape: "rect",
          x: -1.1,
          y: 0.975,
          width: 0.6,
          height: 0.31
        }),
        expect.objectContaining({ type: "pcb_smtpad", shape: "rect", x: 0, y: 0, width: 1.5, height: 1.75 }),
        expect.objectContaining({
          type: "pcb_plated_hole",
          shape: "circular_hole_with_rect_pad",
          x: 0,
          y: 0.625,
          hole_diameter: 0.2,
          rect_pad_width: 0.23,
          rect_pad_height: 0.23
        })
      ])
    )
    expect(tps3431Artifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(8)
    expect(tps3431Artifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)

    const tps3890Artifacts = countArtifacts(tps3890Json, "TPS389033DSER")
    expect(tps3890Artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(6)
    expect(tps3890Artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(0)
    expect(tps3890Artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pcb_smtpad",
          shape: "rect",
          x: -0.6,
          y: 0.5,
          width: 0.7,
          height: 0.25
        }),
        expect.objectContaining({
          type: "pcb_smtpad",
          shape: "rect",
          x: 0.6,
          y: -0.5,
          width: 0.7,
          height: 0.25
        })
      ])
    )
    expect(tps3890Artifacts.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(6)
    expect(tps3890Artifacts.filter((element) => element.type === "pcb_courtyard_outline")).toHaveLength(0)
  })

  it("rejects upstream-identity, copper, and fabrication-authority drift", () => {
    const selectionDrift = structuredClone(geometry)
    Reflect.set(selectionDrift.upstreamSelection.parts[0], "manufacturerPartNumber", "TPS389031DSER")
    expect(() => validateBenchPrototypeBp032TiResetWatchdogFootprints(selectionDrift)).toThrow(RangeError)

    const geometryDrift = structuredClone(geometry)
    Reflect.set(geometryDrift.candidates.TPS3431SDRBR.landPattern.exposedThermalPad, "viaCount", 3)
    expect(() => validateBenchPrototypeBp032TiResetWatchdogFootprints(geometryDrift)).toThrow(RangeError)

    const authorityDrift = structuredClone(geometry)
    Reflect.set(authorityDrift.candidates.TPS389033DSER, "fabricationAuthority", "allow")
    expect(() => validateBenchPrototypeBp032TiResetWatchdogFootprints(authorityDrift)).toThrow(RangeError)
  })
})
