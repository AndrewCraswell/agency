/**
 * Fabrication release decision record for the two six-layer production boards.
 *
 * This is a supplier-facing gate, not a PCB generator.  It intentionally keeps
 * the vendor and solved dielectric stackup unselected until a supplier has
 * reviewed the routed design, impedance coupons, outline, and tolerances.
 */

export type SixLayerBoard = "SCORING_IO_BOARD" | "APPLICATION_DISPLAY_CARRIER"
export type PcbVendorId = "JLCPCB" | "PCBWAY"
export type ReleaseCheckStatus = "pass" | "open" | "deny"

export type VendorCapability = {
  readonly id: PcbVendorId
  readonly displayName: string
  readonly sourceUrls: readonly string[]
  readonly sourceRetrievedOn: string
  readonly maxLayersPublished: number
  readonly supportedThicknessesMm: readonly number[]
  readonly thicknessToleranceAt16Mm: number
  readonly maxBoardWidthMm: number
  readonly maxBoardHeightMm: number
  readonly minViaDrillMm: number
  readonly minCncHoleMm: number
  readonly twoOzOuterGeometry: {
    readonly releaseBaseline: {
      readonly minTraceWidthMm: number
      readonly minTraceSpaceMm: number
      readonly minViaAnnularRingMm: number
      readonly minComponentAnnularRingMm: number
      readonly capabilityClass: string
    }
    readonly alternatePublishedClass: {
      readonly minTraceWidthMm: number
      readonly minTraceSpaceMm: number
      readonly minViaAnnularRingMm: number
      readonly minComponentAnnularRingMm: number
      readonly capabilityClass: string
    }
  }
  readonly oneOzInnerGeometry: {
    readonly minTraceWidthMm: number
    readonly minTraceSpaceMm: number
    readonly capabilityClass: string
  }
  readonly minSoldermaskBridgeMm: number | null
  readonly outerCopperOz: readonly number[]
  readonly innerCopperOz: readonly number[]
  readonly highTgOptionsC: readonly number[]
  readonly controlledImpedance: boolean
  readonly impedanceTolerancePercent: number | null
  readonly soldermaskProcess: string
  readonly surfaceFinishes: readonly string[]
  readonly outlineToleranceMm: number | null
  readonly minNonPlatedSlotWidthMm: number
  readonly nonPlatedSlotWidthToleranceMm: number | null
  readonly slotPositionToleranceMm: number | null
}

export const fabricationVendors = {
  JLCPCB: {
    id: "JLCPCB",
    displayName: "JLCPCB",
    sourceUrls: [
      "https://jlcpcb.com/resources/6-layer-pcbs",
      "https://jlcpcb.com/capabilities/pcb-capabilities/",
      "https://jlcpcb.com/help/article/jlcpcb-copper-weight"
    ],
    sourceRetrievedOn: "2026-08-23",
    maxLayersPublished: 32,
    supportedThicknessesMm: [0.8, 1.0, 1.2, 1.6, 2.0],
    thicknessToleranceAt16Mm: 0.16,
    maxBoardWidthMm: 660,
    maxBoardHeightMm: 475,
    minViaDrillMm: 0.15,
    minCncHoleMm: 0.15,
    twoOzOuterGeometry: {
      releaseBaseline: {
        minTraceWidthMm: 0.16,
        minTraceSpaceMm: 0.16,
        minViaAnnularRingMm: 0.254,
        minComponentAnnularRingMm: 0.254,
        capabilityClass: "copper-weight guide 2 oz rule"
      },
      alternatePublishedClass: {
        minTraceWidthMm: 0.15,
        minTraceSpaceMm: 0.15,
        minViaAnnularRingMm: 0.254,
        minComponentAnnularRingMm: 0.254,
        capabilityClass: "rigid-capability multilayer 2 oz rule"
      }
    },
    oneOzInnerGeometry: {
      minTraceWidthMm: 0.09,
      minTraceSpaceMm: 0.09,
      capabilityClass: "published multilayer 1 oz minimum"
    },
    minSoldermaskBridgeMm: 0.2,
    outerCopperOz: [1, 2],
    innerCopperOz: [0.5, 1, 2],
    highTgOptionsC: [135, 155],
    controlledImpedance: true,
    impedanceTolerancePercent: 10,
    soldermaskProcess: "Published soldermask colors; process and mask expansion require supplier confirmation",
    surfaceFinishes: ["ENIG"],
    outlineToleranceMm: 0.1,
    minNonPlatedSlotWidthMm: 1,
    nonPlatedSlotWidthToleranceMm: 0.2,
    slotPositionToleranceMm: null
  },
  PCBWAY: {
    id: "PCBWAY",
    displayName: "PCBWay",
    sourceUrls: ["https://www.pcbway.com/capabilities.html", "https://www.pcbway.com/advanced-pcb-capabilities.html"],
    sourceRetrievedOn: "2026-08-23",
    maxLayersPublished: 14,
    supportedThicknessesMm: [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.6, 2.0, 2.4, 2.6, 2.8, 3.0, 3.2],
    thicknessToleranceAt16Mm: 0.112,
    maxBoardWidthMm: 560,
    maxBoardHeightMm: 1150,
    minViaDrillMm: 0.15,
    minCncHoleMm: 0.15,
    twoOzOuterGeometry: {
      releaseBaseline: {
        minTraceWidthMm: 0.1778,
        minTraceSpaceMm: 0.2032,
        minViaAnnularRingMm: 0.1778,
        minComponentAnnularRingMm: 0.3048,
        capabilityClass: "published conventional 70 um outer copper"
      },
      alternatePublishedClass: {
        minTraceWidthMm: 0.1524,
        minTraceSpaceMm: 0.1778,
        minViaAnnularRingMm: 0.1524,
        minComponentAnnularRingMm: 0.254,
        capabilityClass: "published medium 70 um outer copper"
      }
    },
    oneOzInnerGeometry: {
      minTraceWidthMm: 0.1016,
      minTraceSpaceMm: 0.127,
      capabilityClass: "published conventional 35 um inner copper; medium class is 0.1016/0.1016 mm"
    },
    minSoldermaskBridgeMm: 0.0762,
    outerCopperOz: [1, 2, 3, 4, 5, 6, 7, 8],
    innerCopperOz: [1, 1.5, 2, 3, 4],
    highTgOptionsC: [170, 210, 220],
    controlledImpedance: true,
    impedanceTolerancePercent: 10,
    soldermaskProcess: "LPI",
    surfaceFinishes: ["ENIG", "HASL", "HASL lead free", "OSP", "Immersion Ag", "Immersion Sn", "Hard Gold"],
    outlineToleranceMm: 0.2,
    minNonPlatedSlotWidthMm: 0.8,
    nonPlatedSlotWidthToleranceMm: null,
    slotPositionToleranceMm: null
  }
} as const satisfies Record<PcbVendorId, VendorCapability>

export const sixLayerBoardReleaseRequirements = {
  boardIds: ["SCORING_IO_BOARD", "APPLICATION_DISPLAY_CARRIER"] as const,
  layerCount: 6,
  finishedThicknessMm: 1.6,
  finishedThicknessToleranceMm: 0.1,
  laminate: "High-Tg FR-4 with a supplier-declared material system and lot traceability",
  minimumTgC: 155,
  outerCopperOz: 2,
  innerCopperOz: 1,
  layerOrder: [
    { layer: "L1", copperOz: 2, role: "components, connector entry, short signals, and high-current copper" },
    { layer: "L2", copperOz: 1, role: "continuous domain-local reference plane" },
    { layer: "L3", copperOz: 1, role: "power distribution and low-current planes" },
    { layer: "L4", copperOz: 1, role: "controlled signals, digital escape, and service access" },
    { layer: "L5", copperOz: 1, role: "continuous domain-local reference plane" },
    { layer: "L6", copperOz: 2, role: "secondary signals, test access, and local high-current copper" }
  ] as const,
  minimumTraceWidthMm: 0.15,
  minimumClearanceMm: 0.15,
  minimumViaDrillMm: 0.2,
  minimumFinishedAnnularRingMm: 0.1,
  soldermask: "LPI soldermask with supplier-confirmed expansion, sliver, dam, and registration limits",
  surfaceFinishPolicy:
    "ENIG on connector/contact geometry; any alternate finish requires assembly and corrosion review",
  controlledImpedance: [
    { netClass: "USB2_HIGH_SPEED", targetOhms: 90, tolerancePercent: 10 },
    { netClass: "ETHERNET_PHY", targetOhms: 100, tolerancePercent: 10 },
    { netClass: "LOCAL_FAST_SINGLE_ENDED", targetOhms: 50, tolerancePercent: 15 }
  ] as const,
  isolation: {
    slotWidthTargetMm: 4,
    slotWidthToleranceMm: 0.1,
    creepageTargetMm: 8,
    clearanceTargetMm: 4,
    copperKeepoutTargetMm: 4,
    toleranceReviewed: false
  },
  current: {
    v5ContinuousAmps: 5.39,
    v5ShortScreenAmps: 6.09,
    hardEfuseBoundAmps: 8.12,
    outerCopperThermalEvidenceRequired: true,
    connectorAndHarnessThermalEvidenceRequired: true,
    blockedVentAmbientC: 50
  },
  outline: {
    scoringIoBoard: { widthMm: 290, heightMm: 70 },
    applicationDisplayCarrier: { widthMm: 290, heightMm: 135 },
    datumAndToleranceRequired: true,
    mountingHoleTableRequired: true,
    connectorCoordinateTableRequired: true
  }
} as const

export type BoardOutlineEvidence = {
  readonly board: SixLayerBoard
  readonly revision: string
  readonly outlineReleased: boolean
  readonly datumReleased: boolean
  readonly toleranceReleased: boolean
  readonly mountingHoleTableReleased: boolean
  readonly connectorCoordinateTableReleased: boolean
}

export type StackupReleaseInput = {
  readonly vendor: PcbVendorId | null
  readonly vendorSelectionRecorded: boolean
  readonly supplierReviewAccepted: boolean
  readonly solvedStackupProvided: boolean
  readonly layerOrderMatches: boolean
  readonly dielectricMaterialAndTgRecorded: boolean
  readonly finishedThicknessAndToleranceAccepted: boolean
  readonly copperWeightsAccepted: boolean
  readonly impedanceFieldSolverAndCouponsAccepted: boolean
  readonly soldermaskAndFinishAccepted: boolean
  readonly isolationSlotAndCreepageToleranceAccepted: boolean
  readonly currentAndThermalEvidenceAccepted: boolean
  readonly dfmAndPanelizationAccepted: boolean
  readonly outlineEvidence: readonly BoardOutlineEvidence[]
  readonly acceptanceCriteriaRecorded: boolean
}

export const currentStackupReleaseInput = {
  vendor: null,
  vendorSelectionRecorded: false,
  supplierReviewAccepted: false,
  solvedStackupProvided: false,
  layerOrderMatches: false,
  dielectricMaterialAndTgRecorded: false,
  finishedThicknessAndToleranceAccepted: false,
  copperWeightsAccepted: false,
  impedanceFieldSolverAndCouponsAccepted: false,
  soldermaskAndFinishAccepted: false,
  isolationSlotAndCreepageToleranceAccepted: false,
  currentAndThermalEvidenceAccepted: false,
  dfmAndPanelizationAccepted: false,
  outlineEvidence: [],
  acceptanceCriteriaRecorded: false
} as const satisfies StackupReleaseInput

export type StackupReleaseCheck = {
  readonly id: string
  readonly status: ReleaseCheckStatus
  readonly evidence: string
}

export type StackupReleaseResult = {
  readonly status: ReleaseCheckStatus
  readonly fabricationApproved: false
  readonly checks: readonly StackupReleaseCheck[]
}

const requiredBooleanKeys = [
  "vendorSelectionRecorded",
  "supplierReviewAccepted",
  "solvedStackupProvided",
  "layerOrderMatches",
  "dielectricMaterialAndTgRecorded",
  "finishedThicknessAndToleranceAccepted",
  "copperWeightsAccepted",
  "impedanceFieldSolverAndCouponsAccepted",
  "soldermaskAndFinishAccepted",
  "isolationSlotAndCreepageToleranceAccepted",
  "currentAndThermalEvidenceAccepted",
  "dfmAndPanelizationAccepted",
  "acceptanceCriteriaRecorded"
] as const satisfies readonly (keyof Omit<StackupReleaseInput, "vendor" | "outlineEvidence">)[]

function isVendorId(value: unknown): value is PcbVendorId {
  return value === "JLCPCB" || value === "PCBWAY"
}

function isSixLayerBoard(value: unknown): value is SixLayerBoard {
  return value === "SCORING_IO_BOARD" || value === "APPLICATION_DISPLAY_CARRIER"
}

function validateOutlineEvidence(outlineEvidence: readonly BoardOutlineEvidence[]) {
  if (!Array.isArray(outlineEvidence)) throw new TypeError("outlineEvidence must be an array")
  const boards = new Set<SixLayerBoard>()
  for (const evidence of outlineEvidence) {
    if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
      throw new TypeError("each board outline evidence item must be an object")
    }
    if (!isSixLayerBoard(evidence.board)) {
      throw new TypeError("outline evidence has an unknown board")
    }
    if (boards.has(evidence.board)) throw new RangeError(`duplicate outline evidence for ${evidence.board}`)
    boards.add(evidence.board)
    if (typeof evidence.revision !== "string" || evidence.revision.length === 0) {
      throw new TypeError("outline evidence revision must be a non-empty string")
    }
    for (const key of [
      "outlineReleased",
      "datumReleased",
      "toleranceReleased",
      "mountingHoleTableReleased",
      "connectorCoordinateTableReleased"
    ] as const) {
      if (typeof evidence[key] !== "boolean") throw new TypeError(`${key} must be boolean`)
    }
  }
}

export function comparePcbVendorCapabilities(requirements = sixLayerBoardReleaseRequirements): readonly {
  readonly vendor: PcbVendorId
  readonly layerCountFit: boolean
  readonly boardSizeFit: boolean
  readonly thicknessNominalFit: boolean
  readonly thicknessToleranceFit: boolean
  readonly copperFit: boolean
  readonly geometryFit: boolean
  readonly impedanceFit: boolean
  readonly highTgFit: boolean
  readonly gaps: readonly string[]
}[] {
  return (Object.keys(fabricationVendors) as PcbVendorId[]).map((vendorId) => {
    const vendor = fabricationVendors[vendorId]
    const layerCountFit = vendor.maxLayersPublished >= requirements.layerCount
    const boardSizeFit =
      vendor.maxBoardWidthMm >= requirements.outline.scoringIoBoard.widthMm &&
      vendor.maxBoardHeightMm >= requirements.outline.applicationDisplayCarrier.heightMm
    const thicknessNominalFit = vendor.supportedThicknessesMm.includes(requirements.finishedThicknessMm)
    const thicknessToleranceFit = vendor.thicknessToleranceAt16Mm <= requirements.finishedThicknessToleranceMm
    const copperFit =
      vendor.outerCopperOz.includes(requirements.outerCopperOz) &&
      vendor.innerCopperOz.includes(requirements.innerCopperOz)
    const twoOzReleaseGeometry = vendor.twoOzOuterGeometry.releaseBaseline
    const geometryFit =
      twoOzReleaseGeometry.minTraceWidthMm <= requirements.minimumTraceWidthMm &&
      twoOzReleaseGeometry.minTraceSpaceMm <= requirements.minimumClearanceMm &&
      vendor.oneOzInnerGeometry.minTraceWidthMm <= requirements.minimumTraceWidthMm &&
      vendor.oneOzInnerGeometry.minTraceSpaceMm <= requirements.minimumClearanceMm &&
      vendor.minViaDrillMm <= requirements.minimumViaDrillMm &&
      twoOzReleaseGeometry.minViaAnnularRingMm <= requirements.minimumFinishedAnnularRingMm
    const impedanceFit = vendor.controlledImpedance && vendor.impedanceTolerancePercent !== null
    const highTgFit = vendor.highTgOptionsC.some((tg) => tg >= requirements.minimumTgC)
    const gaps: string[] = []
    if (!layerCountFit) gaps.push("published layer-count capability")
    if (!boardSizeFit) gaps.push("published board-size capability")
    if (!thicknessNominalFit) gaps.push("1.60 mm nominal thickness")
    if (!thicknessToleranceFit) gaps.push("supplier acceptance of the +/-0.10 mm finished-thickness target")
    if (!copperFit) gaps.push("2 oz outer and 1 oz inner copper")
    if (!geometryFit) gaps.push("2 oz outer/1 oz inner trace, space, drill, or annular-ring rule")
    if (!impedanceFit) gaps.push("controlled-impedance tolerance")
    if (!highTgFit) gaps.push("minimum Tg 155 C material")
    if (vendor.minNonPlatedSlotWidthMm > requirements.isolation.slotWidthTargetMm)
      gaps.push("minimum non-plated isolation-slot width")
    if (vendor.slotPositionToleranceMm === null) gaps.push("supplier-confirmed isolation-slot position tolerance")
    return {
      vendor: vendorId,
      layerCountFit,
      boardSizeFit,
      thicknessNominalFit,
      thicknessToleranceFit,
      copperFit,
      geometryFit,
      impedanceFit,
      highTgFit,
      gaps
    }
  })
}

export function evaluateStackupRelease(input: StackupReleaseInput = currentStackupReleaseInput): StackupReleaseResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("stackup release input must be an object")
  }
  if (input.vendor !== null && !isVendorId(input.vendor)) throw new TypeError("vendor must be JLCPCB, PCBWAY, or null")
  for (const key of requiredBooleanKeys) {
    if (typeof input[key] !== "boolean") throw new TypeError(`${key} must be boolean`)
  }
  validateOutlineEvidence(input.outlineEvidence)
  const outlinesByBoard = new Map(input.outlineEvidence.map((evidence) => [evidence.board, evidence]))
  const outlineChecks = sixLayerBoardReleaseRequirements.boardIds.map((board) => {
    const evidence = outlinesByBoard.get(board)
    const complete =
      evidence !== undefined &&
      evidence.outlineReleased &&
      evidence.datumReleased &&
      evidence.toleranceReleased &&
      evidence.mountingHoleTableReleased &&
      evidence.connectorCoordinateTableReleased
    return {
      id: `${board.toLowerCase()}-outline-datum`,
      status: complete ? (input.supplierReviewAccepted ? "pass" : "deny") : "deny",
      evidence: complete
        ? input.supplierReviewAccepted
          ? `${board} has a revisioned outline, datum, tolerance, mounting-hole table, and connector-coordinate table`
          : `${board} outline evidence exists but supplier review is not accepted`
        : `${board} requires a released outline, datum, tolerance, mounting-hole table, and connector-coordinate table`
    } as const
  })
  const checks: StackupReleaseCheck[] = [
    {
      id: "vendor-selection",
      status: input.vendor !== null && input.vendorSelectionRecorded ? "pass" : "deny",
      evidence:
        input.vendor !== null && input.vendorSelectionRecorded
          ? `Vendor selection is explicitly recorded as ${input.vendor}`
          : "No fabricator is selected; the capability comparison is not a fabrication authorization"
    },
    {
      id: "supplier-review",
      status: input.supplierReviewAccepted ? "pass" : "deny",
      evidence: input.supplierReviewAccepted
        ? "Supplier review acceptance is recorded"
        : "Supplier must review and accept the exact stackup, outline, impedance, isolation, and DFM package"
    },
    {
      id: "solved-stackup",
      status: input.solvedStackupProvided && input.layerOrderMatches ? "pass" : "deny",
      evidence:
        input.solvedStackupProvided && input.layerOrderMatches
          ? "Vendor-solved dielectric stackup and the six-layer order match the release target"
          : "Provide the vendor-solved L1-L6 dielectric stackup and verify the layer order against the board contract"
    },
    {
      id: "material-tg-thickness",
      status: input.dielectricMaterialAndTgRecorded && input.finishedThicknessAndToleranceAccepted ? "pass" : "open",
      evidence:
        input.dielectricMaterialAndTgRecorded && input.finishedThicknessAndToleranceAccepted
          ? "Material system, Tg, finished thickness, and tolerance are recorded"
          : "Record laminate family, resin/glass system, Tg, finished 1.60 mm thickness, and supplier tolerance"
    },
    {
      id: "copper-weights",
      status: input.copperWeightsAccepted ? "pass" : "open",
      evidence: input.copperWeightsAccepted
        ? "2 oz outer and 1 oz inner finished copper are accepted"
        : "Confirm finished copper weights and plating allowance for every layer"
    },
    {
      id: "impedance-and-coupons",
      status: input.impedanceFieldSolverAndCouponsAccepted ? "pass" : "open",
      evidence: input.impedanceFieldSolverAndCouponsAccepted
        ? "90 ohm USB2, 100 ohm Ethernet, and 50 ohm local fast nets have solver results and coupons"
        : "Provide field-solver geometry, dielectric assumptions, target/tolerance table, coupon locations, and measured impedance acceptance"
    },
    {
      id: "soldermask-and-finish",
      status: input.soldermaskAndFinishAccepted ? "pass" : "open",
      evidence: input.soldermaskAndFinishAccepted
        ? "LPI mask limits, mask registration, and ENIG/contact finish are accepted"
        : "Confirm mask process, expansion, sliver/dam, registration, surface finish, and corrosion/assembly compatibility"
    },
    {
      id: "isolation-tolerance",
      status: input.isolationSlotAndCreepageToleranceAccepted ? "pass" : "deny",
      evidence: input.isolationSlotAndCreepageToleranceAccepted
        ? "Slot width/position tolerance is included in the 8 mm creepage and 4 mm clearance stack"
        : "Isolation slot, copper keepout, creepage, clearance, and fabrication tolerances are not supplier-accepted"
    },
    {
      id: "current-and-thermal",
      status: input.currentAndThermalEvidenceAccepted ? "pass" : "open",
      evidence: input.currentAndThermalEvidenceAccepted
        ? "5.39 A continuous, 6.09 A short-screen, and 8.12 A eFuse-bound paths have copper, connector, and thermal evidence"
        : "Document trace/via current capacity, temperature rise, connector/harness limits, and the 50 C blocked-vent test plan"
    },
    {
      id: "dfm-and-panelization",
      status: input.dfmAndPanelizationAccepted ? "pass" : "open",
      evidence: input.dfmAndPanelizationAccepted
        ? "DFM, annular ring, drill, soldermask, panelization, tooling, and test access are accepted"
        : "Supplier DFM must review min trace/space, via/drill/annular ring, slots, tooling, panel rails, and test-point access"
    },
    ...outlineChecks,
    {
      id: "release-acceptance-record",
      status: input.acceptanceCriteriaRecorded ? "pass" : "open",
      evidence: input.acceptanceCriteriaRecorded
        ? "Inspection, impedance, thickness, outline, and DFM acceptance criteria are recorded with revision ownership"
        : "Record objective acceptance criteria, inspection reports, deviations, and revision ownership before release"
    }
  ]
  return {
    status: checks.some((check) => check.status === "deny")
      ? "deny"
      : checks.some((check) => check.status === "open")
        ? "open"
        : "pass",
    fabricationApproved: false,
    checks
  }
}
