import type { ReactElement } from "react"

const manufacturer = "Vishay"
const seriesSourcePath = "packages/scoring-circuit/docs/evidence/m4-04/vishay-dcrcwe3-chip-resistor-datasheet.pdf"
const seriesSourceSha256 = "1F5E20329C74727DA629B92E2BFBDBDB3FA3BE57229E3208E24058173F9CECF3"
const exactIdentitySourcePath = "packages/scoring-circuit/src/one-channel-analog-readiness.ts"
const exactIdentitySourceSha256 = "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
const m404LedgerPath = "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts"
const m404LedgerSha256 = "2CBA495FC2746C038FB09A13793B1DBF7F7D0B4D8F55D7F748AD2E0E9E12D0E0"
const bp031LedgerPath = "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts"
const bp031LedgerSha256 = "B2161E55788503DCD10BB96FDEBB502A1CE6C5D80159B8B5D9E5CC32C970E438"
const basisCommit = "d29c549b9da078b7c2e6f23487eb4c613eb4798f"
const projectSolderMaskMarginMm = 0.05
const projectPasteReductionMm = 0.05
const projectCourtyardClearanceMm = 0.15

const d11Package = {
  family: "D11/CRCW0603 e3",
  imperialSize: "0603",
  metricSizeCode: "RR1608M",
  bodyLengthMm: { minimum: 1.5, maximum: 1.65 },
  bodyWidthMm: { minimum: 0.75, maximum: 0.95 },
  bodyHeightMm: { minimum: 0.4, maximum: 0.5 },
  terminalLengthT1Mm: { minimum: 0.1, maximum: 0.5 },
  terminalLengthT2Mm: { minimum: 0.1, maximum: 0.5 }
} as const

const d25Package = {
  family: "D25/CRCW1206 e3",
  imperialSize: "1206",
  metricSizeCode: "RR3216M",
  bodyLengthMm: { minimum: 3, maximum: 3.3 },
  bodyWidthMm: { minimum: 1.45, maximum: 1.75 },
  bodyHeightMm: { minimum: 0.5, maximum: 0.6 },
  terminalLengthT1Mm: { minimum: 0.25, maximum: 0.65 },
  terminalLengthT2Mm: { minimum: 0.2, maximum: 0.6 }
} as const

const d11ReflowLandPattern = {
  gapMm: 0.75,
  padLengthAlongTerminalAxisMm: 0.75,
  padWidthAcrossTerminalAxisMm: 1,
  overallSpanMm: 2.25
} as const

const d25ReflowLandPattern = {
  gapMm: 1.5,
  padLengthAlongTerminalAxisMm: 1.05,
  padWidthAcrossTerminalAxisMm: 1.8,
  overallSpanMm: 3.6
} as const

const d11WaveLandPattern = {
  gapMm: 0.65,
  padLengthAlongTerminalAxisMm: 1.1,
  padWidthAcrossTerminalAxisMm: 1.25,
  overallSpanMm: 2.85
} as const

const d25WaveLandPattern = {
  gapMm: 1.4,
  padLengthAlongTerminalAxisMm: 1.4,
  padWidthAcrossTerminalAxisMm: 1.95,
  overallSpanMm: 4.2
} as const

function envelopeForPads(
  pads: readonly { readonly xMm: number; readonly yMm: number }[],
  padLengthMm: number,
  padWidthMm: number
) {
  return {
    minimumXMm: Math.min(...pads.map(({ xMm }) => xMm - padLengthMm / 2)),
    maximumXMm: Math.max(...pads.map(({ xMm }) => xMm + padLengthMm / 2)),
    minimumYMm: Math.min(...pads.map(({ yMm }) => yMm - padWidthMm / 2)),
    maximumYMm: Math.max(...pads.map(({ yMm }) => yMm + padWidthMm / 2))
  } as const
}

function courtyardFor(
  padEnvelope: ReturnType<typeof envelopeForPads>,
  packageLengthMm: number,
  packageWidthMm: number
) {
  const minimumXMm = Math.min(padEnvelope.minimumXMm, -packageLengthMm / 2) - projectCourtyardClearanceMm
  const maximumXMm = Math.max(padEnvelope.maximumXMm, packageLengthMm / 2) + projectCourtyardClearanceMm
  const minimumYMm = Math.min(padEnvelope.minimumYMm, -packageWidthMm / 2) - projectCourtyardClearanceMm
  const maximumYMm = Math.max(padEnvelope.maximumYMm, packageWidthMm / 2) + projectCourtyardClearanceMm
  return {
    centerMm: { x: 0, y: 0 },
    minimumXMm,
    maximumXMm,
    minimumYMm,
    maximumYMm,
    widthMm: maximumXMm - minimumXMm,
    heightMm: maximumYMm - minimumYMm,
    minimumClearanceMm: projectCourtyardClearanceMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  } as const
}

const d11PadCenterSpanMm = d11ReflowLandPattern.gapMm + d11ReflowLandPattern.padLengthAlongTerminalAxisMm
const d25PadCenterSpanMm = d25ReflowLandPattern.gapMm + d25ReflowLandPattern.padLengthAlongTerminalAxisMm

const d11Pads = [
  { pin: 1, xMm: -d11PadCenterSpanMm / 2, yMm: 0 },
  { pin: 2, xMm: d11PadCenterSpanMm / 2, yMm: 0 }
] as const

const d25Pads = [
  { pin: 1, xMm: -d25PadCenterSpanMm / 2, yMm: 0 },
  { pin: 2, xMm: d25PadCenterSpanMm / 2, yMm: 0 }
] as const

const d11ProjectPadLengthMm = d11ReflowLandPattern.padLengthAlongTerminalAxisMm
const d11ProjectPadWidthMm = d11ReflowLandPattern.padWidthAcrossTerminalAxisMm
const d25ProjectPadLengthMm = d25ReflowLandPattern.padLengthAlongTerminalAxisMm
const d25ProjectPadWidthMm = d25ReflowLandPattern.padWidthAcrossTerminalAxisMm

const d11ProjectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-derived-from-vishay-d11-reflow-guidance",
  padShape: "rectangular-smt",
  padLengthMm: d11ProjectPadLengthMm,
  padWidthMm: d11ProjectPadWidthMm,
  padCenterSpanMm: d11PadCenterSpanMm,
  padGapMm: d11ReflowLandPattern.gapMm,
  pads: d11Pads,
  solderMask: {
    openingLengthMm: d11ProjectPadLengthMm + 2 * projectSolderMaskMarginMm,
    openingWidthMm: d11ProjectPadWidthMm + 2 * projectSolderMaskMarginMm,
    marginPerEdgeMm: projectSolderMaskMarginMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  paste: {
    openingLengthMm: d11ProjectPadLengthMm - 2 * projectPasteReductionMm,
    openingWidthMm: d11ProjectPadWidthMm - 2 * projectPasteReductionMm,
    reductionPerEdgeMm: projectPasteReductionMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  courtyard: courtyardFor(envelopeForPads(d11Pads, d11ProjectPadLengthMm, d11ProjectPadWidthMm), 1.65, 0.95),
  orientation: {
    polarity: "non-polar",
    pinOne: "not-applicable",
    state: "pending-independent-review",
    assemblyRotationDeg: null,
    datum: "two-terminal resistor axis",
    note: "Electrical polarity is symmetric; printed value orientation and assembly marking remain open."
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const d25ProjectFootprint = {
  state: "review-only",
  geometryAuthority: "project-review-input-derived-from-vishay-d25-reflow-guidance",
  padShape: "rectangular-smt",
  padLengthMm: d25ProjectPadLengthMm,
  padWidthMm: d25ProjectPadWidthMm,
  padCenterSpanMm: d25PadCenterSpanMm,
  padGapMm: d25ReflowLandPattern.gapMm,
  pads: d25Pads,
  solderMask: {
    openingLengthMm: d25ProjectPadLengthMm + 2 * projectSolderMaskMarginMm,
    openingWidthMm: d25ProjectPadWidthMm + 2 * projectSolderMaskMarginMm,
    marginPerEdgeMm: projectSolderMaskMarginMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  paste: {
    openingLengthMm: d25ProjectPadLengthMm - 2 * projectPasteReductionMm,
    openingWidthMm: d25ProjectPadWidthMm - 2 * projectPasteReductionMm,
    reductionPerEdgeMm: projectPasteReductionMm,
    sourceStatus: "not-published",
    status: "project-review-input"
  },
  courtyard: courtyardFor(envelopeForPads(d25Pads, d25ProjectPadLengthMm, d25ProjectPadWidthMm), 3.3, 1.75),
  orientation: {
    polarity: "non-polar",
    pinOne: "not-applicable",
    state: "pending-independent-review",
    assemblyRotationDeg: null,
    datum: "two-terminal resistor axis",
    note: "Electrical polarity is symmetric; printed value orientation and assembly marking remain open."
  },
  fabricationAuthority: "deny",
  accepted: false
} as const

const seriesSources = [
  {
    id: "vishay-dcrcwe3-series-rev-2026-04-14",
    authority: "manufacturer-primary",
    documentNumber: "20035",
    revision: "14-Apr-2026",
    url: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    reviewedPages: "1, 11",
    artifactPath: seriesSourcePath,
    sha256: seriesSourceSha256,
    pageEvidence: [
      {
        page: 1,
        claim: "D11/CRCW0603 e3 and D25/CRCW1206 e3 package-family identity and metric size codes",
        markers: ["D/CRCW e3", "D11/CRCW0603", "D25/CRCW1206", "20035"]
      },
      {
        page: 11,
        claim: "manufacturer package dimensions and recommended wave/reflow solder-pad dimensions",
        markers: ["MASS", "D11/CRCW0603 e3", "D25/CRCW1206 e3", "SOLDER", "PAD", "G", "Y", "X", "Z"]
      }
    ],
    scope:
      "Series-only package dimensions and recommended solder-pad dimensions for D11/CRCW0603 e3 and D25/CRCW1206 e3. The PDF does not name the four selected exact orderable MPNs and does not provide exact-orderable CAD, solder-mask, paste, or courtyard objects."
  },
  {
    id: "bp031-selected-vishay-mpn-records",
    authority: "project-canonical-source",
    documentNumber: null,
    revision: "BP-031 source snapshot",
    url: null,
    reviewedPages: null,
    artifactPath: exactIdentitySourcePath,
    sha256: exactIdentitySourceSha256,
    scope:
      "Exact selected MPN, package, reference, resistance, and role rows from the canonical project source. This is identity binding only, not manufacturer evidence or exact-orderable CAD."
  }
] as const

function upstreamLedgerBinding(
  canonicalReference: string,
  replicatedReferencePrefix: string,
  mpn: string,
  packageName: string
) {
  return {
    m404: {
      artifactKind: "m4-04-single-channel-sensing-coupon",
      sourcePath: m404LedgerPath,
      reference: canonicalReference,
      exactMpn: mpn,
      package: packageName,
      footprintRelease: "deny",
      independentDrawingReview: { reviewerId: "root-final-reviewer", status: "pending" }
    },
    bp031: {
      artifactKind: "bench-prototype-analog-footprint-closure",
      sourcePath: bp031LedgerPath,
      sourceContract: "BP-103",
      sourceSubcontract: "BP-102",
      sourceBaseReference: canonicalReference,
      replicatedReferencePrefix,
      sharedManufacturerSourceId: `M4-04:${mpn}`,
      disposition: "DNP-unresolved",
      existingFootprintEvidence: {
        eligibleForPcb: false,
        releaseState: "deny"
      }
    }
  } as const
}

const exactSelectedParts = [
  {
    canonicalReference: "R_ESD",
    replicatedReferencePrefix: "R_ESD_",
    role: "normal-path protection series resistor",
    manufacturer,
    manufacturerPartNumber: "CRCW060322R0FKEAHP",
    resistanceOhms: 22,
    tolerancePercent: 1,
    package: "0603",
    seriesGeometryId: "vishay-d11-crcw0603-e3",
    exactIdentitySourceId: "bp031-selected-vishay-mpn-records",
    upstreamLedgerBinding: upstreamLedgerBinding("R_ESD", "R_ESD_", "CRCW060322R0FKEAHP", "0603"),
    exactMpnNamedInManufacturerSource: false
  },
  {
    canonicalReference: "R_SAR",
    replicatedReferencePrefix: "R_SAR_",
    role: "SAR input isolation resistor",
    manufacturer,
    manufacturerPartNumber: "CRCW060320R0FKEAHP",
    resistanceOhms: 20,
    tolerancePercent: 1,
    package: "0603",
    seriesGeometryId: "vishay-d11-crcw0603-e3",
    exactIdentitySourceId: "bp031-selected-vishay-mpn-records",
    upstreamLedgerBinding: upstreamLedgerBinding("R_SAR", "R_SAR_", "CRCW060320R0FKEAHP", "0603"),
    exactMpnNamedInManufacturerSource: false
  },
  {
    canonicalReference: "R_SOURCE_PD",
    replicatedReferencePrefix: "R_SOURCE_PD_",
    role: "source-enable safe-state pull-down",
    manufacturer,
    manufacturerPartNumber: "CRCW0603100KFKEAHP",
    resistanceOhms: 100000,
    tolerancePercent: 1,
    package: "0603",
    seriesGeometryId: "vishay-d11-crcw0603-e3",
    exactIdentitySourceId: "bp031-selected-vishay-mpn-records",
    upstreamLedgerBinding: upstreamLedgerBinding("R_SOURCE_PD", "R_SOURCE_PD_", "CRCW0603100KFKEAHP", "0603"),
    exactMpnNamedInManufacturerSource: false
  },
  {
    canonicalReference: "R_FAULT_GUARD",
    replicatedReferencePrefix: "R_FAULT_GUARD_",
    role: "externally interlocked guarded-force resistor",
    manufacturer,
    manufacturerPartNumber: "CRCW120656K0FKEAHP",
    resistanceOhms: 56000,
    tolerancePercent: 1,
    package: "1206",
    seriesGeometryId: "vishay-d25-crcw1206-e3",
    exactIdentitySourceId: "bp031-selected-vishay-mpn-records",
    upstreamLedgerBinding: upstreamLedgerBinding("R_FAULT_GUARD", "R_FAULT_GUARD_", "CRCW120656K0FKEAHP", "1206"),
    exactMpnNamedInManufacturerSource: false
  }
] as const

export const bp031VishayCrcwResistorFootprintEvidence = {
  artifactKind: "bp031-vishay-crcw-selected-resistor-footprint-evidence",
  workUnit: "BP-031",
  manufacturer,
  sourceControl: {
    basisCommit,
    upstreamSources: [
      {
        path: exactIdentitySourcePath,
        sha256: exactIdentitySourceSha256
      }
    ],
    upstreamLedgers: [
      {
        id: "M4-04",
        artifactKind: "m4-04-single-channel-sensing-coupon",
        path: m404LedgerPath,
        sha256: m404LedgerSha256
      },
      {
        id: "BP-031",
        artifactKind: "bench-prototype-analog-footprint-closure",
        path: bp031LedgerPath,
        sha256: bp031LedgerSha256
      }
    ]
  },
  sources: seriesSources,
  exactSelectedParts,
  seriesGeometry: [
    {
      id: "vishay-d11-crcw0603-e3",
      package: d11Package,
      landPattern: {
        wave: d11WaveLandPattern,
        reflow: d11ReflowLandPattern,
        sourceId: "vishay-dcrcwe3-series-rev-2026-04-14"
      },
      projectFootprint: d11ProjectFootprint,
      manufacturerCad: {
        state: "not-acquired",
        artifactPath: null,
        authority: "deny",
        note: "No Vishay exact-orderable CAD object is retained. This family drawing is series guidance only."
      },
      artwork: {
        state: "generated-project-review-only",
        representation: "canonical-rendered-footprint-soup-geometry",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: "EB0DD0D03CD7A003236E3897437CFB241845AF751681D5791A23E34920FEA62D",
        authority: "deny"
      }
    },
    {
      id: "vishay-d25-crcw1206-e3",
      package: d25Package,
      landPattern: {
        wave: d25WaveLandPattern,
        reflow: d25ReflowLandPattern,
        sourceId: "vishay-dcrcwe3-series-rev-2026-04-14"
      },
      projectFootprint: d25ProjectFootprint,
      manufacturerCad: {
        state: "not-acquired",
        artifactPath: null,
        authority: "deny",
        note: "No Vishay exact-orderable CAD object is retained. This family drawing is series guidance only."
      },
      artwork: {
        state: "generated-project-review-only",
        representation: "canonical-rendered-footprint-soup-geometry",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: "51F5C2A3B2D261EF74D4DC67EB7775C9F425E8E2FB863490A726118CFEFED250",
        authority: "deny"
      }
    }
  ],
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

function expectedFamily(id: string) {
  return bp031VishayCrcwResistorFootprintEvidence.seriesGeometry.find((family) => family.id === id)
}

/** Empty output means the series-shared, exact-MPN-denied evidence is internally consistent. */
export function validateBp031VishayCrcwResistorFootprintEvidence(
  candidate: typeof bp031VishayCrcwResistorFootprintEvidence = bp031VishayCrcwResistorFootprintEvidence
): readonly string[] {
  const evidence = candidate
  const errors: string[] = []
  if (
    evidence.workUnit !== "BP-031" ||
    evidence.manufacturer !== "Vishay" ||
    evidence.sourceControl.basisCommit !== basisCommit ||
    evidence.sourceControl.upstreamSources.length !== 1 ||
    evidence.sourceControl.upstreamLedgers.length !== 2 ||
    evidence.sources.length !== 2 ||
    evidence.seriesGeometry.length !== 2 ||
    evidence.exactSelectedParts.length !== 4 ||
    evidence.releaseState !== "deny" ||
    evidence.fabricationAuthority !== "deny" ||
    evidence.accepted
  ) {
    errors.push("BP-031 Vishay evidence identity or deny state drifted")
  }
  const expectedUpstreamSources = [{ path: exactIdentitySourcePath, sha256: exactIdentitySourceSha256 }]
  if (
    evidence.sourceControl.upstreamSources.some(
      (source, index) =>
        source.path !== expectedUpstreamSources[index]?.path || source.sha256 !== expectedUpstreamSources[index]?.sha256
    )
  ) {
    errors.push("canonical BP-031 upstream source binding drifted")
  }
  const expectedUpstreamLedgers = [
    {
      id: "M4-04",
      artifactKind: "m4-04-single-channel-sensing-coupon",
      path: m404LedgerPath,
      sha256: m404LedgerSha256
    },
    {
      id: "BP-031",
      artifactKind: "bench-prototype-analog-footprint-closure",
      path: bp031LedgerPath,
      sha256: bp031LedgerSha256
    }
  ]
  if (
    evidence.sourceControl.upstreamLedgers.some(
      (ledger, index) =>
        ledger.id !== expectedUpstreamLedgers[index]?.id ||
        ledger.artifactKind !== expectedUpstreamLedgers[index]?.artifactKind ||
        ledger.path !== expectedUpstreamLedgers[index]?.path ||
        ledger.sha256 !== expectedUpstreamLedgers[index]?.sha256 ||
        !/^[0-9A-F]{64}$/u.test(ledger.sha256)
    )
  ) {
    errors.push("BP-031 upstream ledger binding drifted")
  }
  const seriesSource = evidence.sources.find((source) => source.id === "vishay-dcrcwe3-series-rev-2026-04-14")
  const identitySource = evidence.sources.find((source) => source.id === "bp031-selected-vishay-mpn-records")
  if (
    seriesSource === undefined ||
    seriesSource.authority !== "manufacturer-primary" ||
    seriesSource.documentNumber !== "20035" ||
    seriesSource.revision !== "14-Apr-2026" ||
    seriesSource.url !== "https://www.vishay.com/docs/20035/dcrcwe3.pdf" ||
    seriesSource.reviewedPages !== "1, 11" ||
    seriesSource.artifactPath !== seriesSourcePath ||
    seriesSource.sha256 !== seriesSourceSha256 ||
    !/^[0-9A-F]{64}$/u.test(seriesSource.sha256) ||
    seriesSource.pageEvidence.length !== 2 ||
    seriesSource.pageEvidence[0]?.page !== 1 ||
    seriesSource.pageEvidence[0]?.claim !==
      "D11/CRCW0603 e3 and D25/CRCW1206 e3 package-family identity and metric size codes" ||
    seriesSource.pageEvidence[0]?.markers.join(",") !== "D/CRCW e3,D11/CRCW0603,D25/CRCW1206,20035" ||
    seriesSource.pageEvidence[1]?.page !== 11 ||
    seriesSource.pageEvidence[1]?.claim !==
      "manufacturer package dimensions and recommended wave/reflow solder-pad dimensions" ||
    seriesSource.pageEvidence[1]?.markers.join(",") !== "MASS,D11/CRCW0603 e3,D25/CRCW1206 e3,SOLDER,PAD,G,Y,X,Z"
  ) {
    errors.push("Vishay series source identity or SHA-256 drifted")
  }
  if (
    identitySource === undefined ||
    identitySource.authority !== "project-canonical-source" ||
    identitySource.artifactPath !== exactIdentitySourcePath ||
    identitySource.sha256 !== exactIdentitySourceSha256 ||
    identitySource.url !== null ||
    identitySource.reviewedPages !== null
  ) {
    errors.push("exact selected-MPN identity source must remain project-only")
  }
  const expectedParts = new Map([
    [
      "CRCW060322R0FKEAHP",
      {
        reference: "R_ESD",
        prefix: "R_ESD_",
        role: "normal-path protection series resistor",
        package: "0603",
        resistanceOhms: 22,
        tolerancePercent: 1,
        series: "vishay-d11-crcw0603-e3"
      }
    ],
    [
      "CRCW060320R0FKEAHP",
      {
        reference: "R_SAR",
        prefix: "R_SAR_",
        role: "SAR input isolation resistor",
        package: "0603",
        resistanceOhms: 20,
        tolerancePercent: 1,
        series: "vishay-d11-crcw0603-e3"
      }
    ],
    [
      "CRCW0603100KFKEAHP",
      {
        reference: "R_SOURCE_PD",
        prefix: "R_SOURCE_PD_",
        role: "source-enable safe-state pull-down",
        package: "0603",
        resistanceOhms: 100000,
        tolerancePercent: 1,
        series: "vishay-d11-crcw0603-e3"
      }
    ],
    [
      "CRCW120656K0FKEAHP",
      {
        reference: "R_FAULT_GUARD",
        prefix: "R_FAULT_GUARD_",
        role: "externally interlocked guarded-force resistor",
        package: "1206",
        resistanceOhms: 56000,
        tolerancePercent: 1,
        series: "vishay-d25-crcw1206-e3"
      }
    ]
  ])
  const seenMpns = new Set<string>()
  for (const part of evidence.exactSelectedParts) {
    const expected = expectedParts.get(part.manufacturerPartNumber)
    if (
      expected === undefined ||
      seenMpns.has(part.manufacturerPartNumber) ||
      part.manufacturer !== "Vishay" ||
      part.canonicalReference !== expected.reference ||
      part.replicatedReferencePrefix !== expected.prefix ||
      part.role !== expected.role ||
      part.package !== expected.package ||
      part.resistanceOhms !== expected.resistanceOhms ||
      part.tolerancePercent !== expected.tolerancePercent ||
      part.seriesGeometryId !== expected.series ||
      part.exactIdentitySourceId !== "bp031-selected-vishay-mpn-records" ||
      part.upstreamLedgerBinding.m404.artifactKind !== "m4-04-single-channel-sensing-coupon" ||
      part.upstreamLedgerBinding.m404.sourcePath !== m404LedgerPath ||
      part.upstreamLedgerBinding.m404.reference !== expected.reference ||
      part.upstreamLedgerBinding.m404.exactMpn !== part.manufacturerPartNumber ||
      part.upstreamLedgerBinding.m404.package !== expected.package ||
      part.upstreamLedgerBinding.m404.footprintRelease !== "deny" ||
      part.upstreamLedgerBinding.m404.independentDrawingReview.reviewerId !== "root-final-reviewer" ||
      part.upstreamLedgerBinding.m404.independentDrawingReview.status !== "pending" ||
      part.upstreamLedgerBinding.bp031.artifactKind !== "bench-prototype-analog-footprint-closure" ||
      part.upstreamLedgerBinding.bp031.sourcePath !== bp031LedgerPath ||
      part.upstreamLedgerBinding.bp031.sourceContract !== "BP-103" ||
      part.upstreamLedgerBinding.bp031.sourceSubcontract !== "BP-102" ||
      part.upstreamLedgerBinding.bp031.sourceBaseReference !== expected.reference ||
      part.upstreamLedgerBinding.bp031.replicatedReferencePrefix !== expected.prefix ||
      part.upstreamLedgerBinding.bp031.sharedManufacturerSourceId !== `M4-04:${part.manufacturerPartNumber}` ||
      part.upstreamLedgerBinding.bp031.disposition !== "DNP-unresolved" ||
      part.upstreamLedgerBinding.bp031.existingFootprintEvidence.eligibleForPcb ||
      part.upstreamLedgerBinding.bp031.existingFootprintEvidence.releaseState !== "deny" ||
      part.exactMpnNamedInManufacturerSource
    ) {
      errors.push(`exact selected MPN binding drifted for ${part.manufacturerPartNumber}`)
    }
    seenMpns.add(part.manufacturerPartNumber)
  }
  if (seenMpns.size !== expectedParts.size) errors.push("selected Vishay MPN set is incomplete")

  const familyIds = new Set(evidence.seriesGeometry.map((family) => family.id))
  if (familyIds.size !== 2 || !familyIds.has("vishay-d11-crcw0603-e3") || !familyIds.has("vishay-d25-crcw1206-e3")) {
    errors.push("selected Vishay series family set is incomplete")
  }
  for (const family of evidence.seriesGeometry) {
    const expectedD11 = family.id === "vishay-d11-crcw0603-e3"
    const expectedFamilyId = expectedD11 ? "vishay-d11-crcw0603-e3" : "vishay-d25-crcw1206-e3"
    const expectedPackage = expectedD11 ? d11Package : d25Package
    const expectedReflow = expectedD11 ? d11ReflowLandPattern : d25ReflowLandPattern
    const expectedWave = expectedD11 ? d11WaveLandPattern : d25WaveLandPattern
    const expectedProject = expectedD11 ? d11ProjectFootprint : d25ProjectFootprint
    if (family.id !== expectedFamilyId) {
      errors.push(`unexpected Vishay series geometry ${family.id}`)
    }
    if (
      family.package.family !== expectedPackage.family ||
      family.package.bodyLengthMm.minimum !== expectedPackage.bodyLengthMm.minimum ||
      family.package.bodyLengthMm.maximum !== expectedPackage.bodyLengthMm.maximum ||
      family.package.bodyWidthMm.minimum !== expectedPackage.bodyWidthMm.minimum ||
      family.package.bodyWidthMm.maximum !== expectedPackage.bodyWidthMm.maximum ||
      family.package.bodyHeightMm.minimum !== expectedPackage.bodyHeightMm.minimum ||
      family.package.bodyHeightMm.maximum !== expectedPackage.bodyHeightMm.maximum ||
      family.package.terminalLengthT1Mm.minimum !== expectedPackage.terminalLengthT1Mm.minimum ||
      family.package.terminalLengthT1Mm.maximum !== expectedPackage.terminalLengthT1Mm.maximum ||
      family.package.terminalLengthT2Mm.minimum !== expectedPackage.terminalLengthT2Mm.minimum ||
      family.package.terminalLengthT2Mm.maximum !== expectedPackage.terminalLengthT2Mm.maximum ||
      family.package.imperialSize !== expectedPackage.imperialSize ||
      family.package.metricSizeCode !== expectedPackage.metricSizeCode ||
      family.landPattern.sourceId !== "vishay-dcrcwe3-series-rev-2026-04-14" ||
      family.landPattern.reflow.gapMm !== expectedReflow.gapMm ||
      family.landPattern.reflow.padLengthAlongTerminalAxisMm !== expectedReflow.padLengthAlongTerminalAxisMm ||
      family.landPattern.reflow.padWidthAcrossTerminalAxisMm !== expectedReflow.padWidthAcrossTerminalAxisMm ||
      family.landPattern.reflow.overallSpanMm !== expectedReflow.overallSpanMm ||
      family.landPattern.wave.gapMm !== expectedWave.gapMm ||
      family.landPattern.wave.padLengthAlongTerminalAxisMm !== expectedWave.padLengthAlongTerminalAxisMm ||
      family.landPattern.wave.padWidthAcrossTerminalAxisMm !== expectedWave.padWidthAcrossTerminalAxisMm ||
      family.landPattern.wave.overallSpanMm !== expectedWave.overallSpanMm
    ) {
      errors.push(`Vishay series geometry drifted for ${family.id}`)
    }
    const project = family.projectFootprint
    const expectedPads = expectedProject.pads
    if (
      project.pads.length !== 2 ||
      project.state !== "review-only" ||
      project.geometryAuthority !==
        (expectedD11
          ? "project-review-input-derived-from-vishay-d11-reflow-guidance"
          : "project-review-input-derived-from-vishay-d25-reflow-guidance") ||
      project.padShape !== "rectangular-smt" ||
      project.padLengthMm !== expectedProject.padLengthMm ||
      project.padWidthMm !== expectedProject.padWidthMm ||
      project.padCenterSpanMm !== expectedProject.padCenterSpanMm ||
      project.padGapMm !== expectedProject.padGapMm ||
      project.accepted ||
      project.fabricationAuthority !== "deny" ||
      project.solderMask.sourceStatus !== "not-published" ||
      project.paste.sourceStatus !== "not-published" ||
      project.courtyard.sourceStatus !== "not-published" ||
      family.manufacturerCad.state !== "not-acquired" ||
      family.manufacturerCad.artifactPath !== null ||
      family.manufacturerCad.authority !== "deny" ||
      family.artwork.authority !== "deny" ||
      family.artwork.state !== "generated-project-review-only" ||
      family.artwork.representation !== "canonical-rendered-footprint-soup-geometry" ||
      family.artwork.generator !== "tscircuit" ||
      family.artwork.generatorVersion !== "0.0.2271" ||
      family.artwork.sha256 !==
        (expectedD11
          ? "EB0DD0D03CD7A003236E3897437CFB241845AF751681D5791A23E34920FEA62D"
          : "51F5C2A3B2D261EF74D4DC67EB7775C9F425E8E2FB863490A726118CFEFED250") ||
      !/^[0-9A-F]{64}$/u.test(family.artwork.sha256) ||
      project.orientation.polarity !== "non-polar" ||
      project.orientation.pinOne !== "not-applicable" ||
      project.orientation.state !== "pending-independent-review" ||
      project.orientation.assemblyRotationDeg !== null ||
      project.orientation.datum !== "two-terminal resistor axis"
    ) {
      errors.push(`Vishay project footprint must remain review-only and CAD-denied for ${family.id}`)
    }
    for (const [index, pad] of project.pads.entries()) {
      const expectedPad = expectedPads[index]
      if (
        expectedPad === undefined ||
        pad.pin !== expectedPad.pin ||
        pad.xMm !== expectedPad.xMm ||
        pad.yMm !== expectedPad.yMm
      ) {
        errors.push(`Vishay pad mapping drifted for ${family.id}`)
      }
    }
    if (
      project.solderMask.openingLengthMm !== project.padLengthMm + 2 * projectSolderMaskMarginMm ||
      project.solderMask.openingWidthMm !== project.padWidthMm + 2 * projectSolderMaskMarginMm ||
      project.solderMask.marginPerEdgeMm !== projectSolderMaskMarginMm ||
      project.paste.openingLengthMm !== project.padLengthMm - 2 * projectPasteReductionMm ||
      project.paste.openingWidthMm !== project.padWidthMm - 2 * projectPasteReductionMm ||
      project.paste.reductionPerEdgeMm !== projectPasteReductionMm ||
      project.courtyard.minimumClearanceMm !== projectCourtyardClearanceMm ||
      project.courtyard.widthMm !== project.courtyard.maximumXMm - project.courtyard.minimumXMm ||
      project.courtyard.heightMm !== project.courtyard.maximumYMm - project.courtyard.minimumYMm
    ) {
      errors.push(`Vishay project mask or paste derivation drifted for ${family.id}`)
    }
  }
  return errors
}

function resistorFootprint(
  family: (typeof bp031VishayCrcwResistorFootprintEvidence.seriesGeometry)[number],
  name: string
) {
  const project = family.projectFootprint
  return (
    <footprint name={name} originalLayer="top">
      <smtpad
        name="1"
        pcbX={project.pads[0].xMm}
        pcbY={project.pads[0].yMm}
        shape="rect"
        solderMaskMargin={`${project.solderMask.marginPerEdgeMm}mm`}
        solderPasteMargin={`-${project.paste.reductionPerEdgeMm}mm`}
        width={`${project.padLengthMm}mm`}
        height={`${project.padWidthMm}mm`}
        portHints={["1", "pin1", "A"]}
      />
      <smtpad
        name="2"
        pcbX={project.pads[1].xMm}
        pcbY={project.pads[1].yMm}
        shape="rect"
        solderMaskMargin={`${project.solderMask.marginPerEdgeMm}mm`}
        solderPasteMargin={`-${project.paste.reductionPerEdgeMm}mm`}
        width={`${project.padLengthMm}mm`}
        height={`${project.padWidthMm}mm`}
        portHints={["2", "pin2", "B"]}
      />
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${project.courtyard.widthMm}mm`}
        height={`${project.courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

export interface Bp031VishayCrcwResistorFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

function resistorComponent(
  manufacturerPartNumber: string,
  familyId: string,
  footprintName: string,
  props: Bp031VishayCrcwResistorFootprintProps
): ReactElement {
  const family = expectedFamily(familyId)
  if (family === undefined) throw new Error(`Missing BP-031 Vishay geometry ${familyId}`)
  return (
    <chip
      name={`U_BP031_${manufacturerPartNumber}`}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "1", pin2: "2" }}
      footprint={resistorFootprint(family, footprintName)}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
    />
  )
}

export function Bp031VishayCrcw060322R0FkeaHpFootprint(
  props: Bp031VishayCrcwResistorFootprintProps = {}
): ReactElement {
  return resistorComponent(
    "CRCW060322R0FKEAHP",
    "vishay-d11-crcw0603-e3",
    "BP031_VISHAY_CRCW0603_R_ESD_PROJECT_FOOTPRINT",
    props
  )
}

export function Bp031VishayCrcw060320R0FkeaHpFootprint(
  props: Bp031VishayCrcwResistorFootprintProps = {}
): ReactElement {
  return resistorComponent(
    "CRCW060320R0FKEAHP",
    "vishay-d11-crcw0603-e3",
    "BP031_VISHAY_CRCW0603_R_SAR_PROJECT_FOOTPRINT",
    props
  )
}

export function Bp031VishayCrcw0603100KfkeaHpFootprint(
  props: Bp031VishayCrcwResistorFootprintProps = {}
): ReactElement {
  return resistorComponent(
    "CRCW0603100KFKEAHP",
    "vishay-d11-crcw0603-e3",
    "BP031_VISHAY_CRCW0603_R_SOURCE_PD_PROJECT_FOOTPRINT",
    props
  )
}

export function Bp031VishayCrcw120656K0FkeaHpFootprint(
  props: Bp031VishayCrcwResistorFootprintProps = {}
): ReactElement {
  return resistorComponent(
    "CRCW120656K0FKEAHP",
    "vishay-d25-crcw1206-e3",
    "BP031_VISHAY_CRCW1206_R_FAULT_GUARD_PROJECT_FOOTPRINT",
    props
  )
}

export default Bp031VishayCrcw060322R0FkeaHpFootprint
