import { physicalBoardContract } from "./physical-board-contract.js"

/**
 * Provisional mechanical planning contract for the three-board architecture.
 *
 * Dimensions in this file reserve enclosure volume only. They are not routed
 * PCB outlines, fabrication drawings, or permission to cut enclosure tooling.
 */

export type MechanicalReleaseStatus = "pass" | "deny"

export type BoardEnvelope = {
  readonly board: "SCORING_IO_BOARD" | "APPLICATION_DISPLAY_CARRIER" | "REPLACEABLE_COMMUNICATIONS_MODULE"
  readonly planningMaximumMm: { readonly width: number; readonly height: number }
  readonly finishedThicknessMm: number
  readonly finishedThicknessToleranceMm: number
  readonly outlineAuthority: "provisional-planning-only"
  readonly datum: string
  readonly mounting: string
}

export const mechanicalDatumContract = {
  architectureAuthority:
    "Communications boundary connectivity is integrated. All three physical planning models implement their reviewed width, height, and layer-count envelopes; finished thickness remains a contract datum because the circuit renderer does not emit it.",
  coordinateSystem:
    "+X is enclosure-view right, +Y is enclosure-view down, and +Z points from the display rear toward the service cover",
  primaryDatumA:
    "provisional rear-envelope face inferred from the published 318 mm by 158 mm by 15 mm panel envelope; not a manufacturer support plane or released datum",
  secondaryDatumB: "enclosure left-hand internal wall",
  tertiaryDatumC: "enclosure top internal wall",
  toleranceRule:
    "Planning dimensions carry no fabrication tolerance. Released drawings must use measured connector datums and a reviewed tolerance stack."
} as const

export const currentPhysicalBoardModels = {
  communicationsBoundaryConnectivity: "integrated",
  physicalAssemblyCount: 3,
  physicalThreeBoardLayout: "integrated-planning-models",
  communicationsModule: {
    current: {
      widthMm: physicalBoardContract.communicationsModule.widthMm,
      heightMm: physicalBoardContract.communicationsModule.heightMm,
      layers: physicalBoardContract.communicationsModule.layers,
      finishedThicknessMm: "not-modeled"
    },
    contract: {
      widthMm: physicalBoardContract.communicationsModule.widthMm,
      heightMm: physicalBoardContract.communicationsModule.heightMm,
      layers: physicalBoardContract.communicationsModule.layers,
      finishedThicknessMm: physicalBoardContract.communicationsModule.finishedThicknessMm
    },
    matchesEnvelope: true,
    thicknessModeling: "contract-only-unmodeled"
  },
  separateMainBoardModels: {
    current: {
      physicalAssemblyCount: 2,
      scoringBoard: {
        widthMm: physicalBoardContract.scoringIoBoard.widthMm,
        heightMm: physicalBoardContract.scoringIoBoard.heightMm,
        layers: physicalBoardContract.scoringIoBoard.layers,
        finishedThicknessMm: "not-modeled"
      },
      applicationBoard: {
        widthMm: physicalBoardContract.applicationDisplayCarrier.widthMm,
        heightMm: physicalBoardContract.applicationDisplayCarrier.heightMm,
        layers: physicalBoardContract.applicationDisplayCarrier.layers,
        finishedThicknessMm: "not-modeled"
      },
      modeledOwnership: "separate scoring I/O and application/display physical planning models"
    },
    contract: {
      physicalAssemblyCount: 2,
      scoringBoard: physicalBoardContract.scoringIoBoard,
      applicationBoard: physicalBoardContract.applicationDisplayCarrier,
      ownership: "separate scoring I/O and application/display PCBs"
    },
    matchesEnvelope: true
  }
} as const

export const provisionalBoardEnvelopes = [
  {
    board: "SCORING_IO_BOARD",
    planningMaximumMm: {
      width: physicalBoardContract.scoringIoBoard.widthMm,
      height: physicalBoardContract.scoringIoBoard.heightMm
    },
    finishedThicknessMm: physicalBoardContract.scoringIoBoard.finishedThicknessMm,
    finishedThicknessToleranceMm: 0.1,
    outlineAuthority: "provisional-planning-only",
    datum: "lower-left board corner, referenced to chassis datums B and C by the released carrier drawing",
    mounting:
      "Four provisional M3 chassis standoffs; no body-cord insertion load or VESA load may reach the PCB or its solder joints"
  },
  {
    board: "APPLICATION_DISPLAY_CARRIER",
    planningMaximumMm: {
      width: physicalBoardContract.applicationDisplayCarrier.widthMm,
      height: physicalBoardContract.applicationDisplayCarrier.heightMm
    },
    finishedThicknessMm: physicalBoardContract.applicationDisplayCarrier.finishedThicknessMm,
    finishedThicknessToleranceMm: 0.1,
    outlineAuthority: "provisional-planning-only",
    datum: "upper-left board corner, behind and inside the selected panel envelope",
    mounting:
      "Four provisional M3 chassis standoffs; VESA 100 metal inserts belong to the chassis and must bypass the PCB"
  },
  {
    board: "REPLACEABLE_COMMUNICATIONS_MODULE",
    planningMaximumMm: {
      width: physicalBoardContract.communicationsModule.widthMm,
      height: physicalBoardContract.communicationsModule.heightMm
    },
    finishedThicknessMm: physicalBoardContract.communicationsModule.finishedThicknessMm,
    finishedThicknessToleranceMm: 0.08,
    outlineAuthority: "provisional-planning-only",
    datum: "external connector mating face at chassis datum B; board edge datum comes from released connector drawings",
    mounting:
      "Chassis-supported removable tray with two positive fasteners; USB-C and RJ45 shell loads bypass PCB solder joints"
  }
] as const satisfies readonly BoardEnvelope[]

export const connectorPlacementContract = [
  {
    board: "REPLACEABLE_COMMUNICATIONS_MODULE",
    interface: "USB-C 10177070-00011LF",
    edgeZone: "external service edge, left sub-zone",
    placement:
      "Connector mating face coincident with the released chassis cutout; reserve plug overmold, finger access, shell stakes, and ESD/chassis entry directly behind the receptacle",
    keepout:
      "No RJ45 metalwork, internal harness, fastener, or enclosure rib in the manufacturer plug, shell-stake, solder, inspection, and extraction envelope"
  },
  {
    board: "REPLACEABLE_COMMUNICATIONS_MODULE",
    interface: "RJ45 7499011121A",
    edgeZone: "external service edge, right sub-zone",
    placement:
      "Integrated-magnetics jack at the chassis entry with link LEDs visible and latch release operable without removing the module",
    keepout:
      "Reserve full plug and latch travel, cable boot bend, shield tabs, chassis bond, and magnetics/MDI quiet zone"
  },
  {
    board: "REPLACEABLE_COMMUNICATIONS_MODULE",
    interface: "J_PWR, J_CTRL, and J_USB2",
    edgeZone: "internal service edge opposite USB-C and RJ45",
    placement:
      "Keyed connectors face the removable-cover service volume and remain reachable after the external source is removed",
    keepout:
      "No cable may cross an external plug extraction path, sharp edge, thermal hotspot, or another connector latch"
  },
  {
    board: "APPLICATION_DISPLAY_CARRIER",
    interface: "ESP32-S3-WROOM-1U U.FL and coax",
    edgeZone: "RF edge zone nearest the selected chassis bulkhead",
    placement:
      "U.FL launch and first coax bend remain visible and tool-accessible; coax reaches the chassis antenna without crossing display power or a switch node",
    keepout:
      "Manufacturer module/U.FL keepout plus selected coax minimum bend radius, mating-tool access, retention, and enclosure-metal detuning volume"
  },
  {
    board: "APPLICATION_DISPLAY_CARRIER",
    interface: "J_HUB75 and keyed V5/GND panel power",
    edgeZone: "panel-facing edge nearest the purchased panel input headers",
    placement:
      "HUB75 buffers sit beside J_HUB75; signal and power harnesses take separate supported paths with service slack",
    keepout:
      "Reserve IDC strain relief, keying, latch access, panel power connector, minimum bend radii, and panel removal without pulling board solder joints"
  },
  {
    board: "SCORING_IO_BOARD",
    interface: "left and right body-cord module harnesses",
    edgeZone: "opposed left and right scoring-entry zones",
    placement:
      "Only replaceable passive harness connectors mount on the PCB; Stäubli XUB-G sockets and their M4 terminations remain panel/chassis supported",
    keepout:
      "Reserve socket rear 40 mm axial envelope, ring terminals, locking hardware, harness flex, finger/tool access, and a strain-relief anchor within 25 mm of each PCB"
  }
] as const

export const isolationSlotMechanicalContract = {
  board: "SCORING_IO_BOARD",
  slotWidthTargetMm: 4,
  creepageTargetMm: 8,
  clearanceTargetMm: 4,
  copperKeepoutTargetMm: 4,
  continuity:
    "The routed slot and no-copper keepout must be continuous from one released board-edge exclusion to the other; only ISO7762, ISO7721, and NXE1S0505MC may bridge the boundary.",
  mountingRule:
    "No mounting hole, chassis boss, fastener, harness anchor, test point, coating dam, or tooling feature may bridge or reduce the isolation boundary.",
  toleranceRule:
    "Fabricator slot width and position tolerances must be added to the released creepage/clearance stack; nominal targets alone cannot pass."
} as const

export const harnessServiceContract = {
  bodyCordAnchorMaximumDistanceFromBoardMm: 25,
  internalHotPlug: "prohibited",
  serviceOrder:
    "Remove USB-C power, verify V20_EFUSE_OUT discharged, release cable anchors, then unlatch internal connectors; reconnect in reverse order.",
  routing:
    "Harnesses use drawing-controlled clips and abrasion protection, preserve connector latch access, include service slack without loops entering fans or hot zones, and never carry enclosure or plug loads through PCB solder joints.",
  bendEvidence:
    "Every selected cable assembly must provide a manufacturer minimum static and repeated-flex bend radius or pass a documented qualification; no generic bend radius is assumed."
} as const

export const mechanicalReleaseGates = [
  "Release exact board outlines, hole tables, connector datums, tolerances, height maps, and keepouts for all three boards. The current planning rectangles match the width, height, and layer contracts, but their finished thicknesses remain contract-only values rather than renderer output.",
  "Import revision-controlled manufacturer drawings and STEP models for USB-C, RJ45, HSEC8/ECDP, Micro-Fit, HUB75 headers, U.FL/coax, Stäubli sockets, and the purchased panel revision.",
  "Measure purchased panel outline, thickness, mounting holes, input connectors, rear components, and cable exits; overlay the measurements against a released enclosure assembly drawing.",
  "Release dimensioned PCB outlines, hole tables, datum targets, tolerances, component-height maps, courtyards, tooling rails, and keepouts for all three boards.",
  "Release chassis drawings proving VESA 100 load bypass, connector cutouts, plug/latch travel, service-tool access, strain relief, cable bend radii, module extraction, and mis-mate prevention.",
  "Demonstrate continuous isolation slot, creepage, clearance, and copper keepout after routed-board and fabrication-tolerance review.",
  "Complete a physical fit check with production-equivalent boards, enclosure, panel, connectors, cables, antenna, socket modules, fasteners, and service sequence.",
  "Pass connector insertion, cable pull, vibration, drop, repeated module replacement, thermal, ESD, and spill-path testing without PCB solder-joint loading or isolation-boundary violation."
] as const

export type MechanicalEvidence = {
  readonly physicalBoardModelsMatchEnvelope: boolean
  readonly connectorDrawingsImported: boolean
  readonly panelMeasured: boolean
  readonly pcbDrawingsReleased: boolean
  readonly chassisDrawingReleased: boolean
  readonly cableBendAndStrainQualified: boolean
  readonly isolationToleranceReviewed: boolean
  readonly physicalFitPassed: boolean
  readonly environmentalMechanicalTestsPassed: boolean
}

export const currentMechanicalEvidence = {
  physicalBoardModelsMatchEnvelope: true,
  connectorDrawingsImported: false,
  panelMeasured: false,
  pcbDrawingsReleased: false,
  chassisDrawingReleased: false,
  cableBendAndStrainQualified: false,
  isolationToleranceReviewed: false,
  physicalFitPassed: false,
  environmentalMechanicalTestsPassed: false
} as const satisfies MechanicalEvidence

export type MechanicalEvaluation = {
  readonly fabricationApproved: false
  readonly status: MechanicalReleaseStatus
  readonly failedGates: readonly (keyof MechanicalEvidence)[]
}

const evidenceKeys = [
  "physicalBoardModelsMatchEnvelope",
  "connectorDrawingsImported",
  "panelMeasured",
  "pcbDrawingsReleased",
  "chassisDrawingReleased",
  "cableBendAndStrainQualified",
  "isolationToleranceReviewed",
  "physicalFitPassed",
  "environmentalMechanicalTestsPassed"
] as const satisfies readonly (keyof MechanicalEvidence)[]

function isMechanicalEvidenceKey(key: PropertyKey): key is keyof MechanicalEvidence {
  return typeof key === "string" && evidenceKeys.some((expectedKey) => expectedKey === key)
}

function readMechanicalBoolean(input: object, key: keyof MechanicalEvidence): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(input, key)
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new RangeError(`${key} must be an own enumerable data property`)
  }
  if (typeof descriptor.value !== "boolean") throw new TypeError(`${key} must be boolean`)
  return descriptor.value
}

function readMechanicalEvidence(input: unknown): MechanicalEvidence {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    throw new TypeError("Mechanical evidence must be a plain object")
  }

  const ownKeys = Reflect.ownKeys(input)
  if (ownKeys.length !== evidenceKeys.length || ownKeys.some((key) => !isMechanicalEvidenceKey(key))) {
    throw new RangeError("Mechanical evidence must contain exactly the reviewed gates")
  }

  return {
    physicalBoardModelsMatchEnvelope: readMechanicalBoolean(input, "physicalBoardModelsMatchEnvelope"),
    connectorDrawingsImported: readMechanicalBoolean(input, "connectorDrawingsImported"),
    panelMeasured: readMechanicalBoolean(input, "panelMeasured"),
    pcbDrawingsReleased: readMechanicalBoolean(input, "pcbDrawingsReleased"),
    chassisDrawingReleased: readMechanicalBoolean(input, "chassisDrawingReleased"),
    cableBendAndStrainQualified: readMechanicalBoolean(input, "cableBendAndStrainQualified"),
    isolationToleranceReviewed: readMechanicalBoolean(input, "isolationToleranceReviewed"),
    physicalFitPassed: readMechanicalBoolean(input, "physicalFitPassed"),
    environmentalMechanicalTestsPassed: readMechanicalBoolean(input, "environmentalMechanicalTestsPassed")
  }
}

export function evaluateMechanicalEnvelope(input: unknown = currentMechanicalEvidence): MechanicalEvaluation {
  const record = readMechanicalEvidence(input)
  const failedGates = evidenceKeys.filter((key) => record[key] === false)
  return {
    fabricationApproved: false,
    status: failedGates.length === 0 ? "pass" : "deny",
    failedGates
  }
}
