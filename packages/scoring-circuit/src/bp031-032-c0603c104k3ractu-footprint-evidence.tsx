import type { ReactElement } from "react"

const manufacturerPartNumber = "C0603C104K3RACTU"
const packageName = "0603"

const bp031References = [
  "C_REF_REG_HF_1",
  "C_REF_REG_HF_2",
  "C_REF_REG_HF_3",
  "C_REF_REG_HF_4",
  "C_REF_REG_HF_5",
  "C_REF_REG_HF_6",
  "C_REF_REG_HF_7"
] as const

const bp032References = [
  "C_STM_SUPERVISOR_CT",
  "C_STM_SUPERVISOR_BYPASS",
  "C_STM_WD_BYPASS",
  "C_STM_NRST_FILTER",
  "C_ESP_SUPERVISOR_CT",
  "C_ESP_SUPERVISOR_BYPASS",
  "C_ESP_WD_BYPASS",
  "C_APP_RESET_FANOUT_BYPASS"
] as const

const affectedReferences = [...bp031References, ...bp032References] as const

const packageLengthMm = { nominal: 1.6, minimum: 1.45, maximum: 1.75 } as const
const packageWidthMm = { nominal: 0.8, minimum: 0.65, maximum: 0.95 } as const
const packageThicknessMm = { nominal: 0.8, minimum: 0.65, maximum: 0.95 } as const
const terminalBandwidthMm = { nominal: 0.35, minimum: 0.2, maximum: 0.5 } as const
const terminalSeparationMinimumMm = 0.5

// The retained exact-part data sheet does not publish a 0603 land pattern.
// These are project-review inputs, selected from the package envelope and
// terminal separation; they are not manufacturer CAD or manufacturer guidance.
const projectPadGapMm = 0.5
const projectPadLengthMm = 0.9
const projectPadWidthMm = 0.9
const projectPadCenterXMm = (projectPadGapMm + projectPadLengthMm) / 2
const projectMaskMarginMm = 0.05
const projectPasteReductionPerEdgeMm = 0.05
const projectMaskOpeningLengthMm = Number((projectPadLengthMm + 2 * projectMaskMarginMm).toFixed(3))
const projectMaskOpeningWidthMm = Number((projectPadWidthMm + 2 * projectMaskMarginMm).toFixed(3))
const projectPasteOpeningLengthMm = Number((projectPadLengthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectPasteOpeningWidthMm = Number((projectPadWidthMm - 2 * projectPasteReductionPerEdgeMm).toFixed(3))
const projectCourtyardLengthMm = 2.4
const projectCourtyardWidthMm = 1.4

const sourceArtifactPath = "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf"
const sourceSha256 = "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"
const basisCommit = "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c"

const upstreamSourceHashes = [
  {
    path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d",
    scope: "canonical C_REF_REG_HF MPN/package selection"
  },
  {
    path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
    sha256: "ac7a72f68b8d9113b6ad1d161645cc8f8b7062207abf4fe5411042962e22314c",
    scope: "BP-031 seven-channel C_REF_REG_HF_1..7 reference expansion"
  },
  {
    path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
    sha256: "ac47072bad3f60aa4e193192ab01c02507a3f61944f8b45f23b1f2793f207efb",
    scope: "BP-031 seven-channel analog topology and reference-loop role"
  },
  {
    path: "packages/scoring-circuit/src/bp-123-reset-watchdog-fragment.circuit.tsx",
    sha256: "4e5b3a84f6b1f22f233665b94aed9caff3151446d4272250d25e090619af822c",
    scope: "BP-032 reset/watchdog/support bypass references and exact MPN use"
  },
  {
    path: "packages/scoring-circuit/src/bench-prototype-reset-watchdog.ts",
    sha256: "0f10f1e308c0b3760c38a5a30405d727f1115bffac1c3f141d8eaf8789dd7e23",
    scope: "BP-032 reset/watchdog electrical contract"
  },
  {
    path: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
    sha256: "2cba495fc2746c038fb09a13793b1dbf7f7d0b4d8f55d7f748ad2e0e9e12d0e0",
    scope: "M4-04 exact C0603C104K3RACTU source registry"
  }
] as const

/**
 * Review-only footprint evidence for the exact C0603C104K3RACTU orderable.
 *
 * The retained Yageo/KEMET document is an exact-part product specification,
 * not a land-pattern or CAD release. Project copper, mask, paste, courtyard,
 * and orientation are therefore explicit review inputs and remain denied.
 */
export const bp031032C0603C104K3RactuFootprintEvidence = {
  artifactKind: "bp031-032-c0603c104k3ractu-footprint-evidence",
  workUnits: ["BP-031", "BP-032"],
  sourceContracts: ["BP-101", "BP-123"],
  manufacturer: "KEMET",
  manufacturerPartNumber,
  package: {
    designation: "0603 (1608 metric) ceramic chip capacitor",
    caseSize: "EIA 0603 / IEC 1608",
    dielectric: "X7R",
    capacitanceNf: 100,
    tolerancePercent: 10,
    ratedVoltageVdc: 25,
    lengthMm: packageLengthMm,
    widthMm: packageWidthMm,
    thicknessMm: packageThicknessMm,
    terminalBandwidthMm,
    terminalSeparationMinimumMm,
    terminals: 2
  },
  affectedReferences,
  referenceSets: {
    bp031: {
      workUnit: "BP-031",
      canonicalSourceReference: "C_REF_REG_HF",
      replicatedReferencePrefix: "C_REF_REG_HF_",
      references: bp031References,
      role: "seven-channel REF5025A-Q1 local high-frequency output bypass"
    },
    bp032: {
      workUnit: "BP-032",
      canonicalSourceReference: "BP-123 reset/watchdog fragment",
      references: bp032References,
      role: "reset, supervisor, watchdog, and reset-fanout support bypass capacitors"
    }
  },
  sourceBinding: {
    canonicalSourcePaths: [
      "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
      "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
      "packages/scoring-circuit/src/bp-123-reset-watchdog-fragment.circuit.tsx"
    ],
    manufacturer: "KEMET",
    manufacturerPartNumber,
    package: packageName,
    primarySourceId: "yageo-kemet-c0603c104k3ractu-datasheet"
  },
  sourceControl: {
    basisCommit,
    upstreamSources: upstreamSourceHashes
  },
  sources: [
    {
      id: "yageo-kemet-c0603c104k3ractu-datasheet",
      authority: "manufacturer-primary",
      manufacturer: "YAGEO/KEMET",
      documentNumber: "C0603C104K3RACTU product specification",
      revision: "Generated 2026-08-24",
      url: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en",
      artifactPath: sourceArtifactPath,
      sha256: sourceSha256,
      reviewedPages: [1],
      pageBinding: {
        retainedPdfPageCount: 4,
        exactOrderablePdfPage: 1,
        printedPageLabel: "1",
        manufacturerPartNumber,
        package: "0603 / 1608",
        purpose: "Bind the exact orderable identity and package dimensions to the retained PDF page."
      },
      scope:
        "PDF page 1 names the exact C0603C104K3RACTU orderable (alias C0603C104K3RAC7867), 100 nF, 10%, 25 VDC, X7R, 0603/1608, and dimensions L 1.6 +/-0.15 mm, W 0.8 +/-0.15 mm, T 0.8 +/-0.15 mm, S 0.5 mm minimum, B 0.35 +/-0.15 mm. The retained product specification publishes no exact land pattern, solder-mask opening, paste aperture, courtyard, or CAD object."
    }
  ],
  manufacturerLandPattern: {
    sourceId: "yageo-kemet-c0603c104k3ractu-datasheet",
    sourceScope: "retained exact-part product specification; land-pattern guidance not published",
    termination: "tin",
    densityLevel: null,
    copper: {
      status: "not-published",
      padGapMm: null,
      padLengthMm: null,
      padWidthMm: null,
      sourceStatement:
        "The retained Yageo/KEMET PDF gives package and terminal dimensions only; it does not specify copper lands."
    },
    solderMask: {
      status: "not-published",
      sourceStatement: "The retained Yageo/KEMET PDF does not specify solder-mask openings or a mask margin."
    },
    paste: {
      status: "not-published",
      sourceStatement: "The retained Yageo/KEMET PDF does not specify stencil apertures or paste reduction."
    },
    courtyard: {
      status: "not-published",
      lengthMm: null,
      widthMm: null,
      sourceStatement: "The retained Yageo/KEMET PDF does not specify a courtyard or assembly keepout."
    }
  },
  manufacturerCad: {
    state: "not-acquired",
    artifactPath: null,
    authority: "deny",
    note: "No official retained CAD object exists in this slice; package prose is not treated as CAD."
  },
  projectSelection: {
    solderingMethod: "reflow",
    basis: "project-review-input-from-package-envelope-and-terminal-separation",
    copperPad: {
      lengthMm: projectPadLengthMm,
      widthMm: projectPadWidthMm,
      gapMm: projectPadGapMm,
      centerSpanMm: projectPadGapMm + projectPadLengthMm,
      status: "project-input-not-manufacturer-specification"
    },
    solderMask: {
      openingLengthMm: projectMaskOpeningLengthMm,
      openingWidthMm: projectMaskOpeningWidthMm,
      marginPerEdgeMm: projectMaskMarginMm,
      status: "project-input-not-manufacturer-specification",
      derivation: "project NSMD review input: project copper dimensions plus 0.05 mm per edge"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      status: "project-input-not-manufacturer-specification",
      derivation: "project reflow review input: project copper dimensions less 0.05 mm per edge"
    },
    courtyard: {
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      clearanceFromPadAndPackageMm: { length: 0.05, width: 0.15 },
      status: "project-review-input-not-manufacturer-specification",
      derivation: "project review envelope around the selected copper and maximum package dimensions"
    }
  },
  terminals: [
    { pad: "1", terminal: "A", polarity: "non-polar", xMm: -projectPadCenterXMm, yMm: 0 },
    { pad: "2", terminal: "B", polarity: "non-polar", xMm: projectPadCenterXMm, yMm: 0 }
  ],
  orientation: {
    state: "pending-review",
    polarity: "non-polar",
    pinOne: "not-applicable",
    assemblyRotationDeg: null,
    rotationEquivalence: "180-degree rotationally equivalent",
    datum: "local two-terminal capacitor axis",
    note: "The MLCC has no polarity or pin-one requirement. A and B are arbitrary review endpoints; final assembly orientation and stress review remain open."
  },
  projectFootprint: {
    state: "review-only",
    geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
    padShape: "rectangular-smt",
    pads: [
      {
        pad: "1",
        terminal: "A",
        xMm: -projectPadCenterXMm,
        yMm: 0,
        widthMm: projectPadLengthMm,
        heightMm: projectPadWidthMm
      },
      {
        pad: "2",
        terminal: "B",
        xMm: projectPadCenterXMm,
        yMm: 0,
        widthMm: projectPadLengthMm,
        heightMm: projectPadWidthMm
      }
    ],
    solderMask: {
      openingLengthMm: projectMaskOpeningLengthMm,
      openingWidthMm: projectMaskOpeningWidthMm,
      marginPerEdgeMm: projectMaskMarginMm,
      status: "project-input-not-manufacturer-specification"
    },
    paste: {
      openingLengthMm: projectPasteOpeningLengthMm,
      openingWidthMm: projectPasteOpeningWidthMm,
      reductionPerEdgeMm: projectPasteReductionPerEdgeMm,
      status: "project-input-not-manufacturer-specification"
    },
    courtyard: {
      centerMm: { x: 0, y: 0 },
      lengthMm: projectCourtyardLengthMm,
      widthMm: projectCourtyardWidthMm,
      status: "project-review-input-not-manufacturer-specification"
    },
    orientation: {
      datum: "pad 1 at negative local X; pad 2 at positive local X",
      boardRotationDegrees: 0,
      pinOnePad: null,
      polarity: "non-polar"
    },
    fabricationAuthority: "deny",
    accepted: false
  },
  artwork: {
    state: "generated-project-review-only",
    representation: "canonical-rendered-footprint-soup-geometry",
    generator: "tscircuit",
    generatorVersion: "0.0.2271",
    sha256: artworkSha256,
    authority: "deny"
  },
  releaseState: "deny",
  fabricationAuthority: "deny",
  accepted: false
} as const

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F]{64}$/u.test(value)
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** Empty output means the deny-by-default candidate is internally consistent. */
export function validateBp031032C0603C104K3RactuFootprintEvidence(
  candidate: typeof bp031032C0603C104K3RactuFootprintEvidence = bp031032C0603C104K3RactuFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  const exactSource = candidate.sources[0]
  const expectedReferences = [...bp031References, ...bp032References]

  if (
    candidate.artifactKind !== "bp031-032-c0603c104k3ractu-footprint-evidence" ||
    !sameJson(candidate.workUnits, ["BP-031", "BP-032"]) ||
    !sameJson(candidate.sourceContracts, ["BP-101", "BP-123"]) ||
    candidate.manufacturer !== "KEMET" ||
    candidate.manufacturerPartNumber !== manufacturerPartNumber ||
    !sameJson(candidate.affectedReferences, expectedReferences)
  ) {
    errors.push("exact C0603C104K3RACTU identity, work-unit, or reference scope drifted")
  }
  if (
    candidate.referenceSets.bp031.workUnit !== "BP-031" ||
    candidate.referenceSets.bp031.canonicalSourceReference !== "C_REF_REG_HF" ||
    candidate.referenceSets.bp031.replicatedReferencePrefix !== "C_REF_REG_HF_" ||
    !sameJson(candidate.referenceSets.bp031.references, bp031References) ||
    candidate.referenceSets.bp032.workUnit !== "BP-032" ||
    !sameJson(candidate.referenceSets.bp032.references, bp032References)
  ) {
    errors.push("BP-031 or BP-032 exact reference-set binding drifted")
  }
  if (
    !sameJson(candidate.sourceBinding.canonicalSourcePaths, [
      "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
      "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
      "packages/scoring-circuit/src/bp-123-reset-watchdog-fragment.circuit.tsx"
    ]) ||
    candidate.sourceBinding.manufacturer !== "KEMET" ||
    candidate.sourceBinding.manufacturerPartNumber !== manufacturerPartNumber ||
    candidate.sourceBinding.package !== packageName ||
    candidate.sourceBinding.primarySourceId !== "yageo-kemet-c0603c104k3ractu-datasheet"
  ) {
    errors.push("canonical C0603C104K3RACTU source binding drifted")
  }
  if (
    candidate.sourceControl.basisCommit !== basisCommit ||
    candidate.sourceControl.upstreamSources.length !== upstreamSourceHashes.length ||
    candidate.sourceControl.upstreamSources.some(
      (source, index) =>
        source.path !== upstreamSourceHashes[index]?.path ||
        source.sha256 !== upstreamSourceHashes[index]?.sha256 ||
        source.scope !== upstreamSourceHashes[index]?.scope
    )
  ) {
    errors.push("canonical upstream source-control hashes drifted")
  }
  if (
    candidate.sources.length !== 1 ||
    exactSource === undefined ||
    exactSource.id !== "yageo-kemet-c0603c104k3ractu-datasheet" ||
    exactSource.authority !== "manufacturer-primary" ||
    exactSource.manufacturer !== "YAGEO/KEMET" ||
    exactSource.documentNumber !== "C0603C104K3RACTU product specification" ||
    exactSource.revision !== "Generated 2026-08-24" ||
    exactSource.url !== "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en" ||
    exactSource.artifactPath !== sourceArtifactPath ||
    exactSource.sha256 !== sourceSha256 ||
    !sameJson(exactSource.reviewedPages, [1]) ||
    exactSource.pageBinding.retainedPdfPageCount !== 4 ||
    exactSource.pageBinding.exactOrderablePdfPage !== 1 ||
    exactSource.pageBinding.printedPageLabel !== "1" ||
    exactSource.pageBinding.manufacturerPartNumber !== manufacturerPartNumber ||
    exactSource.pageBinding.package !== "0603 / 1608" ||
    !isSha256(exactSource.sha256)
  ) {
    errors.push("retained Yageo/KEMET source identity, SHA-256, or PDF-page binding drifted")
  }
  if (
    candidate.package.designation !== "0603 (1608 metric) ceramic chip capacitor" ||
    candidate.package.caseSize !== "EIA 0603 / IEC 1608" ||
    candidate.package.dielectric !== "X7R" ||
    candidate.package.capacitanceNf !== 100 ||
    candidate.package.tolerancePercent !== 10 ||
    candidate.package.ratedVoltageVdc !== 25 ||
    candidate.package.lengthMm.minimum !== 1.45 ||
    candidate.package.lengthMm.maximum !== 1.75 ||
    candidate.package.widthMm.minimum !== 0.65 ||
    candidate.package.widthMm.maximum !== 0.95 ||
    candidate.package.thicknessMm.minimum !== 0.65 ||
    candidate.package.thicknessMm.maximum !== 0.95 ||
    candidate.package.terminalBandwidthMm.minimum !== 0.2 ||
    candidate.package.terminalBandwidthMm.maximum !== 0.5 ||
    candidate.package.terminalSeparationMinimumMm !== 0.5 ||
    candidate.package.terminals !== 2
  ) {
    errors.push("C0603C104K3RACTU exact package dimensions or electrical identity drifted")
  }
  if (
    candidate.manufacturerLandPattern.sourceId !== "yageo-kemet-c0603c104k3ractu-datasheet" ||
    candidate.manufacturerLandPattern.sourceScope !==
      "retained exact-part product specification; land-pattern guidance not published" ||
    candidate.manufacturerLandPattern.densityLevel !== null ||
    candidate.manufacturerLandPattern.copper.status !== "not-published" ||
    candidate.manufacturerLandPattern.copper.padGapMm !== null ||
    candidate.manufacturerLandPattern.copper.padLengthMm !== null ||
    candidate.manufacturerLandPattern.copper.padWidthMm !== null ||
    candidate.manufacturerLandPattern.solderMask.status !== "not-published" ||
    candidate.manufacturerLandPattern.paste.status !== "not-published" ||
    candidate.manufacturerLandPattern.courtyard.status !== "not-published" ||
    candidate.manufacturerLandPattern.courtyard.lengthMm !== null ||
    candidate.manufacturerLandPattern.courtyard.widthMm !== null
  ) {
    errors.push("manufacturer land, mask, paste, and courtyard publication boundary drifted")
  }
  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.authority !== "deny"
  ) {
    errors.push("manufacturer CAD must remain unacquired and denied")
  }
  if (
    candidate.projectSelection.copperPad.lengthMm !== projectPadLengthMm ||
    candidate.projectSelection.copperPad.widthMm !== projectPadWidthMm ||
    candidate.projectSelection.copperPad.gapMm !== projectPadGapMm ||
    candidate.projectSelection.copperPad.centerSpanMm !== projectPadGapMm + projectPadLengthMm ||
    candidate.projectSelection.copperPad.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectSelection.solderMask.openingLengthMm !== projectMaskOpeningLengthMm ||
    candidate.projectSelection.solderMask.openingWidthMm !== projectMaskOpeningWidthMm ||
    candidate.projectSelection.solderMask.marginPerEdgeMm !== projectMaskMarginMm ||
    candidate.projectSelection.solderMask.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectSelection.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    candidate.projectSelection.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    candidate.projectSelection.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    candidate.projectSelection.paste.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectSelection.courtyard.lengthMm !== projectCourtyardLengthMm ||
    candidate.projectSelection.courtyard.widthMm !== projectCourtyardWidthMm ||
    candidate.projectSelection.courtyard.status !== "project-review-input-not-manufacturer-specification"
  ) {
    errors.push("project C0603 copper, mask, paste, or courtyard geometry drifted")
  }
  if (
    candidate.terminals.length !== 2 ||
    candidate.terminals[0]?.pad !== "1" ||
    candidate.terminals[0]?.terminal !== "A" ||
    candidate.terminals[0]?.xMm !== -projectPadCenterXMm ||
    candidate.terminals[0]?.yMm !== 0 ||
    candidate.terminals[0]?.polarity !== "non-polar" ||
    candidate.terminals[1]?.pad !== "2" ||
    candidate.terminals[1]?.terminal !== "B" ||
    candidate.terminals[1]?.xMm !== projectPadCenterXMm ||
    candidate.terminals[1]?.yMm !== 0 ||
    candidate.terminals[1]?.polarity !== "non-polar" ||
    candidate.orientation.polarity !== "non-polar" ||
    candidate.orientation.pinOne !== "not-applicable" ||
    candidate.orientation.assemblyRotationDeg !== null ||
    candidate.orientation.rotationEquivalence !== "180-degree rotationally equivalent"
  ) {
    errors.push("C0603 non-polar terminal or orientation disposition drifted")
  }
  if (
    candidate.projectFootprint.pads.length !== 2 ||
    candidate.projectFootprint.pads[0]?.pad !== "1" ||
    candidate.projectFootprint.pads[0]?.terminal !== "A" ||
    candidate.projectFootprint.pads[0]?.xMm !== -projectPadCenterXMm ||
    candidate.projectFootprint.pads[0]?.yMm !== 0 ||
    candidate.projectFootprint.pads[1]?.pad !== "2" ||
    candidate.projectFootprint.pads[1]?.terminal !== "B" ||
    candidate.projectFootprint.pads[1]?.xMm !== projectPadCenterXMm ||
    candidate.projectFootprint.pads[1]?.yMm !== 0 ||
    candidate.projectFootprint.pads[0]?.widthMm !== projectPadLengthMm ||
    candidate.projectFootprint.pads[1]?.widthMm !== projectPadLengthMm ||
    candidate.projectFootprint.pads[0]?.heightMm !== projectPadWidthMm ||
    candidate.projectFootprint.pads[1]?.heightMm !== projectPadWidthMm ||
    candidate.projectFootprint.solderMask.openingLengthMm !== projectMaskOpeningLengthMm ||
    candidate.projectFootprint.solderMask.openingWidthMm !== projectMaskOpeningWidthMm ||
    candidate.projectFootprint.solderMask.marginPerEdgeMm !== projectMaskMarginMm ||
    candidate.projectFootprint.solderMask.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectFootprint.paste.openingLengthMm !== projectPasteOpeningLengthMm ||
    candidate.projectFootprint.paste.openingWidthMm !== projectPasteOpeningWidthMm ||
    candidate.projectFootprint.paste.reductionPerEdgeMm !== projectPasteReductionPerEdgeMm ||
    candidate.projectFootprint.paste.status !== "project-input-not-manufacturer-specification" ||
    candidate.projectFootprint.courtyard.lengthMm !== projectCourtyardLengthMm ||
    candidate.projectFootprint.courtyard.widthMm !== projectCourtyardWidthMm ||
    candidate.projectFootprint.orientation.boardRotationDegrees !== 0 ||
    candidate.projectFootprint.orientation.pinOnePad !== null ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("rendered project footprint geometry or deny state drifted")
  }
  if (
    candidate.artwork.sha256 !== artworkSha256 ||
    !isSha256(candidate.artwork.sha256) ||
    candidate.artwork.authority !== "deny"
  ) {
    errors.push("rendered artwork must have a bound SHA-256 while remaining denied")
  }
  return errors
}

const projectFootprint = (
  <footprint name="BP031_032_C0603C104K3RACTU_REVIEW_ONLY" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-projectPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectPadLengthMm}mm`}
      height={`${projectPadWidthMm}mm`}
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={projectPadCenterXMm}
      pcbY={0}
      shape="rect"
      solderMaskMargin={`${projectMaskMarginMm}mm`}
      solderPasteMargin={`-${projectPasteReductionPerEdgeMm}mm`}
      width={`${projectPadLengthMm}mm`}
      height={`${projectPadWidthMm}mm`}
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    <courtyardrect
      pcbX={0}
      pcbY={0}
      width={`${projectCourtyardLengthMm}mm`}
      height={`${projectCourtyardWidthMm}mm`}
      strokeWidth="0.05mm"
    />
  </footprint>
)

export interface Bp031032C0603C104K3RactuFootprintEvidenceProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated tscircuit component for this BP-031/BP-032 review slice. */
export function Bp031032C0603C104K3RactuFootprintEvidence({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031032C0603C104K3RactuFootprintEvidenceProps = {}): ReactElement {
  return (
    <chip
      name="C_BP031_032_C0603C104K3RACTU"
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031032C0603C104K3RactuFootprintEvidence
