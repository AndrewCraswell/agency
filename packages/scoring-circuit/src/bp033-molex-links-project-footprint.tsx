import { Fragment, type ReactElement } from "react"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

const headerMpn = "39-28-1023"
const housingMpn = "39-01-2020"
const terminalMpn = "39-00-0039"
const headerDrawingPath = "docs/evidence/bp-033/molex-39281023-product-page.pdf"
const headerDrawingSha256 = "BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691"
const housingDrawingPath = "docs/evidence/bp-033/molex-5557-39-01-2020-housing-drawing.pdf"
const housingDrawingSha256 = "BE541BD8F81F3E5FBE001F04EA344E6FC373B98154CE94561590D0F17821DCE1"
const terminalProductPagePath = "docs/evidence/bp-033/molex-5556-39-00-0039-product-page.pdf"
const terminalProductPageSha256 = "C6BD24AC80092892161422F2953C76AD26BB0A429B3AD2FA71BBEF29896E081A"
const renderedArtworkPath = "docs/evidence/bp-033/molex-links-rendered-artwork.sha256"
const renderedArtworkSha256 = "CEC9ABB31F10EA6703138506E62B8AE51D708A6B63D66B68ED88E2554AAE29FD"

const holeDiameterMm = 1.4
const candidatePadDiameterMm = 2.4
const contactPitchMm = 4.2

type LinkReference = "J_LINK_INPUT" | "J_LINK_APPLICATION" | "J_LINK_DISPLAY" | "J_LINK_SCORING"

type LinkPair = {
  readonly reference: LinkReference
  readonly pin1Net: string
  readonly pin2Net: string
  readonly pin1Role: "source"
  readonly pin2Role: "load"
}

const canonicalMeasurementLinks = defaultBenchPrototypePowerInputs.measurementLinks

const linkPairs: readonly LinkPair[] = [
  {
    reference: canonicalMeasurementLinks.input.label as LinkReference,
    pin1Net: canonicalMeasurementLinks.input.pin1Net,
    pin2Net: canonicalMeasurementLinks.input.pin2Net,
    pin1Role: "source",
    pin2Role: "load"
  },
  {
    reference: canonicalMeasurementLinks.application.label as LinkReference,
    pin1Net: canonicalMeasurementLinks.application.pin1Net,
    pin2Net: canonicalMeasurementLinks.application.pin2Net,
    pin1Role: "source",
    pin2Role: "load"
  },
  {
    reference: canonicalMeasurementLinks.display.label as LinkReference,
    pin1Net: canonicalMeasurementLinks.display.pin1Net,
    pin2Net: canonicalMeasurementLinks.display.pin2Net,
    pin1Role: "source",
    pin2Role: "load"
  },
  {
    reference: canonicalMeasurementLinks.isolatedScoring.label as LinkReference,
    pin1Net: canonicalMeasurementLinks.isolatedScoring.pin1Net,
    pin2Net: canonicalMeasurementLinks.isolatedScoring.pin2Net,
    pin1Role: "source",
    pin2Role: "load"
  }
] as const

const pins = [
  { number: 1, xMm: 0, yMm: contactPitchMm / 2, circuit: 1 as const, marker: "Molex circuit-1 rib datum" },
  { number: 2, xMm: 0, yMm: -contactPitchMm / 2, circuit: 2 as const, marker: "Molex circuit-2 position" }
] as const

const expectedSources = [
  {
    authority: "manufacturer-primary-document-mirror",
    artifactPath: headerDrawingPath,
    document: "Molex SD-5566-002 Mini-Fit Jr vertical header assemblies without pegs",
    reviewedPages: "2-6 of retained 9-page Molex product-page export; drawing sheet 1 of 5",
    sourceUrl: "https://www.molex.com/pdm_docs/sd/039281023_sd.pdf",
    acquisitionUrl: "https://images.100y.com.tw/pdf_file/10-molex-39281023.pdf",
    sha256: headerDrawingSha256,
    claims:
      "Exact 39-28-1023 / 5566-02A identity, 2-circuit vertical header, component-side circuit-1 rib, 4.20 mm contact pitch, 1.40 mm recommended holes, 3.50 mm tails, and no-peg header drawing."
  },
  {
    authority: "manufacturer-primary-document-mirror",
    artifactPath: housingDrawingPath,
    document: "Molex SD-5557-003 Mini-Fit Jr receptacle housing dual-row drawing",
    reviewedPages: "retained PDF page 6; Molex SD-5557-003 drawing sheet 2 of 2; 39-01-2020 / 5557-02R chart row",
    sourceUrl: "https://www.molex.com/pdm_docs/sd/39012020_sd.pdf",
    acquisitionUrl: "https://images.100y.com.tw/pdf_file/10-molex-3901-2060.pdf",
    sha256: housingDrawingSha256,
    claims:
      "Exact 39-01-2020 / 5557-02R mating housing identity, 2-circuit receptacle family, and polarized mating orientation."
  },
  {
    authority: "manufacturer-primary-product-page-mirror",
    artifactPath: terminalProductPagePath,
    document: "Molex 39-00-0039 / 5556T Mini-Fit female crimp terminal product page export",
    reviewedPages: "1-3 of retained product-page export",
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/39000039",
    acquisitionUrl: "https://www.farnell.com/datasheets/4329964.pdf",
    sha256: terminalProductPageSha256,
    drawingUrl: "https://www.molex.com/pdm_docs/sd/039000038_sd.pdf",
    claims:
      "Exact 39-00-0039 bag terminal, 5556 series, tin-plated brass, 18-24 AWG, 1.30-3.10 mm insulation diameter, and crimp/compression termination. The official terminal drawing is linked but not separately retained in this slice."
  }
] as const

const expectedCanonicalIdentity = {
  manufacturer: "Molex",
  headerMpn,
  housingMpn,
  terminalMpn,
  series: "Mini-Fit Jr. 5566 header / 5557 receptacle / 5556 terminal",
  sourceContract: "BP-033 measurement links"
} as const

const expectedHeader = {
  circuitCount: 2,
  engineeringNumber: "5566-02A",
  orientation: "vertical through-hole header, viewed from component side",
  pinOne: { number: 1, sourceMarker: "circuit-1 rib", xMm: 0, yMm: contactPitchMm / 2 },
  pins,
  pitchMm: contactPitchMm,
  series: "5566",
  termination: "through-hole male header",
  terminalTailLengthMm: 3.5
} as const

const expectedHousing = {
  matingPartNumber: housingMpn,
  series: "5557",
  circuitCount: 2,
  gender: "female receptacle housing",
  pitchMm: contactPitchMm,
  orientation: "polarized mating receptacle; cable-side housing",
  cadLinksPublished: true
} as const

const expectedTerminal = {
  partNumber: terminalMpn,
  series: "5556",
  gender: "female crimp socket",
  material: "tin-plated brass",
  wireRangeAwg: "18-24",
  insulationDiameterMm: { minimum: 1.3, maximum: 3.1 },
  termination: "crimp or compression",
  cadLinksPublished: false
} as const

const expectedCandidateGeometry = {
  candidatePad: {
    shape: "circular_hole_with_rect_pad",
    outerDiameterMm: candidatePadDiameterMm,
    sourceAccurate: false,
    status: "project candidate only"
  },
  drill: {
    diameterMm: holeDiameterMm,
    sourceToleranceMm: 0.05,
    sourcePage: "header drawing recommended hole layout"
  },
  coordinateConvention: "component-side source view; pin one is the positive-Y circuit-1 contact",
  artworkApproximation: {
    localPcbXMm: 0,
    localPcbYMm: "pin one +2.10 mm; pin two -2.10 mm",
    sourceAccurateRelativePattern: true,
    placementAuthority: "deny",
    disposition:
      "The rendered holes preserve the source relative pattern as local review artwork; no board-level X/Y placement, rotation, edge, enclosure, or service-access datum is selected."
  },
  pins,
  state: "review-only-candidate-not-manufacturer-land-pattern",
  sourceDisposition:
    "Molex publishes the 1.40 mm finished-hole recommendation but no released copper annulus, mask, paste, courtyard, or board placement for this project link slice."
} as const

const expectedNetPairs = {
  state: "project-net-contract-only",
  pairs: linkPairs,
  sourceDisposition:
    "The four source/load pairs are copied from existing BP-050 interface contracts; this isolated slice does not integrate them into a board."
} as const

const expectedCad = {
  officialCadLinksPublished: true,
  state: "available-not-retained",
  officialCadArtifact: null,
  authority: "deny",
  disposition:
    "Molex product pages list CAD, STEP, and PRO/E links for the header and housing, but no official CAD artifact is retained or imported in this candidate. The terminal drawing link is recorded without a CAD claim."
} as const

const expectedDenyGates = {
  acceptance: {
    sourceIdentityReviewed: true,
    exactPinOneReviewed: true,
    netPairsReviewed: true,
    drillCandidateAccepted: false,
    padGeometryAccepted: false,
    housingCadImportAccepted: false,
    terminalCadImportAccepted: false,
    electricalIntegrationAccepted: false,
    boardImportAccepted: false,
    fitClearanceAccepted: false,
    mechanicalLoadAccepted: false,
    assemblyProcessAccepted: false,
    releaseState: "deny",
    fabricationAuthorized: false
  },
  boardPlacement: { state: "not-integrated", authority: "deny" },
  panelHole: {
    state: "not-applicable-to-through-hole-board-header",
    authority: "deny",
    reason:
      "The retained Molex source specifies PCB mounting holes, not a panel cutout; panel placement is outside this slice."
  },
  fitClearance: { state: "not-reviewed", authority: "deny" },
  mechanicalLoad: { state: "not-reviewed", authority: "deny" },
  courtyard: { state: "not-selected", authority: "deny" },
  terminalLandings: { state: "candidate-only", authority: "deny" }
} as const

function deepFreeze<T extends object>(value: T, seen = new WeakSet<object>()): T {
  if (seen.has(value)) return value
  seen.add(value)
  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey)
    if (descriptor && "value" in descriptor && typeof descriptor.value === "object" && descriptor.value !== null) {
      deepFreeze(descriptor.value, seen)
    }
  }
  Object.freeze(value)
  return value
}

const bp033MolexLinksProjectFootprintBaseline = deepFreeze({
  artifactKind: "bp033-molex-links-project-footprint",
  workUnit: "BP-033",
  references: ["J_LINK_INPUT", "J_LINK_APPLICATION", "J_LINK_DISPLAY", "J_LINK_SCORING"] as const,
  canonicalIdentity: expectedCanonicalIdentity,
  sources: expectedSources,
  header: expectedHeader,
  housing: expectedHousing,
  terminal: expectedTerminal,
  candidateGeometry: expectedCandidateGeometry,
  netPairs: expectedNetPairs,
  renderedArtwork: {
    artifactPath: renderedArtworkPath,
    serialization: "JSON.stringify(renderTestCircuit(<Bp033MolexLinksProjectFootprint />))",
    sha256: renderedArtworkSha256
  },
  manufacturerCad: expectedCad,
  denyGates: expectedDenyGates
} as const)

export const bp033MolexLinksProjectFootprintGeometry = deepFreeze(
  structuredClone(bp033MolexLinksProjectFootprintBaseline)
)

type GraphValidationState = {
  readonly actualToExpected: Map<object, object>
  readonly activeActual: Set<object>
  readonly expectedToActual: Map<object, object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphValidationState, path: string): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 Molex exact graph drift at ${path}`)
    return
  }

  if (typeof actual !== "object" || actual === null) throw new RangeError(`BP-033 Molex exact graph drift at ${path}`)
  if (state.activeActual.has(actual)) throw new RangeError(`BP-033 Molex cycle at ${path}`)
  const mappedActual = state.expectedToActual.get(expected)
  if (mappedActual !== undefined) {
    if (mappedActual !== actual) throw new RangeError(`BP-033 Molex alias drift at ${path}`)
    return
  }
  if (state.actualToExpected.has(actual)) throw new RangeError(`BP-033 Molex alias drift at ${path}`)
  state.expectedToActual.set(expected, actual)
  state.actualToExpected.set(actual, expected)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    throw new RangeError(`BP-033 Molex prototype drift at ${path}`)
  }

  const expectedNames = Object.getOwnPropertyNames(expected)
  const actualNames = Object.getOwnPropertyNames(actual)
  const expectedSymbols = Object.getOwnPropertySymbols(expected)
  const actualSymbols = Object.getOwnPropertySymbols(actual)
  if (
    expectedNames.length !== actualNames.length ||
    expectedNames.some((name) => !actualNames.includes(name)) ||
    expectedSymbols.length !== actualSymbols.length ||
    expectedSymbols.some((symbol) => !actualSymbols.includes(symbol))
  ) {
    throw new RangeError(`BP-033 Molex hidden or symbol property drift at ${path}`)
  }

  state.activeActual.add(actual)
  try {
    for (const propertyName of expectedNames) {
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, propertyName)
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, propertyName)
      if (
        !expectedDescriptor ||
        !actualDescriptor ||
        !("value" in expectedDescriptor) ||
        !("value" in actualDescriptor) ||
        actualDescriptor.get !== undefined ||
        actualDescriptor.set !== undefined ||
        expectedDescriptor.get !== undefined ||
        expectedDescriptor.set !== undefined ||
        actualDescriptor.enumerable !== expectedDescriptor.enumerable
      ) {
        throw new RangeError(`BP-033 Molex getter or descriptor drift at ${path}.${propertyName}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${propertyName}`)
    }
    for (const symbol of expectedSymbols) {
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, symbol)
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, symbol)
      if (
        !expectedDescriptor ||
        !actualDescriptor ||
        !("value" in expectedDescriptor) ||
        !("value" in actualDescriptor)
      ) {
        throw new RangeError(`BP-033 Molex symbol descriptor drift at ${path}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}[${String(symbol)}]`)
    }
  } finally {
    state.activeActual.delete(actual)
  }
}

export function validateBp033MolexLinksProjectFootprint(
  value: unknown = bp033MolexLinksProjectFootprintGeometry
): true {
  try {
    assertExactDataGraph(
      value,
      bp033MolexLinksProjectFootprintBaseline,
      { actualToExpected: new Map(), activeActual: new Set(), expectedToActual: new Map() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 Molex measurement-link exact graph or deny state drifted")
  }
  return true
}

const projectFootprint = (
  <footprint name="BP033_MOLEX_MEASUREMENT_LINK_REVIEW_ONLY" originalLayer="top">
    {pins.map((pin) => (
      <Fragment key={pin.number}>
        <platedhole
          shape="circular_hole_with_rect_pad"
          name={`PIN_${pin.number}`}
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter={`${holeDiameterMm}mm`}
          rectPadWidth={`${candidatePadDiameterMm}mm`}
          rectPadHeight={`${candidatePadDiameterMm}mm`}
          rectBorderRadius={`${candidatePadDiameterMm / 2}mm`}
          portHints={[`pin${pin.number}`, `circuit${pin.circuit}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp033MolexLinksProjectFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Isolated candidate only; no board circuit imports this renderer. */
export function Bp033MolexLinksProjectFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp033MolexLinksProjectFootprintProps = {}): ReactElement {
  return (
    <pinheader
      name="J_BP033_MEASUREMENT_LINK"
      manufacturerPartNumber={headerMpn}
      pinCount={2}
      pinLabels={["SOURCE", "LOAD"]}
      footprint={projectFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

export const bp033MolexLinksFootprintGeometry = bp033MolexLinksProjectFootprintGeometry
export default Bp033MolexLinksProjectFootprint
