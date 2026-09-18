import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ discover: vi.fn(), end: vi.fn(), key: vi.fn(), trigger: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({
  task: (value: unknown) => value,
  idempotencyKeys: { create: mocks.key },
  tasks: { trigger: mocks.trigger }
}))
vi.mock("../../ingestion/regulations/fr-discovery.js", () => ({ discoverFrChanges: mocks.discover }))

import {
  continueRegulatoryFrDiscovery,
  regulatoryFrDiscoveryPayloadSchema,
  runRegulatoryFrDiscovery
} from "./regulatory-fr-discovery.js"

const payload = {
  bootstrapStart: "2026-09-01T00:00:00.000Z",
  through: "2026-09-18T00:00:00.000Z"
}
const result = {
  checkpoint: { scopeKey: "a".repeat(64), committedCursor: { active: { offsetMark: "next" } } },
  cursor: { active: { offsetMark: "next" } },
  complete: false,
  newUnits: 2,
  discoveredPackages: ["FR-2026-09-17"],
  split: false
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/legislation")
  vi.stubEnv("GOVINFO_API_KEY", "govinfo-key")
  mocks.discover.mockResolvedValue(result)
  mocks.key.mockResolvedValueOnce("continuation-key")
  mocks.trigger.mockResolvedValueOnce({ id: "continuation-run" })
})
afterEach(() => vi.unstubAllEnvs())

it("accepts one bounded fixed discovery window", () => {
  expect(regulatoryFrDiscoveryPayloadSchema.parse(payload)).toEqual(payload)
  for (const input of [
    {},
    { bootstrapStart: "2026-09-01" },
    { bootstrapStart: payload.bootstrapStart, enabled: true }
  ]) {
    expect(regulatoryFrDiscoveryPayloadSchema.safeParse(input).success).toBe(false)
  }
})

it("rejects search databases and missing provider credentials before discovery", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://example/legislation_passage_search")
  await expect(runRegulatoryFrDiscovery(payload)).rejects.toThrow(
    "Regulatory discovery requires a canonical PostgreSQL database"
  )
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/legislation")
  vi.stubEnv("GOVINFO_API_KEY", "")
  await expect(runRegulatoryFrDiscovery(payload)).rejects.toThrow()
  expect(mocks.discover).not.toHaveBeenCalled()
})

it("closes the database before continuing pagination and holds FR units from the eCFR-only publisher", async () => {
  await expect(continueRegulatoryFrDiscovery(payload)).resolves.toMatchObject({
    controllerRunId: null,
    continuationRunId: "continuation-run"
  })
  expect(mocks.end.mock.invocationCallOrder[0]).toBeLessThan(mocks.trigger.mock.invocationCallOrder[0]!)
  expect(mocks.trigger).toHaveBeenNthCalledWith(1, "regulatory-fr-discovery", payload, {
    idempotencyKey: "continuation-key"
  })
})

it("stops continuation and acquisition dispatch when a terminal page adds nothing", async () => {
  mocks.discover.mockResolvedValueOnce({ ...result, complete: true, newUnits: 0, cursor: { active: null } })
  await expect(continueRegulatoryFrDiscovery(payload)).resolves.toMatchObject({
    controllerRunId: null,
    continuationRunId: null
  })
  expect(mocks.trigger).not.toHaveBeenCalled()
})
