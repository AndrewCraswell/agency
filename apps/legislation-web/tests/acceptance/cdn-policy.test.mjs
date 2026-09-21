import { describe, expect, it } from "vitest"
import { assertPrivateNoStore, findStaticAsset } from "../../scripts/smoke-cdn.mjs"

describe("CDN policy smoke", () => {
  it("requires private and no-store on sensitive responses", () => {
    expect(() =>
      assertPrivateNoStore(
        new Response(null, { headers: { "cache-control": "private, no-store", "x-cache": "DYNAMIC" } }),
        "/chat",
        true
      )
    ).not.toThrow()
    expect(() =>
      assertPrivateNoStore(new Response(null, { headers: { "cache-control": "no-store" } }), "/chat", false)
    ).toThrow("private, no-store")
    expect(() =>
      assertPrivateNoStore(
        new Response(null, { headers: { "cache-control": "private, no-store", "x-cache": "HIT" } }),
        "/chat",
        true
      )
    ).toThrow("bypass shared caching")
  })

  it("finds a fingerprinted Next.js asset in rendered HTML", () => {
    expect(findStaticAsset('<link href="/_next/static/chunks/app-abc123.css" rel="stylesheet">')).toBe(
      "/_next/static/chunks/app-abc123.css"
    )
    expect(findStaticAsset("<main>No assets</main>")).toBeNull()
  })
})
