import { once } from "node:events"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDocumentRelayServer } from "./relay-server.js"

describe("approved source document relay", () => {
  const sourceUrl = "https://www.palegis.us/legislation/bills/text/HTM/2025/0/HB0001/PN0001"
  const download = vi.fn(async (url: string) => ({
    bytes: Buffer.from("official document"),
    contentType: "text/plain",
    sourceUrl: url
  }))
  const server = createDocumentRelayServer({ token: "relay-test", fetch: download })
  let origin = ""
  beforeAll(async () => {
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Missing relay address")
    origin = `http://127.0.0.1:${address.port}`
  })
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  })

  it("keeps liveness independent of document sources", async () => {
    const response = await fetch(`${origin}/health`)
    expect(await response.json()).toEqual({ status: "ok" })
    expect(download).not.toHaveBeenCalled()
  })
  it("rejects missing authentication and unapproved sources before fetching", async () => {
    const missing = await fetch(`${origin}/internal/document-fetch`, {
      method: "POST",
      body: JSON.stringify({ sourceUrl })
    })
    expect(missing.status).toBe(401)
    const denied = await fetch(`${origin}/internal/document-fetch`, {
      method: "POST",
      headers: { authorization: "Bearer relay-test" },
      body: JSON.stringify({ sourceUrl: "https://example.test/private" })
    })
    expect(denied.status).toBe(400)
    expect(download).not.toHaveBeenCalled()
  })
  it("bounds request bodies", async () => {
    const response = await fetch(`${origin}/internal/document-fetch`, {
      method: "POST",
      headers: { authorization: "Bearer relay-test" },
      body: "x".repeat(4097)
    })
    expect(response.status).toBe(413)
  })
  it("returns only approved documents and does not expose API or MCP", async () => {
    const response = await fetch(`${origin}/internal/document-fetch`, {
      method: "POST",
      headers: { authorization: "Bearer relay-test" },
      body: JSON.stringify({ sourceUrl })
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("x-legislation-relayed-source")).toBe(sourceUrl)
    expect(await response.text()).toBe("official document")
    expect((await fetch(`${origin}/mcp`, { method: "POST" })).status).toBe(404)
    expect((await fetch(`${origin}/api/bills`)).status).toBe(404)
  })
  it.each([
    "https://www.palegis.us/legislation/bills/text/PDF/2021/0/HB0209/PN0175",
    "https://www.legis.state.pa.us/WU01/LI/BI/FN/2021/0/HB1013P1052.pdf",
    "https://www.legis.state.pa.us/WU01/LI/BI/SFN/2021/0/HB0326P0388.pdf"
  ])("preserves approved PDF and fiscal-note responses from %s", async (url) => {
    download.mockResolvedValueOnce({
      bytes: Buffer.from("%PDF-relayed"),
      contentType: "application/pdf",
      sourceUrl: url
    })
    const response = await fetch(`${origin}/internal/document-fetch`, {
      method: "POST",
      headers: { authorization: "Bearer relay-test", "content-type": "application/json" },
      body: JSON.stringify({ sourceUrl: url })
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("x-legislation-relayed-source")).toBe(url)
    expect(await response.text()).toBe("%PDF-relayed")
  })
})
