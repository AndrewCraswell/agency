/** BP-120: clean-sheet selection for the application ESP32-S3 module. */

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-120 selection cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-120 selection accepts data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const definition = {
  artifactKind: "bp120-esp32-module-selection",
  workUnit: "BP-120",
  reviewedOn: "2026-08-25",
  selection: {
    reference: "U_APP",
    manufacturer: "Espressif Systems",
    obsoleteMpn: "ESP32-S3-WROOM-1U-N16R2",
    exactMpn: "ESP32-S3-WROOM-1-N16R2",
    antenna: "integrated-on-module-pcb",
    flash: { capacityMb: 16, bus: "Quad SPI" },
    psram: { capacityMb: 2, bus: "Quad SPI" },
    ambientTemperatureC: { minimum: -40, maximum: 85 }
  },
  lifecycleAndSources: {
    lifecycle: {
      status: "current-manufacturer-catalog-listing",
      evidence: "Espressif lists the exact MPN with distributor purchase links and a bulk-order path.",
      inventoryCommitment: "not-established; obtain an authorized-distributor quote before release"
    },
    officialSources: [
      {
        id: "module-datasheet-v1-8",
        url: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
        reviewedSections: ["1.1", "1.2", "3", "6", "10", "11"],
        role: "Exact N16R2 memory, antenna option, supply range, pad identity, dimensions, and land-pattern source."
      },
      {
        id: "manufacturer-module-catalog",
        url: "https://www.espressif.com/en/products/modules/esp32-s3/esp32-s3-wroom-1",
        reviewedSections: ["ESP32-S3-WROOM-1 product row", "exact MPN listing", "bulk-order path"],
        role: "Current manufacturer catalog and orderability evidence for ESP32-S3-WROOM-1-N16R2."
      },
      {
        id: "official-footprint-dxf",
        url: "https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1%20PCB%20Footprint.dxf",
        reviewedSections: ["official downloadable CAD"],
        role: "Exact WROOM-1 copper and mask CAD input; import and overlay it before a footprint release."
      },
      {
        id: "official-3d-step",
        url: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1%203D%20Model.STEP",
        reviewedSections: ["official downloadable CAD"],
        role: "Exact WROOM-1 mechanical CAD input; use it for enclosure and placement review."
      },
      {
        id: "esp32-s3-hardware-design-guidelines",
        url: "https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/pcb-layout-design.html",
        reviewedSections: ["General Principles of PCB Layout for Modules"],
        role: "Integrated PCB antenna placement, clearance, housing, and end-product RF verification requirements."
      }
    ]
  },
  packageAndCadIdentity: {
    package: "ESP32-S3-WROOM-1 module",
    bodyMm: { width: 18, length: 25.5, height: 3.1 },
    modulePads: { perimeterTerminals: 40, exposedGroundPad: 41, perimeterPitchMm: 1.27 },
    authoritativeCad: {
      footprint: "official-footprint-dxf",
      mechanical: "official-3d-step",
      requiredAction:
        "replace the 1U land pattern and perform an independent overlay; do not infer compatibility from pin count"
    }
  },
  power: {
    supplyVoltageV: { minimum: 3, maximum: 3.6 },
    supplyPins: ["VDD33"],
    groundPins: ["GND", "EPAD"],
    preservedRequirement:
      "The existing 3.3 V rail remains within the module supply range; current, decoupling, reset, and boot support require schematic re-review."
  },
  rfPlacement: {
    antenna: "module-integrated PCB antenna",
    preferredPlacement: "Place the antenna outside the base-board edge with its feed point close to that edge.",
    ifAntennaCannotExtendPastBoard: {
      clearanceMm: 15,
      clearanceAppliesIn: "all directions around the antenna area",
      prohibitedInClearance: ["copper", "routing", "components"],
      baseBoardDisposition: "cut away the base board below the antenna area to minimize its effect"
    },
    enclosureAndVerification:
      "Keep metal housing away from the antenna area and verify final-product throughput and communication range."
  },
  migration: [
    {
      obsoleteAssumption: "U_APP is ESP32-S3-WROOM-1U-N16R2.",
      requiredReplacement:
        "Use the exact MPN ESP32-S3-WROOM-1-N16R2 while retaining 16 MB Quad-SPI flash and 2 MB Quad-SPI PSRAM."
    },
    {
      obsoleteAssumption: "The module antenna is an integrated external-antenna connector.",
      requiredReplacement:
        "Represent the selected antenna as the WROOM-1 on-module PCB antenna; no RF connector is present on the selected module."
    },
    {
      obsoleteAssumption:
        "An external antenna, U.FL/MHF I/AMC mate, coaxial cable, retention, cable exit, and cable routing are required.",
      requiredReplacement:
        "Remove those module-level RF-chain requirements and review enclosure clearance around the integrated PCB antenna instead."
    },
    {
      obsoleteAssumption: "A 1U module body of 18.0 by 19.2 by 3.2 mm defines the placement envelope.",
      requiredReplacement:
        "Use the WROOM-1 body of 18.0 by 25.5 by 3.1 mm and the official WROOM-1 STEP model for mechanical review."
    },
    {
      obsoleteAssumption:
        "The 1U DXF, STEP model, footprint geometry, EPAD-via placement, and courtyard review apply to the selected module.",
      requiredReplacement:
        "Replace them with the WROOM-1 official DXF and STEP sources and independently overlay the complete land pattern before approval."
    },
    {
      obsoleteAssumption: "PCB-antenna keepout is not applicable to the external-antenna module.",
      requiredReplacement:
        "Apply the WROOM-1 integrated-antenna placement rule: antenna outside the base board when possible, otherwise at least 15 mm clear in all directions with no copper, routing, or components."
    },
    {
      obsoleteAssumption: "External-antenna cable and installed-antenna RF testing close the RF path.",
      requiredReplacement:
        "Test the finished enclosure and board for throughput and communication range with the integrated PCB antenna."
    },
    {
      obsoleteAssumption:
        "Matching pad count implies a drop-in schematic, pin-map, power, reset, boot, or assembly replacement.",
      requiredReplacement:
        "Re-review the WROOM-1 pin table, supply/decoupling, EN/reset, boot straps, assembly stencil, and placement before changing any controlled artifact."
    }
  ],
  authority: {
    selectionRecorded: true,
    schematicAuthorized: false,
    bomAuthorized: false,
    pinMapAuthorized: false,
    footprintAuthorized: false,
    boardLayoutAuthorized: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeEsp32ModuleSelection = deepFreeze(definition)

/** Ensures consumers cannot turn the selection artifact into board-change authority. */
export function validateBenchPrototypeEsp32ModuleSelection(value: unknown): true {
  if (!isPlainRecord(value)) throw new RangeError("BP-120 selection must be a plain data object")
  if (
    value.artifactKind !== "bp120-esp32-module-selection" ||
    value.workUnit !== "BP-120" ||
    !isPlainRecord(value.selection) ||
    value.selection.exactMpn !== "ESP32-S3-WROOM-1-N16R2" ||
    value.selection.obsoleteMpn !== "ESP32-S3-WROOM-1U-N16R2" ||
    value.selection.antenna !== "integrated-on-module-pcb" ||
    !isPlainRecord(value.packageAndCadIdentity) ||
    !isPlainRecord(value.rfPlacement) ||
    !isPlainRecord(value.authority) ||
    value.authority.schematicAuthorized !== false ||
    value.authority.bomAuthorized !== false ||
    value.authority.pinMapAuthorized !== false ||
    value.authority.footprintAuthorized !== false ||
    value.authority.boardLayoutAuthorized !== false ||
    value.authority.fabricationAuthorized !== false
  ) {
    throw new RangeError("BP-120 must retain the selected WROOM-1 N16R2 and denied implementation authority")
  }
  return true
}
