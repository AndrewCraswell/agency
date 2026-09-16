import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { afterEach, describe, expect, it } from "vitest"
import { frPdfFixture } from "./fixtures/pdf-fixture.js"
import { frPdfTextExtractorHash, stageFrPdfText } from "./fr-pdf-text.js"

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})
async function input(imageOnly = false) {
  const directory = await mkdtemp(join(tmpdir(), "fr-pdf-text-"))
  directories.push(directory)
  await mkdir(join(directory, "blobs"))
  const bytes = frPdfFixture(undefined, imageOnly)
  const sha256 = digest(bytes)
  await writeFile(join(directory, "blobs", `${sha256}.pdf`), bytes)
  return {
    directory,
    output: join(directory, "text"),
    expectedPages: 1,
    extractorHash: await frPdfTextExtractorHash(),
    receipt: {
      unit: {
        metadataManifestId: digest("metadata"),
        documentNumber: "2023-12345",
        publicationDate: "2024-01-02",
        sourceUrl: "https://www.govinfo.gov/content/pkg/FR-2024-01-02/pdf/2023-12345.pdf"
      },
      sha256,
      bytes: bytes.length,
      acquiredAt: "2026-09-14T00:00:00Z",
      contentType: "application/pdf",
      etag: null,
      lastModified: null,
      status: "acquired",
      structuralValidation: "pending"
    }
  }
}
describe("offline FR PDF text staging", () => {
  it("retains image-only sources as OCR required with unconfirmed identity", { timeout: 30_000 }, async () => {
    const args = await input(true)
    const result = await stageFrPdfText(args)
    expect(result.artifact).toMatchObject({
      publicationReady: false,
      evidence: { inspection: { documentNumberFound: false }, result: { status: "ocr_required" } }
    })
    expect((await stageFrPdfText(args)).reused).toBe(true)
  })
  it(
    "extracts in an isolated worker, reuses exact evidence, and rejects corrupted text",
    { timeout: 30_000 },
    async () => {
      const args = await input()
      const first = await stageFrPdfText(args)
      expect(first).toMatchObject({
        reused: false,
        artifact: {
          canonicalWrites: false,
          publicationReady: false,
          evidence: { result: { status: "extracted", text: "FR Doc. 2023-12345 Filed 12-29-23" } }
        }
      })
      expect(await stageFrPdfText(args)).toEqual({ ...first, reused: true })
      const target = join(args.output, `${first.artifact.generation}.json`)
      const serialized = await readFile(target, "utf8")
      await writeFile(target, serialized.replace('"text":"FR Doc.', '"text":"XX Doc.'))
      await expect(stageFrPdfText(args)).rejects.toThrow("fr_pdf_extracted_text_hash_mismatch")
    }
  )
  it("blocks mismatched page evidence and changed raw bytes", { timeout: 30_000 }, async () => {
    const args = await input()
    await expect(stageFrPdfText({ ...args, expectedPages: 2 })).rejects.toThrow("page_count_mismatch")
    const source = join(args.directory, "blobs", `${args.receipt.sha256}.pdf`)
    const bytes = await readFile(source)
    bytes[0] = 0
    await writeFile(source, bytes)
    await expect(stageFrPdfText(args)).rejects.toThrow("source_hash_mismatch")
  })
})
