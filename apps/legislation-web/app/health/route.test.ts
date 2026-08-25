import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route"

function request(method = "GET", correlationId?: string): NextRequest {
  return new NextRequest("http://localhost/health", {
    headers: correlationId === undefined ? undefined : { "x-correlation-id": correlationId },
    method
  })
}

describe("GET /health", () => {
  it("reports process health and returns a caller correlation ID", async () => {
    const response = GET(request("GET", "health-test"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("x-correlation-id")).toBe("health-test")
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })

  it("generates a correlation ID when the caller does not provide one", () => {
    const response = GET(request())
    expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/)
  })

  it.each([DELETE, HEAD, OPTIONS, PATCH, POST, PUT])(
    "rejects unsupported methods with the legacy 404 body",
    async (handler) => {
      const response = handler(request("POST", "unsupported-test"))

      expect(response.status).toBe(404)
      expect(response.headers.get("x-correlation-id")).toBe("unsupported-test")
      await expect(response.json()).resolves.toEqual({ error: "not_found" })
    }
  )
})
