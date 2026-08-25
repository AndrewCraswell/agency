import type { ReactElement } from "react"

const affectedReferences = [
  "C_ETH_AVDD_FERRITE_INPUT",
  "C_W5500_VDD",
  "C_W5500_AVDD_1",
  "C_W5500_AVDD_2",
  "C_W5500_AVDD_3",
  "C_W5500_AVDD_4",
  "C_W5500_AVDD_5",
  "C_W5500_AVDD_6"
] as const

const canonicalSupportSourceSha256 = "972DF3067930A80541F7DEA8A6A716B63F01AC9112FBB3665EE4BDF0EA64529C"
const retainedMurataSourceSha256 = "A8D9E8E5A06AA235221C7E957837509E64A9F75E42230EE142F51F984B4CFA09"
const renderedGeometrySha256 = "EEB50A5C36D394B767EAADC5256C8B837DA9AE455AE9F4BCB8BD008D846A1E0A"

const projectCopperPadLengthMm = 0.65
const projectCopperPadWidthMm = 0.7
const projectCopperPadGapMm = 0.7
const projectCopperPadCenterXMm = 0.675
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05

const renderedGeometryContract = {
  pads: [
    {
      name: "1",
      layer: "top",
      shape: "rect",
      xMm: -projectCopperPadCenterXMm,
      yMm: 0,
      widthMm: 0.65,
      heightMm: 0.7,
      portHints: ["1", "A", "non-polar", "terminal-a"],
      isCoveredWithSolderMask: false,
      soldermaskMarginMm: projectSolderMaskMarginMm
    },
    {
      name: "2",
      layer: "top",
      shape: "rect",
      xMm: projectCopperPadCenterXMm,
      yMm: 0,
      widthMm: 0.65,
      heightMm: 0.7,
      portHints: ["2", "B", "non-polar", "terminal-b"],
      isCoveredWithSolderMask: false,
      soldermaskMarginMm: projectSolderMaskMarginMm
    }
  ],
  paste: [
    { layer: "top", shape: "rect", xMm: -projectCopperPadCenterXMm, yMm: 0, widthMm: 0.55, heightMm: 0.6 },
    { layer: "top", shape: "rect", xMm: projectCopperPadCenterXMm, yMm: 0, widthMm: 0.55, heightMm: 0.6 }
  ],
  courtyard: { shape: "rect", layer: "top", centerMm: { x: 0, y: 0 }, widthMm: 2.5, heightMm: 1.3 },
  elementCounts: { courtyard: 1, paste: 2, pads: 2 }
} as const

const renderedElementTypeSequence = [
  "source_group",
  "source_port",
  "source_port",
  "source_component",
  "source_refdes_convention_warning",
  "source_component_internal_connection",
  "source_component_internal_connection",
  "pcb_component",
  "pcb_group",
  "pcb_smtpad",
  "pcb_solder_paste",
  "pcb_smtpad",
  "pcb_solder_paste",
  "pcb_courtyard_rect",
  "pcb_port",
  "pcb_port",
  "cad_component"
] as const

const renderedElementKeys: Readonly<Record<string, readonly string[]>> = {
  source_group: ["type", "source_group_id", "name", "is_subcircuit", "was_automatically_named", "subcircuit_id"],
  source_port: ["type", "source_port_id", "name", "pin_number", "port_hints", "source_component_id", "subcircuit_id"],
  source_component: [
    "type",
    "source_component_id",
    "ftype",
    "name",
    "manufacturer_part_number",
    "supplier_part_numbers",
    "display_name",
    "source_group_id",
    "internally_connected_source_port_ids"
  ],
  source_refdes_convention_warning: [
    "type",
    "warning_type",
    "message",
    "source_component_id",
    "refdes",
    "source_component_ftype",
    "expected_prefixes",
    "actual_prefix",
    "subcircuit_id",
    "source_refdes_convention_warning_id"
  ],
  source_component_internal_connection: [
    "type",
    "source_component_internal_connection_id",
    "source_component_id",
    "subcircuit_id",
    "source_port_ids"
  ],
  pcb_component: [
    "type",
    "pcb_component_id",
    "center",
    "width",
    "height",
    "layer",
    "rotation",
    "insertion_direction",
    "source_component_id",
    "subcircuit_id",
    "do_not_place",
    "obstructs_within_bounds",
    "is_allowed_to_be_off_board",
    "metadata",
    "pcb_group_id"
  ],
  pcb_group: [
    "type",
    "pcb_group_id",
    "is_subcircuit",
    "subcircuit_id",
    "name",
    "anchor_position",
    "center",
    "width",
    "height",
    "pcb_component_ids",
    "source_group_id",
    "autorouter_configuration",
    "anchor_alignment"
  ],
  pcb_smtpad: [
    "type",
    "pcb_smtpad_id",
    "pcb_component_id",
    "pcb_port_id",
    "layer",
    "shape",
    "width",
    "height",
    "corner_radius",
    "port_hints",
    "is_covered_with_solder_mask",
    "soldermask_margin",
    "x",
    "y",
    "subcircuit_id",
    "pcb_group_id"
  ],
  pcb_solder_paste: [
    "type",
    "pcb_solder_paste_id",
    "layer",
    "shape",
    "width",
    "height",
    "x",
    "y",
    "pcb_component_id",
    "pcb_smtpad_id",
    "subcircuit_id",
    "pcb_group_id"
  ],
  pcb_courtyard_rect: [
    "type",
    "pcb_courtyard_rect_id",
    "pcb_component_id",
    "layer",
    "center",
    "width",
    "height",
    "ccw_rotation",
    "subcircuit_id",
    "pcb_group_id"
  ],
  pcb_port: [
    "type",
    "pcb_port_id",
    "pcb_component_id",
    "layers",
    "subcircuit_id",
    "pcb_group_id",
    "x",
    "y",
    "source_port_id",
    "is_board_pinout"
  ],
  cad_component: [
    "type",
    "cad_component_id",
    "position",
    "rotation",
    "pcb_component_id",
    "source_component_id",
    "model_origin_alignment",
    "anchor_alignment",
    "show_as_bounding_box",
    "show_as_translucent_model"
  ]
}

const renderedTargetElementContract = [
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_0",
    pcb_component_id: "pcb_component_0",
    pcb_port_id: "pcb_port_0",
    layer: "top",
    shape: "rect",
    width: 0.65,
    height: 0.7,
    corner_radius: undefined,
    port_hints: ["1", "A", "non-polar", "terminal-a"],
    is_covered_with_solder_mask: false,
    soldermask_margin: 0.05,
    x: -0.675,
    y: 0,
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0"
  },
  {
    type: "pcb_solder_paste",
    pcb_solder_paste_id: "pcb_solder_paste_0",
    layer: "top",
    shape: "rect",
    width: 0.55,
    height: 0.6,
    x: -0.675,
    y: 0,
    pcb_component_id: "pcb_component_0",
    pcb_smtpad_id: "pcb_smtpad_0",
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0"
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_1",
    pcb_component_id: "pcb_component_0",
    pcb_port_id: "pcb_port_1",
    layer: "top",
    shape: "rect",
    width: 0.65,
    height: 0.7,
    corner_radius: undefined,
    port_hints: ["2", "B", "non-polar", "terminal-b"],
    is_covered_with_solder_mask: false,
    soldermask_margin: 0.05,
    x: 0.675,
    y: 0,
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0"
  },
  {
    type: "pcb_solder_paste",
    pcb_solder_paste_id: "pcb_solder_paste_1",
    layer: "top",
    shape: "rect",
    width: 0.55,
    height: 0.6,
    x: 0.675,
    y: 0,
    pcb_component_id: "pcb_component_0",
    pcb_smtpad_id: "pcb_smtpad_1",
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0"
  },
  {
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: "pcb_courtyard_rect_0",
    pcb_component_id: "pcb_component_0",
    layer: "top",
    center: { x: 0, y: 0 },
    width: 2.5,
    height: 1.3,
    ccw_rotation: undefined,
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0"
  }
] as const

const renderedElementValueContract = [
  {
    type: "source_group",
    source_group_id: "source_group_0",
    name: undefined,
    is_subcircuit: true,
    was_automatically_named: true,
    subcircuit_id: "subcircuit_source_group_0"
  },
  {
    type: "source_port",
    source_port_id: "source_port_0",
    name: "A",
    pin_number: 1,
    port_hints: ["A", "pin1", "1", "non-polar", "terminal-a"],
    source_component_id: "source_component_0",
    subcircuit_id: "subcircuit_source_group_0"
  },
  {
    type: "source_port",
    source_port_id: "source_port_1",
    name: "B",
    pin_number: 2,
    port_hints: ["B", "pin2", "2", "non-polar", "terminal-b"],
    source_component_id: "source_component_0",
    subcircuit_id: "subcircuit_source_group_0"
  },
  {
    type: "source_component",
    source_component_id: "source_component_0",
    ftype: "simple_chip",
    name: "C_BP033_MURATA_GRM188R71C104KA01D",
    manufacturer_part_number: "GRM188R71C104KA01D",
    supplier_part_numbers: undefined,
    display_name: undefined,
    source_group_id: "source_group_0",
    internally_connected_source_port_ids: [
      ["source_port_0", "source_port_1"],
      ["source_port_0", "source_port_1"]
    ]
  },
  {
    type: "source_refdes_convention_warning",
    warning_type: "source_refdes_convention_warning",
    message: 'The "C" prefix is being used with a <chip />, try using it with a <capacitor />',
    source_component_id: "source_component_0",
    refdes: "C_BP033_MURATA_GRM188R71C104KA01D",
    source_component_ftype: "simple_chip",
    expected_prefixes: ["U", "IC"],
    actual_prefix: "C",
    subcircuit_id: undefined,
    source_refdes_convention_warning_id: "source_refdes_convention_warning_0"
  },
  {
    type: "source_component_internal_connection",
    source_component_internal_connection_id: "source_component_internal_connection_0",
    source_component_id: "source_component_0",
    subcircuit_id: "subcircuit_source_group_0",
    source_port_ids: ["source_port_0", "source_port_1"]
  },
  {
    type: "source_component_internal_connection",
    source_component_internal_connection_id: "source_component_internal_connection_1",
    source_component_id: "source_component_0",
    subcircuit_id: "subcircuit_source_group_0",
    source_port_ids: ["source_port_0", "source_port_1"]
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_0",
    center: { x: 0, y: 0 },
    width: 2,
    height: 0.7,
    layer: "top",
    rotation: 0,
    insertion_direction: undefined,
    source_component_id: "source_component_0",
    subcircuit_id: "subcircuit_source_group_0",
    do_not_place: false,
    obstructs_within_bounds: true,
    is_allowed_to_be_off_board: false,
    metadata: undefined,
    pcb_group_id: "pcb_group_0"
  },
  {
    type: "pcb_group",
    pcb_group_id: "pcb_group_0",
    is_subcircuit: true,
    subcircuit_id: "subcircuit_source_group_0",
    name: "unnamed_group1",
    anchor_position: { x: 0, y: 0 },
    center: { x: 0, y: 0 },
    width: 2,
    height: 0.7,
    pcb_component_ids: [],
    source_group_id: "source_group_0",
    autorouter_configuration: undefined,
    anchor_alignment: null
  },
  renderedTargetElementContract[0],
  renderedTargetElementContract[1],
  renderedTargetElementContract[2],
  renderedTargetElementContract[3],
  renderedTargetElementContract[4],
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_0",
    pcb_component_id: "pcb_component_0",
    layers: ["top"],
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0",
    x: -0.675,
    y: 0,
    source_port_id: "source_port_0",
    is_board_pinout: undefined
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    pcb_component_id: "pcb_component_0",
    layers: ["top"],
    subcircuit_id: "subcircuit_source_group_0",
    pcb_group_id: "pcb_group_0",
    x: 0.675,
    y: 0,
    source_port_id: "source_port_1",
    is_board_pinout: undefined
  },
  {
    type: "cad_component",
    cad_component_id: "cad_component_0",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    pcb_component_id: "pcb_component_0",
    source_component_id: "source_component_0",
    model_origin_alignment: "center_of_component_on_board_surface",
    anchor_alignment: "center_of_component_on_board_surface",
    show_as_bounding_box: true,
    show_as_translucent_model: undefined
  }
] as const

const renderedInventoryMetadataContract = {
  _internal_store: {
    counts: {
      source_group: 0,
      source_port: 1,
      source_component: 0,
      source_refdes_convention_warning: 0,
      source_component_internal_connection: 1,
      pcb_component: 0,
      pcb_group: 0,
      pcb_smtpad: 1,
      pcb_solder_paste: 1,
      pcb_courtyard_rect: 0,
      pcb_port: 1,
      cad_component: 0
    },
    editCount: 27
  },
  editCount: 27
} as const

/**
 * BP-033 review-only footprint input for the eight exact W5500 100 nF bypass
 * references. It does not integrate a board footprint or authorize release.
 */
export const bp033MurataGrm188r71c104ka01dW5500BypassFootprint = {
  artifactKind: "bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint",
  workUnit: "BP-033",
  manufacturer: "Murata",
  manufacturerPartNumber: "GRM188R71C104KA01D",
  role: "W5500 100 nF supply bypass family",
  geometryAuthority: "project-review-input-not-manufacturer-cad",
  sourceBinding: {
    canonicalSourcePath: "packages/scoring-circuit/src/ethernet-support-network.ts",
    canonicalSourceSha256: canonicalSupportSourceSha256,
    exactReferences: affectedReferences,
    package: "0603 (1608 metric), paper tape suffix D"
  },
  sources: [
    {
      id: "murata-grm188r71c104ka01-reference-sheet",
      authority: "manufacturer-primary",
      documentNumber: "GRM188R71C104KA01-01",
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R71C104KA01-01.pdf",
      reviewedPages: "1, 26",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/murata-grm188r71c104ka01d-reference-sheet.pdf",
      sha256: retainedMurataSourceSha256,
      role: "Exact part identity, 1608 package dimensions, and Murata reflow land guidance."
    }
  ],
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute"
  },
  package: {
    designation: "GRM18 (1608M / 0603)",
    packageCode: "18",
    lengthMm: { nominal: 1.6, plus: 0.1, minus: 0.1 },
    widthMm: { nominal: 0.8, plus: 0.1, minus: 0.1 },
    thicknessMm: { nominal: 0.8, plus: 0.1, minus: 0.1 },
    terminalLengthMm: { minimum: 0.2, maximum: 0.5 },
    terminalGapMm: { minimum: 0.5 }
  },
  electrical: {
    nominalCapacitanceNf: 100,
    tolerancePercent: 10,
    dielectric: "X7R (EIA)",
    ratedVoltageVdc: 16,
    operatingTemperatureC: { minimum: -55, maximum: 125 }
  },
  manufacturerLandPattern: {
    sourceId: "murata-grm188r71c104ka01-reference-sheet",
    reviewedPage: 26,
    sourceTable: "Table 2 Reflow Soldering Method",
    chipDimensionRow: "GRM 18, 1.6 x 0.8 mm (within +/-0.10)",
    innerGapMm: { minimum: 0.6, maximum: 0.8 },
    padLengthMm: { minimum: 0.6, maximum: 0.7 },
    padWidthMm: { minimum: 0.6, maximum: 0.8 },
    note: "Murata requires confirmation on the actual set and PCB. This table is guidance, not finished manufacturer CAD."
  },
  projectSelection: {
    state: "project-review-input",
    authority: "deny",
    manufacturerParameterSelectionMm: { aInnerGap: 0.7, bPadLength: 0.65, cPadWidth: 0.7 },
    copperPad: { lengthMm: projectCopperPadLengthMm, widthMm: projectCopperPadWidthMm },
    derivedCopperPadGapMm: projectCopperPadGapMm,
    derivedCopperPadCenterXMm: projectCopperPadCenterXMm,
    solderMask: {
      openingLengthMm: 0.75,
      openingWidthMm: 0.8,
      marginPerEdgeMm: projectSolderMaskMarginMm,
      status: "project-review-input"
    },
    paste: {
      openingLengthMm: 0.55,
      openingWidthMm: 0.6,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      status: "project-review-input"
    },
    courtyard: {
      lengthMm: 2.5,
      widthMm: 1.3,
      minimumClearanceMm: 0.25,
      status: "project-review-input"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
  ],
  renderedGeometry: renderedGeometryContract,
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    sha256: renderedGeometrySha256,
    authority: "deny"
  },
  boardIntegration: false,
  fabricationAuthority: "deny",
  releaseState: "deny",
  accepted: false
} as const

const projectFootprint = (
  <footprint name="BP033_MURATA_GRM188R71C104KA01D_0603_REVIEW" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "terminal-a"]}
    />
    <smtpad
      name="2"
      pcbX={projectCopperPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectCopperPadLengthMm}mm`}
      height={`${projectCopperPadWidthMm}mm`}
      portHints={["2", "B", "non-polar", "terminal-b"]}
    />
    <courtyardrect pcbX={0} pcbY={0} width="2.5mm" height="1.3mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp033MurataGrm188r71c104ka01dW5500BypassFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated renderable review input. It is intentionally not wired into a board. */
export function Bp033MurataGrm188r71c104ka01dW5500BypassFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp033MurataGrm188r71c104ka01dW5500BypassFootprintProps = {}): ReactElement {
  return (
    <chip
      name="C_BP033_MURATA_GRM188R71C104KA01D"
      manufacturerPartNumber="GRM188R71C104KA01D"
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

type Candidate = typeof bp033MurataGrm188r71c104ka01dW5500BypassFootprint

function isObject(value: unknown): value is object {
  return value !== null && typeof value === "object"
}

function assertCanonicalDataGraph(
  actual: unknown,
  expected: unknown,
  path: string,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>,
  compareValues: boolean
): void {
  if (!isObject(expected)) {
    if (compareValues && !Object.is(actual, expected)) {
      throw new RangeError(`${path} value drifted`)
    }
    if (isObject(actual)) {
      throw new RangeError(`${path} must remain a primitive`)
    }
    return
  }
  if (!isObject(actual) || Array.isArray(actual) !== Array.isArray(expected)) {
    throw new RangeError(`${path} must match the canonical container type`)
  }
  const expectedPrototype = Array.isArray(expected) ? Array.prototype : Object.prototype
  if (Object.getPrototypeOf(actual) !== expectedPrototype) {
    throw new RangeError(`${path} must use the canonical prototype`)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) {
    throw new RangeError(`${path} must not contain aliases or cycles`)
  }
  actualSeen.add(actual)
  expectedSeen.add(expected)

  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (expectedKeys.some((key) => typeof key === "symbol") || actualKeys.some((key) => typeof key === "symbol")) {
    throw new RangeError(`${path} must not contain symbol keys`)
  }
  const sortedExpectedKeys = expectedKeys.filter((key): key is string => typeof key === "string").sort()
  const sortedActualKeys = actualKeys.filter((key): key is string => typeof key === "string").sort()
  if (Array.isArray(expected)) {
    const isArrayIndex = (key: string) => /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < 4294967295
    if (sortedActualKeys.some((key) => key !== "length" && !isArrayIndex(key))) {
      throw new RangeError(`${path} must contain only indexed data keys`)
    }
    if (
      compareValues &&
      ((actual as readonly unknown[]).length !== (expected as readonly unknown[]).length ||
        sortedActualKeys.length !== sortedExpectedKeys.length ||
        sortedActualKeys.some((key, index) => key !== sortedExpectedKeys[index]))
    ) {
      throw new RangeError(`${path} must contain exactly the canonical array keys`)
    }
  } else if (
    sortedActualKeys.length !== sortedExpectedKeys.length ||
    sortedActualKeys.some((key, index) => key !== sortedExpectedKeys[index])
  ) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }

  const keysToCheck = Array.isArray(expected) && !compareValues ? actualKeys : expectedKeys
  for (const key of keysToCheck) {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      (key !== "length" && !actualDescriptor.enumerable) ||
      (expectedDescriptor !== undefined &&
        (!("value" in expectedDescriptor) ||
          actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
          actualDescriptor.configurable !== expectedDescriptor.configurable ||
          ("writable" in actualDescriptor && actualDescriptor.writable) !==
            ("writable" in expectedDescriptor && expectedDescriptor.writable)))
    ) {
      throw new RangeError(`${path}.${String(key)} must be an equivalent data property`)
    }
    if (expectedDescriptor !== undefined) {
      assertCanonicalDataGraph(
        actualDescriptor.value,
        expectedDescriptor.value,
        `${path}.${String(key)}`,
        actualSeen,
        expectedSeen,
        compareValues
      )
    } else {
      assertSafeDataGraph(actualDescriptor.value, `${path}.${String(key)}`, new WeakSet<object>())
    }
  }
}

function assertSafeDataGraph(
  value: unknown,
  path: string,
  active: WeakSet<object>,
  arrayExtraKeys: readonly string[] = []
): void {
  if (!isObject(value)) return
  if (active.has(value)) throw new RangeError(`${path} contains a cycle`)
  const isArrayValue = Array.isArray(value)
  if (Object.getPrototypeOf(value) !== (isArrayValue ? Array.prototype : Object.prototype)) {
    throw new RangeError(`${path} must use a plain data prototype`)
  }
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
  if (isArrayValue) {
    const expectedIndexKeys = Array.from({ length: (value as readonly unknown[]).length }, (_, index) =>
      String(index)
    ).sort()
    const actualStringKeys = keys.filter((key): key is string => typeof key === "string")
    const actualIndexKeys = actualStringKeys.filter((key) => key !== "length" && !arrayExtraKeys.includes(key)).sort()
    const unexpectedKeys = actualStringKeys.filter(
      (key) => key !== "length" && !arrayExtraKeys.includes(key) && !/^(0|[1-9][0-9]*)$/.test(key)
    )
    if (
      unexpectedKeys.length > 0 ||
      actualIndexKeys.length !== expectedIndexKeys.length ||
      actualIndexKeys.some((key, index) => key !== expectedIndexKeys[index])
    ) {
      throw new RangeError(`${path} must contain exactly its indexed data keys`)
    }
  }
  active.add(value)
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || (key !== "length" && !descriptor.enumerable)) {
      throw new RangeError(`${path}.${String(key)} must be an enumerable data property`)
    }
    assertSafeDataGraph(descriptor.value, `${path}.${String(key)}`, active)
  }
  active.delete(value)
}

function readSafeRenderedElement(value: unknown, index: number): Record<string, unknown> {
  if (!isObject(value) || Array.isArray(value)) {
    throw new RangeError(`rendered W5500 bypass geometry has added or removed elements at index ${index}`)
  }
  const typeDescriptor = Object.getOwnPropertyDescriptor(value, "type")
  if (typeDescriptor === undefined || !("value" in typeDescriptor) || !typeDescriptor.enumerable) {
    throw new RangeError(`rendered W5500 bypass geometry has an unsafe element at index ${index}`)
  }
  const type = typeDescriptor.value
  if (typeof type !== "string" || renderedElementKeys[type] === undefined) {
    throw new RangeError(`rendered W5500 bypass geometry has added or removed elements at index ${index}`)
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new RangeError(`rendered W5500 bypass geometry has an unsafe element at index ${index}`)
  }
  const expectedKeys = renderedElementKeys[type]
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.some((key) => typeof key === "symbol")) {
    throw new RangeError(`rendered W5500 bypass geometry has an unsafe element at index ${index}`)
  }
  const sortedExpectedKeys = [...expectedKeys].sort()
  const sortedActualKeys = actualKeys.filter((key): key is string => typeof key === "string").sort()
  if (
    sortedActualKeys.length !== sortedExpectedKeys.length ||
    sortedActualKeys.some((key, keyIndex) => key !== sortedExpectedKeys[keyIndex])
  ) {
    throw new RangeError(`rendered W5500 bypass geometry has an unexpected element field at index ${index}`)
  }
  const record: Record<string, unknown> = {}
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`rendered W5500 bypass geometry has an unsafe element at index ${index}`)
    }
    record[key] = descriptor.value
  }
  return record
}

function renderedElementErrorForType(type: string): string {
  if (type === "pcb_smtpad") {
    return "rendered W5500 bypass copper pad coordinates or shapes drifted"
  }
  if (type === "pcb_solder_paste") {
    return "rendered W5500 bypass paste coordinates or shapes drifted"
  }
  if (type === "pcb_courtyard_rect") {
    return "rendered W5500 bypass courtyard coordinates or shape drifted"
  }
  return "rendered W5500 bypass geometry has added or removed elements"
}

/** Return exact review failures; an empty result means the denied record remains internally consistent. */
export function validateBp033MurataGrm188r71c104ka01dW5500BypassFootprint(
  candidate: Candidate = bp033MurataGrm188r71c104ka01dW5500BypassFootprint
): readonly string[] {
  try {
    assertCanonicalDataGraph(
      candidate,
      bp033MurataGrm188r71c104ka01dW5500BypassFootprint,
      "BP-033 Murata bypass record",
      new WeakSet<object>(),
      new WeakSet<object>(),
      false
    )
  } catch {
    return ["BP-033 Murata bypass record must remain an exact plain data graph"]
  }
  const errors: string[] = []
  const source = candidate.sources[0]
  const guidance = candidate.manufacturerLandPattern
  const selection = candidate.projectSelection
  if (
    candidate.artifactKind !== "bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint" ||
    candidate.workUnit !== "BP-033" ||
    candidate.manufacturer !== "Murata" ||
    candidate.manufacturerPartNumber !== "GRM188R71C104KA01D" ||
    candidate.role !== "W5500 100 nF supply bypass family" ||
    candidate.geometryAuthority !== "project-review-input-not-manufacturer-cad"
  ) {
    errors.push("exact BP-033 Murata GRM188R71C104KA01D identity drifted")
  }
  if (
    candidate.sourceBinding.canonicalSourcePath !== "packages/scoring-circuit/src/ethernet-support-network.ts" ||
    candidate.sourceBinding.canonicalSourceSha256 !== canonicalSupportSourceSha256 ||
    candidate.sourceBinding.package !== "0603 (1608 metric), paper tape suffix D" ||
    JSON.stringify(candidate.sourceBinding.exactReferences) !== JSON.stringify(affectedReferences)
  ) {
    errors.push("canonical W5500 bypass reference binding drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    source?.authority !== "manufacturer-primary" ||
    source?.id !== "murata-grm188r71c104ka01-reference-sheet" ||
    source?.documentNumber !== "GRM188R71C104KA01-01" ||
    source?.url !== "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GRM188R71C104KA01-01.pdf" ||
    source?.reviewedPages !== "1, 26" ||
    source?.artifactPath !==
      "packages/scoring-circuit/docs/evidence/bp-033/murata-grm188r71c104ka01d-reference-sheet.pdf" ||
    source?.sha256 !== retainedMurataSourceSha256 ||
    source?.role !== "Exact part identity, 1608 package dimensions, and Murata reflow land guidance."
  ) {
    errors.push("exact retained Murata GRM188R71C104KA01 source is required")
  }
  if (
    guidance.sourceId !== "murata-grm188r71c104ka01-reference-sheet" ||
    candidate.package.designation !== "GRM18 (1608M / 0603)" ||
    candidate.package.packageCode !== "18" ||
    candidate.package.lengthMm.nominal !== 1.6 ||
    candidate.package.lengthMm.plus !== 0.1 ||
    candidate.package.lengthMm.minus !== 0.1 ||
    candidate.package.widthMm.nominal !== 0.8 ||
    candidate.package.widthMm.plus !== 0.1 ||
    candidate.package.widthMm.minus !== 0.1 ||
    candidate.package.thicknessMm.nominal !== 0.8 ||
    candidate.package.thicknessMm.plus !== 0.1 ||
    candidate.package.thicknessMm.minus !== 0.1 ||
    candidate.package.terminalLengthMm.minimum !== 0.2 ||
    candidate.package.terminalLengthMm.maximum !== 0.5 ||
    candidate.package.terminalGapMm.minimum !== 0.5 ||
    candidate.electrical.nominalCapacitanceNf !== 100 ||
    candidate.electrical.tolerancePercent !== 10 ||
    candidate.electrical.dielectric !== "X7R (EIA)" ||
    candidate.electrical.ratedVoltageVdc !== 16 ||
    candidate.electrical.operatingTemperatureC.minimum !== -55 ||
    candidate.electrical.operatingTemperatureC.maximum !== 125
  ) {
    errors.push("Murata GRM18 100 nF package or electrical identity drifted")
  }
  if (
    guidance.reviewedPage !== 26 ||
    guidance.sourceTable !== "Table 2 Reflow Soldering Method" ||
    guidance.chipDimensionRow !== "GRM 18, 1.6 x 0.8 mm (within +/-0.10)" ||
    guidance.innerGapMm.minimum !== 0.6 ||
    guidance.innerGapMm.maximum !== 0.8 ||
    guidance.padLengthMm.minimum !== 0.6 ||
    guidance.padLengthMm.maximum !== 0.7 ||
    guidance.padWidthMm.minimum !== 0.6 ||
    guidance.padWidthMm.maximum !== 0.8 ||
    guidance.note !==
      "Murata requires confirmation on the actual set and PCB. This table is guidance, not finished manufacturer CAD." ||
    selection.state !== "project-review-input" ||
    selection.authority !== "deny" ||
    selection.manufacturerParameterSelectionMm.aInnerGap !== projectCopperPadGapMm ||
    selection.manufacturerParameterSelectionMm.bPadLength !== projectCopperPadLengthMm ||
    selection.manufacturerParameterSelectionMm.cPadWidth !== projectCopperPadWidthMm ||
    selection.copperPad.lengthMm !== projectCopperPadLengthMm ||
    selection.copperPad.widthMm !== projectCopperPadWidthMm ||
    selection.derivedCopperPadGapMm !== projectCopperPadGapMm ||
    selection.derivedCopperPadCenterXMm !== projectCopperPadCenterXMm ||
    selection.solderMask.status !== "project-review-input" ||
    selection.solderMask.openingLengthMm !== 0.75 ||
    selection.solderMask.openingWidthMm !== 0.8 ||
    selection.solderMask.marginPerEdgeMm !== projectSolderMaskMarginMm ||
    selection.paste.status !== "project-review-input" ||
    selection.paste.openingLengthMm !== 0.55 ||
    selection.paste.openingWidthMm !== 0.6 ||
    selection.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    selection.courtyard.status !== "project-review-input" ||
    selection.courtyard.lengthMm !== 2.5 ||
    selection.courtyard.widthMm !== 1.3 ||
    selection.courtyard.minimumClearanceMm !== 0.25 ||
    JSON.stringify(candidate.terminals) !==
      JSON.stringify([
        { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectCopperPadCenterXMm, yMm: 0 },
        { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectCopperPadCenterXMm, yMm: 0 }
      ]) ||
    JSON.stringify(candidate.renderedGeometry) !== JSON.stringify(renderedGeometryContract)
  ) {
    errors.push("Murata reflow guidance or derived review geometry drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.manufacturerCad.disposition !== "not-acquired-no-substitute" ||
    candidate.boardIntegration !== false ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
    candidate.artwork.sha256 !== renderedGeometrySha256 ||
    candidate.artwork.authority !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.accepted !== false
  ) {
    errors.push("manufacturer CAD, board integration, fabrication, and release must remain fail-closed")
  }
  return errors
}

/** Rejects added, removed, or drifted copper, paste, and courtyard render geometry. */
export function validateBp033MurataGrm188r71c104ka01dW5500BypassRenderedGeometry(
  elements: readonly unknown[]
): readonly string[] {
  try {
    assertSafeDataGraph(elements, "rendered W5500 bypass inventory", new WeakSet<object>(), [
      "_internal_store",
      "editCount"
    ])
    if (!Array.isArray(elements) || Object.getPrototypeOf(elements) !== Array.prototype) {
      throw new RangeError("rendered W5500 bypass geometry has added or removed elements")
    }
    const elementKeys = Reflect.ownKeys(elements)
    const expectedArrayKeys = [
      ...Array.from({ length: renderedElementTypeSequence.length }, (_, index) => String(index)),
      "length",
      "_internal_store",
      "editCount"
    ].sort()
    const actualArrayKeys = elementKeys.filter((key): key is string => typeof key === "string").sort()
    if (
      actualArrayKeys.length !== expectedArrayKeys.length ||
      actualArrayKeys.some((key, index) => key !== expectedArrayKeys[index])
    ) {
      throw new RangeError("rendered W5500 bypass geometry has added or removed elements")
    }
    for (const key of ["_internal_store", "editCount"] as const) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(elements, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(renderedInventoryMetadataContract, key)
      if (actualDescriptor === undefined || !("value" in actualDescriptor) || !actualDescriptor.enumerable) {
        throw new RangeError("rendered W5500 bypass inventory metadata is unsafe")
      }
      assertCanonicalDataGraph(
        actualDescriptor.value,
        expectedDescriptor!.value,
        `rendered W5500 bypass inventory metadata.${key}`,
        new WeakSet<object>(),
        new WeakSet<object>(),
        true
      )
    }
    const records: Record<string, unknown>[] = []
    for (let index = 0; index < renderedElementTypeSequence.length; index += 1) {
      const expectedType = renderedElementTypeSequence[index]
      const candidateElement = elements[index]
      if (isObject(candidateElement) && !Array.isArray(candidateElement)) {
        const typeDescriptor = Object.getOwnPropertyDescriptor(candidateElement, "type")
        if (
          typeDescriptor !== undefined &&
          "value" in typeDescriptor &&
          typeof typeDescriptor.value === "string" &&
          expectedType === "pcb_courtyard_rect" &&
          typeDescriptor.value.startsWith("pcb_courtyard_") &&
          renderedElementKeys[typeDescriptor.value] === undefined
        ) {
          throw new RangeError(renderedElementErrorForType(expectedType))
        }
      }
      const record = readSafeRenderedElement(elements[index], index)
      const actualType = record.type
      if (actualType !== expectedType) {
        throw new RangeError(renderedElementErrorForType(expectedType))
      }
      try {
        assertCanonicalDataGraph(
          record,
          renderedElementValueContract[index],
          `rendered W5500 bypass element ${index}`,
          new WeakSet<object>(),
          new WeakSet<object>(),
          true
        )
      } catch {
        throw new RangeError(renderedElementErrorForType(expectedType))
      }
      records.push(record)
    }
    return []
  } catch (error) {
    return [error instanceof Error ? error.message : "rendered W5500 bypass geometry is unsafe"]
  }
}
