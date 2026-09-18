import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { completeLegalDiscoveryDispatch } from "../../ingestion/regulations/discovery-dispatch.js"
import {
  legalDiscoveryPublicationSource,
  publishLegalDiscoveryUnit
} from "../../ingestion/regulations/discovery-publication.js"
import { prepareFrIssuePublication } from "../../ingestion/regulations/fr-publication-preparation.js"
import { continueRegulatoryDiscoveryStage } from "./regulatory-discovery-continuation.js"
import { regulatoryFrRendition } from "./regulatory-fr-publication.js"

export const regulatoryDiscoveryPublicationPayloadSchema = z.strictObject({
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  unitKey: z.string().regex(/^[a-f0-9]{64}$/)
})

/** One parsed current eCFR unit per publication worker. Derived-stage dispatch remains separately gated. */
export const regulatoryDiscoveryPublication = task({
  id: "regulatory-discovery-publication",
  maxDuration: 900,
  queue: { name: "regulatory-source-publication", concurrencyLimit: 2 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => continueRegulatoryDiscoveryPublication(payload)
})

export async function continueRegulatoryDiscoveryPublication(value: unknown) {
  const result = await runRegulatoryDiscoveryPublication(value)
  if (result.state === "renditions_pending") return { ...result, continuationRunId: null }
  const next = await continueRegulatoryDiscoveryStage("publication", result.payload, result.controllerScope)
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatoryDiscoveryPublication(value: unknown) {
  const payload = regulatoryDiscoveryPublicationPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory publication requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000
  })
  try {
    const sourceId = await legalDiscoveryPublicationSource(pool, payload)
    if (sourceId === "govinfo-fr") {
      const metadataRoot = z.string().trim().min(1).parse(process.env.REGULATORY_FR_METADATA_DIRECTORY)
      const prepared = await prepareFrIssuePublication(pool, { ...payload, metadataRoot })
      const renditionItems = await Promise.all(
        prepared.renditions.map(async ({ documentNumber }) => {
          const renditionPayload = {
            manifestId: payload.manifestId,
            scopeKey: prepared.scopeKey,
            unitKey: payload.unitKey,
            documentNumber
          }
          return {
            payload: renditionPayload,
            options: {
              idempotencyKey: await idempotencyKeys.create(
                `regulatory-fr-rendition:${digest(JSON.stringify(renditionPayload))}`,
                { scope: "global" }
              )
            }
          }
        })
      )
      const runs = await regulatoryFrRendition.batchTrigger(renditionItems)
      return {
        ...prepared,
        state: "renditions_pending" as const,
        payload,
        renditionBatchId: z.object({ batchId: z.string().min(1).max(256) }).parse(runs).batchId
      }
    }
    if (sourceId !== "ecfr") throw new Error("unsupported_legal_discovery_publication_source")
    const result = await publishLegalDiscoveryUnit(pool, payload)
    const controllerScope = await completeLegalDiscoveryDispatch(pool, "publication", payload)
    return { ...result, payload, controllerScope }
  } finally {
    await pool.end()
  }
}
