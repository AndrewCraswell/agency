import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { getGovInfoCommitteeMemberAliases } from "./committee-member-aliases.js"

const packageId = "CDIR-2022-10-26"
const granuleId = `${packageId}-FL-H-15`
const base = `https://api.govinfo.gov/packages/${packageId}/granules`
const granule = { granuleId, granuleLink: `${base}/${granuleId}/summary` }
const summary = {
  packageId,
  granuleId,
  members: [
    {
      congress: "117",
      chamber: "H",
      state: "FL",
      bioGuideId: "F000472",
      name: [{ parsed: "C. SCOTT FRANKLIN", "authority-fnf": "Scott Franklin" }]
    }
  ]
}

function harness(responses: unknown[]) {
  const request = vi.fn<typeof fetch>()
  for (const response of responses) {
    request.mockResolvedValueOnce(new Response(JSON.stringify(response)))
  }
  const run = () =>
    getGovInfoCommitteeMemberAliases({
      apiKey: "test-key",
      congress: 117,
      packageId,
      candidates: [{ state: "FL", chamber: "lower" }],
      http: new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 })
    })
  return { request, run }
}

describe("same-directory committee member aliases", () => {
  it("emits no aliases for an unlinked member alongside explicitly identified members", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      {
        ...summary,
        members: [
          { congress: "117", chamber: "H", state: "FL", name: [{ parsed: "Unlinked Person" }] },
          ...summary.members
        ]
      }
    ])
    const aliases = await run()
    expect(aliases.map((alias) => alias.name)).toEqual(["C. SCOTT FRANKLIN", "Scott Franklin"])
    expect(aliases.every((alias) => alias.personId === "person:congress:f000472")).toBe(true)
  })

  it("still validates scope for unlinked members", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      { ...summary, members: [{ congress: "116", chamber: "H", state: "FL", name: [{ parsed: "Unlinked Person" }] }] }
    ])
    await expect(run()).rejects.toThrow("differs from its requested scope")
  })

  it("rejects a malformed provided BioGuide ID", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      { ...summary, members: [{ ...summary.members[0], bioGuideId: "not-an-id" }] }
    ])
    await expect(run()).rejects.toThrow(/bioGuideId/)
  })

  it("flattens exact source name arrays and deduplicates repeated values", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      {
        ...summary,
        members: [
          {
            ...summary.members[0],
            name: [{ parsed: "C. SCOTT FRANKLIN", "authority-other": ["C. SCOTT FRANKLIN", "Scott Franklin", ""] }]
          }
        ]
      }
    ])
    expect(await run()).toEqual([
      { name: "C. SCOTT FRANKLIN", personId: "person:congress:f000472", state: "FL", chamber: "lower" },
      { name: "Scott Franklin", personId: "person:congress:f000472", state: "FL", chamber: "lower" }
    ])
  })

  it("rejects non-string values inside a source name array", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      { ...summary, members: [{ ...summary.members[0], name: [{ "authority-other": ["Scott Franklin", 42] }] }] }
    ])
    await expect(run()).rejects.toThrow(/authority-other/)
  })

  it("exhausts advertised pages and returns exact names linked to explicit IDs only", async () => {
    const { request, run } = harness([
      {
        nextPage: `${base}?offsetMark=next`,
        granules: [
          { granuleId: `${packageId}-PA-S-2`, granuleLink: "https://unused.test" },
          { granuleId: `${packageId}-FL`, granuleLink: "https://unused.test" }
        ]
      },
      {
        nextPage: null,
        granules: [granule, granule, { granuleId: "CDIR-2020-07-22-CA-H-15", granuleLink: "https://unused.test" }]
      },
      summary
    ])
    expect(await run()).toEqual([
      { name: "C. SCOTT FRANKLIN", personId: "person:congress:f000472", state: "FL", chamber: "lower" },
      { name: "Scott Franklin", personId: "person:congress:f000472", state: "FL", chamber: "lower" }
    ])
    expect(request).toHaveBeenCalledTimes(3)
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("X-Api-Key")).toBe("test-key")
  })

  it("accepts an advertised granule with a different date prefix under the same package", async () => {
    const advertisedId = "CDIR-2022-10-29-FL-H-15"
    const { request, run } = harness([
      { nextPage: null, granules: [{ granuleId: advertisedId, granuleLink: `${base}/${advertisedId}/summary` }] },
      { ...summary, granuleId: advertisedId }
    ])
    expect(await run()).toHaveLength(2)
    expect(String(request.mock.calls[1]?.[0])).toBe(`${base}/${advertisedId}/summary`)
  })

  it.each([{ congress: "116" }, { chamber: "S" }, { state: "PA" }])(
    "rejects inconsistent member scope %j",
    async (mismatch) => {
      const { run } = harness([
        { nextPage: null, granules: [granule] },
        { ...summary, members: [{ ...summary.members[0], ...mismatch }] }
      ])
      await expect(run()).rejects.toThrow("differs from its requested scope")
    }
  )

  it.each(["https://evil.test/leak", `${base}-other?offsetMark=next`])(
    "rejects escaped pagination %s before forwarding credentials",
    async (nextPage) => {
      const { request, run } = harness([{ nextPage, granules: [] }])
      await expect(run()).rejects.toThrow("escaped its package")
      expect(request).toHaveBeenCalledOnce()
    }
  )

  it("rejects a summary link pointing to a different package", async () => {
    const { request, run } = harness([
      {
        nextPage: null,
        granules: [{ ...granule, granuleLink: "https://api.govinfo.gov/packages/other/granules/other/summary" }]
      }
    ])
    await expect(run()).rejects.toThrow("escaped its package")
    expect(request).toHaveBeenCalledOnce()
  })

  it("rejects mismatched advertised and returned identities", async () => {
    const { run } = harness([
      { nextPage: null, granules: [granule] },
      { ...summary, granuleId: `${packageId}-FL-H-16` }
    ])
    await expect(run()).rejects.toThrow("identity differs")
  })

  it("rejects repeated pagination", async () => {
    const { request, run } = harness([{ nextPage: `${base}?offsetMark=*&pageSize=1000`, granules: [] }])
    await expect(run()).rejects.toThrow("pagination did not terminate")
    expect(request).toHaveBeenCalledOnce()
  })

  it("caps individual summary requests before fetching any of them", async () => {
    const { request, run } = harness([
      {
        nextPage: null,
        granules: Array.from({ length: 601 }, (_, index) => ({
          granuleId: `${packageId}-FL-H-${index}`,
          granuleLink: `${base}/${packageId}-FL-H-${index}/summary`
        }))
      }
    ])
    await expect(run()).rejects.toThrow("exceeds 600 individual summaries")
    expect(request).toHaveBeenCalledOnce()
  })
})
