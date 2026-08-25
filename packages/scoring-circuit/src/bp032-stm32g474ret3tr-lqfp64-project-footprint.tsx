import { Fragment, type ReactElement } from "react"

/** Clone only data descriptors so the validator's baseline cannot share the candidate graph. */
function cloneDataGraph<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object") return value
  const existing = seen.get(value)
  if (existing !== undefined) return existing as T

  const clone = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value))
  seen.set(value, clone)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("BP-032 baseline must contain data descriptors only")
    }
    Object.defineProperty(clone, key, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      value: cloneDataGraph(descriptor.value, seen),
      writable: descriptor.writable
    })
  }
  return clone as T
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function compareExactDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)

  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) return false

  for (const key of expectedKeys) {
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
      !compareExactDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    ) {
      return false
    }
  }
  return true
}

/**
 * Compare exact data graphs without invoking accessors. Any reflective trap,
 * descriptor mismatch, cycle, alias, sparse array, prototype, or key drift fails closed.
 */
function hasExactDataGraph(actual: unknown, expected: unknown): boolean {
  try {
    return compareExactDataGraph(actual, expected, new WeakSet<object>(), new WeakSet<object>())
  } catch {
    return false
  }
}

type PadSide = "bottom" | "right" | "top" | "left"

type LqfpPad = {
  readonly pin: number
  readonly side: PadSide
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

function padsForSide(side: PadSide): readonly LqfpPad[] {
  return Array.from({ length: 16 }, (_, index) => {
    const tangent = -3.75 + index * 0.5
    if (side === "bottom") {
      return { pin: index + 1, side, xMm: tangent, yMm: -5.75, widthMm: 0.3, heightMm: 1.2 }
    }
    if (side === "right") {
      return { pin: index + 17, side, xMm: 5.75, yMm: tangent, widthMm: 1.2, heightMm: 0.3 }
    }
    if (side === "top") {
      return { pin: index + 33, side, xMm: 3.75 - index * 0.5, yMm: 5.75, widthMm: 0.3, heightMm: 1.2 }
    }
    return { pin: index + 49, side, xMm: -5.75, yMm: 3.75 - index * 0.5, widthMm: 1.2, heightMm: 0.3 }
  })
}

const pads = Object.freeze([
  ...padsForSide("bottom"),
  ...padsForSide("right"),
  ...padsForSide("top"),
  ...padsForSide("left")
] as LqfpPad[])

const source = {
  manufacturer: "STMicroelectronics",
  manufacturerPartNumber: "STM32G474RET3TR",
  document: "STM32G474xB STM32G474xC STM32G474xE",
  documentNumber: "DS12288",
  revision: "6",
  officialUrl: "https://www.st.com/resource/en/datasheet/stm32g474re.pdf",
  artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf",
  sha256: "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD",
  retainedPdfPageCount: 236,
  packageIdentityEvidence: {
    printedPages: [1, 2, 3, 232],
    table: "Table 124 ordering information scheme",
    conclusion: "STM32G474RET3TR decodes to the STM32G474RE 64-pin LQFP, -40 to 125 degree C, tape-and-reel orderable."
  },
  packageDrawingEvidence: {
    printedPages: [210, 211, 212],
    outlineFigure: "Figure 62 LQFP64 - Outline",
    mechanicalTable: "Table 115 LQFP64 - Mechanical data",
    recommendedFootprintFigure: "Figure 63 LQFP64 - Recommended footprint",
    pinOneFigure: "Figure 64 LQFP64 top view example",
    drawingCode: "ai14909c"
  },
  reviewedPages: {
    identity: [1, 2, 3, 232],
    packageDrawing: [210, 211, 212],
    powerAndBoot: [21, 25, 50, 81, 108],
    clockAndUnused: [29, 30, 115, 117]
  },
  cad: {
    state: "not-acquired",
    authority: "deny",
    officialProductPage: "https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html",
    listedSuppliers: ["Ultra Librarian", "SamacSys"],
    retainedArtifactPath: null,
    retainedArtifactSha256: null,
    note: "The official product page lists supplier EDA downloads, but no exact-orderable CAD archive is retained. No supplier or generic substitute is imported."
  }
} as const

const packageGeometry = {
  package: "LQFP64",
  pinCount: 64,
  body: {
    nominalLengthMm: 10,
    nominalWidthMm: 10,
    heightMm: { minimum: 1.35, nominal: 1.4, maximum: 1.45 },
    sourceSymbols: { length: "D1", width: "E1", height: "A2" }
  },
  leadPitchMm: 0.5,
  recommendedCopper: {
    tangentialWidthMm: 0.3,
    radialLengthMm: 1.2,
    innerPadEdgeSpanMm: 10.3,
    outerPadEdgeSpanMm: 12.7,
    tangentialOuterEdgeSpanMm: 7.8
  },
  exposedPad: {
    present: false,
    padNumber: null,
    sourcePages: [210, 211, 212],
    evidence: "Figures 62 through 64 show the LQFP64 perimeter lead package and no separate exposed thermal pad."
  }
} as const

const projectGeometry = {
  copper: {
    padWidthMm: 0.3,
    padLengthMm: 1.2,
    radialPadCenterMm: 5.75,
    tangentialFirstCenterMm: -3.75,
    tangentialLastCenterMm: 3.75,
    sourceStatus: "copied-from-figure-63-recommendation"
  },
  solderMask: {
    marginPerEdgeMm: 0.05,
    openingTangentialMm: 0.4,
    openingRadialMm: 1.3,
    sourceStatus: "project-derived-review-input"
  },
  paste: {
    reductionPerEdgeMm: 0.05,
    openingTangentialMm: 0.2,
    openingRadialMm: 1.1,
    sourceStatus: "project-derived-review-input"
  },
  courtyard: {
    clearanceMm: 0.25,
    widthMm: 13.2,
    heightMm: 13.2,
    sourceStatus: "project-derived-review-input"
  },
  pinOneMarker: {
    shape: "circle",
    centerMm: { x: -5.35, y: -5.35 },
    radiusMm: 0.25,
    sourceStatus: "project-derived-review-input"
  }
} as const

const orientation = {
  sourceDatum: "lower-left pin-one identifier in Figure 64 LQFP64 top view",
  sourceFigure: "Figure 64 LQFP64 top view example",
  pinOne: { pin: 1, xMm: -3.75, yMm: -5.75 },
  boardRotationDegrees: 0,
  numbering:
    "Pins 1 through 16 run left-to-right on the bottom edge; 17 through 32 run bottom-to-top on the right edge; 33 through 48 run right-to-left on the top edge; 49 through 64 run top-to-bottom on the left edge.",
  status: "pending-independent-review",
  independentAcceptance: false
} as const

const bp120Allocation = {
  workUnit: "BP-120",
  part: "STM32G474RET3TR",
  package: "LQFP64",
  pads: [
    [1, "VBAT", "SCORING_3V3_NO_BACKUP_TIE"],
    [2, "PC13", "UNCONNECTED_RESERVED"],
    [3, "PC14-OSC32_IN", "UNCONNECTED_NO_LSE"],
    [4, "PC15-OSC32_OUT", "UNCONNECTED_NO_LSE"],
    [5, "PF0-OSC_IN", "HSE_IN_RESERVED"],
    [6, "PF1-OSC_OUT", "HSE_OUT_RESERVED"],
    [7, "NRST", "SCORING_NRST_N"],
    [8, "PC0", "LEFT_A_SOURCE_EN"],
    [9, "PC1", "LEFT_A_SINK_EN"],
    [10, "PC2", "LEFT_B_SOURCE_EN"],
    [11, "PC3", "LEFT_B_SINK_EN"],
    [12, "PA0", "UNCONNECTED_ANALOG_RESERVED"],
    [13, "PA1", "UNCONNECTED_ANALOG_RESERVED"],
    [14, "PA2", "UNCONNECTED_ANALOG_RESERVED"],
    [15, "VSS", "SCORING_DGND"],
    [16, "VDD", "SCORING_3V3"],
    [17, "PA3", "UNCONNECTED_ANALOG_RESERVED"],
    [18, "PA4", "SAR0_CONVST_TIM3_CH2"],
    [19, "PA5", "SAR0_SCLK_SPI1_SCK"],
    [20, "PA6", "SAR0_DOUT_SPI1_MISO"],
    [21, "PA7", "UNCONNECTED_ANALOG_RESERVED"],
    [22, "PC4", "UNCONNECTED_RESERVED"],
    [23, "PC5", "UNCONNECTED_RESERVED"],
    [24, "PB0", "LEFT_C_SOURCE_EN"],
    [25, "PB1", "LEFT_C_SINK_EN"],
    [26, "PB2", "RIGHT_A_SOURCE_EN"],
    [27, "VSSA", "SCORING_AGND"],
    [28, "VREF+", "SCORING_VREF_2V5"],
    [29, "VDDA", "SCORING_3V3_ANALOG"],
    [30, "PB10", "RIGHT_A_SINK_EN"],
    [31, "VSS", "SCORING_DGND"],
    [32, "VDD", "SCORING_3V3"],
    [33, "PB11", "RIGHT_B_SOURCE_EN"],
    [34, "PB12", "RIGHT_B_SINK_EN"],
    [35, "PB13", "RIGHT_C_SOURCE_EN"],
    [36, "PB14", "RIGHT_C_SINK_EN"],
    [37, "PB15", "PISTE_SOURCE_EN"],
    [38, "PC6", "PISTE_SINK_EN"],
    [39, "PC7", "UNCONNECTED_RESERVED"],
    [40, "PC8", "UNCONNECTED_RESERVED"],
    [41, "PC9", "SCORING_WATCHDOG_WDI"],
    [42, "PA8", "PRIMARY_LAMP_RED_TIM1_CH1"],
    [43, "PA9", "PRIMARY_LAMP_GREEN_TIM1_CH2"],
    [44, "PA10", "PRIMARY_LAMP_LEFT_WHITE_TIM1_CH3"],
    [45, "PA11", "PRIMARY_LAMP_RIGHT_WHITE_TIM1_CH4"],
    [46, "PA12", "PRIMARY_BUZZER_TIM16_CH1"],
    [47, "VSS", "SCORING_DGND"],
    [48, "VDD", "SCORING_3V3"],
    [49, "PA13", "SWDIO"],
    [50, "PA14", "SWCLK"],
    [51, "PA15", "SCORE_CS_N_SPI3_NSS"],
    [52, "PC10", "SCORE_SCK_SPI3_SCK"],
    [53, "PC11", "SCORE_MISO_SPI3_MISO"],
    [54, "PC12", "SCORE_MOSI_SPI3_MOSI"],
    [55, "PD2", "UNCONNECTED_RESERVED"],
    [56, "PB3", "STM32_HEARTBEAT_ISOLATED"],
    [57, "PB4", "ESP32_HEARTBEAT_ISOLATED"],
    [58, "PB5", "ESP32_RESET_ASSERT_ISOLATED"],
    [59, "PB6", "UNCONNECTED_RESERVED"],
    [60, "PB7", "UNCONNECTED_RESERVED"],
    [61, "PB8-BOOT0", "BOOT0_PERMANENT_PULLDOWN"],
    [62, "PB9", "UNCONNECTED_RESERVED"],
    [63, "VSS", "SCORING_DGND"],
    [64, "VDD", "SCORING_3V3"]
  ],
  packageMap: [
    [1, "VBAT"],
    [2, "PC13"],
    [3, "PC14-OSC32_IN"],
    [4, "PC15-OSC32_OUT"],
    [5, "PF0-OSC_IN"],
    [6, "PF1-OSC_OUT"],
    [7, "NRST"],
    [8, "PC0"],
    [9, "PC1"],
    [10, "PC2"],
    [11, "PC3"],
    [12, "PA0"],
    [13, "PA1"],
    [14, "PA2"],
    [15, "VSS"],
    [16, "VDD"],
    [17, "PA3"],
    [18, "PA4"],
    [19, "PA5"],
    [20, "PA6"],
    [21, "PA7"],
    [22, "PC4"],
    [23, "PC5"],
    [24, "PB0"],
    [25, "PB1"],
    [26, "PB2"],
    [27, "VSSA"],
    [28, "VREF+"],
    [29, "VDDA"],
    [30, "PB10"],
    [31, "VSS"],
    [32, "VDD"],
    [33, "PB11"],
    [34, "PB12"],
    [35, "PB13"],
    [36, "PB14"],
    [37, "PB15"],
    [38, "PC6"],
    [39, "PC7"],
    [40, "PC8"],
    [41, "PC9"],
    [42, "PA8"],
    [43, "PA9"],
    [44, "PA10"],
    [45, "PA11"],
    [46, "PA12"],
    [47, "VSS"],
    [48, "VDD"],
    [49, "PA13"],
    [50, "PA14"],
    [51, "PA15"],
    [52, "PC10"],
    [53, "PC11"],
    [54, "PC12"],
    [55, "PD2"],
    [56, "PB3"],
    [57, "PB4"],
    [58, "PB5"],
    [59, "PB6"],
    [60, "PB7"],
    [61, "PB8-BOOT0"],
    [62, "PB9"],
    [63, "VSS"],
    [64, "VDD"]
  ],
  selectedAcquisition: {
    scope: "one-channel-only",
    converter: "ADS8881IDGS",
    sclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
    dout: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO" },
    convst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
    din: "hard strap only; no STM32 pad is allocated",
    sampling: "TIM3 conversion strobe and SPI1 receive require measured end-to-end timing proof"
  },
  plannedSevenChannelReplication: {
    owner: "BP-103",
    state: "architecture-selected-integration-denied",
    architecture: "seven ADS8881 devices in daisy-chain mode without busy indicator",
    sharedConvst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
    sharedSclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
    serialData: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO", source: "U_SAR_7.DOUT" },
    chainRule: "U_SAR_1.DIN is grounded; each DOUT feeds the next DIN; host receives U_SAR_7 through U_SAR_1",
    targetSclkHz: 20_000_000,
    releaseEffect:
      "BP-103 selects the pin-feasible architecture, but schematic integration, timing, crosstalk, power, firmware, and scoring authority remain denied."
  },
  mcuAnalogAndTiming: {
    internalAdc: "not the primary BP-100 acquisition path; PA0, PA1, PA2, PA3, and PA7 stay unconnected and reserved",
    comparators: "no comparator INP/INM net is allocated to a BP-100 channel; COMP1 through COMP7 remain unconfigured",
    timer:
      "TIM3_CH2 owns one SAR0 CONVST candidate. HRTIM1 may remain an internal scheduler/timebase only after routing and jitter proof.",
    dma: "SPI1 RX DMA and timer/DMA synchronization are implementation candidates, not allocated DMA-channel claims"
  },
  isolatedSpi: {
    controller: "SPI3",
    master: "STM32",
    nets: [
      ["SCORE_CS_N", "PA15", 51, "STM32-to-ESP32"],
      ["SCORE_SCK", "PC10", 52, "STM32-to-ESP32"],
      ["SCORE_MISO", "PC11", 53, "ESP32-to-STM32"],
      ["SCORE_MOSI", "PC12", 54, "STM32-to-ESP32"]
    ],
    control: [
      ["STM32_HEARTBEAT", "PB3", 56, "STM32-to-ESP32"],
      ["ESP32_HEARTBEAT", "PB4", 57, "ESP32-to-STM32"],
      ["ESP32_RESET_ASSERT", "PB5", 58, "STM32-to-ESP32 only"]
    ],
    authority:
      "The isolated link transports bounded records and health only. It cannot create, alter, clear, or directly drive a scoring decision, primary lamp, buzzer, acquisition, or STM32 reset."
  },
  safeStates: {
    switchEnables:
      "all fourteen source/sink enable nets require external pulldowns and remain off until STM32 self-test passes",
    lampsAndBuzzer:
      "all five driver inputs require external inactive pulls; MCU reset alone is not a safe-output control",
    bootAndService:
      "PB8-BOOT0 has a permanent pull-down. PA13, PA14, and NRST are service-only. Production SWD does not require JTAG or SWO.",
    unused:
      "No unused pad has an external functional net. Firmware must configure unused GPIOs to the documented low-leakage safe state after reset."
  },
  clocks: {
    hse: "PF0/PF1 reserved; populate and validate or explicitly prove internal-clock tolerance before release",
    lse: "PC14/PC15 are intentionally unconnected. Any STM32 LSE or backup-time requirement is a new allocation conflict."
  },
  backupDomain: "VBAT is tied explicitly to SCORING_3V3 because this allocation has no backup supply.",
  authority: {
    scoringOwner: "STM32G474RET3TR",
    sevenChannelIntegrationAuthorized: false,
    cubeMxProofComplete: false,
    hardwareApproval: false,
    releaseState: "deny"
  }
} as const

const sourceControl = {
  canonicalReference: "U_SCORING",
  upstreamWorkUnits: ["BP-120", "BP-125"],
  bindings: [
    {
      workUnit: "BP-120",
      path: "packages/scoring-circuit/src/stm32-pin-allocation.ts",
      sha256: "4CF3FF02889064C204BD5FC7557719E9501925AC99677F0F2825291E066EF2F3"
    },
    {
      workUnit: "BP-125",
      path: "packages/scoring-circuit/src/bench-prototype-bp125-processor-footprint-reconciliation.ts",
      sha256: "3FF36883B336525E50503DF8F45E70F6E6CD453A9FE57070470C597FDD5130C1"
    }
  ],
  retainedEvidenceIsReused: true,
  noDuplicateEvidenceUnderBp032: true
} as const

const evidenceDefinition = {
  artifactKind: "bp032-stm32g474ret3tr-lqfp64-project-footprint-evidence",
  workUnit: "BP-032",
  canonicalReference: "U_SCORING",
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false,
  source,
  sourceControl,
  package: packageGeometry,
  manufacturerDrawing: {
    state: "retained-family-datasheet-package-drawing",
    authority: "source-only-no-exact-orderable-cad",
    artifactPath: source.artifactPath,
    sha256: source.sha256,
    drawing: source.packageDrawingEvidence.recommendedFootprintFigure
  },
  manufacturerCad: {
    ...source.cad,
    listedSuppliers: [...source.cad.listedSuppliers]
  },
  projectFootprint: {
    state: "review-only",
    orientationStatus: orientation.status,
    fabricationAuthority: "deny",
    placementAuthority: "deny",
    schematicIntegrationAuthority: "deny",
    accepted: false
  },
  projectGeometry,
  orientation,
  pads,
  bp120Allocation,
  authority: {
    manufacturerCadImported: false,
    orientationAccepted: false,
    placementAccepted: false,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  requiredFollowUp: [
    "Retain and review an exact-orderable CAD or land-pattern archive if an authoritative source becomes available.",
    "Independently review pin-one marking, assembly rotation, stencil apertures, solder-mask web, and courtyard against the released PCB tool output.",
    "Reconcile every BP-120 pad and net against the schematic and perform measured acquisition, reset, clock, power, and safe-state validation.",
    "Do not import this candidate into a fabrication board or treat it as manufacturer CAD."
  ]
} as const

export const bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence = deepFreeze(evidenceDefinition)
type FootprintEvidence = typeof bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence

const independentFrozenBaseline = deepFreeze(cloneDataGraph(bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence))

/** Empty output means the independent evidence graph is unchanged; it never grants release authority. */
export function validateBp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence(
  value: unknown = bp032Stm32G474Ret3TrLqfp64ProjectFootprintEvidence
): readonly string[] {
  try {
    if (!hasExactDataGraph(value, independentFrozenBaseline)) {
      return ["BP-032 candidate evidence graph drifted from its independent frozen baseline"]
    }

    const candidate = value as FootprintEvidence
    const errors: string[] = []
    if (candidate.canonicalReference !== "U_SCORING") errors.push("canonical STM32 reference must remain U_SCORING")
    if (candidate.source.manufacturerPartNumber !== "STM32G474RET3TR") errors.push("exact MPN binding drifted")
    if (candidate.package.package !== "LQFP64" || candidate.package.pinCount !== 64) {
      errors.push("manufacturer package identity drifted")
    }
    if (candidate.package.exposedPad.present || candidate.package.exposedPad.padNumber !== null) {
      errors.push("LQFP64 exposed-pad status must remain absent")
    }
    if (candidate.bp120Allocation.workUnit !== "BP-120" || candidate.bp120Allocation.part !== "STM32G474RET3TR") {
      errors.push("BP-120 exact processor allocation binding drifted")
    }
    if (candidate.orientation.status !== "pending-independent-review" || candidate.authority.releaseState !== "deny") {
      errors.push("orientation and release gates must remain denied")
    }
    if (
      candidate.manufacturerCad.authority !== "deny" ||
      candidate.projectFootprint.placementAuthority !== "deny" ||
      candidate.projectFootprint.schematicIntegrationAuthority !== "deny" ||
      candidate.fabricationAuthority !== "deny" ||
      candidate.accepted !== false
    ) {
      errors.push("CAD, placement, schematic, fabrication, and acceptance gates must remain denied")
    }
    return errors
  } catch {
    return ["BP-032 candidate validation encountered hostile graph behavior and failed closed"]
  }
}

const footprint = (
  <footprint name="BP032_STM32G474RET3TR_LQFP64_PROJECT_REVIEW" originalLayer="top">
    {pads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin={`${projectGeometry.solderMask.marginPerEdgeMm}mm`}
          solderPasteMargin={`-${projectGeometry.paste.reductionPerEdgeMm}mm`}
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[String(pad.pin), `pin${pad.pin}`, pad.side, ...(pad.pin === 1 ? ["pin1"] : [])]}
        />
      </Fragment>
    ))}
    <courtyardrect pcbX={0} pcbY={0} width="13.2mm" height="13.2mm" strokeWidth="0.05mm" />
    <silkscreencircle pcbX={-5.35} pcbY={-5.35} radius="0.25mm" strokeWidth="0.1mm" />
  </footprint>
)

export interface Bp032Stm32G474Ret3TrLqfp64ProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated review component; it is not a fabrication-release footprint. */
export function Bp032Stm32G474Ret3TrLqfp64ProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp032Stm32G474Ret3TrLqfp64ProjectFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_SCORING"
      manufacturerPartNumber="STM32G474RET3TR"
      footprint={footprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export default Bp032Stm32G474Ret3TrLqfp64ProjectFootprint
