import { Fragment, type ReactElement } from "react"
import { benchPrototypeDirectWireWeaponLanding } from "./bench-prototype-direct-wire-weapon-landing.js"
import { pcbFabricationContract } from "./pcb-fabrication-constraints.js"

type WeaponSide = "left" | "right"
type WeaponConductor = "A" | "B" | "C"

const conductors = ["A", "B", "C"] as const
const landingPitchMm = 3.81
const sidePitchMm = 18
const testPointOffsetYMm = 5
const anchorOffsetYMm = -4
const solderLandingHoleMm = 1.3
const solderLandingPadMm = 2.8
const testPointHoleMm = 1
const testPointPadMm = 2.4
const solderMaskMarginMm = 0.05
const anchorHoleMm = 3.2
const courtyardClearanceMm = 1

function weaponSide(value: string): WeaponSide {
  if (value === "left" || value === "right") return value
  throw new RangeError("BP-034 direct-wire contract must name only left and right sides")
}

function weaponConductor(value: string): WeaponConductor {
  if (value === "A" || value === "B" || value === "C") return value
  throw new RangeError("BP-034 direct-wire contract must name only A, B, and C conductors")
}

function landingPosition(side: WeaponSide, conductor: WeaponConductor) {
  return {
    xMm: conductors.indexOf(conductor) * landingPitchMm,
    yMm: side === "left" ? 0 : sidePitchMm
  }
}

function sideCode(side: WeaponSide) {
  return side === "left" ? "L" : "R"
}

const landingRows = benchPrototypeDirectWireWeaponLanding.sides.flatMap((side) =>
  side.conductors.map((conductor) => {
    const directWireSide = weaponSide(side.side)
    const directWireConductor = weaponConductor(conductor.conductor)
    const position = landingPosition(directWireSide, directWireConductor)
    return {
      side: directWireSide,
      conductor: directWireConductor,
      boardNet: conductor.boardNet,
      landingPadReference: conductor.landingPadReference,
      testPadReference: conductor.testPadReference,
      boardLabel: conductor.boardLabel,
      xMm: position.xMm,
      yMm: position.yMm,
      testPointYMm: position.yMm + testPointOffsetYMm
    }
  })
)

const anchors = (["left", "right"] as const).flatMap((side) => {
  const yMm = landingPosition(side, "A").yMm + anchorOffsetYMm
  return [
    { side, name: `ANCHOR_WEAPON_${sideCode(side)}_A`, xMm: 0, yMm },
    { side, name: `ANCHOR_WEAPON_${sideCode(side)}_B`, xMm: 2 * landingPitchMm, yMm }
  ]
})

const landingCopperClearanceMm = landingPitchMm - solderLandingPadMm
const solderMaskWebMm = landingPitchMm - (solderLandingPadMm + 2 * solderMaskMarginMm)
const testPointClearanceToLandingMm = testPointOffsetYMm - (solderLandingPadMm / 2 + testPointPadMm / 2)
const anchorCopperClearanceMm = Math.abs(anchorOffsetYMm) - (anchorHoleMm / 2 + solderLandingPadMm / 2)

const sideCourtyards = (["left", "right"] as const).map((side) => {
  const baseY = landingPosition(side, "A").yMm
  const minimumXMm = -anchorHoleMm / 2 - courtyardClearanceMm
  const maximumXMm = 2 * landingPitchMm + anchorHoleMm / 2 + courtyardClearanceMm
  const minimumYMm = baseY + anchorOffsetYMm - anchorHoleMm / 2 - courtyardClearanceMm
  const maximumYMm = baseY + testPointOffsetYMm + testPointPadMm / 2 + courtyardClearanceMm
  return {
    side,
    minimumXMm,
    maximumXMm,
    minimumYMm,
    maximumYMm,
    centerXMm: (minimumXMm + maximumXMm) / 2,
    centerYMm: (minimumYMm + maximumYMm) / 2,
    widthMm: maximumXMm - minimumXMm,
    heightMm: maximumYMm - minimumYMm
  }
})

/**
 * Project-derived footprint for the owner-approved P0 direct-wire option.
 * It is intentionally simple: soldered pigtails, separate probe points, and
 * mechanical strain relief. Production socket geometry remains out of scope.
 */
export const bp034DirectWireWeaponFootprint = {
  artifactKind: "bp034-direct-wire-weapon-project-footprint",
  workUnit: "BP-034",
  prototypeOnly: true,
  derivedFrom: {
    contract: "benchPrototypeDirectWireWeaponLanding",
    geometryAuthority: "project-derived-review-input-not-manufacturer-cad"
  },
  review: {
    state: "root-approved-p0-interface",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    acceptedScope:
      "Prototype-only A/B/C landing and test-point identity, project copper and orientation, strain-relief plan, direct-wire disposition, USB-C-PD preservation, and deny-state integrity.",
    projectGeometryAccepted: true,
    orientationAccepted: true,
    physicalEvidenceAccepted: false
  },
  wireAssumption: {
    intendedConductor: "22 AWG stranded copper pigtail",
    permittedReviewRange: "20 to 24 AWG stranded copper pending received-cable strip and solder trial",
    bareConductorNominalDiameterMm: 0.64,
    rule: "Verify the received cable's stripped conductor and insulation diameter before use; this planning footprint is not a cable or socket rating."
  },
  solderLandings: {
    count: landingRows.length,
    platedThroughHole: {
      finishedHoleDiameterMm: solderLandingHoleMm,
      copperPadDiameterMm: solderLandingPadMm,
      annularRingMm: 0.75,
      solderMaskMarginMm,
      pasteOpeningDiameterMm: 0,
      representation: "circular-hole-with-rounded-rect-pad"
    },
    pitchMm: landingPitchMm,
    copperClearanceMm: landingCopperClearanceMm,
    solderMaskWebMm,
    entries: landingRows.map(({ testPointYMm: _, ...landing }) => landing)
  },
  testPoints: {
    count: landingRows.length,
    placement: "top-side-accessible separate labeled plated-through-hole test point for each landing net",
    platedThroughHole: {
      finishedHoleDiameterMm: testPointHoleMm,
      copperPadDiameterMm: testPointPadMm,
      annularRingMm: 0.7,
      solderMaskMarginMm,
      pasteOpeningDiameterMm: 0,
      representation: "circular-hole-with-rounded-rect-pad"
    },
    landingToTestPointClearanceMm: testPointClearanceToLandingMm,
    requiredProbeKeepoutMm: pcbFabricationContract.designRules.testPointProbeKeepoutMm,
    entries: landingRows.map((landing) => ({
      side: landing.side,
      conductor: landing.conductor,
      boardNet: landing.boardNet,
      testPadReference: landing.testPadReference,
      boardLabel: `${landing.boardLabel} TEST`,
      xMm: landing.xMm,
      yMm: landing.testPointYMm
    }))
  },
  strainReliefAnchors: {
    count: anchors.length,
    material: "non-plated-through-hole cable-tie anchor pair per pigtail",
    holeDiameterMm: anchorHoleMm,
    anchorPairSpanMm: 2 * landingPitchMm,
    cableTieAssumption:
      "up to 2.5 mm wide cable tie or equivalent non-electrical retention method pending physical trial",
    loadPath:
      "Pigtail jacket to anchor, then board mechanical feature; no pull or bend load is assigned to solder joints or plated holes.",
    minimumAnchorToLandingCopperClearanceMm: anchorCopperClearanceMm,
    entries: anchors
  },
  courtyard: {
    clearanceMm: courtyardClearanceMm,
    perSide: sideCourtyards
  },
  constraints: {
    projectMinimumDrillMm: pcbFabricationContract.designRules.minimumViaDrillMm,
    projectMinimumComponentAnnularRingMm: pcbFabricationContract.designRules.minimumComponentAnnularRingMm,
    projectMinimumSolderMaskBridgeMm: pcbFabricationContract.designRules.minimumSoldermaskBridgeMm,
    projectMountingHoleCopperKeepoutMm: pcbFabricationContract.designRules.mountingHoleCopperKeepoutMm,
    satisfied: true
  },
  normalPower: {
    interface: benchPrototypeDirectWireWeaponLanding.normalPower.interface,
    unchanged: benchPrototypeDirectWireWeaponLanding.normalPower.unchanged
  },
  boardImport: {
    state: "accepted-p0",
    rule: "Place on the P0 scoring board; do not reuse as production socket geometry."
  },
  physicalEvidence: {
    state: "open",
    rule: "No fit, wire-strip, solder, pull, bend, retention, or probe-access evidence is claimed."
  },
  productionSocket: { state: "open" },
  fabricationAuthority: "p0-only",
  releaseState: "accepted-p0"
} as const

export function validateBp034DirectWireWeaponFootprint(
  value: typeof bp034DirectWireWeaponFootprint = bp034DirectWireWeaponFootprint
): true {
  const landingContract = benchPrototypeDirectWireWeaponLanding
  const expectedEntries = landingContract.sides.flatMap((side) => side.conductors)
  if (
    value.artifactKind !== "bp034-direct-wire-weapon-project-footprint" ||
    value.workUnit !== "BP-034" ||
    value.prototypeOnly !== true ||
    value.derivedFrom.geometryAuthority !== "project-derived-review-input-not-manufacturer-cad" ||
    value.review.state !== "root-approved-p0-interface" ||
    value.review.reviewer !== "root-final-reviewer" ||
    value.review.projectGeometryAccepted !== true ||
    value.review.orientationAccepted !== true ||
    value.review.physicalEvidenceAccepted !== false ||
    value.solderLandings.count !== 6 ||
    value.testPoints.count !== 6 ||
    value.strainReliefAnchors.count !== 4 ||
    value.normalPower.interface !== "USB-C PD" ||
    value.normalPower.unchanged !== true ||
    value.boardImport.state !== "accepted-p0" ||
    value.physicalEvidence.state !== "open" ||
    value.productionSocket.state !== "open" ||
    value.fabricationAuthority !== "p0-only" ||
    value.releaseState !== "accepted-p0"
  ) {
    throw new RangeError("The direct-wire footprint must remain accepted only for the USB-C-PD P0 board")
  }
  if (
    value.solderLandings.platedThroughHole.annularRingMm < value.constraints.projectMinimumComponentAnnularRingMm ||
    value.testPoints.platedThroughHole.annularRingMm < value.constraints.projectMinimumComponentAnnularRingMm ||
    value.solderLandings.solderMaskWebMm < value.constraints.projectMinimumSolderMaskBridgeMm ||
    value.strainReliefAnchors.minimumAnchorToLandingCopperClearanceMm <
      value.constraints.projectMountingHoleCopperKeepoutMm ||
    value.testPoints.landingToTestPointClearanceMm < value.testPoints.requiredProbeKeepoutMm
  ) {
    throw new RangeError("BP-034 footprint geometry must retain the stated project clearance and annular-ring floors")
  }
  if (
    value.solderLandings.entries.length !== expectedEntries.length ||
    value.testPoints.entries.length !== expectedEntries.length ||
    expectedEntries.some((expected, index) => {
      const solder = value.solderLandings.entries[index]
      const test = value.testPoints.entries[index]
      return (
        solder === undefined ||
        test === undefined ||
        solder.boardNet !== expected.boardNet ||
        solder.landingPadReference !== expected.landingPadReference ||
        solder.boardLabel !== expected.boardLabel ||
        test.boardNet !== expected.boardNet ||
        test.testPadReference !== expected.testPadReference ||
        test.boardLabel !== `${expected.boardLabel} TEST`
      )
    })
  ) {
    throw new RangeError(
      "BP-034 footprint must retain every direct-wire net, landing reference, test reference, and label"
    )
  }
  return true
}

const footprint = (
  <footprint name="BP034_DIRECT_WIRE_WEAPON_PROJECT_FOOTPRINT" originalLayer="top">
    {landingRows.map((landing, index) => (
      <Fragment key={landing.landingPadReference}>
        <platedhole
          name={`${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={landing.xMm}
          pcbY={landing.yMm}
          holeDiameter={`${solderLandingHoleMm}mm`}
          rectPadWidth={`${solderLandingPadMm}mm`}
          rectPadHeight={`${solderLandingPadMm}mm`}
          rectBorderRadius={`${solderLandingPadMm / 2}mm`}
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          portHints={[landing.landingPadReference, landing.boardNet, landing.boardLabel]}
        />
      </Fragment>
    ))}
    {landingRows.map((landing, index) => (
      <Fragment key={landing.testPadReference}>
        <platedhole
          name={`${index + landingRows.length + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={landing.xMm}
          pcbY={landing.testPointYMm}
          holeDiameter={`${testPointHoleMm}mm`}
          rectPadWidth={`${testPointPadMm}mm`}
          rectPadHeight={`${testPointPadMm}mm`}
          rectBorderRadius={`${testPointPadMm / 2}mm`}
          solderMaskMargin={`${solderMaskMarginMm}mm`}
          portHints={[landing.testPadReference, landing.boardNet, `${landing.boardLabel} TEST`]}
        />
      </Fragment>
    ))}
    {anchors.map((anchor) => (
      <Fragment key={anchor.name}>
        <hole name={anchor.name} diameter={`${anchorHoleMm}mm`} pcbX={anchor.xMm} pcbY={anchor.yMm} />
      </Fragment>
    ))}
    {sideCourtyards.map((courtyard) => (
      <Fragment key={courtyard.side}>
        <courtyardrect
          pcbX={courtyard.centerXMm}
          pcbY={courtyard.centerYMm}
          width={`${courtyard.widthMm}mm`}
          height={`${courtyard.heightMm}mm`}
          strokeWidth="0.05mm"
        />
        <silkscreenrect
          pcbX={courtyard.centerXMm}
          pcbY={courtyard.centerYMm}
          width={`${courtyard.widthMm}mm`}
          height={`${courtyard.heightMm}mm`}
          stroke="dashed"
          strokeWidth="0.1mm"
          filled={false}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp034DirectWireWeaponFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

/** Placeable P0 direct-wire weapon interface. */
export function Bp034DirectWireWeaponFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: Bp034DirectWireWeaponFootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_WEAPON_DIRECT"
      kicadSymbolMetadata={{ inBom: false, onBoard: true }}
      pinLabels={Object.fromEntries(
        landingRows.flatMap((landing, index) => [
          [`pin${index + 1}`, landing.boardNet],
          [`pin${index + landingRows.length + 1}`, `${landing.boardNet}_TEST`]
        ])
      )}
      footprint={footprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

validateBp034DirectWireWeaponFootprint()
