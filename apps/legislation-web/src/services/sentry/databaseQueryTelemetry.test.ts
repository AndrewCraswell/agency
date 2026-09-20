import { captureException, startSpan } from "@sentry/core"
import type pg from "pg"
import { afterEach, expect, it, vi } from "vitest"
import { createDatabaseQueryObserver } from "./databaseQueryTelemetry"

vi.mock("@sentry/core", () => ({
  captureException: vi.fn<typeof captureException>(),
  startSpan: vi.fn<typeof startSpan>((_options, operation) =>
    operation({
      setAttribute: vi.fn<(name: string, value: unknown) => void>(),
      setAttributes: vi.fn<(attributes: Record<string, unknown>) => void>(),
      setStatus: vi.fn<(status: { code: number; message?: string }) => void>()
    } as never)
  )
}))

afterEach(() => {
  vi.clearAllMocks()
})

it("records a stable query identity and bounded pool measurements", async () => {
  const pool = {
    idleCount: 2,
    options: { max: 5 },
    totalCount: 3,
    waitingCount: 1
  } as pg.Pool
  const observe = createDatabaseQueryObserver({ canonical: pool })

  await expect(
    observe({ name: "supporting_material.search.semantic", pool: "canonical", revision: 1 }, async () => ({
      rows: ["first", "second"]
    }))
  ).resolves.toEqual({ rows: ["first", "second"] })

  expect(startSpan).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "supporting_material.search.semantic",
      op: "db.query",
      attributes: expect.objectContaining({
        "db.pool.name": "canonical",
        "db.pool.saturation": 0.2,
        "db.pool.waiting": 1,
        "db.query.name": "supporting_material.search.semantic",
        "db.query.revision": 1
      })
    }),
    expect.any(Function)
  )
})
