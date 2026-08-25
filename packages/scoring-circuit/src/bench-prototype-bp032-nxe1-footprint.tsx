import { Fragment, type ReactElement } from "react"

type Nxe1Terminal = {
  readonly function: "-Vin" | "+Vin" | "-Vout" | "+Vout" | "NA"
  readonly pin: 1 | 3 | 7 | 8 | 14
  readonly portHint: string
  readonly role: "input-negative" | "input-positive" | "output-negative" | "output-positive" | "no-connect"
  readonly xMm: number
  readonly yMm: number
}

type Nxe1Candidate = {
  readonly accepted: false
  readonly artifactKind: "bp032-murata-nxe1-candidate-footprint"
  readonly exactIdentity: {
    readonly manufacturer: "Murata Power Solutions"
    readonly manufacturerPartNumber: "NXE1S0505MC"
    readonly officialProductUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
  }
  readonly fabricationAuthority: "deny"
  readonly manufacturerCad: {
    readonly authority: "deny"
    readonly disposition: "not-acquired-no-substitute"
    readonly officialCadUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
    readonly state: "not-acquired"
  }
  readonly package: {
    readonly bodyMaximumMm: { readonly length: number; readonly width: number }
    readonly bodyNominalMm: { readonly length: number; readonly width: number }
    readonly bodyToleranceMm: number
    readonly heightMaximumMm: number
    readonly pinCount: 14
    readonly pinPitchMm: 2.54
  }
  readonly packageDesignation: "NXE1 SMD 14-position package"
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
      readonly reductionPerEdgeMm: number
      readonly status: "project-review-input-not-specified-by-murata"
    }
    readonly solderMask: {
      readonly heightMm: number
      readonly lengthMm: number
      readonly marginPerEdgeMm: number
      readonly status: "project-review-input-not-specified-by-murata"
    }
  }
  readonly recommendedLandPattern: {
    readonly padLengthMm: number
    readonly padWidthMm: number
    readonly outerColumnCenterSpanMm: number
    readonly rowCenterSpanMm: number
    readonly sourcePage: 6
    readonly status: "manufacturer-recommended-guidance-not-cad"
  }
  readonly source: {
    readonly artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf"
    readonly authority: "manufacturer-primary"
    readonly documentNumber: "KDC_NXE1.A01"
    readonly reviewedPage: 6
    readonly sha256: string
    readonly sourceUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
  }
  readonly sourceApplicability: {
    readonly exactOrderable: { readonly status: "manufacturer-specified"; readonly sourcePage: 1 }
    readonly mechanicalAndPinMap: { readonly status: "manufacturer-specified"; readonly sourcePage: 6 }
    readonly orientation: {
      readonly status: "pin-one-mapped-board-orientation-pending"
      readonly sourcePage: 6
    }
    readonly recommendedFootprint: {
      readonly status: "manufacturer-recommended-guidance-not-cad"
      readonly sourcePage: 6
    }
  }
  readonly terminals: readonly Nxe1Terminal[]
  readonly orientation: {
    readonly convention: "top-view-pin-one-upper-left"
    readonly state: "pending-layout-review"
    readonly note: string
  }
  readonly workUnit: "BP-032"
}

const retainedMurataSource = {
  artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf",
  authority: "manufacturer-primary",
  documentNumber: "KDC_NXE1.A01",
  reviewedPage: 6,
  sha256: "53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40",
  sourceUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf"
} as const

/**
 * The source drawing's recommended footprint is shown without pad numbers.
 * This top-view mapping applies a 180-degree review transform to the drawing's
 * pin arrangement so pin 1 is at the upper-left while preserving every
 * source-dimensioned pad center and the five-land pattern.
 */
const terminals = [
  { function: "-Vin", pin: 1, portHint: "-Vin", role: "input-negative", xMm: -3.81, yMm: -4.7 },
  { function: "+Vin", pin: 3, portHint: "+Vin", role: "input-positive", xMm: -1.27, yMm: -4.7 },
  { function: "-Vout", pin: 7, portHint: "-Vout", role: "output-negative", xMm: 3.81, yMm: -4.7 },
  { function: "+Vout", pin: 8, portHint: "+Vout", role: "output-positive", xMm: 3.81, yMm: 4.7 },
  { function: "NA", pin: 14, portHint: "NA", role: "no-connect", xMm: -3.81, yMm: 4.7 }
] as const satisfies readonly Nxe1Terminal[]

export const benchPrototypeBp032Nxe1FootprintGeometry = {
  accepted: false,
  artifactKind: "bp032-murata-nxe1-candidate-footprint",
  exactIdentity: {
    manufacturer: "Murata Power Solutions",
    manufacturerPartNumber: "NXE1S0505MC",
    officialProductUrl: retainedMurataSource.sourceUrl
  },
  fabricationAuthority: "deny",
  manufacturerCad: {
    authority: "deny",
    disposition: "not-acquired-no-substitute",
    officialCadUrl: retainedMurataSource.sourceUrl,
    state: "not-acquired"
  },
  package: {
    bodyMaximumMm: { length: 12.95, width: 10.66 },
    bodyNominalMm: { length: 12.7, width: 10.41 },
    bodyToleranceMm: 0.25,
    heightMaximumMm: 4.8,
    pinCount: 14,
    pinPitchMm: 2.54
  },
  packageDesignation: "NXE1 SMD 14-position package",
  projectSelection: {
    copper: { heightMm: 2.3, widthMm: 1 },
    courtyard: {
      heightMm: 12.2,
      lengthMm: 13.45,
      minimumClearanceMm: 0.25,
      status: "project-review-input"
    },
    paste: {
      heightMm: 2.2,
      lengthMm: 0.9,
      reductionPerEdgeMm: 0.05,
      status: "project-review-input-not-specified-by-murata"
    },
    solderMask: {
      heightMm: 2.4,
      lengthMm: 1.1,
      marginPerEdgeMm: 0.05,
      status: "project-review-input-not-specified-by-murata"
    }
  },
  recommendedLandPattern: {
    padLengthMm: 2.3,
    padWidthMm: 1,
    outerColumnCenterSpanMm: 7.62,
    rowCenterSpanMm: 9.4,
    sourcePage: 6,
    status: "manufacturer-recommended-guidance-not-cad"
  },
  source: retainedMurataSource,
  sourceApplicability: {
    exactOrderable: { status: "manufacturer-specified", sourcePage: 1 },
    mechanicalAndPinMap: { status: "manufacturer-specified", sourcePage: 6 },
    orientation: { status: "pin-one-mapped-board-orientation-pending", sourcePage: 6 },
    recommendedFootprint: { status: "manufacturer-recommended-guidance-not-cad", sourcePage: 6 }
  },
  terminals,
  orientation: {
    convention: "top-view-pin-one-upper-left",
    state: "pending-layout-review",
    note: "Murata's page-6 mechanical drawing supplies the pin map and the recommended footprint supplies the five pad centers without pad numbers. This review candidate maps pin 1 to the upper-left, pins 1, 3, and 7 across the top row, and pins 14 and 8 across the bottom row after a documented 180-degree review transform. The source drawing does not close final PCB assembly orientation."
  },
  workUnit: "BP-032"
} as const satisfies Nxe1Candidate

function nxe1Footprint() {
  const { copper, paste, solderMask } = benchPrototypeBp032Nxe1FootprintGeometry.projectSelection
  return (
    <footprint name="BP032_NXE1S0505MC_CANDIDATE" originalLayer="top">
      {benchPrototypeBp032Nxe1FootprintGeometry.terminals.map((terminal) => (
        <Fragment key={terminal.pin}>
          <smtpad
            name={`${terminal.pin}`}
            pcbX={`${terminal.xMm}mm`}
            pcbY={`${terminal.yMm}mm`}
            shape="rect"
            solderMaskMargin={`${solderMask.marginPerEdgeMm}mm`}
            solderPasteMargin={`${-paste.reductionPerEdgeMm}mm`}
            width={`${copper.widthMm}mm`}
            height={`${copper.heightMm}mm`}
            portHints={[
              `${terminal.pin}`,
              terminal.portHint,
              terminal.role,
              ...(terminal.pin === 1 ? ["pin1"] : []),
              ...(terminal.pin === 14 ? ["no-connect"] : [])
            ]}
          />
        </Fragment>
      ))}
      {/* Project review overlay only; this is not Murata CAD. */}
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${benchPrototypeBp032Nxe1FootprintGeometry.projectSelection.courtyard.lengthMm}mm`}
        height={`${benchPrototypeBp032Nxe1FootprintGeometry.projectSelection.courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

export interface BenchPrototypeBp032Nxe1FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-032 review candidate for the exact Murata NXE1S0505MC. */
export function BenchPrototypeBp032Nxe1Footprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032Nxe1FootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_NXE1S0505MC"
      manufacturerPartNumber="NXE1S0505MC"
      pinLabels={{ pin1: "-Vin", pin3: "+Vin", pin7: "-Vout", pin8: "+Vout", pin14: "NA" }}
      footprint={nxe1Footprint()}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function validateBenchPrototypeBp032Nxe1FootprintGeometry(
  candidate: Nxe1Candidate = benchPrototypeBp032Nxe1FootprintGeometry
): true {
  const expectedPins = [1, 3, 7, 8, 14] as const
  const actualPins = candidate.terminals.map((terminal) => terminal.pin)
  if (
    candidate.workUnit !== "BP-032" ||
    candidate.exactIdentity.manufacturer !== "Murata Power Solutions" ||
    candidate.exactIdentity.manufacturerPartNumber !== "NXE1S0505MC" ||
    candidate.packageDesignation !== "NXE1 SMD 14-position package" ||
    candidate.package.pinCount !== 14 ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted ||
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.recommendedLandPattern.status !== "manufacturer-recommended-guidance-not-cad" ||
    candidate.orientation.state !== "pending-layout-review" ||
    actualPins.length !== expectedPins.length ||
    expectedPins.some((pin) => !actualPins.includes(pin)) ||
    new Set(actualPins).size !== actualPins.length ||
    candidate.terminals.some((terminal) => terminal.pin === 14 && terminal.function !== "NA")
  )
    throw new RangeError("BP-032 NXE1 candidate must retain the exact five-land map and fabrication denial")
  return true
}

export default BenchPrototypeBp032Nxe1Footprint
