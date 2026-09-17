import { createHash } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const sourceHash = createHash("sha256")
  .update(new Uint8Array([1]))
  .digest("hex")

const mocks = vi.hoisted(() => ({
  query: vi.fn<(sql: string, params?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }>>(),
  release: vi.fn<() => void>(),
  end: vi.fn<() => Promise<void>>(),
  download: vi.fn<() => Promise<{ bytes: Uint8Array; contentType: string }>>(),
  extract: vi.fn<() => Promise<{ contentHash: string; text: string }>>(),
  apply: false,
  category: "unsupported-format"
}))
vi.mock("commander", () => ({
  Command: class {
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
      return {
        state: "ak",
        session: "34",
        databaseEnv: "RETRY_TEST_DATABASE_URL",
        limit: "10",
        apply: mocks.apply,
        category: mocks.category
      }
    }
  }
}))
vi.mock("pg", () => ({
  default: {
    Pool: class {
      async connect() {
        return { query: mocks.query, release: mocks.release }
      }
      end = mocks.end
    }
  }
}))
vi.mock("../../src/ingestion/documents/download.js", () => ({ downloadDocument: mocks.download }))
vi.mock("../../src/ingestion/documents/extract.js", () => ({
  extractDocument: mocks.extract,
  DocumentExtractionError: class extends Error {
    readonly category: string

    constructor(category: string, message: string) {
      super(message)
      this.category = category
    }
  }
}))
const initialExitCode = process.exitCode
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.apply = false
  mocks.category = "unsupported-format"
  process.exitCode = undefined
  vi.stubEnv("RETRY_TEST_DATABASE_URL", "postgresql://unused")
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  mocks.query.mockImplementation(async (sql: string) =>
    sql.startsWith("select id")
      ? {
          rows: [
            {
              id: "doc",
              source_url: "https://example.org/doc",
              content_hash: sourceHash,
              processing_error: "old",
              updated_at: "2026-09-16 00:00:00.123456+00"
            }
          ]
        }
      : { rowCount: 1 }
  )
  mocks.download.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "text/plain" })
  mocks.extract.mockResolvedValue({ contentHash: "hash", text: "verified text" })
})
afterEach(() => {
  process.exitCode = initialExitCode
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
it("validates without writing by default", async () => {
  await import("./retry-supported-documents.js")
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("update"))).toBe(false)
  expect(mocks.end).toHaveBeenCalled()
})
it("guards applied changes using exact source and timestamp evidence", async () => {
  mocks.apply = true
  await import("./retry-supported-documents.js")
  const update = mocks.query.mock.calls.find(([sql]) => sql.startsWith("update"))
  expect(update?.[0]).toContain("processing_status='unsupported'")
  expect(update?.[1]).toEqual([
    "doc",
    "https://example.org/doc",
    "2026-09-16 00:00:00.123456+00",
    sourceHash,
    "old",
    "unsupported-format"
  ])
})
it("does not queue changed publisher bytes", async () => {
  mocks.apply = true
  mocks.download.mockResolvedValue({ bytes: new Uint8Array([2]), contentType: "text/plain" })
  await import("./retry-supported-documents.js")
  expect(process.exitCode).toBe(1)
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("update"))).toBe(false)
})
it("leaves genuinely unsupported documents untouched", async () => {
  const { DocumentExtractionError } = await import("../../src/ingestion/documents/extract.js")
  mocks.apply = true
  mocks.extract.mockRejectedValue(new DocumentExtractionError("unsupported-format", "Unsupported format"))
  await import("./retry-supported-documents.js")
  expect(process.exitCode).toBeUndefined()
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("update"))).toBe(false)
})
it("requeues recognized scanned content for the normal OCR pipeline", async () => {
  const { DocumentExtractionError } = await import("../../src/ingestion/documents/extract.js")
  mocks.apply = true
  mocks.extract.mockRejectedValue(new DocumentExtractionError("ocr-required", "Scanned content"))
  await import("./retry-supported-documents.js")
  expect(process.exitCode).toBeUndefined()
  expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("update"))).toBe(true)
})
it("rolls back a concurrent change and reports failure", async () => {
  mocks.apply = true
  const original = mocks.query.getMockImplementation()
  mocks.query.mockImplementation(async (sql: string, params?: unknown[]) =>
    sql.startsWith("update") ? { rowCount: 0 } : ((await original?.(sql, params)) ?? {})
  )
  await import("./retry-supported-documents.js")
  expect(process.exitCode).toBe(1)
  expect(mocks.query).toHaveBeenCalledWith("rollback")
  expect(mocks.query).not.toHaveBeenCalledWith("commit")
})
it("revalidates stale malformed classifications with the same guarded OCR handoff", async () => {
  const { DocumentExtractionError } = await import("../../src/ingestion/documents/extract.js")
  mocks.apply = true
  mocks.category = "malformed-document"
  mocks.extract.mockRejectedValue(new DocumentExtractionError("ocr-required", "Scanned content"))
  await import("./retry-supported-documents.js")
  const update = mocks.query.mock.calls.find(([sql]) => sql.startsWith("update"))
  expect(update?.[0]).toContain("processing_error_category=$6")
  expect(update?.[1]?.[5]).toBe("malformed-document")
})
it("rejects retry categories outside terminal extraction revalidation", async () => {
  mocks.category = "processing-transient"
  await expect(import("./retry-supported-documents.js")).rejects.toThrow()
  expect(mocks.query).not.toHaveBeenCalled()
})
