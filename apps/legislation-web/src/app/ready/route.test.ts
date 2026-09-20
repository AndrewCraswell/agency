import { ingestionContract } from "@repo/legislation-core/domain/ingestion-contract"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const readiness = {
  check: vi.fn<() => Promise<boolean>>(),
  details: vi.fn<() => Readonly<Record<string, unknown>>>()
}

vi.mock("../../modules/legislation/runtime/runtime", () => ({
  getNextLegislationReadiness: () => readiness
}))

import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route"

function request(method = "GET", correlationId?: string): NextRequest {
  return new NextRequest("http://localhost/ready", {
    headers: correlationId === undefined ? undefined : { "x-correlation-id": correlationId },
    method
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  readiness.check.mockReset()
  readiness.details.mockReset()
  vi.restoreAllMocks()
})

describe("GET /ready", () => {
  it("reports ready with the composition details", async () => {
    readiness.check.mockResolvedValue(true)
    readiness.details.mockReturnValue({ databasePool: { maximum: 10, total: 2 } })

    const response = await GET(request("GET", "ready-test"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8")
    expect(response.headers.get("x-correlation-id")).toBe("ready-test")
    await expect(response.json()).resolves.toEqual({
      commitSha: null,
      databasePool: { maximum: 10, total: 2 },
      ingestionContract,
      status: "ready"
    })
  })

  it("returns 503 and logs safe readiness diagnostics when unavailable", async () => {
    readiness.check.mockResolvedValue(false)
    readiness.details.mockReturnValue({ databasePool: { saturation: 1, waiting: 2 } })
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const response = await GET(request("GET", "not-ready-test"))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      commitSha: null,
      databasePool: { saturation: 1, waiting: 2 },
      ingestionContract,
      status: "unavailable"
    })
    expect(warning).toHaveBeenCalledWith("readiness check failed", {
      correlationId: "not-ready-test",
      databasePool: { saturation: 1, waiting: 2 }
    })
  })

  it("returns the legacy internal error body when the readiness check fails", async () => {
    readiness.check.mockRejectedValue(new Error("database unavailable"))
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await GET(request("GET", "readiness-error"))

    expect(response.status).toBe(500)
    expect(response.headers.get("x-correlation-id")).toBe("readiness-error")
    await expect(response.json()).resolves.toEqual({ error: "internal_error" })
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
