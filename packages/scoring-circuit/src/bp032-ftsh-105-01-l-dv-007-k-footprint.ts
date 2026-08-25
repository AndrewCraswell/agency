/**
 * BP-032 review-only footprint evidence for the STM32 SWD header.
 *
 * This is evidence for the exact Samtec orderable used by J_STM_SWD. It is
 * intentionally not a released PCB footprint: manufacturer CAD was not
 * acquired, and solder-mask, paste, courtyard, artwork, and fabrication
 * authority remain denied until root review against the PCB tool output.
 */

type Pad = {
  readonly pin: number
  readonly signal: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

const headerPartNumber = "FTSH-105-01-L-DV-007-K"
const headerProductUrl = "https://www.samtec.com/products/ftsh-105-01-l-dv-007-k"
const headerPrintPath = "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-vertical-smt-print.pdf"
const headerFootprintPath = "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-vertical-smt-footprint.pdf"
const headerCatalogPath = "packages/scoring-circuit/docs/evidence/bp-032/samtec-ftsh-smt-catalog.pdf"
const matingPagePath = "packages/scoring-circuit/docs/evidence/bp-032/samtec-ffsd-05-d-06-00-01-n.html"

const headerPrintSha256 = "EF2961377445B9AD10762EA27519E7B59E5CBB5847DC0058D8E35C0D97C446A3"
const headerFootprintSha256 = "CAA205B92560423F3B0AEA9C69D6C38340D1B7F01B0655092994450E935EDCB3"
const headerCatalogSha256 = "F918233908DD8D2FC733C6BBF6582018BE9ACAD50F1E193C27F8DC1E734EE754"
const matingPageSha256 = "F5E68A077171E9C38D26D812B440138A236E6145167EA4914F82D1D8956D7933"

const upstreamServiceHeaderSourceSha256 = "CD1967756EFDF98DBF31B1AB820D54B9306C8C8D7CA00541DAFD69E6435588EE"
const upstreamServiceHeaderDocSha256 = "F35DEC5A309CF2FB6914B3F3C1F7932AF2C7D75103B01B1ED1080C6D3A003790"
const upstreamConnectorPreorderSha256 = "CE743B23C3008D420C6F2A28430B41912EA1E4A0E7D070E9E2EFFCE43F7249C9"

const expectedSourceDocuments = [
  { artifactPath: headerFootprintPath, sha256: headerFootprintSha256, printedPages: [1, 2] },
  { artifactPath: headerPrintPath, sha256: headerPrintSha256, printedPages: [1, 2] },
  { artifactPath: headerCatalogPath, sha256: headerCatalogSha256, printedPages: [1] }
]

const expectedUpstreamSources = [
  {
    path: "packages/scoring-circuit/src/bench-prototype-service-headers.ts",
    sha256: upstreamServiceHeaderSourceSha256,
    role: "BP-124 exact J_STM_SWD header and pin contract"
  },
  {
    path: "packages/scoring-circuit/docs/bench-prototype-service-headers.md",
    sha256: upstreamServiceHeaderDocSha256,
    role: "BP-124 mating and physical acceptance contract"
  },
  {
    path: "packages/scoring-circuit/docs/bench-prototype-connector-preorder.md",
    sha256: upstreamConnectorPreorderSha256,
    role: "BP-124 candidate preorder identity"
  }
]

function cloneSourceDocuments() {
  return expectedSourceDocuments.map((source) => ({ ...source, printedPages: [...source.printedPages] }))
}

function cloneUpstreamSources() {
  return expectedUpstreamSources.map((source) => ({ ...source }))
}

const expectedPads: readonly Pad[] = [
  { pin: 1, signal: "SCORING_3V3_SENSE", xMm: -2.54, yMm: -1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 2, signal: "SWDIO", xMm: -2.54, yMm: 1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 3, signal: "SCORING_SGND", xMm: -1.27, yMm: -1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 4, signal: "SWCLK", xMm: -1.27, yMm: 1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 5, signal: "SCORING_SGND", xMm: 0, yMm: -1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 6, signal: "NC_SWD_SWO_RESERVED", xMm: 0, yMm: 1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 8, signal: "NC_SWD_RESERVED", xMm: 1.27, yMm: 1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 9, signal: "SCORING_SGND", xMm: 2.54, yMm: -1.7145, widthMm: 0.5334, heightMm: 2.794 },
  { pin: 10, signal: "SCORING_NRST_N", xMm: 2.54, yMm: 1.7145, widthMm: 0.5334, heightMm: 2.794 }
]

const pinMap = [
  { pin: 1, signal: "SCORING_3V3_SENSE", direction: "adapter-sense", electricalClass: "sense-only" },
  { pin: 2, signal: "SWDIO", direction: "bidirectional", electricalClass: "3V3_CMOS" },
  { pin: 3, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
  { pin: 4, signal: "SWCLK", direction: "adapter-to-target", electricalClass: "3V3_CMOS" },
  { pin: 5, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
  { pin: 6, signal: "NC_SWD_SWO_RESERVED", direction: "not-connected", electricalClass: "unconnected" },
  { pin: 8, signal: "NC_SWD_RESERVED", direction: "not-connected", electricalClass: "unconnected" },
  { pin: 9, signal: "SCORING_SGND", direction: "reference", electricalClass: "ground" },
  { pin: 10, signal: "SCORING_NRST_N", direction: "adapter-open-drain-sink", electricalClass: "3V3_RESET" }
]

export const bp032Ftsh10501LDv007KFootprintEvidence = {
  artifactKind: "bp032-ftsh-105-01-l-dv-007-k-footprint-evidence",
  workUnit: "BP-032",
  reference: "J_STM_SWD",
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false,
  sourceControl: {
    basisCommit: "0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc",
    upstreamSources: cloneUpstreamSources()
  },
  connector: {
    manufacturer: "Samtec",
    manufacturerPartNumber: headerPartNumber,
    series: "FTSH",
    exactOrderableCode: {
      positionsPerRow: 5,
      leadStyle: "01",
      leadLengthMm: 3.05,
      plating: "L: 10 microinch selective gold contact area, matte tin tail",
      tailOption: "DV: double vertical",
      omittedPosition: 7,
      keyingOption: "K: keying notch for mating with FFSD"
    },
    package: {
      positions: 10,
      rows: 2,
      populatedPads: 9,
      pitchMm: 1.27,
      rowCenterSpanMm: 3.429,
      orientation: "vertical",
      termination: "surface-mount",
      omittedPins: [7],
      pinNumbering: "pin 1 lower-left, pin 2 upper-left, then odd pins on lower row and even pins on upper row",
      keying: "-K keying notch; manufacturer print Figure 2 identifies this option for FFSD mating"
    }
  },
  pinMap,
  manufacturerLandPattern: {
    authority: "Samtec manufacturer primary",
    sourceDocuments: cloneSourceDocuments(),
    copper: {
      padCount: 9,
      padWidthMm: 0.5334,
      padLengthMm: 2.794,
      padPitchMm: 1.27,
      rowCenterSpanMm: 3.429,
      omittedPin: 7,
      dimensions: {
        padWidth: "0.021 in [0.53 mm] derived from 0.050 in [1.27 mm] pitch minus 0.029 in [0.74 mm] inter-pad gap",
        padLength: "0.110 in [2.79 mm]"
      }
    },
    solderMask: {
      state: "not-numerically-specified-by-retained-manufacturer-print",
      authority: "deny",
      note: "The retained Samtec footprint print shows copper geometry but does not release a numeric mask expansion or web rule."
    },
    paste: {
      state: "manufacturer-stencil-layout-retained-but-not-released",
      authority: "deny",
      stencilThicknessMm: 0.152,
      note: "Footprint print Figure 2 supplies the recommended stencil layout and 0.0060 in [0.152 mm] stencil thickness; exact aperture reduction remains a fabrication decision."
    },
    courtyard: {
      state: "not-published-by-manufacturer",
      authority: "deny",
      note: "No manufacturer courtyard or CAD archive is retained in this slice."
    },
    locatingAndKeying: {
      keying: "-K keying notch is included in the connector outline and is specified for FFSD mating.",
      locatingHoles:
        "none for -K footprint; the retained footprint print's NPTH is limited to EPC/EC options, not this orderable",
      pickAndPlace: "no -P or -M option is present in the exact orderable code",
      alignmentPin: "not selected; -A is absent from the exact orderable code"
    }
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "derived from retained Samtec FTSH generic footprint/print; not manufacturer CAD",
    pads: expectedPads,
    pinOne: {
      pad: 1,
      datum: "zero board rotation, lower-left pad in the Samtec top-view convention",
      orientationStatus: "pending-independent-review"
    },
    omittedPins: [7],
    solderMask: { state: "review-only", authority: "deny" },
    paste: { state: "review-only", authority: "deny" },
    courtyard: { state: "review-only", authority: "deny" },
    artwork: { state: "not-generated", authority: "deny" },
    accepted: false,
    fabricationAuthority: "deny"
  },
  mating: {
    manufacturer: "Samtec",
    manufacturerPartNumber: "FFSD-05-D-06.00-01-N",
    family: ".050 inch low-profile Tiger Eye IDC ribbon cable assembly",
    positions: 10,
    rows: 2,
    pitchMm: 1.27,
    lengthInches: 6,
    polarization: "keyed",
    source: {
      url: "https://www.samtec.com/products/ffsd-05-d-06.00-01-n",
      artifactPath: matingPagePath,
      sha256: matingPageSha256,
      evidence: "Samtec page title, dual-row 1.27 mm pitch description, FFSD features, and exact MPN metadata"
    },
    reconciliation:
      "Matches the exact mating candidate recorded by BP-124; cable supplier and cable validation are outside this footprint evidence slice."
  },
  manufacturerCad: {
    state: "not-acquired-access-gated",
    authority: "deny",
    artifactPath: null,
    sourceUrl: headerProductUrl,
    note: "Samtec exposes instant CAD through the product page, but no exact CAD archive was acquired or retained in this slice; the generic series print is not represented as CAD."
  },
  requiredFollowUp: [
    "Root must independently review the exact MPN, omitted pin, pin-one datum, key notch, and generated PCB-tool footprint.",
    "Acquire and hash the exact Samtec CAD/package export, or record why the final project geometry is controlled without it.",
    "Resolve numeric solder-mask, paste, courtyard, artwork, assembly, continuity, and mating-fit evidence before any fabrication authority is considered.",
    "Reconcile this J_STM_SWD footprint with BP-124 and the final processor schematic without editing either upstream contract in this slice."
  ]
}

type Evidence = typeof bp032Ftsh10501LDv007KFootprintEvidence

function hasUpperSha256(value: string): boolean {
  return /^[0-9A-F]{64}$/u.test(value)
}

function equalValue(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function validatePads(actual: readonly Pad[], errors: string[]): void {
  if (actual.length !== expectedPads.length) {
    errors.push("project footprint must contain exactly nine populated pads")
    return
  }
  const seen = new Set<number>()
  for (const pad of actual) {
    if (seen.has(pad.pin)) errors.push(`project footprint contains duplicate pin ${pad.pin}`)
    seen.add(pad.pin)
    const expected = expectedPads.find((candidate) => candidate.pin === pad.pin)
    if (expected === undefined) {
      errors.push(`project footprint contains unexpected pin ${pad.pin}`)
      continue
    }
    for (const key of ["signal", "xMm", "yMm", "widthMm", "heightMm"] as const) {
      if (pad[key] !== expected[key]) errors.push(`project footprint pin ${pad.pin} ${key} drifted`)
    }
  }
}

export function validateBp032Ftsh10501LDv007KFootprintEvidence(
  candidate: Evidence = bp032Ftsh10501LDv007KFootprintEvidence
): string[] {
  const errors: string[] = []
  if (candidate.workUnit !== "BP-032") errors.push("work unit must remain BP-032")
  if (candidate.reference !== "J_STM_SWD") errors.push("reference must remain J_STM_SWD")
  if (candidate.releaseState !== "deny") errors.push("release state must remain denied")
  if (candidate.fabricationAuthority !== "deny") errors.push("fabrication authority must remain denied")
  if (candidate.accepted !== false) errors.push("evidence must remain unaccepted")

  if (
    candidate.connector.manufacturer !== "Samtec" ||
    candidate.connector.manufacturerPartNumber !== headerPartNumber ||
    candidate.connector.series !== "FTSH"
  ) {
    errors.push("exact Samtec FTSH identity drifted")
  }
  if (
    candidate.connector.exactOrderableCode.positionsPerRow !== 5 ||
    candidate.connector.exactOrderableCode.leadStyle !== "01" ||
    candidate.connector.exactOrderableCode.leadLengthMm !== 3.05 ||
    candidate.connector.exactOrderableCode.plating !== "L: 10 microinch selective gold contact area, matte tin tail" ||
    candidate.connector.exactOrderableCode.tailOption !== "DV: double vertical" ||
    candidate.connector.exactOrderableCode.omittedPosition !== 7 ||
    candidate.connector.exactOrderableCode.keyingOption !== "K: keying notch for mating with FFSD"
  ) {
    errors.push("exact 2x5 orderable code, omitted pin, or keying drifted")
  }
  if (
    candidate.connector.package.positions !== 10 ||
    candidate.connector.package.rows !== 2 ||
    candidate.connector.package.populatedPads !== 9 ||
    candidate.connector.package.pitchMm !== 1.27 ||
    candidate.connector.package.rowCenterSpanMm !== 3.429 ||
    candidate.connector.package.orientation !== "vertical" ||
    candidate.connector.package.termination !== "surface-mount" ||
    !equalValue(candidate.connector.package.omittedPins, [7]) ||
    candidate.connector.package.pinNumbering !==
      "pin 1 lower-left, pin 2 upper-left, then odd pins on lower row and even pins on upper row" ||
    candidate.connector.package.keying !==
      "-K keying notch; manufacturer print Figure 2 identifies this option for FFSD mating"
  ) {
    errors.push("2x5 package, omitted pin, key, or orientation identity drifted")
  }
  if (!equalValue(candidate.pinMap, pinMap)) errors.push("J_STM_SWD pin map drifted")
  validatePads(candidate.projectFootprint.pads, errors)

  const copper = candidate.manufacturerLandPattern.copper
  if (
    copper.padCount !== 9 ||
    copper.padWidthMm !== 0.5334 ||
    copper.padLengthMm !== 2.794 ||
    copper.padPitchMm !== 1.27 ||
    copper.rowCenterSpanMm !== 3.429 ||
    copper.omittedPin !== 7 ||
    copper.dimensions.padWidth !==
      "0.021 in [0.53 mm] derived from 0.050 in [1.27 mm] pitch minus 0.029 in [0.74 mm] inter-pad gap" ||
    copper.dimensions.padLength !== "0.110 in [2.79 mm]"
  ) {
    errors.push("manufacturer copper land-pattern geometry drifted")
  }
  if (
    candidate.manufacturerLandPattern.authority !== "Samtec manufacturer primary" ||
    !equalValue(candidate.manufacturerLandPattern.sourceDocuments, expectedSourceDocuments)
  ) {
    errors.push("retained Samtec drawing identity drifted")
  }
  if (
    candidate.manufacturerLandPattern.solderMask.state !== "not-numerically-specified-by-retained-manufacturer-print" ||
    candidate.manufacturerLandPattern.solderMask.authority !== "deny"
  ) {
    errors.push("solder-mask disposition must remain denied and non-numeric")
  }
  if (
    candidate.manufacturerLandPattern.paste.state !== "manufacturer-stencil-layout-retained-but-not-released" ||
    candidate.manufacturerLandPattern.paste.authority !== "deny" ||
    candidate.manufacturerLandPattern.paste.stencilThicknessMm !== 0.152
  ) {
    errors.push("paste disposition must remain denied and unreleased")
  }
  if (
    candidate.manufacturerLandPattern.courtyard.state !== "not-published-by-manufacturer" ||
    candidate.manufacturerLandPattern.courtyard.authority !== "deny"
  ) {
    errors.push("courtyard disposition must remain denied and unpublished")
  }

  if (
    candidate.projectFootprint.state !== "review-only" ||
    candidate.projectFootprint.geometryAuthority !==
      "derived from retained Samtec FTSH generic footprint/print; not manufacturer CAD" ||
    !equalValue(candidate.projectFootprint.omittedPins, [7]) ||
    candidate.projectFootprint.accepted !== false ||
    candidate.projectFootprint.fabricationAuthority !== "deny"
  ) {
    errors.push("project footprint must remain review-only, pin-7 omitted, unaccepted, and denied")
  }
  if (
    candidate.projectFootprint.solderMask.state !== "review-only" ||
    candidate.projectFootprint.solderMask.authority !== "deny" ||
    candidate.projectFootprint.paste.state !== "review-only" ||
    candidate.projectFootprint.paste.authority !== "deny" ||
    candidate.projectFootprint.courtyard.state !== "review-only" ||
    candidate.projectFootprint.courtyard.authority !== "deny" ||
    candidate.projectFootprint.artwork.state !== "not-generated" ||
    candidate.projectFootprint.artwork.authority !== "deny"
  ) {
    errors.push("project mask, paste, courtyard, and artwork dispositions must remain denied")
  }
  if (
    candidate.projectFootprint.pinOne.pad !== 1 ||
    candidate.projectFootprint.pinOne.datum !==
      "zero board rotation, lower-left pad in the Samtec top-view convention" ||
    candidate.projectFootprint.pinOne.orientationStatus !== "pending-independent-review"
  ) {
    errors.push("pin-one datum and orientation must remain pending independent review")
  }

  if (
    candidate.mating.manufacturer !== "Samtec" ||
    candidate.mating.manufacturerPartNumber !== "FFSD-05-D-06.00-01-N" ||
    candidate.mating.family !== ".050 inch low-profile Tiger Eye IDC ribbon cable assembly" ||
    candidate.mating.positions !== 10 ||
    candidate.mating.rows !== 2 ||
    candidate.mating.pitchMm !== 1.27 ||
    candidate.mating.lengthInches !== 6 ||
    candidate.mating.polarization !== "keyed"
  ) {
    errors.push("exact FFSD mating identity or geometry drifted")
  }
  if (
    candidate.mating.source.url !== "https://www.samtec.com/products/ffsd-05-d-06.00-01-n" ||
    candidate.mating.source.artifactPath !== matingPagePath ||
    candidate.mating.source.sha256 !== matingPageSha256 ||
    !hasUpperSha256(candidate.mating.source.sha256)
  ) {
    errors.push("retained mating source identity or SHA-256 drifted")
  }

  if (
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.state !== "not-acquired-access-gated" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.sourceUrl !== headerProductUrl
  ) {
    errors.push("manufacturer CAD must remain denied and unacquired")
  }

  const sources = candidate.manufacturerLandPattern.sourceDocuments
  for (const source of sources) {
    if (!hasUpperSha256(source.sha256)) errors.push(`invalid source SHA-256 for ${source.artifactPath}`)
  }
  if (!equalValue(candidate.sourceControl.upstreamSources, expectedUpstreamSources)) {
    errors.push("BP-124 upstream source bindings drifted")
  }
  return errors
}
