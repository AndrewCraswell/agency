import { Fragment, type ReactElement } from "react"

const manufacturer = "Espressif Systems"
const manufacturerPartNumber = "ESP32-S3-WROOM-1U-N16R2"
const sourcePath = "packages/scoring-circuit/src/bench-prototype-esp32-allocation.ts"

type Point = { readonly xMm: number; readonly yMm: number }
type CopperPad = Point & {
  readonly pad: number
  readonly role: "module-terminal"
  readonly widthMm: number
  readonly heightMm: number
}
type ThermalVia = Point & {
  readonly role: "exposed-ground-pad-via"
  readonly copperWidthMm: number
  readonly copperHeightMm: number
  readonly drillDiameterMm: number
}

function roundMm(value: number): number {
  return Math.round(value * 1000) / 1000
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-032 candidate geometry cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 candidate geometry may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

const officialSources = [
  {
    id: "espressif-esp32-s3-wroom-1u-datasheet-v1-8",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1 & WROOM-1U Datasheet v1.8",
    url: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
    reviewedPages: [3, 10, 42, 43, 45, 46],
    artifactPath:
      "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf",
    sha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435",
    role: "Exact WROOM-1U-N16R2 family selection, module perimeter, pin-one orientation, external-antenna connector, thermal-pad geometry, and recommended land-pattern drawing."
  },
  {
    id: "espressif-esp32-s3-wroom-1u-pcb-footprint-dxf",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1U PCB Footprint.dxf",
    url: "https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1U%20PCB%20Footprint.dxf",
    reviewedLayers: ["PART_TOP_COPPER_01", "SOLDERMASKTOP_P", "PADS_TOP"],
    artifactPath:
      "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf",
    sha256: "986C1AB9B0956A0B824BE1E51AA10C006F2A1554438DC9DC2459F14AF3AED0D0",
    role: "Exact Espressif CAD source retained for the 40 perimeter lands, nine exposed-ground-pad via lands, and top solder-mask openings."
  },
  {
    id: "espressif-esp32-s3-wroom-1u-step",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1U 3D Model.STEP",
    url: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1U%203D%20Model.STEP",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-3d-model-official.step",
    sha256: "7BE82BDAFECE2891B297546EB0643FF254E3D8161074EBDC972E0D78E79A4BDB",
    role: "Exact Espressif mechanical reference for the WROOM-1U body and integrated external-antenna connector envelope; not a released board footprint."
  }
] as const

const sidePadYs = Array.from({ length: 14 }, (_, index) => roundMm(8.255 - index * 1.27))
const bottomPadXs = Array.from({ length: 12 }, (_, index) => roundMm(-6.985 + index * 1.27))
const thermalViaXs = [-2.9, -1.5, -0.1] as const
const thermalViaYs = [-0.9, 0.5, 1.9] as const

const leftPads: readonly CopperPad[] = sidePadYs.map((yMm, index) => ({
  pad: index + 1,
  role: "module-terminal",
  xMm: -8.75,
  yMm,
  widthMm: 1.5,
  heightMm: 0.9
}))

const bottomPads: readonly CopperPad[] = bottomPadXs.map((xMm, index) => ({
  pad: index + 15,
  role: "module-terminal",
  xMm,
  yMm: -9.5,
  widthMm: 0.9,
  heightMm: 1.5
}))

const rightPads: readonly CopperPad[] = sidePadYs.map((_, index) => ({
  pad: index + 27,
  role: "module-terminal",
  xMm: 8.75,
  yMm: roundMm(-8.255 + index * 1.27),
  widthMm: 1.5,
  heightMm: 0.9
}))

const perimeterPads = [...leftPads, ...bottomPads, ...rightPads]
const thermalVias: readonly ThermalVia[] = thermalViaYs.flatMap((yMm) =>
  thermalViaXs.map((xMm) => ({
    role: "exposed-ground-pad-via" as const,
    xMm,
    yMm,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  }))
)

const geometry = {
  artifactKind: "bp032-esp32-s3-wroom-1u-candidate-footprint",
  workUnit: "BP-032",
  manufacturer,
  manufacturerPartNumber,
  package: {
    family: "ESP32-S3-WROOM-1U",
    variant: "N16R2",
    flash: "16 MB Quad SPI",
    psram: "2 MB Quad SPI",
    bodyEnvelopeMm: { widthMm: 18, lengthMm: 19.2, heightMm: 3.2 },
    bodyToleranceMm: { widthPlusMinusMm: 0.2, lengthPlusMinusMm: 0.2, heightPlusMinusMm: 0.15 },
    terminalCount: 40,
    exposedGroundPad: true
  },
  upstreamSelection: {
    sourcePath,
    sourceSha256: "F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B",
    sourceContract: "BP-121 exact module-pad allocation",
    moduleMpn: manufacturerPartNumber,
    disposition: "fixed-exact-selection"
  },
  officialSources,
  manufacturerCad: {
    state: "retained-exact-official-cad",
    artifact: "espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf",
    disposition: "candidate-geometry-only-no-fabrication-release",
    copper: "manufacturer-CAD-and-datasheet",
    solderMask: "manufacturer-CAD-top-layer",
    paste: "not-published-by-Espressif",
    courtyard: "not-published-by-Espressif",
    note: "The retained DXF includes one non-footprint legend swatch; candidate counts exclude that graphic."
  },
  landPattern: {
    coordinateOrigin: "nominal module body center; datasheet top view with pin 1 at upper-left",
    bodyPerimeter: {
      widthMm: 18,
      lengthMm: 19.2,
      source: "Espressif Datasheet v1.8 Figure 10-2"
    },
    perimeterCopper: {
      padCount: perimeterPads.length,
      pads: perimeterPads,
      sideRowCenterXMm: 8.75,
      sideRowPitchMm: 1.27,
      sideRowSpanMm: 16.51,
      bottomRowCenterYMm: -9.5,
      bottomRowPitchMm: 1.27,
      bottomRowSpanMm: 13.97,
      source: "Espressif Datasheet v1.8 Figure 11-2 and official DXF PART_TOP_COPPER_01"
    },
    exposedGroundPad: {
      role: "EPAD pin 41 to APP_GND",
      arrayCenterMm: { xMm: -1.5, yMm: 0.5 },
      copperEnvelopeMm: { widthMm: 3.7, lengthMm: 3.7 },
      viaCount: thermalVias.length,
      viaPitchMm: 1.4,
      vias: thermalVias,
      viaCopperSquareMm: 0.9,
      finishedDrillDiameterMm: 0.5,
      source: "Espressif Datasheet v1.8 Figure 10-2, Figure 11-2, and official DXF PART_TOP_COPPER_01"
    },
    solderMask: {
      sourceLayer: "SOLDERMASKTOP_P",
      perimeterOpening: { widthMm: 1.5, heightMm: 0.9, count: 40 },
      exposedGroundPadViaOpening: { widthMm: 0.9, heightMm: 0.9, count: 9 },
      expansionRule: "not-stated; retained DXF openings are recorded exactly",
      status: "manufacturer-CAD-measured-not-fabrication-approved"
    },
    paste: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-stencil-apertures-from-copper-or-mask"
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-assembly-courtyard-from-body-envelope"
    }
  },
  orientation: {
    pinOne: { pad: 1, xMm: -8.75, yMm: 8.255, source: "Espressif Datasheet v1.8 Figure 3-1 and Figure 11-2" },
    nominalBoardRotationDegrees: 0,
    state: "pending-independent-overlay",
    note: "The nominal top-view orientation places pad 1 at the upper-left and the integrated connector at the upper-right. Rotation, assembly datum, module marking, and pin-one silkscreen still require an independent CAD overlay."
  },
  externalAntenna: {
    antennaMode: "external-antenna-connector-integrated",
    pcbAntennaKeepout: "not-applicable-to-WROOM-1U",
    connector: {
      generation: "first-generation",
      compatibleMates: ["U.FL series", "MHF I", "AMC"],
      shellTopViewMm: { widthMm: 2.6, lengthMm: 2.6, toleranceMm: 0.15 },
      moduleConnectorEnvelopeMm: { widthMm: 3.1, heightMm: 3.0 },
      source: "Espressif Datasheet v1.8 Figures 10-2 and 10-3"
    },
    hostBoardImplications: {
      rfTrace: "no host-board PCB-antenna trace; connector/cable path remains external",
      copperClearance: "required around the connector, cable exit, and installed antenna",
      dimension: "not-published-in-this-datasheet",
      enclosureAndAntennaReview: "required before placement, routing, or fabrication authority"
    },
    state: "pending-external-antenna-cable-enclosure-review"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

export const benchPrototypeBp032Esp32Wroom1uFootprintGeometry = deepFreeze(geometry)

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
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || !actualKeys.every((key) => expectedKeys.includes(key))) return false
  return actualKeys.every((key) =>
    sameDataGraph(Reflect.get(actual, key), Reflect.get(expected, key), seenActual, seenExpected)
  )
}

export function validateBenchPrototypeBp032Esp32Wroom1uFootprint(value: unknown): true {
  if (!sameDataGraph(value, geometry, new WeakSet<object>(), new WeakSet<object>())) {
    throw new RangeError("BP-032 WROOM-1U candidate geometry drifted from the reviewed exact source")
  }
  if (
    geometry.manufacturerPartNumber !== manufacturerPartNumber ||
    geometry.upstreamSelection.moduleMpn !== manufacturerPartNumber ||
    geometry.upstreamSelection.sourceSha256.length !== 64 ||
    geometry.landPattern.perimeterCopper.padCount !== 40 ||
    geometry.landPattern.perimeterCopper.pads.length !== 40 ||
    new Set(geometry.landPattern.perimeterCopper.pads.map((pad) => pad.pad)).size !== 40 ||
    geometry.landPattern.exposedGroundPad.viaCount !== 9 ||
    geometry.landPattern.exposedGroundPad.vias.length !== 9 ||
    geometry.landPattern.solderMask.perimeterOpening.count !== 40 ||
    geometry.landPattern.solderMask.exposedGroundPadViaOpening.count !== 9 ||
    geometry.landPattern.paste.status !== "not-published" ||
    geometry.landPattern.courtyard.status !== "not-published" ||
    geometry.fabricationAuthority !== "deny" ||
    geometry.accepted
  ) {
    throw new RangeError("BP-032 candidate must remain exact, bounded, and fabrication-denied")
  }
  return true
}

const candidateFootprint = (
  <footprint name="BP032_ESP32_S3_WROOM_1U_N16R2_CANDIDATE" originalLayer="top">
    {perimeterPads.map((pad) => (
      <Fragment key={`pad-${pad.pad}`}>
        <smtpad
          name={String(pad.pad)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          // The official DXF openings equal the retained copper dimensions. This preserves source geometry only; it is not fabricator approval.
          solderMaskMargin="0mm"
          // Espressif does not publish a stencil aperture. This negative margin suppresses tscircuit's default paste artifact; it is not a stencil recommendation.
          solderPasteMargin="-1mm"
          portHints={[String(pad.pad), pad.pad === 1 ? "pin1" : "module-pad"]}
        />
      </Fragment>
    ))}
    {thermalVias.map((via, index) => (
      <Fragment key={`ep-via-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={via.xMm}
          pcbY={via.yMm}
          holeDiameter={`${via.drillDiameterMm}mm`}
          rectPadWidth={`${via.copperWidthMm}mm`}
          rectPadHeight={`${via.copperHeightMm}mm`}
          rectBorderRadius="0mm"
          solderMaskMargin="0mm"
          portHints={["41", "GND_EP", "thermal-via"]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface BenchPrototypeBp032Esp32Wroom1uFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-032 candidate renderer. It is deliberately not imported by a board circuit. */
export function BenchPrototypeBp032Esp32Wroom1uFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032Esp32Wroom1uFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_ESP32_S3_WROOM_1U_N16R2"
      manufacturerPartNumber={manufacturerPartNumber}
      footprint={candidateFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeBp032Esp32Wroom1uFootprint
