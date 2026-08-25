/**
 * BP-032 review-only evidence for the selected reset-support parts.
 *
 * The retained manufacturer datasheets establish the exact orderables,
 * package/pin identities, package orientation, and land-pattern guidance.
 * This record intentionally does not claim manufacturer CAD, board release,
 * or fabrication authority.
 */

type Pad = {
  readonly pin: number
  readonly name: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

const tiPartNumber = "SN74LVC2G07DCKR"
const bssPartNumber = "BSS138AKA"
const tiSourcePath = "packages/scoring-circuit/docs/evidence/bp-032/ti-sn74lvc2g07-datasheet.pdf"
const bssSourcePath = "packages/scoring-circuit/docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf"
const tiSourceSha256 = "71BBB2FC452E2949B332C030B004B094BA679AC8CCE27123F806A0A6B1FDE660"
const bssSourceSha256 = "39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9"

const tiPads: Pad[] = [
  { pin: 1, name: "1A", xMm: -1.1, yMm: 0.65, widthMm: 0.9, heightMm: 0.4 },
  { pin: 2, name: "GND", xMm: -1.1, yMm: 0, widthMm: 0.9, heightMm: 0.4 },
  { pin: 3, name: "2A", xMm: -1.1, yMm: -0.65, widthMm: 0.9, heightMm: 0.4 },
  { pin: 4, name: "2Y", xMm: 1.1, yMm: -0.65, widthMm: 0.9, heightMm: 0.4 },
  { pin: 5, name: "VCC", xMm: 1.1, yMm: 0, widthMm: 0.9, heightMm: 0.4 },
  { pin: 6, name: "1Y", xMm: 1.1, yMm: 0.65, widthMm: 0.9, heightMm: 0.4 }
]

const bssPads: Pad[] = [
  { pin: 1, name: "G", xMm: -0.95, yMm: -0.7, widthMm: 0.6, heightMm: 0.7 },
  { pin: 2, name: "S", xMm: 0.95, yMm: -0.7, widthMm: 0.6, heightMm: 0.7 },
  { pin: 3, name: "D", xMm: 0, yMm: 0.7, widthMm: 0.6, heightMm: 0.7 }
]

const commonDeny = {
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "No manufacturer CAD archive was acquired or retained for this candidate."
  },
  projectFootprint: {
    state: "review-only",
    orientationStatus: "pending-independent-review",
    accepted: false,
    fabricationAuthority: "deny"
  },
  artwork: {
    state: "not-generated",
    authority: "deny",
    note: "No board-library artwork is released by this evidence slice."
  }
}

export const bp032ResetSupportFootprintEvidence = {
  artifactKind: "bp032-reset-support-footprint-evidence",
  workUnit: "BP-032",
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false,
  sourceControl: {
    basisCommit: "0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc",
    upstreamSources: [
      {
        path: "packages/scoring-circuit/src/bench-prototype-processor-footprints.ts",
        sha256: "D81A8CC19D227929D21262AA8E81C0D505F5C7EA5DF15E2ACBDF17739CFE18B4"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-reset-watchdog.ts",
        sha256: "0F10F1E308C0B3760C38A5A30405D727F1115BFFAC1C3F141D8EAF8789DD7E23"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-service-headers.ts",
        sha256: "CD1967756EFDF98DBF31B1AB820D54B9306C8C8D7CA00541DAFD69E6435588EE"
      }
    ]
  },
  parts: [
    {
      reference: "U_APP_RESET_FANOUT",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: tiPartNumber,
      source: {
        authority: "manufacturer-primary",
        document: "SN74LVC2G07 Dual Buffer and Driver With Open-Drain Outputs",
        documentNumber: "SCES308L",
        revision: "L",
        url: "https://www.ti.com/lit/ds/symlink/sn74lvc2g07.pdf",
        artifactPath: tiSourcePath,
        sha256: tiSourceSha256,
        pageNumbering: {
          retainedPdfPageCount: 34,
          reviewedPdfPages: [3, 11, 12],
          printedPageLabels: [3, 11, "Addendum-Page 1"],
          note: "PDF page numbers are physical pages in the retained file. The exact-orderable page is physical PDF page 12, whose printed footer label is Addendum-Page 1; reviewedPrintedPages retains only the ordinary printed page numbers used for the pin map and package geometry."
        },
        reviewedPrintedPages: [3, 11],
        exactOrderableBinding: {
          pdfPage: 12,
          printedPageLabel: "Addendum-Page 1",
          manufacturerPartNumber: tiPartNumber,
          status: "Active",
          package: "SC70 (DCK)",
          pinCount: 6,
          purpose: "Bind the selected exact orderable to the DCK package used by this review record."
        },
        evidence: [
          "PDF page 3 (printed page 3) DCK package top view identifies the 6-pin SC70 pin map.",
          "PDF page 11 (printed page 11) DCK0006A package outline and example board layout provide the package dimensions, 0.65 mm pitch, 2.2 mm pad-row span, 0.9 mm x 0.4 mm exposed metal, and preferred NSMD 0.07 mm maximum mask surround.",
          "PDF page 12, printed as Addendum-Page 1, lists SN74LVC2G07DCKR as Active, SC70 (DCK), 6 pins; this is the exact-orderable binding for this record."
        ]
      },
      package: {
        designation: "SC70-6",
        packageCode: "DCK",
        pinCount: 6,
        bodyLengthMm: { minimum: 1.8, maximum: 2.4 },
        bodyWidthMm: { minimum: 1.1, maximum: 1.4 },
        maximumHeightMm: 1.1,
        leadPitchMm: 0.65,
        padRowCenterSpanMm: 2.2
      },
      pinMap: [
        { pin: 1, name: "1A", function: "input 1" },
        { pin: 2, name: "GND", function: "ground" },
        { pin: 3, name: "2A", function: "input 2" },
        { pin: 4, name: "2Y", function: "open-drain output 2" },
        { pin: 5, name: "VCC", function: "supply" },
        { pin: 6, name: "1Y", function: "open-drain output 1" }
      ],
      manufacturerLandPattern: {
        sourcePage: 11,
        copper: { padLengthMm: 0.9, padWidthMm: 0.4, pitchMm: 0.65, rowCenterSpanMm: 2.2 },
        solderMask: {
          definition: "NSMD preferred",
          maximumSurroundPerEdgeMm: 0.07,
          sourceStatement:
            "DCK0006A solder-mask details show 0.07 mm maximum around exposed metal for the preferred NSMD option."
        },
        paste: { state: "not-numerically-retained-in-this-record", sourcePage: 12 },
        courtyard: { state: "not-published-by-manufacturer" }
      },
      manufacturerCad: commonDeny.manufacturerCad,
      projectFootprint: {
        geometryAuthority: "project-review-input-derived-from-ti-dck0006a",
        pads: tiPads,
        solderMask: {
          state: "review-only",
          definition: "NSMD preferred",
          marginPerEdgeMm: 0.07,
          derivation: "TI DCK0006A maximum NSMD surround; final fabrication rule remains unapproved"
        },
        paste: { state: "review-only", derivation: "not released from this evidence slice" },
        courtyard: {
          state: "project-review-input",
          widthMm: 2.9,
          heightMm: 3,
          clearanceMm: 0.25,
          derivation: "package envelope and pad envelope plus project review clearance; not manufacturer CAD"
        },
        orientation: {
          state: "pending-independent-review",
          boardRotationDegrees: 0,
          pinOnePad: 1,
          datum:
            "TI DCK0006A top view pin-one index at upper-left; left row is pins 1, 2, 3 top-to-bottom and right row is pins 6, 5, 4 top-to-bottom"
        }
      },
      artwork: commonDeny.artwork,
      affectedReferences: ["U_APP_RESET_FANOUT"]
    },
    {
      reference: "Q_ESP_RESET_STM / Q_ESP_DEBUG_RESET",
      manufacturer: "Nexperia",
      manufacturerPartNumber: bssPartNumber,
      source: {
        authority: "manufacturer-primary",
        document: "BSS138AKA 60 V, single N-channel Trench MOSFET",
        documentNumber: "BSS138AKA",
        revision: "2 February 2024",
        url: "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf",
        artifactPath: bssSourcePath,
        sha256: bssSourceSha256,
        reviewedPrintedPages: [2, 12],
        evidence: [
          "Page 2 Table 2 gives pin 1 gate, pin 2 source, pin 3 drain; the simplified top view places pin 1 lower-left, pin 2 lower-right, and pin 3 upper-center.",
          "Page 2 Table 3 identifies the exact BSS138AKA SOT23 orderable as a 2.9 mm x 1.3 mm x 1 mm body with 1.9 mm pitch.",
          "Page 12 Figure 19 provides the SOT23 reflow soldering footprint guidance: three 0.6 mm x 0.7 mm solder lands with the 1.9 mm upper-row pitch and 1.4 mm upper-to-lower center span."
        ]
      },
      package: {
        designation: "SOT23",
        packageCode: "SOT23",
        pinCount: 3,
        bodyLengthMm: 2.9,
        bodyWidthMm: 1.3,
        bodyHeightMm: 1,
        leadPitchMm: 1.9,
        padCenterSpanMm: 1.4
      },
      pinMap: [
        { pin: 1, name: "G", function: "gate" },
        { pin: 2, name: "S", function: "source" },
        { pin: 3, name: "D", function: "drain" }
      ],
      manufacturerLandPattern: {
        sourcePage: 12,
        solderLands: { padLengthMm: 0.7, padWidthMm: 0.6, upperRowPitchMm: 1.9, centerSpanMm: 1.4 },
        solderMask: { state: "shown-in-figure-not-numerically-released-in-this-record" },
        paste: { state: "shown-in-figure-not-numerically-released-in-this-record" },
        courtyard: { state: "shown-as-occupied-area-not-retained-as-CAD" }
      },
      manufacturerCad: commonDeny.manufacturerCad,
      projectFootprint: {
        geometryAuthority: "project-review-input-derived-from-nexperia-fig19",
        pads: bssPads,
        solderMask: { state: "review-only", derivation: "final openings remain a fabrication-review decision" },
        paste: { state: "review-only", derivation: "final apertures remain a fabrication-review decision" },
        courtyard: {
          state: "project-review-input",
          widthMm: 3.8,
          heightMm: 3.2,
          clearanceMm: 0.25,
          derivation: "package and pad envelope plus project review clearance; not manufacturer CAD"
        },
        orientation: {
          state: "pending-independent-review",
          boardRotationDegrees: 0,
          pinOnePad: 1,
          datum: "Nexperia page 2 SOT23 top view pin 1 is lower-left, pin 2 lower-right, and pin 3 upper-center"
        }
      },
      artwork: commonDeny.artwork,
      affectedReferences: ["Q_ESP_RESET_STM", "Q_ESP_DEBUG_RESET"]
    }
  ],
  requiredFollowUp: [
    "Independently review pin-one marking, board rotation, solder-mask web, stencil apertures, courtyard, and generated CAD against the final PCB tool output.",
    "Retain exact manufacturer CAD or a controlled library export before fabrication authority is considered.",
    "Reconcile the two BSS138AKA occurrences with BP-123 reset and BP-033 display-enable footprint closure; this slice does not close either dependency."
  ],
  ...commonDeny
}

type Evidence = typeof bp032ResetSupportFootprintEvidence

function hasUpperSha256(value: string): boolean {
  return /^[0-9A-F]{64}$/u.test(value)
}

function validatePads(actual: readonly Pad[], expected: readonly Pad[], label: string, errors: string[]): void {
  if (actual.length !== expected.length) {
    errors.push(`${label} must contain exactly ${expected.length} pads`)
    return
  }
  const expectedByPin = new Map(expected.map((pad) => [pad.pin, pad]))
  const seen = new Set<number>()
  for (const pad of actual) {
    if (seen.has(pad.pin)) {
      errors.push(`${label} contains duplicate pin ${pad.pin}`)
    }
    seen.add(pad.pin)
    const source = expectedByPin.get(pad.pin)
    if (source === undefined) {
      errors.push(`${label} contains unexpected pin ${pad.pin}`)
      continue
    }
    for (const key of ["name", "xMm", "yMm", "widthMm", "heightMm"] as const) {
      if (pad[key] !== source[key]) {
        errors.push(`${label} pin ${pad.pin} ${key} drifted`)
      }
    }
  }
}

/** Empty output means only that this denied review record is internally consistent. */
export function validateBp032ResetSupportFootprintEvidence(
  value: Evidence = bp032ResetSupportFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  if (value.workUnit !== "BP-032") {
    errors.push("work unit must remain BP-032")
  }
  if (value.releaseState !== "deny" || value.fabricationAuthority !== "deny" || value.accepted !== false) {
    errors.push("release, fabrication authority, and acceptance must remain denied")
  }
  if (value.parts.length !== 2) {
    errors.push("BP-032 reset-support slice must contain exactly two part records")
  }
  const ti = value.parts.find((part) => part.manufacturerPartNumber === tiPartNumber)
  if (ti === undefined) {
    errors.push("exact TI SN74LVC2G07DCKR record is missing")
  } else {
    if (
      ti.manufacturer !== "Texas Instruments" ||
      ti.package.designation !== "SC70-6" ||
      ti.package.packageCode !== "DCK"
    ) {
      errors.push("TI reset fanout identity or package drifted")
    }
    if (
      ti.source.artifactPath !== tiSourcePath ||
      ti.source.sha256 !== tiSourceSha256 ||
      !hasUpperSha256(ti.source.sha256)
    ) {
      errors.push("retained TI source identity or SHA-256 drifted")
    }
    if (ti.source.reviewedPrintedPages.join(",") !== "3,11") {
      errors.push("TI reviewed source pages drifted")
    }
    const pageNumbering = "pageNumbering" in ti.source ? ti.source.pageNumbering : undefined
    const exactOrderableBinding = "exactOrderableBinding" in ti.source ? ti.source.exactOrderableBinding : undefined
    if (pageNumbering === undefined || exactOrderableBinding === undefined) {
      errors.push("TI exact-orderable PDF-page-12 binding is missing")
    } else {
      if (pageNumbering.reviewedPdfPages.join(",") !== "3,11,12") {
        errors.push("TI reviewed PDF pages drifted")
      }
      if (
        pageNumbering.retainedPdfPageCount !== 34 ||
        exactOrderableBinding.pdfPage !== 12 ||
        exactOrderableBinding.printedPageLabel !== "Addendum-Page 1" ||
        exactOrderableBinding.manufacturerPartNumber !== tiPartNumber ||
        exactOrderableBinding.status !== "Active" ||
        exactOrderableBinding.package !== "SC70 (DCK)" ||
        exactOrderableBinding.pinCount !== 6
      ) {
        errors.push("TI exact-orderable PDF-page-12 binding drifted")
      }
    }
    if (ti.pinMap.length !== 6 || ti.pinMap.map(({ pin }) => pin).join(",") !== "1,2,3,4,5,6") {
      errors.push("TI pin map must contain pins 1 through 6 in order")
    }
    if (ti.package.leadPitchMm !== 0.65 || ti.package.padRowCenterSpanMm !== 2.2) {
      errors.push("TI package geometry drifted")
    }
    if (ti.manufacturerCad.authority !== "deny" || ti.manufacturerCad.artifactPath !== null) {
      errors.push("TI CAD must remain denied and unacquired")
    }
    validatePads(ti.projectFootprint.pads, tiPads, "TI project footprint", errors)
    if (ti.projectFootprint.orientation.boardRotationDegrees !== 0 || ti.projectFootprint.orientation.pinOnePad !== 1) {
      errors.push("TI orientation datum drifted")
    }
  }
  const bss = value.parts.find((part) => part.manufacturerPartNumber === bssPartNumber)
  if (bss === undefined) {
    errors.push("exact Nexperia BSS138AKA record is missing")
  } else {
    if (bss.manufacturer !== "Nexperia" || bss.package.designation !== "SOT23" || bss.package.packageCode !== "SOT23") {
      errors.push("BSS138AKA identity or package drifted")
    }
    if (
      bss.source.artifactPath !== bssSourcePath ||
      bss.source.sha256 !== bssSourceSha256 ||
      !hasUpperSha256(bss.source.sha256)
    ) {
      errors.push("retained Nexperia source identity or SHA-256 drifted")
    }
    if (bss.source.reviewedPrintedPages.join(",") !== "2,12") {
      errors.push("Nexperia reviewed source pages drifted")
    }
    if (bss.pinMap.map(({ pin }) => pin).join(",") !== "1,2,3") {
      errors.push("BSS pin map must contain pins 1 through 3 in order")
    }
    if (bss.package.leadPitchMm !== 1.9 || bss.package.padCenterSpanMm !== 1.4) {
      errors.push("BSS package geometry drifted")
    }
    if (bss.manufacturerCad.authority !== "deny" || bss.manufacturerCad.artifactPath !== null) {
      errors.push("BSS CAD must remain denied and unacquired")
    }
    validatePads(bss.projectFootprint.pads, bssPads, "BSS project footprint", errors)
    if (
      bss.projectFootprint.orientation.boardRotationDegrees !== 0 ||
      bss.projectFootprint.orientation.pinOnePad !== 1
    ) {
      errors.push("BSS orientation datum drifted")
    }
  }
  return errors
}
