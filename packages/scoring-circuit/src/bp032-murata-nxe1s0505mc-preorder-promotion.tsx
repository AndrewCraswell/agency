import type { ReactElement } from "react"
import {
  Bp032MurataNxe1s0505mcCandidate,
  bp032MurataNxe1s0505mcCandidate
} from "./bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.js"

type GraphComparison = "shape" | "exact"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-032 NXE1 promotion evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 NXE1 promotion evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/** Descriptor-safe graph comparison. Any reflective or graph anomaly fails closed. */
function compareDataGraph(actual: unknown, expected: unknown, comparison: GraphComparison): boolean {
  const actualSeen = new WeakSet<object>()
  const expectedSeen = new WeakSet<object>()

  function compareNode(left: unknown, right: unknown): boolean {
    try {
      const leftObject = left !== null && typeof left === "object"
      const rightObject = right !== null && typeof right === "object"
      if (!leftObject || !rightObject) {
        return comparison === "exact"
          ? Object.is(left, right)
          : typeof left === typeof right && (left === null ? right === null : right !== null)
      }
      if (actualSeen.has(left) || expectedSeen.has(right)) return false
      actualSeen.add(left)
      expectedSeen.add(right)
      if (
        Object.getPrototypeOf(left) !== Object.getPrototypeOf(right) ||
        Array.isArray(left) !== Array.isArray(right)
      ) {
        return false
      }
      const leftKeys = Reflect.ownKeys(left)
      const rightKeys = Reflect.ownKeys(right)
      if (
        leftKeys.length !== rightKeys.length ||
        leftKeys.some((key) => !rightKeys.includes(key)) ||
        rightKeys.some((key) => !leftKeys.includes(key))
      ) {
        return false
      }
      return rightKeys.every((key) => {
        const leftDescriptor = Object.getOwnPropertyDescriptor(left, key)
        const rightDescriptor = Object.getOwnPropertyDescriptor(right, key)
        if (
          leftDescriptor === undefined ||
          rightDescriptor === undefined ||
          !("value" in leftDescriptor) ||
          !("value" in rightDescriptor) ||
          leftDescriptor.enumerable !== rightDescriptor.enumerable ||
          leftDescriptor.configurable !== rightDescriptor.configurable ||
          leftDescriptor.writable !== rightDescriptor.writable
        ) {
          return false
        }
        return compareNode(leftDescriptor.value, rightDescriptor.value)
      })
    } catch {
      return false
    }
  }

  return compareNode(actual, expected)
}

const integrationBasisCommit = "79d40c1"
const isolationChannelSourceSha256 = "2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1"
const processorSupportSourceSha256 = "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20"
const bomSourceSha256 = "E9B80CE4FD71C33DB626AD2F149B05DC1E62354B2C6A961EF5FDEFCD904188F0"
const retainedMurataSourceSha256 = "53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40"
const renderedGeometrySha256 = "02C8560D829B499945E420E24D225182D52B0A4AF5C4AF5461E52B284E777FFA"
const sourceCandidateArtifactPath =
  "packages/scoring-circuit/src/bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint.tsx"

const sourceCandidate = structuredClone(bp032MurataNxe1s0505mcCandidate)

const candidateDefinition = {
  ...sourceCandidate,
  artifactKind: "bp032-murata-nxe1s0505mc-preorder-promotion-candidate",
  gates: { ...sourceCandidate.gates, physicalTest: "deny" as const },
  preOrderPromotion: {
    state: "candidate-unapproved" as const,
    scope:
      "Root-approval-required promotion of the exact project-review footprint for prototype pre-order planning only; it is not manufacturer CAD, board placement, fabrication, release, or physical acceptance.",
    integrationBasisCommit,
    sourceCandidateArtifactPath,
    sourceCandidateArtifactKind: sourceCandidate.artifactKind,
    sourceContracts: ["BP-122", "BP-125"] as const,
    exactIdentityReviewed: true as const,
    packageAndPinMapReviewed: true as const,
    projectGeometrySource: "existing-root-corrected-project-review-artwork" as const,
    projectArtwork: {
      representation: sourceCandidate.artwork.representation,
      generator: sourceCandidate.artwork.generator,
      generatorVersion: sourceCandidate.artwork.generatorVersion,
      sha256: renderedGeometrySha256,
      artifactPath: sourceCandidateArtifactPath,
      hashBound: true as const
    },
    correctedOrientation: {
      state: "root-corrected-source-view" as const,
      sourcePage: 6,
      convention: "top-view +Y-up" as const,
      pinOne: { pad: "1", function: "-Vin", xMm: -3.81, yMm: -4.7 },
      pinFourteen: { pad: "14", function: "NA", xMm: -3.81, yMm: 4.7 },
      reviewTransform: "no transform; page-6 top view retained" as const
    },
    rootApproval: {
      required: true as const,
      granted: false as const,
      authority: "root-only" as const,
      decisionRecord: null
    }
  },
  physicalTest: {
    state: "not-run" as const,
    authority: "deny" as const,
    accepted: false as const,
    note: "No received-part fit, solder, continuity, isolation, thermal, load, startup, ripple, or destructive physical test is claimed by this pre-order candidate."
  },
  acceptance: {
    ...sourceCandidate.acceptance,
    preOrderFootprintApproved: false as const,
    physicalTestAccepted: false as const
  },
  accepted: false as const
} as const

const bp032MurataNxe1s0505mcPreorderPromotionBaseline = deepFreeze(structuredClone(candidateDefinition))

export const bp032MurataNxe1s0505mcPreorderPromotion = deepFreeze(candidateDefinition)

export type Bp032MurataNxe1s0505mcPreorderPromotion = typeof bp032MurataNxe1s0505mcPreorderPromotion

export interface Bp032MurataNxe1s0505mcPreorderPromotionProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Reuses the existing root-corrected project-review artwork without creating a second footprint. */
export function Bp032MurataNxe1s0505mcPreorderPromotion({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032MurataNxe1s0505mcPreorderPromotionProps = {}): ReactElement {
  return <Bp032MurataNxe1s0505mcCandidate pcbRotation={pcbRotation} pcbX={pcbX} pcbY={pcbY} />
}

type Candidate = typeof candidateDefinition

function hasExpectedCandidateShape(value: unknown): value is Candidate {
  return compareDataGraph(value, bp032MurataNxe1s0505mcPreorderPromotionBaseline, "shape")
}

/** Return exact failures; an empty result means only the bounded promotion candidate is internally consistent. */
export function validateBp032MurataNxe1s0505mcPreorderPromotion(
  value: unknown = bp032MurataNxe1s0505mcPreorderPromotion
): readonly string[] {
  if (!hasExpectedCandidateShape(value)) {
    return ["BP-032 NXE1 promotion graph, descriptor, or deny-state shape drifted"]
  }

  const errors: string[] = []
  const source = value.sources[0]
  if (
    value.artifactKind !== "bp032-murata-nxe1s0505mc-preorder-promotion-candidate" ||
    value.workUnit !== "BP-032" ||
    value.sourceContract !== "BP-122" ||
    value.canonicalReference !== "U_ISO_POWER" ||
    value.manufacturer !== "Murata Power Solutions" ||
    value.manufacturerPartNumber !== "NXE1S0505MC" ||
    value.package.designation !== "NXE1 SMD 14-position package" ||
    value.package.pinCount !== 14 ||
    value.package.pinPitchMm !== 2.54
  ) {
    errors.push("BP-032 exact U_ISO_POWER NXE1S0505MC identity or package drifted")
  }
  if (
    source === undefined ||
    source.authority !== "manufacturer-primary" ||
    source.documentNumber !== "KDC_NXE1.A01" ||
    source.artifactPath !== "packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf" ||
    source.sha256 !== retainedMurataSourceSha256 ||
    value.sourceBinding.sourceSha256 !== retainedMurataSourceSha256 ||
    value.sourceBinding.canonicalReferenceHandoff.reference !== "U_ISO_POWER" ||
    value.sourceBinding.canonicalReferenceHandoff.manufacturerPartNumber !== "NXE1S0505MC" ||
    value.sourceBinding.isolationContract.identityValue !== "NXE1S0505MC" ||
    value.sourceBinding.isolationContract.sourceSha256 !== isolationChannelSourceSha256 ||
    value.sourceBinding.processorSupportContract.workUnit !== "BP-125" ||
    value.sourceBinding.processorSupportContract.sourceSha256 !== processorSupportSourceSha256 ||
    value.sourceBinding.bomSourceSha256 !== bomSourceSha256 ||
    value.sourceControl.upstreamSources.length !== 3 ||
    value.sourceControl.upstreamSources[0]?.sha256 !== isolationChannelSourceSha256 ||
    value.sourceControl.upstreamSources[1]?.sha256 !== processorSupportSourceSha256 ||
    value.sourceControl.upstreamSources[2]?.sha256 !== bomSourceSha256
  ) {
    errors.push("BP-032 retained Murata source and upstream identity contracts drifted")
  }
  if (
    JSON.stringify(value.terminals) !==
      JSON.stringify([
        { pad: "1", function: "-Vin", role: "input-negative", xMm: -3.81, yMm: -4.7 },
        { pad: "3", function: "+Vin", role: "input-positive", xMm: -1.27, yMm: -4.7 },
        { pad: "7", function: "-Vout", role: "output-negative", xMm: 3.81, yMm: -4.7 },
        { pad: "8", function: "+Vout", role: "output-positive", xMm: 3.81, yMm: 4.7 },
        { pad: "14", function: "NA", role: "no-connect", xMm: -3.81, yMm: 4.7 }
      ]) ||
    value.manufacturerLandPattern.sourcePage !== 6 ||
    value.manufacturerLandPattern.padLengthMm !== 2.3 ||
    value.manufacturerLandPattern.padWidthMm !== 1 ||
    value.manufacturerLandPattern.outerColumnCenterSpanMm !== 7.62 ||
    value.manufacturerLandPattern.rowCenterSpanMm !== 9.4 ||
    value.manufacturerLandPattern.sourceScope !== "manufacturer-recommended-guidance-not-CAD" ||
    value.projectSelection.authority !== "project-review-input-not-manufacturer-CAD" ||
    value.projectSelection.courtyard.lengthMm !== 13.45 ||
    value.projectSelection.courtyard.widthMm !== 12.2
  ) {
    errors.push("BP-032 Murata guidance and project geometry must remain separately bounded")
  }
  if (
    value.orientation.manufacturerPinOne !== "pin 1 is the lower-left land in the page-6 drawing with +Y-up" ||
    value.orientation.manufacturerPinFourteen !== "pin 14 is the upper-left land in the page-6 drawing with +Y-up" ||
    value.orientation.projectConvention !== "top-view +Y-up pin-one lower-left" ||
    value.orientation.reviewTransform !==
      "no transform; page-6 top view is retained in the chosen +Y-up coordinate system" ||
    value.projectArtwork.orientation !==
      "project top-view +Y-up pin-one lower-left and pin-14 upper-left; assembly rotation pending" ||
    value.preOrderPromotion.correctedOrientation.state !== "root-corrected-source-view" ||
    value.preOrderPromotion.correctedOrientation.pinOne.xMm !== -3.81 ||
    value.preOrderPromotion.correctedOrientation.pinOne.yMm !== -4.7 ||
    value.preOrderPromotion.correctedOrientation.pinFourteen.xMm !== -3.81 ||
    value.preOrderPromotion.correctedOrientation.pinFourteen.yMm !== 4.7
  ) {
    errors.push("BP-032 root-corrected lower-left pin-one orientation drifted")
  }
  if (
    value.artwork.state !== "generated-project-review-only" ||
    value.artwork.authority !== "deny" ||
    value.artwork.sha256 !== renderedGeometrySha256 ||
    value.preOrderPromotion.projectArtwork.hashBound !== true ||
    value.preOrderPromotion.projectArtwork.sha256 !== renderedGeometrySha256 ||
    value.preOrderPromotion.projectArtwork.artifactPath !== sourceCandidateArtifactPath
  ) {
    errors.push("BP-032 existing project-review artwork binding drifted")
  }
  if (
    value.preOrderPromotion.state !== "candidate-unapproved" ||
    value.preOrderPromotion.integrationBasisCommit !== integrationBasisCommit ||
    value.preOrderPromotion.sourceCandidateArtifactPath !== sourceCandidateArtifactPath ||
    value.preOrderPromotion.sourceCandidateArtifactKind !==
      "bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint" ||
    value.preOrderPromotion.rootApproval.required !== true ||
    value.preOrderPromotion.rootApproval.granted !== false ||
    value.preOrderPromotion.rootApproval.authority !== "root-only" ||
    value.accepted ||
    value.acceptance.preOrderFootprintApproved ||
    value.acceptance.projectArtworkAccepted ||
    value.acceptance.orientationAccepted
  ) {
    errors.push("BP-032 pre-order promotion must remain root-approval-required and unapproved")
  }
  if (
    value.manufacturerCad.state !== "not-acquired" ||
    value.manufacturerCad.authority !== "deny" ||
    value.manufacturerCad.retainedArtifactPath !== null ||
    value.manufacturerCad.sha256 !== null ||
    value.placementReview.boardIntegrationAuthority !== "deny" ||
    value.placementReview.boardFitAccepted ||
    value.physicalIsolationReview.authority !== "deny" ||
    value.physicalIsolationReview.physicalIsolationAccepted ||
    value.physicalIsolationReview.slotAccepted ||
    value.physicalIsolationReview.creepageAccepted ||
    value.physicalIsolationReview.clearanceAccepted ||
    value.thermalReview.thermalAuthority !== "deny" ||
    value.thermalReview.deratingAccepted ||
    value.schematicIntegration.schematicAuthority !== "deny" ||
    value.schematicIntegration.exactNetMapAccepted ||
    value.physicalTest.state !== "not-run" ||
    value.physicalTest.authority !== "deny" ||
    value.physicalTest.accepted ||
    Object.values(value.gates).some((gate) => gate !== "deny") ||
    value.releaseState !== "deny" ||
    value.fabricationAuthority !== "deny" ||
    value.acceptance.cadImportAccepted ||
    value.acceptance.placementAccepted ||
    value.acceptance.physicalIsolationAccepted ||
    value.acceptance.thermalAccepted ||
    value.acceptance.schematicAccepted ||
    value.acceptance.fabricationAuthorized ||
    value.acceptance.releaseState !== "deny" ||
    value.acceptance.physicalTestAccepted
  ) {
    errors.push(
      "BP-032 manufacturer CAD, placement, creepage/slot, thermal, schematic, fabrication, release, and physical-test gates must remain denied"
    )
  }
  if (errors.length === 0 && !compareDataGraph(value, bp032MurataNxe1s0505mcPreorderPromotionBaseline, "exact")) {
    errors.push("BP-032 NXE1 promotion graph, descriptor, or frozen baseline drifted")
  }
  return errors
}

export default Bp032MurataNxe1s0505mcPreorderPromotion
