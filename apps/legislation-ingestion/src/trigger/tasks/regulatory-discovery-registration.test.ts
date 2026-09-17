import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ register: vi.fn(), end: vi.fn() }))
vi.mock("pg", () => ({
  default: {
    Pool: class MockPool {
      end = mocks.end
    }
  }
}))
vi.mock("../../ingestion/regulations/discovery-registration.js", () => ({
  registerLegalDiscoveryManifest: mocks.register
}))

import { runRegulatoryDiscoveryRegistration } from "./regulatory-discovery-registration.js"

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DATABASE_URL = "postgresql://localhost:5432/legislation"
})

it("returns an empty bounded result when no pending discovery units remain", async () => {
  mocks.register.mockResolvedValue(null)
  await expect(
    runRegulatoryDiscoveryRegistration({ sourceId: "ecfr", scopeKey: "a".repeat(64), limit: 25 })
  ).resolves.toEqual({ registered: 0, manifestId: null })
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("returns only the durable manifest identity and count", async () => {
  mocks.register.mockResolvedValue({ id: "b".repeat(64), units: [{}, {}] })
  await expect(runRegulatoryDiscoveryRegistration({ sourceId: "ecfr", scopeKey: "a".repeat(64) })).resolves.toEqual({
    registered: 2,
    manifestId: "b".repeat(64)
  })
  expect(mocks.register).toHaveBeenCalledWith(expect.anything(), {
    sourceId: "ecfr",
    scopeKey: "a".repeat(64),
    limit: 100
  })
})

it.each([
  { sourceId: "ecfr", scopeKey: "bad", limit: 1 },
  { sourceId: "ecfr", scopeKey: "a".repeat(64), limit: 101 }
])("rejects an invalid registration payload before opening the database", async (payload) => {
  await expect(runRegulatoryDiscoveryRegistration(payload)).rejects.toThrow()
  expect(mocks.register).not.toHaveBeenCalled()
})
