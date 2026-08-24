/**
 * M4-04 single-channel sensing coupon release boundary.
 *
 * The circuit drawing remains `one-channel-analog-experiment.circuit.tsx`.
 * This compact companion provides the reviewable ERC net list and one
 * drawing-review record for every exact BOM reference. It intentionally does
 * not produce PCB artwork or grant fabrication authority.
 */

import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom, supportCircuitReconciled } from "./one-channel-analog-readiness.js"

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
  if (seen.has(value)) throw new RangeError("M4-04 coupon data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-04 coupon data may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype
    ) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const ercNets = [
  {
    net: "LINE",
    source: "J_FIXTURE.pin1 external fixture",
    sinks: ["U_ESD.pin1", "R_ESD.pin1", "R_FAULT_GUARD.pin2", "TP_LINE"],
    rule: "Connector line remains separated from the quiet acquisition node by R_ESD."
  },
  {
    net: "QUIET",
    source: "R_ESD.pin2",
    sinks: ["U_SOURCE_SWITCH.pin2", "U_OVP_BUFFER.pin3", "TP_QUIET"],
    rule: "The protected line has one named acquisition branch."
  },
  {
    net: "BUFFER_OUTPUT",
    source: "U_OVP_BUFFER.pin6",
    sinks: ["U_OVP_BUFFER.pin2", "R_SAR.pin1", "TP_BUFFER_OUT"],
    rule: "The unity-gain feedback is explicit before the SAR series resistor."
  },
  {
    net: "AINP",
    source: "R_SAR.pin2",
    sinks: ["U_SAR.pin3", "C_SAR.pin1", "TP_AINP"],
    rule: "The SAR input has its defined 20-ohm and 1-nF charge bucket."
  },
  {
    net: "AINN",
    source: "SGND",
    sinks: ["U_SAR.pin4", "TP_AINN"],
    rule: "The differential SAR negative input is explicitly grounded."
  },
  {
    net: "REF_2V5",
    source: "U_REF.pin6",
    sinks: ["R_SOURCE.pin1", "C_REF_REG", "C_REF_REG_HF", "R_REF_SAR.pin1"],
    rule: "The source and converter reference derive from the same reference; R_REF_SAR isolates the converter reservoir."
  },
  {
    net: "SAR_REF",
    source: "R_REF_SAR.pin2",
    sinks: ["U_SAR.pin1", "C_REF", "TP_REF"],
    rule: "The converter-side reservoir is present and separately named."
  },
  {
    net: "SOURCE_PATH",
    source: "R_SOURCE.pin2",
    sinks: ["U_SOURCE_SWITCH.pin3"],
    rule: "The 2.49-kilohm excitation reaches the line only through the selected switch."
  },
  {
    net: "SOURCE_EN",
    source: "J_CONTROL.pin1 external controller",
    sinks: ["U_SOURCE_SWITCH.pin1", "R_SOURCE_PD.pin1"],
    rule: "The source control has a hardware low default."
  },
  {
    net: "FORCE",
    source: "J_GUARDED_FORCE.pin1 interlocked fixture",
    sinks: ["R_FAULT_GUARD.pin1"],
    rule: "Guarded force is isolated by the 56-kilohm source-envelope resistor."
  },
  {
    net: "SYSTEM_5V",
    source: "J_UPSTREAM_5V.pin1 external isolated supply",
    sinks: ["U_ISO.pin1", "C_ISO_IN.pin1"],
    rule: "Coupon power enters through the isolated converter only."
  },
  {
    net: "S5V_ISO",
    source: "U_ISO.pin6",
    sinks: ["U_NEGATIVE_RAIL.pin2", "U_3V3.pin1", "U_REF.pin2", "C_ISO_OUT.pin1"],
    rule: "All analog-domain rails are downstream of the isolated converter."
  },
  {
    net: "S5V_NEG",
    source: "U_NEGATIVE_RAIL.pin1",
    sinks: ["U_OVP_BUFFER.pin4", "C_NEG_OUT.pin1", "C_BUFFER_NEG.pin1", "TP_S5V_NEG"],
    rule: "The buffer negative rail is explicitly decoupled and observable."
  },
  {
    net: "S3V3_ISO",
    source: "U_3V3.pin5",
    sinks: ["U_SOURCE_SWITCH.pin13", "U_SAR.pin2", "U_SAR.pin10", "C_3V3_OUT.pin1"],
    rule: "Switch and SAR supplies share the isolated 3.3-volt rail only."
  },
  {
    net: "SGND",
    source: "U_ISO.pin7",
    sinks: ["J_FIXTURE.pin2", "J_GUARDED_FORCE.pin2", "U_ESD.pin3", "U_ESD.pin8", "U_SAR.pin5"],
    rule: "The reserved fixture pin three is not assigned as a second return."
  },
  {
    net: "SPI",
    source: "J_ADC_IO external host",
    sinks: ["U_SAR.pins6-9"],
    rule: "Only converter digital pins cross the coupon I/O connector."
  }
] as const

const footprintReviews = oneChannelAnalogExperimentBom.map((part) => ({
  reference: part.reference,
  manufacturer: part.manufacturer,
  exactMpn: part.mpn,
  package: part.package,
  manufacturerPrimaryUrl: part.primaryEvidenceUrl,
  implementationEvidence: {
    reviewerId: "m4-04-implementation-agent",
    status: "bom-and-schematic-identity-reconciled" as const,
    scope: "Exact reference, MPN, package, and named footprint family are reconciled to the coupon BOM."
  },
  independentDrawingReview: {
    reviewerId: "root-final-reviewer",
    status: "pending" as const,
    required:
      "Acquire the exact manufacturer package drawing and CAD or record an explicit source absence; compare pad, pin-one or polarity, courtyard, and assembly orientation against generated artwork."
  },
  footprintRelease: "deny" as const
}))

const definition = {
  artifactKind: "m4-04-single-channel-sensing-coupon",
  workUnit: "M4-04",
  schematic: {
    sourceFile: "src/one-channel-analog-experiment.circuit.tsx",
    sourceModel: "src/one-channel-analog-experiment.ts",
    title: "One-channel protected analog experiment",
    sourcePath: "REF5025AQDRQ1 -> ERA3AEB2491V -> TMUX1112PWR -> LINE",
    acquisitionPath: "LINE -> TPD4E05U06DQAR / 22 ohm -> ADA4177-1BRZ -> 20 ohm / 1 nF -> ADS8881IDGS",
    normalPower:
      "USB-C PD remains the apparatus normal input; this isolated coupon accepts no USB-C, VBUS, CC, or PD controller connection."
  },
  erc: {
    engine: "source-bound static net ERC",
    status: "pass" as const,
    checks: ercNets,
    excluded:
      "No electrical-rule check substitutes for a tscircuit renderer result, a physical short/open inspection, or an energized test."
  },
  footprints: footprintReviews,
  authority: {
    schematicIntegrationAuthorized: false,
    footprintsIndependentlyReviewed: false,
    copperArtworkReleased: false,
    fabricationAuthorized: false,
    energizedTestAuthorized: false,
    scoringAuthority: false,
    releaseState: "deny" as const
  },
  blockers: [
    "Every reference needs an exact manufacturer drawing and CAD-or-absence record plus a root independent drawing review.",
    "Generated footprint artwork, overlay evidence, and assembly orientation remain unreviewed.",
    "The tscircuit renderer test for the existing coupon timed out in this environment; this static ERC is not evidence that renderer or generated board output is healthy.",
    "M4-06 owns any fabrication package and M4-07 onward own physical inspection and powered evidence."
  ],
  upstream: {
    m402: "candidate clamp and rail-protection boundary",
    m403: "source/sink, reference, ADC, and calibration error ledger",
    couponModel: structuredClone(oneChannelAnalogExperiment),
    bom: structuredClone(oneChannelAnalogExperimentBom),
    supportCircuitReconciled
  }
} as const

export const M404_SINGLE_CHANNEL_COUPON = deepFreeze(definition)

/** Reject topology drift, missing review records, and all authority escalation. */
export function validateM404SingleChannelCoupon(value: unknown): true {
  if (!sameDataGraph(value, M404_SINGLE_CHANNEL_COUPON)) {
    throw new RangeError("M4-04 coupon must exactly match the source-bound schematic and review queue")
  }
  const coupon = M404_SINGLE_CHANNEL_COUPON
  const referenceSet = new Set(coupon.footprints.map((footprint) => footprint.reference))
  if (
    coupon.workUnit !== "M4-04" ||
    coupon.erc.status !== "pass" ||
    coupon.erc.checks.length !== ercNets.length ||
    coupon.erc.checks.some((check) => check.source.trim() === "" || check.rule.trim() === "") ||
    referenceSet.size !== coupon.footprints.length ||
    coupon.footprints.length !== oneChannelAnalogExperimentBom.length ||
    coupon.footprints.some(
      (footprint) =>
        footprint.exactMpn.trim() === "" ||
        footprint.package.trim() === "" ||
        !footprint.manufacturerPrimaryUrl.startsWith("https://") ||
        footprint.implementationEvidence.status !== "bom-and-schematic-identity-reconciled" ||
        footprint.independentDrawingReview.reviewerId !== "root-final-reviewer" ||
        footprint.independentDrawingReview.status !== "pending" ||
        footprint.footprintRelease !== "deny"
    ) ||
    !coupon.upstream.supportCircuitReconciled ||
    coupon.authority.schematicIntegrationAuthorized ||
    coupon.authority.footprintsIndependentlyReviewed ||
    coupon.authority.copperArtworkReleased ||
    coupon.authority.fabricationAuthorized ||
    coupon.authority.energizedTestAuthorized ||
    coupon.authority.scoringAuthority ||
    coupon.authority.releaseState !== "deny"
  ) {
    throw new RangeError("M4-04 coupon must retain complete review evidence and denied physical authority")
  }
  return true
}

validateM404SingleChannelCoupon(M404_SINGLE_CHANNEL_COUPON)
