import { createHash } from "node:crypto"
import { createDatabase } from "@repo/legislation-core/database/database"
import { idempotencyKeys, schemaTask, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import {
  prepareActionProvenanceEvidence,
  reconcileActionProvenanceBatch
} from "../../ingestion/openstates/action-provenance-cycle.js"

export const openStatesActionProvenancePayload = z.strictObject({
  state: z.enum(["ak", "nc"]),
  session: z.string().regex(/^[a-z0-9-]+$/),
  archiveStream: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  afterBillId: z.string().startsWith("bill:").optional(),
  apply: z.boolean().default(false)
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
