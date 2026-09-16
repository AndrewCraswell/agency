import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { regulatoryEmbeddingSmokeSchema } from "./embedding-smoke.js"

const systemsSchema = z
  .array(
    z.object({
      model: z.string().min(1),
      queries: z
        .array(z.object({ queryId: z.string().min(1), ranked: z.array(z.object({ id: z.string().min(1) })).max(512) }))
        .max(64)
    })
  )
  .min(1)
  .max(12)

/** Pools evidence for blind review; it neither changes frozen labels nor supplies human judgments. */
export function buildRegulatoryJudgmentPool(input: unknown, systemsInput: unknown, depth = 10) {
  const manifest = regulatoryEmbeddingSmokeSchema.parse(input)
  const systems = systemsSchema.parse(systemsInput)
  z.int().min(1).max(25).parse(depth)
  const records = new Map(manifest.records.map((record) => [record.id, record]))
  const queryIds = new Set(manifest.queries.map((query) => query.id))
  let evidenceBytes = 0
  invariant(
    records.size === manifest.records.length && queryIds.size === manifest.queries.length,
    "judgment_pool_duplicate_identity"
  )
  invariant(new Set(systems.map((system) => system.model)).size === systems.length, "judgment_pool_duplicate_system")
  for (const system of systems) {
    invariant(
      system.queries.length === queryIds.size &&
        new Set(system.queries.map((query) => query.queryId)).size === queryIds.size &&
        system.queries.every((query) => queryIds.has(query.queryId)),
      "judgment_pool_query_coverage_mismatch"
    )
    invariant(
      system.queries.every(
        (query) =>
          new Set(query.ranked.map((row) => row.id)).size === query.ranked.length &&
          query.ranked.every((row) => records.has(row.id))
      ),
      "judgment_pool_invalid_ranking"
    )
  }
  return {
    contract: "regulatory-judgment-pool",
    manifestHash: digest(JSON.stringify(manifest)),
    systemsHash: digest(JSON.stringify(systems)),
    depth,
    gradeScale: { 0: "Does not answer the question", 1: "Context only", 2: "Partially answers", 3: "Directly answers" },
    humanReviewComplete: false,
    modelSelected: false,
    queries: manifest.queries.map((query) => {
      invariant(
        query.relevantIds.every((id) => records.has(id)),
        "judgment_pool_unknown_known_answer"
      )
      const ids = new Set(query.relevantIds)
      for (const system of systems) {
        const ranking = system.queries.find((row) => row.queryId === query.id)
        invariant(ranking, "judgment_pool_missing_query")
        for (const row of ranking.ranked.slice(0, depth)) {
          ids.add(row.id)
        }
      }
      return {
        id: query.id,
        question: query.input,
        candidates: [...ids]
          .sort((left, right) => digest(`${query.id}:${left}`).localeCompare(digest(`${query.id}:${right}`)))
          .map((id) => {
            const record = records.get(id)
            invariant(record, "judgment_pool_missing_record")
            evidenceBytes += Buffer.byteLength(record.input)
            invariant(evidenceBytes <= 32 * 1024 * 1024, "judgment_pool_evidence_byte_limit")
            return {
              id,
              versionId: record.versionId,
              inputHash: digest(record.input),
              text: record.input,
              grade: null,
              rationale: null,
              reviewer: null,
              reviewerKind: null
            }
          })
      }
    })
  }
}
