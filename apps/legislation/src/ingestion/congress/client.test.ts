import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { CongressClient } from "./client.js"
import { compareCongressReferences } from "./sync.js"

describe("CongressClient", () => {
  it("paginates changed bills without exposing its API key", async () => {
    const progress: Array<{ next: boolean; offset: number; records: number }> = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      const offset = url.searchParams.get("offset")
      return Response.json({
        bills:
          offset === "0"
            ? [{ congress: 119, number: "2", type: "HR", updateDate: "2025-01-01", url: "https://x/2" }]
            : [{ congress: 119, number: "3", type: "HR", updateDate: "2025-01-02", url: "https://x/3" }],
        pagination: offset === "0" ? { next: "present" } : {}
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 }),
      onPage: (page) => progress.push(page),
      pageSize: 1
    })

    const bills = []
    for await (const bill of client.listUpdated(new Date("2025-01-01"), new Date("2025-02-01"))) {
      bills.push(bill.number)
    }

    expect(bills).toEqual(["2", "3"])
    expect(request).toHaveBeenCalledTimes(2)
    expect(progress).toEqual([
      { next: true, offset: 0, records: 1 },
      { next: false, offset: 1, records: 1 }
    ])
  })

  it("orders identical timestamps by canonical identity", () => {
    expect(
      compareCongressReferences(
        { congress: 119, number: "10", type: "HR", updateDate: "2025-01-01", url: "x" },
        { congress: 119, number: "2", type: "S", updateDate: "2025-01-01", url: "y" }
      )
    ).toBeLessThan(0)
  })

  it("paginates every bill child collection", async () => {
    const offsets: string[] = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      const offset = url.searchParams.get("offset") ?? "0"
      if (url.pathname.endsWith("/bill/119/hr/9")) {
        return Response.json({ bill: { congress: 119, number: "9", title: "Test", type: "HR" } })
      }
      offsets.push(`${url.pathname}:${offset}`)
      let key = url.pathname.split("/").at(-1) ?? "records"
      if (url.pathname.endsWith("/cosponsors")) {
        key = "members"
      } else if (url.pathname.endsWith("/relatedbills")) {
        key = "relatedBills"
      } else if (url.pathname.endsWith("/text")) {
        key = "textVersions"
      }
      return Response.json({
        [key]: offset === "0" ? [{ value: `${key}-first` }] : [{ value: `${key}-second` }],
        pagination: offset === "0" ? { next: "present" } : {}
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const bundle = (await client.getBillBundle({
      congress: 119,
      number: "9",
      type: "HR",
      url: "https://api.congress.gov/v3/bill/119/hr/9"
    })) as Record<string, unknown[]>

    expect(bundle.actions).toHaveLength(2)
    expect(bundle.committees).toHaveLength(2)
    expect(bundle.cosponsors).toHaveLength(2)
    expect(bundle.relatedBills).toHaveLength(2)
    expect(bundle.summaries).toHaveLength(2)
    expect(bundle.textVersions).toHaveLength(2)
    expect(offsets).toHaveLength(14)
  })
})
