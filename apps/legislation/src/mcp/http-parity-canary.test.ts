import { describe, expect, it } from "vitest"
import type { FetchLike } from "../api-client/client.js"
import { assertGetBillHttpParity, McpHttpParityMismatchError } from "./http-parity-canary.js"

function response(data: unknown, correlationId: string): Response {
  return new Response(
    JSON.stringify({
      data,
      links: { self: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1" },
      meta: { correlationId, warnings: [] }
    }),
    {
      headers: { "content-type": "application/json", "x-correlation-id": correlationId },
      status: 200
    }
  )
}

describe("assertGetBillHttpParity", () => {
  it("requires strict direct-query and API-adapter equivalence with caller context propagation", async () => {
    const direct = {
      actions: [{ actionAt: new Date("2026-08-24T00:00:00.000Z"), id: "action:us:1" }],
      bill: { id: "bill:us:119:hr:1", title: "Infrastructure" },
      truncated: false,
      warnings: []
    }
    let authorization: string | null = null
    let correlationId: string | null = null
    let requestedUrl: string | undefined
    const fetch: FetchLike = async (input, init) => {
      const headers = new Headers(init?.headers)
      authorization = headers.get("authorization")
      correlationId = headers.get("x-correlation-id")
      requestedUrl = String(input)
      return response(direct, correlationId ?? "missing")
    }

    await expect(
      assertGetBillHttpParity({
        apiBaseUrl: "https://api.example.test",
        billId: "bill:us:119:hr:1",
        correlationId: "parity-correlation",
        fetch,
        inProcess: { getBill: async () => direct },
        token: "parity-token"
      })
    ).resolves.toEqual({
      billId: "bill:us:119:hr:1",
      correlationId: "parity-correlation",
      method: "getBill",
      status: "passed"
    })
    expect(authorization).toBe("Bearer parity-token")
    expect(correlationId).toBe("parity-correlation")
    expect(requestedUrl).toBe("https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1?childLimit=25")
    expect(requestedUrl).not.toContain("/mcp")
  })

  it("fails closed without exposing the caller token when any semantic field differs", async () => {
    const direct = { bill: { id: "bill:us:119:hr:1", title: "Infrastructure" } }
    const error = await assertGetBillHttpParity({
      apiBaseUrl: "https://api.example.test",
      billId: "bill:us:119:hr:1",
      correlationId: "parity-correlation",
      fetch: async (_input, init) =>
        response(
          { bill: { id: "bill:us:119:hr:1", title: "Different title" } },
          new Headers(init?.headers).get("x-correlation-id") ?? "missing"
        ),
      inProcess: { getBill: async () => direct },
      token: "parity-token-that-must-not-leak"
    }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(McpHttpParityMismatchError)
    expect(error).toMatchObject({ mismatchPath: "$.bill.title" })
    expect(String(error)).not.toContain("parity-token-that-must-not-leak")
  })
})
