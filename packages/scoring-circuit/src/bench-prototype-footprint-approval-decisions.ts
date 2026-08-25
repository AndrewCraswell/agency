import {
  benchPrototypeAnalogFootprintClosure,
  validateBenchPrototypeAnalogFootprintClosure
} from "./bench-prototype-analog-footprint-closure.js"
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
      references: ["U_ISO_POWER"],
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
    },
    {
      workUnit: "BP-031",
      references: Array.from({ length: 7 }, (_, index) => `C_SAR_${index + 1}`),
      candidateArtifactKind: "bp031-kemet-c0603c102j5gactu-project-footprint",
      candidateArtifactPath: "src/bp031-kemet-c0603c102j5gactu-project-footprint.tsx",
      decision: "footprint-approved",
      approvedAtUtc: "2026-08-25T18:15:00.000Z",
      approvedBoundary: [
        "exact C0603C102J5GACTU identity and seven-reference mapping",
        "retained exact-part and applicable KEMET family land guidance",
        "project geometry and non-polar orientation"
      ],
      deniedBoundary: ["manufacturer CAD", "board placement and fit", "fabrication and release authority"],
      fabricationAuthorized: false,
      releaseState: "deny"
    },
    {
      workUnit: "BP-031",
      references: Array.from({ length: 7 }, (_, index) => `C_REF_IN_${index + 1}`),
      candidateArtifactKind: "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint",
      candidateArtifactPath: "src/bench-prototype-tdk-cga3-project-footprint.tsx",
      decision: "footprint-approved",
      approvedAtUtc: "2026-08-25T18:15:00.000Z",
      approvedBoundary: [
        "exact CGA3E3X7R1H105K080AB identity and seven-reference mapping",
        "retained TDK package and applicable reflow land guidance",
        "project geometry and non-polar orientation"
      ],
      deniedBoundary: [
        "manufacturer CAD and guaranteed effective capacitance",
        "board placement and fit",
        "fabrication and release authority"
      ],
      fabricationAuthorized: false,
      releaseState: "deny"
    },
    {
      workUnit: "BP-031",
      references: Array.from({ length: 7 }, (_, index) => index + 1).flatMap((channel) =>
        ["R_ESD", "R_SOURCE_PD", "R_SAR", "R_FAULT_GUARD"].map((base) => `${base}_${channel}`)
      ),
      candidateArtifactKind: "bp031-vishay-crcw-selected-resistor-footprint-evidence",
      candidateArtifactPath: "src/bp031-vishay-crcw-resistor-footprint-evidence.tsx",
      decision: "footprint-approved",
      approvedAtUtc: "2026-08-25T18:15:00.000Z",
      approvedBoundary: [
        "four exact selected resistor identities and 28 replicated references",
        "Vishay CRCW0603-HP and CRCW1206-HP package binding and recommended reflow geometry",
        "non-polar orientation"
      ],
      deniedBoundary: [
        "exact-orderable manufacturer CAD",
        "board placement and fit",
        "fabrication and release authority"
      ],
      fabricationAuthorized: false,
      releaseState: "deny"
    }
  ]
} as const)

export const benchPrototypeFootprintApprovalDecisions = deepFreeze(structuredClone(privateBaseline))

function assertApprovedAnalogMappings(): void {
  validateBenchPrototypeAnalogFootprintClosure(benchPrototypeAnalogFootprintClosure)
  const mapping = (mappingId: string) =>
    benchPrototypeAnalogFootprintClosure.reviewEvidenceMappings.find((candidate) => candidate.mappingId === mappingId)
  const kemet = mapping("bp031-kemet-c0603c102j5gactu-project-footprint")
  const tdk = mapping("bp031-tdk-cga3e3x7r1h105k080ab-project-footprint")
  const vishay = mapping("bp031-vishay-crcw-selected-resistor-footprint-evidence")
  if (
    kemet === undefined ||
    !("acceptance" in kemet) ||
    !("projectGeometryAccepted" in kemet.acceptance) ||
    kemet.acceptance.projectGeometryAccepted !== true ||
    !("nonPolarOrientationReviewed" in kemet.acceptance) ||
    kemet.acceptance.nonPolarOrientationReviewed !== true ||
    kemet.acceptance.fabricationAuthorized !== false ||
    kemet.acceptance.releaseState !== "deny"
  ) {
    throw new RangeError("BP-031 KEMET C_SAR approval boundary drifted")
  }
  if (
    tdk === undefined ||
    !("acceptance" in tdk) ||
    !("projectGeometryAccepted" in tdk.acceptance) ||
    tdk.acceptance.projectGeometryAccepted !== true ||
    !("nonPolarOrientationReviewed" in tdk.acceptance) ||
    tdk.acceptance.nonPolarOrientationReviewed !== true ||
    tdk.acceptance.fabricationAuthorized !== false ||
    tdk.acceptance.releaseState !== "deny"
  ) {
    throw new RangeError("BP-031 TDK C_REF_IN approval boundary drifted")
  }
  if (
    vishay === undefined ||
    !("acceptance" in vishay) ||
    !("recommendedReflowGeometryAccepted" in vishay.acceptance) ||
    vishay.acceptance.recommendedReflowGeometryAccepted !== true ||
    !("nonPolarOrientationAccepted" in vishay.acceptance) ||
    vishay.acceptance.nonPolarOrientationAccepted !== true ||
    vishay.acceptance.fabricationAuthorized !== false ||
    vishay.acceptance.releaseState !== "deny"
  ) {
    throw new RangeError("BP-031 Vishay CRCW approval boundary drifted")
  }
}

export function validateBenchPrototypeFootprintApprovalDecisions(
  value: unknown = benchPrototypeFootprintApprovalDecisions
): true {
  if (validateBp032MurataNxe1s0505mcPreorderPromotion().length !== 0) {
    throw new RangeError("BP-032 NXE1 promotion candidate drifted before approval evaluation")
  }
  assertApprovedAnalogMappings()
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
      decision.references.some((candidate) => candidate === reference) &&
      decision.candidateArtifactKind === candidateArtifactKind &&
      decision.decision === "footprint-approved" &&
      !decision.fabricationAuthorized &&
      decision.releaseState === "deny"
  )
}
