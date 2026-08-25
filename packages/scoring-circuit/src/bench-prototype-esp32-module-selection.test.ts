import { describe, expect, it } from "vitest"
import {
  benchPrototypeEsp32ModuleSelection,
  validateBenchPrototypeEsp32ModuleSelection
} from "./bench-prototype-esp32-module-selection.js"

describe("BP-120 integrated-antenna ESP32-S3 module selection", () => {
  it("selects the active WROOM-1 N16R2 replacement without reducing memory", () => {
    expect(validateBenchPrototypeEsp32ModuleSelection(benchPrototypeEsp32ModuleSelection)).toBe(true)
    expect(benchPrototypeEsp32ModuleSelection.selection).toEqual(
      expect.objectContaining({
        obsoleteMpn: "ESP32-S3-WROOM-1U-N16R2",
        exactMpn: "ESP32-S3-WROOM-1-N16R2",
        antenna: "integrated-on-module-pcb",
        flash: { capacityMb: 16, bus: "Quad SPI" },
        psram: { capacityMb: 2, bus: "Quad SPI" }
      })
    )
  })

  it("records the changed mechanical CAD identity and the manufacturer antenna keepout", () => {
    expect(benchPrototypeEsp32ModuleSelection.packageAndCadIdentity).toMatchObject({
      bodyMm: { width: 18, length: 25.5, height: 3.1 },
      modulePads: { perimeterTerminals: 40, exposedGroundPad: 41, perimeterPitchMm: 1.27 }
    })
    expect(benchPrototypeEsp32ModuleSelection.rfPlacement.ifAntennaCannotExtendPastBoard).toEqual({
      clearanceMm: 15,
      clearanceAppliesIn: "all directions around the antenna area",
      prohibitedInClearance: ["copper", "routing", "components"],
      baseBoardDisposition: "cut away the base board below the antenna area to minimize its effect"
    })
  })

  it("lists every external-antenna assumption as a required migration and denies implementation", () => {
    expect(benchPrototypeEsp32ModuleSelection.migration).toHaveLength(8)
    expect(benchPrototypeEsp32ModuleSelection.migration.map(({ obsoleteAssumption }) => obsoleteAssumption)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("external antenna"),
        expect.stringContaining("1U module body"),
        expect.stringContaining("PCB-antenna keepout")
      ])
    )
    expect(benchPrototypeEsp32ModuleSelection.authority).toEqual({
      selectionRecorded: true,
      schematicAuthorized: false,
      bomAuthorized: false,
      pinMapAuthorized: false,
      footprintAuthorized: false,
      boardLayoutAuthorized: false,
      fabricationAuthorized: false
    })
  })

  it("rejects a return to the 1U module or implementation-authority escalation", () => {
    const stale = structuredClone(benchPrototypeEsp32ModuleSelection)
    Reflect.set(stale.selection, "exactMpn", "ESP32-S3-WROOM-1U-N16R2")
    expect(() => validateBenchPrototypeEsp32ModuleSelection(stale)).toThrow(RangeError)

    const released = structuredClone(benchPrototypeEsp32ModuleSelection)
    Reflect.set(released.authority, "boardLayoutAuthorized", true)
    expect(() => validateBenchPrototypeEsp32ModuleSelection(released)).toThrow(RangeError)
  })
})
