/**
 * BP-125: read-only reconciliation between the processor-support contract,
 * retained manufacturer sources, and the isolated BP-032 footprint candidates.
 *
 * This is deliberately not a board import or a fabrication release. It avoids
 * copying footprint geometry into BP-125: the candidate that owns each pad
 * list remains the separately reviewed BP-032 artifact.
 */

import {
  benchPrototypeBp032Esp32Wroom1uFootprintGeometry,
  validateBenchPrototypeBp032Esp32Wroom1uFootprint
} from "./bench-prototype-bp032-esp32-s3-wroom-1u-footprint.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"
import {
  bp032Stm32G474Ret3TrLqfp64FootprintEvidence,
  validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence
} from "./bp032-stm32g474ret3tr-lqfp64-footprint.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

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
  if (seen.has(value)) throw new RangeError("BP-125 processor reconciliation cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-125 processor reconciliation may contain only data properties")
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
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
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
    const left = Object.getOwnPropertyDescriptor(actual, key)
    const right = Object.getOwnPropertyDescriptor(expected, key)
    return (
      left !== undefined &&
      right !== undefined &&
      "value" in left &&
      "value" in right &&
      left.enumerable === right.enumerable &&
      sameDataGraph(left.value, right.value, actualSeen, expectedSeen)
    )
  })
}

const processorFootprintReconciliationDefinition = {
  artifactKind: "bp125-processor-footprint-reconciliation",
  workUnit: "BP-125",
  scope: "read-only-checklist-and-candidate-binding",
  retainedManufacturerSources: [
    {
      processor: "STM32G474RET3TR",
      manufacturer: "STMicroelectronics",
      document: "DS12288 Rev 6",
      officialUrl: "https://www.st.com/resource/en/datasheet/stm32g474re.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf",
      sha256: "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD",
      reviewedPages: {
        packageIdentity: [232],
        lqfp64Drawing: [210, 211, 212],
        powerAndBoot: [21, 25, 108]
      }
    },
    {
      processor: "ESP32-S3-WROOM-1U-N16R2",
      manufacturer: "Espressif Systems",
      document: "ESP32-S3-WROOM-1 & WROOM-1U Datasheet v1.8",
      officialUrl: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
      artifactPath:
        "packages/scoring-circuit/docs/evidence/bp-125/espressif-esp32-s3-wroom-1-wroom-1u-datasheet-v1.8.pdf",
      sha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435",
      reviewedPages: {
        exactVariant: [3],
        pinsAndSupply: [10, 11, 12],
        resetSupport: [41],
        moduleAndLandPattern: [42, 45, 46]
      }
    }
  ],
  processorBindings: [
    {
      reference: "U_SCORING",
      exactMpn: "STM32G474RET3TR",
      package: "LQFP64",
      candidateWorkUnit: "BP-032",
      candidatePath: "packages/scoring-circuit/src/bp032-stm32g474ret3tr-lqfp64-footprint.tsx",
      sourceBinding: "shared-retained-bp125-ds12288-bytes",
      geometry: {
        padCount: 64,
        bodyMm: { width: 10, length: 10 },
        leadPitchMm: 0.5,
        copperPadMm: { width: 0.3, length: 1.2 },
        pinOne: "lower-left in candidate zero-degree top view"
      }
    },
    {
      reference: "U_APP",
      exactMpn: "ESP32-S3-WROOM-1U-N16R2",
      package: "ESP32-S3-WROOM-1U module",
      candidateWorkUnit: "BP-032",
      candidatePath: "packages/scoring-circuit/src/bench-prototype-bp032-esp32-s3-wroom-1u-footprint.tsx",
      sourceBinding: "byte-identical-bp032-copy-of-retained-bp125-espressif-datasheet",
      geometry: {
        perimeterPadCount: 40,
        exposedGroundPad: 41,
        bodyMm: { width: 18, length: 19.2, height: 3.2 },
        antenna: "external-antenna-connector-integrated",
        pinOne: "upper-left in candidate zero-degree top view"
      }
    }
  ],
  schematicChecklist: [
    {
      item: "STM32 exact orderable and LQFP64 geometry",
      status: "source-bound-candidate-only",
      evidence: "DS12288 Rev 6 Table 124 and Figures 62 through 64",
      releaseGate: "independent-overlay-orientation-mask-paste-and-courtyard-review"
    },
    {
      item: "STM32 power, boot, clock, and unused-pad policy",
      status: "contract-input-only",
      evidence: "DS12288 Rev 6 sections 3.7, 3.11, 3.13, 3.14, and 5.3.5",
      releaseGate: "schematic-signoff-and-timing-validation"
    },
    {
      item: "ESP32-S3-WROOM-1U-N16R2 exact variant and module land pattern",
      status: "source-bound-candidate-only",
      evidence: "Espressif Datasheet v1.8 Table 1-2 and Figures 10-2 and 11-2",
      releaseGate: "independent-module-overlay-ep-ad-via-paste-and-courtyard-review"
    },
    {
      item: "ESP32 EN reset support, boot strap, supply, and exposed ground pad",
      status: "contract-input-only",
      evidence: "Espressif Datasheet v1.8 Table 3-1 and section 9",
      releaseGate: "schematic-signoff-power-sequence-and-continuity-evidence"
    },
    {
      item: "External antenna connector and cable/enclosure clearance",
      status: "not-signed-off",
      evidence: "Espressif Datasheet v1.8 sections 10.2 and 11.2",
      releaseGate: "rf-cable-enclosure-and-placement-review"
    }
  ],
  upstreamContracts: {
    stm32: { workUnit: "BP-120", exactMpn: "STM32G474RET3TR", source: "stm32-pin-allocation" },
    esp32: { workUnit: "BP-121", exactMpn: "ESP32-S3-WROOM-1U-N16R2", source: "bench-prototype-esp32-allocation" },
    support: { workUnit: "BP-125", source: "bench-prototype-processor-support" }
  },
  authority: {
    schematicIntegrationAuthorized: false,
    schematicSignoff: "deny",
    footprintApproval: false,
    layoutApproval: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeBp125ProcessorFootprintReconciliation = deepFreeze(
  processorFootprintReconciliationDefinition
)

/**
 * Reject upstream MPN drift and any attempt to turn retained-source candidate
 * evidence into board or fabrication authority.
 */
export function validateBenchPrototypeBp125ProcessorFootprintReconciliation(value: unknown): true {
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)
  if (!sameDataGraph(value, benchPrototypeBp125ProcessorFootprintReconciliation)) {
    throw new RangeError("BP-125 processor-footprint reconciliation must exactly match the reviewed contract")
  }
  if (validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence().length !== 0) {
    throw new RangeError("BP-125 STM32 binding requires a valid isolated BP-032 candidate")
  }
  validateBenchPrototypeBp032Esp32Wroom1uFootprint(benchPrototypeBp032Esp32Wroom1uFootprintGeometry)

  const reconciliation = benchPrototypeBp125ProcessorFootprintReconciliation
  const [stm32Source, esp32Source] = reconciliation.retainedManufacturerSources
  const [stm32, esp32] = reconciliation.processorBindings
  if (
    stm32Source === undefined ||
    esp32Source === undefined ||
    stm32 === undefined ||
    esp32 === undefined ||
    stm32Source.processor !== "STM32G474RET3TR" ||
    stm32Source.sha256 !== bp032Stm32G474Ret3TrLqfp64FootprintEvidence.source.sha256 ||
    esp32Source.processor !== "ESP32-S3-WROOM-1U-N16R2" ||
    esp32Source.sha256 !== benchPrototypeBp032Esp32Wroom1uFootprintGeometry.officialSources[0].sha256 ||
    stm32.exactMpn !== stm32PinAllocation.part ||
    esp32.exactMpn !== benchPrototypeEsp32Allocation.moduleMpn ||
    stm32.exactMpn !== benchPrototypeProcessorSupport.processors.stm32.part ||
    esp32.exactMpn !== benchPrototypeProcessorSupport.processors.esp32.part ||
    stm32.geometry.padCount !== bp032Stm32G474Ret3TrLqfp64FootprintEvidence.pads.length ||
    esp32.geometry.perimeterPadCount !==
      benchPrototypeBp032Esp32Wroom1uFootprintGeometry.landPattern.perimeterCopper.pads.length ||
    esp32.geometry.exposedGroundPad !== 41 ||
    reconciliation.authority.schematicIntegrationAuthorized ||
    reconciliation.authority.schematicSignoff !== "deny" ||
    reconciliation.authority.footprintApproval ||
    reconciliation.authority.layoutApproval ||
    reconciliation.authority.fabricationAuthorized
  ) {
    throw new RangeError("BP-125 processor identity, candidate binding, or denied release authority drifted")
  }
  return true
}
