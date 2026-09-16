import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { config, proxy as entrypointProxy } from "../../proxy"
import { proxy } from "./proxy"

describe("API proxy", () => {
  it.each([
    "/api/documents/%ZZ?unexpected=1",
    "/api/supporting-materials/%C0%AF?unexpected=1",
    "/api/supporting-materials/%?unexpected=1"
  ])("returns the canonical invalid-request response before dynamic route decoding for %s", async (pathname) => {
    const response = proxy(
      new NextRequest(`https://legislation.test${pathname}`, {
        headers: { "x-correlation-id": "proxy-correlation" }
      })
    )

    expect(response).toBeDefined()
    expect(response?.status).toBe(400)
    expect(response?.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response?.headers.get("cache-control")).toBe("private, no-store")
    expect(response?.headers.get("x-correlation-id")).toBe("proxy-correlation")
    await expect(response?.json()).resolves.toEqual({
      error: {
        category: "invalid_request",
        correlationId: "proxy-correlation",
        message: "Path contains invalid percent encoding",
        retryable: false
      }
    })
  })

  it("generates a correlation ID when the caller header is blank", async () => {
    const response = proxy(
      new NextRequest("https://legislation.test/api/documents/%ZZ", {
        headers: { "x-correlation-id": "  " }
      })
    )

    expect(response).toBeDefined()
    const correlationId = response?.headers.get("x-correlation-id")
    expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    await expect(response?.json()).resolves.toMatchObject({
      error: { category: "invalid_request", correlationId, retryable: false }
    })
  })

  it.each([
    "/api/documents/document%3Arouter?unexpected=1",
    "/api/supporting-materials/supporting-material%3Arouter?unexpected=1",
    "/api/documents/document%3Arouter?query=%ZZ"
  ])("does not change a valid API path for %s", (pathname) => {
    expect(proxy(new NextRequest(`https://legislation.test${pathname}`))).toBeUndefined()
  })

  it("limits execution to API paths", () => {
    expect(config).toEqual({ matcher: "/api/:path*" })
    expect(entrypointProxy).toBe(proxy)
  })
})
