import { Fragment, type ReactElement } from "react"

type PinDefinition = {
  readonly number: number
  readonly name: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

type ThermalVia = {
  readonly xMm: number
  readonly yMm: number
  readonly drillDiameterMm: number
}

type OfficialSource = {
  readonly id: string
  readonly authority: "manufacturer-primary"
  readonly documentNumber: string
  readonly url: string
  readonly reviewedPages: readonly number[]
  readonly artifactPath: string
  readonly sha256: string
  readonly role: string
}

const upstreamSourcePath = "packages/scoring-circuit/src/bench-prototype-reset-watchdog.ts"
const upstreamSourceSha256 = "0F10F1E308C0B3760C38A5A30405D727F1115BFFAC1C3F141D8EAF8789DD7E23"

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

const tps3431Source: OfficialSource = {
  id: "ti-tps3431-snvSB66a",
  authority: "manufacturer-primary",
  documentNumber: "TPS3431 Standard Programmable Watchdog Timer with Enable datasheet (Rev. A)",
  url: "https://www.ti.com/lit/ds/symlink/tps3431.pdf",
  reviewedPages: [3, 28, 29, 30],
  artifactPath: "docs/evidence/bp-032/ti-tps3431.pdf",
  sha256: "99BF5DBFFFE06E8F85D9A86CFB777A0151E85B4A103033BC025F4897A0BDC6F3",
  role: "Exact TPS3431SDRBR identity, DRB pin map, VSON outline, manufacturer land-pattern, solder-mask options, and stencil example."
}

const tps3890Source: OfficialSource = {
  id: "ti-tps3890-slvSD65a",
  authority: "manufacturer-primary",
  documentNumber: "TPS3890 Low Quiescent Current, 1% Accurate Supervisor with Programmable Delay datasheet (Rev. A)",
  url: "https://www.ti.com/lit/ds/symlink/tps3890.pdf",
  reviewedPages: [3, 24, 25, 26],
  artifactPath: "docs/evidence/bp-032/ti-tps3890.pdf",
  sha256: "EE79599730E7606BA9718D9820B411020E3DCD9FF7D44572F8EE63FEAD15B9D0",
  role: "Exact TPS389033DSER identity, DSE pin map, WSON outline, manufacturer land-pattern, solder-mask options, and stencil example."
}

const tps3431Pins: readonly PinDefinition[] = [
  { number: 1, name: "VDD", xMm: -1.1, yMm: 0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 2, name: "CWD", xMm: -1.1, yMm: 0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 3, name: "EN", xMm: -1.1, yMm: -0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 4, name: "GND", xMm: -1.1, yMm: -0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 5, name: "SET1", xMm: 1.1, yMm: -0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 6, name: "WDI", xMm: 1.1, yMm: -0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 7, name: "WDO", xMm: 1.1, yMm: 0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 8, name: "ENOUT", xMm: 1.1, yMm: 0.975, widthMm: 0.6, heightMm: 0.31 }
] as const

const tps3431ThermalVias: readonly ThermalVia[] = [
  { xMm: 0, yMm: 0.625, drillDiameterMm: 0.2 },
  { xMm: -0.625, yMm: 0, drillDiameterMm: 0.2 },
  { xMm: 0.625, yMm: 0, drillDiameterMm: 0.2 },
  { xMm: 0, yMm: -0.625, drillDiameterMm: 0.2 }
] as const

const tps3890Pins: readonly PinDefinition[] = [
  { number: 1, name: "SENSE", xMm: -0.6, yMm: 0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 2, name: "GND", xMm: -0.6, yMm: 0, widthMm: 0.7, heightMm: 0.25 },
  { number: 3, name: "MR", xMm: -0.6, yMm: -0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 4, name: "VDD", xMm: 0.6, yMm: -0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 5, name: "CT", xMm: 0.6, yMm: 0, widthMm: 0.7, heightMm: 0.25 },
  { number: 6, name: "RESET", xMm: 0.6, yMm: 0.5, widthMm: 0.7, heightMm: 0.25 }
] as const

function manufacturerCadNotRetained() {
  return {
    state: "not-retained-official-cad",
    officialCadArtifact: null,
    disposition: "datasheet-only-candidate-no-fabrication-release",
    copper: "manufacturer-datasheet-land-pattern",
    solderMask: "manufacturer-datasheet-example-options",
    paste: "manufacturer-datasheet-stencil-example",
    courtyard: "not-published-by-TI",
    note: "The retained TI artifacts are datasheet PDFs, not TI CAD archives; no footprint-library, mask, paste, or courtyard file is substituted."
  } as const
}

const tps3431Geometry = {
  artifactKind: "bp032-ti-tps3431sdrbr-candidate-footprint",
  workUnit: "BP-032",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPS3431SDRBR",
  package: {
    family: "VSON-8",
    packageDrawing: "DRB0008A",
    bodyNominalMm: { widthMm: 3, lengthMm: 3, heightMaxMm: 1 },
    bodyLimitsMm: { widthMm: { min: 2.9, max: 3.1 }, lengthMm: { min: 2.9, max: 3.1 } },
    pinCount: 8,
    exposedThermalPad: true,
    thermalPadNet: "GND"
  },
  pinMap: tps3431Pins.map((pin) => ({ ...pin })),
  officialSources: [tps3431Source],
  manufacturerCad: manufacturerCadNotRetained(),
  landPattern: {
    coordinateOrigin: "nominal package center; TI top view with pin 1 at upper-left",
    perimeterCopper: {
      padCount: 8,
      padDimensionsMm: { lengthMm: 0.6, widthMm: 0.31 },
      cornerRadiusTypMm: 0.05,
      sideRowPitchMm: 0.65,
      sideRowSpanMm: 1.95,
      sideRowCentersXMm: [-1.1, 1.1],
      pads: tps3431Pins.map((pin) => ({ ...pin })),
      source: "TI TPS3431 PDF page 29, DRB0008A example board layout"
    },
    exposedThermalPad: {
      net: "GND",
      copperEnvelopeMm: { widthMm: 1.5, lengthMm: 1.75 },
      viaCount: 4,
      viaLocations: tps3431ThermalVias.map((via) => ({ ...via })),
      viaNote: "TI marks the four 0.2 mm vias optional depending on application.",
      source: "TI TPS3431 PDF page 29, DRB0008A example board layout"
    },
    solderMask: {
      source: "TI TPS3431 PDF page 29 solder-mask details",
      preferredDefinition: "NSMD",
      nsmdOpeningExpansionMaxMm: 0.07,
      smdOpeningOverlapMinMm: 0.07,
      appliesTo: "exposed metal example; verify pad-by-pad mask rules with fabricator"
    },
    paste: {
      source: "TI TPS3431 PDF page 30, DRB0008A example stencil design",
      perimeterApertureMm: { lengthMm: 0.6, widthMm: 0.31, count: 8 },
      thermalPad: {
        stencilThicknessMm: 0.125,
        printedCoveragePercent: 84,
        drawnEnvelopeMm: { widthMm: 1.34, lengthMm: 1.55 },
        geometryStatus: "coverage-and-envelope-published; aperture segmentation not transcribed"
      },
      disposition: "manufacturer-example-only-review-data-not-stencil-release"
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-courtyard-from-package-outline"
    }
  },
  orientation: {
    pinOne: { number: 1, xMm: -1.1, yMm: 0.975, marker: "TI package pin 1 index area" },
    nominalBoardRotationDegrees: 0,
    state: "pending-independent-overlay"
  },
  placementImplications: {
    rfAntenna: "not-applicable-to-reset-watchdog-package",
    keepout: "no RF keepout is published or implied; preserve local supply, timing, reset, and ground-routing review",
    thermal: "exposed GND pad must be soldered for the package mechanical and thermal guidance"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const tps3890Geometry = {
  artifactKind: "bp032-ti-tps389033dser-candidate-footprint",
  workUnit: "BP-032",
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "TPS389033DSER",
  package: {
    family: "WSON-6",
    packageDrawing: "DSE0006A",
    bodyNominalMm: { widthMm: 1.5, lengthMm: 1.5, heightMaxMm: 0.8 },
    bodyLimitsMm: { widthMm: { min: 1.45, max: 1.55 }, lengthMm: { min: 1.45, max: 1.55 } },
    pinCount: 6,
    exposedThermalPad: false,
    thermalPadNet: null
  },
  pinMap: tps3890Pins.map((pin) => ({ ...pin })),
  officialSources: [tps3890Source],
  manufacturerCad: manufacturerCadNotRetained(),
  landPattern: {
    coordinateOrigin: "nominal package center; TI top view with pin 1 at upper-left",
    perimeterCopper: {
      padCount: 6,
      padDimensionsMm: { lengthMm: 0.7, widthMm: 0.25 },
      cornerRadiusTypMm: 0.05,
      sideRowPitchMm: 0.5,
      sideRowSpanMm: 1,
      sideRowCentersXMm: [-0.6, 0.6],
      pads: tps3890Pins.map((pin) => ({ ...pin })),
      source: "TI TPS3890 PDF page 25, DSE0006A example board layout"
    },
    exposedThermalPad: null,
    solderMask: {
      source: "TI TPS3890 PDF page 25 solder-mask details",
      pads1to3: { definition: "SMD", openingOverlapMinMm: 0.05 },
      pads4to6: { definition: "NSMD preferred", openingExpansionMaxMm: 0.05 }
    },
    paste: {
      source: "TI TPS3890 PDF page 26, DSE0006A example stencil design",
      stencilThicknessMm: 0.125,
      apertureMm: { lengthMm: 0.7, widthMm: 0.25, count: 6 },
      cornerRadiusTypMm: 0.05,
      disposition: "manufacturer-example-only-review-data-not-stencil-release"
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-courtyard-from-package-outline"
    }
  },
  orientation: {
    pinOne: { number: 1, xMm: -0.6, yMm: 0.5, marker: "TI package pin 1 index area" },
    nominalBoardRotationDegrees: 0,
    state: "pending-independent-overlay"
  },
  placementImplications: {
    rfAntenna: "not-applicable-to-reset-supervisor-package",
    keepout:
      "no RF keepout is published or implied; preserve local supply, sense, reset, manual-reset, and timing-routing review",
    thermal: "no exposed thermal pad is shown in TI DSE0006A"
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

export const benchPrototypeBp032TiResetWatchdogFootprintGeometry = deepFreeze({
  artifactKind: "bp032-ti-reset-watchdog-candidate-footprints",
  workUnit: "BP-032",
  upstreamSelection: {
    sourcePath: upstreamSourcePath,
    sourceSha256: upstreamSourceSha256,
    sourceContract: "BP-123 exact reset/watchdog part selection",
    parts: [
      { reference: "U_STM_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER" },
      { reference: "U_STM_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR" },
      { reference: "U_ESP_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER" },
      { reference: "U_ESP_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR" }
    ]
  },
  candidates: {
    TPS3431SDRBR: tps3431Geometry,
    TPS389033DSER: tps3890Geometry
  }
})

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

export function validateBenchPrototypeBp032TiResetWatchdogFootprints(value: unknown): true {
  if (
    !sameDataGraph(
      value,
      benchPrototypeBp032TiResetWatchdogFootprintGeometry,
      new WeakSet<object>(),
      new WeakSet<object>()
    )
  ) {
    throw new RangeError("BP-032 TI reset/watchdog candidate geometry drifted from the reviewed exact source")
  }
  const candidates = benchPrototypeBp032TiResetWatchdogFootprintGeometry.candidates
  if (
    benchPrototypeBp032TiResetWatchdogFootprintGeometry.upstreamSelection.sourceSha256.length !== 64 ||
    benchPrototypeBp032TiResetWatchdogFootprintGeometry.upstreamSelection.parts.length !== 4 ||
    benchPrototypeBp032TiResetWatchdogFootprintGeometry.upstreamSelection.parts.filter(
      (part) => part.manufacturerPartNumber === "TPS389033DSER"
    ).length !== 2 ||
    benchPrototypeBp032TiResetWatchdogFootprintGeometry.upstreamSelection.parts.filter(
      (part) => part.manufacturerPartNumber === "TPS3431SDRBR"
    ).length !== 2 ||
    candidates.TPS3431SDRBR.package.pinCount !== candidates.TPS3431SDRBR.pinMap.length ||
    candidates.TPS389033DSER.package.pinCount !== candidates.TPS389033DSER.pinMap.length ||
    candidates.TPS3431SDRBR.landPattern.perimeterCopper.padCount !== 8 ||
    candidates.TPS389033DSER.landPattern.perimeterCopper.padCount !== 6 ||
    candidates.TPS3431SDRBR.landPattern.exposedThermalPad.viaCount !== 4 ||
    candidates.TPS389033DSER.landPattern.exposedThermalPad !== null ||
    candidates.TPS3431SDRBR.manufacturerCad.officialCadArtifact !== null ||
    candidates.TPS389033DSER.manufacturerCad.officialCadArtifact !== null ||
    candidates.TPS3431SDRBR.landPattern.courtyard.status !== "not-published" ||
    candidates.TPS389033DSER.landPattern.courtyard.status !== "not-published" ||
    candidates.TPS3431SDRBR.fabricationAuthority !== "deny" ||
    candidates.TPS389033DSER.fabricationAuthority !== "deny" ||
    candidates.TPS3431SDRBR.accepted ||
    candidates.TPS389033DSER.accepted
  ) {
    throw new RangeError("BP-032 TI candidates must remain exact, bounded, and fabrication-denied")
  }
  return true
}

const tps3431Footprint = (
  <footprint name="BP032_TI_TPS3431SDRBR_CANDIDATE" originalLayer="top">
    {tps3431Pins.map((pin) => (
      <Fragment key={`tps3431-pad-${pin.number}`}>
        <smtpad
          name={String(pin.number)}
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          shape="rect"
          width={`${pin.widthMm}mm`}
          height={`${pin.heightMm}mm`}
          portHints={[String(pin.number), pin.name]}
        />
      </Fragment>
    ))}
    <smtpad
      name="EP"
      pcbX={0}
      pcbY={0}
      shape="rect"
      width="1.5mm"
      height="1.75mm"
      // TI publishes a split thermal-pad stencil example, not a single aperture. Suppress the inferred default paste artifact.
      solderPasteMargin="-1mm"
      portHints={["EP", "GND", "thermal-pad"]}
    />
    {tps3431ThermalVias.map((via, index) => (
      <Fragment key={`tps3431-via-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={via.xMm}
          pcbY={via.yMm}
          holeDiameter={`${via.drillDiameterMm}mm`}
          rectPadWidth="0.23mm"
          rectPadHeight="0.23mm"
          rectBorderRadius="0mm"
          portHints={["EP", "GND", "thermal-via"]}
        />
      </Fragment>
    ))}
  </footprint>
)

const tps3890Footprint = (
  <footprint name="BP032_TI_TPS389033DSER_CANDIDATE" originalLayer="top">
    {tps3890Pins.map((pin) => (
      <Fragment key={`tps3890-pad-${pin.number}`}>
        <smtpad
          name={String(pin.number)}
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          shape="rect"
          width={`${pin.widthMm}mm`}
          height={`${pin.heightMm}mm`}
          portHints={[String(pin.number), pin.name]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface BenchPrototypeBp032TiResetWatchdogFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-032 review renderers; neither is imported by a board circuit. */
export function BenchPrototypeBp032TiTps3431sdrbrFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032TiResetWatchdogFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_TI_TPS3431SDRBR"
      manufacturerPartNumber="TPS3431SDRBR"
      footprint={tps3431Footprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function BenchPrototypeBp032TiTps389033dserFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032TiResetWatchdogFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_TI_TPS389033DSER"
      manufacturerPartNumber="TPS389033DSER"
      footprint={tps3890Footprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}
