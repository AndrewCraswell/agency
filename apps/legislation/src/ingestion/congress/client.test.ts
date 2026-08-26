import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { CongressClient } from "./client.js"
import { compareCongressReferences } from "./sync.js"

describe("CongressClient", () => {
  it("paginates changed bills without exposing its API key", async () => {
    const progress: Array<{ next: boolean; offset: number; records: number }> = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      expect(url.searchParams.get("fromDateTime")).toBe("2025-01-01T00:00:00Z")
      expect(url.searchParams.get("toDateTime")).toBe("2025-02-01T00:00:00Z")
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

  it("loads the documented member detail resource", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      expect(url.pathname).toBe("/v3/member/G000607")
      expect(url.searchParams.get("api_key")).toBe("secret-key")
      return Response.json({ member: { bioguideId: "G000607", currentMember: true } })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    await expect(client.getMember("G000607")).resolves.toEqual({ bioguideId: "G000607", currentMember: true })
    expect(request).toHaveBeenCalledOnce()
  })

  it("includes prior members on every paginated Congress member request", async () => {
    const requests: URL[] = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      requests.push(url)
      const offset = url.searchParams.get("offset")
      return Response.json({
        members: [{ bioguideId: offset === "0" ? "A000001" : "B000002" }],
        pagination: offset === "0" ? { next: "present" } : {}
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const pages = []
    for await (const page of client.members(119)) {
      pages.push(page)
    }

    expect(pages).toHaveLength(2)
    expect(requests).toHaveLength(2)
    expect(
      requests.every(
        (url) => url.pathname === "/v3/member/congress/119" && url.searchParams.get("currentMember") === "false"
      )
    ).toBe(true)
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
    expect(bundle.bill).toMatchObject({ url: "https://api.congress.gov/v3/bill/119/hr/9" })
    expect(bundle.committees).toHaveLength(2)
    expect(bundle.cosponsors).toHaveLength(2)
    expect(bundle.relatedBills).toHaveLength(2)
    expect(bundle.summaries).toHaveLength(2)
    expect(bundle.textVersions).toHaveLength(2)
    expect(offsets).toHaveLength(14)
  })

  it("skips empty amendment subcollections advertised by the detail record", async () => {
    const paths: string[] = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      paths.push(url.pathname)
      return Response.json({
        amendment: {
          actions: { count: 0 },
          congress: 119,
          number: "1",
          textVersions: { count: 0 },
          type: "SAMDT"
        }
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const bundle = (await client.getAmendmentBundle({
      congress: 119,
      number: "1",
      type: "SAMDT",
      url: "https://api.congress.gov/v3/amendment/119/samdt/1"
    })) as Record<string, unknown[]>

    expect(paths).toEqual(["/v3/amendment/119/samdt/1"])
    expect(bundle.actions).toEqual([])
    expect(bundle.textVersions).toEqual([])
  })

  it("loads committee report detail and every published text format", async () => {
    const paths: string[] = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      paths.push(url.pathname)
      if (url.pathname.endsWith("/text")) {
        return Response.json({
          pagination: { count: 1 },
          text: [{ formats: [{ type: "PDF", url: "https://congress.gov/report.pdf" }] }]
        })
      }
      return Response.json({
        committeeReports: [
          {
            congress: 119,
            number: 1,
            part: 1,
            text: { count: 1 },
            title: "Test report",
            type: "HRPT"
          }
        ]
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const bundle = (await client.getCommitteeReportBundle({
      chamber: "House",
      citation: "H. Rept. 119-1",
      cmte_rpt_id: "289187",
      congress: 119,
      number: "1",
      part: "1",
      type: "HRPT",
      url: "https://api.congress.gov/v3/committee-report/119/HRPT/1"
    })) as Record<string, unknown>

    expect(paths).toEqual(["/v3/committee-report/119/hrpt/1", "/v3/committee-report/119/hrpt/1/text"])
    expect(bundle.text).toEqual([{ formats: [{ type: "PDF", url: "https://congress.gov/report.pdf" }] }])
  })

  it("loads every House vote member page and verifies the advertised count", async () => {
    const offsets: string[] = []
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      if (!url.pathname.endsWith("/members")) {
        return Response.json({ houseRollCallVote: { startDate: "2025-01-01", voteQuestion: "On Passage" } })
      }
      const offset = url.searchParams.get("offset") ?? "0"
      offsets.push(offset)
      return Response.json({
        houseRollCallVoteMemberVotes: {
          results:
            offset === "0"
              ? [{ bioguideID: "A000001", lastName: "First", voteCast: "Yea" }]
              : [{ bioguideID: "B000002", lastName: "Second", voteCast: "Nay" }],
          votePartyTotal: [{ party: "All", yea: 1, nay: 1 }]
        },
        pagination: offset === "0" ? { count: 2, next: "present" } : { count: 2 }
      })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const bundle = (await client.getHouseVoteBundle({
      congress: 119,
      identifier: "11912025240",
      rollCallNumber: 240,
      sessionNumber: 1,
      sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
      url: "https://api.congress.gov/v3/house-vote/119/1/240"
    })) as { members: { results: unknown[]; votePartyTotal: unknown[] } }

    expect(offsets).toEqual(["0", "1"])
    expect(bundle.members.results).toHaveLength(2)
    expect(bundle.members.votePartyTotal).toHaveLength(1)
  })

  it("rejects an incomplete House vote member collection", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      return url.pathname.endsWith("/members")
        ? Response.json({
            houseRollCallVoteMemberVotes: { results: [{ bioguideID: "A000001" }] },
            pagination: { count: 2 }
          })
        : Response.json({ houseRollCallVote: {} })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    await expect(
      client.getHouseVoteBundle({
        congress: 119,
        identifier: "11912025240",
        rollCallNumber: 240,
        sessionNumber: 1,
        sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/240"
      })
    ).rejects.toThrow("expected 2, received 1")
  })

  it("accepts House vote member pages returned as a bare array", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input))
      return url.pathname.endsWith("/members")
        ? Response.json({
            houseRollCallVoteMemberVotes: [{ bioguideID: "A000001", lastName: "First", voteCast: "Yea" }],
            pagination: { count: 1 }
          })
        : Response.json({ houseRollCallVote: { startDate: "2025-01-01", voteQuestion: "On Passage" } })
    })
    const client = new CongressClient({
      apiKey: "secret-key",
      baseUrl: new URL("https://api.congress.gov/v3/"),
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })

    const bundle = (await client.getHouseVoteBundle({
      congress: 119,
      identifier: "11912025240",
      rollCallNumber: 240,
      sessionNumber: 1,
      sourceDataURL: "https://clerk.house.gov/evs/2025/roll240.xml",
      url: "https://api.congress.gov/v3/house-vote/119/1/240"
    })) as { members: { results: unknown[] } }

    expect(bundle.members.results).toHaveLength(1)
  })
})
