import { setTimeout } from "node:timers/promises"
import {
  digest,
  officialUrl,
  type InventoryEvidence,
  type AcquisitionUnit
} from "@repo/legislation-core/legal-text/contracts"
import { RetryingHttpClient, readBounded, type HttpRequestTelemetry } from "../http-client.js"

type SourceId = AcquisitionUnit["sourceId"]

/** Local acquisition client. Cross-worker budgets must be supplied before Trigger use. */
export class RegulatorySourceClient {
  readonly #http: RetryingHttpClient
  readonly #requestTimeoutMs: number
  constructor(
    options: {
      afterAttemptComplete?: (telemetry: HttpRequestTelemetry) => Promise<void>
      fetch?: typeof fetch
      beforeAttempt?: () => Promise<void>
      minimumIntervalMs?: number
      requestTimeoutMs?: number
    } = {}
  ) {
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10 * 60_000
    this.#http = new RetryingHttpClient({
      afterAttemptComplete: options.afterAttemptComplete,
      fetch: options.fetch,
      beforeAttempt: options.beforeAttempt,
      minimumIntervalMs: options.minimumIntervalMs ?? 500,
      maxAttempts: 1,
      requestTimeoutMs: this.#requestTimeoutMs
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
        signal: AbortSignal.timeout(this.#requestTimeoutMs)
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
