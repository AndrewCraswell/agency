import type { ReactElement } from "react"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-032 NXE1 evidence cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 NXE1 evidence may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

type GraphComparison = "shape" | "exact"

/**
 * The sole candidate-graph comparator. Shape mode permits value drift so the
 * semantic checks can report it; exact mode also compares every primitive.
 * Both modes require data descriptors, exact flags/prototypes/keys, and reject
 * cycles, aliases, accessors, sparse arrays, null-prototype records, and
 * throwing proxy traps. The catch is intentional: hostile reflective objects
 * fail closed instead of escaping validation.
 */
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

      if (Object.getPrototypeOf(left) !== Object.getPrototypeOf(right)) return false
      if (Array.isArray(left) !== Array.isArray(right)) return false

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

const integrationBasisCommit = "8f0739b9d4ff3a8d19bc211c07490c94c7cdca12"
const isolationChannelSourceSha256 = "2809D5E89F235F188296F820A091986F643B0E367E58CFDC3C527F884CDA31A1"
const processorSupportSourceSha256 = "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20"
const bomSourceSha256 = "E9B80CE4FD71C33DB626AD2F149B05DC1E62354B2C6A961EF5FDEFCD904188F0"
const retainedMurataSourceSha256 = "53A6DCE053DA52AF149055634FC380E5B9AD1473D575D0B59F0EFF6123913D40"
const renderedGeometrySha256 = "02C8560D829B499945E420E24D225182D52B0A4AF5C4AF5461E52B284E777FFA"

const retainedMurataSource = {
  id: "murata-nxe1s0505mc-kdc-nxe1-a01",
  authority: "manufacturer-primary",
  documentNumber: "KDC_NXE1.A01",
  revision: "A01",
  url: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf",
  artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-nxe1s0505mc-datasheet.pdf",
  sha256: retainedMurataSourceSha256,
  reviewedPages: [1, 2, 6, 7],
  pagePurposes: {
    exactOrderableAndElectrical: 1,
    isolationLimitAndSafetyBoundary: 2,
    mechanicalPackagePinMapAndRecommendedLands: 6,
    tapeOrientationOnly: 7
  },
  scope:
    "Pages 1 and 6 bind the exact NXE1S0505MC orderable, package, pin map, and recommended five-land dimensions. Page 2 records the isolation test and the warning that the part is not a safety-isolation element. Page 7 is tape-and-reel orientation only."
} as const

const terminals = [
  { pad: "1", function: "-Vin", role: "input-negative", xMm: -3.81, yMm: -4.7 },
  { pad: "3", function: "+Vin", role: "input-positive", xMm: -1.27, yMm: -4.7 },
  { pad: "7", function: "-Vout", role: "output-negative", xMm: 3.81, yMm: -4.7 },
  { pad: "8", function: "+Vout", role: "output-positive", xMm: 3.81, yMm: 4.7 },
  { pad: "14", function: "NA", role: "no-connect", xMm: -3.81, yMm: 4.7 }
] as const

const candidateDefinition = {
  artifactKind: "bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint",
  workUnit: "BP-032",
  sourceContract: "BP-122",
  sourceContracts: ["BP-122", "BP-125"],
  upstreamContracts: { isolation: "BP-122", processorSupport: "BP-125" },
  canonicalReference: "U_ISO_POWER",
  manufacturer: "Murata Power Solutions",
  manufacturerPartNumber: "NXE1S0505MC",
  primaryProductPageUrl: retainedMurataSource.url,
  role: "isolated scoring-domain 5 V power crossing",
  geometryAuthority: "project-review-input-not-manufacturer-cad",
  sourceBinding: {
    canonicalReference: "U_ISO_POWER",
    manufacturer: "Murata Power Solutions",
    manufacturerPartNumber: "NXE1S0505MC",
    package:
      "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect",
    sourceSha256: retainedMurataSourceSha256,
    canonicalReferenceHandoff: {
      reference: "U_ISO_POWER",
      boardReference: "U_ISOLATED_POWER",
      manufacturerPartNumber: "NXE1S0505MC",
      package:
        "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect",
      selectionAuthority: "BP-122 isolated-power channel",
      integrationStatus: "root-integration-handoff",
      enforcement:
        "The canonical ledger validator must enforce exactly one U_ISO_POWER row with this exact MPN and package."
    },
    isolationContract: {
      workUnit: "BP-122",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-isolation-channel.ts",
      sourceSha256: isolationChannelSourceSha256,
      identityPath: "domains.isolatedPower.part",
      identityValue: "NXE1S0505MC"
    },
    processorSupportContract: {
      workUnit: "BP-125",
      sourcePath: "packages/scoring-circuit/src/bench-prototype-processor-support.ts",
      sourceSha256: processorSupportSourceSha256,
      boundary: "upstream processor-support contract remains an input; it does not authorize footprint release"
    },
    bomSourcePath: "packages/scoring-circuit/src/bench-prototype-bom.ts",
    bomSourceSha256,
    exactOrderableSourceId: retainedMurataSource.id,
    landPatternSourceId: retainedMurataSource.id,
    landPatternApplicability:
      "Murata page-6 dimensions are manufacturer-recommended land guidance only; they are not exact-orderable CAD, project artwork, or a released footprint."
  },
  sourceControl: {
    basisCommit: integrationBasisCommit,
    upstreamSources: [
      {
        workUnit: "BP-122",
        path: "packages/scoring-circuit/src/bench-prototype-isolation-channel.ts",
        sha256: isolationChannelSourceSha256
      },
      {
        workUnit: "BP-125",
        path: "packages/scoring-circuit/src/bench-prototype-processor-support.ts",
        sha256: processorSupportSourceSha256
      },
      { workUnit: "BOM", path: "packages/scoring-circuit/src/bench-prototype-bom.ts", sha256: bomSourceSha256 }
    ]
  },
  exactOrderable: {
    manufacturer: "Murata Power Solutions",
    manufacturerPartNumber: "NXE1S0505MC",
    productUrl: retainedMurataSource.url,
    sourceId: retainedMurataSource.id,
    sourcePage: 1,
    status: "manufacturer-specified"
  },
  sources: [retainedMurataSource],
  package: {
    designation: "NXE1 SMD 14-position package",
    bodyNominalMm: { length: 12.7, width: 10.41 },
    bodyToleranceMm: 0.25,
    bodyMaximumMm: { length: 12.95, width: 10.66 },
    heightMaximumMm: 4.8,
    pinCount: 14,
    pinPitchMm: 2.54,
    sourcePage: 6,
    sourceStatus: "manufacturer-specified"
  },
  electrical: {
    nominalInputVoltageV: 5,
    continuousInputRangeV: { minimum: 4.5, maximum: 5.5 },
    nominalOutputVoltageV: 5,
    ratedOutputCurrentmA: 200,
    ratedPowerW: 1,
    minimumEfficiencyPercent: 64,
    sourcePage: 1,
    sourceStatus: "manufacturer-specified"
  },
  isolationBoundary: {
    manufacturerFacts: {
      isolationTestVoltageVdc: 3000,
      isolationTestDurationSeconds: 1,
      isolationResistanceMinimumGOhm: 10,
      isolationResistanceTestVoltageVdc: 1000,
      sourcePages: [1, 2],
      safetyBoundary: "not-a-safety-isolation-element; maintain SELV limits and provide the system barrier separately"
    },
    projectBoundary: {
      inputDomain: "APP_GND / V5",
      outputDomain: "SCORING_SGND / SCORING_5V_ISOLATED",
      groundCrossingPermitted: false,
      slotCreepageClearanceReview: "not-reviewed",
      copperKeepoutReview: "not-reviewed",
      physicalIsolationAccepted: false,
      authority: "deny"
    }
  },
  manufacturerLandPattern: {
    sourcePage: 6,
    padLengthMm: 2.3,
    padWidthMm: 1,
    outerColumnCenterSpanMm: 7.62,
    rowCenterSpanMm: 9.4,
    sourceScope: "manufacturer-recommended-guidance-not-CAD",
    note: "No manufacturer CAD object or pad-numbered released footprint is retained."
  },
  terminals,
  orientation: {
    manufacturerView: "top-view package drawing",
    manufacturerPinOne: "pin 1 is the lower-left land in the page-6 drawing with +Y-up",
    manufacturerPinFourteen: "pin 14 is the upper-left land in the page-6 drawing with +Y-up",
    projectConvention: "top-view +Y-up pin-one lower-left",
    reviewTransform: "no transform; page-6 top view is retained in the chosen +Y-up coordinate system",
    assemblyRotationDegrees: null,
    state: "pending-independent-layout-review",
    accepted: false,
    note: "The source drawing and page-7 tape orientation do not close the final PCB assembly rotation, polarity marking, or board-side datum."
  },
  projectSelection: {
    authority: "project-review-input-not-manufacturer-CAD",
    sourceGuidanceSelection:
      "review input copied from page 6; independent pad, mask, paste, courtyard, and DRC review required",
    copper: { padLengthMm: 2.3, padWidthMm: 1, shape: "rectangular-smt" },
    solderMask: { openingLengthMm: 2.4, openingWidthMm: 1.1, marginPerEdgeMm: 0.05, status: "project-input" },
    paste: { openingLengthMm: 2.2, openingWidthMm: 0.9, reductionPerEdgeMm: 0.05, status: "project-input" },
    courtyard: {
      lengthMm: 13.45,
      widthMm: 12.2,
      minimumClearanceMm: 0.25,
      sourceStatus: "not-published",
      status: "project-review-input"
    }
  },
  projectArtwork: {
    state: "generated-project-review-only",
    authority: "deny",
    representation: "canonical-rendered-tscircuit-footprint",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    componentName: "U_BP032_MURATA_NXE1S0505MC",
    footprintName: "BP032_MURATA_NXE1S0505MC_CANDIDATE",
    pads: [
      { pad: "1", xMm: -3.81, yMm: -4.7, widthMm: 1, heightMm: 2.3 },
      { pad: "3", xMm: -1.27, yMm: -4.7, widthMm: 1, heightMm: 2.3 },
      { pad: "7", xMm: 3.81, yMm: -4.7, widthMm: 1, heightMm: 2.3 },
      { pad: "14", xMm: -3.81, yMm: 4.7, widthMm: 1, heightMm: 2.3 },
      { pad: "8", xMm: 3.81, yMm: 4.7, widthMm: 1, heightMm: 2.3 }
    ],
    courtyard: { centerMm: { x: 0, y: 0 }, lengthMm: 13.45, widthMm: 12.2 },
    orientation: "project top-view +Y-up pin-one lower-left and pin-14 upper-left; assembly rotation pending",
    placementStatus: "not-reviewed"
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-tscircuit-footprint",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: renderedGeometrySha256,
    authority: "deny"
  },
  manufacturerCad: {
    state: "not-acquired",
    authority: "deny",
    availability: "not-confirmed",
    retainedArtifactPath: null,
    sha256: null,
    disposition: "not-acquired-no-substitute",
    note: "No Murata exact-MPN CAD was acquired. The source drawing and project artwork are not represented as manufacturer CAD."
  },
  placementReview: {
    state: "pending-independent-review",
    boardPlacementStatus: "not-reviewed",
    boardIntegrationAuthority: "deny",
    boardFitAccepted: false,
    assemblyClearanceAccepted: false,
    edgeClearanceAccepted: false,
    note: "No board import, neighboring-component, slot, keepout, or assembly-clearance review is claimed."
  },
  physicalIsolationReview: {
    state: "pending-independent-review",
    physicalIsolationAccepted: false,
    slotAccepted: false,
    creepageAccepted: false,
    clearanceAccepted: false,
    copperKeepoutAccepted: false,
    authority: "deny",
    note: "The datasheet isolation test is not PCB creepage or clearance evidence; the board isolation corridor remains unreviewed."
  },
  thermalReview: {
    state: "pending-independent-review",
    thermalModelRetained: false,
    deratingAccepted: false,
    thermalAuthority: "deny",
    note: "The 1 W datasheet rating does not close the assembled-board thermal, startup, load, ripple, or local-regulator review."
  },
  schematicIntegration: {
    state: "not-reviewed",
    exactNetMapAccepted: false,
    powerSequenceAccepted: false,
    schematicAuthority: "deny"
  },
  gates: {
    cad: "deny",
    placement: "deny",
    physicalIsolation: "deny",
    thermal: "deny",
    schematic: "deny",
    fabrication: "deny",
    release: "deny"
  },
  acceptance: {
    exactOrderableReviewed: true,
    packageAndPinMapReviewed: true,
    manufacturerIsolationFactsReviewed: true,
    manufacturerLandGuidanceReviewed: true,
    projectArtworkAccepted: false,
    orientationAccepted: false,
    cadImportAccepted: false,
    placementAccepted: false,
    physicalIsolationAccepted: false,
    thermalAccepted: false,
    schematicAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

const bp032MurataNxe1s0505mcCandidateBaseline = deepFreeze(structuredClone(candidateDefinition))

export const bp032MurataNxe1s0505mcCandidate = deepFreeze(candidateDefinition)

type Candidate = typeof candidateDefinition

function hasExpectedCandidateShape(value: unknown): value is Candidate {
  return compareDataGraph(value, bp032MurataNxe1s0505mcCandidateBaseline, "shape")
}

const projectFootprint = (
  <footprint name="BP032_MURATA_NXE1S0505MC_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-3.81}
      pcbY={-4.7}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1mm"
      height="2.3mm"
      portHints={["1", "-Vin", "input-negative", "pin1"]}
    />
    <smtpad
      name="3"
      pcbX={-1.27}
      pcbY={-4.7}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1mm"
      height="2.3mm"
      portHints={["3", "+Vin", "input-positive"]}
    />
    <smtpad
      name="7"
      pcbX={3.81}
      pcbY={-4.7}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1mm"
      height="2.3mm"
      portHints={["7", "-Vout", "output-negative"]}
    />
    <smtpad
      name="14"
      pcbX={-3.81}
      pcbY={4.7}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1mm"
      height="2.3mm"
      portHints={["14", "NA", "no-connect"]}
    />
    <smtpad
      name="8"
      pcbX={3.81}
      pcbY={4.7}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1mm"
      height="2.3mm"
      portHints={["8", "+Vout", "output-positive"]}
    />
    {/* Project review overlay only; this is not Murata CAD. */}
    <courtyardrect pcbX={0} pcbY={0} width="13.45mm" height="12.2mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface Bp032MurataNxe1s0505mcCandidateProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-032 review candidate for the exact Murata NXE1S0505MC. */
export function Bp032MurataNxe1s0505mcCandidate({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032MurataNxe1s0505mcCandidateProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_MURATA_NXE1S0505MC"
      manufacturerPartNumber="NXE1S0505MC"
      pinLabels={{ pin1: "-Vin", pin3: "+Vin", pin7: "-Vout", pin8: "+Vout", pin14: "NA" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

/** Return exact review failures; an empty result means the denied record is internally consistent. */
export function validateBp032MurataNxe1s0505mcCandidate(
  candidate: unknown = bp032MurataNxe1s0505mcCandidate
): readonly string[] {
  if (!hasExpectedCandidateShape(candidate)) return ["Murata NXE1 exact graph, descriptor, or deny-state drifted"]
  const errors: string[] = []
  const source = candidate.sources[0]
  if (
    candidate.artifactKind !== "bp032-murata-nxe1s0505mc-isolated-converter-candidate-footprint" ||
    candidate.workUnit !== "BP-032" ||
    candidate.sourceContract !== "BP-122" ||
    candidate.canonicalReference !== "U_ISO_POWER" ||
    candidate.manufacturer !== "Murata Power Solutions" ||
    candidate.manufacturerPartNumber !== "NXE1S0505MC" ||
    candidate.primaryProductPageUrl !== retainedMurataSource.url
  ) {
    errors.push("BP-032 exact U_ISO_POWER NXE1S0505MC identity drifted")
  }
  if (
    JSON.stringify(candidate.sourceContracts) !== JSON.stringify(["BP-122", "BP-125"]) ||
    candidate.upstreamContracts.isolation !== "BP-122" ||
    candidate.upstreamContracts.processorSupport !== "BP-125" ||
    candidate.sourceBinding.canonicalReference !== "U_ISO_POWER" ||
    candidate.sourceBinding.manufacturer !== "Murata Power Solutions" ||
    candidate.sourceBinding.manufacturerPartNumber !== "NXE1S0505MC" ||
    candidate.sourceBinding.sourceSha256 !== retainedMurataSourceSha256 ||
    candidate.sourceBinding.canonicalReferenceHandoff.reference !== "U_ISO_POWER" ||
    candidate.sourceBinding.canonicalReferenceHandoff.manufacturerPartNumber !== "NXE1S0505MC" ||
    candidate.sourceBinding.canonicalReferenceHandoff.integrationStatus !== "root-integration-handoff" ||
    candidate.sourceBinding.isolationContract.workUnit !== "BP-122" ||
    candidate.sourceBinding.isolationContract.identityValue !== "NXE1S0505MC" ||
    candidate.sourceBinding.processorSupportContract.workUnit !== "BP-125" ||
    candidate.sourceBinding.bomSourceSha256 !== bomSourceSha256
  ) {
    errors.push("BP-032 canonical U_ISO_POWER source-contract binding drifted")
  }
  if (
    candidate.sourceControl.basisCommit !== integrationBasisCommit ||
    candidate.sourceControl.upstreamSources.length !== 3 ||
    candidate.sourceControl.upstreamSources[0]?.sha256 !== isolationChannelSourceSha256 ||
    candidate.sourceControl.upstreamSources[1]?.sha256 !== processorSupportSourceSha256 ||
    candidate.sourceControl.upstreamSources[2]?.sha256 !== bomSourceSha256
  ) {
    errors.push("BP-032 upstream source hash binding drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    source?.id !== retainedMurataSource.id ||
    source?.authority !== "manufacturer-primary" ||
    source?.documentNumber !== "KDC_NXE1.A01" ||
    source?.revision !== "A01" ||
    source?.artifactPath !== retainedMurataSource.artifactPath ||
    source?.sha256 !== retainedMurataSourceSha256 ||
    JSON.stringify(source?.reviewedPages) !== JSON.stringify([1, 2, 6, 7]) ||
    source?.pagePurposes.mechanicalPackagePinMapAndRecommendedLands !== 6
  ) {
    errors.push("exact retained Murata NXE1 primary source is required")
  }
  if (
    candidate.exactOrderable.productUrl !== retainedMurataSource.url ||
    candidate.exactOrderable.sourceId !== retainedMurataSource.id ||
    candidate.exactOrderable.sourcePage !== 1 ||
    candidate.exactOrderable.status !== "manufacturer-specified" ||
    candidate.package.designation !== "NXE1 SMD 14-position package" ||
    candidate.package.bodyNominalMm.length !== 12.7 ||
    candidate.package.bodyNominalMm.width !== 10.41 ||
    candidate.package.bodyToleranceMm !== 0.25 ||
    candidate.package.bodyMaximumMm.length !== 12.95 ||
    candidate.package.bodyMaximumMm.width !== 10.66 ||
    candidate.package.heightMaximumMm !== 4.8 ||
    candidate.package.pinCount !== 14 ||
    candidate.package.pinPitchMm !== 2.54
  ) {
    errors.push("Murata NXE1 manufacturer package identity drifted")
  }
  if (
    candidate.electrical.nominalInputVoltageV !== 5 ||
    candidate.electrical.continuousInputRangeV.minimum !== 4.5 ||
    candidate.electrical.continuousInputRangeV.maximum !== 5.5 ||
    candidate.electrical.nominalOutputVoltageV !== 5 ||
    candidate.electrical.ratedOutputCurrentmA !== 200 ||
    candidate.electrical.ratedPowerW !== 1 ||
    candidate.electrical.minimumEfficiencyPercent !== 64 ||
    candidate.isolationBoundary.manufacturerFacts.isolationTestVoltageVdc !== 3000 ||
    candidate.isolationBoundary.manufacturerFacts.isolationTestDurationSeconds !== 1 ||
    candidate.isolationBoundary.manufacturerFacts.isolationResistanceMinimumGOhm !== 10
  ) {
    errors.push("Murata NXE1 electrical or isolation facts drifted")
  }
  if (
    candidate.manufacturerLandPattern.sourcePage !== 6 ||
    candidate.manufacturerLandPattern.padLengthMm !== 2.3 ||
    candidate.manufacturerLandPattern.padWidthMm !== 1 ||
    candidate.manufacturerLandPattern.outerColumnCenterSpanMm !== 7.62 ||
    candidate.manufacturerLandPattern.rowCenterSpanMm !== 9.4 ||
    candidate.manufacturerLandPattern.sourceScope !== "manufacturer-recommended-guidance-not-CAD" ||
    candidate.projectSelection.authority !== "project-review-input-not-manufacturer-CAD" ||
    candidate.projectSelection.copper.padLengthMm !== 2.3 ||
    candidate.projectSelection.copper.padWidthMm !== 1 ||
    candidate.projectSelection.solderMask.openingLengthMm !== 2.4 ||
    candidate.projectSelection.solderMask.openingWidthMm !== 1.1 ||
    candidate.projectSelection.paste.openingLengthMm !== 2.2 ||
    candidate.projectSelection.paste.openingWidthMm !== 0.9 ||
    candidate.projectSelection.courtyard.lengthMm !== 13.45 ||
    candidate.projectSelection.courtyard.widthMm !== 12.2
  ) {
    errors.push("Murata guidance and project geometry must remain separately bounded")
  }
  if (
    JSON.stringify(candidate.terminals) !== JSON.stringify(terminals) ||
    candidate.orientation.manufacturerPinOne !== "pin 1 is the lower-left land in the page-6 drawing with +Y-up" ||
    candidate.orientation.manufacturerPinFourteen !==
      "pin 14 is the upper-left land in the page-6 drawing with +Y-up" ||
    candidate.orientation.projectConvention !== "top-view +Y-up pin-one lower-left" ||
    candidate.orientation.reviewTransform !==
      "no transform; page-6 top view is retained in the chosen +Y-up coordinate system" ||
    candidate.orientation.state !== "pending-independent-layout-review" ||
    candidate.orientation.assemblyRotationDegrees !== null ||
    candidate.orientation.accepted ||
    candidate.projectArtwork.state !== "generated-project-review-only" ||
    candidate.projectArtwork.authority !== "deny" ||
    candidate.projectArtwork.orientation !==
      "project top-view +Y-up pin-one lower-left and pin-14 upper-left; assembly rotation pending" ||
    candidate.projectArtwork.pads.length !== 5 ||
    candidate.projectArtwork.courtyard.lengthMm !== 13.45 ||
    candidate.projectArtwork.courtyard.widthMm !== 12.2 ||
    candidate.artwork.state !== "generated-project-review-only" ||
    candidate.artwork.sha256 !== renderedGeometrySha256 ||
    candidate.artwork.authority !== "deny"
  ) {
    errors.push("BP-032 project artwork or orientation must remain review-only")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.manufacturerCad.retainedArtifactPath !== null ||
    candidate.manufacturerCad.sha256 !== null ||
    candidate.placementReview.boardIntegrationAuthority !== "deny" ||
    candidate.placementReview.boardFitAccepted ||
    candidate.physicalIsolationReview.authority !== "deny" ||
    candidate.physicalIsolationReview.physicalIsolationAccepted ||
    candidate.thermalReview.thermalAuthority !== "deny" ||
    candidate.thermalReview.deratingAccepted ||
    candidate.schematicIntegration.schematicAuthority !== "deny" ||
    candidate.schematicIntegration.exactNetMapAccepted ||
    Object.values(candidate.gates).some((gate) => gate !== "deny") ||
    candidate.acceptance.projectArtworkAccepted ||
    candidate.acceptance.orientationAccepted ||
    candidate.acceptance.cadImportAccepted ||
    candidate.acceptance.placementAccepted ||
    candidate.acceptance.physicalIsolationAccepted ||
    candidate.acceptance.thermalAccepted ||
    candidate.acceptance.schematicAccepted ||
    candidate.acceptance.fabricationAuthorized ||
    candidate.acceptance.releaseState !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push(
      "BP-032 CAD, placement, isolation, thermal, schematic, fabrication, and release gates must remain denied"
    )
  }
  if (errors.length === 0 && !compareDataGraph(candidate, bp032MurataNxe1s0505mcCandidateBaseline, "exact")) {
    errors.push("Murata NXE1 exact graph, descriptor, or deny-state drifted")
  }
  return errors
}

export default Bp032MurataNxe1s0505mcCandidate
