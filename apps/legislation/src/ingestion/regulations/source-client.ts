import { setTimeout } from "node:timers/promises"
import { RetryingHttpClient, readBounded } from "../http-client.js"
import { digest, officialUrl, type InventoryEvidence, type AcquisitionUnit } from "./contracts.js"

type SourceId = AcquisitionUnit["sourceId"]

/** Local acquisition client. Cross-worker budgets must be supplied before Trigger use. */
export class RegulatorySourceClient {
  readonly #http: RetryingHttpClient
  constructor(options: { fetch?: typeof fetch; beforeAttempt?: () => Promise<void>; minimumIntervalMs?: number } = {}) {
    this.#http = new RetryingHttpClient({
      fetch: options.fetch,
      beforeAttempt: options.beforeAttempt,
      minimumIntervalMs: options.minimumIntervalMs ?? 500,
      maxAttempts: 1,
      requestTimeoutMs: 60_000
    })
  }

  async response(sourceId: SourceId, input: string, accept: string) {
    const url = officialUrl(input, sourceId)
    // Canonical endpoints require no redirects. Reject every redirect before following it.
    const response = await this.#http.get(
      url,
      {
        redirect: "error",
        headers: { accept },
        signal: AbortSignal.timeout(120_000)
      },
      { streamBody: true }
    )
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new Error(`Unexpected regulatory HTTP status ${response.status}`)
    }
    return response
  }

  async inventory(sourceId: SourceId, url: string): Promise<InventoryEvidence> {
    const response = await this.response(sourceId, url, "application/json")
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("json")) {
      await response.body?.cancel()
      throw new Error("Source inventory did not return JSON")
    }
    const bytes = await readBounded(response, 8 * 1024 * 1024)
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return {
      sourceId,
      url,
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      contentType,
      body,
      retrievedAt: new Date().toISOString()
    }
  }

  async retryDelay(attempt: number) {
    await setTimeout(Math.min(1000 * 2 ** attempt, 15_000))
  }
}
