import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  p0Esp32SupportFootprintGeometry,
  p0Esp32SupportFootprintMetadata,
  P0Esp32SupervisorFootprint,
  P0Esp32WatchdogFootprint
} from "./p0-esp32-support-footprints.js"
import { renderTestCircuit } from "./test-helper.js"

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

function artifactsFor(json: ReturnType<typeof renderTestCircuit>, manufacturerPartNumber: string) {
  const source = json.find(
    (element) => element.type === "source_component" && element.manufacturer_part_number === manufacturerPartNumber
  )
  expect(source).toBeDefined()
  if (source === undefined || !("source_component_id" in source)) return []
  const pcb = json.find(
    (element) =>
      element.type === "pcb_component" &&
      "source_component_id" in element &&
      element.source_component_id === source.source_component_id
  )
  expect(pcb).toBeDefined()
  if (pcb === undefined || !("pcb_component_id" in pcb)) return []
  return json.filter((element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id)
}

describe("P0-06 ESP32 support reset/watchdog footprints", () => {
  it("binds exact TI orderables, package drawings, orientation, and non-BOM test-pad policy", () => {
    expect(p0Esp32SupportFootprintMetadata).toMatchObject({
      artifactKind: "p0-06-esp32-support-footprints",
      workUnit: "P0-06",
      placementAuthority: "approved",
      placementReviewer: "root-final-reviewer",
      components: {
        supervisor: {
          reference: "U_APP_SUPERVISOR",
          manufacturerPartNumber: "TPS389033DSER",
          package: "WSON-6 / DSE0006A",
          pinOne: "upper-left in TI top view",
          fabricationAuthority: "deny"
        },
        watchdog: {
          reference: "U_APP_WATCHDOG",
          manufacturerPartNumber: "TPS3431SDRBR",
          package: "VSON-8 / DRB0008A",
          pinOne: "upper-left in TI top view",
          fabricationAuthority: "deny"
        }
      },
      recoveryTestPoints: {
        classification: "non-BOM board feature",
        footprint: "1 mm circular surface pad"
      }
    })
    const supervisor = p0Esp32SupportFootprintGeometry.candidates.TPS389033DSER
    const watchdog = p0Esp32SupportFootprintGeometry.candidates.TPS3431SDRBR
    expect(supervisor.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "SENSE"],
      [2, "GND"],
      [3, "MR"],
      [4, "VDD"],
      [5, "CT"],
      [6, "RESET"]
    ])
    expect(supervisor.orientation.pinOne).toMatchObject({ number: 1, xMm: -0.6, yMm: 0.5 })
    expect(watchdog.pinMap.map((pin) => [pin.number, pin.name])).toEqual([
      [1, "VDD"],
      [2, "CWD"],
      [3, "EN"],
      [4, "GND"],
      [5, "SET1"],
      [6, "WDI"],
      [7, "WDO"],
      [8, "ENOUT"]
    ])
    expect(watchdog.orientation.pinOne).toMatchObject({ number: 1, xMm: -1.1, yMm: 0.975 })
    expect(p0Esp32SupportFootprintMetadata.recoveryTestPoints.references).toHaveLength(6)
  })

  it("hashes the retained official TI datasheets used for the land patterns", () => {
    const [supervisorSource] = p0Esp32SupportFootprintGeometry.candidates.TPS389033DSER.officialSources
    const [watchdogSource] = p0Esp32SupportFootprintGeometry.candidates.TPS3431SDRBR.officialSources
    expect(sha256(supervisorSource.artifactPath)).toBe(supervisorSource.sha256)
    expect(sha256(watchdogSource.artifactPath)).toBe(watchdogSource.sha256)
  })

  it("renders both support ICs as populated, placeable footprints", () => {
    const supervisorArtifacts = artifactsFor(
      renderTestCircuit(<P0Esp32SupervisorFootprint pcbX={-5} pcbY={4} />),
      "TPS389033DSER"
    )
    expect(supervisorArtifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(6)
    expect(supervisorArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_smtpad", x: -5.6, y: 4.5, width: 0.7, height: 0.25 })
      ])
    )

    const watchdogArtifacts = artifactsFor(
      renderTestCircuit(<P0Esp32WatchdogFootprint pcbX={5} pcbY={4} />),
      "TPS3431SDRBR"
    )
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(9)
    expect(watchdogArtifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(4)
    expect(watchdogArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "pcb_smtpad", x: 3.9, y: 4.975, width: 0.6, height: 0.31 }),
        expect.objectContaining({ type: "pcb_plated_hole", x: 5, y: 4.625, hole_diameter: 0.2 })
      ])
    )
  })
})
