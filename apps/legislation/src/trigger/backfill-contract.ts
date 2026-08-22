import { z } from "zod"
import { DOCUMENT_BACKFILL_SHARD_COUNT } from "../ingestion/documents/jobs.js"
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
 * product uses 16 deterministic shards. Running the four products together
 * therefore fills the 64-worker derived queue while keeping every worker on a
 * one-connection database pool. Provider and database telemetry determine
 * whether operators retain that fan-out or cut it back.
 */
export const backfillExecutionPolicy = {
  derivedQueueConcurrencyLimit: DOCUMENT_BACKFILL_SHARD_COUNT,
  derivedShardControllerQueueConcurrencyLimit: DOCUMENT_BACKFILL_SHARD_COUNT,
  documentBackfillShardCount: DOCUMENT_BACKFILL_SHARD_COUNT,
  supportingMaterialBackfillShardCount: 24
} as const

const positiveInteger = z.number().int().positive()
const nonemptyIdentifier = z.string().trim().min(1).max(200)

export const backfillControllerPayloadSchema = z
  .object({
    billTypes: z
      .array(z.string().trim().min(1).max(20))
      .min(1)
      .default([...defaultGovInfoBillTypes]),
    endCongress: positiveInteger,
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
 * shared publisher cadence, and each embedding product uses 16 deterministic
 * shards so a complete four-product pass can occupy the 64-worker queue.
 */
export function derivedBackfillShardCountFor(kind: "bill-documents" | "embeddings" | "supporting-materials"): number {
  if (kind === "bill-documents") {
    return backfillExecutionPolicy.documentBackfillShardCount
  }
  return kind === "embeddings" ? 16 : backfillExecutionPolicy.supportingMaterialBackfillShardCount
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
