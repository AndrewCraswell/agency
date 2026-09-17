import { isDeepStrictEqual } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"

const judgmentSchema = z.strictObject({
  grade: z.int().min(0).max(3),
  rationale: z.string().trim().min(1),
  reviewer: z.string().trim().min(1),
  reviewerKind: z.enum(["human", "automated"])
})
const candidateSchema = z.strictObject({
  id: z.string().min(1),
  versionId: z.string().min(1),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  text: z.string().min(1),
  reviews: z.array(judgmentSchema).max(8),
  adjudication: judgmentSchema.nullable()
})
const querySchema = z.strictObject({
  id: z.string().min(1),
  question: z.string().min(1),
  candidates: z.array(candidateSchema).min(1).max(512)
})
export const regulatoryJudgmentPacketSchema = z.strictObject({
  contract: z.literal("regulatory-judgment-pool"),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  systemsHash: z.string().regex(/^[a-f0-9]{64}$/),
  depth: z.int().min(1).max(25),
  gradeScale: z.strictObject({
    "0": z.string(),
    "1": z.string(),
    "2": z.string(),
    "3": z.string()
  }),
  humanReviewComplete: z.literal(false),
  modelSelected: z.literal(false),
  queries: z.array(querySchema).min(1).max(64)
})
const pageSchema = z.strictObject({
  contract: z.literal("regulatory-judgment-review-page"),
  packetHash: z.string().regex(/^[a-f0-9]{64}$/),
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  systemsHash: z.string().regex(/^[a-f0-9]{64}$/),
  afterQueryId: z.string().nullable(),
  nextAfterQueryId: z.string().nullable(),
  exhausted: z.boolean(),
  queries: z.array(querySchema).min(1).max(5)
})

function immutableCandidate(candidate: z.infer<typeof candidateSchema>) {
  return {
    id: candidate.id,
    versionId: candidate.versionId,
    inputHash: candidate.inputHash,
    text: candidate.text
  }
}

/** Extracts a bounded rank-blind review page without changing the source packet. */
export function extractRegulatoryJudgmentReviewPage(
  packetInput: unknown,
  input: { afterQueryId?: string | null; limit?: number } = {}
) {
  const packet = regulatoryJudgmentPacketSchema.parse(packetInput)
  invariant(
    new Set(packet.queries.map(({ id }) => id)).size === packet.queries.length,
    "regulatory_review_page_duplicate_query"
  )
  const afterQueryId = z
    .string()
    .min(1)
    .nullable()
    .parse(input.afterQueryId ?? null)
  const limit = z
    .int()
    .min(1)
    .max(5)
    .parse(input.limit ?? 1)
  const afterIndex = afterQueryId === null ? -1 : packet.queries.findIndex(({ id }) => id === afterQueryId)
  invariant(afterQueryId === null || afterIndex >= 0, "regulatory_review_page_cursor")
  const queries = packet.queries.slice(afterIndex + 1, afterIndex + 1 + limit)
  invariant(queries.length > 0, "regulatory_review_page_exhausted")
  const lastIndex = afterIndex + queries.length
  const exhausted = lastIndex === packet.queries.length - 1
  return pageSchema.parse({
    contract: "regulatory-judgment-review-page",
    packetHash: digest(JSON.stringify(packet)),
    manifestHash: packet.manifestHash,
    systemsHash: packet.systemsHash,
    afterQueryId,
    nextAfterQueryId: exhausted ? null : queries.at(-1)!.id,
    exhausted,
    queries
  })
}

/** Applies only reviewed fields from one page after exact packet/evidence replay checks. */
export function applyRegulatoryJudgmentReviewPage(packetInput: unknown, pageInput: unknown) {
  const packet = regulatoryJudgmentPacketSchema.parse(packetInput)
  const page = pageSchema.parse(pageInput)
  invariant(digest(JSON.stringify(packet)) === page.packetHash, "regulatory_review_page_stale_packet")
  invariant(
    packet.manifestHash === page.manifestHash && packet.systemsHash === page.systemsHash,
    "regulatory_review_page_identity"
  )
  const replacements = new Map<string, z.infer<typeof querySchema>>()
  for (const query of page.queries) {
    const expected = packet.queries.find(({ id }) => id === query.id)
    invariant(
      expected?.question === query.question && expected.candidates.length === query.candidates.length,
      "regulatory_review_page_query_changed"
    )
    for (const candidate of expected.candidates) {
      const reviewed = query.candidates.find(({ id }) => id === candidate.id)
      invariant(
        reviewed && isDeepStrictEqual(immutableCandidate(reviewed), immutableCandidate(candidate)),
        "regulatory_review_page_evidence_changed"
      )
    }
    invariant(
      new Set(query.candidates.map(({ id }) => id)).size === query.candidates.length,
      "regulatory_review_page_duplicate_candidate"
    )
    replacements.set(query.id, query)
  }
  invariant(replacements.size === page.queries.length, "regulatory_review_page_duplicate_query")
  return {
    ...packet,
    queries: packet.queries.map((query) => replacements.get(query.id) ?? query)
  }
}
