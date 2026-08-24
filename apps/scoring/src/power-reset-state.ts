/** M0-10 immutable power and reset-state contract. */
import { processorFaultContainment } from "./processor-fault-containment.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M0-10 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M0-10 data can contain only data properties")
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
  workUnit: "M0-10",
  releaseState: "deny",
  authority: {
    scoringAuthority: processorFaultContainment.authority.scoringAuthority,
    applicationController: processorFaultContainment.authority.applicationController,
    scoringLogicOwner: processorFaultContainment.vocabulary.scoringLogicOwner,
    resetDirection: processorFaultContainment.resetPolicy.permittedPeerReset,
    forbiddenResetDirection: processorFaultContainment.resetPolicy.forbiddenPeerReset,
    boutReset: "Only a designated supervisor path may authorize a reviewed boutReset"
  },
  powerInputs: {
    normal: processorFaultContainment.evidence.normalInput,
    laboratory: processorFaultContainment.evidence.labInput,
    mutuallyExclusive: processorFaultContainment.evidence.inputSourcesMutuallyExclusive,
    selectionRule: "Select sources only while de-energized; never drive both sources simultaneously"
  },
  safeState: {
    glossaryName: processorFaultContainment.vocabulary.safeInactive,
    runtimeName: processorFaultContainment.vocabulary.runtimeSafeInactive,
    requiredDuringUnavailability: [
      "primary lamps",
      "primary buzzer",
      "weapon source excitation",
      "weapon sink excitation"
    ],
    unavailableInterval: "No candidate promotion qualification registration or inferred no-signal result"
  },
  lifecycle: {
    coldBoot: {
      affected: "starting processor",
      bootIdentity: "new affected-controller boot ID",
      outcome: "unavailable until local recovery gates pass"
    },
    brownout: {
      affected: "monitored out-of-range domain",
      outcome: "affected controller unavailable and safe-inactive",
      disposition: "uncertain interval is not a scoring outcome"
    },
    independentProcessorReset: {
      scoringController: "unavailable and safe-inactive until technical recovery and supervisor disposition",
      applicationController: "degraded only while the STM32 remains available",
      peerEffect: "No peer reset, watchdog service, scoring change, or primary-output change"
    },
    watchdogReset: {
      ownership: "Each local watchdog resets only its local controller",
      classification: "processorReset and never boutReset"
    },
    updateReset: {
      affected: "controller receiving the approved image activation or rollback",
      outcome: "affected controller unavailable until selected-image and recovery gates pass",
      classification: "never boutReset"
    },
    wholePowerLoss: {
      affected: "whole apparatus",
      outcome: "both controllers unavailable and all scoring outputs safe-inactive",
      restoration: "new whole-apparatus cold-boot lifecycle with new boot IDs",
      lostInterval: "Never infer a scoring outcome onset or output state during loss"
    }
  },
  availability: {
    states: processorFaultContainment.vocabulary.availabilityStates,
    degraded:
      "STM32 authoritative acquisition and primary outputs remain trusted while an application service is unavailable",
    unavailable: "STM32 cannot make trusted observations or assure primary safe state",
    stm32Recovery: [
      "stable local rail and reset supervision",
      "approved firmware configuration clock RAM and required flash integrity",
      "reviewed acquisition reference and line-safety result",
      "safe-inactive output and excitation controls",
      "armed local watchdog",
      "new scoring boot ID and lifecycle cause"
    ],
    applicationRecovery: [
      "stable local rail and reset supervision",
      "approved firmware identity storage integrity and reset-safe peripherals",
      "validated record reception before presenting new STM32 decisions as current"
    ],
    interruptedStm32Bout:
      "Remain unavailable until a supervisor-authorized new scoring or bout state; no continuity restoration is selected"
  },
  persistence: {
    volatile: [
      "processor registers and RAM",
      "active candidates and acquisition buffers",
      "transport buffers and watchdog service state",
      "live presentation state and uncommitted records"
    ],
    rule: "Discard affected-controller volatile state and never use it to resume qualification lockout or latch-clear decisions",
    durable: [
      "accepted immutable records",
      "lifecycle records",
      "configuration transactions",
      "journal and index metadata"
    ],
    powerFailOutcome:
      "Recover only the prior valid state or the next valid state; never accept a partial record as evidence",
    primaryOutput: "A latched primary indication is not assumed durable or preserved through a warm STM32 reset"
  },
  evidence: {
    hardwareEvidenceClaimed: false,
    requiredFutureEvidence: [
      "rail and supervisor thresholds",
      "hold-up and input-transfer behavior",
      "reset propagation isolation and no-backpower behavior",
      "safe-output and excitation observations",
      "cold boot whole-power loss independent reset watchdog brownout update and link-isolator fault injection"
    ],
    contractBoundary: "Software-contract evidence only; not hardware acceptance or FIE approval"
  }
} as const

export const powerResetState = deepFreeze(definition)

/** Rejects lifecycle, persistence, source-selection, authority, and hardware-evidence relaxation. */
export function validatePowerResetState(value: unknown): true {
  if (!sameDataGraph(value, powerResetState)) {
    throw new RangeError("M0-10 must exactly match the reviewed fail-closed power and reset-state contract")
  }
  const contract = powerResetState
  if (
    contract.workUnit !== "M0-10" ||
    contract.releaseState !== "deny" ||
    contract.authority.scoringAuthority !== "STM32" ||
    contract.authority.applicationController !== "ESP32" ||
    contract.authority.scoringLogicOwner !== "weapon-specific STM32 scorer" ||
    contract.authority.resetDirection !== "STM32 to ESP32 only through RESET_REQUEST to an EN_RESET low-side sink" ||
    contract.authority.forbiddenResetDirection !== "No automatic ESP32 to STM32 SCORING_NRST_N reset path" ||
    contract.authority.boutReset !== "Only a designated supervisor path may authorize a reviewed boutReset" ||
    contract.powerInputs.normal !== "USB-C PD" ||
    contract.powerInputs.laboratory !== "LAB_POST_EFUSE_20V test-only 20 V input" ||
    !contract.powerInputs.mutuallyExclusive ||
    contract.safeState.glossaryName !== "safeInactive" ||
    contract.safeState.runtimeName !== "safe-inactive" ||
    contract.lifecycle.coldBoot.bootIdentity !== "new affected-controller boot ID" ||
    contract.lifecycle.brownout.outcome !== "affected controller unavailable and safe-inactive" ||
    contract.lifecycle.independentProcessorReset.scoringController !==
      "unavailable and safe-inactive until technical recovery and supervisor disposition" ||
    contract.lifecycle.independentProcessorReset.applicationController !==
      "degraded only while the STM32 remains available" ||
    contract.lifecycle.watchdogReset.classification !== "processorReset and never boutReset" ||
    contract.lifecycle.updateReset.classification !== "never boutReset" ||
    contract.lifecycle.wholePowerLoss.restoration !== "new whole-apparatus cold-boot lifecycle with new boot IDs" ||
    contract.availability.states.join(",") !== "available,degraded,unavailable" ||
    contract.persistence.powerFailOutcome !==
      "Recover only the prior valid state or the next valid state; never accept a partial record as evidence" ||
    contract.persistence.primaryOutput !==
      "A latched primary indication is not assumed durable or preserved through a warm STM32 reset" ||
    contract.evidence.hardwareEvidenceClaimed ||
    contract.evidence.contractBoundary !== "Software-contract evidence only; not hardware acceptance or FIE approval"
  ) {
    throw new RangeError(
      "M0-10 must retain its safe reset ownership, persistence boundary, and denied hardware evidence"
    )
  }
  return true
}
