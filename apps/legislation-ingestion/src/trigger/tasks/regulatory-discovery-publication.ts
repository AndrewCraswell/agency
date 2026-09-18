import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  inspectAnnualCfrDiscoveryPublication,
  materializeAnnualCfrDiscoveryUnit
} from "../../ingestion/regulations/annual-discovery-publication.js"
import {
  completeAnnualCfrMaterializationDispatch,
  completeLegalDiscoveryDispatch
} from "../../ingestion/regulations/discovery-dispatch.js"
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
  if (result.state === "renditions_pending" || result.state === "annual_publication_pending") {
    return { ...result, continuationRunId: null }
  }
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
    connectionTimeoutMillis: 10_000
  })
  const config = loadConfig()
  const storageAccount = z.string().trim().min(1).parse(config.azure.storageAccount)
  const sourceStore = new AzureBlobArtifactStore(storageAccount, config.azure.federalSourceContainer)
  const normalizedStore = new AzureBlobArtifactStore(storageAccount, config.azure.normalizedDocumentContainer)
  try {
    const sourceId = await legalDiscoveryPublicationSource(pool, payload)
    if (sourceId === "govinfo-fr") {
      const metadataRoot = z.string().trim().min(1).parse(process.env.REGULATORY_FR_METADATA_DIRECTORY)
      const prepared = await prepareFrIssuePublication(
        pool,
        { ...payload, metadataRoot },
        { sourceStore, normalizedStore, metadataStore: sourceStore }
      )
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
    if (sourceId === "govinfo-cfr") {
      const scratchRoot = z.string().trim().min(1).parse(process.env.REGULATORY_NORMALIZED_DIRECTORY)
      const materialized = await materializeAnnualCfrDiscoveryUnit(pool, payload, {
        sourceStore,
        normalizedStore,
        scratchRoot
      })
      const controllerScope = await completeAnnualCfrMaterializationDispatch(pool, payload, materialized.generationId)
      const readiness = await inspectAnnualCfrDiscoveryPublication(pool, {
        manifestId: payload.manifestId,
        year: materialized.year,
        title: materialized.title
      })
      let annualPublicationRunId: string | null = null
      if (readiness.payload !== null) {
        const handle = await tasks.trigger("regulatory-annual-publication", readiness.payload, {
          idempotencyKey: await idempotencyKeys.create(
            `regulatory-annual-publication:${digest(JSON.stringify(readiness.payload))}`,
            { scope: "global" }
          )
        })
        annualPublicationRunId = z.object({ id: z.string().min(1).max(256) }).parse(handle).id
      }
      return {
        ...materialized,
        state: "annual_publication_pending" as const,
        payload,
        controllerScope,
        readiness,
        annualPublicationRunId
      }
    }
    if (sourceId !== "ecfr") throw new Error("unsupported_legal_discovery_publication_source")
    const scratchRoot = z.string().trim().min(1).parse(process.env.REGULATORY_NORMALIZED_DIRECTORY)
    const result = await publishLegalDiscoveryUnit(pool, payload, { sourceStore, normalizedStore, scratchRoot })
    const controllerScope = await completeLegalDiscoveryDispatch(pool, "publication", payload)
    return { ...result, payload, controllerScope }
  } finally {
    await pool.end()
  }
}
