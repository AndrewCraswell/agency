import { describe, expect, it } from "vitest"
import P0Esp32Wroom1Footprint, { p0Esp32Wroom1FootprintMetadata } from "./p0-esp32-wroom-1-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

describe("P0 ESP32-S3-WROOM-1-N16R2 review footprint", () => {
  it("binds the selected module and records its integrated-antenna clearance", () => {
    expect(p0Esp32Wroom1FootprintMetadata.manufacturerPartNumber).toBe("ESP32-S3-WROOM-1-N16R2")
    expect(p0Esp32Wroom1FootprintMetadata.package).toMatchObject({
      bodyMm: { width: 18, length: 25.5, height: 3.1 },
      perimeterPadCount: 40,
      exposedGroundPad: 41
    })
    expect(p0Esp32Wroom1FootprintMetadata.integratedAntennaKeepout).toMatchObject({
      fallbackClearanceMm: 15,
      prohibited: ["copper", "routing", "components"]
    })
    expect(p0Esp32Wroom1FootprintMetadata.projectGeometry.fabricationAuthorized).toBe(false)
  })

  it("renders the module with 40 perimeter lands, nine EPAD vias, and antenna keepout metadata", () => {
    const circuitJson = renderTestCircuit(
      <board width="100mm" height="100mm">
        <P0Esp32Wroom1Footprint pcbX={0} pcbY={-25} />
      </board>
    )
    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    const source = circuitJson.find((element) => element.type === "source_component" && element.name === "U_APP")
    expect(source).toMatchObject({ manufacturer_part_number: "ESP32-S3-WROOM-1-N16R2" })
    const pcb = circuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        source !== undefined &&
        "source_component_id" in source &&
        element.source_component_id === source.source_component_id
    )
    expect(pcb).toBeDefined()
    if (pcb === undefined || !("pcb_component_id" in pcb)) return
    const artifacts = circuitJson.filter(
      (element) => "pcb_component_id" in element && element.pcb_component_id === pcb.pcb_component_id
    )
    expect(artifacts.filter((element) => element.type === "pcb_smtpad")).toHaveLength(40)
    expect(artifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(9)
    expect(circuitJson.filter((element) => element.type === "pcb_keepout")).toHaveLength(1)
  })
})
