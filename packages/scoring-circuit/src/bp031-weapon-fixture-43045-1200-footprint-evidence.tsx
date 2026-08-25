import { Fragment, type ReactElement } from "react"

const circuitPitchMm = 3
const circuitRowSpacingMm = 3
const contactHoleDiameterMm = 1.02
const retentionHoleDiameterMm = 3
const projectCopperPadDiameterMm = 2.2
const projectSolderMaskMarginMm = 0.05

const contactPins = Array.from({ length: 12 }, (_, index) => {
  const pin = index + 1
  const column = (pin - 1) % 6
  return {
    pin,
    xMm: column === 0 ? 0 : -column * circuitPitchMm,
    yMm: pin <= 6 ? 0 : -circuitRowSpacingMm
  }
})

const retentionHoles = [
  { name: "retention-a", xMm: -2.15, yMm: 4.32 },
  { name: "retention-b", xMm: -12.85, yMm: 4.32 }
] as const

/**
 * Review-only BP-031 artwork for the exact BP-104 weapon-fixture header.
 *
 * Molex SD-43045-001 supplies the contact and retention-hole layout. The
 * rendered copper, mask, and any future courtyard are deliberately project
 * review inputs; neither the series drawing nor the retained exact-MPN CAD
 * preview authorizes this artwork for fabrication.
 */
export const bp031WeaponFixture430451200FootprintEvidence = {
  artifactKind: "bp031-weapon-fixture-43045-1200-footprint-evidence",
  workUnit: "BP-031",
  canonicalIdentity: {
    sourceContract: "BP-104",
    boardReference: "J_WEAPON_FIXTURE",
    manufacturer: "Molex",
    manufacturerPartNumber: "43045-1200",
    family: "Micro-Fit 3.0 dual-row right-angle through-hole header",
    positions: 12,
    rows: 2
  },
  sources: {
    manufacturerDrawing: {
      authority: "manufacturer-primary",
      documentNumber: "SD-43045-001",
      revision: "H1",
      url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450600_sd.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-drawing.pdf",
      sha256: "571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A",
      reviewedPages: "1-2",
      exactMpnBinding: "12-circuit finish-A material-table row 43045-1200"
    },
    manufacturerCadPreview: {
      authority: "manufacturer-primary",
      materialNumber: "430451200",
      circuitSize: 12,
      url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/430/43045/430451200.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf",
      sha256: "7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA",
      disposition: "exact-retained-cad-preview-not-footprint-approval"
    },
    bp104Identity: {
      artifactPath: "packages/scoring-circuit/src/bench-prototype-fixture-harness.ts",
      sha256: "281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160",
      binding: "BP-104 J_WEAPON_FIXTURE exact 43045-1200 header, 12 positions, and pin map"
    },
    bp031Identity: {
      artifactPath: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
      sha256: "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144",
      binding: "BP-031 imports J_WEAPON_FIXTURE from BP-104 as the exact 43045-1200 connector record"
    }
  },
  manufacturerGeometry: {
    coordinateConvention:
      "Component-side PCB layout transformed to a review datum: circuit 1 is at (0, 0); circuit numbers increase leftward along the lower row, then leftward along the upper row.",
    contactLayout: {
      contactHoleDiameterMm: { nominal: contactHoleDiameterMm, tolerance: 0.05 },
      circuitPitchMm: { nominal: circuitPitchMm, tolerance: 0.1, nonAccumulated: true },
      rowSpacingMm: { nominal: circuitRowSpacingMm, tolerance: 0.1 },
      pins: contactPins,
      circuitOneDatum: { pin: 1, xMm: 0, yMm: 0, drawingMark: "CIRCUIT 1" },
      numbering: "lower row circuit 1 through 6 right-to-left; upper row circuit 7 through 12 right-to-left"
    },
    retention: {
      holeDiameterMm: { nominal: retentionHoleDiameterMm, tolerance: 0.05 },
      contactToRetentionRowMm: { nominal: 4.32, tolerance: 0.08 },
      endInsetMm: { nominal: 2.15, tolerance: 0.05 },
      retentionHoleSpanMm: { nominal: 10.7, tolerance: 0.08 },
      holes: retentionHoles,
      disposition: "manufacturer-recommended-physical-hole-layout"
    },
    bodyAndMating: {
      headerOverallSpanMm: { nominal: 21.65 },
      headerSideProfileDepthMm: { nominal: 12.24 },
      matingFaceToRearMm: { nominal: 9.91 },
      boardEdgeRule: {
        maximumDistanceMm: 10.16,
        source: "SD-43045-001 note 7",
        rule: "Place the header within 10.16 mm maximum from the PCB edge to avoid interference between the receptacle and PCB."
      },
      mate: {
        manufacturerPartNumber: "43025-1200",
        relation: "Mates with Micro-Fit 3.0 receptacle series 43025",
        status: "BP-104 physical sample-fit remains required"
      },
      exactCadPreview:
        "430451200 retained preview visually confirms the 12-circuit right-angle housing but is not an artwork overlay."
    }
  },
  projectReviewInputs: {
    copperForRenderedContacts: {
      padDiameterMm: projectCopperPadDiameterMm,
      representation: "rounded-rectangle-equivalent-to-circle",
      status: "project-input-not-published-by-molex"
    },
    solderMaskForRenderedContacts: {
      marginMm: projectSolderMaskMarginMm,
      status: "project-input-not-published-by-molex"
    },
    drill: {
      contactNominalMm: contactHoleDiameterMm,
      retentionNominalMm: retentionHoleDiameterMm,
      status: "rendered-at-manufacturer-layout-nominal-no-fabricator-tolerance-or-stackup-approval"
    },
    courtyard: {
      state: "not-selected",
      status: "no-project-courtyard-is-asserted-by-this-review"
    },
    boardPlacement: {
      state: "not-integrated",
      status: "no-board-edge-or-mating-envelope-overlay-is-approved"
    }
  },
  orientation: {
    boardRotationDegrees: 0,
    componentSideView: true,
    pinOne: { pin: 1, xMm: 0, yMm: 0 },
    polarizedToMate: true,
    latchLock: true,
    independentPhysicalReview: "pending",
    status: "review-only"
  },
  renderedArtwork: {
    digestAlgorithm: "SHA-256",
    digest: "2f778ec25537ad72eb5263285f2272c79ed1e0d451ee197ac0e1681fd5188205",
    scope: "ordered plated contact holes, non-plated retention holes, and their review coordinates only"
  },
  acceptance: {
    accepted: false,
    fabricationAuthority: "deny",
    physicalAuthority: "deny",
    remainingGates: [
      "Root review of source-to-artwork overlay and board placement.",
      "Received 43045-1200 and 43025-1200 non-forced fit, circuit-1 mark, latch/lock, edge interference, and retention-peg evidence.",
      "Physical BP-104 fixture evidence acceptance and fabricator drill, mask, courtyard, stackup, and assembly review."
    ]
  }
} as const

function hasExpectedEvidenceShape(value: unknown): value is typeof bp031WeaponFixture430451200FootprintEvidence {
  return value === bp031WeaponFixture430451200FootprintEvidence
}

/** Fail closed unless this exact bounded review record is intact and still denied. */
export function validateBp031WeaponFixture430451200FootprintEvidence(
  value: unknown = bp031WeaponFixture430451200FootprintEvidence
): true {
  if (!hasExpectedEvidenceShape(value)) {
    throw new RangeError("BP-031 43045-1200 review record must be the exact immutable candidate")
  }
  const evidence = value
  const { canonicalIdentity, manufacturerGeometry, orientation, projectReviewInputs, sources } = evidence
  const pins = manufacturerGeometry.contactLayout.pins
  const expectedPins = Array.from({ length: 12 }, (_, index) => ({
    pin: index + 1,
    xMm: index % 6 === 0 ? 0 : -(index % 6) * circuitPitchMm,
    yMm: index < 6 ? 0 : -circuitRowSpacingMm
  }))
  if (
    canonicalIdentity.sourceContract !== "BP-104" ||
    canonicalIdentity.boardReference !== "J_WEAPON_FIXTURE" ||
    canonicalIdentity.manufacturerPartNumber !== "43045-1200" ||
    canonicalIdentity.positions !== 12 ||
    canonicalIdentity.rows !== 2 ||
    sources.manufacturerDrawing.documentNumber !== "SD-43045-001" ||
    sources.manufacturerDrawing.sha256 !== "571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A" ||
    sources.manufacturerCadPreview.sha256 !== "7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA" ||
    sources.bp104Identity.sha256 !== "281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160" ||
    sources.bp031Identity.sha256 !== "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144" ||
    pins.length !== expectedPins.length ||
    pins.some((pin, index) => JSON.stringify(pin) !== JSON.stringify(expectedPins[index])) ||
    manufacturerGeometry.contactLayout.contactHoleDiameterMm.nominal !== contactHoleDiameterMm ||
    manufacturerGeometry.retention.holeDiameterMm.nominal !== retentionHoleDiameterMm ||
    manufacturerGeometry.retention.holes[0].xMm !== -2.15 ||
    manufacturerGeometry.retention.holes[1].xMm !== -12.85 ||
    manufacturerGeometry.retention.holes[0].yMm !== 4.32 ||
    manufacturerGeometry.retention.holes[1].yMm !== 4.32 ||
    manufacturerGeometry.bodyAndMating.boardEdgeRule.maximumDistanceMm !== 10.16 ||
    orientation.boardRotationDegrees !== 0 ||
    orientation.pinOne.pin !== 1 ||
    orientation.pinOne.xMm !== 0 ||
    orientation.pinOne.yMm !== 0 ||
    !orientation.polarizedToMate ||
    !orientation.latchLock ||
    orientation.independentPhysicalReview !== "pending" ||
    projectReviewInputs.courtyard.state !== "not-selected" ||
    evidence.acceptance.accepted ||
    evidence.acceptance.fabricationAuthority !== "deny" ||
    evidence.acceptance.physicalAuthority !== "deny"
  ) {
    throw new RangeError("BP-031 43045-1200 identity, source, pin, orientation, geometry, or deny gate drifted")
  }
  return true
}

const projectFootprint = (
  <footprint name="BP031_MOLEX_43045_1200_REVIEW_ONLY" originalLayer="top">
    {contactPins.map((pin) => (
      <Fragment key={pin.pin}>
        <platedhole
          name={`${pin.pin}`}
          shape="circular_hole_with_rect_pad"
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter={`${contactHoleDiameterMm}mm`}
          rectPadWidth={`${projectCopperPadDiameterMm}mm`}
          rectPadHeight={`${projectCopperPadDiameterMm}mm`}
          rectBorderRadius={`${projectCopperPadDiameterMm / 2}mm`}
          solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
          portHints={[`${pin.pin}`, `pin${pin.pin}`, ...(pin.pin === 1 ? ["circuit-1", "pin1"] : [])]}
        />
      </Fragment>
    ))}
    {retentionHoles.map((hole) => (
      <Fragment key={hole.name}>
        <hole name={hole.name} diameter={`${retentionHoleDiameterMm}mm`} pcbX={hole.xMm} pcbY={hole.yMm} />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp031WeaponFixture430451200FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated component used only to render and hash this deny-by-default review candidate. */
export function Bp031WeaponFixture430451200Footprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031WeaponFixture430451200FootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_BP031_WEAPON_FIXTURE_43045_1200"
      manufacturerPartNumber="43045-1200"
      pinLabels={Object.fromEntries(contactPins.map((pin) => [`pin${pin.pin}`, `${pin.pin}`]))}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031WeaponFixture430451200Footprint
