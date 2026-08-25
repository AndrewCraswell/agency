/** BP-125: read-only reconciliation of the sole ESP32-S3 module candidate. */

import {
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry,
  validateBenchPrototypeBp032Esp32Wroom1uFootprint
} from "./bench-prototype-bp032-esp32-s3-wroom-1u-footprint.js"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"

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
  if (seen.has(value))
    throw new RangeError("BP-125 processor-footprint reconciliation cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-125 processor-footprint reconciliation may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  artifactKind: "bp125-processor-footprint-reconciliation",
  workUnit: "BP-125",
  scope: "sole-esp32-source-and-candidate-binding",
  retainedManufacturerSources: benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources,
  processorBindings: [
    {
      reference: "U_APP",
      exactMpn: "ESP32-S3-WROOM-1U-N16R2",
      package: "ESP32-S3-WROOM-1U module",
      candidateWorkUnit: "BP-032",
      candidatePath: "packages/scoring-circuit/src/bench-prototype-bp032-esp32-s3-wroom-1u-footprint.tsx",
      geometry: {
        perimeterPadCount: 40,
        exposedGroundPad: 41,
        exposedGroundVias: 9,
        bodyMm: { width: 18, length: 19.2, height: 3.2 },
        antenna: "external-antenna-connector-integrated",
        pinOne: "upper-left in candidate zero-degree top view"
      }
    }
  ],
  schematicChecklist: [
    {
      item: "ESP32-S3-WROOM-1U-N16R2 exact module, land pattern, and pin one",
      status: "source-bound-candidate-only",
      releaseGate: "independent-module-overlay-epad-via-paste-mask-and-courtyard-review"
    },
    {
      item: "ESP32 EN reset, boot strap, decoupling, and recovery support",
      status: "contract-input-only",
      releaseGate: "schematic-signoff-power-sequence-and-continuity-evidence"
    },
    {
      item: "External antenna cable, enclosure, clearance, and retention",
      status: "not-signed-off",
      releaseGate: "rf-cable-enclosure-and-placement-review"
    }
  ],
  upstreamContracts: {
    esp32: { workUnit: "BP-121", exactMpn: "ESP32-S3-WROOM-1U-N16R2" },
    support: { workUnit: "BP-125", source: "bench-prototype-processor-support" }
  },
  authority: {
    schematicIntegrationAuthorized: false,
    schematicSignoff: "deny",
    footprintApproval: false,
    layoutApproval: false,
    fabricationAuthorized: false
  }
}

export const benchPrototypeBp125ProcessorFootprintReconciliation = deepFreeze(definition)

/** Rejects dual-MCU resurrection and any escalation from candidate evidence. */
export function validateBenchPrototypeBp125ProcessorFootprintReconciliation(value: unknown): true {
  validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)
  validateBenchPrototypeBp032Esp32Wroom1uFootprint(benchPrototypeBp032Esp32Wroom1uFootprintGeometry)
  if (!sameDataGraph(value, benchPrototypeBp125ProcessorFootprintReconciliation)) {
    throw new RangeError(
      "BP-125 processor-footprint reconciliation must exactly match the reviewed sole-ESP32 contract"
    )
  }
  const reconciliation = benchPrototypeBp125ProcessorFootprintReconciliation
  const module = reconciliation.processorBindings[0]
  if (
    module === undefined ||
    reconciliation.processorBindings.length !== 1 ||
    module.exactMpn !== benchPrototypeProcessorSupport.processor.mpn ||
    module.geometry.perimeterPadCount !==
      benchPrototypeBp032Esp32Wroom1uFootprintGeometry.landPattern.perimeterCopper.padCount ||
    module.geometry.exposedGroundPad !== 41 ||
    module.geometry.exposedGroundVias !==
      benchPrototypeBp032Esp32Wroom1uFootprintGeometry.landPattern.exposedGroundPad.viaCount ||
    reconciliation.retainedManufacturerSources.length !== 3 ||
    reconciliation.schematicChecklist.length !== 3 ||
    reconciliation.authority.schematicIntegrationAuthorized ||
    reconciliation.authority.schematicSignoff !== "deny" ||
    reconciliation.authority.footprintApproval ||
    reconciliation.authority.layoutApproval ||
    reconciliation.authority.fabricationAuthorized
  ) {
    throw new RangeError("BP-125 must retain sole-ESP32 candidate evidence and denied release authority")
  }
  return true
}
