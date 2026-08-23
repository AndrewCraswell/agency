export type PcbLayer = "L1" | "L2" | "L3" | "L4" | "L5" | "L6"

export type PcbConstraintStatus = "pass" | "open" | "deny"

export type PcbConstraintCheck = {
  readonly id: string
  readonly status: PcbConstraintStatus
  readonly evidence: string
}

export type PcbFabricationInput = {
  readonly physicalAssemblyCount: number
  readonly scoringBoardLayerCount: number
  readonly scoringBoardThicknessMm: number
  readonly applicationBoardLayerCount: number
  readonly applicationBoardThicknessMm: number
  readonly communicationsModuleLayerCount: number
  /** Finished thickness at the selected USB-C receptacle carrier. */
  readonly usbCModuleThicknessMm: number
  readonly assemblyBoundaryReviewed: boolean
  readonly highSpeedInterconnectQualified: boolean
  readonly exactFootprintsImported: boolean
  readonly isolationSlotPresent: boolean
  readonly externalAntennaPathQualified: boolean
  readonly manufacturerStackupApproved: boolean
  readonly routed: boolean
  readonly drcClean: boolean
  readonly thermalValidationComplete: boolean
  readonly chassisBondReviewed: boolean
}

export type PcbFabricationConstraintResult = {
  readonly constraintStatus: PcbConstraintStatus
  readonly fabricationApproved: false
  readonly checks: readonly PcbConstraintCheck[]
}

export const pcbFabricationContract = {
  topology: {
    requiredPhysicalAssemblyCount: 3,
    assemblies: [
      {
        id: "SCORING_IO_BOARD",
        layerCount: 6,
        thicknessMm: 1.6,
        thicknessToleranceMm: 0.1,
        scope:
          "STM32 scoring authority, isolated scoring power, reference, line acquisition/protection, primary lamps, buzzer, and passive body-cord-module harnesses"
      },
      {
        id: "APPLICATION_DISPLAY_CARRIER",
        layerCount: 6,
        thicknessMm: 1.6,
        thicknessToleranceMm: 0.1,
        scope:
          "ESP32-S3-WROOM-1U, external-antenna feed, V5/V3_3 conversion, storage, Ethernet controller, audio, HUB75 buffers, and display power connector"
      },
      {
        id: "REPLACEABLE_COMMUNICATIONS_MODULE",
        layerCount: 4,
        thicknessMm: 0.8,
        thicknessToleranceMm: 0.08,
        scope:
          "USB-C receptacle, connector-side protection, PD controller, eFuse, RJ45 integrated magnetics, field connector, chassis shield bonds, and qualified carrier interconnect"
      }
    ]
  },
  board: {
    outerCopperOz: 2,
    innerCopperOz: 1,
    laminate: "High-Tg FR-4, manufacturer-qualified for the declared operating temperature",
    finish: "ENIG on connector/contact geometry; surface finish elsewhere per assembly and corrosion review"
  },
  stackups: {
    scoringIoBoard: [
      { layer: "L1", role: "scoring components, connector entry, analog and short scoring signals", copperOz: 2 },
      { layer: "L2", role: "SCORING_SGND reference with isolated APP_GND boundary island", copperOz: 1 },
      { layer: "L3", role: "S3_3/S5 and scoring-domain power distribution", copperOz: 1 },
      { layer: "L4", role: "low-noise acquisition, scoring digital, and isolated-link escape", copperOz: 1 },
      { layer: "L5", role: "SCORING_SGND reference with no copper across the approved barrier", copperOz: 1 },
      { layer: "L6", role: "secondary scoring signals and service/test access", copperOz: 2 }
    ],
    applicationDisplayCarrier: [
      { layer: "L1", role: "application components, short signals, and high-current V5/GND copper", copperOz: 2 },
      { layer: "L2", role: "continuous APP_GND reference", copperOz: 1 },
      { layer: "L3", role: "V5, V3_3, and local power distribution", copperOz: 1 },
      { layer: "L4", role: "controlled signals and application-peripheral escape", copperOz: 1 },
      { layer: "L5", role: "continuous APP_GND reference", copperOz: 1 },
      { layer: "L6", role: "secondary signals, test access, and local high-current copper", copperOz: 2 }
    ],
    communicationsModule: [
      { layer: "L1", role: "USB-C/RJ45/field connectors, protection, and controlled signals", copperOz: 2 },
      { layer: "L2", role: "continuous APP_GND reference with bounded chassis-bond voids", copperOz: 1 },
      { layer: "L3", role: "PD power and return distribution", copperOz: 1 },
      { layer: "L4", role: "secondary signals, chassis features, and test access", copperOz: 2 }
    ]
  } as const satisfies {
    readonly scoringIoBoard: readonly { readonly layer: PcbLayer; readonly role: string; readonly copperOz: 1 | 2 }[]
    readonly applicationDisplayCarrier: readonly {
      readonly layer: PcbLayer
      readonly role: string
      readonly copperOz: 1 | 2
    }[]
    readonly communicationsModule: readonly {
      readonly layer: PcbLayer
      readonly role: string
      readonly copperOz: 1 | 2
    }[]
  },
  designRules: {
    minimumTrackWidthMm: 0.15,
    minimumClearanceMm: 0.15,
    powerEntryClearanceMm: 0.3,
    minimumViaDrillMm: 0.2,
    minimumFinishedAnnularRingMm: 0.1,
    componentToBoardEdgeMm: 1.0,
    mountingHoleCopperKeepoutMm: 1.0,
    mountingHoleCourtyardKeepoutMm: 3.0,
    testPointProbeKeepoutMm: 2.0,
    projectIsolationSlotWidthTargetMm: 4.0,
    projectIsolationCreepageTargetMm: 8.0,
    projectIsolationClearanceTargetMm: 4.0,
    projectIsolationCopperKeepoutTargetMm: 4.0,
    switchNodeToQuietCopperKeepoutMm: 2.0
  },
  impedanceTargets: [
    {
      netClass: "USB2_HIGH_SPEED",
      targetOhms: 90,
      tolerancePercent: 10,
      routing: "D+ and D- as one same-layer pair over an uninterrupted reference plane; no stubs"
    },
    {
      netClass: "ETHERNET_PHY",
      targetOhms: 100,
      tolerancePercent: 10,
      routing: "TX/RX pairs from W5500 to the magnetics connector with matched pair geometry"
    },
    {
      netClass: "LOCAL_FAST_SINGLE_ENDED",
      targetOhms: 50,
      tolerancePercent: 15,
      routing:
        "Use only where the stackup solver confirms the geometry; short HUB75 and SPI runs may be length-limited instead"
    }
  ] as const,
  zones: [
    {
      id: "SCORING_ANALOG",
      boundary: "Body-cord and piste entry through clamp, source, sink, reference, and STM32 ADC/comparator region",
      reference: "SCORING_SGND",
      requirements:
        "Keep switch nodes, HUB75 clocks, Ethernet PHY pairs, RF copper, and display return currents outside the quiet island"
    },
    {
      id: "SCORING_DIGITAL",
      boundary: "STM32, scoring watchdog/supervisor, lamps, buzzer, and isolated-link scoring-side pins",
      reference: "SCORING_SGND",
      requirements:
        "Return primary scoring loads locally; cross to the application side only through the named isolators"
    },
    {
      id: "ISOLATION_BARRIER",
      boundary: "Continuous slot/keepout around ISO7762, ISO7721, and NXE1S0505MC domains",
      reference: "NO_COPPER_UNDER_BARRIER",
      requirements:
        "No plane, pour, via, test pad, or routing crosses the barrier except the approved isolation components and their domain-local decoupling"
    },
    {
      id: "POWER_ENTRY",
      boundary:
        "Communications-module USB-C/PD/eFuse subzone and application-carrier V5 buck/shunt subzone joined by a protected 20 V interconnect",
      reference: "APP_GND",
      requirements:
        "Minimize each local high di/dt loop, rate the 20 V interconnect for the PD contract, and keep PD_PPHV, VIN, SW, and V5 trunks away from analog and RF regions"
    },
    {
      id: "APP_COMPUTE_RF",
      boundary:
        "ESP32-S3-WROOM-1U, module RF connector, coax egress, W5500, F-RAM, RTC, secure element, and service interfaces",
      reference: "APP_GND",
      requirements:
        "Keep the module RF connector and coax launch clear, specify the external antenna and cable, and do not route display power or switch-node copper through the RF feed region"
    },
    {
      id: "DISPLAY_HIGH_CURRENT",
      boundary: "AHCT245 buffers, HUB75 data entry, panel harness connector, and V5/GND branch",
      reference: "APP_GND",
      requirements:
        "Place buffers near the board connector, keep the V5/GND pair adjacent through the harness, and provide local bulk capacitance"
    },
    {
      id: "EXTERNAL_IO_CHASSIS",
      boundary: "Shielded USB-C, RJ45, and field interfaces on the replaceable communications module",
      reference: "CHASSIS_OR_ESD_RETURN",
      requirements:
        "Only shielded communications interfaces terminate at the chassis entry strategy; body-cord line protection uses its separately reviewed analog ESD return"
    }
  ] as const,
  forbiddenCrossings: [
    "SCORING_SGND to APP_GND except through the approved isolated power/link boundary",
    "SCORING_ANALOG quiet returns beneath V5 SW, PD_PPHV, HUB75_CLK, HUB75_OE_N, Ethernet PHY pairs, or RF copper",
    "USB2 D+/D- across a plane split, isolation slot, switch-node keepout, or connector shield return",
    "Ethernet TX/RX pairs across a plane split or through the HUB75 high-current return path",
    "PD_PPHV/VIN/SW power copper through the isolation barrier or through the ESP32 RF connector/coax feed region",
    "CHASSIS_OR_ESD_RETURN directly into SCORING_SGND, APP_GND, REF5025, or an ADC return without the reviewed single-point bond",
    "HUB75 output data bundled with the V5 high-current pair without a defined return conductor and harness keying",
    "Any high-current connector or body-cord insertion load carried by an unsupported PCB solder joint"
  ] as const,
  highCurrentInterface: {
    selectedV5ContinuousAmps: 5.39,
    selectedV5ShortScreenAmps: 6.09,
    hardEfuseBoundAmps: 8.12,
    harnessVoltageRatingV: 30,
    connectorCurrentRatingAmps: 10,
    requirement:
      "Use a keyed, locking, separately strain-relieved V5/GND harness with a dedicated return conductor; 10 A is the connector rating floor, not a claimed operating or transient current"
  },
  returnPathContract: {
    appGround:
      "APP_GND is a continuous reference for ESP32, Ethernet, USB service, V5, and HUB75 logic; do not neck it through the scoring domain",
    scoringGround: "SCORING_SGND is continuous beneath scoring analog/digital circuitry and is isolated from APP_GND",
    powerStage:
      "V5 buck input and output returns use short, wide, package-local loops; current-sense feedback is Kelvin-routed and never shares the high-current return neck",
    externalEgress:
      "Shielded USB-C, RJ45, and field-interface ESD paths are captured at their chassis entry; body-cord clamp return remains a separate analog-layout gate"
  },
  testPointContract: {
    access:
      "Top-side labeled test pads with at least 2.0 mm probe keepout; do not hide factory-critical points under modules or connector bodies",
    requiredNets: [
      "VBUS_PORT",
      "PD_PPHV_20V",
      "V5_SENSE_IN",
      "V5",
      "V3_3",
      "S3_3",
      "APP_GND",
      "SCORING_SGND",
      "RESET_REQUEST",
      "EN_RESET",
      "USB_DN",
      "USB_DP",
      "HUB75_OE_N",
      "STM32_NRST"
    ]
  },
  assemblyKeepouts: [
    "Manufacturer courtyard for every exact footprint, including connector shell stakes and exposed-pad paste windows",
    "No copper, silkscreen, or components inside the isolation slot and creepage keepout",
    "No components within 1.0 mm of an unreinforced board edge or inside a chassis fastener keepout",
    "Reserve 3.0 mm courtyard around mounting holes and keep copper 1.0 mm from the finished hole",
    "Keep USB-C and RJ45 plug bodies, latch travel, cable bend radii, and chassis fasteners outside the component placement envelope",
    "Keep the ESP32-S3-WROOM-1U RF connector and coax mating/bend region clear; qualify the selected coax, bulkhead, and external antenna against enclosure metal"
  ] as const,
  thermalContract: {
    ambientTestC: 50,
    condition:
      "blocked vents, full-white selected panel, maximum audio, Ethernet traffic, radio activity, and continuous scoring",
    acceptance:
      "Every measured component and connector remains inside its qualified rating with the product derating margin documented; arithmetic rail budgets are not thermal evidence",
    requiredMeasurements: [
      "TPS56A37",
      "744325330",
      "TPS259474",
      "USB-C receptacle",
      "V5 shunt",
      "LMR43620",
      "HUB75 harness",
      "panel-end V5"
    ]
  }
} as const

export const currentPcbModelInput = {
  physicalAssemblyCount: 1,
  scoringBoardLayerCount: 4,
  scoringBoardThicknessMm: 1.6,
  applicationBoardLayerCount: 4,
  applicationBoardThicknessMm: 1.6,
  communicationsModuleLayerCount: 4,
  usbCModuleThicknessMm: 1.6,
  assemblyBoundaryReviewed: false,
  highSpeedInterconnectQualified: false,
  exactFootprintsImported: false,
  isolationSlotPresent: false,
  externalAntennaPathQualified: false,
  manufacturerStackupApproved: false,
  routed: false,
  drcClean: false,
  thermalValidationComplete: false,
  chassisBondReviewed: false
} as const satisfies PcbFabricationInput

function assertFinitePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`)
}

function assertBoolean(value: boolean, name: string) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`)
}

const booleanInputFields = [
  "assemblyBoundaryReviewed",
  "highSpeedInterconnectQualified",
  "exactFootprintsImported",
  "isolationSlotPresent",
  "externalAntennaPathQualified",
  "manufacturerStackupApproved",
  "routed",
  "drcClean",
  "thermalValidationComplete",
  "chassisBondReviewed"
] as const

export function evaluatePcbFabricationConstraints(
  input: PcbFabricationInput = currentPcbModelInput
): PcbFabricationConstraintResult {
  if (input === null || typeof input !== "object") throw new TypeError("PCB fabrication input must be an object")
  assertFinitePositive(input.physicalAssemblyCount, "physicalAssemblyCount")
  assertFinitePositive(input.scoringBoardLayerCount, "scoringBoardLayerCount")
  assertFinitePositive(input.scoringBoardThicknessMm, "scoringBoardThicknessMm")
  assertFinitePositive(input.applicationBoardLayerCount, "applicationBoardLayerCount")
  assertFinitePositive(input.applicationBoardThicknessMm, "applicationBoardThicknessMm")
  assertFinitePositive(input.communicationsModuleLayerCount, "communicationsModuleLayerCount")
  assertFinitePositive(input.usbCModuleThicknessMm, "usbCModuleThicknessMm")
  for (const name of booleanInputFields) assertBoolean(input[name], name)

  const within = (value: number, target: number, tolerance: number) => Math.abs(value - target) <= tolerance
  const scoringBoard = pcbFabricationContract.topology.assemblies[0]
  const applicationBoard = pcbFabricationContract.topology.assemblies[1]
  const communicationsModule = pcbFabricationContract.topology.assemblies[2]
  const checks: PcbConstraintCheck[] = [
    {
      id: "physical-topology",
      status:
        input.physicalAssemblyCount === pcbFabricationContract.topology.requiredPhysicalAssemblyCount ? "pass" : "deny",
      evidence: `Physical model has ${input.physicalAssemblyCount} assembly; the production topology requires three: scoring I/O board, application/display carrier, and replaceable communications module`
    },
    {
      id: "scoring-board-stackup",
      status: input.scoringBoardLayerCount === scoringBoard.layerCount ? "pass" : "deny",
      evidence: `Scoring I/O board has ${input.scoringBoardLayerCount} copper layers; the contract requires ${scoringBoard.layerCount}`
    },
    {
      id: "scoring-board-thickness",
      status: within(input.scoringBoardThicknessMm, scoringBoard.thicknessMm, scoringBoard.thicknessToleranceMm)
        ? "pass"
        : "deny",
      evidence: `Scoring I/O board finished thickness ${input.scoringBoardThicknessMm} mm; target is 1.60 +/- 0.10 mm`
    },
    {
      id: "application-board-stackup",
      status: input.applicationBoardLayerCount === applicationBoard.layerCount ? "pass" : "deny",
      evidence: `Application/display carrier has ${input.applicationBoardLayerCount} copper layers; the contract requires ${applicationBoard.layerCount}`
    },
    {
      id: "application-board-thickness",
      status: within(
        input.applicationBoardThicknessMm,
        applicationBoard.thicknessMm,
        applicationBoard.thicknessToleranceMm
      )
        ? "pass"
        : "deny",
      evidence: `Application/display carrier finished thickness ${input.applicationBoardThicknessMm} mm; target is 1.60 +/- 0.10 mm`
    },
    {
      id: "communications-module-stackup",
      status: input.communicationsModuleLayerCount === communicationsModule.layerCount ? "pass" : "deny",
      evidence: `Communications module has ${input.communicationsModuleLayerCount} copper layers; the contract requires ${communicationsModule.layerCount}`
    },
    {
      id: "usb-c-carrier-thickness",
      status: within(
        input.usbCModuleThicknessMm,
        communicationsModule.thicknessMm,
        communicationsModule.thicknessToleranceMm
      )
        ? "pass"
        : "deny",
      evidence: `USB-C carrier finished thickness ${input.usbCModuleThicknessMm} mm; the selected receptacle requires an approximately 0.80 mm board`
    },
    {
      id: "assembly-boundary",
      status: input.assemblyBoundaryReviewed ? "pass" : "deny",
      evidence: input.assemblyBoundaryReviewed
        ? "Power, ground, isolation, scoring, display, and service ownership is reviewed across all three assemblies"
        : "The present combined architectural preview does not implement or review the three physical assembly boundaries"
    },
    {
      id: "high-speed-interconnect",
      status: input.highSpeedInterconnectQualified ? "pass" : "open",
      evidence: input.highSpeedInterconnectQualified
        ? "USB2 and Ethernet paths across the communications-module boundary are impedance-qualified with the released connector/cable"
        : "USB2 90 ohm and Ethernet 100 ohm continuity across the communications-module connector/cable remains unqualified"
    },
    {
      id: "exact-footprints",
      status: input.exactFootprintsImported ? "pass" : "deny",
      evidence: input.exactFootprintsImported
        ? "Manufacturer land patterns are imported and independently reviewed"
        : "Selected critical parts remain generic or do-not-place until manufacturer land-pattern evidence is imported"
    },
    {
      id: "isolation-barrier",
      status: input.isolationSlotPresent ? "pass" : "deny",
      evidence: input.isolationSlotPresent
        ? "Isolation slot and copper keepout are present in the physical layout"
        : "The current architectural model does not prove a slot, creepage, clearance, or copper keepout"
    },
    {
      id: "external-antenna-path",
      status: input.externalAntennaPathQualified ? "pass" : "deny",
      evidence: input.externalAntennaPathQualified
        ? "WROOM-1U RF connector, selected coax/bulkhead, antenna, chassis geometry, and radiated configuration are qualified"
        : "The external coax, bulkhead, antenna, enclosure detuning, retention, ESD, and regulatory configuration remain open"
    },
    {
      id: "manufacturer-stackup",
      status: input.manufacturerStackupApproved ? "pass" : "open",
      evidence: input.manufacturerStackupApproved
        ? "Fabricator has accepted the layer dielectric and controlled impedances"
        : "A fabricator must solve and sign the actual dielectric stackup and controlled impedances"
    },
    {
      id: "routing",
      status: input.routed ? "pass" : "open",
      evidence: input.routed
        ? "All nets are routed under this contract"
        : "Routing, return-path review, and high-current copper are not complete"
    },
    {
      id: "drc",
      status: input.drcClean ? "pass" : "open",
      evidence: input.drcClean
        ? "ERC/DRC and manufacturer rule checks are clean"
        : "DRC, creepage, courtyard, and impedance checks remain open"
    },
    {
      id: "thermal",
      status: input.thermalValidationComplete ? "pass" : "open",
      evidence: input.thermalValidationComplete
        ? "Blocked-vent thermal measurements cover the declared current and panel profile"
        : "Thermal-camera and thermocouple evidence is required at 50 C blocked-vent ambient"
    },
    {
      id: "chassis-bond",
      status: input.chassisBondReviewed ? "pass" : "open",
      evidence: input.chassisBondReviewed
        ? "USB-C, RJ45, and field-interface shields and chassis bonds are reviewed as one system"
        : "USB-C, RJ45, and field-interface shield/chassis strategy remains open; body-cord analog ESD return is separate"
    }
  ]

  return {
    constraintStatus: checks.some((check) => check.status === "deny")
      ? "deny"
      : checks.some((check) => check.status === "open")
        ? "open"
        : "pass",
    fabricationApproved: false,
    checks
  }
}
