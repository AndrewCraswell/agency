import { fabricationFootprintGates } from "./fabrication-footprint-gates.js"
import { manufacturerFootprintEligibility } from "./manufacturer-footprint-adapter.js"
import { powerStageFootprints } from "./power-stage-footprints.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

/**
 * Evidence state is deliberately more precise than a boolean. A source can
 * describe a land, stencil example, or package outline without producing a
 * released CAD object. The DNP adapter remains the authority for placement.
 */
export type FootprintEvidenceStatus =
  | "manufacturer-example"
  | "manufacturer-specified"
  | "manufacturer-verified"
  | "not-imported"
  | "not-published"
  | "transcribed"

export type FootprintEvidenceCategory = "copper" | "courtyard" | "paste" | "solder-mask"

export type FootprintReleaseEvidence = {
  readonly categories: Readonly<Record<FootprintEvidenceCategory, FootprintEvidenceStatus>>
  readonly eligibleForPcb: false
  readonly gateReferences: readonly string[]
  readonly library: "merged" | "power-stage" | "usb-pd" | "unresolved"
  readonly missingReleaseData: readonly FootprintEvidenceCategory[]
  readonly mpn: string
  readonly reviewOnlyPadCount: number
  readonly releaseState: "deny"
}

const categories = ["copper", "courtyard", "paste", "solder-mask"] as const

const powerStageByMpn = new Map<string, (typeof powerStageFootprints)[number]>(
  powerStageFootprints.map((footprint) => [footprint.mpn, footprint])
)
const usbPdByMpn = new Map<string, (typeof usbPdFootprints)[number]>(
  usbPdFootprints.map((footprint) => [footprint.mpn, footprint])
)
const gateReferencesByMpn = new Map<string, readonly string[]>(
  fabricationFootprintGates.map((gate) => [gate.mpn, gate.references] as const)
)

function powerStageEvidence(mpn: string): FootprintReleaseEvidence | undefined {
  const footprint = powerStageByMpn.get(mpn)
  if (footprint === undefined) return undefined

  const eligibility = manufacturerFootprintEligibility(mpn)
  return {
    categories: {
      copper: footprint.pads.geometry.length > 0 ? "transcribed" : "not-imported",
      courtyard: footprint.courtyard.status === "specified" ? "manufacturer-specified" : "not-published",
      paste: footprint.paste.status === "specified" ? "manufacturer-specified" : "not-published",
      "solder-mask": footprint.solderMask.status === "specified" ? "manufacturer-specified" : "not-published"
    },
    eligibleForPcb: false,
    gateReferences: gateReferencesByMpn.get(mpn) ?? [],
    library: "power-stage",
    missingReleaseData: eligibility.missingReleaseData,
    mpn,
    reviewOnlyPadCount: eligibility.reviewOnlyFootprint.length,
    releaseState: "deny"
  }
}

function usbPdEvidence(mpn: string): FootprintReleaseEvidence | undefined {
  const footprint = usbPdByMpn.get(mpn)
  if (footprint === undefined) return undefined

  const eligibility = manufacturerFootprintEligibility(mpn)
  return {
    categories: {
      copper: footprint.copperEvidence === "manufacturer-verified" ? "manufacturer-verified" : "not-imported",
      courtyard:
        footprint.courtyard.sourceStatus === "manufacturer-verified" ? "manufacturer-verified" : "not-published",
      paste: footprint.paste.sourceStatus === "manufacturer-example" ? "manufacturer-example" : "not-published",
      "solder-mask": "not-published"
    },
    eligibleForPcb: false,
    gateReferences: gateReferencesByMpn.get(mpn) ?? [],
    library: "usb-pd",
    missingReleaseData: eligibility.missingReleaseData,
    mpn,
    reviewOnlyPadCount: eligibility.reviewOnlyFootprint.length,
    releaseState: "deny"
  }
}

function unresolvedEvidence(mpn: string): FootprintReleaseEvidence {
  return {
    categories: {
      copper: "not-imported",
      courtyard: "not-imported",
      paste: "not-imported",
      "solder-mask": "not-imported"
    },
    eligibleForPcb: false,
    gateReferences: gateReferencesByMpn.get(mpn) ?? [],
    library: "unresolved",
    missingReleaseData: categories,
    mpn,
    reviewOnlyPadCount: 0,
    releaseState: "deny"
  }
}

function evidenceRank(status: FootprintEvidenceStatus): number {
  return {
    "manufacturer-verified": 5,
    "manufacturer-example": 4,
    "manufacturer-specified": 3,
    transcribed: 2,
    "not-published": 1,
    "not-imported": 0
  }[status]
}

function bestEvidence(left: FootprintEvidenceStatus, right: FootprintEvidenceStatus): FootprintEvidenceStatus {
  return evidenceRank(left) >= evidenceRank(right) ? left : right
}

function mergeLibraryEvidence(
  left: FootprintReleaseEvidence,
  right: FootprintReleaseEvidence
): FootprintReleaseEvidence {
  return {
    ...left,
    categories: {
      copper: bestEvidence(left.categories.copper, right.categories.copper),
      courtyard: bestEvidence(left.categories.courtyard, right.categories.courtyard),
      paste: bestEvidence(left.categories.paste, right.categories.paste),
      "solder-mask": bestEvidence(left.categories["solder-mask"], right.categories["solder-mask"])
    },
    library: "merged",
    reviewOnlyPadCount: Math.max(left.reviewOnlyPadCount, right.reviewOnlyPadCount)
  }
}

/**
 * Build the release ledger for every fabrication-gated MPN. This is an audit
 * view only: it never changes circuit placement and never treats source
 * evidence as permission to emit copper, mask, paste, or courtyard artwork.
 */
export const footprintReleaseEvidence: readonly FootprintReleaseEvidence[] = fabricationFootprintGates.map((gate) => {
  const powerStage = powerStageEvidence(gate.mpn)
  const usbPd = usbPdEvidence(gate.mpn)
  if (powerStage !== undefined && usbPd !== undefined) return mergeLibraryEvidence(powerStage, usbPd)
  return powerStage ?? usbPd ?? unresolvedEvidence(gate.mpn)
})

export function findFootprintReleaseEvidence(mpn: string): FootprintReleaseEvidence | undefined {
  return footprintReleaseEvidence.find((evidence) => evidence.mpn === mpn)
}
