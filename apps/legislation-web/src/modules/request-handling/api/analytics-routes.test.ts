import { expect, it, vi } from "vitest"
import { createAnalyticsHandler } from "./analytics-routes"
import { executeNextHttpApiHandler } from "./next/node-handler"

it("validates and forwards the complete analytic plan", async () => {
  const analyze = vi.fn<(...parameters: unknown[]) => Promise<{ rows: { total: number }[] }>>(async () => ({
    rows: [{ total: 12 }]
  }))
  const input = { dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] }
  const response = await executeNextHttpApiHandler(
    new Request("http://localhost/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    }),
    createAnalyticsHandler(analyze)
  )
  expect(response.status).toBe(200)
  expect(analyze).toHaveBeenCalledWith(
    expect.objectContaining({ dataset: "bills", limit: 20, metrics: [{ ...input.metrics[0], filters: [] }] })
  )
  expect((await response.json()).data.rows).toEqual([{ total: 12 }])
})

it("rejects SQL and unknown input properties before calling the database", async () => {
  const analyze = vi.fn<(...parameters: unknown[]) => Promise<object>>(async () => ({}))
  const response = await executeNextHttpApiHandler(
    new Request("http://localhost/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataset: "bills", sql: "select * from webhooks" })
    }),
    createAnalyticsHandler(analyze)
  )
  expect(response.status).toBe(400)
  expect(analyze).not.toHaveBeenCalled()
})
