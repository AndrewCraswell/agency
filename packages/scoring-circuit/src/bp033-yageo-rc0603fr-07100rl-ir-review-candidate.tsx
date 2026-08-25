import type { ReactElement } from "react"

const retainedSourceSha256 = "FA83985D9865FE54D18F0B3BFF57200829EDD95CB4C2EB4694C45BB92EB18C07"
const irSelectionContractSha256 = "D716C2702606A7EA7A00D72ED0434B56A3BF4F13B6F9638E92221BDF9E68852D"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"

const projectPadGapMm = 0.5
const projectPadLengthMm = 0.9
const projectPadWidthMm = 0.9
const projectPadCenterXMm = (projectPadGapMm + projectPadLengthMm) / 2
const projectMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("BP-033 Yageo IR baseline must contain data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * Descriptor-safe graph comparison. Supplied getters are never read, and
 * symbols, hidden properties, aliases, cycles, prototypes, and flag drift fail closed.
 */
function hasExactDataGraph(
  actual: unknown,
  expected: unknown,
  actualToExpected = new WeakMap<object, object>(),
  expectedToActual = new WeakMap<object, object>(),
  active = new WeakSet<object>()
): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected) || active.has(actual)) return false
  const mappedExpected = actualToExpected.get(actual)
  const mappedActual = expectedToActual.get(expected)
  if (mappedExpected !== undefined || mappedActual !== undefined)
    return mappedExpected === expected && mappedActual === actual
  actualToExpected.set(actual, expected)
  expectedToActual.set(expected, actual)
  active.add(actual)

  try {
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
    ) {
      return false
    }
    return actualKeys.every((key) => {
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
      return hasExactDataGraph(
        actualDescriptor.value,
        expectedDescriptor.value,
        actualToExpected,
        expectedToActual,
        active
      )
    })
  } finally {
    active.delete(actual)
  }
}

const frozenBaseline = deepFreeze({
  artifactKind: "bp033-yageo-rc0603fr-07100rl-ir-review-candidate",
  workUnit: "BP-033",
  basisCommit: "83c7aab779cc4000b74eba790d285700578b8d69",
  manufacturer: "YAGEO",
  manufacturerPartNumber: "RC0603FR-07100RL",
  package: "0603 / 1608",
  scope: "review-only; encrypted-IR supply isolation and output fault/backfeed resistors",
  rootIntegrationHandoff: {
    canonicalLedgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
    canonicalWorkUnit: "BP-033",
    integrationStatus: "root-integration-handoff",
    requiredRows: [
      { reference: "R_IR_VS", manufacturer: "YAGEO", manufacturerPartNumber: "RC0603FR-07100RL", package: "0603" },
      { reference: "R_IR_OUT", manufacturer: "YAGEO", manufacturerPartNumber: "RC0603FR-07100RL", package: "0603" }
    ],
    enforcement:
      "Root integration must enforce exactly these two canonical-ledger rows with the exact manufacturer, MPN, and package. This isolated candidate neither hashes nor authorizes mutation of the mutable ledger."
  },
  stableUpstreamSelectionContract: {
    workUnit: "BP-146",
    sourcePath: "packages/scoring-circuit/src/bench-prototype-ir-receiver-selection.ts",
    sha256: irSelectionContractSha256,
    requiredRows: [
      {
        reference: "R_IR_VS",
        topology: "APP_3V3 -> R_IR_VS -> IR_3V3_FILTERED -> receiver VS pin 3",
        purpose: "supply ripple and spike isolation"
      },
      {
        reference: "R_IR_OUT",
        topology: "receiver OUT pin 1 -> R_IR_OUT -> IR_RX_GPIO35",
        purpose: "limits fault/backfeed current and damps the short GPIO trace"
      }
    ]
  },
  source: {
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "YAGEO",
    manufacturerPartNumber: "RC0603FR-07100RL",
    url: "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100rl-datasheet.pdf",
    sha256: retainedSourceSha256,
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      markers: ["RC0603FR-07100RL", "100 Ohms", "1%", "0603 / 1608"]
    }
  },
  exactOrderableCharacteristics: {
    series: "RC Standard Thick Film Chip Resistors",
    resistanceOhms: 100,
    tolerancePercent: 1,
    powerW: 0.1,
    temperatureCoefficientPpmPerC: 100,
    operatingTemperatureC: { minimum: -55, maximum: 155 },
    continuousVoltageVdc: 75,
    packageDimensionsMm: {
      length: { nominal: 1.6, plusMinus: 0.1 },
      width: { nominal: 0.8, plusMinus: 0.1 },
      thickness: { nominal: 0.45, plusMinus: 0.1 },
      terminalLength: { nominal: 0.25, plusMinus: 0.15 }
    }
  },
  manufacturerLandPattern: {
    sourceScope: "retained exact-part product specification; land-pattern guidance not published",
    copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
    solderMask: { status: "not-published" },
    paste: { status: "not-published" },
    courtyard: { status: "not-published" }
  },
  manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
  projectReviewInputs: {
    authority: "project-review-input-not-manufacturer-land-pattern",
    copperPads: {
      padLengthMm: projectPadLengthMm,
      padWidthMm: projectPadWidthMm,
      innerGapMm: projectPadGapMm,
      centerXMm: projectPadCenterXMm
    },
    solderMask: {
      marginPerEdgeMm: projectMaskMarginMm,
      openingLengthMm: 1,
      openingWidthMm: 1,
      state: "project-review-input"
    },
    paste: {
      reductionPerEdgeMm: projectPasteReductionMm,
      openingLengthMm: 0.8,
      openingWidthMm: 0.8,
      state: "project-review-input"
    },
    courtyard: { lengthMm: 2.4, widthMm: 1.4, clearanceMm: 0.15, state: "project-review-input" }
  },
  orientation: {
    state: "pending-independent-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    placementAuthority: "deny",
    note: "Electrical rotation is equivalent; printed-value orientation, board placement, clearance, and assembly stress remain unreviewed."
  },
  artwork: {
    state: "isolated-generated-project-review-only",
    representation: "two-pad review footprint with project-only mask, paste, and courtyard inputs",
    sha256: artworkSha256,
    authority: "deny"
  },
  gates: {
    projectCadImport: "deny",
    boardPlacement: "deny",
    geometryAcceptance: "deny",
    orientationAcceptance: "deny",
    fabrication: "deny",
    release: "deny",
    accepted: false
  }
} as const)

/** A separately cloned public review record; the frozen baseline is private validator authority. */
export const bp033YageoRc0603fr07100rlIrReviewCandidate = deepFreeze(structuredClone(frozenBaseline))

export interface Bp033YageoRc0603fr07100rlIrReviewCandidateProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated project-review artwork only; it is neither a board placement nor a fabrication artifact. */
export function Bp033YageoRc0603fr07100rlIrReviewCandidate({
  pcbRotation,
  pcbX,
  pcbY
}: Bp033YageoRc0603fr07100rlIrReviewCandidateProps = {}): ReactElement {
  return (
    <chip
      name="R_BP033_YAGEO_RC0603FR_07100RL_IR_REVIEW"
      manufacturerPartNumber="RC0603FR-07100RL"
      pinLabels={{ pin1: "A", pin2: "B" }}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
      footprint={
        <footprint name="BP033_YAGEO_RC0603FR_07100RL_0603_IR_REVIEW" originalLayer="top">
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
          <courtyardrect pcbX={0} pcbY={0} width="2.4mm" height="1.4mm" strokeWidth="0.05mm" />
        </footprint>
      }
    />
  )
}

/** Empty output means only that this denied review record exactly matches its private baseline. */
export function validateBp033YageoRc0603fr07100rlIrReviewCandidate(
  value: unknown = bp033YageoRc0603fr07100rlIrReviewCandidate
): readonly string[] {
  if (!hasExactDataGraph(value, frozenBaseline)) {
    return ["BP-033 Yageo RC0603FR-07100RL IR review record must exactly match its private frozen baseline"]
  }
  return []
}

export function isBp033YageoRc0603fr07100rlIrReviewCandidate(value: unknown): value is typeof frozenBaseline {
  return validateBp033YageoRc0603fr07100rlIrReviewCandidate(value).length === 0
}
