import { powerStageFootprints } from "./power-stage-footprints.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

type MissingReleaseDatum = "courtyard" | "copper" | "paste" | "solder-mask"

export type ReviewOnlyFootprintPad = {
  readonly height: number
  readonly portHints: readonly string[]
  readonly shape: "rect"
  readonly type: "pcb_smtpad"
  readonly width: number
  readonly x: number
  readonly y: number
}

export type ManufacturerFootprintEligibility = {
  readonly eligibleForPcb: boolean
  readonly missingReleaseData: readonly MissingReleaseDatum[]
  readonly mpn: string
  readonly orientation: string
  readonly reviewGeometryStatus: "coordinate-pads" | "omitted-incomplete-coordinate-pattern"
  readonly reviewOnlyFootprint: readonly ReviewOnlyFootprintPad[]
}

const unavailableForPcb = (
  mpn: string,
  missingReleaseData: readonly MissingReleaseDatum[],
  reviewOnlyFootprint: readonly ReviewOnlyFootprintPad[],
  orientation = "no released orientation data",
  reviewGeometryStatus: ManufacturerFootprintEligibility["reviewGeometryStatus"] = "omitted-incomplete-coordinate-pattern"
) =>
  ({
    eligibleForPcb: false,
    missingReleaseData,
    mpn,
    orientation,
    reviewGeometryStatus,
    reviewOnlyFootprint
  }) as const

function usbPdReviewFootprint(mpn: string): ManufacturerFootprintEligibility | undefined {
  const footprint = usbPdFootprints.find((candidate) => candidate.mpn === mpn)
  if (footprint === undefined) return undefined

  const reviewOnlyFootprint = [...footprint.pads, ...footprint.thermalPads].map((pad) => ({
    height: pad.heightMm,
    portHints: [pad.id],
    shape: "rect" as const,
    type: "pcb_smtpad" as const,
    width: pad.widthMm,
    x: pad.xMm,
    y: pad.yMm
  }))
  const missingReleaseData: MissingReleaseDatum[] = ["solder-mask"]
  if (footprint.copperEvidence !== "manufacturer-verified") missingReleaseData.push("copper")
  if (footprint.courtyard.sourceStatus !== "manufacturer-verified") missingReleaseData.push("courtyard")
  if (footprint.paste.sourceStatus !== "manufacturer-example") missingReleaseData.push("paste")
  return unavailableForPcb(
    mpn,
    missingReleaseData,
    reviewOnlyFootprint,
    footprint.orientation.convention,
    reviewOnlyFootprint.length > 0 ? "coordinate-pads" : "omitted-incomplete-coordinate-pattern"
  )
}

function powerStageReviewFootprint(mpn: string): ManufacturerFootprintEligibility | undefined {
  const footprint = powerStageFootprints.find((candidate) => candidate.mpn === mpn)
  if (footprint === undefined) return undefined

  // Power-stage evidence intentionally preserves summary dimensions and the
  // manufacturer's compound-land warnings. It does not contain an explicit
  // X/Y rectangle for every terminal. Expanding pitch/gap summaries into
  // coordinate pads would silently simplify HotRod and other heterogeneous
  // copper. A review preview is accepted only after the evidence library has
  // one source-backed coordinate shape per mapped pad; until then it stays
  // empty and cannot be mistaken for fabrication geometry.
  const missingReleaseData: MissingReleaseDatum[] = ["copper"]
  if (footprint.courtyard.status !== "specified") missingReleaseData.push("courtyard")
  if (footprint.paste.status !== "specified") missingReleaseData.push("paste")
  if (footprint.solderMask.status !== "specified") missingReleaseData.push("solder-mask")
  return unavailableForPcb(mpn, missingReleaseData, [], footprint.orientation, "omitted-incomplete-coordinate-pattern")
}

/**
 * Returns a source-backed review footprint and a fail-closed PCB eligibility
 * decision. It deliberately never treats a copper land pattern as a released
 * footprint: copper, solder mask, stencil/paste, and courtyard evidence must
 * all be complete before this module can return PCB artwork.
 */
export function manufacturerFootprintEligibility(mpn: string): ManufacturerFootprintEligibility {
  return (
    usbPdReviewFootprint(mpn) ??
    powerStageReviewFootprint(mpn) ??
    unavailableForPcb(mpn, ["copper", "courtyard", "paste", "solder-mask"], [])
  )
}

/**
 * Safe spread props for the PCB model. The selected reviewed records are all
 * intentionally DNP today; future eligibility requires an explicit evidence
 * update and a corresponding independent layout review.
 */
export function manufacturerFootprintProps(mpn: string) {
  manufacturerFootprintEligibility(mpn)
  return { doNotPlace: true } as const
}
