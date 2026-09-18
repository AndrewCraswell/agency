import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ZodError } from "zod"
import { runRegulatoryAnnualPublication } from "./regulatory-annual-publication.js"

const mocks = vi.hoisted(() => ({
  pool: vi.fn<(options: unknown) => void>(),
  query: vi.fn<() => Promise<{ rows: { name: string }[] }>>(),
  end: vi.fn<() => Promise<void>>(),
  publish: vi.fn<typeof import("../../ingestion/regulations/annual-cfr-publication.js").publishAnnualCfrEdition>()
}))

vi.mock("pg", () => ({
  default: {
    Pool: class {
      constructor(options: unknown) {
        mocks.pool(options)
      }
      query = mocks.query
      end = mocks.end
    }
  }
}))
vi.mock("@trigger.dev/sdk", () => ({ task: (value: unknown) => value }))
vi.mock("../../ingestion/regulations/annual-cfr-publication.js", () => ({
  publishAnnualCfrEdition: mocks.publish
}))

const payload = {
  manifestId: "a".repeat(64),
  year: 2025,
  title: 5,
  generationIds: ["b".repeat(64), "c".repeat(64)]
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  mocks.query.mockResolvedValue({ rows: [{ name: "canonical" }] })
  mocks.publish.mockResolvedValue({
    annualEditionId: "d".repeat(64),
    volumes: 2,
    revisionDate: "2025-01-01",
    reused: false,
    state: "published"
  })
})
afterEach(() => vi.unstubAllEnvs())

it("publishes one exact bounded annual title through the shared publication queue", async () => {
  await expect(runRegulatoryAnnualPublication(payload)).resolves.toMatchObject({ state: "published", volumes: 2 })
  expect(mocks.pool).toHaveBeenCalledWith({
    connectionString: "postgresql://source/canonical",
    max: 3,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000
  })
  expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(expect.anything(), payload)
  expect(mocks.end).toHaveBeenCalledOnce()
})

it.each([
  { ...payload, manifestId: "bad" },
  { ...payload, year: 1995 },
  { ...payload, title: 51 },
  { ...payload, generationIds: [] },
  { ...payload, generationIds: Array.from({ length: 201 }, () => "b".repeat(64)) },
  { ...payload, source: "ecfr" }
])("rejects malformed annual title publication before opening the database %j", async (input) => {
  await expect(runRegulatoryAnnualPublication(input)).rejects.toThrow(ZodError)
  expect(mocks.pool).not.toHaveBeenCalled()
  expect(mocks.publish).not.toHaveBeenCalled()
})

it("rejects unsafe configured and actual database targets without publishing", async () => {
  for (const url of [
    "postgresql://source/legislation_passage_search",
    "https://source/canonical",
    "postgresql://source/"
  ]) {
    vi.stubEnv("DATABASE_URL", url)
    await expect(runRegulatoryAnnualPublication(payload)).rejects.toThrow("canonical PostgreSQL")
  }
  expect(mocks.pool).not.toHaveBeenCalled()

  vi.stubEnv("DATABASE_URL", "postgresql://source/canonical")
  mocks.query.mockResolvedValueOnce({ rows: [{ name: "legislation_passage_search" }] })
  await expect(runRegulatoryAnnualPublication(payload)).rejects.toThrow("canonical PostgreSQL")
  expect(mocks.publish).not.toHaveBeenCalled()
  expect(mocks.end).toHaveBeenCalledOnce()
})

it("closes the database after a failed atomic publication so Trigger can retry the same payload", async () => {
  mocks.publish.mockRejectedValueOnce(new Error("annual_title_incomplete_or_date_conflict"))
  await expect(runRegulatoryAnnualPublication(payload)).rejects.toThrow("annual_title_incomplete_or_date_conflict")
  expect(mocks.end).toHaveBeenCalledOnce()
})
