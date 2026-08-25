import { describe, expect, it } from "vitest"
import { cleanSheetBoardArchitecture, validateCleanSheetBoardArchitecture } from "./clean-sheet-board-architecture.js"

describe("BP-320 clean-sheet board architecture", () => {
  it("defines one canonical scaffold and the complete schematic hierarchy", () => {
    expect(validateCleanSheetBoardArchitecture(cleanSheetBoardArchitecture)).toBe(true)
    expect(cleanSheetBoardArchitecture.canonicalEntryPoint).toBe("packages/scoring-circuit/src/index.circuit.tsx")
    expect(cleanSheetBoardArchitecture.sheets.map((sheet) => sheet.workUnit)).toEqual([
      "BP-321",
      "BP-322",
      "BP-323",
      "BP-324",
      "BP-325",
      "BP-326",
      "BP-327",
      "BP-328",
      "BP-329",
      "BP-330",
      "BP-331",
      "BP-332"
    ])
  })

  it("contains the required clean-sheet global nets", () => {
    expect(cleanSheetBoardArchitecture.globalNets).toEqual(
      expect.arrayContaining([
        "APP_GND",
        "SCORING_SGND",
        "CHASSIS_SHIELD",
        "V20_EFUSED",
        "V5",
        "APP_3V3",
        "VNEG_ANALOG",
        "VREF_2V5",
        "APP_RESET_N",
        "OUTPUT_PERMIT_N"
      ])
    )
  })

  it("prohibits former dual-MCU and optional circuitry", () => {
    expect(cleanSheetBoardArchitecture.prohibitedActiveReferences).toEqual(
      expect.arrayContaining([
        "U_SCORING",
        "U_ISO_MAIN",
        "J_STM32_SWD",
        "U_FRAM",
        "U_AUDIO",
        "U_POWER_MONITOR",
        "R_V5_SENSE",
        "S_POWER_SOURCE_SELECTOR"
      ])
    )
  })

  it("does not grant schematic, PCB, or fabrication authority", () => {
    expect(cleanSheetBoardArchitecture.authority).toEqual({
      canonicalPrototypeSource: true,
      schematicIntegrated: false,
      pcbPlacedOrRouted: false,
      fabricationAuthorized: false
    })
    expect(() => validateCleanSheetBoardArchitecture(structuredClone(cleanSheetBoardArchitecture))).toThrow(RangeError)
  })
})
