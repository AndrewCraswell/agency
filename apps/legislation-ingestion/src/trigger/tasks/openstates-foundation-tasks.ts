import { createDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { idempotencyKeys, schedules, schemaTask, tasks } from "@trigger.dev/sdk"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { AzureBlobArtifactStore } from "../../ingestion/documents/artifact-store.js"
import { importArchivedStateFoundation } from "../../ingestion/openstates/foundation-import.js"
import {
  acquireFoundationCommitteeInventory,
  foundationSourcesUnchanged
} from "../../ingestion/openstates/foundation-refresh.js"
import {
  archivePeopleRepositoryRevision,
  downloadPeopleRepositoryRevision,
  resolvePeopleRepositoryRevision
} from "../../ingestion/openstates/people-source-acquisition.js"
import { requireScraperActivation } from "../../ingestion/openstates/scraper-activation.js"
import { scraperBillState } from "../../ingestion/openstates/scraper-bill-profiles.js"
import { parseScheduledScraperJurisdictions } from "../scraper-schedule-manifest.js"

const manifestPath = z
  .string()
  .regex(/^openstates\/people\/[a-f0-9]{40}\/(ak|nc|wa)\/(entities|history)\/[A-Za-z0-9-]+\/complete\.json$/)

export const openStatesFoundationImportPayload = z.strictObject({
  state: z.enum(["ak", "nc", "wa"]),
  currentManifestPath: manifestPath,
  historyManifestPath: manifestPath,
  committeeInventoryPath: z
    .string()
    .regex(/^openstates\/committee-inventories\/wa\/20[0-9]{2}-[0-9]{2}\/[a-f0-9]{64}\.xml$/)
    .optional()
})

const refreshPayload = z.strictObject({
  state: scraperBillState,
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  retrievedAt: z.iso.datetime()
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

export const openStatesFoundationRefresh = schemaTask({
  id: "openstates-foundation-refresh",
  schema: refreshPayload,
  maxDuration: 3_600,
  queue: { name: "openstates-foundation-publication", concurrencyLimit: 1 },
  run: async (payload) => {
    requireScraperActivation(payload.state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    const config = loadConfig()
    if (!config.azure.storageAccount) throw new Error("Open States foundation refresh requires Azure Storage")
    const store = new AzureBlobArtifactStore(config.azure.storageAccount, config.azure.stateSourceContainer)
    const { database, pool } = createDatabase({ ...config.database, maxConnections: 2 })
    try {
      const streams = [`${payload.state}-people-history`, `${payload.state}-committee-observations`]
      const checkpoints = await Promise.all(
        streams.map((stream) =>
          database.query.syncCheckpoints.findFirst({
            where: and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, stream))
          })
        )
      )
      const inventory = await acquireFoundationCommitteeInventory(payload.state, store)
      if (
        foundationSourcesUnchanged(
          payload.state,
          payload.revision,
          checkpoints[0]?.cursor,
          checkpoints[1]?.cursor,
          inventory
        )
      ) {
        return { status: "no_change" as const, state: payload.state, revision: payload.revision }
      }
      const files = await downloadPeopleRepositoryRevision(payload.revision, fetch, process.env.GITHUB_TOKEN)
      const archive = await archivePeopleRepositoryRevision(store, {
        files,
        retrievedAt: new Date(payload.retrievedAt),
        revision: payload.revision,
        state: payload.state
      })
      return await importArchivedStateFoundation(database, {
        store,
        ...archive,
        ...(inventory ? { committeeInventoryPath: inventory.path } : {})
      })
    } finally {
      await pool.end()
    }
  }
})

export const openStatesFoundationSchedule = schedules.task({
  id: "openstates-foundation-schedule",
  maxDuration: 60,
  run: async (payload) => {
    if (payload.externalId !== "openstates-scraper:foundation:enabled") {
      throw new Error("Unexpected Open States foundation schedule identity")
    }
    const states = parseScheduledScraperJurisdictions(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    if (states.length === 0) throw new Error("Open States foundation schedule has no enabled jurisdictions")
    const revision = await resolvePeopleRepositoryRevision(fetch, process.env.GITHUB_TOKEN)
    const runs = []
    for (const state of states) {
      requireScraperActivation(state, process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
      const key = await idempotencyKeys.create(
        `openstates-foundation:${state}:${revision}:${payload.timestamp.toISOString()}`,
        { scope: "global" }
      )
      const handle = await tasks.trigger(
        "openstates-foundation-refresh",
        { state, revision, retrievedAt: payload.timestamp.toISOString() },
        { concurrencyKey: `production:openstates-foundation:${state}`, idempotencyKey: key }
      )
      runs.push({ state, runId: handle.id })
    }
    return { status: "dispatched" as const, revision, runs }
  }
})
