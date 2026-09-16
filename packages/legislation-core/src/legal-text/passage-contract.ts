import { z } from "zod"

export const legalPassageScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("provision"), versionId: z.uuid(), editionId: z.uuid() }),
  z.strictObject({ kind: z.literal("publication"), versionId: z.uuid(), observationId: z.uuid() })
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
