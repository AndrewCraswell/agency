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
        granules: [granule, granule, { granuleId: "CDIR-2020-07-22-FL-H-15", granuleLink: "https://unused.test" }]
      },
      summary
    ])
    expect(await run()).toEqual([
      { name: "C. SCOTT FRANKLIN", personId: "person:congress:f000472" },
      { name: "Scott Franklin", personId: "person:congress:f000472" }
    ])
    expect(request).toHaveBeenCalledTimes(3)
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get("X-Api-Key")).toBe("test-key")
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
        granules: Array.from({ length: 201 }, (_, index) => ({
          granuleId: `${packageId}-FL-H-${index}`,
          granuleLink: `${base}/${packageId}-FL-H-${index}/summary`
        }))
      }
    ])
    await expect(run()).rejects.toThrow("exceeds 200 individual summaries")
    expect(request).toHaveBeenCalledOnce()
  })
})
