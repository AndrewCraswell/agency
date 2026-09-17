import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schemaTask, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { RetryingHttpClient } from "../../ingestion/http-client.js"
import {
  prepareActionProvenanceEvidence,
  reconcileActionProvenanceBatch
} from "../../ingestion/openstates/action-provenance-cycle.js"
import { OpenStatesClient } from "../../ingestion/openstates/client.js"
import {
  retainOpenStatesBillPage,
  type RetainedOpenStatesBillPage
} from "../../ingestion/openstates/current-bill-archive.js"
import { ArtifactSourceStore } from "../../ingestion/source-store.js"
import { parseActionProvenanceSessionScope } from "../../persistence/action-provenance.js"

const DAY_IN_MILLISECONDS = 86_400_000
const MAXIMUM_CAPTURE_AGE_DAYS = 120

export const openStatesActionProvenancePayload = z.strictObject({
  state: z.enum(["ak", "nc"]),
  session: z.string().regex(/^[a-z0-9-]+$/),
  archiveStream: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  afterBillId: z.string().startsWith("bill:").optional(),
  apply: z.boolean().default(false)
})

export const openStatesActionProvenanceCapturePayload = z.strictObject({
  state: z.enum(["ak", "nc"]),
  session: z.string().regex(/^[a-z0-9-]+$/),
  from: z.iso.datetime({ offset: true }),
  apply: z.boolean().default(false)
})

export function actionProvenanceCaptureWindow(from: string, now = new Date()) {
  const parsed = new Date(from)
  if (!Number.isFinite(parsed.valueOf())) throw new Error("Action provenance capture requires a valid date")
  const age = now.getTime() - parsed.getTime()
  if (age < 0) throw new Error("Action provenance capture cannot begin in the future")
  if (age > MAXIMUM_CAPTURE_AGE_DAYS * DAY_IN_MILLISECONDS) {
    throw new Error(`Action provenance capture is limited to ${MAXIMUM_CAPTURE_AGE_DAYS} days`)
  }
  return parsed
}

export function actionProvenanceArchiveDispatches(
  retained: readonly RetainedOpenStatesBillPage[],
  input: { apply: boolean; session: string; state: "ak" | "nc" }
) {
  const matching = retained.filter((archive) => archive.session === input.session)
  if (matching.length === 0) throw new Error("Capture returned no bills for the requested session")
  return matching.map((archive) => ({
    idempotencyKey: `action-provenance:${input.state}:${input.session}:${archive.contentHash}:${input.apply ? "apply" : "inspect"}`,
    payload: {
      apply: input.apply,
      archiveSha256: archive.contentHash,
      archiveStream: archive.stream,
      session: input.session,
      state: input.state
    }
  }))
}

/** Manual recovery for API pages acquired before byte retention was enabled. It never changes bill facts. */
export const openStatesActionProvenanceCapture = schemaTask({
  id: "openstates-action-provenance-capture",
  schema: openStatesActionProvenanceCapturePayload,
  maxDuration: 600,
  queue: { name: "openstates-action-provenance", concurrencyLimit: 1 },
  run: async (payload) => {
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Action provenance capture requires Azure Storage")
    if (!config.ingestion.openStatesApiKey) throw new Error("Action provenance capture requires Open States API access")
    const scope = parseActionProvenanceSessionScope(payload)
    const from = actionProvenanceCaptureWindow(payload.from)
    const endpoint = new URL("bills", ensureTrailingSlash(new URL(config.ingestion.openStatesApiUrl))).href
    const artifactStore = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const store = new ArtifactSourceStore(artifactStore)
    const client = new OpenStatesClient({
      apiKey: config.ingestion.openStatesApiKey,
      baseUrl: new URL(config.ingestion.openStatesApiUrl),
      http: new RetryingHttpClient({
        maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
        minimumIntervalMs: 800,
        requestTimeoutMs: config.ingestion.requestTimeoutMs
      })
    })
    const retained: RetainedOpenStatesBillPage[] = []
    let page = 1
    for await (const records of client.bills({ from, jurisdiction: scope.jurisdictionName })) {
      retained.push(
        ...(await retainOpenStatesBillPage(store, records, {
          from,
          jurisdiction: scope.state,
          jurisdictionName: scope.jurisdictionName,
          page,
          providerEndpoint: endpoint,
          retrievedAt: new Date()
        }))
      )
      page += 1
    }
    const dispatches = actionProvenanceArchiveDispatches(retained, payload)
    const runs = []
    for (const dispatch of dispatches) {
      const key = await idempotencyKeys.create(dispatch.idempotencyKey, { scope: "global" })
      const run = await tasks.trigger("openstates-action-provenance-reconcile", dispatch.payload, {
        idempotencyKey: key,
        tags: ["provider:openstates", `jurisdiction:${payload.state}`, `session:${payload.session}`]
      })
      runs.push({ archiveSha256: dispatch.payload.archiveSha256, runId: run.id })
    }
    return { archives: dispatches.length, apply: payload.apply, pages: page - 1, runs }
  }
})

/** Manual, resumable session reconciliation. It has no schedule and never changes a mismatched timeline. */
export const openStatesActionProvenanceReconcile = schemaTask({
  id: "openstates-action-provenance-reconcile",
  schema: openStatesActionProvenancePayload,
  maxDuration: 600,
  queue: { name: "openstates-action-provenance", concurrencyLimit: 1 },
  run: async (payload) => {
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Action provenance reconciliation requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const bytes = await store.read(`openstates/${payload.archiveStream}/${payload.archiveSha256}.source`)
    if (createHash("sha256").update(bytes).digest("hex") !== payload.archiveSha256) {
      throw new Error("Retained archive checksum mismatch")
    }
    const evidence = prepareActionProvenanceEvidence(bytes, payload)
    const { pool } = createDatabase({ ...config.database, maxConnections: 1 })
    const client = await pool.connect()
    let result: Awaited<ReturnType<typeof reconcileActionProvenanceBatch>>
    try {
      result = await reconcileActionProvenanceBatch(client, evidence, payload)
    } finally {
      client.release()
      await pool.end()
    }
    if (!payload.apply || result.complete || result.nextAfterBillId === null) return result
    const key = await idempotencyKeys.create(
      `action-provenance:${payload.state}:${payload.session}:${payload.archiveSha256}:${result.nextAfterBillId}`,
      { scope: "global" }
    )
    const continuation = await tasks.trigger(
      "openstates-action-provenance-reconcile",
      { ...payload, afterBillId: result.nextAfterBillId },
      { idempotencyKey: key }
    )
    return { ...result, continuationRunId: continuation.id }
  }
})

function ensureTrailingSlash(url: URL): URL {
  return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`)
}
