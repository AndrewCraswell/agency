import { digest, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { expect, it } from "vitest"
import {
  GovInfoFrDiscoveryClient,
  initializeFrDiscoveryCursor,
  planFrDiscoveryPage,
  type GovInfoFrPage
} from "./fr-discovery.js"

const start = "2026-09-16T00:00:00.000Z"
const end = "2026-09-18T00:00:00.000Z"

function response(
  packages: { packageId: string; lastModified: string }[],
  options: { count?: number; nextOffsetMark?: string | null } = {}
): GovInfoFrPage {
  const body = JSON.stringify({
    count: options.count ?? packages.length,
    nextPage:
      options.nextOffsetMark === undefined || options.nextOffsetMark === null ? null : "https://api.govinfo.gov/next",
    packages: packages.map((item) => ({
      ...item,
      packageLink: `https://api.govinfo.gov/packages/${item.packageId}/summary`
    }))
  })
  return {
    evidence: {
      sourceId: "govinfo-fr",
      url: "https://api.govinfo.gov/collections/FR/window?offsetMark=*",
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      retrievedAt: "2026-09-18T00:01:00.000Z",
      contentType: "application/json",
      body
    },
    page: JSON.parse(body),
    nextOffsetMark: options.nextOffsetMark ?? null
  }
}

it("maps modified issues to immutable current acquisition units and advances pagination", () => {
  const cursor = initializeFrDiscoveryCursor({ committedCursor: null, bootstrapStart: start, through: end })
  const result = planFrDiscoveryPage(
    cursor,
    response(
      [
        { packageId: "FR-2000-01-18", lastModified: "2026-09-17T12:00:00Z" },
        { packageId: "FR-2026-09-17", lastModified: "2026-09-17T13:00:00Z" }
      ],
      { count: 102, nextOffsetMark: "next+page" }
    )
  )
  expect(result.split).toBe(false)
  expect(result.cursor.active).toEqual({ start, end, offsetMark: "next+page" })
  expect(result.units.map((unit) => unit.nativeId)).toEqual(["FR-2000-01-18", "FR-2026-09-17"])
  expect(result.units[0]).toMatchObject({
    edition: "2000-01-18",
    historical: false,
    issueDate: "2000-01-18",
    sourceModifiedText: "2026-09-17T12:00:00Z",
    sourceUrl: "https://www.govinfo.gov/bulkdata/FR/2000/01/FR-2000-01-18.xml"
  })
  expect(result.units[0]?.key).toBe(unitIdentity(result.units[0]!))
})

it("splits a saturated modified-time window before accepting packages", () => {
  const cursor = initializeFrDiscoveryCursor({ committedCursor: null, bootstrapStart: start, through: end })
  const result = planFrDiscoveryPage(cursor, response([], { count: 10_001 }))
  expect(result).toMatchObject({
    split: true,
    units: [],
    cursor: {
      active: { start, end: "2026-09-17T00:00:00.000Z", offsetMark: "*" },
      pending: [{ start: "2026-09-17T00:00:00.000Z", end }],
      latestWindowEnd: end
    }
  })
})

it("starts completed cycles with a 24-hour overlap and rejects changed active windows", () => {
  const complete = {
    contract: "govinfo-fr-modification-cursor-2026-09-18",
    active: null,
    pending: [],
    latestWindowEnd: "2026-09-17T00:00:00.000Z"
  }
  expect(
    initializeFrDiscoveryCursor({ committedCursor: complete, bootstrapStart: start, through: end }).active
  ).toEqual({
    start: "2026-09-16T00:00:00.000Z",
    end,
    offsetMark: "*"
  })
  const active = initializeFrDiscoveryCursor({ committedCursor: null, bootstrapStart: start, through: end })
  expect(() =>
    initializeFrDiscoveryCursor({ committedCursor: active, bootstrapStart: start, through: "2026-09-19T00:00:00.000Z" })
  ).toThrow("govinfo_fr_discovery_window_changed")
})

it("rejects duplicate and out-of-window packages", () => {
  const cursor = initializeFrDiscoveryCursor({ committedCursor: null, bootstrapStart: start, through: end })
  const duplicate = { packageId: "FR-2026-09-17", lastModified: "2026-09-17T12:00:00Z" }
  expect(() => planFrDiscoveryPage(cursor, response([duplicate, duplicate]))).toThrow("govinfo_fr_duplicate_package")
  expect(() =>
    planFrDiscoveryPage(cursor, response([{ packageId: "FR-2000-01-18", lastModified: "2026-09-15T23:59:59Z" }]))
  ).toThrow("govinfo_fr_package_outside_window")
})

it("requests one authenticated GovInfo page without putting the credential in its evidence", async () => {
  let request: { headers: Headers; url: URL } | undefined
  const client = new GovInfoFrDiscoveryClient({
    apiKey: "secret-key",
    fetch: async (input, init) => {
      request = { headers: new Headers(init?.headers), url: new URL(String(input)) }
      return new Response(
        JSON.stringify({
          count: 101,
          nextPage:
            "https://api.govinfo.gov/collections/FR/2026-09-16T00:00:00Z/2026-09-18T00:00:00Z?offsetMark=opaque%2Bcursor&pageSize=100",
          packages: [
            {
              packageId: "FR-2026-09-17",
              lastModified: "2026-09-17T12:00:00Z",
              packageLink: "https://api.govinfo.gov/packages/FR-2026-09-17/summary"
            }
          ]
        }),
        { headers: { "content-type": "application/json" } }
      )
    }
  })
  const result = await client.fetchPage({ start, end }, "*")
  expect(request?.url.href).toBe(
    "https://api.govinfo.gov/collections/FR/2026-09-16T00:00:00Z/2026-09-18T00:00:00Z?offsetMark=*&pageSize=100"
  )
  expect(request?.headers.get("X-Api-Key")).toBe("secret-key")
  expect(result.evidence.url).not.toContain("secret-key")
  expect(result.nextOffsetMark).toBe("opaque+cursor")
})

it("rejects a pagination link that escapes the fixed GovInfo collection window", async () => {
  const client = new GovInfoFrDiscoveryClient({
    apiKey: "secret-key",
    fetch: async () =>
      new Response(
        JSON.stringify({
          count: 101,
          nextPage: "https://example.test/collections/FR/window?offsetMark=leak",
          packages: []
        }),
        { headers: { "content-type": "application/json" } }
      )
  })
  await expect(client.fetchPage({ start, end }, "*")).rejects.toThrow(
    "GovInfo FR discovery returned an invalid next-page URL"
  )
})
