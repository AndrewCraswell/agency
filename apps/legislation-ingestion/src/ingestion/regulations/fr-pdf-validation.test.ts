import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, describe, expect, it } from "vitest"
import { frPdfFixture } from "./fixtures/pdf-fixture.js"
import {
  frPdfInspectionSchema,
  inspectFrPdf,
  validateFrPdfEvidence,
  validateFrPdfInWorker
} from "./fr-pdf-validation.js"

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
async function saved(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), "fr-pdf-inspection-"))
  directories.push(directory)
  const path = join(directory, "source.pdf")
  await writeFile(path, bytes)
  return path
}
describe("FR PDF parser validation gate", () => {
  it("parses all page text and operators in a child process and verifies publisher evidence", async () => {
    const bytes = frPdfFixture()
    const inspection = await validateFrPdfInWorker(await saved(bytes), "2023-12345")
    expect(
      validateFrPdfEvidence({ inspection, expectedHash: digest(bytes), expectedBytes: bytes.length, expectedPages: 1 })
    ).toMatchObject({ pages: 1, documentNumberFound: true, renderingChecked: false, emptyTextPages: [] })
    expect(() =>
      validateFrPdfEvidence({
        inspection,
        expectedHash: digest("other"),
        expectedBytes: bytes.length,
        expectedPages: 1
      })
    ).toThrow("hash_mismatch")
    expect(() =>
      validateFrPdfEvidence({ inspection, expectedHash: digest(bytes), expectedBytes: bytes.length, expectedPages: 2 })
    ).toThrow("page_count_mismatch")
  }, 30_000)
  it("rejects signature-only junk that previously passed download marker checks", async () => {
    await expect(inspectFrPdf(await saved(Buffer.from("%PDF-1.7\njunk\n%%EOF\n")), "2023-12345")).rejects.toThrow(
      "Invalid PDF"
    )
  })
  it("does not confirm a document number that is a prefix of another document", async () => {
    const bytes = frPdfFixture()
    const inspection = await inspectFrPdf(await saved(bytes), "2023-1234")
    expect(inspection.documentNumberFound).toBe(false)
    expect(() =>
      validateFrPdfEvidence({ inspection, expectedHash: digest(bytes), expectedBytes: bytes.length, expectedPages: 1 })
    ).toThrow("identity_unconfirmed")
  })
  it("accepts bounded inspection evidence for an official thousand-page rule", () => {
    expect(
      frPdfInspectionSchema.parse({
        contract: "fr-pdf-parse-2026-09-14",
        artifactHash: digest("large-pdf"),
        bytes: 111_796_173,
        parserVersion: "fixture",
        pages: 1105,
        textHash: digest("large-text"),
        textCharacters: 10_000_000,
        emptyTextPages: [],
        documentNumberFound: true,
        parserChecks: "all_pages_text_and_operators",
        renderingChecked: false
      })
    ).toMatchObject({ pages: 1105, bytes: 111_796_173 })
  })
})
