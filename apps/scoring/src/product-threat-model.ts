/** M0-11 immutable product threat model and firmware trust-boundary contract. */
import { powerResetState } from "./power-reset-state.js"
import { processorFaultContainment } from "./processor-fault-containment.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M0-11 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M0-11 data can contain only data properties")
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
  workUnit: "M0-11",
  releaseState: "deny",
  authority: {
    scoringAuthority: "STM32",
    applicationController: "ESP32",
    stm32Only: [
      "acquisition",
      "monotonic scoring time",
      "weapon-rule decisions",
      "lockout",
      "source decision records",
      "primary lamps buzzer and excitation"
    ],
    esp32Never: [
      "score or reclassify",
      "drive primary outputs or excitation",
      "clear a primary indication",
      "change STM32 time",
      "automatically reset STM32"
    ],
    compromisedApplicationOutcome: "degraded only when STM32 remains available"
  },
  trustZones: {
    scoring: "STM32 scoring domain is the only scoring trusted-computing base after local recovery gates",
    link: "isolated processor link is untrusted transport and is validated at both endpoints",
    application: "ESP32 application domain is non-authoritative for scoring",
    networkAndOptical: "venue network and optical input are fully untrusted",
    privilegedOperations:
      "build release provisioning factory and service operations require least privilege attribution and audit"
  },
  updateAndRollback: {
    requiredBinding: [
      "product",
      "processor",
      "board-or-module-revision",
      "image-role",
      "protocol-schema-and-configuration-compatibility",
      "image-digest",
      "release-revision"
    ],
    authorization: "Each processor requires an approved target-bound digital signature before activation",
    stm32Activation: "signed locally authorized recoverable activation only",
    esp32Boundary:
      "ESP32 may transport STM32 material but cannot install select roll back or activate scoring firmware",
    atomicity: "stage and verify before activation while retaining an approved prior image",
    rollback: "select only a target-compatible authenticated known-good image at or above the accepted security floor",
    updateOutcome: "affected controller is unavailable until recovery gates and interrupted-bout disposition pass",
    openDesignGates: [
      "signature algorithm and format",
      "secure-boot implementation",
      "anti-rollback durable representation",
      "security-floor update and recovery exception",
      "key rotation revocation custody and compromise response"
    ]
  },
  identityAndSecrets: {
    apparatusIdentity: "unique non-secret apparatus identity with traceable serial and lot identity",
    processorProvenance: "each processor has distinct firmware and boot provenance",
    missingIdentityOutcome: "identity uncertainty or reset record and never a fabricated identity",
    secretHandling: [
      "separate release-signing device-provisioning service-authorization and recovery roles",
      "private material is never committed embedded as a general firmware constant copied to ordinary media or printed in reports",
      "controlled provisioning read-back does not export private keys",
      "failed provisioning is non-releasable"
    ]
  },
  debugAndService: {
    production: "no network-triggered SWD JTAG bootloader or memory-debug path",
    physicalService:
      "authorized attributable physical procedure with safe outputs and no private-key or arbitrary-primary-output exposure",
    unresolvedReleaseGate:
      "production debug lock or authenticated unlock and documented recovery are not selected or proven",
    stm32Candidate:
      "PA13 and PA14 are SWD candidate service pins; JTAG and SWO are excluded from the candidate allocation",
    esp32Candidate: "GPIO19 and GPIO20 USB Serial JTAG plus UART0 EN and BOOT_N are candidate factory or service paths"
  },
  networkAndFrameBoundary: {
    networkIsolation:
      "network parsers remain in the ESP32 application domain and never run in the STM32 scoring trusted-computing base",
    requestRule:
      "STM32 accepts only bounded manifest-approved current-state-valid requests with required local confirmation",
    malformedOrReplayed: "reject without changing scoring state configuration outputs or reset ownership",
    frameRule:
      "complete bounded frames are validated for direction version flags length CRC and expected sequence before payload delivery",
    frameLimit: "CRC-32C detects accidental corruption only and is not authentication or freshness",
    replayRule:
      "duplicate reordered corrupt partial unknown or unverifiable data is withheld and reported as diagnostic or uncertainty",
    remoteRule:
      "optical commands are hostile until authenticated fresh authorized and bounded; no plaintext fallback or universal production key"
  },
  recoveryAndPower: {
    normalPowerInput: "USB-C PD",
    laboratoryPowerInput: "LAB_POST_EFUSE_20V test-only 20 V input",
    sourceRule: "select sources only while de-energized and never drive both simultaneously",
    stm32Unavailable:
      "STM32 reset brownout update failed recovery or uncertain power makes scoring unavailable with safe-inactive excitation and primary outputs",
    applicationFailure:
      "application network storage display audio or link failure is degraded only when STM32 remains available",
    interruptedBout:
      "never automatically resume an interrupted bout; require supervisor-authorized recovery disposition",
    powerLoss:
      "recover only durable valid records and never infer the lost interval or recreate volatile candidates lockout or primary indication",
    physicalRecovery:
      "suspected compromise or unrecoverable image or identity requires authorized physical service recovery"
  },
  evidence: {
    contractBoundary:
      "documentation and host-validator evidence only; not firmware cryptography schematic provisioning or production security acceptance",
    requiredFutureEvidence: [
      "target secure-boot signed-update rollback and recovery implementation",
      "per-unit identity and protected-secret provisioning read-back",
      "production debug-state and physical-service audit",
      "parser queue replay and hostile-input fault evidence",
      "hardware isolation reset safe-output and power-fault evidence",
      "independent security and manufacturing review"
    ],
    productionSecurityApproved: false
  }
} as const

export const productThreatModel = deepFreeze(definition)

/** Rejects relaxed scoring authority, security controls, recovery, and physical-evidence claims. */
export function validateProductThreatModel(value: unknown): true {
  if (!sameDataGraph(value, productThreatModel)) {
    throw new RangeError("M0-11 must exactly match the reviewed product threat model and trust boundaries")
  }
  const contract = productThreatModel
  if (
    contract.workUnit !== "M0-11" ||
    contract.releaseState !== "deny" ||
    contract.authority.scoringAuthority !== processorFaultContainment.authority.scoringAuthority ||
    contract.authority.applicationController !== processorFaultContainment.authority.applicationController ||
    contract.authority.compromisedApplicationOutcome !== processorFaultContainment.faultOutcomes.esp32Fault ||
    contract.updateAndRollback.authorization !==
      "Each processor requires an approved target-bound digital signature before activation" ||
    contract.updateAndRollback.stm32Activation !== "signed locally authorized recoverable activation only" ||
    contract.updateAndRollback.esp32Boundary !==
      "ESP32 may transport STM32 material but cannot install select roll back or activate scoring firmware" ||
    contract.identityAndSecrets.missingIdentityOutcome !==
      "identity uncertainty or reset record and never a fabricated identity" ||
    contract.debugAndService.production !== "no network-triggered SWD JTAG bootloader or memory-debug path" ||
    contract.networkAndFrameBoundary.malformedOrReplayed !==
      processorFaultContainment.faultOutcomes.malformedOrReplayedRequest ||
    contract.networkAndFrameBoundary.frameLimit !==
      "CRC-32C detects accidental corruption only and is not authentication or freshness" ||
    contract.recoveryAndPower.normalPowerInput !== powerResetState.powerInputs.normal ||
    contract.recoveryAndPower.laboratoryPowerInput !== powerResetState.powerInputs.laboratory ||
    contract.recoveryAndPower.sourceRule !==
      "select sources only while de-energized and never drive both simultaneously" ||
    contract.recoveryAndPower.interruptedBout !==
      "never automatically resume an interrupted bout; require supervisor-authorized recovery disposition" ||
    contract.evidence.productionSecurityApproved ||
    contract.evidence.contractBoundary !==
      "documentation and host-validator evidence only; not firmware cryptography schematic provisioning or production security acceptance"
  ) {
    throw new RangeError("M0-11 must retain fail-closed scoring authority and denied security-evidence gates")
  }
  return true
}
