import { describe, expect, it, vi } from "vitest"
import { RetryingHttpClient } from "../http-client.js"
import { GovInfoClient } from "./client.js"

describe("GovInfoClient", () => {
  it("discovers unique official BILLSTATUS XML packages", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`
        <a href="BILLSTATUS-119-hr1.xml">one</a>
        <a href="BILLSTATUS-119-hr1.xml">duplicate</a>
        <a href="BILLSTATUS-119-hr2.xml">two</a>
      `)
    )
    const client = new GovInfoClient(new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 }))

    const packages = await client.discover([119], ["hr"])

    expect(packages.map((item) => item.packageId)).toEqual(["BILLSTATUS-119-hr1", "BILLSTATUS-119-hr2"])
    expect(packages.every((item) => item.url.protocol === "https:")).toBe(true)
  })
})
