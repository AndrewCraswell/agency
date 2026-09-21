import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { SenateClient } from "./client.js"

const menu = `<?xml version="1.0"?><vote_summary><congress>119</congress><session>1</session><votes>
  <vote><vote_number>00002</vote_number></vote><vote><vote_number>00001</vote_number></vote>
</votes></vote_summary>`
const directory = `<?xml version="1.0"?><senators>
  <senator lis_member_id="S229"><bioguideId>M001111</bioguideId></senator>
</senators>`

describe("Senate client", () => {
  it("discovers ordered official vote URLs and maps LIS IDs to Bioguide IDs", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith("vote_menu_119_1.xml")) {
        return new Response(menu, { headers: { "content-type": "text/xml" } })
      }
      if (url.endsWith("cvc_member_data.xml")) {
        return new Response(directory, { headers: { "content-type": "text/xml" } })
      }
      return new Response("missing", { status: 404 })
    })
    const client = new SenateClient({
      baseUrl: new URL("https://www.senate.gov/"),
      http: new RetryingHttpClient({ fetch: fetcher, maxAttempts: 1, requestTimeoutMs: 1_000 })
    })

    const votes = await client.listVotes(119, 1)
    const identifiers = await client.getMemberIdentifiers()

    expect(votes.value).toEqual([
      {
        congress: 119,
        session: 1,
        sourceUrl: "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00001.xml",
        voteNumber: 1
      },
      {
        congress: 119,
        session: 1,
        sourceUrl: "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00002.xml",
        voteNumber: 2
      }
    ])
    expect(identifiers.value.get("S229")).toBe("M001111")
  })

  it("rejects a vote menu for a different Congress or session", async () => {
    const client = new SenateClient({
      baseUrl: new URL("https://www.senate.gov/"),
      http: new RetryingHttpClient({
        fetch: async () => new Response(menu.replace("<congress>119</congress>", "<congress>118</congress>")),
        maxAttempts: 1,
        requestTimeoutMs: 1_000
      })
    })

    await expect(client.listVotes(119, 1)).rejects.toThrow("identity mismatch")
  })

  it("treats the Senate HTML not-found page as an unpublished session", async () => {
    const client = new SenateClient({
      baseUrl: new URL("https://www.senate.gov/"),
      http: new RetryingHttpClient({
        fetch: async () => new Response("<html><title>File not found</title></html>"),
        maxAttempts: 1,
        requestTimeoutMs: 1_000
      })
    })

    await expect(client.listVotes(120, 1)).resolves.toMatchObject({ value: [] })
  })

  it("rejects an HTML response for an expected vote detail", async () => {
    const client = new SenateClient({
      baseUrl: new URL("https://www.senate.gov/"),
      http: new RetryingHttpClient({
        fetch: async () => new Response("<html><title>File not found</title></html>"),
        maxAttempts: 1,
        requestTimeoutMs: 1_000
      })
    })

    await expect(
      client.getVote({
        congress: 119,
        session: 1,
        sourceUrl: "https://www.senate.gov/missing.xml",
        voteNumber: 999
      })
    ).rejects.toThrow("is not published")
  })
})
