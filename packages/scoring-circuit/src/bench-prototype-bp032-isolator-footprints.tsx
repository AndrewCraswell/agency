import { Fragment, type ReactElement } from "react"

type TiEvidence = {
  readonly authority: "manufacturer-primary"
  readonly artifactPath: string
  readonly documentNumber: string
  readonly reviewedPages: readonly number[]
  readonly sha256: string
  readonly sourceUrl: string
}

type IsolatorPin = {
  readonly pin: number
  readonly side: "input" | "output"
  readonly xMm: number
  readonly yMm: number
  readonly portHint: string
}

type IsolatorCandidate = {
  readonly accepted: false
  readonly artifactKind: "bp032-ti-isolator-candidate-footprint"
  readonly exactIdentity: {
    readonly manufacturer: "Texas Instruments"
    readonly manufacturerPartNumber: "ISO7721FDR" | "ISO7762FDWR"
    readonly officialProductUrl: string
    readonly package: "D (SOIC-8)" | "DW (SOIC-16 wide)"
  }
  readonly fabricationAuthority: "deny"
  readonly manufacturerCad: {
    readonly authority: "deny"
    readonly disposition: "not-acquired-no-substitute"
    readonly officialCadUrl: string
    readonly state: "not-acquired"
  }
  readonly package: {
    readonly bodyMaximumMm: { readonly length: number; readonly width: number }
    readonly bodyNominalMm: { readonly length: number; readonly width: number }
    readonly heightMaximumMm: number
    readonly pinCount: 8 | 16
    readonly pinPitchMm: 1.27
    readonly rowAxis: "x"
    readonly sequenceAxis: "y"
  }
  readonly packageDesignation: "D (SOIC-8)" | "DW (SOIC-16 wide)"
  readonly projectSelection: {
    readonly copper: { readonly heightMm: number; readonly widthMm: number }
    readonly courtyard: {
      readonly heightMm: number
      readonly lengthMm: number
      readonly minimumClearanceMm: number
      readonly status: "project-review-input"
    }
    readonly paste: {
      readonly heightMm: number
      readonly lengthMm: number
      readonly status: "copied-from-ti-stencil-example"
      readonly stencilThicknessMm: number
    }
    readonly solderMask: {
      readonly heightMm: number
      readonly insetPerEdgeMm: number
      readonly lengthMm: number
      readonly status: "project-rendered-solder-mask-defined"
    }
  }
  readonly source: TiEvidence
  readonly sourceApplicability: {
    readonly exactOrderable: {
      readonly sourcePages: readonly number[]
      readonly status: "manufacturer-specified-exact-orderable"
    }
    readonly package: {
      readonly sourcePages: readonly number[]
      readonly status: "manufacturer-specified-package"
    }
    readonly body: { readonly sourcePage: number; readonly status: "manufacturer-specified" }
    readonly hvIsolationLandPattern: {
      readonly sourcePage: number
      readonly status: "manufacturer-example-not-cad"
    }
    readonly pinOne: { readonly sourcePage: number; readonly status: "manufacturer-specified" }
  }
  readonly terminals: readonly IsolatorPin[]
  readonly orientation: {
    readonly convention: "top-view-pin-one-upper-left"
    readonly state: "pending-layout-review"
    readonly note: string
  }
  readonly workUnit: "BP-032"
}

const iso7762Source = {
  authority: "manufacturer-primary",
  artifactPath: "docs/evidence/bp-032/ti-iso7762.pdf",
  documentNumber: "SLLSER1H",
  reviewedPages: [1, 4, 38, 42, 44, 45, 46, 47, 48],
  sha256: "FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22",
  sourceUrl: "https://www.ti.com/lit/ds/symlink/iso7762.pdf"
} as const satisfies TiEvidence

const iso7721Source = {
  authority: "manufacturer-primary",
  artifactPath: "docs/evidence/bp-032/ti-iso7721.pdf",
  documentNumber: "SLLSEP3G",
  reviewedPages: [1, 5, 34, 35, 36, 37, 38, 41, 43],
  sha256: "FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C",
  sourceUrl: "https://www.ti.com/lit/ds/symlink/iso7721.pdf"
} as const satisfies TiEvidence

const iso7762PinRowCenterMm = 9.75 / 2
const iso7762PinFirstYmm = -(7 * 1.27) / 2
const iso7721PinRowCenterMm = 5.5 / 2
const iso7721PinFirstYmm = -(3 * 1.27) / 2

function pinRows(
  pinCount: 8 | 16,
  rowCenterMm: number,
  firstYmm: number,
  sidePins: number,
  padWidthMm: number
): readonly IsolatorPin[] {
  const leftPins = Array.from({ length: sidePins }, (_, index) => ({
    pin: index + 1,
    side: "input" as const,
    xMm: -rowCenterMm,
    yMm: firstYmm + index * 1.27,
    portHint: `pin${index + 1}`
  }))
  const rightPins = Array.from({ length: sidePins }, (_, index) => ({
    pin: pinCount - index,
    side: "output" as const,
    xMm: rowCenterMm,
    yMm: firstYmm + index * 1.27,
    portHint: `pin${pinCount - index}`
  }))
  if (padWidthMm <= 0) throw new RangeError("BP-032 isolator pad width must be positive")
  return [...leftPins, ...rightPins]
}

export const benchPrototypeBp032IsolatorFootprintGeometries = {
  iso7721: {
    accepted: false,
    artifactKind: "bp032-ti-isolator-candidate-footprint",
    exactIdentity: {
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "ISO7721FDR",
      officialProductUrl: "https://www.ti.com/product/ISO7721",
      package: "D (SOIC-8)"
    },
    fabricationAuthority: "deny",
    manufacturerCad: {
      authority: "deny",
      disposition: "not-acquired-no-substitute",
      officialCadUrl: "https://www.ti.com/product/ISO7721",
      state: "not-acquired"
    },
    package: {
      bodyMaximumMm: { length: 5, width: 3.98 },
      bodyNominalMm: { length: 4.9, width: 3.91 },
      heightMaximumMm: 1.75,
      pinCount: 8,
      pinPitchMm: 1.27,
      rowAxis: "x",
      sequenceAxis: "y"
    },
    packageDesignation: "D (SOIC-8)",
    projectSelection: {
      copper: { heightMm: 0.6, widthMm: 1.4 },
      courtyard: {
        heightMm: 4.91,
        lengthMm: 7.4,
        minimumClearanceMm: 0.25,
        status: "project-review-input"
      },
      paste: {
        heightMm: 0.6,
        lengthMm: 1.4,
        status: "copied-from-ti-stencil-example",
        stencilThicknessMm: 0.127
      },
      solderMask: {
        heightMm: 0.46,
        insetPerEdgeMm: 0.07,
        lengthMm: 1.26,
        status: "project-rendered-solder-mask-defined"
      }
    },
    source: iso7721Source,
    sourceApplicability: {
      exactOrderable: {
        sourcePages: [37, 38, 41, 43],
        status: "manufacturer-specified-exact-orderable"
      },
      package: {
        sourcePages: [34, 35, 36, 37],
        status: "manufacturer-specified-package"
      },
      body: { sourcePage: 34, status: "manufacturer-specified" },
      hvIsolationLandPattern: { sourcePage: 35, status: "manufacturer-example-not-cad" },
      pinOne: { sourcePage: 5, status: "manufacturer-specified" }
    },
    terminals: pinRows(8, iso7721PinRowCenterMm, iso7721PinFirstYmm, 4, 0.6),
    orientation: {
      convention: "top-view-pin-one-upper-left",
      state: "pending-layout-review",
      note: "TI's Figure 5-4 D/DWV 8-pin top view on page 5 places pin 1 at the upper-left pad. This candidate maps the left row 1 through 4 top-to-bottom and the right row 5 through 8 bottom-to-top; final assembly orientation remains a layout review item."
    },
    workUnit: "BP-032"
  },
  iso7762: {
    accepted: false,
    artifactKind: "bp032-ti-isolator-candidate-footprint",
    exactIdentity: {
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "ISO7762FDWR",
      officialProductUrl: "https://www.ti.com/product/ISO7762",
      package: "DW (SOIC-16 wide)"
    },
    fabricationAuthority: "deny",
    manufacturerCad: {
      authority: "deny",
      disposition: "not-acquired-no-substitute",
      officialCadUrl: "https://www.ti.com/product/ISO7762",
      state: "not-acquired"
    },
    package: {
      bodyMaximumMm: { length: 10.5, width: 7.6 },
      bodyNominalMm: { length: 10.3, width: 7.5 },
      heightMaximumMm: 2.65,
      pinCount: 16,
      pinPitchMm: 1.27,
      rowAxis: "x",
      sequenceAxis: "y"
    },
    packageDesignation: "DW (SOIC-16 wide)",
    projectSelection: {
      copper: { heightMm: 0.6, widthMm: 1.65 },
      courtyard: {
        heightMm: 9.99,
        lengthMm: 11.9,
        minimumClearanceMm: 0.25,
        status: "project-review-input"
      },
      paste: {
        heightMm: 0.6,
        lengthMm: 1.65,
        status: "copied-from-ti-stencil-example",
        stencilThicknessMm: 0.125
      },
      solderMask: {
        heightMm: 0.46,
        insetPerEdgeMm: 0.07,
        lengthMm: 1.51,
        status: "project-rendered-solder-mask-defined"
      }
    },
    source: iso7762Source,
    sourceApplicability: {
      exactOrderable: {
        sourcePages: [38, 42, 44],
        status: "manufacturer-specified-exact-orderable"
      },
      package: {
        sourcePages: [45, 46, 47, 48],
        status: "manufacturer-specified-package"
      },
      body: { sourcePage: 45, status: "manufacturer-specified" },
      hvIsolationLandPattern: { sourcePage: 47, status: "manufacturer-example-not-cad" },
      pinOne: { sourcePage: 4, status: "manufacturer-specified" }
    },
    terminals: pinRows(16, iso7762PinRowCenterMm, iso7762PinFirstYmm, 8, 0.6),
    orientation: {
      convention: "top-view-pin-one-upper-left",
      state: "pending-layout-review",
      note: "TI's page-4 source view and DW0016B land example place pin 1 at the upper-left pad. This candidate maps the left row 1 through 8 top-to-bottom and the right row 9 through 16 bottom-to-top; final assembly orientation remains a layout review item."
    },
    workUnit: "BP-032"
  }
} as const satisfies Readonly<Record<string, IsolatorCandidate>>

const padGeometryByMpn = {
  ISO7721FDR: benchPrototypeBp032IsolatorFootprintGeometries.iso7721,
  ISO7762FDWR: benchPrototypeBp032IsolatorFootprintGeometries.iso7762
} as const

const evidenceRequirementsByMpn = {
  ISO7721FDR: {
    artifactPath: "docs/evidence/bp-032/ti-iso7721.pdf",
    documentNumber: "SLLSEP3G",
    sha256: "FB039C00CEB601B93618004839B2108D3358777A019F2526BCA427B7F6C0649C",
    reviewedPages: [1, 5, 34, 35, 36, 37, 38, 41, 43],
    exactOrderablePages: [37, 38, 41, 43],
    packagePages: [34, 35, 36, 37],
    pinOnePage: 5
  },
  ISO7762FDWR: {
    artifactPath: "docs/evidence/bp-032/ti-iso7762.pdf",
    documentNumber: "SLLSER1H",
    sha256: "FC874E117FFEFC489C82677A76580002A55C9DFD0BEC7C800AF8300DBBF8FF22",
    reviewedPages: [1, 4, 38, 42, 44, 45, 46, 47, 48],
    exactOrderablePages: [38, 42, 44],
    packagePages: [45, 46, 47, 48],
    pinOnePage: 4
  }
} as const satisfies Record<
  IsolatorCandidate["exactIdentity"]["manufacturerPartNumber"],
  {
    readonly artifactPath: string
    readonly documentNumber: string
    readonly sha256: string
    readonly reviewedPages: readonly number[]
    readonly exactOrderablePages: readonly number[]
    readonly packagePages: readonly number[]
    readonly pinOnePage: number
  }
>

function includesEveryPage(reviewedPages: readonly number[], citedPages: readonly number[]) {
  return citedPages.every((page) => reviewedPages.includes(page))
}

function sourceApplicabilityMatches(candidate: IsolatorCandidate) {
  const expectedEvidence = evidenceRequirementsByMpn[candidate.exactIdentity.manufacturerPartNumber]
  if (expectedEvidence === undefined) return false
  return (
    candidate.source.artifactPath === expectedEvidence.artifactPath &&
    candidate.source.documentNumber === expectedEvidence.documentNumber &&
    candidate.source.sha256 === expectedEvidence.sha256 &&
    includesEveryPage(candidate.source.reviewedPages, expectedEvidence.reviewedPages) &&
    candidate.sourceApplicability.exactOrderable.status === "manufacturer-specified-exact-orderable" &&
    includesEveryPage(candidate.source.reviewedPages, candidate.sourceApplicability.exactOrderable.sourcePages) &&
    includesEveryPage(candidate.sourceApplicability.exactOrderable.sourcePages, expectedEvidence.exactOrderablePages) &&
    candidate.sourceApplicability.package.status === "manufacturer-specified-package" &&
    includesEveryPage(candidate.source.reviewedPages, candidate.sourceApplicability.package.sourcePages) &&
    includesEveryPage(candidate.sourceApplicability.package.sourcePages, expectedEvidence.packagePages) &&
    candidate.source.reviewedPages.includes(candidate.sourceApplicability.body.sourcePage) &&
    candidate.source.reviewedPages.includes(candidate.sourceApplicability.hvIsolationLandPattern.sourcePage) &&
    candidate.sourceApplicability.pinOne.sourcePage === expectedEvidence.pinOnePage &&
    candidate.source.reviewedPages.includes(candidate.sourceApplicability.pinOne.sourcePage)
  )
}

function candidateFor(mpn: keyof typeof padGeometryByMpn) {
  return padGeometryByMpn[mpn]
}

function footprintFor(candidate: IsolatorCandidate) {
  const { copper, solderMask } = candidate.projectSelection
  return (
    <footprint name={`BP032_${candidate.exactIdentity.manufacturerPartNumber}_CANDIDATE`} originalLayer="top">
      {candidate.terminals.map((terminal) => (
        <Fragment key={terminal.pin}>
          <smtpad
            name={`${terminal.pin}`}
            pcbX={`${terminal.xMm}mm`}
            pcbY={`${terminal.yMm}mm`}
            shape="rect"
            solderMaskMargin={`${-solderMask.insetPerEdgeMm}mm`}
            solderPasteMargin="0mm"
            width={`${copper.widthMm}mm`}
            height={`${copper.heightMm}mm`}
            portHints={[`${terminal.pin}`, terminal.portHint, terminal.side, ...(terminal.pin === 1 ? ["pin1"] : [])]}
          />
        </Fragment>
      ))}
      {/* Project review overlay only; this is not manufacturer CAD. */}
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${candidate.projectSelection.courtyard.lengthMm}mm`}
        height={`${candidate.projectSelection.courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

export interface BenchPrototypeBp032Iso7762FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

export interface BenchPrototypeBp032Iso7721FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

export function BenchPrototypeBp032Iso7762Footprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032Iso7762FootprintProps = {}): ReactElement {
  const candidate = candidateFor("ISO7762FDWR")
  return (
    <chip
      name="U_BP032_ISO7762FDWR"
      manufacturerPartNumber={candidate.exactIdentity.manufacturerPartNumber}
      pinLabels={Object.fromEntries(candidate.terminals.map((terminal) => [`pin${terminal.pin}`, `${terminal.pin}`]))}
      footprint={footprintFor(candidate)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function BenchPrototypeBp032Iso7721Footprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032Iso7721FootprintProps = {}): ReactElement {
  const candidate = candidateFor("ISO7721FDR")
  return (
    <chip
      name="U_BP032_ISO7721FDR"
      manufacturerPartNumber={candidate.exactIdentity.manufacturerPartNumber}
      pinLabels={Object.fromEntries(candidate.terminals.map((terminal) => [`pin${terminal.pin}`, `${terminal.pin}`]))}
      footprint={footprintFor(candidate)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function validateBenchPrototypeBp032IsolatorFootprintGeometries(
  candidates: Readonly<Record<string, IsolatorCandidate>> = benchPrototypeBp032IsolatorFootprintGeometries
): true {
  const expected = ["ISO7721FDR", "ISO7762FDWR"] as const
  const actual = Object.values(candidates).map((candidate) => candidate.exactIdentity.manufacturerPartNumber)
  if (
    actual.length !== expected.length ||
    new Set(actual).size !== actual.length ||
    expected.some((mpn) => !actual.includes(mpn)) ||
    Object.values(candidates).some(
      (candidate) =>
        candidate.workUnit !== "BP-032" ||
        candidate.exactIdentity.manufacturer !== "Texas Instruments" ||
        candidate.fabricationAuthority !== "deny" ||
        candidate.accepted ||
        candidate.manufacturerCad.state !== "not-acquired" ||
        candidate.manufacturerCad.authority !== "deny" ||
        candidate.orientation.state !== "pending-layout-review" ||
        candidate.terminals.length !== candidate.package.pinCount ||
        candidate.terminals.some((terminal) => terminal.portHint !== `pin${terminal.pin}`) ||
        !sourceApplicabilityMatches(candidate)
    )
  )
    throw new RangeError("BP-032 TI isolator candidates must remain exact, isolated, and fabrication-denied")
  return true
}

export default BenchPrototypeBp032Iso7762Footprint
