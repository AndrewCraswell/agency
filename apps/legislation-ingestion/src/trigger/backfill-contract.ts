import { z } from "zod"
import { DOCUMENT_BACKFILL_SHARD_COUNT } from "../ingestion/documents/shard-policy.js"
import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"

export const backfillPhases = [
  "openstates-history",
  "govinfo-history",
  "congress-history",
  "current-catchup",
  "documents",
  "materials",
  "embeddings",
  "validation"
] as const
export const defaultGovInfoBillTypes = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"] as const

/**
 * Document work is safely partitioned by canonical jurisdiction and uses a
 * bounded 64-lane drain with durable publisher slots. Supporting materials use
 * deterministic ID shards behind the same publisher limiter. Each embedding
 * product defaults to 16 deterministic shards for targeted work. A complete
 * recreation runs products sequentially at the 128-worker steady-state cap
 * through PgBouncer. Temporary throughput canaries may raise the named queues
 * as high as 200 workers while retaining an 80-session PostgreSQL stop threshold.
 */
export const backfillExecutionPolicy = {
  derivedQueueConcurrencyLimit: 128,
  derivedShardControllerQueueConcurrencyLimit: 128,
  documentBackfillShardCount: DOCUMENT_BACKFILL_SHARD_COUNT,
  supportingMaterialBackfillShardCount: 24
} as const

export const EMBEDDING_BACKFILL_DEFAULT_SHARD_COUNT = 16
export const EMBEDDING_BACKFILL_MAX_SHARD_COUNT = 200

const positiveInteger = z.number().int().positive()
const nonemptyIdentifier = z.string().trim().min(1).max(200)

export const backfillControllerPayloadSchema = z
  .object({
    billTypes: z
      .array(z.string().trim().min(1).max(20))
      .min(1)
      .default([...defaultGovInfoBillTypes]),
    endCongress: positiveInteger,
    forceGovInfo: z.boolean().default(false),
    jurisdictions: z
      .array(z.enum(supportedOpenStatesJurisdictions))
      .min(1)
      .default([...supportedOpenStatesJurisdictions]),
    openStatesManifestBlob: z.string().trim().min(1).max(1_024),
    phases: z
      .array(z.enum(backfillPhases))
      .min(1)
      .default([...backfillPhases]),
    rebuildId: nonemptyIdentifier,
    startCongress: positiveInteger
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startCongress > value.endCongress) {
      context.addIssue({
        code: "custom",
        message: "startCongress must not exceed endCongress",
        path: ["startCongress"]
      })
    }
  })

export type ParsedBackfillControllerPayload = z.output<typeof backfillControllerPayloadSchema>
export type BackfillPhase = (typeof backfillPhases)[number]

/**
 * Derived workers partition their candidate sets and hold a lease per shard.
 * Documents use 64 jurisdiction lanes, supporting materials use deterministic
 * ID shards sized to keep large-PDF extraction parallel without widening the
 * shared publisher cadence. Targeted embedding work defaults to 16
 * deterministic shards, while a complete recreation may give one product the
 * full current embedding queue after the previous product completes.
 */
export function derivedBackfillShardCountFor(kind: "bill-documents" | "embeddings" | "supporting-materials"): number {
  if (kind === "bill-documents") {
    return backfillExecutionPolicy.documentBackfillShardCount
  }
  return kind === "embeddings"
    ? EMBEDDING_BACKFILL_DEFAULT_SHARD_COUNT
    : backfillExecutionPolicy.supportingMaterialBackfillShardCount
}

export function maximumDerivedBackfillShardCountFor(
  kind: "bill-documents" | "embeddings" | "supporting-materials"
): number {
  return kind === "embeddings" ? EMBEDDING_BACKFILL_MAX_SHARD_COUNT : derivedBackfillShardCountFor(kind)
}

export type BackfillUnit = Readonly<{
  key: string
  phase: BackfillPhase
  payload: Readonly<Record<string, unknown>>
}>

export function createBackfillUnits(payload: ParsedBackfillControllerPayload): BackfillUnit[] {
  const enabled = new Set(payload.phases)
  const units: BackfillUnit[] = []

  if (enabled.has("openstates-history")) {
    units.push(
      ...payload.jurisdictions.map((jurisdiction) => ({
        key: `openstates-history:${jurisdiction}`,
        payload: { jurisdiction, manifestBlob: payload.openStatesManifestBlob },
        phase: "openstates-history" as const
      }))
    )
  }
  if (enabled.has("govinfo-history")) {
    units.push({
      key: `govinfo-history:${payload.startCongress}-${payload.endCongress}:${payload.billTypes.join("-")}`,
      payload: {
        billTypes: payload.billTypes,
        endCongress: payload.endCongress,
        force: payload.forceGovInfo,
        startCongress: payload.startCongress
      },
      phase: "govinfo-history"
    })
  }
  if (enabled.has("congress-history")) {
    units.push({
      key: `congress-history:${payload.startCongress}-${payload.endCongress}`,
      payload: { endCongress: payload.endCongress, startCongress: payload.startCongress },
      phase: "congress-history"
    })
  }
  if (enabled.has("current-catchup")) {
    units.push(
      ...payload.jurisdictions.flatMap((jurisdiction) =>
        (["bills", "entities", "events"] as const).map((domain) => ({
          key: `current-catchup:openstates:${domain}:${jurisdiction}`,
          payload: { domain, jurisdiction },
          phase: "current-catchup" as const
        }))
      ),
      { key: "current-catchup:congress:bills:current", payload: {}, phase: "current-catchup" }
    )
  }
  for (const phase of ["documents", "materials", "embeddings", "validation"] as const) {
    if (enabled.has(phase)) {
      units.push({ key: phase, payload: {}, phase })
    }
  }

  return units
}

export function backfillIdempotencyKey(rebuildId: string, unitKey: string): string {
  return `backfill:${rebuildId}:${unitKey}`
}
