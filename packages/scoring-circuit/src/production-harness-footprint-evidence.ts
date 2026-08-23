import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import { productionHarnessSelection } from "./production-harness-selection.js"

/**
 * Review-only primary-source evidence for the four production scoring-board
 * harness headers. This deliberately remains separate from the circuit,
 * manufacturer-footprint adapter, and fabrication ledger: it cannot create
 * copper, mask, paste, holes, or a release authorization.
 */

export type ProductionHarnessHeaderMpn = "39-29-1067" | "43650-0200" | "43650-0300" | "43650-0400"

export type HarnessFootprintEvidenceStatus =
  | "manufacturer-specified"
  | "not-applicable"
  | "not-imported"
  | "not-published"

export type HarnessPrimarySource = {
  readonly kind: "product-drawing" | "product-page" | "product-specification"
  readonly revision: string
  readonly url: string
}

export type HarnessPcbHole = {
  /** Coordinate system is explicitly review-only and starts at circuit 1 when populated. */
  readonly xMm?: number
  readonly yMm?: number
  /** Molex's recommended component-side PCB-layout hole, not a claimed finished hole. */
  readonly layoutHoleDiameterMm: number
  readonly layoutHoleToleranceMm: number
  readonly role: "contact" | "retention-or-mounting"
}

export type ProductionHarnessFootprintEvidence = {
  readonly assemblyProcess: {
    readonly manufacturerCapability: "not-published"
    readonly selectedProcess: "not-qualified"
  }
  readonly boardReference: (typeof productionHarnessSelection)[number]["boardReference"]
  readonly boardThickness: {
    readonly recommendationMm: number
    readonly sourceStatus: HarnessFootprintEvidenceStatus
  }
  /** Source drawing dimensions are retained by their drawing identifiers, not reinterpreted as a CAD outline. */
  readonly body: {
    readonly drawingDimensionsMm: Readonly<Record<"A" | "B" | "C", number | undefined>>
    readonly sourceStatus: HarnessFootprintEvidenceStatus
  }
  readonly copper: {
    readonly contactCount: number
    readonly contactGridPitchMm: number
    readonly exactLandGeometry: "not-published"
    readonly sourceStatus: HarnessFootprintEvidenceStatus
  }
  readonly courtyard: { readonly sourceStatus: "not-published" }
  readonly holes: readonly HarnessPcbHole[]
  readonly independentVerification: {
    readonly assemblyProcessQualified: false
    readonly cadOverlayComplete: false
    readonly enclosureKeepoutVerified: false
    readonly fabricationPreviewChecked: false
    readonly physicalMateTested: false
  }
  readonly keepout: {
    readonly boardEdgeMaximumMm?: number
    readonly sourceStatus: HarnessFootprintEvidenceStatus
  }
  readonly mates: readonly string[]
  readonly mpn: ProductionHarnessHeaderMpn
  readonly orientation: {
    readonly circuitOne: string
    readonly sourceStatus: "manufacturer-specified"
  }
  readonly paste: {
    readonly sourceStatus: "not-applicable" | "not-published"
    readonly statement: string
  }
  readonly primarySources: readonly HarnessPrimarySource[]
  readonly releaseState: "deny"
  readonly solderMask: { readonly sourceStatus: "not-published" }
}

type ProductionHarnessFootprintEvidenceInput = Omit<ProductionHarnessFootprintEvidence, "independentVerification"> & {
  readonly independentVerification: {
    readonly assemblyProcessQualified: boolean
    readonly cadOverlayComplete: boolean
    readonly enclosureKeepoutVerified: boolean
    readonly fabricationPreviewChecked: boolean
    readonly physicalMateTested: boolean
  }
}

const microFitDrawing: HarnessPrimarySource = {
  kind: "product-drawing",
  revision: "Molex SD-43650-001 PSD 000 revision D8, released 2024-11-05",
  url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43650/436500400_sd.pdf"
}

const microFitSpecification: HarnessPrimarySource = {
  kind: "product-page",
  revision: "Molex 43650 series page checked 2026-08-23",
  url: "https://www.molex.com/en-us/products/series-chart/43650"
}

const miniFitDrawing: HarnessPrimarySource = {
  kind: "product-drawing",
  revision: "Molex SD-5569-002 PSD 000 revision N1, configured 39-29-1067 table row",
  url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/556/5569/039291107_sd.pdf"
}

const miniFitProductPage: HarnessPrimarySource = {
  kind: "product-page",
  revision: "Molex 39291067 product page checked 2026-08-23",
  url: "https://www.molex.com/en-us/products/part-detail/39291067"
}

function microFitContacts(contactCount: 2 | 3 | 4): readonly HarnessPcbHole[] {
  return Array.from({ length: contactCount }, (_, index) => ({
    layoutHoleDiameterMm: 1.02,
    layoutHoleToleranceMm: 0.05,
    role: "contact" as const,
    xMm: index * 3,
    yMm: 0
  }))
}

const notVerified = {
  assemblyProcessQualified: false,
  cadOverlayComplete: false,
  enclosureKeepoutVerified: false,
  fabricationPreviewChecked: false,
  physicalMateTested: false
} as const

/**
 * The 39-29-1067 hole locations are normalized from SD-5569-002's
 * component-side recommended layout. The two 3.20 mm holes are identified
 * only as retention-or-mounting here. Their coordinate relationship is not
 * transcribed until the source drawing is imported, so no ambiguous drawing
 * dimension can become a fabricated location.
 */
const miniFitSixCircuitHoles: readonly HarnessPcbHole[] = [
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 0, yMm: 0 },
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 0, yMm: 4.2 },
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 4.2, yMm: 0 },
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 4.2, yMm: 4.2 },
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 8.4, yMm: 0 },
  { layoutHoleDiameterMm: 1.8, layoutHoleToleranceMm: 0.05, role: "contact", xMm: 8.4, yMm: 4.2 },
  { layoutHoleDiameterMm: 3.2, layoutHoleToleranceMm: 0.1, role: "retention-or-mounting" },
  { layoutHoleDiameterMm: 3.2, layoutHoleToleranceMm: 0.1, role: "retention-or-mounting" }
] as const

export const productionHarnessFootprintEvidence = [
  {
    assemblyProcess: { manufacturerCapability: "not-published", selectedProcess: "not-qualified" },
    boardReference: "J_PISTE_HARNESS",
    boardThickness: { recommendationMm: 1.57, sourceStatus: "manufacturer-specified" },
    body: { drawingDimensionsMm: { A: 9.65, B: 3, C: undefined }, sourceStatus: "manufacturer-specified" },
    copper: {
      contactCount: 2,
      contactGridPitchMm: 3,
      exactLandGeometry: "not-published",
      sourceStatus: "not-published"
    },
    courtyard: { sourceStatus: "not-published" },
    holes: microFitContacts(2),
    independentVerification: notVerified,
    keepout: { boardEdgeMaximumMm: 10.16, sourceStatus: "manufacturer-specified" },
    mates: ["43645-0200", "43030-0007"],
    mpn: "43650-0200",
    orientation: {
      circuitOne: "Circuit 1 is marked in the component-side PCB layout of SD-43650-001.",
      sourceStatus: "manufacturer-specified"
    },
    paste: {
      sourceStatus: "not-published",
      statement:
        "Contacts are through-hole; Molex does not publish a pin-in-paste aperture or selected assembly process in this evidence record."
    },
    primarySources: [microFitDrawing, microFitSpecification],
    releaseState: "deny",
    solderMask: { sourceStatus: "not-published" }
  },
  {
    assemblyProcess: { manufacturerCapability: "not-published", selectedProcess: "not-qualified" },
    boardReference: "J_WEAPON_HARNESS_L",
    boardThickness: { recommendationMm: 1.57, sourceStatus: "manufacturer-specified" },
    body: { drawingDimensionsMm: { A: 12.65, B: 6, C: undefined }, sourceStatus: "manufacturer-specified" },
    copper: {
      contactCount: 3,
      contactGridPitchMm: 3,
      exactLandGeometry: "not-published",
      sourceStatus: "not-published"
    },
    courtyard: { sourceStatus: "not-published" },
    holes: microFitContacts(3),
    independentVerification: notVerified,
    keepout: { boardEdgeMaximumMm: 10.16, sourceStatus: "manufacturer-specified" },
    mates: ["43645-0300", "43030-0007"],
    mpn: "43650-0300",
    orientation: {
      circuitOne: "Circuit 1 is marked in the component-side PCB layout of SD-43650-001.",
      sourceStatus: "manufacturer-specified"
    },
    paste: {
      sourceStatus: "not-published",
      statement:
        "Contacts are through-hole; Molex does not publish a pin-in-paste aperture or selected assembly process in this evidence record."
    },
    primarySources: [microFitDrawing, microFitSpecification],
    releaseState: "deny",
    solderMask: { sourceStatus: "not-published" }
  },
  {
    assemblyProcess: { manufacturerCapability: "not-published", selectedProcess: "not-qualified" },
    boardReference: "J_WEAPON_HARNESS_R",
    boardThickness: { recommendationMm: 1.57, sourceStatus: "manufacturer-specified" },
    body: { drawingDimensionsMm: { A: 15.65, B: 9, C: 4.7 }, sourceStatus: "manufacturer-specified" },
    copper: {
      contactCount: 4,
      contactGridPitchMm: 3,
      exactLandGeometry: "not-published",
      sourceStatus: "not-published"
    },
    courtyard: { sourceStatus: "not-published" },
    holes: microFitContacts(4),
    independentVerification: notVerified,
    keepout: { boardEdgeMaximumMm: 10.16, sourceStatus: "manufacturer-specified" },
    mates: ["43645-0400", "43030-0007"],
    mpn: "43650-0400",
    orientation: {
      circuitOne: "Circuit 1 is marked in the component-side PCB layout of SD-43650-001.",
      sourceStatus: "manufacturer-specified"
    },
    paste: {
      sourceStatus: "not-published",
      statement:
        "Contacts are through-hole; Molex does not publish a pin-in-paste aperture or selected assembly process in this evidence record."
    },
    primarySources: [microFitDrawing, microFitSpecification],
    releaseState: "deny",
    solderMask: { sourceStatus: "not-published" }
  },
  {
    assemblyProcess: { manufacturerCapability: "not-published", selectedProcess: "not-qualified" },
    boardReference: "J_PRIMARY_OUTPUTS_HARNESS",
    boardThickness: { recommendationMm: 1.78, sourceStatus: "manufacturer-specified" },
    body: { drawingDimensionsMm: { A: 23.8, B: 8.4, C: 13.8 }, sourceStatus: "manufacturer-specified" },
    copper: {
      contactCount: 6,
      contactGridPitchMm: 4.2,
      exactLandGeometry: "not-published",
      sourceStatus: "not-published"
    },
    courtyard: { sourceStatus: "not-published" },
    holes: miniFitSixCircuitHoles,
    independentVerification: notVerified,
    keepout: { sourceStatus: "not-published" },
    mates: ["39-01-2060", "39-00-0039"],
    mpn: "39-29-1067",
    orientation: {
      circuitOne: "Circuit 1 is marked in the component-side PCB layout of SD-5569-002.",
      sourceStatus: "manufacturer-specified"
    },
    paste: {
      sourceStatus: "not-published",
      statement:
        "Contacts are through-hole; the primary Molex evidence does not publish a pin-in-paste aperture or selected assembly process."
    },
    primarySources: [miniFitDrawing, miniFitProductPage],
    releaseState: "deny",
    solderMask: { sourceStatus: "not-published" }
  }
] as const satisfies readonly ProductionHarnessFootprintEvidence[]

function serializeCanonicalEvidence(value: unknown): string {
  return JSON.stringify(value, (_key, member) => (member === undefined ? "__CANONICAL_UNDEFINED__" : member))
}

const canonicalEvidenceByMpn = new Map<ProductionHarnessHeaderMpn, string>(
  productionHarnessFootprintEvidence.map((record) => [record.mpn, serializeCanonicalEvidence(record)])
)

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

/** Validates the review model and rejects any attempt to infer a release. */
export function validateProductionHarnessFootprintEvidence(
  records: readonly ProductionHarnessFootprintEvidenceInput[] = productionHarnessFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  const selectedByMpn = new Map(
    productionHarnessSelection.map((selection) => [selection.connector.headerMpn, selection])
  )
  const gatesByMpn = new Map(fabricationFootprintGates.map((gate) => [gate.mpn, gate]))
  if (records.length !== 4) errors.push("exactly four selected production harness headers require evidence")
  if (!unique(records.map((record) => record.mpn))) errors.push("production harness evidence MPNs must be unique")
  if (!unique(records.map((record) => record.boardReference)))
    errors.push("production harness evidence board references must be unique")

  for (const record of records) {
    const selection = selectedByMpn.get(record.mpn)
    const gate = gatesByMpn.get(record.mpn)
    if (selection?.boardReference !== record.boardReference)
      errors.push(`${record.mpn}: record must match the selected board reference`)
    if (gate?.references.length !== 1 || gate.references[0] !== record.boardReference)
      errors.push(`${record.mpn}: record must match its single fabrication gate reference`)
    if (record.releaseState !== "deny") errors.push(`${record.mpn}: release must fail closed`)
    if (record.independentVerification.cadOverlayComplete)
      errors.push(`${record.mpn}: CAD overlay must not be claimed complete`)
    if (record.independentVerification.fabricationPreviewChecked)
      errors.push(`${record.mpn}: fabrication preview must not be claimed complete`)
    if (record.independentVerification.assemblyProcessQualified)
      errors.push(`${record.mpn}: assembly process must not be claimed qualified`)
    if (record.independentVerification.enclosureKeepoutVerified)
      errors.push(`${record.mpn}: enclosure keepout must not be claimed verified`)
    if (record.independentVerification.physicalMateTested)
      errors.push(`${record.mpn}: physical mate must not be claimed tested`)
    if (!Number.isFinite(record.boardThickness.recommendationMm) || record.boardThickness.recommendationMm <= 0)
      errors.push(`${record.mpn}: board thickness recommendation must be positive`)
    if (!Number.isInteger(record.copper.contactCount) || record.copper.contactCount <= 0)
      errors.push(`${record.mpn}: contact count must be a positive integer`)
    if (!Number.isFinite(record.copper.contactGridPitchMm) || record.copper.contactGridPitchMm <= 0)
      errors.push(`${record.mpn}: contact pitch must be positive`)
    if (record.holes.filter((hole) => hole.role === "contact").length !== record.copper.contactCount)
      errors.push(`${record.mpn}: contact-hole count must equal contact count`)
    const coordinatePairs = record.holes.flatMap((hole) =>
      hole.xMm === undefined && hole.yMm === undefined ? [] : [`${hole.xMm}:${hole.yMm}`]
    )
    if (!unique(coordinatePairs)) errors.push(`${record.mpn}: transcribed hole coordinates must be unique`)
    for (const hole of record.holes) {
      if (!Number.isFinite(hole.layoutHoleDiameterMm) || hole.layoutHoleDiameterMm <= 0)
        errors.push(`${record.mpn}: hole diameter must be positive`)
      if (!Number.isFinite(hole.layoutHoleToleranceMm) || hole.layoutHoleToleranceMm <= 0)
        errors.push(`${record.mpn}: hole tolerance must be positive`)
      if ((hole.xMm === undefined) !== (hole.yMm === undefined))
        errors.push(`${record.mpn}: hole coordinates must be paired`)
      if (
        (hole.xMm !== undefined && !Number.isFinite(hole.xMm)) ||
        (hole.yMm !== undefined && !Number.isFinite(hole.yMm))
      )
        errors.push(`${record.mpn}: hole coordinates must be finite when transcribed`)
      if (hole.role === "contact" && (hole.xMm === undefined || hole.yMm === undefined))
        errors.push(`${record.mpn}: contact-hole coordinates are required`)
    }
    if (record.primarySources.length < 2)
      errors.push(`${record.mpn}: drawing and manufacturer product evidence are required`)
    if (!record.primarySources.some((source) => source.kind === "product-drawing"))
      errors.push(`${record.mpn}: manufacturer drawing is required`)
    for (const source of record.primarySources) {
      if (!source.url.startsWith("https://")) errors.push(`${record.mpn}: primary source must use HTTPS`)
      if (source.revision.trim().length === 0) errors.push(`${record.mpn}: primary source revision is required`)
    }
    if (serializeCanonicalEvidence(record) !== canonicalEvidenceByMpn.get(record.mpn))
      errors.push(`${record.mpn}: evidence must exactly match the reviewed per-MPN canonical record`)
  }
  return errors
}

export function canReleaseProductionHarnessFootprint(_record: ProductionHarnessFootprintEvidence): false {
  return false
}
