import type { ReactElement } from "react"

const retainedTdkCaptureSha256 = "60F2B7B008453D3BE7F5501C7904E54911D422BB068EC8296DA876D47D4A511E"
const bp050SelectionContractSha256 = "9771B1F071ABC5E16614E6B989D5C7A9FEAD8A7DCE7FD444D8D3B3D60A22DDA5"
const bp142SelectionContractSha256 = "ED4BFC8B752BE974323BF7ED95B1B5718C1C2F1D903B6444E652245326F35E67"

const projectPadLengthMm = 1.05
const projectPadWidthMm = 1.05
const projectPadGapMm = 0.8
const projectPadCenterXMm = 0.925
const projectMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("BP-033 frozen baseline may contain data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * Compares only own data-property descriptors. It rejects getters, setters,
 * symbols, hidden fields, prototype drift, property flag drift, and changed
 * values without reading attacker-controlled property values.
 */
function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  const priorExpected = seen.get(actual)
  if (priorExpected !== undefined) return priorExpected === expected
  seen.set(actual, expected)

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) return false

  return actualKeys.every((key) => {
    if (typeof key === "symbol") return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable ||
      actualDescriptor.writable !== expectedDescriptor.writable
    ) {
      return false
    }
    return hasExactDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
  })
}

const frozenBaseline = deepFreeze({
  artifactKind: "bp033-tdk-c2012x7s1a226m125ac-0805-review-candidate",
  workUnit: "BP-033",
  basisCommit: "41b148577bfe9db353095ddf92f9cda4c7a0e083",
  manufacturer: "TDK",
  manufacturerPartNumber: "C2012X7S1A226M125AC",
  scope: "review-only; five exact capacitor references",
  rootIntegrationHandoff: {
    canonicalLedgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
    canonicalWorkUnit: "BP-033",
    integrationStatus: "root-integration-handoff",
    requiredRows: [
      {
        reference: "C_DISPLAY_IN",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7S1A226M125AC",
        package: "0805"
      },
      {
        reference: "C_DISPLAY_OUT",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7S1A226M125AC",
        package: "0805"
      },
      {
        reference: "C_APP_REG_OUT_A",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7S1A226M125AC",
        package: "0805"
      },
      {
        reference: "C_APP_REG_OUT_B",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7S1A226M125AC",
        package: "0805"
      },
      {
        reference: "C_APP_REG_OUT_C",
        manufacturer: "TDK",
        manufacturerPartNumber: "C2012X7S1A226M125AC",
        package: "0805"
      }
    ],
    enforcement:
      "Root integration must enforce exactly these five canonical-ledger rows with this exact manufacturer, MPN, and package. This isolated review candidate neither hashes nor authorizes mutation of the mutable ledger."
  },
  stableUpstreamSelectionContracts: [
    {
      workUnit: "BP-050",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-power.ts",
      sha256: bp050SelectionContractSha256,
      requiredRows: ["C_DISPLAY_IN", "C_DISPLAY_OUT"],
      selection: "display limiter input and output capacitors use C2012X7S1A226M125AC at 22 uF"
    },
    {
      workUnit: "BP-142",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-application-rail.ts",
      sha256: bp142SelectionContractSha256,
      requiredRows: ["C_APP_REG_OUT_A", "C_APP_REG_OUT_B", "C_APP_REG_OUT_C"],
      selection: "application rail output capacitor bank uses C2012X7S1A226M125AC at 22 uF"
    }
  ],
  source: {
    authority: "manufacturer-primary-rendered-page-capture",
    url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7S1A226M125AC",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/tdk-c2012x7s1a226m125ac-product-page-capture.md",
    sha256: retainedTdkCaptureSha256,
    capturedOn: "2026-08-25"
  },
  exactOrderableCharacteristics: {
    series: "C2012 [EIA 0805]",
    capacitanceUf: 22,
    tolerancePercent: 20,
    ratedVoltageVdc: 10,
    dielectric: "X7S (+/-22%)",
    operatingTemperatureC: { minimum: -55, maximum: 125 },
    package: {
      lengthMm: { nominal: 2, plusMinus: 0.2 },
      widthMm: { nominal: 1.25, plusMinus: 0.2 },
      thicknessMm: { nominal: 1.25, plusMinus: 0.2 },
      terminalWidthMm: { minimum: 0.2 },
      terminalSpacingMm: { minimum: 0.5 }
    },
    solderingMethods: ["flow", "reflow"]
  },
  familyLandGuidance: {
    scope: "TDK recommended land pattern shown on the exact-MPN page; not manufacturer CAD",
    process: "reflow",
    parametersMm: {
      pa: { minimum: 0.9, maximum: 1.2 },
      pb: { minimum: 0.7, maximum: 0.9 },
      pc: { minimum: 0.9, maximum: 1.2 }
    },
    constraints: [
      "TDK labels this material Recommended Land Pattern.",
      "The retained source does not publish a finished CAD footprint, mask, paste, courtyard, or placement orientation for this exact MPN."
    ]
  },
  projectReviewInputs: {
    interpretation:
      "Project-only reflow interpretation: PA is pad length, PB is inner gap, and PC is pad width. This interpretation is not a TDK CAD claim.",
    manufacturerParameterSelectionMm: { pa: 1.05, pb: 0.8, pc: 1.05 },
    copperPads: {
      padLengthMm: projectPadLengthMm,
      padWidthMm: projectPadWidthMm,
      innerGapMm: projectPadGapMm,
      centerXMm: projectPadCenterXMm
    },
    solderMask: {
      marginPerEdgeMm: projectMaskMarginMm,
      openingLengthMm: 1.15,
      openingWidthMm: 1.15,
      state: "project-review-input"
    },
    paste: {
      reductionPerEdgeMm: projectPasteReductionMm,
      openingLengthMm: 0.95,
      openingWidthMm: 0.95,
      state: "project-review-input"
    },
    courtyard: {
      lengthMm: 3.4,
      widthMm: 1.75,
      clearanceMm: 0.25,
      state: "project-review-input-not-published-by-tdk"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "non-polar-review-input-only",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    datum: "local two-terminal axis",
    placementAuthority: "deny",
    note: "Rotation is electrically equivalent only; board placement, flex-stress direction, clearance, and assembly orientation require independent review."
  },
  artwork: {
    state: "isolated-generated-project-review-only",
    authority: "deny",
    placement: "not-assigned",
    representation: "two-pad review footprint with project-only mask, paste, and courtyard inputs"
  },
  gates: {
    manufacturerCad: "deny-not-acquired",
    projectCadImport: "deny",
    boardPlacement: "deny",
    projectGeometryAcceptance: "deny",
    orientationAcceptance: "deny",
    fabrication: "deny",
    release: "deny"
  },
  accepted: false
} as const)

/** A separately cloned, frozen review record. The private baseline is never exported. */
export const bp033TdkC2012x7s1a226m125ac0805ReviewCandidate = deepFreeze(structuredClone(frozenBaseline))

export interface Bp033TdkC2012x7s1a226m125ac0805ReviewCandidateProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review artwork only; it is not a board placement or CAD-release artifact. */
export function Bp033TdkC2012x7s1a226m125ac0805ReviewCandidate({
  pcbRotation,
  pcbX,
  pcbY
}: Bp033TdkC2012x7s1a226m125ac0805ReviewCandidateProps = {}): ReactElement {
  return (
    <chip
      name="C_BP033_TDK_C2012X7S1A226M125AC_REVIEW"
      manufacturerPartNumber="C2012X7S1A226M125AC"
      pinLabels={{ pin1: "A", pin2: "B" }}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
      footprint={
        <footprint name="BP033_TDK_C2012X7S1A226M125AC_0805_REVIEW" originalLayer="top">
          <smtpad
            name="1"
            pcbX={-projectPadCenterXMm}
            pcbY={0}
            shape="rect"
            solderMaskMargin={`${projectMaskMarginMm}mm`}
            solderPasteMargin={`-${projectPasteReductionMm}mm`}
            width={`${projectPadLengthMm}mm`}
            height={`${projectPadWidthMm}mm`}
            portHints={["1", "A", "non-polar", "terminal-a"]}
          />
          <smtpad
            name="2"
            pcbX={projectPadCenterXMm}
            pcbY={0}
            shape="rect"
            solderMaskMargin={`${projectMaskMarginMm}mm`}
            solderPasteMargin={`-${projectPasteReductionMm}mm`}
            width={`${projectPadLengthMm}mm`}
            height={`${projectPadWidthMm}mm`}
            portHints={["2", "B", "non-polar", "terminal-b"]}
          />
          {/* Project review courtyard; not TDK CAD. */}
          <courtyardrect pcbX={0} pcbY={0} width="3.4mm" height="1.75mm" strokeWidth="0.05mm" />
        </footprint>
      }
    />
  )
}

/** Fail closed against a private independent frozen baseline without invoking supplied getters. */
export function validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(
  value: unknown = bp033TdkC2012x7s1a226m125ac0805ReviewCandidate
): readonly string[] {
  if (!hasExactDataGraph(value, frozenBaseline)) {
    return ["BP-033 TDK C2012X7S1A226M125AC review record must exactly match its private frozen baseline"]
  }
  return []
}

export function isBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(value: unknown): value is typeof frozenBaseline {
  return validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(value).length === 0
}
