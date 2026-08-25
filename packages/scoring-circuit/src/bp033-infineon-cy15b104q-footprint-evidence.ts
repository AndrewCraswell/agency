type EvidenceStatus = "pass" | "open" | "deny"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 FRAM evidence cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("BP-033 FRAM evidence accepts data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const retainedSourceSha256 = "B392F55463F1089F3E3123A47B961588120605E9D7B5A3C70F98A3B5E267FAC0"

const pinMap = [
  { pin: 1, name: "CS", electricalType: "input", projectSignal: "CS" },
  { pin: 2, name: "SO", electricalType: "output", projectSignal: "MISO" },
  { pin: 3, name: "WP", electricalType: "input", projectSignal: "WP" },
  { pin: 4, name: "VSS", electricalType: "power-ground", projectSignal: "GND" },
  { pin: 5, name: "SI", electricalType: "input", projectSignal: "MOSI" },
  { pin: 6, name: "SCK", electricalType: "input", projectSignal: "SCK" },
  { pin: 7, name: "HOLD", electricalType: "input", projectSignal: "HOLD" },
  { pin: 8, name: "VDD", electricalType: "power-input", projectSignal: "V3_3" }
] as const

const definition = {
  artifactKind: "bp033-infineon-cy15b104q-footprint-evidence",
  workUnit: "BP-033",
  status: "exact-orderable-package-evidence-review-only",
  source: {
    authority: "manufacturer-primary-retained",
    manufacturer: "Infineon Technologies (Cypress datasheet)",
    documentTitle: "CY15B104Q, 4-Mbit (512 K x 8) Serial (SPI) F-RAM",
    documentNumber: "001-94240",
    documentRevision: "Rev. *E",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/infineon-cy15b104q-datasheet.pdf",
    url: "https://www.infineon.com/assets/row/public/documents/10/49/infineon-cy15b104q-4-mbit-512-k-8-serial-spi-f-ram-datasheet-en.pdf?fileId=8ac78c8c7d0d8da4017d0ecdc6684848",
    sha256: retainedSourceSha256,
    retainedBytes: 848721,
    reviewedPdfPages: [3, 17, 19],
    reviewedFields: [
      { pdfPage: 3, field: "Figure 2", value: "8-pin TDFN Pinout; top view; not to scale" },
      { pdfPage: 3, field: "Pin Definitions", value: "CS, SCK, SI, SO, WP, HOLD, VSS, VDD, EXPOSED PAD" },
      { pdfPage: 3, field: "EXPOSED PAD", value: "No connect; exposed pad should be left floating" },
      { pdfPage: 17, field: "Ordering Information.CY15B104Q-LHXIT", value: "001-85579; 8-pin TDFN; Industrial" },
      { pdfPage: 17, field: "Ordering Code Definitions.Package Type", value: "LH = 8-pin DFN" },
      {
        pdfPage: 19,
        field: "Figure 21",
        value: "8-pin DFN (5 mm x 6 mm x 0.75 mm) Package Outline, 001-85579"
      },
      { pdfPage: 19, field: "Figure 21.DAP", value: "DAP SIZE 4.4 x 4.4 mm" },
      { pdfPage: 19, field: "Figure 21.terminal pitch", value: "1.27 mm Ref." },
      { pdfPage: 19, field: "Figure 21.terminal dimensions", value: "0.60 +/- 0.10 mm and 0.40 +/- 0.05 mm" },
      { pdfPage: 19, field: "Figure 21.terminal thickness", value: "0.203 +0.058/-0.008 mm" },
      { pdfPage: 19, field: "Figure 21.coplanarity", value: "Coplanarity shall not exceed 0.08 mm" },
      {
        pdfPage: 19,
        field: "Figure 21.pin-one datum",
        value: "Left plan view PIN 1 INDEX AREA is lower-left; terminal-side plan view labels pin 1 at lower-right"
      }
    ]
  },
  reference: "U_FRAM",
  manufacturer: "Infineon",
  manufacturerPartNumber: "CY15B104Q-LHXIT",
  package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579",
  packageFacts: {
    packageName: "PG-USON-8 / 8-pin DFN (001-85579)",
    bodyMm: {
      length: { nominal: 6, plusMinus: 0.1 },
      width: { nominal: 5, plusMinus: 0.1 },
      height: { nominal: 0.75, plusMinus: 0.05 }
    },
    terminals: 8,
    terminalPitchMm: 1.27,
    terminalAlongEdgeMm: { nominal: 0.6, plusMinus: 0.1 },
    terminalRadialWidthMm: { nominal: 0.4, plusMinus: 0.05 },
    terminalThicknessMm: { nominal: 0.203, plus: 0.058, minus: 0.008 },
    coplanarityMaximumMm: 0.08,
    exposedPad: {
      state: "published",
      sizeMm: { length: 4.4, width: 4.4 },
      electricalDisposition: "no-connect",
      boardDisposition: "leave floating"
    },
    landPatternFacts: {
      drawing: "001-85579",
      state: "package-outline-and-terminal-geometry; not-finished-pcb-cad",
      terminalPitch: "1.27 mm reference",
      terminalDimensions: "0.60 +/- 0.10 mm and 0.40 +/- 0.05 mm",
      exposedPadSize: "4.4 mm x 4.4 mm"
    }
  },
  pinMap,
  orientation: {
    pinoutSource: {
      pdfPage: 3,
      figure: "Figure 2",
      view: "top",
      pinOne: "upper-left",
      numbering: "pins 1-4 descend the left edge; pins 5-8 ascend the right edge"
    },
    packageDrawingSource: {
      pdfPage: 19,
      figure: "Figure 21",
      view: "left plan view plus terminal-side plan view",
      pinOne: "lower-left in the left plan view; lower-right in the terminal-side plan view"
    },
    projectOrientation: "not-reviewed; no board transform is inferred from the distinct source-view datums",
    independentBoardOrientationAccepted: false
  },
  projectGeometry: {
    state: "source-facts-only-not-emitted",
    landPattern: "not-transformed-to-project-pads",
    cad: "not-acquired",
    artwork: "not-generated",
    accepted: false
  },
  artwork: {
    state: "not-generated",
    artifactPath: null,
    generator: null,
    renderedGeometrySha256: null,
    authority: "deny"
  },
  reviewGates: {
    exactMpnAndManufacturer: "pass" as EvidenceStatus,
    retainedManufacturerSource: "pass" as EvidenceStatus,
    packageGeometry: "pass" as EvidenceStatus,
    pinMap: "pass" as EvidenceStatus,
    sourceOrientationCapture: "pass" as EvidenceStatus,
    manufacturerCad: "deny" as EvidenceStatus,
    projectCadImport: "deny" as EvidenceStatus,
    projectArtwork: "deny" as EvidenceStatus,
    independentOrientation: "deny" as EvidenceStatus,
    boardPlacement: "deny" as EvidenceStatus,
    boardFitAndClearance: "deny" as EvidenceStatus,
    courtyard: "deny" as EvidenceStatus,
    drc: "deny" as EvidenceStatus,
    assembly: "deny" as EvidenceStatus,
    fabrication: "deny" as EvidenceStatus,
    release: "deny" as EvidenceStatus,
    accepted: false
  },
  denyGates: {
    manufacturerCad: { state: "not-acquired", authority: "deny" },
    boardPlacement: { state: "not-integrated", authority: "deny" },
    physicalFitAndClearance: { state: "not-reviewed", authority: "deny" },
    assemblyProcess: { state: "not-reviewed", authority: "deny" },
    fabrication: { state: "deny", authority: "deny" },
    release: { state: "deny", authority: "deny" },
    accepted: false
  }
} as const

export const bp033InfineonCy15b104qFootprintEvidence = deepFreeze(definition)

export function validateBp033InfineonCy15b104qFootprintEvidence(
  value: typeof bp033InfineonCy15b104qFootprintEvidence = bp033InfineonCy15b104qFootprintEvidence
): true {
  if (
    value.reference !== "U_FRAM" ||
    value.manufacturer !== "Infineon" ||
    value.manufacturerPartNumber !== "CY15B104Q-LHXIT" ||
    value.source.sha256 !== retainedSourceSha256 ||
    value.source.reviewedPdfPages.join(",") !== "3,17,19" ||
    value.projectGeometry.accepted ||
    value.artwork.authority !== "deny" ||
    value.reviewGates.release !== "deny"
  ) {
    throw new RangeError("BP-033 Infineon CY15B104Q-LHXIT evidence drifted or was prematurely accepted")
  }
  return true
}

validateBp033InfineonCy15b104qFootprintEvidence()
