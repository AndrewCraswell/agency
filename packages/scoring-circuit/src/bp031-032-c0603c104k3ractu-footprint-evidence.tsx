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

const bp033References = [
  "C_APP_REG_IN_HF",
  "C_APP_REG_BOOT",
  "C_HUB75_BUF_A_BYPASS",
  "C_HUB75_BUF_B_BYPASS",
  "C_IR_VS",
  "C_FRAM_BYPASS"
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
const basisCommit = "55fcb34e7af21663ae534dcbf20882553359fa27"

const upstreamSourceHashes = [
  {
    path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
    sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d",
    scope: "canonical C_REF_REG_HF MPN/package selection"
  },
  {
    path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
    sha256: "4a50698a9344ff2390a12d515f0f964273812a165d3ea3eaf9a5c1e7edc9bf71",
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
    sha256: "298f04737136ba41b9f909ecf838342df5d2da1173778bd42a64ac0048d9e9ce",
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
function deepFreeze<T extends object>(value: T, seen = new WeakSet<object>()): T {
  if (seen.has(value)) return value
  seen.add(value)
  for (const propertyKey of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, propertyKey)
    if (descriptor && "value" in descriptor && typeof descriptor.value === "object" && descriptor.value !== null) {
      deepFreeze(descriptor.value, seen)
    }
  }
  Object.freeze(value)
  return value
}

const bp031032C0603C104K3RactuFootprintEvidenceBaseline = deepFreeze({
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
} as const)

export const bp031032C0603C104K3RactuFootprintEvidence = deepFreeze(
  structuredClone(bp031032C0603C104K3RactuFootprintEvidenceBaseline)
)

const bp033SourceContractBindings = [
  {
    contract: "BP-142",
    references: ["C_APP_REG_IN_HF", "C_APP_REG_BOOT"],
    sourcePath: "packages/scoring-circuit/src/bench-prototype-application-rail.ts",
    sourceSha256: "ED4BFC8B752BE974323BF7ED95B1B5718C1C2F1D903B6444E652245326F35E67",
    scope: "application regulator high-frequency input and bootstrap capacitor selections"
  },
  {
    contract: "BP-144",
    references: ["C_HUB75_BUF_A_BYPASS", "C_HUB75_BUF_B_BYPASS"],
    sourcePath: "packages/scoring-circuit/src/bench-prototype-hub75-safing.ts",
    sourceSha256: "0DBD6D07A1C10AA93C0DBC92062C271186A0FE5BA6B31B109F771544A4AFAAA2",
    scope: "two HUB75 buffer local bypass capacitor selections"
  },
  {
    contract: "BP-145",
    references: ["C_FRAM_BYPASS"],
    sourcePath: "packages/scoring-circuit/src/bench-prototype-optional-peripherals.ts",
    sourceSha256: "18B19F1BD020DAF861527D32AE4630464AFD5E00E6167460E2816A38C1296FFA",
    scope: "F-RAM local bypass capacitor selection"
  },
  {
    contract: "BP-146",
    references: ["C_IR_VS"],
    sourcePath: "packages/scoring-circuit/src/bench-prototype-ir-receiver-selection.ts",
    sourceSha256: "D716C2702606A7EA7A00D72ED0434B56A3BF4F13B6F9638E92221BDF9E68852D",
    scope: "encrypted-IR receiver filtered-supply bypass capacitor selection"
  }
] as const

const bp031032033C0603C104K3RactuFootprintEvidenceBaseline = deepFreeze({
  ...structuredClone(bp031032C0603C104K3RactuFootprintEvidenceBaseline),
  artifactKind: "bp031-032-033-c0603c104k3ractu-footprint-evidence",
  workUnits: ["BP-031", "BP-032", "BP-033"],
  sourceContracts: ["BP-101", "BP-123", "BP-142", "BP-144", "BP-145", "BP-146"],
  affectedReferences: [...bp031References, ...bp032References, ...bp033References],
  referenceSets: {
    ...structuredClone(bp031032C0603C104K3RactuFootprintEvidenceBaseline.referenceSets),
    bp033: {
      workUnit: "BP-033",
      references: [...bp033References],
      role: "application regulator, HUB75 buffer, encrypted-IR receiver, and F-RAM local bypass capacitors",
      sourceContracts: ["BP-142", "BP-144", "BP-145", "BP-146"],
      sourceContractBindings: structuredClone(bp033SourceContractBindings)
    }
  },
  sourceBinding: {
    ...structuredClone(bp031032C0603C104K3RactuFootprintEvidenceBaseline.sourceBinding),
    canonicalSourcePaths: [
      ...structuredClone(bp031032C0603C104K3RactuFootprintEvidenceBaseline.sourceBinding.canonicalSourcePaths),
      ...bp033SourceContractBindings.map((binding) => binding.sourcePath)
    ],
    bp033SourceContractBindings: structuredClone(bp033SourceContractBindings)
  }
} as const)

/** BP-033 extension of the shared review-only candidate; the BP-031/BP-032 baseline remains independent. */
export const bp031032033C0603C104K3RactuFootprintEvidence = deepFreeze(
  structuredClone(bp031032033C0603C104K3RactuFootprintEvidenceBaseline)
)

type ExactGraphState = {
  readonly actualSeen: Set<object>
  readonly expectedSeen: Set<object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: ExactGraphState, path: string): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`C0603C104K3RACTU exact graph drift at ${path}`)
    return
  }
  if (typeof actual !== "object" || actual === null)
    throw new RangeError(`C0603C104K3RACTU exact graph drift at ${path}`)
  if (state.actualSeen.has(actual) || state.expectedSeen.has(expected))
    throw new RangeError(`C0603C104K3RACTU graph cycle or alias at ${path}`)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected))
    throw new RangeError(`C0603C104K3RACTU prototype drift at ${path}`)

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !actualKeys.includes(key)) ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new RangeError(`C0603C104K3RACTU hidden or symbol property drift at ${path}`)
  }

  state.actualSeen.add(actual)
  state.expectedSeen.add(expected)
  for (const key of expectedKeys) {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      !actualDescriptor ||
      !expectedDescriptor ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.get !== undefined ||
      actualDescriptor.set !== undefined ||
      expectedDescriptor.get !== undefined ||
      expectedDescriptor.set !== undefined ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable ||
      actualDescriptor.writable !== expectedDescriptor.writable
    ) {
      throw new RangeError(`C0603C104K3RACTU getter or descriptor drift at ${path}.${String(key)}`)
    }
    assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${String(key)}`)
  }
}

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
  try {
    assertExactDataGraph(
      candidate,
      bp031032C0603C104K3RactuFootprintEvidenceBaseline,
      {
        actualSeen: new Set(),
        expectedSeen: new Set()
      },
      "root"
    )
  } catch {
    return ["C0603C104K3RACTU exact graph, descriptor, or deny-state drifted"]
  }
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

/** Empty output means the BP-033 extension remains an internally consistent deny-by-default candidate. */
export function validateBp031032033C0603C104K3RactuFootprintEvidence(
  candidate: typeof bp031032033C0603C104K3RactuFootprintEvidence = bp031032033C0603C104K3RactuFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  try {
    assertExactDataGraph(
      candidate,
      bp031032033C0603C104K3RactuFootprintEvidenceBaseline,
      {
        actualSeen: new Set(),
        expectedSeen: new Set()
      },
      "root"
    )
  } catch {
    return ["C0603C104K3RACTU BP-033 extension graph, descriptor, or deny-state drifted"]
  }

  const exactSource = candidate.sources[0]
  const expectedReferences = [...bp031References, ...bp032References, ...bp033References]
  if (
    candidate.artifactKind !== "bp031-032-033-c0603c104k3ractu-footprint-evidence" ||
    !sameJson(candidate.workUnits, ["BP-031", "BP-032", "BP-033"]) ||
    !sameJson(candidate.sourceContracts, ["BP-101", "BP-123", "BP-142", "BP-144", "BP-145", "BP-146"]) ||
    !sameJson(candidate.affectedReferences, expectedReferences)
  ) {
    errors.push("BP-033 extension identity, work-unit, source-contract, or reference scope drifted")
  }

  const bp033ReferenceSet = candidate.referenceSets.bp033
  if (
    bp033ReferenceSet.workUnit !== "BP-033" ||
    !sameJson(bp033ReferenceSet.references, bp033References) ||
    !sameJson(bp033ReferenceSet.sourceContracts, ["BP-142", "BP-144", "BP-145", "BP-146"]) ||
    !sameJson(bp033ReferenceSet.sourceContractBindings, bp033SourceContractBindings) ||
    !sameJson(candidate.sourceBinding.bp033SourceContractBindings, bp033SourceContractBindings)
  ) {
    errors.push("BP-033 exact reference-set or source-contract provenance drifted")
  }

  if (
    candidate.sourceControl.basisCommit !== basisCommit ||
    exactSource.sha256 !== sourceSha256 ||
    !isSha256(exactSource.sha256) ||
    candidate.artwork.sha256 !== artworkSha256 ||
    !isSha256(candidate.artwork.sha256)
  ) {
    errors.push("shared C0603 source or rendered artwork hash drifted")
  }

  if (
    candidate.manufacturerCad.state !== "not-acquired" ||
    candidate.manufacturerCad.artifactPath !== null ||
    candidate.manufacturerCad.authority !== "deny" ||
    candidate.projectFootprint.accepted ||
    candidate.projectFootprint.fabricationAuthority !== "deny" ||
    candidate.artwork.authority !== "deny" ||
    candidate.releaseState !== "deny" ||
    candidate.fabricationAuthority !== "deny" ||
    candidate.accepted
  ) {
    errors.push("BP-033 extension must preserve every CAD, artwork, release, fabrication, and acceptance deny gate")
  }

  return errors
}

export function bp031032C0603C104K3RactuFootprintEvidenceFor(mpn: string, reference: string) {
  if (
    mpn !== manufacturerPartNumber ||
    !bp031032C0603C104K3RactuFootprintEvidence.referenceSets.bp032.references.some(
      (candidateReference) => candidateReference === reference
    )
  ) {
    return null
  }
  const source = bp031032C0603C104K3RactuFootprintEvidence.sources[0]
  if (source === undefined) throw new RangeError("C0603C104K3RACTU retained source is missing")
  return {
    artifactKind: bp031032C0603C104K3RactuFootprintEvidence.artifactKind,
    exactMpn: mpn,
    reference,
    sourceId: source.id,
    sourceOwner: "M4-04",
    upstreamContract: "BP-123",
    sourceArtifactPath: source.artifactPath,
    sourceSha256: source.sha256,
    projectFootprintId: "c0603c104k3ractu-project-review",
    manufacturerCad: "not-acquired",
    manufacturerLandPattern: "not-published",
    artwork: "generated-project-review-only",
    orientation: "pending-independent-review",
    releaseState: "deny",
    fabricationAuthority: "deny",
    accepted: false
  } as const
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
