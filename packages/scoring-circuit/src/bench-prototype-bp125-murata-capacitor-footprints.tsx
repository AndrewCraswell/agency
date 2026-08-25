import { types as nodeTypes } from "node:util"
import type { ReactElement } from "react"

type CandidateFootprintGeometry = {
  readonly artifactKind: "bp125-murata-mlcc-candidate-footprint"
  readonly workUnit: "BP-125"
  readonly package: string
  readonly packageCode: "18" | "21" | "32"
  readonly appliesTo: readonly {
    readonly manufacturerPartNumber: string
    readonly references: readonly string[]
  }[]
  /**
   * Hash-bound retained evidence for each exact selected MPN. A characteristic
   * response supports the selected MPN's source part number but is deliberately
   * not treated as CAD or as a manufacturer land-pattern release.
   */
  readonly exactMpnEvidence: readonly {
    readonly manufacturerPartNumber: string
    readonly officialProductDetailUrl: string
    readonly artifactPath: string
    readonly sha256: string
    readonly evidenceKind: "exact-mpn-reference-sheet" | "selected-mpn-characteristic-response"
    readonly status: "retained"
    readonly cadAudit: {
      readonly auditedAt: "2026-08-24"
      readonly officialCadDataUrl: string
      readonly availability: "not-confirmed"
      readonly disposition: "not-acquired-no-substitute"
      readonly note: string
    }
  }[]
  readonly sources: readonly {
    readonly id: string
    readonly authority: "manufacturer-primary"
    readonly documentNumber: string
    readonly reviewedPage: number
    readonly artifactPath: string
    readonly sha256: string
    readonly role: string
  }[]
  readonly manufacturerCad: {
    readonly state: "not-acquired"
    readonly authority: "deny"
  }
  readonly sourceApplicability: {
    readonly selectedMpnMapping: {
      readonly sourcePath: string
      readonly baselineCommit: "7a3566b"
      readonly currentSourceSha256: "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20"
      readonly disposition: "fixed-upstream-selection"
    }
    readonly packageBody: {
      readonly lengthMm: number
      readonly widthMm: number
      readonly sourceId: "murata-gcm-series-land-dimensions"
      readonly reviewedPage: 25
      readonly sourceScope: "package-code-level"
    }
    readonly reflowLandPattern: {
      readonly sourceId: "murata-gcm-series-land-dimensions"
      readonly reviewedPage: 25
      readonly sourceTable: "Table 2 Reflow Soldering Method"
      readonly appliesTo: "all-selected-mpns-in-package-code"
      readonly disposition: "project-review-input-not-manufacturer-cad"
    }
  }
  readonly manufacturerLandPattern: {
    readonly method: "reflow"
    readonly innerGapMm: { readonly minimum: number; readonly maximum: number }
    readonly padLengthMm: { readonly minimum: number; readonly maximum: number }
    readonly padWidthMm: { readonly minimum: number; readonly maximum: number }
  }
  readonly projectSelection: {
    readonly copperPad: { readonly lengthMm: number; readonly widthMm: number }
    readonly innerGapMm: number
    readonly overallCopperSpanMm: number
    readonly copperPadCenterXMm: number
    readonly solderMask: {
      readonly openingLengthMm: number
      readonly openingWidthMm: number
      readonly marginMm: number
      readonly status: "project-input"
    }
    readonly paste: {
      readonly openingLengthMm: number
      readonly openingWidthMm: number
      readonly reductionPerEdgeMm: number
      readonly status: "project-input"
    }
    readonly courtyard: {
      readonly lengthMm: number
      readonly widthMm: number
      readonly minimumClearanceMm: number
      readonly status: "project-review-input"
    }
  }
  readonly terminals: readonly {
    readonly pad: "1" | "2"
    readonly terminal: "A" | "B"
    readonly polarity: "non-polar"
    readonly xMm: number
    readonly yMm: 0
  }[]
  readonly orientation: {
    readonly state: "pending-layout-review"
    readonly note: string
  }
  readonly stressReview: {
    readonly state: "pending-layout-and-assembly-review"
    readonly note: string
  }
  readonly fabricationAuthority: "deny"
  readonly accepted: false
}

const sourceGuide = {
  id: "murata-gcm-series-land-dimensions",
  authority: "manufacturer-primary" as const,
  documentNumber: "JEMCGC-2702S",
  reviewedPage: 25,
  artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
  sha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19",
  role: "Murata GC-series Table 2 reflow land dimensions and nominal chip L by W values for package codes 18, 21, and 32."
} as const

const officialCadDataUrl = "https://www.murata.com/en-global/tool/data/caddata"
const selectionSource = {
  sourcePath: "packages/scoring-circuit/src/bench-prototype-processor-support.ts",
  baselineCommit: "7a3566b",
  currentSourceSha256: "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20",
  disposition: "fixed-upstream-selection"
} as const
const cadAudit = {
  auditedAt: "2026-08-24",
  officialCadDataUrl,
  availability: "not-confirmed",
  disposition: "not-acquired-no-substitute",
  note: "Murata documents a per-part product-detail download button for CAD. The exact PIM detail pages did not expose a downloadable CAD artifact in this anonymous audit, so no CAD availability conclusion or substitute footprint is asserted."
} as const

const candidateSourceNote =
  "The exact MPN selection is bound to the existing BP-125 processor-support contract and revalidated against its current source hash. The five selected MPN groups expand to exactly 12 BP-032 references, each retained as not-started review input. Every selected MPN has hash-bound retained Murata evidence here; only the retained GC-series guide supplies package-code-level land guidance, and no entry asserts exact-MPN manufacturer CAD."

/**
 * Isolated candidate MLCC footprints for the BP-125 support-capacitor MPNs.
 * They are not imported by a board model and do not grant fabrication authority.
 */
const canonicalCandidateGeometryGraph = {
  "0603-1608m": {
    artifactKind: "bp125-murata-mlcc-candidate-footprint",
    workUnit: "BP-125",
    package: "0603 (1608M)",
    packageCode: "18",
    appliesTo: [
      { manufacturerPartNumber: "GCM188R71H103KA37D", references: ["C_STM_VDDA_HF"] },
      {
        manufacturerPartNumber: "GCM188R71H104KA57D",
        references: [
          "C_STM_VDD16",
          "C_STM_VDD32",
          "C_STM_VDD48",
          "C_STM_VDD64",
          "C_STM_VREF_HF",
          "C_STM_VBAT",
          "C_ESP_3V3_HF"
        ]
      }
    ],
    exactMpnEvidence: [
      {
        manufacturerPartNumber: "GCM188R71H103KA37D",
        officialProductDetailUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H103KA37D",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm188r71h103ka37-dcbias-tc125.json",
        sha256: "541BB5E1738D24528E43A654464F20365E90163A385C0B0E44ACA451B1319879",
        evidenceKind: "selected-mpn-characteristic-response",
        status: "retained",
        cadAudit
      },
      {
        manufacturerPartNumber: "GCM188R71H104KA57D",
        officialProductDetailUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf",
        sha256: "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A",
        evidenceKind: "exact-mpn-reference-sheet",
        status: "retained",
        cadAudit
      }
    ],
    sources: [
      sourceGuide,
      {
        id: "murata-gcm188r71h104ka57-reference-sheet",
        authority: "manufacturer-primary",
        documentNumber: "GCM188R71H104KA57-01A",
        reviewedPage: 1,
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf",
        sha256: "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A",
        role: "Retained exact-MPN 1608M package reference sheet."
      }
    ],
    manufacturerCad: { state: "not-acquired", authority: "deny" },
    sourceApplicability: {
      selectedMpnMapping: selectionSource,
      packageBody: {
        lengthMm: 1.6,
        widthMm: 0.8,
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceScope: "package-code-level"
      },
      reflowLandPattern: {
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceTable: "Table 2 Reflow Soldering Method",
        appliesTo: "all-selected-mpns-in-package-code",
        disposition: "project-review-input-not-manufacturer-cad"
      }
    },
    manufacturerLandPattern: {
      method: "reflow",
      innerGapMm: { minimum: 0.6, maximum: 0.8 },
      padLengthMm: { minimum: 0.6, maximum: 0.7 },
      padWidthMm: { minimum: 0.6, maximum: 0.8 }
    },
    projectSelection: {
      copperPad: { lengthMm: 0.65, widthMm: 0.7 },
      innerGapMm: 0.7,
      overallCopperSpanMm: 2,
      copperPadCenterXMm: 0.675,
      solderMask: { openingLengthMm: 0.75, openingWidthMm: 0.8, marginMm: 0.05, status: "project-input" },
      paste: {
        openingLengthMm: 0.55,
        openingWidthMm: 0.6,
        reductionPerEdgeMm: 0.05,
        status: "project-input"
      },
      courtyard: {
        lengthMm: 2.5,
        widthMm: 1.3,
        minimumClearanceMm: 0.25,
        status: "project-review-input"
      }
    },
    terminals: [
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.675, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.675, yMm: 0 }
    ],
    orientation: {
      state: "pending-layout-review",
      note: "Both terminals are electrically non-polar. The local circuit may choose rotation, but this candidate does not assert pin one or an assembly orientation."
    },
    stressReview: {
      state: "pending-layout-and-assembly-review",
      note: "Review board-flex direction, routing axis, local copper, placement process, solder volume, and assembled-board stress before use. Murata directs the actual set and PCB evaluation of land dimensions."
    },
    fabricationAuthority: "deny",
    accepted: false
  },
  "0805-2012m": {
    artifactKind: "bp125-murata-mlcc-candidate-footprint",
    workUnit: "BP-125",
    package: "0805 (2012M)",
    packageCode: "21",
    appliesTo: [
      {
        manufacturerPartNumber: "GCM21BR71E225KA73L",
        references: ["C_STM_VDDA_BULK", "C_STM_VREF_BULK"]
      }
    ],
    exactMpnEvidence: [
      {
        manufacturerPartNumber: "GCM21BR71E225KA73L",
        officialProductDetailUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM21BR71E225KA73L",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
        sha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19",
        evidenceKind: "exact-mpn-reference-sheet",
        status: "retained",
        cadAudit
      }
    ],
    sources: [
      sourceGuide,
      {
        id: "murata-gcm21br71e225ka73-reference-sheet",
        authority: "manufacturer-primary",
        documentNumber: "GCM21BR71E225KA73-01",
        reviewedPage: 1,
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
        sha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19",
        role: "Retained exact-MPN 2012M package reference sheet and GC-series land guidance."
      }
    ],
    manufacturerCad: { state: "not-acquired", authority: "deny" },
    sourceApplicability: {
      selectedMpnMapping: selectionSource,
      packageBody: {
        lengthMm: 2,
        widthMm: 1.25,
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceScope: "package-code-level"
      },
      reflowLandPattern: {
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceTable: "Table 2 Reflow Soldering Method",
        appliesTo: "all-selected-mpns-in-package-code",
        disposition: "project-review-input-not-manufacturer-cad"
      }
    },
    manufacturerLandPattern: {
      method: "reflow",
      innerGapMm: { minimum: 1.2, maximum: 1.2 },
      padLengthMm: { minimum: 0.6, maximum: 0.8 },
      padWidthMm: { minimum: 1.2, maximum: 1.4 }
    },
    projectSelection: {
      copperPad: { lengthMm: 0.7, widthMm: 1.3 },
      innerGapMm: 1.2,
      overallCopperSpanMm: 2.6,
      copperPadCenterXMm: 0.95,
      solderMask: { openingLengthMm: 0.8, openingWidthMm: 1.4, marginMm: 0.05, status: "project-input" },
      paste: {
        openingLengthMm: 0.6,
        openingWidthMm: 1.2,
        reductionPerEdgeMm: 0.05,
        status: "project-input"
      },
      courtyard: {
        lengthMm: 3.1,
        widthMm: 1.8,
        minimumClearanceMm: 0.25,
        status: "project-review-input"
      }
    },
    terminals: [
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.95, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.95, yMm: 0 }
    ],
    orientation: {
      state: "pending-layout-review",
      note: "Both terminals are electrically non-polar. The local circuit may choose rotation, but this candidate does not assert pin one or an assembly orientation."
    },
    stressReview: {
      state: "pending-layout-and-assembly-review",
      note: "Review board-flex direction, routing axis, local copper, placement process, solder volume, and assembled-board stress before use. Murata directs the actual set and PCB evaluation of land dimensions."
    },
    fabricationAuthority: "deny",
    accepted: false
  },
  "1210-3225m": {
    artifactKind: "bp125-murata-mlcc-candidate-footprint",
    workUnit: "BP-125",
    package: "1210 (3225M)",
    packageCode: "32",
    appliesTo: [
      { manufacturerPartNumber: "GCM32ER71E106KA57L", references: ["C_STM_3V3_BULK"] },
      { manufacturerPartNumber: "GCM32EC71A476KE02L", references: ["C_ESP_3V3_BULK"] }
    ],
    exactMpnEvidence: [
      {
        manufacturerPartNumber: "GCM32ER71E106KA57L",
        officialProductDetailUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM32ER71E106KA57L",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm32er71e106ka57-dcbias-tc25.json",
        sha256: "8DECC721E40C71BB41FAEDE8037A5A50A1AB7A95E7403A3C0E6AD9D2DBBB53EC",
        evidenceKind: "selected-mpn-characteristic-response",
        status: "retained",
        cadAudit
      },
      {
        manufacturerPartNumber: "GCM32EC71A476KE02L",
        officialProductDetailUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM32EC71A476KE02L",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm32ec71a476ke02-dcbias-tc25.json",
        sha256: "6FB8BB5B26B094D92156968AF9DC9E56DD68F4E93D86817F7DBEF19D264F906D",
        evidenceKind: "selected-mpn-characteristic-response",
        status: "retained",
        cadAudit
      }
    ],
    sources: [sourceGuide],
    manufacturerCad: { state: "not-acquired", authority: "deny" },
    sourceApplicability: {
      selectedMpnMapping: selectionSource,
      packageBody: {
        lengthMm: 3.2,
        widthMm: 2.5,
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceScope: "package-code-level"
      },
      reflowLandPattern: {
        sourceId: "murata-gcm-series-land-dimensions",
        reviewedPage: 25,
        sourceTable: "Table 2 Reflow Soldering Method",
        appliesTo: "all-selected-mpns-in-package-code",
        disposition: "project-review-input-not-manufacturer-cad"
      }
    },
    manufacturerLandPattern: {
      method: "reflow",
      innerGapMm: { minimum: 2, maximum: 2.4 },
      padLengthMm: { minimum: 1, maximum: 1.2 },
      padWidthMm: { minimum: 1.8, maximum: 2.3 }
    },
    projectSelection: {
      copperPad: { lengthMm: 1.1, widthMm: 2.05 },
      innerGapMm: 2.2,
      overallCopperSpanMm: 4.4,
      copperPadCenterXMm: 1.65,
      solderMask: { openingLengthMm: 1.2, openingWidthMm: 2.15, marginMm: 0.05, status: "project-input" },
      paste: {
        openingLengthMm: 1,
        openingWidthMm: 1.95,
        reductionPerEdgeMm: 0.05,
        status: "project-input"
      },
      courtyard: {
        lengthMm: 4.9,
        widthMm: 3,
        minimumClearanceMm: 0.25,
        status: "project-review-input"
      }
    },
    terminals: [
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -1.65, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 1.65, yMm: 0 }
    ],
    orientation: {
      state: "pending-layout-review",
      note: "Both terminals are electrically non-polar. The local circuit may choose rotation, but this candidate does not assert pin one or an assembly orientation."
    },
    stressReview: {
      state: "pending-layout-and-assembly-review",
      note: "Review board-flex direction, routing axis, local copper, placement process, solder volume, and assembled-board stress before use. Murata directs the actual set and PCB evaluation of land dimensions."
    },
    fabricationAuthority: "deny",
    accepted: false
  }
} as const satisfies Readonly<Record<string, CandidateFootprintGeometry>>

function cloneWithoutAliases<T>(value: T, active = new Set<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (active.has(value)) throw new TypeError("BP-125 candidate baseline must not contain a cycle")
  active.add(value)
  let clone: object
  if (Array.isArray(value)) {
    clone = []
    for (const item of value) (clone as unknown[]).push(cloneWithoutAliases(item, active))
  } else {
    clone = {}
    for (const key of Object.keys(value)) {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneWithoutAliases(value[key as keyof T], active),
        writable: true
      })
    }
  }
  active.delete(value)
  return clone as T
}

function recursivelyFreeze<T>(value: T, seen = new Set<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) recursivelyFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

const expectedPackageByCandidate = {
  "0603-1608m": { package: "0603 (1608M)", packageCode: "18" },
  "0805-2012m": { package: "0805 (2012M)", packageCode: "21" },
  "1210-3225m": { package: "1210 (3225M)", packageCode: "32" }
} as const

/**
 * Private, independently transcribed BP-125 selection baseline. This is not
 * imported from the processor-support contract so that a source edit cannot
 * make this candidate validate itself. The rows are intentionally frozen as
 * review input, not as a release or approval record.
 */
const mpnReviewBaselineSeed = [
  {
    manufacturerPartNumber: "GCM188R71H103KA37D",
    candidateKey: "0603-1608m",
    references: ["C_STM_VDDA_HF"],
    exactEvidence: {
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm188r71h103ka37-dcbias-tc125.json",
      sha256: "541BB5E1738D24528E43A654464F20365E90163A385C0B0E44ACA451B1319879",
      evidenceKind: "selected-mpn-characteristic-response"
    }
  },
  {
    manufacturerPartNumber: "GCM188R71H104KA57D",
    candidateKey: "0603-1608m",
    references: [
      "C_STM_VDD16",
      "C_STM_VDD32",
      "C_STM_VDD48",
      "C_STM_VDD64",
      "C_STM_VREF_HF",
      "C_STM_VBAT",
      "C_ESP_3V3_HF"
    ],
    exactEvidence: {
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf",
      sha256: "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A",
      evidenceKind: "exact-mpn-reference-sheet"
    }
  },
  {
    manufacturerPartNumber: "GCM21BR71E225KA73L",
    candidateKey: "0805-2012m",
    references: ["C_STM_VDDA_BULK", "C_STM_VREF_BULK"],
    exactEvidence: {
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
      sha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19",
      evidenceKind: "exact-mpn-reference-sheet"
    }
  },
  {
    manufacturerPartNumber: "GCM32ER71E106KA57L",
    candidateKey: "1210-3225m",
    references: ["C_STM_3V3_BULK"],
    exactEvidence: {
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm32er71e106ka57-dcbias-tc25.json",
      sha256: "8DECC721E40C71BB41FAEDE8037A5A50A1AB7A95E7403A3C0E6AD9D2DBBB53EC",
      evidenceKind: "selected-mpn-characteristic-response"
    }
  },
  {
    manufacturerPartNumber: "GCM32EC71A476KE02L",
    candidateKey: "1210-3225m",
    references: ["C_ESP_3V3_BULK"],
    exactEvidence: {
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-125/murata-gcm32ec71a476ke02-dcbias-tc25.json",
      sha256: "6FB8BB5B26B094D92156968AF9DC9E56DD68F4E93D86817F7DBEF19D264F906D",
      evidenceKind: "selected-mpn-characteristic-response"
    }
  }
] as const

type MurataCapacitorReviewBinding = {
  readonly candidateKey: string
  readonly manufacturerPartNumber: string
  readonly reference: string
  readonly footprintEvidenceState: "not-started"
  readonly exactEvidenceKind: (typeof mpnReviewBaselineSeed)[number]["exactEvidence"]["evidenceKind"]
  readonly landGuidanceScope: "common-gc-family-package-code"
}

const baselineBindingRowsSeed: readonly MurataCapacitorReviewBinding[] = mpnReviewBaselineSeed.flatMap((binding) =>
  binding.references.map(
    (reference): MurataCapacitorReviewBinding => ({
      candidateKey: binding.candidateKey,
      manufacturerPartNumber: binding.manufacturerPartNumber,
      reference,
      footprintEvidenceState: "not-started",
      exactEvidenceKind: binding.exactEvidence.evidenceKind,
      landGuidanceScope: "common-gc-family-package-code"
    })
  )
)

const privateFrozenBp125Baseline = recursivelyFreeze(
  cloneWithoutAliases({
    geometries: canonicalCandidateGeometryGraph,
    mpnReviewBindings: mpnReviewBaselineSeed,
    reviewBindingRows: baselineBindingRowsSeed
  })
)

const frozenMpnReviewBaseline = privateFrozenBp125Baseline.mpnReviewBindings

export const benchPrototypeBp125MurataCapacitorFootprintGeometries = recursivelyFreeze(
  cloneWithoutAliases(privateFrozenBp125Baseline.geometries)
)

/**
 * A root-reviewable projection with one explicit row per exact reference. The
 * private baseline above remains the validator authority; this exported view
 * is a read-only handoff and does not change any lane ledger state.
 */
export const benchPrototypeBp125MurataCapacitorReviewBindings = recursivelyFreeze(
  cloneWithoutAliases(privateFrozenBp125Baseline.reviewBindingRows)
)

function expectedMpnBinding(manufacturerPartNumber: string) {
  return frozenMpnReviewBaseline.find((binding) => binding.manufacturerPartNumber === manufacturerPartNumber)
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function graphPathKey(key: PropertyKey): string {
  return typeof key === "symbol" ? `<symbol:${String(key.description)}>` : String(key)
}

function compareGraphNode(
  actual: unknown,
  expected: unknown,
  path: string,
  actualSeen: Map<object, string>,
  expectedSeen: Map<object, string>,
  errors: string[]
): void {
  const actualIsObject = typeof actual === "object" && actual !== null
  const expectedIsObject = typeof expected === "object" && expected !== null
  if (!actualIsObject || !expectedIsObject) {
    if (!Object.is(actual, expected)) errors.push(`${path}: value drifted`)
    return
  }

  if (nodeTypes.isProxy(actual)) {
    errors.push(`${path}: proxies are not permitted in the candidate graph`)
    return
  }
  if (nodeTypes.isProxy(expected)) {
    errors.push(`${path}: private baseline unexpectedly contains a proxy`)
    return
  }

  const actualPreviousPath = actualSeen.get(actual)
  if (actualPreviousPath !== undefined) {
    errors.push(`${path}: actual graph aliases or cycles ${actualPreviousPath}`)
    return
  }
  actualSeen.set(actual, path)
  const expectedPreviousPath = expectedSeen.get(expected)
  if (expectedPreviousPath !== undefined) {
    errors.push(`${path}: private baseline aliases or cycles ${expectedPreviousPath}`)
    return
  }
  expectedSeen.set(expected, path)

  try {
    if (Array.isArray(actual) !== Array.isArray(expected)) {
      errors.push(`${path}: array or record kind drifted`)
      return
    }
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
      errors.push(`${path}: prototype drifted`)
    }
    if (!Object.isFrozen(actual)) errors.push(`${path}: graph node is not recursively frozen`)

    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    const actualKeySet = new Set(actualKeys)
    const expectedKeySet = new Set(expectedKeys)
    for (const key of actualKeys) {
      if (!expectedKeySet.has(key)) errors.push(`${path}.${graphPathKey(key)}: unexpected or hidden field`)
    }
    for (const key of expectedKeys) {
      if (!actualKeySet.has(key)) errors.push(`${path}.${graphPathKey(key)}: missing field or sparse array entry`)
    }

    for (const key of expectedKeys) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      if (actualDescriptor === undefined || expectedDescriptor === undefined) continue
      if (actualDescriptor.get !== undefined || actualDescriptor.set !== undefined) {
        errors.push(`${path}.${graphPathKey(key)}: accessors are not permitted`)
        continue
      }
      if (expectedDescriptor.get !== undefined || expectedDescriptor.set !== undefined) {
        errors.push(`${path}.${graphPathKey(key)}: private baseline unexpectedly contains an accessor`)
        continue
      }
      if (
        actualDescriptor.configurable !== expectedDescriptor.configurable ||
        actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
        ("writable" in actualDescriptor &&
          actualDescriptor.writable !== ("writable" in expectedDescriptor && expectedDescriptor.writable))
      ) {
        errors.push(`${path}.${graphPathKey(key)}: property descriptor drifted`)
      }
      if ("value" in actualDescriptor && "value" in expectedDescriptor) {
        compareGraphNode(
          actualDescriptor.value,
          expectedDescriptor.value,
          `${path}.${graphPathKey(key)}`,
          actualSeen,
          expectedSeen,
          errors
        )
      }
    }
  } catch {
    errors.push(`${path}: graph inspection failed closed against an accessor, proxy, or cycle`)
  }
}

function compareCandidateGraph(actual: unknown, expected: unknown): readonly string[] {
  const errors: string[] = []
  compareGraphNode(actual, expected, "$", new Map<object, string>(), new Map<object, string>(), errors)
  return errors
}

/**
 * Detects selection or geometry drift in these isolated review candidates.
 * This deliberately does not grant a fabrication release.
 */
export function bp125MurataCapacitorFootprintIntegrityErrors(
  candidates: Readonly<
    Record<string, CandidateFootprintGeometry>
  > = benchPrototypeBp125MurataCapacitorFootprintGeometries
): readonly string[] {
  const errors: string[] = []
  errors.push(
    ...compareCandidateGraph(candidates, privateFrozenBp125Baseline.geometries),
    ...compareCandidateGraph(
      benchPrototypeBp125MurataCapacitorReviewBindings,
      privateFrozenBp125Baseline.reviewBindingRows
    )
  )

  try {
    const seenMpnCounts = new Map<string, number>()
    const seenReferenceCounts = new Map<string, number>()
    const expectedCandidateKeys = Object.keys(expectedPackageByCandidate)
    const actualCandidateKeys = Object.keys(candidates)

    if (!sameStringArray(actualCandidateKeys.toSorted(), expectedCandidateKeys.toSorted())) {
      errors.push("candidate geometry keys must match the three frozen package candidates")
    }

    for (const [candidateKey, candidate] of Object.entries(candidates)) {
      const expectedPackage = Object.entries(expectedPackageByCandidate).find(([key]) => key === candidateKey)?.[1]
      if (
        expectedPackage === undefined ||
        candidate.package !== expectedPackage.package ||
        candidate.packageCode !== expectedPackage.packageCode
      ) {
        errors.push(`${candidateKey} package identity does not match its expected candidate geometry`)
      }
      const requiredCourtyardLengthMm =
        Math.max(candidate.projectSelection.overallCopperSpanMm, candidate.sourceApplicability.packageBody.lengthMm) +
        2 * candidate.projectSelection.courtyard.minimumClearanceMm
      const requiredCourtyardWidthMm =
        Math.max(candidate.projectSelection.copperPad.widthMm, candidate.sourceApplicability.packageBody.widthMm) +
        2 * candidate.projectSelection.courtyard.minimumClearanceMm

      if (candidate.projectSelection.courtyard.lengthMm < requiredCourtyardLengthMm) {
        errors.push(`${candidateKey} courtyard length does not enclose copper/body plus its stated clearance`)
      }
      if (candidate.projectSelection.courtyard.widthMm < requiredCourtyardWidthMm) {
        errors.push(`${candidateKey} courtyard width does not enclose copper/body plus its stated clearance`)
      }
      if (
        candidate.sourceApplicability.selectedMpnMapping.baselineCommit !== "7a3566b" ||
        candidate.sourceApplicability.selectedMpnMapping.currentSourceSha256 !==
          "6A0CEAD8A893BA61D4C6FC7D40B6374E1E8EE783BF66B7951AE856110F8A2D20" ||
        candidate.sourceApplicability.selectedMpnMapping.sourcePath !== selectionSource.sourcePath ||
        candidate.sourceApplicability.selectedMpnMapping.disposition !== selectionSource.disposition ||
        candidate.sourceApplicability.reflowLandPattern.sourceId !== sourceGuide.id ||
        candidate.sourceApplicability.reflowLandPattern.reviewedPage !== sourceGuide.reviewedPage
      ) {
        errors.push(`${candidateKey} source applicability does not bind the retained Murata reflow guide`)
      }
      if (candidate.fabricationAuthority !== "deny" || candidate.accepted !== false) {
        errors.push(`${candidateKey} must remain review-only and denied for fabrication`)
      }

      if (candidate.orientation.state !== "pending-layout-review") {
        errors.push(`${candidateKey} orientation review must remain pending`)
      }
      if (candidate.stressReview.state !== "pending-layout-and-assembly-review") {
        errors.push(`${candidateKey} assembly stress review must remain pending`)
      }

      if (candidate.exactMpnEvidence.length !== candidate.appliesTo.length) {
        errors.push(`${candidateKey} exact-MPN evidence count must match its selected MPN count`)
      }
      const evidenceMpnSet = new Set(candidate.exactMpnEvidence.map((evidence) => evidence.manufacturerPartNumber))
      for (const selection of candidate.appliesTo) {
        const expectedBinding = expectedMpnBinding(selection.manufacturerPartNumber)
        seenMpnCounts.set(
          selection.manufacturerPartNumber,
          (seenMpnCounts.get(selection.manufacturerPartNumber) ?? 0) + 1
        )
        for (const reference of selection.references) {
          seenReferenceCounts.set(reference, (seenReferenceCounts.get(reference) ?? 0) + 1)
        }
        if (expectedBinding === undefined) {
          errors.push(`${candidateKey} contains an unselected MPN: ${selection.manufacturerPartNumber}`)
        } else {
          if (expectedBinding.candidateKey !== candidateKey) {
            errors.push(
              `${selection.manufacturerPartNumber} maps to ${candidateKey}, not ${expectedBinding.candidateKey}`
            )
          }
          if (!sameStringArray(selection.references, expectedBinding.references)) {
            errors.push(`${selection.manufacturerPartNumber} reference binding does not match the frozen BP-125 rows`)
          }
        }
        if (!evidenceMpnSet.has(selection.manufacturerPartNumber)) {
          errors.push(`${selection.manufacturerPartNumber} has no retained evidence in ${candidateKey}`)
        }

        const evidence = candidate.exactMpnEvidence.find(
          (entry) => entry.manufacturerPartNumber === selection.manufacturerPartNumber
        )
        if (expectedBinding !== undefined && evidence !== undefined) {
          if (
            evidence.artifactPath !== expectedBinding.exactEvidence.artifactPath ||
            evidence.sha256 !== expectedBinding.exactEvidence.sha256 ||
            evidence.evidenceKind !== expectedBinding.exactEvidence.evidenceKind ||
            evidence.status !== "retained"
          ) {
            errors.push(`${selection.manufacturerPartNumber} exact retained evidence binding drifted`)
          }
        }
      }
    }

    for (const binding of frozenMpnReviewBaseline) {
      if (seenMpnCounts.get(binding.manufacturerPartNumber) !== 1) {
        errors.push(`${binding.manufacturerPartNumber} must map exactly once to ${binding.candidateKey}`)
      }
      for (const reference of binding.references) {
        if (seenReferenceCounts.get(reference) !== 1) {
          errors.push(`${reference} must map exactly once to ${binding.manufacturerPartNumber}`)
        }
      }
    }
    if (seenReferenceCounts.size !== benchPrototypeBp125MurataCapacitorReviewBindings.length) {
      errors.push("BP-032 Murata support review must contain exactly 12 unique not-started references")
    }
  } catch {
    errors.push("candidate graph inspection failed closed against malformed objects or traps")
  }
  return errors
}

export const benchPrototypeBp125MurataCapacitorFootprintNotes = {
  candidateSourceNote
} as const

const footprint0603 = (
  <footprint name="BP125_MURATA_0603_1608M_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-0.675}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.65mm"
      height="0.7mm"
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={0.675}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.65mm"
      height="0.7mm"
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    <courtyardrect pcbX={0} pcbY={0} width="2.5mm" height="1.3mm" strokeWidth="0.05mm" />
  </footprint>
)

const footprint0805 = (
  <footprint name="BP125_MURATA_0805_2012M_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-0.95}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.7mm"
      height="1.3mm"
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={0.95}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="0.7mm"
      height="1.3mm"
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    <courtyardrect pcbX={0} pcbY={0} width="3.1mm" height="1.8mm" strokeWidth="0.05mm" />
  </footprint>
)

const footprint1210 = (
  <footprint name="BP125_MURATA_1210_3225M_CANDIDATE" originalLayer="top">
    <smtpad
      name="1"
      pcbX={-1.65}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1.1mm"
      height="2.05mm"
      portHints={["1", "A", "non-polar", "pin1"]}
    />
    <smtpad
      name="2"
      pcbX={1.65}
      pcbY={0}
      shape="rect"
      solderMaskMargin="0.05mm"
      solderPasteMargin="-0.05mm"
      width="1.1mm"
      height="2.05mm"
      portHints={["2", "B", "non-polar", "pin2"]}
    />
    <courtyardrect pcbX={0} pcbY={0} width="4.9mm" height="3mm" strokeWidth="0.05mm" />
  </footprint>
)

export interface BenchPrototypeBp125MurataCapacitorFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

function candidateChip(
  name: string,
  manufacturerPartNumber: string,
  footprint: ReactElement,
  { pcbRotation, pcbX, pcbY }: BenchPrototypeBp125MurataCapacitorFootprintProps
): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber={manufacturerPartNumber}
      pinLabels={{ pin1: "A", pin2: "B" }}
      footprint={footprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function BenchPrototypeBp125Murata0603CandidateFootprint(
  props: BenchPrototypeBp125MurataCapacitorFootprintProps = {}
): ReactElement {
  return candidateChip("C_BP125_MURATA_0603", "GCM188R71H104KA57D", footprint0603, props)
}

export function BenchPrototypeBp125Murata0805CandidateFootprint(
  props: BenchPrototypeBp125MurataCapacitorFootprintProps = {}
): ReactElement {
  return candidateChip("C_BP125_MURATA_0805", "GCM21BR71E225KA73L", footprint0805, props)
}

export function BenchPrototypeBp125Murata1210CandidateFootprint(
  props: BenchPrototypeBp125MurataCapacitorFootprintProps = {}
): ReactElement {
  return candidateChip("C_BP125_MURATA_1210", "GCM32ER71E106KA57L", footprint1210, props)
}
