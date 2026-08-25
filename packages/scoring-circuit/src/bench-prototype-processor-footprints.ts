/** BP-032: sole-ESP32-S3 P0 processor footprint evidence ledger. */

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
  if (seen.has(value)) throw new RangeError("BP-032 processor footprint ledger cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 processor footprint ledger may contain only data properties")
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

const supportPackageByReference = {
  R_ESP_BOOT_PULLUP: "0603",
  R_ESP_EN_PULLUP: "0603",
  C_ESP_EN_DELAY: "0603",
  C_ESP_3V3_HF: "0603",
  C_ESP_3V3_BULK: "1210"
} as const

const definition = {
  artifactKind: "bench-prototype-processor-footprint-closure-ledger",
  workUnit: "BP-032",
  targetAssembly: "sole-ESP32-S3 P0 bench prototype",
  releaseState: "deny",
  populatedReferences: [
    {
      reference: "U_APP",
      mpn: "ESP32-S3-WROOM-1U-N16R2",
      package: "ESP32-S3-WROOM-1U module",
      population: "selected-awaiting-independent-layout-review",
      evidence: {
        sourceWorkUnits: ["BP-121", "BP-125"],
        manufacturerDatasheet: benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[0],
        manufacturerCad: benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[1],
        manufacturerModel: benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[2],
        candidateGeometry: {
          perimeterPads: 40,
          exposedGroundPad: 41,
          exposedGroundVias: 9,
          pinOne: "upper-left in the manufacturer top view",
          state: "candidate-only"
        },
        requiredReview: [
          "independent overlay and pin-one check",
          "EPAD via, paste, mask, and courtyard review",
          "external antenna cable, enclosure, and placement review"
        ],
        footprintEvidence: { accepted: false },
        fabricationAuthority: "deny",
        accepted: false
      }
    }
  ],
  processorSupportReferences: benchPrototypeProcessorSupport.selectedSupportRows.map((row) => ({
    reference: row.reference,
    mpn: row.mpn,
    selectedMpn: row.mpn,
    value: row.value,
    package: supportPackageByReference[row.reference],
    population: "selected-awaiting-independent-layout-review",
    reconciliation: "selected-by-BP-125",
    evidence: {
      upstreamContract: "BP-125",
      role: row.role,
      footprintState: "exact-part-package-known-layout-review-pending",
      manufacturerCad: "not-acquired",
      artwork: "not-generated",
      orientation: "pending-independent-review",
      footprintEvidence: { accepted: false },
      fabricationAuthority: "deny",
      accepted: false
    }
  })),
  clockReferences: [
    {
      reference: "X_ESP32_MODULE",
      mpn: "inside ESP32-S3-WROOM-1U-N16R2",
      population: "module-integrated",
      rule: "No host-board crystal or oscillator is populated on P0."
    }
  ],
  debugReferences: [],
  supersededFromP0: [
    "STM32 processor, clocks, backup domain, and SWD",
    "processor isolators, isolated-link power, and cross-domain reset",
    "populated service headers"
  ],
  requiredIndependentEvidence: [
    "ESP32 module overlay, pin-one, EPAD-via, paste, mask, and courtyard review",
    "ESP32 external antenna cable, enclosure, clearance, and retention review",
    "support-part package, orientation, and board-artwork review"
  ],
  evidence: {
    drawingCadEvidenceComplete: false,
    artworkGenerated: false,
    orientationReviewed: false,
    footprintClosure: false,
    fabricationAuthorized: false
  }
}

export const benchPrototypeProcessorFootprints = deepFreeze(definition)

export const benchPrototypeProcessorFootprintsUpstreamProvenance = deepFreeze({
  esp32ModuleMpn: benchPrototypeProcessorSupport.processor.mpn,
  supportReferences: benchPrototypeProcessorSupport.selectedSupportRows.map((row) => row.reference)
})

export const benchPrototypeProcessorFootprintsRetainedManufacturerSources = deepFreeze([
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[0],
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[1],
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[2]
])

export function validateBenchPrototypeProcessorFootprintsUpstreamProvenance(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeProcessorFootprintsUpstreamProvenance)) {
    throw new RangeError("BP-032 sole-ESP32 processor-support provenance drifted")
  }
  return true
}

export function validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeProcessorFootprintsRetainedManufacturerSources)) {
    throw new RangeError("BP-032 ESP32 manufacturer-source evidence drifted")
  }
  return true
}

/** Rejects stale dual-MCU references and premature footprint or fabrication approval. */
export function validateBenchPrototypeProcessorFootprints(value: unknown): true {
  validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)
  validateBenchPrototypeBp032Esp32Wroom1uFootprint(benchPrototypeBp032Esp32Wroom1uFootprintGeometry)
  if (!sameDataGraph(value, benchPrototypeProcessorFootprints)) {
    throw new RangeError("BP-032 processor footprint ledger must exactly match the reviewed sole-ESP32 contract")
  }
  validateBenchPrototypeProcessorFootprintsUpstreamProvenance({
    esp32ModuleMpn: benchPrototypeProcessorSupport.processor.mpn,
    supportReferences: benchPrototypeProcessorSupport.selectedSupportRows.map((row) => row.reference)
  })
  validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(
    benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources
  )
  const ledger = benchPrototypeProcessorFootprints
  const module = ledger.populatedReferences[0]
  if (
    module === undefined ||
    ledger.populatedReferences.length !== 1 ||
    module.mpn !== benchPrototypeProcessorSupport.processor.mpn ||
    module.evidence.candidateGeometry.perimeterPads !== 40 ||
    module.evidence.candidateGeometry.exposedGroundPad !== 41 ||
    module.evidence.candidateGeometry.exposedGroundVias !== 9 ||
    ledger.processorSupportReferences.length !== benchPrototypeProcessorSupport.selectedSupportRows.length ||
    ledger.processorSupportReferences.some(
      (row, index) =>
        row.reference !== benchPrototypeProcessorSupport.selectedSupportRows[index]?.reference ||
        row.mpn !== benchPrototypeProcessorSupport.selectedSupportRows[index]?.mpn ||
        row.selectedMpn !== row.mpn ||
        row.reconciliation !== "selected-by-BP-125" ||
        row.evidence.fabricationAuthority !== "deny" ||
        row.evidence.accepted
    ) ||
    ledger.clockReferences.length !== 1 ||
    ledger.clockReferences[0]?.population !== "module-integrated" ||
    ledger.debugReferences.length !== 0 ||
    ledger.supersededFromP0.some(
      (item) => !item.includes("STM32") && !item.includes("isolators") && !item.includes("service headers")
    ) ||
    ledger.evidence.drawingCadEvidenceComplete ||
    ledger.evidence.artworkGenerated ||
    ledger.evidence.orientationReviewed ||
    ledger.evidence.footprintClosure ||
    ledger.evidence.fabricationAuthorized ||
    ledger.releaseState !== "deny"
  ) {
    throw new RangeError("BP-032 must retain only the ESP32 P0 candidate and denied release gates")
  }
  return true
}
