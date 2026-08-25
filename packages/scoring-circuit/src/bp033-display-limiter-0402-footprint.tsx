/* oxlint-disable react/no-unknown-property */

import type { ReactElement } from "react"
import { benchPrototypeApplicationFootprints } from "./bench-prototype-application-footprints.js"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

const expectedReferences = [
  "R_DISPLAY_ILM",
  "C_DISPLAY_BYPASS",
  "C_DISPLAY_DVDT",
  "C_DISPLAY_ITIMER",
  "R_DISPLAY_PG_PULLUP",
  "R_DISPLAY_PG_LOWER",
  "R_DISPLAY_PG_UPPER"
] as const

const expectedCanonicalRows = [
  { reference: "R_DISPLAY_ILM", manufacturer: "Yageo", mpn: "RC0402FR-07698RL", package: "0402" },
  { reference: "C_DISPLAY_BYPASS", manufacturer: "KEMET", mpn: "C0402C104K3RACTU", package: "0402" },
  { reference: "C_DISPLAY_DVDT", manufacturer: "KEMET", mpn: "C0402C222K3RACTU", package: "0402" },
  { reference: "C_DISPLAY_ITIMER", manufacturer: "KEMET", mpn: "C0402C222K3RACTU", package: "0402" },
  { reference: "R_DISPLAY_PG_PULLUP", manufacturer: "Yageo", mpn: "RC0402FR-0710KL", package: "0402" },
  { reference: "R_DISPLAY_PG_LOWER", manufacturer: "Yageo", mpn: "RC0402FR-0749K9L", package: "0402" },
  { reference: "R_DISPLAY_PG_UPPER", manufacturer: "Yageo", mpn: "RC0402FR-07137KL", package: "0402" }
] as const

const sourceDefinitions = [
  {
    id: "bp033-yageo-rc0402fr-07698rl-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "Yageo",
    manufacturerPartNumber: "RC0402FR-07698RL",
    package: "0402",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07698RL",
    artifactPath: "docs/evidence/bp-033/yageo-rc0402fr-07698rl-specsheet.pdf",
    sha256: "B22937845B9DD9352E2959C69AE306C0D74BD998FB072481640602BC469D1DC6",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      markers: ["RC0402FR-07698RL", "698 Ohms", "1mm +/-0.05mm", "0.5mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      resistanceOhms: 698,
      tolerancePercent: 1,
      powerWAt70C: 0.063,
      temperatureCoefficientPpmPerC: 100,
      operatingTemperatureC: { minimum: -55, maximum: 155 },
      maximumContinuousVoltageV: 50,
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.35, plusMinus: 0.05 },
        terminalB1: { nominal: 0.2, plusMinus: 0.1 },
        terminalB2: { nominal: 0.25, plusMinus: 0.1 }
      }
    },
    references: ["R_DISPLAY_ILM"]
  },
  {
    id: "bp033-yageo-rc0402fr-0710kl-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "Yageo",
    manufacturerPartNumber: "RC0402FR-0710KL",
    package: "0402",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL",
    artifactPath: "docs/evidence/bp-033/yageo-rc0402fr-0710kl-specsheet.pdf",
    sha256: "85ACEB87C42E4093DDDCD9563251F2E47E9EF8D0432D1F03B3A03FAEADD86BA3",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      markers: ["RC0402FR-0710KL", "10 kOhms", "1mm +/-0.05mm", "0.5mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      resistanceOhms: 10000,
      tolerancePercent: 1,
      powerWAt70C: 0.063,
      temperatureCoefficientPpmPerC: 100,
      operatingTemperatureC: { minimum: -55, maximum: 155 },
      maximumContinuousVoltageV: 50,
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.35, plusMinus: 0.05 },
        terminalB1: { nominal: 0.2, plusMinus: 0.1 },
        terminalB2: { nominal: 0.25, plusMinus: 0.1 }
      }
    },
    references: ["R_DISPLAY_PG_PULLUP"]
  },
  {
    id: "bp033-yageo-rc0402fr-0749k9l-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "Yageo",
    manufacturerPartNumber: "RC0402FR-0749K9L",
    package: "0402",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0749K9L",
    artifactPath: "docs/evidence/bp-033/yageo-rc0402fr-0749k9l-specsheet.pdf",
    sha256: "B531815E39E63385D45860F0C737FF8627681D448DC3497AAE5D46157474EA2B",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      markers: ["RC0402FR-0749K9L", "49.9 kOhms", "1mm +/-0.05mm", "0.5mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      resistanceOhms: 49900,
      tolerancePercent: 1,
      powerWAt70C: 0.063,
      temperatureCoefficientPpmPerC: 100,
      operatingTemperatureC: { minimum: -55, maximum: 155 },
      maximumContinuousVoltageV: 50,
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.35, plusMinus: 0.05 },
        terminalB1: { nominal: 0.2, plusMinus: 0.1 },
        terminalB2: { nominal: 0.25, plusMinus: 0.1 }
      }
    },
    references: ["R_DISPLAY_PG_LOWER"]
  },
  {
    id: "bp033-yageo-rc0402fr-07137kl-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "Yageo",
    manufacturerPartNumber: "RC0402FR-07137KL",
    package: "0402",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07137KL",
    artifactPath: "docs/evidence/bp-033/yageo-rc0402fr-07137kl-specsheet.pdf",
    sha256: "7C76432DCDCB6DCC6D35F07B9281CC0EF5189AF5C9A26A7115FA8818F1B72D7B",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 1,
      exactOrderablePdfPage: 1,
      markers: ["RC0402FR-07137KL", "137 kOhms", "1mm +/-0.05mm", "0.5mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      resistanceOhms: 137000,
      tolerancePercent: 1,
      powerWAt70C: 0.063,
      temperatureCoefficientPpmPerC: 100,
      operatingTemperatureC: { minimum: -55, maximum: 155 },
      maximumContinuousVoltageV: 50,
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.35, plusMinus: 0.05 },
        terminalB1: { nominal: 0.2, plusMinus: 0.1 },
        terminalB2: { nominal: 0.25, plusMinus: 0.1 }
      }
    },
    references: ["R_DISPLAY_PG_UPPER"]
  },
  {
    id: "bp033-kemet-c0402c104k3ractu-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C0402C104K3RACTU",
    package: "0402",
    url: "https://search.kemet.com/component-documentation/download/specsheet/C0402C104K3RACTU",
    artifactPath: "docs/evidence/bp-033/kemet-c0402c104k3ractu-specsheet.pdf",
    sha256: "889DE4201A2C26835545FC3BE215BE03637E2D3422FCC86B5FA5D96DBE0B30F1",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 4,
      exactOrderablePdfPage: 1,
      simulationPagesExcluded: [2, 3, 4],
      markers: ["C0402C104K3RACTU", "0.1 uF", "25 VDC", "1mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      capacitanceUf: 0.1,
      tolerancePercent: 10,
      ratedVoltageVdc: 25,
      dielectric: "X7R",
      operatingTemperatureC: { minimum: -55, maximum: 125 },
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.5, plusMinus: 0.05 },
        terminalSpacingMinimum: 0.3,
        terminalB: { nominal: 0.3, plusMinus: 0.1 }
      }
    },
    references: ["C_DISPLAY_BYPASS"]
  },
  {
    id: "bp033-kemet-c0402c222k3ractu-specsheet",
    authority: "manufacturer-primary-retained-bytes",
    manufacturer: "KEMET",
    manufacturerPartNumber: "C0402C222K3RACTU",
    package: "0402",
    url: "https://search.kemet.com/component-documentation/download/specsheet/C0402C222K3RACTU",
    artifactPath: "docs/evidence/bp-033/kemet-c0402c222k3ractu-specsheet.pdf",
    sha256: "54F836BE838A054C9E696CD8FDB0C9529A190E11B1372C2ADCD615CD97A22133",
    reviewedPages: [1],
    pageBinding: {
      retainedPdfPageCount: 4,
      exactOrderablePdfPage: 1,
      simulationPagesExcluded: [2, 3, 4],
      markers: ["C0402C222K3RACTU", "2,200 pF", "25 VDC", "1mm +/-0.05mm", "0402 / 1005"]
    },
    orderableCharacteristics: {
      capacitanceNf: 2.2,
      tolerancePercent: 10,
      ratedVoltageVdc: 25,
      dielectric: "X7R",
      operatingTemperatureC: { minimum: -55, maximum: 125 },
      bodyMm: {
        length: { nominal: 1, plusMinus: 0.05 },
        width: { nominal: 0.5, plusMinus: 0.05 },
        thickness: { nominal: 0.5, plusMinus: 0.05 },
        terminalSpacingMinimum: 0.3,
        terminalB: { nominal: 0.3, plusMinus: 0.1 }
      }
    },
    references: ["C_DISPLAY_DVDT", "C_DISPLAY_ITIMER"]
  }
] as const

const yageoGeometry = {
  geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
  bodyPackage: "0402 / 1005, two-terminal thick-film resistor",
  pads: [
    { pad: "1", terminal: "A", xMm: -0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 },
    { pad: "2", terminal: "B", xMm: 0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 }
  ],
  innerGapMm: 0.4,
  solderMask: { marginPerEdgeMm: 0.05, status: "project-review-input" },
  paste: { reductionPerEdgeMm: 0.05, status: "project-review-input" },
  courtyard: { lengthMm: 1.6, widthMm: 1.1, status: "project-review-input-not-manufacturer-specification" },
  orientation: {
    polarity: "non-polar",
    pinOne: "not-applicable",
    datum: "pad 1 at negative local X; pad 2 at positive local X",
    boardRotationDegrees: 0,
    placementAuthority: "deny"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const kemetGeometry = {
  geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
  bodyPackage: "0402 / 1005, two-terminal ceramic MLCC",
  pads: [
    { pad: "1", terminal: "A", xMm: -0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 },
    { pad: "2", terminal: "B", xMm: 0.5, yMm: 0, widthMm: 0.6, heightMm: 0.6 }
  ],
  innerGapMm: 0.4,
  solderMask: { marginPerEdgeMm: 0.05, status: "project-review-input" },
  paste: { reductionPerEdgeMm: 0.05, status: "project-review-input" },
  courtyard: { lengthMm: 1.6, widthMm: 1.1, status: "project-review-input-not-manufacturer-specification" },
  orientation: {
    polarity: "non-polar",
    pinOne: "not-applicable",
    datum: "pad 1 at negative local X; pad 2 at positive local X",
    boardRotationDegrees: 0,
    placementAuthority: "deny"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const candidateDefinition = {
  artifactKind: "bp033-display-limiter-0402-footprint",
  workUnit: "BP-033",
  scope: "prototype-first exact seven-reference display-limiter footprint evidence",
  canonicalBinding: {
    ledgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
    sourceContract: "BP-050",
    exactReferenceSet: expectedReferences,
    exactRows: expectedCanonicalRows,
    powerContractPath: "packages/scoring-circuit/src/bench-prototype-power.ts",
    displayLimiterRole: "branches.display.limiter",
    genericFamilySubstitution: "deny"
  },
  sourceDefinitions,
  geometryGroups: [
    {
      groupId: "yageo-rc0402-resistors",
      manufacturer: "Yageo",
      package: "0402",
      references: ["R_DISPLAY_ILM", "R_DISPLAY_PG_PULLUP", "R_DISPLAY_PG_LOWER", "R_DISPLAY_PG_UPPER"],
      sourceIds: [
        "bp033-yageo-rc0402fr-07698rl-specsheet",
        "bp033-yageo-rc0402fr-0710kl-specsheet",
        "bp033-yageo-rc0402fr-0749k9l-specsheet",
        "bp033-yageo-rc0402fr-07137kl-specsheet"
      ],
      projectFootprint: yageoGeometry
    },
    {
      groupId: "kemet-c0402-mlccs",
      manufacturer: "KEMET",
      package: "0402",
      references: ["C_DISPLAY_BYPASS", "C_DISPLAY_DVDT", "C_DISPLAY_ITIMER"],
      sourceIds: ["bp033-kemet-c0402c104k3ractu-specsheet", "bp033-kemet-c0402c222k3ractu-specsheet"],
      projectFootprint: kemetGeometry
    }
  ],
  referenceBindings: [
    {
      reference: "R_DISPLAY_ILM",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0402FR-07698RL",
      package: "0402",
      groupId: "yageo-rc0402-resistors",
      sourceId: "bp033-yageo-rc0402fr-07698rl-specsheet",
      connection: "U_DISPLAY_LIMITER.ILM to APP_GND"
    },
    {
      reference: "C_DISPLAY_BYPASS",
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0402C104K3RACTU",
      package: "0402",
      groupId: "kemet-c0402-mlccs",
      sourceId: "bp033-kemet-c0402c104k3ractu-specsheet",
      connection: "V5_DISPLAY_IN to APP_GND"
    },
    {
      reference: "C_DISPLAY_DVDT",
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0402C222K3RACTU",
      package: "0402",
      groupId: "kemet-c0402-mlccs",
      sourceId: "bp033-kemet-c0402c222k3ractu-specsheet",
      connection: "U_DISPLAY_LIMITER.DVDT to APP_GND"
    },
    {
      reference: "C_DISPLAY_ITIMER",
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0402C222K3RACTU",
      package: "0402",
      groupId: "kemet-c0402-mlccs",
      sourceId: "bp033-kemet-c0402c222k3ractu-specsheet",
      connection: "U_DISPLAY_LIMITER.ITIMER to APP_GND"
    },
    {
      reference: "R_DISPLAY_PG_PULLUP",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0402FR-0710KL",
      package: "0402",
      groupId: "yageo-rc0402-resistors",
      sourceId: "bp033-yageo-rc0402fr-0710kl-specsheet",
      connection: "V3_3 to U_DISPLAY_LIMITER.PG"
    },
    {
      reference: "R_DISPLAY_PG_LOWER",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0402FR-0749K9L",
      package: "0402",
      groupId: "yageo-rc0402-resistors",
      sourceId: "bp033-yageo-rc0402fr-0749k9l-specsheet",
      connection: "U_DISPLAY_LIMITER.PGTH to APP_GND"
    },
    {
      reference: "R_DISPLAY_PG_UPPER",
      manufacturer: "Yageo",
      manufacturerPartNumber: "RC0402FR-07137KL",
      package: "0402",
      groupId: "yageo-rc0402-resistors",
      sourceId: "bp033-yageo-rc0402fr-07137kl-specsheet",
      connection: "V5_DISPLAY_LIMITED to U_DISPLAY_LIMITER.PGTH"
    }
  ],
  manufacturerLandPattern: {
    state: "not-published-by-retained-exact-orderable-sources",
    copper: "not-published",
    solderMask: "not-published",
    paste: "not-published",
    courtyard: "not-published",
    manufacturerCad: "not-acquired"
  },
  orientation: {
    state: "non-polar-project-review-input-only",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    placementAuthority: "deny",
    note: "Both groups are electrically non-polar; rotation is review-equivalent only and does not authorize placement."
  },
  artwork: {
    state: "isolated-generated-project-review-only",
    authority: "deny",
    placement: "not-assigned",
    boardIntegration: "deny"
  },
  gates: {
    manufacturerCad: "deny-not-acquired",
    projectCadImport: "deny",
    boardPlacement: "deny",
    projectGeometryAcceptance: "deny",
    orientationAcceptance: "deny",
    drc: "deny",
    fabrication: "deny",
    release: "deny"
  },
  accepted: false
} as const

function deepFreezeStrict<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 display-limiter graph cannot contain aliases or cycles")
  seen.add(value)
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype) {
    throw new RangeError("BP-033 display-limiter graph must contain plain objects and arrays")
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      typeof key === "symbol" ||
      ((!array || key !== "length") && !descriptor.enumerable)
    ) {
      throw new RangeError("BP-033 display-limiter graph must contain enumerable data properties only")
    }
    deepFreezeStrict(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const privateFrozenBaseline = deepFreezeStrict(candidateDefinition)

/** Public review graph cloned and frozen independently from the validator baseline. */
export const bp033DisplayLimiter0402Footprint = deepFreezeStrict(structuredClone(privateFrozenBaseline))

type GraphState = {
  readonly actualSeen: WeakSet<object>
  readonly expectedSeen: WeakSet<object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphState, path: string): void {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 display-limiter drift at ${path}`)
    return
  }
  if (actual === null || typeof actual !== "object") throw new RangeError(`BP-033 display-limiter drift at ${path}`)
  if (state.expectedSeen.has(expected)) throw new RangeError(`BP-033 baseline alias at ${path}`)
  if (state.actualSeen.has(actual)) throw new RangeError(`BP-033 candidate cycle or alias at ${path}`)
  state.expectedSeen.add(expected)
  state.actualSeen.add(actual)

  try {
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
      throw new RangeError(`BP-033 prototype drift at ${path}`)
    }
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actualKeys.length !== expectedKeys.length ||
      expectedKeys.some((key) => typeof key === "symbol" || !actualKeys.includes(key)) ||
      actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
    ) {
      throw new RangeError(`BP-033 key drift at ${path}`)
    }
    for (const key of expectedKeys) {
      if (typeof key !== "string") throw new RangeError(`BP-033 symbol key at ${path}`)
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
        throw new RangeError(`BP-033 descriptor or accessor drift at ${path}.${key}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${key}`)
    }
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError(`BP-033 display-limiter graph inspection failed at ${path}`)
  }
}

function canonicalRowsMatch(): boolean {
  const rows = benchPrototypeApplicationFootprints.records.filter((record) =>
    expectedReferences.includes(record.reference as (typeof expectedReferences)[number])
  )
  return (
    rows.length === expectedCanonicalRows.length &&
    expectedCanonicalRows.every((expected) => {
      const row = rows.find((candidate) => candidate.reference === expected.reference)
      return (
        row !== undefined &&
        row.manufacturer === expected.manufacturer &&
        row.mpn === expected.mpn &&
        row.package === expected.package &&
        row.sourceContract === "BP-050"
      )
    })
  )
}

function powerContractMatches(): boolean {
  const limiter = defaultBenchPrototypePowerInputs.branches.display.limiter
  return (
    limiter.mpn === "TPS259474ARPWR" &&
    limiter.currentLimitResistorMpn === "RC0402FR-07698RL" &&
    limiter.bypassCapacitorMpn === "C0402C104K3RACTU" &&
    limiter.dvdTCapacitorMpn === "C0402C222K3RACTU" &&
    limiter.iTimerCapacitorMpn === "C0402C222K3RACTU" &&
    limiter.pgPullupMpn === "RC0402FR-0710KL" &&
    limiter.pgThresholdLowerMpn === "RC0402FR-0749K9L" &&
    limiter.pgThresholdUpperMpn === "RC0402FR-07137KL"
  )
}

export function validateBp033DisplayLimiter0402Footprint(
  value: unknown = bp033DisplayLimiter0402Footprint
): readonly string[] {
  const errors: string[] = []
  if (!canonicalRowsMatch()) errors.push("BP-033 canonical display-limiter reference or package rows drifted")
  if (!powerContractMatches()) errors.push("BP-033 display-limiter power contract MPN bindings drifted")
  try {
    assertExactDataGraph(
      value,
      privateFrozenBaseline,
      { actualSeen: new WeakSet<object>(), expectedSeen: new WeakSet<object>() },
      "root"
    )
  } catch {
    errors.push("BP-033 display-limiter exact graph or deny state drifted")
  }
  return errors
}

function renderReviewFootprint(
  name: string,
  manufacturerPartNumber: string,
  props: Bp033DisplayLimiter0402FootprintProps
): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
      footprint={
        <footprint name={`${name}_FOOTPRINT`} originalLayer="top">
          <smtpad
            name="1"
            pcbX={-0.5}
            pcbY={0}
            shape="rect"
            solderMaskMargin="0.05mm"
            solderPasteMargin="-0.05mm"
            width="0.6mm"
            height="0.6mm"
            portHints={["1", "A", "non-polar", "terminal-a"]}
          />
          <smtpad
            name="2"
            pcbX={0.5}
            pcbY={0}
            shape="rect"
            solderMaskMargin="0.05mm"
            solderPasteMargin="-0.05mm"
            width="0.6mm"
            height="0.6mm"
            portHints={["2", "B", "non-polar", "terminal-b"]}
          />
          <courtyardrect pcbX={0} pcbY={0} width="1.6mm" height="1.1mm" strokeWidth="0.05mm" />
        </footprint>
      }
    />
  )
}

export interface Bp033DisplayLimiter0402FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

export function Bp033DisplayLimiter0402YageoReviewFootprint(
  props: Bp033DisplayLimiter0402FootprintProps = {}
): ReactElement {
  return renderReviewFootprint("BP033_DISPLAY_LIMITER_YAGEO_RC0402_REVIEW", "RC0402FR-07698RL", props)
}

export function Bp033DisplayLimiter0402KemetReviewFootprint(
  props: Bp033DisplayLimiter0402FootprintProps = {}
): ReactElement {
  return renderReviewFootprint("BP033_DISPLAY_LIMITER_KEMET_C0402_REVIEW", "C0402C104K3RACTU", props)
}

validateBp033DisplayLimiter0402Footprint()

export default bp033DisplayLimiter0402Footprint
