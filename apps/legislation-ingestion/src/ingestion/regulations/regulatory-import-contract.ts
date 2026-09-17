import { isDeepStrictEqual } from "node:util"
import {
  acquisitionUnitSchema,
  sameRegulatoryAcquisition,
  validateManifest
} from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"
import { currentReceiptSchema, receiptSchema } from "./artifact-backfill.js"
import { legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"
import { legalDiscoveryManifestSchema, validateLegalDiscoveryManifest } from "./discovery-registration.js"

export const regulatoryImportUnitSchema = z.union([acquisitionUnitSchema, legalDiscoveryUnitSchema])
export const regulatoryImportReceiptSchema = z.union([receiptSchema, currentReceiptSchema])

export type RegulatoryImportUnit = z.infer<typeof regulatoryImportUnitSchema>

export function parseRegulatoryImportManifest(value: unknown) {
  if (legalDiscoveryManifestSchema.safeParse(value).success) {
    return validateLegalDiscoveryManifest(value)
  }
  return validateManifest(value)
}

/** Historical inventory envelopes may vary; current discovery units must match their immutable manifest exactly. */
export function sameRegulatoryImportUnit(left: RegulatoryImportUnit, right: RegulatoryImportUnit) {
  if (left.historical !== right.historical) return false
  return left.historical
    ? sameRegulatoryAcquisition(acquisitionUnitSchema.parse(left), acquisitionUnitSchema.parse(right))
    : isDeepStrictEqual(left, right)
}
