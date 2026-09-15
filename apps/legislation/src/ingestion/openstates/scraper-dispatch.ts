import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { readScraperBillPlan } from "./scraper-batches.js"

const dispatchSchema = z.strictObject({
  planPath: z.string(),
  inventoryId: z.string().regex(/^[a-f0-9]{64}$/),
  batchId: z.string().regex(/^[a-f0-9]{64}$/),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime()
})

/** Publish before execution. Each retry needs a new run ID; this is evidence, not a lease. */
export async function archiveScraperBillDispatch(
  store: ArtifactStore,
  input: { planPath: string; batchId: string; runId: string; issuedAt: Date; expiresAt: Date }
) {
  const plan = await readScraperBillPlan(store, input.planPath)
  const dispatch = dispatchSchema.parse({
    ...input,
    inventoryId: plan.inventoryId,
    issuedAt: z.date().parse(input.issuedAt).toISOString(),
    expiresAt: z.date().parse(input.expiresAt).toISOString()
  })
  validateDispatch(dispatch, plan)
  const path = `openstates/scraper-dispatches/${plan.jurisdiction}/${dispatch.runId}.json`
  const bytes = Buffer.from(JSON.stringify(dispatch))
  await store.put(path, bytes)
  if (!Buffer.from(await store.read(path)).equals(bytes)) {
    throw new Error("Scraper dispatch conflict")
  }
  return { path, dispatch }
}

/** The caller must additionally check this is the currently leased attempt before committing. */
export async function readScraperBillDispatch(store: Pick<ArtifactStore, "read">, path: string, now: Date) {
  z.date().parse(now)
  const match = /^openstates\/scraper-dispatches\/(nc|ak)\/([A-Za-z0-9][A-Za-z0-9-]{0,100})\.json$/.exec(path)
  const runId = match?.[2]
  if (!runId) {
    throw new Error("Invalid scraper dispatch path")
  }
  const raw: unknown = JSON.parse(Buffer.from(await store.read(path)).toString("utf8"))
  const dispatch = dispatchSchema.parse(raw)
  const plan = await readScraperBillPlan(store, dispatch.planPath)
  validateDispatch(dispatch, plan)
  if (dispatch.runId !== runId || plan.jurisdiction !== match?.[1]) {
    throw new Error("Scraper dispatch identity mismatch")
  }
  if (now.getTime() < Date.parse(dispatch.issuedAt) || now.getTime() >= Date.parse(dispatch.expiresAt)) {
    throw new Error("Scraper dispatch is outside its execution window")
  }
  return dispatch
}

function validateDispatch(
  dispatch: z.infer<typeof dispatchSchema>,
  plan: Awaited<ReturnType<typeof readScraperBillPlan>>
) {
  const duration = Date.parse(dispatch.expiresAt) - Date.parse(dispatch.issuedAt)
  if (duration <= 0 || duration > 30 * 60 * 1000) {
    throw new Error("Scraper dispatch window must be positive and at most thirty minutes")
  }
  if (dispatch.inventoryId !== plan.inventoryId || !plan.batches.some((batch) => batch.id === dispatch.batchId)) {
    throw new Error("Scraper dispatch does not belong to frozen inventory")
  }
}
