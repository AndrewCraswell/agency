import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ discover: vi.fn(), end: vi.fn(), key: vi.fn(), pool: vi.fn(), trigger: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  idempotencyKeys: { create: mocks.key },
  tasks: { trigger: mocks.trigger }
}))
vi.mock("../../ingestion/regulations/ecfr-discovery.js", () => ({ discoverEcfrChanges: mocks.discover }))

import {
  continueRegulatoryEcfrDiscovery,
  regulatoryEcfrDiscoveryPayloadSchema,
  runRegulatoryEcfrDiscovery
} from "./regulatory-ecfr-discovery.js"

const result = {
  checkpoint: { scopeKey: "a".repeat(64), committedCursor: { inventoryDate: "2026-09-17" } },
  changedTitles: [1],
  reservedTitles: [],
  unchangedTitles: [],
  inventoryDate: "2026-09-17"
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/legislation")
  mocks.discover.mockResolvedValue(result)
  mocks.key.mockResolvedValue("global-controller-key")
  mocks.trigger.mockResolvedValue({ id: "controller-run" })
})
afterEach(() => vi.unstubAllEnvs())

it("accepts only a bounded unique title selection", () => {
  expect(regulatoryEcfrDiscoveryPayloadSchema.parse({ titles: [50, 1] })).toEqual({ titles: [50, 1] })
  for (const input of [{ titles: [1, 1] }, { titles: [0] }, { titles: [51] }, { titles: [] }, { active: true }]) {
    expect(regulatoryEcfrDiscoveryPayloadSchema.safeParse(input).success).toBe(false)
  }
})

it("rejects a search database before opening source discovery", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://example/legislation_passage_search")
  await expect(runRegulatoryEcfrDiscovery({ titles: [1] })).rejects.toThrow(
    "Regulatory discovery requires a canonical PostgreSQL database"
  )
})

it("closes discovery before starting one bounded controller window", async () => {
  await expect(continueRegulatoryEcfrDiscovery({ titles: [1] })).resolves.toMatchObject({
    controllerRunId: "controller-run"
  })
  expect(mocks.end.mock.invocationCallOrder[0]).toBeLessThan(mocks.trigger.mock.invocationCallOrder[0]!)
  expect(mocks.key).toHaveBeenCalledWith(expect.stringMatching(/^regulatory-discovery-controller:[a-f0-9]{64}$/), {
    scope: "global"
  })
  expect(mocks.trigger).toHaveBeenCalledWith(
    "regulatory-discovery-controller",
    { sourceId: "ecfr", scopeKey: "a".repeat(64), afterUnitKey: null, limit: 25 },
    { idempotencyKey: "global-controller-key" }
  )
  expect(mocks.pool).toHaveBeenCalledWith(expect.objectContaining({ max: 2 }))
  expect(mocks.pool).not.toHaveBeenCalledWith(expect.objectContaining({ statement_timeout: expect.anything() }))
})

it("does not start a controller when discovery finds no changed title", async () => {
  mocks.discover.mockResolvedValueOnce({ ...result, changedTitles: [] })
  await expect(continueRegulatoryEcfrDiscovery({ titles: [1] })).resolves.toMatchObject({ controllerRunId: null })
  expect(mocks.trigger).not.toHaveBeenCalled()
})
