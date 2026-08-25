import { Fragment, type ReactElement } from "react"
import {
  benchPrototypeIsolationChannel,
  validateBenchPrototypeIsolationChannel
} from "./bench-prototype-isolation-channel.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function freezeDataGraph<const Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-032 private evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 private evidence may contain only data properties")
    }
    freezeDataGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isExactDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  const actualObject = actual !== null && typeof actual === "object"
  const expectedObject = expected !== null && typeof expected === "object"
  if (!(actualObject && expectedObject)) return Object.is(actual, expected)
  try {
    if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
    actualSeen.add(actual)
    expectedSeen.add(expected)
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
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
        actualDescriptor.configurable === expectedDescriptor.configurable &&
        actualDescriptor.writable === expectedDescriptor.writable &&
        isExactDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
      )
    })
  } catch {
    return false
  }
}

function createPads(pinCount: 8 | 16, rowCenterMm: number, topYmm: number, pinsPerSide: number, padWidthMm: number) {
  const left = Array.from({ length: pinsPerSide }, (_, index) => ({
    pin: index + 1,
    xMm: -rowCenterMm,
    yMm: topYmm - index * 1.27,
    widthMm: padWidthMm,
    heightMm: 0.6
  }))
  const right = Array.from({ length: pinsPerSide }, (_, index) => ({
    pin: pinCount - index,
    xMm: rowCenterMm,
    yMm: topYmm - index * 1.27,
    widthMm: padWidthMm,
    heightMm: 0.6
  }))
  return [...left, ...right]
}

const privateEvidence = freezeDataGraph({
  artifactKind: "bp032-ti-isolator-footprint-evidence",
  workUnit: "BP-032",
  sourceControl: {
    basisCommit: "40d41db371b04a3479afdee16867da68ba1982e3",
    canonicalContract: {
      path: "packages/scoring-circuit/src/bench-prototype-isolation-channel.ts",
      sha256: "2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1",
      workUnit: "BP-122"
    }
  },
  devices: [
    {
      canonicalReference: "U_ISO_MAIN",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "ISO7762FDWR",
      role: "main six-channel isolation boundary",
      package: "DW SOIC-16 wide",
      manufacturerSource: {
        authority: "manufacturer-primary",
        artifactPath: "docs/evidence/bp-032/ti-iso7762.pdf",
        documentNumber: "SLLSER1H",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/iso7762.pdf",
        sha256: "FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22",
        reviewedPages: [1, 4, 38, 42, 44, 45, 46, 47, 48],
        exactOrderablePages: [38, 42, 44],
        packagePages: [45, 46, 47, 48],
        pinOnePage: 4,
        landPatternExamplePage: 47
      },
      manufacturerFacts: {
        exactOrderableStatus: "manufacturer-specified-exact-orderable",
        packageStatus: "manufacturer-specified-package",
        pinCount: 16,
        pinPitchMm: 1.27,
        pinOneStatus: "manufacturer-specified",
        landPatternStatus: "manufacturer-example-not-cad"
      },
      pinDirectionMap: [
        { channel: 1, direction: "scoring-to-application", signal: "SCORE_SCK", scoringPin: 2, applicationPin: 15 },
        { channel: 2, direction: "scoring-to-application", signal: "SCORE_MOSI", scoringPin: 3, applicationPin: 14 },
        { channel: 3, direction: "scoring-to-application", signal: "SCORE_CS_N", scoringPin: 4, applicationPin: 13 },
        { channel: 4, direction: "scoring-to-application", signal: "RESET_REQUEST", scoringPin: 5, applicationPin: 12 },
        { channel: 5, direction: "application-to-scoring", signal: "SCORE_MISO", scoringPin: 6, applicationPin: 11 },
        {
          channel: 6,
          direction: "application-to-scoring",
          signal: "ESP32_HEARTBEAT",
          scoringPin: 7,
          applicationPin: 10
        }
      ],
      projectGeometry: {
        status: "project-review-input",
        copperSource: "TI DW land-pattern example, rendered as project geometry",
        pads: createPads(16, 4.875, 4.445, 8, 1.65),
        solderMask: { status: "project-rendered", insetPerEdgeMm: 0.07 },
        paste: { status: "project-rendered", reductionPerEdgeMm: 0 },
        courtyard: { status: "project-review-input", widthMm: 11.9, heightMm: 9.99, clearanceMm: 0.25 },
        orientation: { status: "pending-layout-review", topViewPinOne: "upper-left" }
      },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      gates: {
        cad: "deny",
        placement: "deny",
        physicalIsolation: "deny",
        release: "deny",
        fabrication: "deny"
      }
    },
    {
      canonicalReference: "U_ISO_AUX",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "ISO7721FDR",
      role: "auxiliary two-channel isolation boundary",
      package: "D SOIC-8 narrow",
      manufacturerSource: {
        authority: "manufacturer-primary",
        artifactPath: "docs/evidence/bp-032/ti-iso7721.pdf",
        documentNumber: "SLLSEP3G",
        sourceUrl: "https://www.ti.com/lit/ds/symlink/iso7721.pdf",
        sha256: "FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C",
        reviewedPages: [1, 5, 34, 35, 36, 37, 38, 41, 43],
        exactOrderablePages: [37, 38, 41, 43],
        packagePages: [34, 35, 36, 37],
        pinOnePage: 5,
        landPatternExamplePage: 35
      },
      manufacturerFacts: {
        exactOrderableStatus: "manufacturer-specified-exact-orderable",
        packageStatus: "manufacturer-specified-package",
        pinCount: 8,
        pinPitchMm: 1.27,
        pinOneStatus: "manufacturer-specified",
        landPatternStatus: "manufacturer-example-not-cad"
      },
      pinDirectionMap: [
        {
          channel: 1,
          direction: "scoring-to-application",
          signal: "STM32_HEARTBEAT",
          scoringPin: 3,
          applicationPin: 6
        },
        {
          channel: 2,
          direction: "application-to-scoring",
          signal: "SERVICE_ONLY_REVERSE_CHANNEL",
          scoringPin: 2,
          applicationPin: 7
        }
      ],
      projectGeometry: {
        status: "project-review-input",
        copperSource: "TI D land-pattern example, rendered as project geometry",
        pads: createPads(8, 2.75, 1.905, 4, 1.4),
        solderMask: { status: "project-rendered", insetPerEdgeMm: 0.07 },
        paste: { status: "project-rendered", reductionPerEdgeMm: 0 },
        courtyard: { status: "project-review-input", widthMm: 7.4, heightMm: 4.91, clearanceMm: 0.25 },
        orientation: { status: "pending-layout-review", topViewPinOne: "upper-left" }
      },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      gates: {
        cad: "deny",
        placement: "deny",
        physicalIsolation: "deny",
        release: "deny",
        fabrication: "deny"
      }
    }
  ]
} as const)

export const bp032TiIsolatorFootprintEvidence = freezeDataGraph(structuredClone(privateEvidence))

type IsolatorEvidence = (typeof bp032TiIsolatorFootprintEvidence.devices)[number]

function canonicalPinMapMatches(): boolean {
  try {
    validateBenchPrototypeIsolationChannel(benchPrototypeIsolationChannel)
    const main = benchPrototypeIsolationChannel.isolators.main
    const auxiliary = benchPrototypeIsolationChannel.isolators.auxiliary
    const mainEvidence = privateEvidence.devices[0]
    const auxiliaryEvidence = privateEvidence.devices[1]
    if (
      main.part !== mainEvidence.manufacturerPartNumber ||
      auxiliary.part !== auxiliaryEvidence.manufacturerPartNumber ||
      mainEvidence.canonicalReference !== "U_ISO_MAIN" ||
      auxiliaryEvidence.canonicalReference !== "U_ISO_AUX" ||
      main.channels.length !== mainEvidence.pinDirectionMap.length ||
      auxiliary.channels.length !== auxiliaryEvidence.pinDirectionMap.length
    ) {
      return false
    }
    const matches = (
      channel: {
        channel: number
        direction: string
        signal: string
        scoring: { pin: number }
        application: { pin: number }
      },
      evidence: IsolatorEvidence["pinDirectionMap"][number]
    ) =>
      channel.channel === evidence.channel &&
      channel.direction === evidence.direction &&
      channel.signal === evidence.signal &&
      channel.scoring.pin === evidence.scoringPin &&
      channel.application.pin === evidence.applicationPin
    return (
      main.channels.every((channel, index) => {
        const evidence = mainEvidence.pinDirectionMap[index]
        return evidence !== undefined && matches(channel, evidence)
      }) &&
      auxiliary.channels.every((channel, index) => {
        const evidence = auxiliaryEvidence.pinDirectionMap[index]
        return evidence !== undefined && matches(channel, evidence)
      })
    )
  } catch {
    return false
  }
}

/** Empty output means the candidate exactly matches its private baseline and current BP-122 pin map. */
export function validateBp032TiIsolatorFootprintEvidence(
  candidate: unknown = bp032TiIsolatorFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  if (!isExactDataGraph(candidate, privateEvidence)) {
    errors.push("BP-032 isolator candidate must exactly match the private, alias-free, fabrication-denied baseline")
  }
  if (!canonicalPinMapMatches()) {
    errors.push("BP-032 isolator exact identities, references, or pin directions no longer match BP-122")
  }
  return errors
}

function footprintFor(device: IsolatorEvidence): ReactElement {
  const { courtyard, pads, paste, solderMask } = device.projectGeometry
  return (
    <footprint name={`BP032_${device.canonicalReference}_PROJECT_FOOTPRINT`} originalLayer="top">
      {pads.map((pad) => (
        <Fragment key={pad.pin}>
          <smtpad
            name={`${pad.pin}`}
            pcbX={pad.xMm}
            pcbY={pad.yMm}
            shape="rect"
            solderMaskMargin={`-${solderMask.insetPerEdgeMm}mm`}
            solderPasteMargin={`-${paste.reductionPerEdgeMm}mm`}
            width={`${pad.widthMm}mm`}
            height={`${pad.heightMm}mm`}
            portHints={[`${pad.pin}`, `pin${pad.pin}`, ...(pad.pin === 1 ? ["pin1"] : [])]}
          />
        </Fragment>
      ))}
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${courtyard.widthMm}mm`}
        height={`${courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

export interface Bp032TiIsolatorFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Review-only rendering for U_ISO_MAIN. It does not authorize placement or fabrication. */
export function Bp032Iso7762FdwrFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032TiIsolatorFootprintProps = {}): ReactElement {
  const device = bp032TiIsolatorFootprintEvidence.devices[0]
  return (
    <chip
      name={device.canonicalReference}
      manufacturerPartNumber={device.manufacturerPartNumber}
      pinLabels={Object.fromEntries(device.projectGeometry.pads.map((pad) => [`pin${pad.pin}`, `${pad.pin}`]))}
      footprint={footprintFor(device)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

/** Review-only rendering for U_ISO_AUX. It does not authorize placement or fabrication. */
export function Bp032Iso7721FdrFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032TiIsolatorFootprintProps = {}): ReactElement {
  const device = bp032TiIsolatorFootprintEvidence.devices[1]
  return (
    <chip
      name={device.canonicalReference}
      manufacturerPartNumber={device.manufacturerPartNumber}
      pinLabels={Object.fromEntries(device.projectGeometry.pads.map((pad) => [`pin${pad.pin}`, `${pad.pin}`]))}
      footprint={footprintFor(device)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp032Iso7762FdwrFootprint
