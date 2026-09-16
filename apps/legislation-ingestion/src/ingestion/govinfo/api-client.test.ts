import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { GovInfoApiClient } from "./api-client.js"

const from = new Date("2026-08-17T12:00:00.000Z")
const through = new Date("2026-08-18T12:00:00.000Z")

describe("GovInfoApiClient", () => {
  it("follows offsetMark pagination and maps API discovery to bulk XML payloads", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((input, init) => {
      const url = new URL(String(input))
      expect(url.searchParams.has("api_key")).toBe(false)
      expect(new Headers(init?.headers).get("X-Api-Key")).toBe("govinfo-key")
      const offsetMark = url.searchParams.get("offsetMark")
      if (offsetMark === "*") {
        return Promise.resolve(
          jsonResponse({
            count: 3,
            nextPage:
              "https://api.govinfo.gov/collections/BILLSTATUS/2026-08-17T12:00:00Z/2026-08-18T12:00:00Z?offsetMark=cursor%2Btwo&pageSize=2&congress=119",
            packages: [
              { lastModified: "2026-08-18T08:00:00Z", packageId: "BILLSTATUS-119hr2" },
              { lastModified: "2026-08-18T07:00:00Z", packageId: "BILLSTATUS-118hr1" }
            ]
          })
        )
      }
      expect(offsetMark).toBe("cursor+two")
      return Promise.resolve(
        jsonResponse({
          count: 3,
          nextPage: null,
          packages: [
            { lastModified: "2026-08-18T09:00:00Z", packageId: "BILLSTATUS-119s3" },
            { lastModified: "2026-08-18T10:00:00Z", packageId: "BILLSTATUS-119hres4" }
          ]
        })
      )
    })
    const client = createClient(request, { pageSize: 2 })

    const packages = await client.discoverModified(119, ["hr", "s"], from, through)

    expect(packages).toMatchObject([
      {
        billType: "hr",
        packageId: "BILLSTATUS-119hr2",
        url: new URL("https://www.govinfo.gov/bulkdata/BILLSTATUS/119/hr/BILLSTATUS-119hr2.xml")
      },
      {
        billType: "s",
        packageId: "BILLSTATUS-119s3",
        url: new URL("https://www.govinfo.gov/bulkdata/BILLSTATUS/119/s/BILLSTATUS-119s3.xml")
      }
    ])
    expect(String(request.mock.calls[0]?.[0])).toContain(
      "/collections/BILLSTATUS/2026-08-17T12:00:00Z/2026-08-18T12:00:00Z"
    )
    expect(request).toHaveBeenCalledTimes(2)
  })

  it("fails closed when the provider still has another page at the traversal limit", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        count: 2,
        nextPage:
          "https://api.govinfo.gov/collections/BILLSTATUS/2026-08-17T12:00:00Z/2026-08-18T12:00:00Z?offsetMark=more&pageSize=1&congress=119",
        packages: [{ lastModified: "2026-08-18T08:00:00Z", packageId: "BILLSTATUS-119hr2" }]
      })
    )
    const client = createClient(request, { maximumPages: 1, pageSize: 1 })

    await expect(client.discoverModified(119, ["hr"], from, through)).rejects.toThrow("page safety limit")
  })

  it("rejects repeated or off-origin provider pagination cursors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        count: 2,
        nextPage: "https://example.test/collections/BILLSTATUS/window?offsetMark=next",
        packages: []
      })
    )

    await expect(createClient(request).discoverModified(119, ["hr"], from, through)).rejects.toThrow(
      "invalid next-page URL"
    )
  })
})

function createClient(
  request: typeof fetch,
  options: Readonly<{ maximumPages?: number; pageSize?: number }> = {}
): GovInfoApiClient {
  return new GovInfoApiClient({
    apiKey: "govinfo-key",
    http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1_000 }),
    ...options
  })
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
}
