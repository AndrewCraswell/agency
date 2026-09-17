import { createDatabase } from "@repo/legislation-core/database/database"
import { schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { importArchivedStateFoundation } from "../../ingestion/openstates/foundation-import.js"

const manifestPath = z
  .string()
  .regex(/^openstates\/people\/[a-f0-9]{40}\/(ak|nc)\/(entities|history)\/[A-Za-z0-9-]+\/complete\.json$/)

export const openStatesFoundationImportPayload = z.strictObject({
  state: z.enum(["ak", "nc"]),
  currentManifestPath: manifestPath,
  historyManifestPath: manifestPath
})

/** Manual immutable replay; schedule only source acquisition after first production recovery acceptance. */
export const openStatesFoundationImport = schemaTask({
  id: "openstates-foundation-import",
  schema: openStatesFoundationImportPayload,
  maxDuration: 3_600,
  queue: { name: "openstates-foundation-publication", concurrencyLimit: 1 },
  run: async (payload) => {
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Open States foundation import requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    try {
      return await importArchivedStateFoundation(database, { store, ...payload })
    } finally {
      await pool.end()
    }
  }
})
