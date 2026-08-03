import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { ADMIN_API_VERSION, createTokenClient } from "./client.ts"

const client = createTokenClient({ store: "fencing.myshopify.com", token: "shpat_secret" })
const schema = z.object({ shop: z.object({ name: z.string() }) })
const ask = () => client({ query: "{ shop { name } }", schema })

const respond = (body: unknown, init: ResponseInit = {}) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createTokenClient", () => {
  it("posts to the pinned API version and returns the parsed data", async () => {
    const fetched = respond({ data: { shop: { name: "Fencing Club" } } })

    expect(await ask()).toEqual({ shop: { name: "Fencing Club" } })
    expect(fetched.mock.calls[0]![0]).toBe(`https://fencing.myshopify.com/admin/api/${ADMIN_API_VERSION}/graphql.json`)
  })

  it("sends the token as a header rather than in the body", async () => {
    const fetched = respond({ data: { shop: { name: "Fencing Club" } } })
    await ask()

    const init = fetched.mock.calls[0]![1]!
    expect(new Headers(init.headers).get("X-Shopify-Access-Token")).toBe("shpat_secret")
    expect(String(init.body)).not.toContain("shpat_secret")
  })

  it("tells a rejected token apart from a failed request, and names the fix", async () => {
    respond({}, { status: 403, statusText: "Forbidden" })

    await expect(ask()).rejects.toThrow(/rejected the token/)
  })

  it("reports any other failing status by what the server said", async () => {
    respond({}, { status: 503, statusText: "Service Unavailable" })

    await expect(ask()).rejects.toThrow("fencing.myshopify.com returned 503 Service Unavailable")
  })

  it("treats GraphQL errors as failures, though they arrive with a 200", async () => {
    respond({ data: null, errors: [{ message: "Field 'nope' doesn't exist" }, { message: "and again" }] })

    await expect(ask()).rejects.toThrow(/rejected the query: Field 'nope' doesn't exist; and again/)
  })

  it("keeps no secret in the message a failure gets pasted into", async () => {
    respond({ errors: ["throttled"] })

    const failure = await ask().catch((error: unknown) => error)
    expect(String(failure)).toContain("throttled")
    expect(String(failure)).not.toContain("shpat_secret")
  })

  it("fails on a response the schema does not match, rather than passing it on", async () => {
    respond({ data: { shop: { name: 42 } } })

    await expect(ask()).rejects.toThrow(z.ZodError)
  })

  it("fails on a body with no data at all", async () => {
    respond({ extensions: {} })

    await expect(ask()).rejects.toThrow(z.ZodError)
  })
})
