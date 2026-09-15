import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { digest } from "./contracts.js"
import { frPdfFixture } from "./fixtures/pdf-fixture.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { inspectFrPdf } from "./fr-pdf-validation.js"
import { normalizeFrHtmlPublication } from "./fr-publication-input.js"

const page = frMetadataPageSchema.parse(
  JSON.parse(await readFile(new URL("./fixtures/fr-2024-01-02-metadata.json", import.meta.url), "utf8"))
)
const record = {
  ...page.results[0],
  document_number: "99-33595",
  publication_date: "2000-01-03",
  volume: 65,
  type: "Notice",
  start_page: 137,
  end_page: 137,
  pdf_url: "https://www.govinfo.gov/content/pkg/FR-2000-01-03/pdf/99-33595.pdf"
}
const htmlBytes = Buffer.from(`<pre>[Federal Register Volume 65, Number 1 (Monday, January 3, 2000)]
[Notices]
[Page 137]
[FR Doc No: 99-33595]
${record.title}
${"Text with preserved indentation.\n    Next line. 🏛️\n".repeat(500)}
[FR Doc. 99-33595 Filed 12-30-99; 8:45 am]</pre>`)

describe("format-aware FR publication normalization", () => {
  it(
    "preserves HTML text, attaches verified PDF evidence, and separates text identity from metadata",
    { timeout: 30_000 },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "fr-publication-input-"))
      try {
        const pdfBytes = frPdfFixture("FR Doc. 99-33595 Filed 12-30-99; 8:45 am")
        const pdfPath = join(directory, "source.pdf")
        await writeFile(pdfPath, pdfBytes)
        const metadataManifestId = digest("metadata")
        const pdfReceipt = {
          unit: {
            metadataManifestId,
            documentNumber: "99-33595",
            publicationDate: "2000-01-03",
            sourceUrl: record.pdf_url
          },
          sha256: digest(pdfBytes),
          bytes: pdfBytes.length,
          acquiredAt: "2026-09-14T00:00:00Z",
          contentType: "application/pdf",
          etag: null,
          lastModified: null,
          status: "acquired",
          structuralValidation: "pending"
        }
        const input = {
          metadataRecord: record,
          metadataManifestId,
          htmlBytes,
          htmlSourceUrl: record.pdf_url.replace("/pdf/", "/html/").replace(".pdf", ".htm"),
          pdfBytes,
          pdfReceipt,
          pdfInspection: await inspectFrPdf(pdfPath, "99-33595")
        }
        const result = normalizeFrHtmlPublication(input)
        expect(result).toMatchObject({
          nativeNumber: "99-33595",
          publicationKind: "notice",
          canonicalWrites: false,
          publicationReady: false,
          textVersion: {
            sourceFormat: "html_preformatted",
            semanticStructure: "not_inferred",
            sourceLocator: "css:pre"
          }
        })
        expect(result.textVersion.blocks.map((block) => block.text).join("")).toBe(result.textVersion.text)
        expect(result.textVersion.blocks.length).toBeGreaterThan(1)
        expect(
          result.textVersion.blocks.every(
            (block) => block.sourceOrdinal === null && block.tag === null && !("xml" in block)
          )
        ).toBe(true)
        expect(normalizeFrHtmlPublication(input)).toEqual(result)
        const changedMetadata = normalizeFrHtmlPublication({
          ...input,
          metadataRecord: { ...record, abstract: "Corrected metadata abstract" }
        })
        expect(changedMetadata.textVersion.key).toBe(result.textVersion.key)
        expect(changedMetadata.observationKey).not.toBe(result.observationKey)
        expect(() => normalizeFrHtmlPublication({ ...input, pdfBytes: Buffer.from("changed") })).toThrow(
          "pdf_hash_mismatch"
        )
        expect(() => normalizeFrHtmlPublication({ ...input, metadataManifestId: digest("different") })).toThrow(
          "pdf_scope_mismatch"
        )
        expect(() => normalizeFrHtmlPublication({ ...input, htmlSourceUrl: "https://example.com/text" })).toThrow(
          "html_location_mismatch"
        )
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  )
})
