import { createHash } from "node:crypto"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  evidence: "",
  digest: "",
  apply: false,
  corruptArtifact: false,
  download: vi.fn<() => Promise<{ bytes: Uint8Array; contentType: string }>>(),
  extract: vi.fn<() => Promise<unknown>>(),
  requeue: vi.fn<() => Promise<{ requeued: boolean }>>(),
  end: vi.fn<() => Promise<void>>()
}))
vi.mock("node:fs/promises", () => ({ readFile: async () => Buffer.from(mocks.evidence) }))
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
      return { evidence: "unused", sha256: mocks.digest, databaseEnv: "REVISION_TEST_DATABASE", apply: mocks.apply }
    }
  }
}))
vi.mock("../../src/config/config.js", () => ({
  loadConfig: () => ({ database: {}, azure: { storageAccount: "test", normalizedDocumentContainer: "docs" } })
}))
vi.mock("../../src/ingestion/documents/artifact-store.js", () => ({
  artifactPath: () => "documents/reviewed.pdf",
  AzureBlobArtifactStore: class {
    async put() {
      return true
    }
    async read() {
      return new Uint8Array([mocks.corruptArtifact ? 2 : 1])
    }
  }
}))
vi.mock("@repo/legislation-core/database/database", () => ({
  createDatabase: () => ({ database: {}, pool: { end: mocks.end } })
}))
vi.mock("../../src/ingestion/documents/download.js", () => ({ downloadDocument: mocks.download }))
vi.mock("../../src/ingestion/documents/requeue-verified-extraction.js", () => ({
  requeueVerifiedExtraction: mocks.requeue
}))
vi.mock("../../src/ingestion/documents/extract.js", () => ({
  extractDocument: mocks.extract,
  DocumentExtractionError: class extends Error {
    category: string
    constructor(category: string, message: string) {
      super(message)
      this.category = category
    }
  }
}))
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv("REVISION_TEST_DATABASE", "postgres://unused")
  vi.spyOn(process.stdout, "write").mockReturnValue(true)
  mocks.apply = false
  mocks.corruptArtifact = false
  mocks.evidence = JSON.stringify({
    state: "ak",
    session: "34",
    stored: {
      documentId: "doc",
      billId: "bill:ak:34:sb:1",
      sourceUrl: "https://example.test/doc",
      sourceSha256: "a".repeat(64),
      previousTextHash: "b".repeat(32)
    },
    currentSourceSha256: createHash("sha256")
      .update(new Uint8Array([1]))
      .digest("hex"),
    reviewReason: "Verified publisher revision"
  })
  mocks.digest = createHash("sha256").update(mocks.evidence).digest("hex")
  mocks.download.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "application/pdf" })
  mocks.extract.mockResolvedValue({ text: "Valid content" })
  mocks.requeue.mockResolvedValue({ requeued: true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
it("defaults to validation without queue changes", async () => {
  await import("./refresh-reviewed-document-source.js")
  expect(mocks.requeue).not.toHaveBeenCalled()
})
it("rejects tampered evidence before downloading", async () => {
  mocks.digest = "0".repeat(64)
  await expect(import("./refresh-reviewed-document-source.js")).rejects.toThrow("checksum mismatch")
  expect(mocks.download).not.toHaveBeenCalled()
})
it("rejects a publisher revision that changed after review", async () => {
  mocks.apply = true
  mocks.download.mockResolvedValue({ bytes: new Uint8Array([2]), contentType: "application/pdf" })
  await expect(import("./refresh-reviewed-document-source.js")).rejects.toThrow("differ from the reviewed")
  expect(mocks.requeue).not.toHaveBeenCalled()
})
it("queues reviewed OCR content through the existing stored-version guard", async () => {
  mocks.apply = true
  const { DocumentExtractionError } = await import("../../src/ingestion/documents/extract.js")
  mocks.extract.mockRejectedValue(new DocumentExtractionError("ocr-required", "Scanned PDF"))
  await import("./refresh-reviewed-document-source.js")
  expect(mocks.requeue).toHaveBeenCalledWith({}, expect.objectContaining({ sourceSha256: "a".repeat(64) }), {
    path: "documents/reviewed.pdf",
    contentType: "application/pdf"
  })
  expect(mocks.end).toHaveBeenCalled()
})
it("rejects unsupported current content", async () => {
  mocks.apply = true
  const { DocumentExtractionError } = await import("../../src/ingestion/documents/extract.js")
  mocks.extract.mockRejectedValue(new DocumentExtractionError("unsupported-format", "Invalid source"))
  await expect(import("./refresh-reviewed-document-source.js")).rejects.toThrow("Invalid source")
  expect(mocks.requeue).not.toHaveBeenCalled()
})
it("reports concurrent or active document guards as incomplete", async () => {
  mocks.apply = true
  mocks.requeue.mockResolvedValue({ requeued: false })
  await expect(import("./refresh-reviewed-document-source.js")).rejects.toThrow("Stored document changed or is active")
  expect(mocks.end).toHaveBeenCalled()
})
it("does not queue a corrupt retained replacement artifact", async () => {
  mocks.apply = true
  mocks.corruptArtifact = true
  await expect(import("./refresh-reviewed-document-source.js")).rejects.toThrow("artifact checksum mismatch")
  expect(mocks.requeue).not.toHaveBeenCalled()
})
