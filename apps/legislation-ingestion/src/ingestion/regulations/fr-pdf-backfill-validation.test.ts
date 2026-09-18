import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { validateFrPdfDate } from "./fr-pdf-backfill-validation.js"

const fixture = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const record = fixture.results.find((item) => item.type === "Rule")
invariant(record, "fixture_rule_missing")
const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe("Federal Register PDF backfill validation", () => {
  it("retains per-document evidence and reuses it after an interrupted date", async () => {
    const root = await mkdtemp(join(tmpdir(), "fr-pdf-backfill-validation-"))
    directories.push(root)
    const metadataManifestId = digest("metadata")
    const pdfSha256 = digest("pdf")
    const acquisitionReportHash = digest("acquisition")
    const validatorCodeHash = digest("validator")
    const records = [record, { ...record, document_number: "2023-27784" }]
    const pdfBytes = 1234
    const acquiredResult = (documentNumber: string) => ({
      documentNumber,
      status: "acquired",
      receipt: {
        unit: {
          metadataManifestId,
          documentNumber,
          publicationDate: record.publication_date,
          sourceUrl: record.pdf_url
        },
        sha256: pdfSha256,
        bytes: pdfBytes,
        acquiredAt: "2026-09-18T12:00:00.000Z",
        contentType: "application/pdf",
        etag: null,
        lastModified: null,
        status: "acquired",
        structuralValidation: "pending",
        reused: false
      }
    })
    const acquisitionCheckpoint = {
      metadataManifestId,
      date: record.publication_date,
      expected: records.length,
      results: records.map(({ document_number }) => acquiredResult(document_number.toUpperCase())),
      acquisitionComplete: true,
      structuralValidation: "pending",
      publicationReady: false,
      canonicalWrites: false
    }
    let failSecond = true
    const inspect = vi.fn(async (_path: string, documentNumber: string) => {
      if (documentNumber === "2023-27784" && failSecond) {
        failSecond = false
        throw new Error("simulated interruption")
      }
      return {
        contract: "fr-pdf-parse-2026-09-14" as const,
        artifactHash: pdfSha256,
        bytes: pdfBytes,
        parserVersion: "fixture",
        pages: record.end_page - record.start_page + 1,
        textHash: digest("text"),
        textCharacters: 4,
        emptyTextPages: [],
        documentNumberFound: true,
        parserChecks: "all_pages_text_and_operators" as const,
        renderingChecked: false as const
      }
    })
    const input = {
      records,
      acquisitionCheckpoint,
      acquisitionReportHash,
      validatorCodeHash,
      pdfDirectory: join(root, "pdfs"),
      validationDirectory: join(root, "validations"),
      concurrency: 2,
      inspect
    }
    const initial = await validateFrPdfDate(input)
    const replay = await validateFrPdfDate(input)
    expect(initial).toMatchObject({
      validationComplete: false,
      results: [{ receipt: { reused: false } }, { status: "failed", reason: "simulated interruption" }]
    })
    expect(replay).toMatchObject({
      validationComplete: true,
      results: [{ receipt: { reused: true } }, { receipt: { reused: false } }]
    })
    expect(inspect).toHaveBeenCalledTimes(3)
  })
})
