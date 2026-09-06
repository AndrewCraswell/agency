import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { GovInfoCommitteeDirectoryClient } from "./committee-directory-client.js"

describe("GovInfoCommitteeDirectoryClient", () => {
  it("discovers historical editions modified after their Congress ended", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          nextPage: null,
          packages: [{ packageId: "CDIR-1997-06-04", lastModified: "2026-07-14T19:09:19Z" }]
        })
      )
    )
    const client = new GovInfoCommitteeDirectoryClient({
      apiKey: "test-key",
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })
    expect(await client.discover(105)).toHaveLength(1)
    expect(new URL(String(request.mock.calls[0]?.[0])).pathname).toBe("/collections/CDIR/1970-01-01T00:00:00Z")
  })
  it("discovers CDIR packages with header authentication and downloads bounded plain text", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = new URL(String(input))
      if (url.hostname === "api.govinfo.gov") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              nextPage: null,
              packages: [
                { lastModified: "2026-02-21T00:00:00Z", packageId: "CDIR-2026-02-20" },
                { lastModified: "2024-12-30T00:00:00Z", packageId: "CDIR-2024-12-30" }
              ]
            })
          )
        )
      }
      return Promise.resolve(new Response("STANDING COMMITTEES OF THE SENATE\nSTANDING COMMITTEES OF THE HOUSE"))
    })
    const client = new GovInfoCommitteeDirectoryClient({
      apiKey: "test-key",
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1_000 })
    })

    const packages = await client.discover(119)

    expect(packages).toHaveLength(1)
    expect(packages[0]).toMatchObject({ congress: 119, packageId: "CDIR-2026-02-20" })
    await expect(client.getText(packages[0]!)).resolves.toContain("STANDING COMMITTEES OF THE HOUSE")
    const apiCall = request.mock.calls[0]
    const contentCall = request.mock.calls[1]
    expect(new URL(String(apiCall?.[0])).searchParams.has("api_key")).toBe(false)
    expect(new URL(String(apiCall?.[0])).searchParams.get("congress")).toBe("119")
    expect(new Headers(apiCall?.[1]?.headers).get("X-Api-Key")).toBe("test-key")
    expect(String(contentCall?.[0])).toBe(
      "https://www.govinfo.gov/content/pkg/CDIR-2026-02-20/text/CDIR-2026-02-20.txt"
    )
  })

  it("rejects off-origin pagination", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ nextPage: "https://example.test/collections/CDIR/window?offsetMark=next", packages: [] })
        )
      )
    const client = new GovInfoCommitteeDirectoryClient({
      apiKey: "test-key",
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1_000 })
    })

    await expect(client.discover(119)).rejects.toThrow("invalid next-page URL")
  })

  it("rejects a PDF download URL outside the advertised package without forwarding credentials", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          download: { pdfLink: "https://example.test/private.pdf" }
        })
      )
    )
    const client = new GovInfoCommitteeDirectoryClient({
      apiKey: "test-key",
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })
    await expect(
      client.getRecords({
        congress: 118,
        issuedAt: new Date("2024-04-25"),
        lastModified: new Date("2026-07-14"),
        packageId: "CDIR-2024-04-25",
        sourceUrl: new URL("https://www.govinfo.gov/app/details/CDIR-2024-04-25"),
        textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2024-04-25/text/CDIR-2024-04-25.txt")
      })
    ).rejects.toThrow("escaped its package")
    expect(request).toHaveBeenCalledTimes(1)
  })
})
