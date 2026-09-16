import { zipSync } from "fflate"
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

  it("discovers and reads packages from the official aggregate archive fallback", async () => {
    const archive = zipSync({
      "BILLSTATUS-119hjres1.xml": new TextEncoder().encode("<billStatus>one</billStatus>"),
      "BILLSTATUS-119hjres2.xml": new TextEncoder().encode("<billStatus>two</billStatus>")
    })
    const request = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith("/hjres/")) {
        return Promise.resolve(new Response("<html>No package links</html>"))
      }
      if (url.endsWith("BILLSTATUS-119-hjres.zip")) {
        return Promise.resolve(new Response(archive))
      }
      throw new Error(`Unexpected URL ${url}`)
    })
    const client = new GovInfoClient(new RetryingHttpClient({ fetch: request, maxAttempts: 1, requestTimeoutMs: 1000 }))

    const packages = await client.discover([119], ["hjres"])
    const first = packages[0]
    const second = packages[1]

    expect(packages.map((item) => item.packageId)).toEqual(["BILLSTATUS-119hjres1", "BILLSTATUS-119hjres2"])
    const [firstXml, secondXml] = await Promise.all([
      first === undefined ? undefined : client.getBillStatus(first),
      second === undefined ? undefined : client.getBillStatus(second)
    ])
    expect(firstXml).toBe("<billStatus>one</billStatus>")
    expect(secondXml).toBe("<billStatus>two</billStatus>")
    expect(request).toHaveBeenCalledTimes(3)
  })
})
