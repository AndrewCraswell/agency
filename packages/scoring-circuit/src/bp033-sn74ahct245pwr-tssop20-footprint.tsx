import { type ReactElement } from "react"

const manufacturer = "Texas Instruments"
const manufacturerPartNumber = "SN74AHCT245PWR"
const packageName = "TSSOP-20"
const sourceArtifactPath = "docs/evidence/bp-033/ti-sn74ahct245-datasheet-official.pdf"
const sourceUrl = "https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf"
const sourceSha256 = "9E7C1B200CDEFD3DC72CD0E8B9019059FED2833B1B15AC80E97E099DFCAC93D7"
const supportSourcePath = "packages/scoring-circuit/src/application-display-carrier-support.ts"
const supportSourceSha256 = "CCF41BBF1DBB02A234007AB120652EE47A8F9DF5D531AAEFF2558F3F331A523D"
const bp144SourcePath = "packages/scoring-circuit/src/bench-prototype-hub75-safing.ts"
const bp144SourceSha256 = "0DBD6D07A1C10AA93C0DBC92062C271186A0FE5BA6B31B109F771544A4AFAAA2"

type PinRecord = {
  readonly pin: number
  readonly name: string
  readonly type: "input" | "input-output" | "power" | "ground"
  readonly function: string
}

type Hub75Signal = {
  readonly signal: string
  readonly gpio: number
  readonly buffer: "U_DISPLAY_BUFFER_A" | "U_DISPLAY_BUFFER_B"
  readonly input: string
  readonly output: string
  readonly bufferInputPin: number
  readonly bufferOutputPin: number
  readonly panelPin: string
  readonly panelPinNumber: number
  readonly inputPull: string
  readonly resetDefault: string
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-033 candidate cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 candidate accepts data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

const pinMap: readonly PinRecord[] = [
  { pin: 1, name: "DIR", type: "input", function: "direction-select; hard-tied A-to-B" },
  { pin: 2, name: "A1", type: "input-output", function: "channel A1 input/output" },
  { pin: 3, name: "A2", type: "input-output", function: "channel A2 input/output" },
  { pin: 4, name: "A3", type: "input-output", function: "channel A3 input/output" },
  { pin: 5, name: "A4", type: "input-output", function: "channel A4 input/output" },
  { pin: 6, name: "A5", type: "input-output", function: "channel A5 input/output" },
  { pin: 7, name: "A6", type: "input-output", function: "channel A6 input/output" },
  { pin: 8, name: "A7", type: "input-output", function: "channel A7 input/output" },
  { pin: 9, name: "A8", type: "input-output", function: "channel A8 input/output" },
  { pin: 10, name: "GND", type: "ground", function: "APP_GND logic reference" },
  { pin: 11, name: "B8", type: "input-output", function: "channel B8 input/output" },
  { pin: 12, name: "B7", type: "input-output", function: "channel B7 input/output" },
  { pin: 13, name: "B6", type: "input-output", function: "channel B6 input/output" },
  { pin: 14, name: "B5", type: "input-output", function: "channel B5 input/output" },
  { pin: 15, name: "B4", type: "input-output", function: "channel B4 input/output" },
  { pin: 16, name: "B3", type: "input-output", function: "channel B3 input/output" },
  { pin: 17, name: "B2", type: "input-output", function: "channel B2 input/output" },
  { pin: 18, name: "B1", type: "input-output", function: "channel B1 input/output" },
  { pin: 19, name: "OE", type: "input", function: "active-low output enable" },
  { pin: 20, name: "VCC", type: "power", function: "V5_DISPLAY_LIMITED" }
]

const hub75SignalMap: readonly Hub75Signal[] = [
  {
    signal: "HUB75_R1",
    gpio: 13,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A1",
    output: "B1",
    bufferInputPin: 2,
    bufferOutputPin: 18,
    panelPin: "R1",
    panelPinNumber: 1,
    inputPull: "R_HUB75_R1_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_G1",
    gpio: 14,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A2",
    output: "B2",
    bufferInputPin: 3,
    bufferOutputPin: 17,
    panelPin: "G1",
    panelPinNumber: 2,
    inputPull: "R_HUB75_G1_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_B1",
    gpio: 21,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A3",
    output: "B3",
    bufferInputPin: 4,
    bufferOutputPin: 16,
    panelPin: "B1",
    panelPinNumber: 3,
    inputPull: "R_HUB75_B1_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_R2",
    gpio: 16,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A4",
    output: "B4",
    bufferInputPin: 5,
    bufferOutputPin: 15,
    panelPin: "R2",
    panelPinNumber: 5,
    inputPull: "R_HUB75_R2_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_G2",
    gpio: 38,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A5",
    output: "B5",
    bufferInputPin: 6,
    bufferOutputPin: 14,
    panelPin: "G2",
    panelPinNumber: 6,
    inputPull: "R_HUB75_G2_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_B2",
    gpio: 39,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A6",
    output: "B6",
    bufferInputPin: 7,
    bufferOutputPin: 13,
    panelPin: "B2",
    panelPinNumber: 7,
    inputPull: "R_HUB75_B2_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_A",
    gpio: 40,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A7",
    output: "B7",
    bufferInputPin: 8,
    bufferOutputPin: 12,
    panelPin: "A",
    panelPinNumber: 9,
    inputPull: "R_HUB75_A_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_B",
    gpio: 41,
    buffer: "U_DISPLAY_BUFFER_A",
    input: "A8",
    output: "B8",
    bufferInputPin: 9,
    bufferOutputPin: 11,
    panelPin: "B",
    panelPinNumber: 10,
    inputPull: "R_HUB75_B_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_C",
    gpio: 42,
    buffer: "U_DISPLAY_BUFFER_B",
    input: "A1",
    output: "B1",
    bufferInputPin: 2,
    bufferOutputPin: 18,
    panelPin: "C",
    panelPinNumber: 11,
    inputPull: "R_HUB75_C_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_D",
    gpio: 45,
    buffer: "U_DISPLAY_BUFFER_B",
    input: "A2",
    output: "B2",
    bufferInputPin: 3,
    bufferOutputPin: 17,
    panelPin: "D",
    panelPinNumber: 12,
    inputPull: "R_HUB75_D_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_CLK",
    gpio: 46,
    buffer: "U_DISPLAY_BUFFER_B",
    input: "A3",
    output: "B3",
    bufferInputPin: 4,
    bufferOutputPin: 16,
    panelPin: "CLK",
    panelPinNumber: 13,
    inputPull: "R_HUB75_CLK_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_LAT",
    gpio: 48,
    buffer: "U_DISPLAY_BUFFER_B",
    input: "A4",
    output: "B4",
    bufferInputPin: 5,
    bufferOutputPin: 15,
    panelPin: "LAT",
    panelPinNumber: 14,
    inputPull: "R_HUB75_LAT_PD",
    resetDefault: "low black-data/address/clock/latch"
  },
  {
    signal: "HUB75_OE_N",
    gpio: 1,
    buffer: "U_DISPLAY_BUFFER_B",
    input: "A5",
    output: "B5",
    bufferInputPin: 6,
    bufferOutputPin: 14,
    panelPin: "OE",
    panelPinNumber: 15,
    inputPull: "R_HUB75_OE_PULLUP",
    resetDefault: "high panel blank request"
  }
]

const privateReviewedBaseline = deepFreeze({
  artifactKind: "bp033-sn74ahct245pwr-tssop20-review-candidate",
  workUnit: "BP-033",
  references: ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"],
  canonicalIdentity: {
    manufacturer,
    manufacturerPartNumber,
    package: packageName,
    packageCode: "PW",
    packagePins: 20,
    orderableStatus: "active production",
    supplyVoltageRange: "4.5 V to 5.5 V"
  },
  sourceBinding: {
    sourceArtifactPath,
    sourceUrl,
    sourceSha256,
    reviewedPages: [1, 3, 13, 20],
    sourceSections: {
      identityAndPackage: "page 1 Package Information; page 13 Package Option Addendum",
      pinOneAndPinMap: "page 3 Figure 5-1 and Table 5-1",
      packageOutline: "PDF page 20 PW0020A TSSOP package outline"
    },
    supportSourcePath,
    supportSourceSha256,
    bp144SourcePath,
    bp144SourceSha256,
    sourceDisposition: "retained-official-evidence-only"
  },
  officialEvidence: {
    authority: "manufacturer-primary",
    document: "SNx4AHCT245 Octal Bus Transceivers With 3-State Outputs, SCLS233S Rev. S",
    artifactPath: sourceArtifactPath,
    sha256: sourceSha256,
    url: sourceUrl,
    visualReview: {
      packageIdentityPage: 1,
      pinOneAndPinMapPage: 3,
      exactPwrOrderablePage: 13,
      packageOutlinePage: 20
    }
  },
  manufacturerFacts: {
    deviceFamily: "SN74AHCT245",
    packageDesignation: "PW (TSSOP, 20)",
    bodyNominalMm: { lengthMm: 6.5, widthMm: 4.4 },
    bodyLimitsMm: { lengthMm: { min: 6.2, max: 6.6 }, widthMm: { min: 4.3, max: 4.5 } },
    maximumHeightMm: 1.2,
    terminalCount: 20,
    terminalPitchMm: 0.65,
    terminalWidthMm: { min: 0.19, max: 0.3 },
    pinOneMark: "PIN 1 INDEX AREA",
    pinMap,
    electricalDirection: "DIR pin 1 selects direction; project binds A-to-B",
    outputEnable: "OE pin 19 is active-low",
    supplyPin: { pin: 20, name: "VCC" },
    groundPin: { pin: 10, name: "GND" }
  },
  manufacturerLandGuidance: {
    status: "not-published-in-retained-datasheet",
    sourceDrawing: "PW0020A is a mechanical package outline, not a PCB land-pattern recommendation",
    sourcePage: 20,
    copperGeometry: null,
    solderMaskGeometry: null,
    pasteGeometry: null,
    courtyardGeometry: null,
    disposition: "do-not-infer-copper-mask-paste-or-courtyard-from-lead-outline"
  },
  interfaceBinding: {
    sourceContract: "BP-144 reset-safe HUB75 path",
    supplyNet: "V5_DISPLAY_LIMITED",
    groundNet: "APP_GND",
    direction: "DIR pin 1 hard-tied A-to-B",
    outputEnable: "pin 19 BUFFER_ENABLE_N; high is high impedance and low enables outputs",
    signalMap: hub75SignalMap,
    unusedBufferBInputs: [
      { input: "A6", inputPin: 7, output: "B6", outputPin: 13, disposition: "NC with 10 kOhm APP_GND pulldown" },
      { input: "A7", inputPin: 8, output: "B7", outputPin: 12, disposition: "NC with 10 kOhm APP_GND pulldown" },
      { input: "A8", inputPin: 9, output: "B8", outputPin: 11, disposition: "NC with 10 kOhm APP_GND pulldown" }
    ],
    bypass: { capacitorMpn: "C0603C104K3RACTU", value: "100 nF X7R", pin: 20, net: "APP_GND" }
  },
  projectGeometry: {
    coordinateFrame: "package-center top view; +X right and +Y up",
    bodyOutline: {
      widthMm: 4.4,
      lengthMm: 6.5,
      maximumHeightMm: 1.2,
      source: "TI PW0020A package outline"
    },
    pinOneOrientation: {
      sourceMark: "PIN 1 INDEX AREA",
      sourceView: "top view with pin 1 at upper-left, pin 20 at upper-right",
      nominalBoardRotationDegrees: 0,
      independentOverlay: "pending",
      orientationAccepted: false
    },
    perimeterPads: {
      status: "not-generated",
      geometry: null,
      reason: "TI retained source provides package mechanical lead dimensions but no recommended PCB land pattern"
    },
    artwork: {
      renderedEntities: {
        packageSilkscreen: 1,
        pinOneMarker: 1,
        smtPads: 0,
        platedHoles: 0,
        pasteApertures: 0,
        courtyard: 0
      },
      state: "review-datum-only",
      sourceAccurateCopper: false,
      sourceAccurateLandPattern: false,
      placementAuthority: "deny"
    },
    keepout: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-host-board-keepout-from-package-outline",
      authority: "deny"
    },
    paste: { status: "not-published", geometry: null, authority: "deny" },
    courtyard: { status: "not-published", geometry: null, authority: "deny" }
  },
  authority: {
    exactIdentity: "retained-and-hash-bound",
    manufacturerEvidence: "retained-primary",
    manufacturerCadImport: "deny",
    manufacturerLandPattern: "deny-not-published",
    orientationOverlay: "deny-pending",
    placement: "deny",
    schematicIntegration: "deny",
    fabrication: "deny",
    release: "deny",
    acceptance: false
  },
  fabricationAuthority: "deny",
  releaseState: "deny",
  accepted: false
} as const)

export const bp033Sn74ahct245pwrTssop20Footprint = deepFreeze(structuredClone(privateReviewedBaseline))

export type Bp033Sn74ahct245pwrTssop20Footprint = typeof bp033Sn74ahct245pwrTssop20Footprint

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  seenActual: WeakSet<object>,
  seenExpected: WeakSet<object>
): boolean {
  if (typeof actual !== "object" || actual === null || typeof expected !== "object" || expected === null) {
    return Object.is(actual, expected)
  }
  if (seenActual.has(actual) || seenExpected.has(expected)) return false
  seenActual.add(actual)
  seenExpected.add(expected)
  try {
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((key) => expectedKeys.includes(key)))
      return false
    for (const key of actualKeys) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      if (
        actualDescriptor === undefined ||
        expectedDescriptor === undefined ||
        !("value" in actualDescriptor) ||
        !("value" in expectedDescriptor) ||
        actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
        actualDescriptor.configurable !== expectedDescriptor.configurable ||
        actualDescriptor.writable !== expectedDescriptor.writable ||
        !sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seenActual, seenExpected)
      ) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

export function validateBp033Sn74ahct245pwrTssop20Footprint(value: unknown): true {
  if (!sameDataGraph(value, privateReviewedBaseline, new WeakSet<object>(), new WeakSet<object>())) {
    throw new RangeError("BP-033 AHCT245 candidate drifted from the private reviewed baseline")
  }
  if (typeof value !== "object" || value === null) throw new RangeError("BP-033 candidate must be an object")
  const candidate = value as typeof privateReviewedBaseline
  if (
    candidate.workUnit !== "BP-033" ||
    candidate.references.length !== 2 ||
    candidate.canonicalIdentity.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.canonicalIdentity.package !== packageName ||
    candidate.manufacturerFacts.pinMap.length !== 20 ||
    candidate.manufacturerFacts.terminalCount !== 20 ||
    candidate.manufacturerLandGuidance.status !== "not-published-in-retained-datasheet" ||
    candidate.projectGeometry.perimeterPads.status !== "not-generated" ||
    candidate.projectGeometry.artwork.renderedEntities.smtPads !== 0 ||
    candidate.projectGeometry.pinOneOrientation.orientationAccepted ||
    candidate.authority.manufacturerCadImport !== "deny" ||
    candidate.authority.placement !== "deny" ||
    candidate.authority.schematicIntegration !== "deny" ||
    candidate.authority.fabrication !== "deny" ||
    candidate.authority.release !== "deny" ||
    candidate.authority.acceptance ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.accepted
  ) {
    throw new RangeError("BP-033 AHCT245 candidate must remain exact and deny-by-default")
  }
  return true
}

const pinLabels = {
  pin1: "DIR",
  pin2: "A1",
  pin3: "A2",
  pin4: "A3",
  pin5: "A4",
  pin6: "A5",
  pin7: "A6",
  pin8: "A7",
  pin9: "A8",
  pin10: "GND",
  pin11: "B8",
  pin12: "B7",
  pin13: "B6",
  pin14: "B5",
  pin15: "B4",
  pin16: "B3",
  pin17: "B2",
  pin18: "B1",
  pin19: "OE",
  pin20: "VCC"
} as const

function createReviewFootprint(name: string): ReactElement {
  return (
    <footprint name={name} originalLayer="top">
      <silkscreenrect pcbX={0} pcbY={0} width="4.4mm" height="6.5mm" strokeWidth="0.1mm" filled={false} />
      <silkscreencircle pcbX={-1.55} pcbY={2.55} radius="0.25mm" strokeWidth="0.1mm" />
    </footprint>
  )
}

const reviewFootprintA = createReviewFootprint("BP033_SN74AHCT245PWR_TSSOP20_REVIEW_A")
const reviewFootprintB = createReviewFootprint("BP033_SN74AHCT245PWR_TSSOP20_REVIEW_B")

export interface Bp033Sn74ahct245pwrTssop20FootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

function renderBuffer(
  reference: "U_DISPLAY_BUFFER_A" | "U_DISPLAY_BUFFER_B",
  footprint: ReactElement,
  { pcbX, pcbY, pcbRotation }: Bp033Sn74ahct245pwrTssop20FootprintProps
): ReactElement {
  return (
    <chip
      name={reference}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={pinLabels}
      footprint={footprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

/** Review-only package and pin-one artwork for display buffer A; no copper is released. */
export function Bp033Sn74ahct245pwrTssop20FootprintA({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033Sn74ahct245pwrTssop20FootprintProps = {}): ReactElement {
  return renderBuffer("U_DISPLAY_BUFFER_A", reviewFootprintA, { pcbX, pcbY, pcbRotation })
}

/** Review-only package and pin-one artwork for display buffer B; no copper is released. */
export function Bp033Sn74ahct245pwrTssop20FootprintB({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033Sn74ahct245pwrTssop20FootprintProps = {}): ReactElement {
  return renderBuffer("U_DISPLAY_BUFFER_B", reviewFootprintB, { pcbX, pcbY, pcbRotation })
}

/** Combined review-only view for both display buffers; no copper is released. */
export function Bp033Sn74ahct245pwrTssop20Footprint(
  props: Bp033Sn74ahct245pwrTssop20FootprintProps = {}
): ReactElement {
  return (
    <>
      <Bp033Sn74ahct245pwrTssop20FootprintA {...props} />
      <Bp033Sn74ahct245pwrTssop20FootprintB {...props} />
    </>
  )
}
