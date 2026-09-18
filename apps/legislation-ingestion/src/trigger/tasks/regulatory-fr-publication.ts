import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { completeLegalDiscoveryDispatch } from "../../ingestion/regulations/discovery-dispatch.js"
import { finalizeFrIssuePublication } from "../../ingestion/regulations/fr-publication-finalization.js"
import { recordFrFinalizationFailure } from "../../ingestion/regulations/fr-publication-recovery.js"
import { processFrRendition } from "../../ingestion/regulations/fr-rendition-processing.js"
import { continueRegulatoryDiscoveryStage } from "./regulatory-discovery-continuation.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const regulatoryFrRenditionPayloadSchema = z.strictObject({
  manifestId: hashSchema,
  scopeKey: hashSchema,
  unitKey: hashSchema,
  documentNumber: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/)
})
export const regulatoryFrFinalizationPayloadSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema })

export const regulatoryFrRendition = task({
  id: "regulatory-fr-rendition",
  maxDuration: 300,
  queue: { name: "regulatory-fr-rendition", concurrencyLimit: 4 },
  retry: { maxAttempts: 4, minTimeoutInMs: 60_000, maxTimeoutInMs: 300_000, factor: 2, randomize: true },
  run: async (payload: unknown) => continueRegulatoryFrRendition(payload)
})

export const regulatoryFrPublicationFinalize = task({
  id: "regulatory-fr-publication-finalize",
  maxDuration: 900,
  queue: { name: "regulatory-source-publication", concurrencyLimit: 2 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => continueRegulatoryFrPublicationFinalization(payload)
})

function databaseUrl() {
  const value = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(value.protocol) ||
    value.pathname === "/" ||
    value.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Federal Register publication requires a canonical PostgreSQL database")
  }
  return value
}

function pool() {
  return new pg.Pool({
    connectionString: databaseUrl().href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
}

export async function continueRegulatoryFrRendition(value: unknown) {
  const payload = regulatoryFrRenditionPayloadSchema.parse(value)
  const result = await runRegulatoryFrRendition(payload)
  if (!result.publicationReady) return { ...result, finalizationRunId: null }
  const finalizationPayload = { manifestId: payload.manifestId, unitKey: payload.unitKey }
  const key = digest(JSON.stringify(["regulatory-fr-publication-finalize-2026-09-18", finalizationPayload]))
  const run = await tasks.trigger("regulatory-fr-publication-finalize", finalizationPayload, {
    idempotencyKey: await idempotencyKeys.create(`regulatory-fr-publication-finalize:${key}`, { scope: "global" })
  })
  return { ...result, finalizationRunId: z.object({ id: z.string().min(1).max(256) }).parse(run).id }
}

export async function runRegulatoryFrRendition(value: unknown) {
  const payload = regulatoryFrRenditionPayloadSchema.parse(value)
  const pdfRoot = z.string().trim().min(1).parse(process.env.REGULATORY_FR_PDF_DIRECTORY)
  const database = pool()
  try {
    return await processFrRendition(database, { ...payload, pdfRoot })
  } finally {
    await database.end()
  }
}

export async function continueRegulatoryFrPublicationFinalization(value: unknown) {
  const result = await runRegulatoryFrPublicationFinalization(value)
  const next = await continueRegulatoryDiscoveryStage("publication", result.payload, result.controllerScope)
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatoryFrPublicationFinalization(value: unknown) {
  const payload = regulatoryFrFinalizationPayloadSchema.parse(value)
  const database = pool()
  try {
    let result
    try {
      result = await finalizeFrIssuePublication(database, payload)
    } catch (error) {
      await recordFrFinalizationFailure(database, payload, error)
      throw error
    }
    const controllerScope = await completeLegalDiscoveryDispatch(database, "publication", payload)
    return { ...result, payload, controllerScope }
  } finally {
    await database.end()
  }
}
