import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  reference: [] as unknown[],
  target: [] as unknown[],
  query: vi.fn<(sql: string) => void>(),
  bytes: Buffer.alloc(0),
  corrupt: false
}))
vi.mock("commander", () => ({
  Command: class {
    args = ["ak", "34"]
    argument() {
      return this
    }
    requiredOption() {
      return this
    }
    option() {
      return this
    }
    parse() {
      return this
    }
    opts() {
      return { referenceDatabaseEnv: "PARITY_REFERENCE", targetDatabaseEnv: "PARITY_TARGET", output: "unused" }
    }
  }
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      private options: { connectionString: string }
      constructor(options: { connectionString: string }) {
        this.options = options
      }
      async connect() {
        return {
          query: async (sql: string) => {
            mocks.query(sql)
            return {
              rows: sql.includes("transaction_timestamp")
                ? [{ observed_at: "2026-09-17" }]
                : sql.includes("from legislation.bill_documents")
                  ? this.options.connectionString === "reference"
                    ? mocks.reference
                    : mocks.target
                  : sql.includes("from legislation.bills")
                    ? [{ id: "bill:ak:34:hb:1" }]
                    : []
            }
          },
          release() {}
        }
      }
      async end() {}
    }
  }
}))
vi.mock("../../src/ingestion/documents/artifact-store.js", () => ({
  LocalArtifactStore: class {
    async put(_path: string, bytes: Buffer) {
      mocks.bytes = Buffer.from(bytes)
    }
    async read() {
      return mocks.corrupt ? Buffer.from("changed") : mocks.bytes
    }
  }
}))
const row = {
  id: "local",
  bill_id: "bill:ak:34:hb:1",
  source_url: "https://example.test/document",
  source_sha256: "a".repeat(64),
  text_hash: "reference-text",
  characters: 200,
  ocr_status: "processed"
}
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv("PARITY_REFERENCE", "reference")
  vi.stubEnv("PARITY_TARGET", "target")
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  mocks.reference = [{ ...row }]
  mocks.target = [{ ...row, id: "production", text_hash: "target-text", characters: 100 }]
  mocks.bytes = Buffer.alloc(0)
  mocks.corrupt = false
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
it("matches canonical source identity across database IDs and only reads databases", async () => {
  await import("./audit-state-extraction-parity.js")
  expect(JSON.parse(mocks.bytes.toString())).toMatchObject({
    productionWrites: false,
    identical: 0,
    unresolved: [],
    differences: [{ referenceId: "local", productionId: "production", sourceSha256: row.source_sha256 }]
  })
  expect(mocks.query.mock.calls.every(([sql]) => /^(begin|set local|select|rollback)/.test(sql))).toBe(true)
})
it.each(["missing", "changed-source", "duplicate-target", "duplicate-reference"])(
  "excludes unsafe %s matches",
  async (scenario) => {
    if (scenario === "missing") mocks.target = [{ ...row, source_url: "https://example.test/other" }]
    if (scenario === "changed-source") mocks.target = [{ ...row, source_sha256: "b".repeat(64) }]
    if (scenario === "duplicate-target") mocks.target.push({ ...row })
    if (scenario === "duplicate-reference") mocks.reference.push({ ...row, id: "other-local" })
    await import("./audit-state-extraction-parity.js")
    const report = JSON.parse(mocks.bytes.toString())
    expect(report.differences).toEqual([])
    expect(report.unresolved.length).toBeGreaterThan(0)
  }
)
it("counts identical text without producing repair candidates", async () => {
  mocks.target = [{ ...row, id: "production" }]
  await import("./audit-state-extraction-parity.js")
  expect(JSON.parse(mocks.bytes.toString())).toMatchObject({ identical: 1, differences: [], unresolved: [] })
})
it("rejects empty reference evidence", async () => {
  mocks.reference = []
  await expect(import("./audit-state-extraction-parity.js")).rejects.toThrow("nonempty reference")
})
it("rejects corrupted persisted evidence", async () => {
  mocks.corrupt = true
  await expect(import("./audit-state-extraction-parity.js")).rejects.toThrow("checksum verification failed")
})
