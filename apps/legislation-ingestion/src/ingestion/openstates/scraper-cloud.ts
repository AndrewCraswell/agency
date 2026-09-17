import { DefaultAzureCredential } from "@azure/identity"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

const revision = "d43f853796ceeeb49205f7d144790647764ce105"
const runIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/)
const requestSchema = z
  .strictObject({
    jurisdiction: z.enum(["ak", "nc"]),
    domain: z.enum(["bills", "events"]),
    session: z.string().nullable(),
    timeout_seconds: z.number().int().min(1).max(1500),
    revision: z.literal(revision),
    bill_ids: z.array(z.string()).min(1).max(10).nullable(),
    event_keys: z
      .array(z.string().regex(/^[HSJ]:[A-Z0-9&]+:[0-9T:+.-]+$/))
      .min(1)
      .max(10)
      .optional()
  })
  .superRefine((request, context) => {
    if (
      request.jurisdiction === "ak" &&
      request.domain === "events" &&
      request.session === "34" &&
      request.bill_ids === null &&
      request.event_keys &&
      new Set(request.event_keys).size === request.event_keys.length
    ) {
      return
    }
    context.addIssue({ code: "custom", message: "Unsupported cloud scraper request" })
  })
const settlementSchema = z.strictObject({
  runId: runIdSchema,
  manifestPath: z.string(),
  queueMessageDeleted: z.literal(true)
})
type Credential = { getToken(scope: string): Promise<{ token: string } | null> }
type Fetch = typeof fetch

export type CloudScraperRequest = z.infer<typeof requestSchema>

export function scraperCloudPaths(runId: string, request: CloudScraperRequest) {
  runIdSchema.parse(runId)
  requestSchema.parse(request)
  const prefix = `openstates/scrapers/${revision}/${request.jurisdiction}/${request.domain}/${runId}`
  return { manifestPath: `${prefix}/retained.json`, settlementPath: `${prefix}/settled.json` }
}

/**
 * Enqueue one extraction-only worker and wait for its queue acknowledgement marker.
 * A missing marker is shutdown uncertainty, so callers must preserve confirmed-release ownership.
 */
export async function dispatchCloudScraperAttempt(
  input: {
    store: Pick<ArtifactStore, "exists" | "read">
    runId: string
    request: CloudScraperRequest
    storageAccount: string
    queueName: string
    maxWaitSeconds?: number
  },
  dependencies: {
    credential?: Credential
    fetch?: Fetch
    sleep?: (milliseconds: number) => Promise<void>
    now?: () => number
  } = {}
) {
  const runId = runIdSchema.parse(input.runId)
  const request = requestSchema.parse(input.request)
  const account = z
    .string()
    .regex(/^[a-z0-9]{3,24}$/)
    .parse(input.storageAccount)
  const queue = z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/)
    .parse(input.queueName)
  const maxWaitSeconds = z
    .number()
    .int()
    .min(1)
    .max(1800)
    .parse(input.maxWaitSeconds ?? 1800)
  const credential = dependencies.credential ?? new DefaultAzureCredential()
  const requestFetch = dependencies.fetch ?? fetch
  const sleep =
    dependencies.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
  const now = dependencies.now ?? Date.now
  const token = await credential.getToken("https://storage.azure.com/.default")
  if (!token) {
    throw new Error("Azure Storage credential did not issue a token")
  }
  const payload = Buffer.from(JSON.stringify({ run_id: runId, request })).toString("base64")
  const response = await requestFetch(`https://${account}.queue.core.windows.net/${queue}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/xml",
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": "2023-11-03"
    },
    body: `<QueueMessage><MessageText>${payload}</MessageText></QueueMessage>`
  })
  if (!response.ok) {
    throw new Error(`Cloud scraper dispatch failed with status ${response.status}`)
  }
  const paths = scraperCloudPaths(runId, request)
  const deadline = now() + maxWaitSeconds * 1000
  do {
    if (await input.store.exists(paths.settlementPath)) {
      const settlement: unknown = JSON.parse(Buffer.from(await input.store.read(paths.settlementPath)).toString("utf8"))
      const settled = settlementSchema.parse(settlement)
      if (settled.runId !== runId || settled.manifestPath !== paths.manifestPath) {
        throw new Error("Cloud scraper settlement identity mismatch")
      }
      if (!(await input.store.exists(paths.manifestPath))) {
        throw new Error("Cloud scraper settled without a retained manifest")
      }
      return paths
    }
    await sleep(5_000)
  } while (now() < deadline)
  throw new ScraperWorkerStopUnconfirmedError()
}

export function alaskaEventCloudRequest(eventKeys: string[]): CloudScraperRequest {
  return requestSchema.parse({
    jurisdiction: "ak",
    domain: "events",
    session: "34",
    timeout_seconds: 1500,
    revision,
    bill_ids: null,
    event_keys: eventKeys
  })
}
