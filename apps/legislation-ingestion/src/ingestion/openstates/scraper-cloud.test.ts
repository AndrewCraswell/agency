import { describe, expect, it, vi } from "vitest"
import type { ArtifactStore } from "../documents/artifact-store.js"
import {
  alaskaEventCloudRequest,
  billCloudRequest,
  dispatchCloudScraperAttempt,
  northCarolinaEventCloudRequest,
  scraperCloudPaths
} from "./scraper-cloud.js"
import { ScraperWorkerStopUnconfirmedError } from "./scraper-worker-error.js"

vi.mock("@azure/identity", () => {
  throw new Error("Injected scraper credentials must not load the default credential chain")
})

class Store implements ArtifactStore {
  readonly values = new Map<string, Uint8Array>()
  async exists(path: string) {
    return this.values.has(path)
  }
  async put(path: string, bytes: Uint8Array) {
    if (this.values.has(path)) return false
    this.values.set(path, bytes)
    return true
  }
  async read(path: string) {
    const value = this.values.get(path)
    if (!value) throw new Error("missing")
    return value
  }
}

const request = () => alaskaEventCloudRequest(["H:L&C:2025-01-22T13:30:00-09:00"])
const credential = { getToken: vi.fn(async () => ({ token: "token" })) }

describe("cloud scraper dispatch", () => {
  it("enqueues one strict extraction request and accepts matching settlement", async () => {
    const store = new Store()
    const paths = scraperCloudPaths("run-1", request())
    await store.put(paths.manifestPath, new Uint8Array([1]))
    await store.put(
      paths.settlementPath,
      Buffer.from(JSON.stringify({ runId: "run-1", manifestPath: paths.manifestPath, queueMessageDeleted: true }))
    )
    const requestFetch = vi.fn<typeof fetch>(async () => new Response(null, { status: 201 }))
    await expect(
      dispatchCloudScraperAttempt(
        {
          store,
          runId: "run-1",
          request: request(),
          storageAccount: "legislationtest",
          queueName: "openstates-scraper-dispatch"
        },
        { credential, fetch: requestFetch }
      )
    ).resolves.toEqual(paths)
    const [, init] = requestFetch.mock.calls[0]!
    expect(init?.method).toBe("POST")
    expect(init?.body).not.toContain("token")
    const encoded = String(init?.body).match(/<MessageText>([^<]+)<\/MessageText>/)?.[1]
    expect(JSON.parse(Buffer.from(encoded!, "base64").toString("utf8"))).toEqual({
      run_id: "run-1",
      request: request()
    })
  })

  it("preserves confirmed-release ownership when settlement never appears", async () => {
    let clock = 0
    await expect(
      dispatchCloudScraperAttempt(
        {
          store: new Store(),
          runId: "run-timeout",
          request: request(),
          storageAccount: "legislationtest",
          queueName: "openstates-scraper-dispatch",
          maxWaitSeconds: 1
        },
        {
          credential,
          fetch: vi.fn<typeof fetch>(async () => new Response(null, { status: 201 })),
          sleep: async () => {
            clock += 1001
          },
          now: () => clock
        }
      )
    ).rejects.toBeInstanceOf(ScraperWorkerStopUnconfirmedError)
  })

  it("rejects malformed scopes before sending a queue message", async () => {
    const requestFetch = vi.fn()
    await expect(
      dispatchCloudScraperAttempt(
        {
          store: new Store(),
          runId: "run-1",
          request: { ...request(), jurisdiction: "nc" },
          storageAccount: "legislationtest",
          queueName: "openstates-scraper-dispatch"
        },
        { credential, fetch: requestFetch }
      )
    ).rejects.toThrow("Unsupported cloud scraper request")
    expect(requestFetch).not.toHaveBeenCalled()
  })

  it("allows only the current-calendar North Carolina event lane", () => {
    expect(northCarolinaEventCloudRequest()).toEqual({
      jurisdiction: "nc",
      domain: "events",
      session: null,
      timeout_seconds: 1500,
      revision: "d43f853796ceeeb49205f7d144790647764ce105",
      bill_ids: null
    })
    expect(() => scraperCloudPaths("run-1", { ...northCarolinaEventCloudRequest(), session: "2025" })).toThrow(
      "Unsupported cloud scraper request"
    )
  })

  it("accepts only exact same-chamber bill batches for the two activated sessions", () => {
    expect(billCloudRequest("ak", ["HB1", "HB2"])).toMatchObject({
      jurisdiction: "ak",
      domain: "bills",
      session: "34",
      bill_ids: ["HB1", "HB2"]
    })
    expect(billCloudRequest("nc", ["S1", "S2"])).toMatchObject({
      jurisdiction: "nc",
      domain: "bills",
      session: "2025",
      bill_ids: ["S1", "S2"]
    })
    expect(() => billCloudRequest("ak", ["HB1", "SB1"])).toThrow("Unsupported cloud scraper request")
    expect(() => billCloudRequest("nc", ["HB1"])).toThrow("Unsupported cloud scraper request")
    expect(() => billCloudRequest("nc", ["H1", "H1"])).toThrow("Unsupported cloud scraper request")
  })
})
