import {
  bp032MurataNxe1s0505mcPreorderPromotion,
  validateBp032MurataNxe1s0505mcPreorderPromotion
} from "./bp032-murata-nxe1s0505mc-preorder-promotion.js"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Footprint approval decisions cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Footprint approval decisions may contain data properties only")
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
  try {
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) return false
    return expectedKeys.every((key) => {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      return (
        actualDescriptor !== undefined &&
        expectedDescriptor !== undefined &&
        "value" in actualDescriptor &&
        "value" in expectedDescriptor &&
        actualDescriptor.enumerable === expectedDescriptor.enumerable &&
        actualDescriptor.configurable === expectedDescriptor.configurable &&
        actualDescriptor.writable === expectedDescriptor.writable &&
        sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
      )
    })
  } catch {
    return false
  }
}

const privateBaseline = deepFreeze({
  artifactKind: "bench-prototype-footprint-approval-decisions",
  reviewer: "root-final-reviewer",
  decisions: [
    {
      workUnit: "BP-032",
      reference: "U_ISO_POWER",
      candidateArtifactKind: bp032MurataNxe1s0505mcPreorderPromotion.artifactKind,
      candidateArtifactPath: "src/bp032-murata-nxe1s0505mc-preorder-promotion.tsx",
      decision: "footprint-approved",
      approvedAtUtc: "2026-08-25T16:23:00.000Z",
      approvedBoundary: [
        "exact NXE1S0505MC identity and five-land package mapping",
        "project copper, mask, paste, and courtyard geometry",
        "page-6 top-view orientation with pin 1 lower-left and pin 14 upper-left"
      ],
      deniedBoundary: [
        "manufacturer CAD",
        "board placement and fit",
        "physical isolation, creepage, clearance, and slot acceptance",
        "thermal, schematic, assembly, fabrication, physical-test, and release authority"
      ],
      fabricationAuthorized: false,
      releaseState: "deny"
    }
  ]
} as const)

export const benchPrototypeFootprintApprovalDecisions = deepFreeze(structuredClone(privateBaseline))

export function validateBenchPrototypeFootprintApprovalDecisions(
  value: unknown = benchPrototypeFootprintApprovalDecisions
): true {
  if (validateBp032MurataNxe1s0505mcPreorderPromotion().length !== 0) {
    throw new RangeError("BP-032 NXE1 promotion candidate drifted before approval evaluation")
  }
  if (!sameDataGraph(value, privateBaseline)) {
    throw new RangeError("Footprint approval decision graph drifted")
  }
  return true
}

export function isBenchPrototypeFootprintApproved(
  workUnit: "BP-031" | "BP-032" | "BP-033",
  reference: string,
  candidateArtifactKind: string
): boolean {
  validateBenchPrototypeFootprintApprovalDecisions()
  return benchPrototypeFootprintApprovalDecisions.decisions.some(
    (decision) =>
      decision.workUnit === workUnit &&
      decision.reference === reference &&
      decision.candidateArtifactKind === candidateArtifactKind &&
      decision.decision === "footprint-approved" &&
      !decision.fabricationAuthorized &&
      decision.releaseState === "deny"
  )
}
