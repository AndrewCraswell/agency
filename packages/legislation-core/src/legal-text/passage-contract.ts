import { z } from "zod"

export const legalPassageScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("provision"), versionId: z.uuid(), editionId: z.uuid() }),
  z.strictObject({ kind: z.literal("publication"), versionId: z.uuid(), observationId: z.uuid() })
])

const scopeProjectionBase = {
  scope_id: z.uuid(),
  jurisdiction_id: z.string().min(1),
  source_id: z.string().min(1),
  rights_profile_id: z.string().min(1),
  agency_ids: z.array(z.string().min(1)).max(100)
}
export const legalSearchEditionScopeProjectionSchema = z.strictObject({
  ...scopeProjectionBase,
  scope_kind: z.literal("edition"),
  corpus: z.literal("regulation"),
  code_id: z.uuid(),
  edition_id: z.uuid(),
  issue_date: z.iso.date().nullable(),
  currency_date: z.iso.date().nullable()
})
export const legalSearchPublicationScopeProjectionSchema = z.strictObject({
  ...scopeProjectionBase,
  scope_kind: z.literal("publication"),
  corpus: z.literal("regulatory_publication"),
  observation_id: z.uuid(),
  document_version_id: z.uuid(),
  publication_kind: z.enum(["proposed_rule", "final_rule", "notice", "other"]),
  publication_date: z.iso.date()
})
export const legalSearchScopeProjectionSchema = z.discriminatedUnion("scope_kind", [
  legalSearchEditionScopeProjectionSchema,
  legalSearchPublicationScopeProjectionSchema
])

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const span = z.strictObject({ blockId: z.string(), start: z.int().nonnegative(), end: z.int().nonnegative() })
const passage = z.strictObject({
  id: hash,
  versionId: z.uuid(),
  ordinal: z.int().nonnegative(),
  start: z.int().nonnegative(),
  end: z.int().nonnegative(),
  text: z.string(),
  inputText: z.string().max(16000),
  tokenCount: z.int().nonnegative(),
  readerSpans: z.array(span),
  contextSpans: z.array(span),
  inputHash: hash,
  rowContinuation: z
    .strictObject({ start: z.int().nonnegative(), end: z.int().nonnegative(), longColumn: z.int().nonnegative() })
    .nullable()
})
export const legalTransferRowSchema = z.object({
  id: hash,
  ordinal: z.int().nonnegative(),
  body: z.string(),
  input_text: z.string(),
  data: passage
})
export const legalTransferGenerationSchema = z.object({
  id: hash,
  provision_version_id: z.uuid().nullable(),
  document_version_id: z.uuid().nullable(),
  contract: z.string(),
  body_hash: hash,
  tokenizer_id: z.string(),
  context: z.string(),
  manifest_hash: hash,
  passage_count: z.int().nonnegative().max(10000),
  eligibility: z.enum(["eligible", "empty_text"])
})
