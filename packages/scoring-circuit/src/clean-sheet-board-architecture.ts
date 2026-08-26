export const cleanSheetBoardArchitecture = {
  artifactKind: "clean-sheet-esp32-bench-board",
  workUnit: "BP-320",
  revision: "P0-CS-B",
  canonicalEntryPoint: "packages/scoring-circuit/src/index.circuit.tsx",
  board: {
    title: "ESP32 clean-sheet fencing scoring prototype",
    layerCount: 4,
    provisionalWidthMm: 360,
    provisionalHeightMm: 200,
    dimensionAuthority: "provisional-until-BP-010"
  },
  globalNets: [
    "APP_GND",
    "SCORING_SGND",
    "CHASSIS_SHIELD",
    "VBUS_CONTRACT",
    "V20_EFUSED",
    "V5",
    "APP_3V3",
    "V5_ANALOG",
    "VNEG_ANALOG",
    "VREF_2V5",
    "APP_RESET_N",
    "OUTPUT_PERMIT_N"
  ],
  sheets: [
    { id: "power-input", workUnit: "BP-321", state: "integrated" },
    { id: "power-rails", workUnit: "BP-322", state: "integrated" },
    { id: "esp32-reset-recovery", workUnit: "BP-323", state: "integrated" },
    { id: "ethernet", workUnit: "BP-324", state: "integrated" },
    { id: "encrypted-ir", workUnit: "BP-325", state: "integrated" },
    { id: "hub75", workUnit: "BP-326", state: "integrated" },
    { id: "primary-outputs", workUnit: "BP-327", state: "integrated" },
    { id: "reference-and-analog-rails", workUnit: "BP-328", state: "integrated" },
    { id: "phased-conductor-acquisition", workUnit: "BP-329", state: "integrated" },
    { id: "source-sink-sense-selection", workUnit: "BP-330", state: "integrated" },
    { id: "weapon-landings", workUnit: "BP-331", state: "integrated" },
    { id: "test-access-and-labels", workUnit: "BP-332", state: "integrated" }
  ],
  prohibitedActiveReferences: [
    "U_SCORING",
    "U_ISO_MAIN",
    "U_ISO_AUX",
    "U_ISO_POWER",
    "J_STM32_SWD",
    "U_FRAM",
    "U_RTC",
    "U_SECURE_ELEMENT",
    "U_AUDIO",
    "J_SPEAKER",
    "U_POWER_MONITOR",
    "R_V5_SENSE",
    "S_POWER_SOURCE_SELECTOR",
    "J_LAB_INJECTION"
  ],
  authority: {
    canonicalPrototypeSource: true,
    schematicIntegrated: true,
    pcbPlaced: true,
    pcbRouted: false,
    fabricationAuthorized: false
  }
} as const

export function validateCleanSheetBoardArchitecture(value: unknown): true {
  if (value !== cleanSheetBoardArchitecture) {
    throw new RangeError("BP-320 validation accepts only the canonical immutable architecture record")
  }
  if (
    cleanSheetBoardArchitecture.sheets.length !== 12 ||
    new Set(cleanSheetBoardArchitecture.sheets.map((sheet) => sheet.id)).size !== 12 ||
    new Set(cleanSheetBoardArchitecture.globalNets).size !== cleanSheetBoardArchitecture.globalNets.length ||
    !cleanSheetBoardArchitecture.authority.canonicalPrototypeSource ||
    !cleanSheetBoardArchitecture.authority.schematicIntegrated ||
    cleanSheetBoardArchitecture.sheets.some(({ state }) => state !== "integrated") ||
    !cleanSheetBoardArchitecture.authority.pcbPlaced ||
    cleanSheetBoardArchitecture.authority.pcbRouted ||
    cleanSheetBoardArchitecture.authority.fabricationAuthorized
  ) {
    throw new RangeError("BP-320 scaffold must remain canonical, unique, incomplete, and denied")
  }
  return true
}
