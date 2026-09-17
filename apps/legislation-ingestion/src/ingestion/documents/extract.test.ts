import { zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import {
  assessPdfOcrEligibility,
  assertPdfTextExtractionPageCount,
  DocumentExtractionError,
  extractDocument,
  MAX_DOCUMENT_BYTES,
  MAX_PDF_TEXT_EXTRACTION_PAGES,
  normalizeLegalText,
  sanitizeDatabaseText,
  segmentLegalText
} from "./extract.js"
import { documentRetryAt } from "./jobs.js"
import { boundedProcessingError, classifyDocumentFailure, isTerminalDocumentFailure } from "./process.js"

const encoder = new TextEncoder()
const textPdf = Buffer.from(
  "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCAzMDAgMzAwIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwODE2MDIxMjAzLTA3JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwODE2MDIxMjAzLTA3JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDE3MAo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIDEgMCAwIDEgMzAgMjUwIFRtIChTRUNUSU9OIDEuIFBERiBURVNULikgVGogVCogRVQKQlQgMSAwIDAgMSAzMCAyMzAgVG0gKFRoaXMgUERGIGNvbnRhaW5zIHVzYWJsZSBsZWdpc2xhdGl2ZSB0ZXh0LikgVGogVCogRVQKIAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNDYwIDAwMDAwIG4gCjAwMDAwMDA3MjEgMDAwMDAgbiAKMDAwMDAwMDc4MCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxjNmRmZDc4ZGFlNjRhNWUzMzE5MmUzN2JlZWY5M2QyZD48YzZkZmQ3OGRhZTY0YTVlMzMxOTJlMzdiZWVmOTNkMmQ+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDUgMCBSCi9Sb290IDQgMCBSCi9TaXplIDgKPj4Kc3RhcnR4cmVmCjEwMDAKJSVFT0YK",
  "base64"
)

describe("legislative document extraction", () => {
  it("routes outlined vector text to OCR without treating empty pages as scans", () => {
    const outlined = { hasRasterImage: false, hasVectorGraphics: true, text: "" }
    expect(assessPdfOcrEligibility([outlined])).toEqual({ kind: "image-only", scannedPageCount: 1 })
    expect(
      assessPdfOcrEligibility([
        outlined,
        { hasRasterImage: false, text: "A complete page of digitally encoded legislative text." }
      ])
    ).toEqual({ kind: "mixed-scan", scannedPageCount: 1 })
    expect(assessPdfOcrEligibility([{ hasRasterImage: false, hasVectorGraphics: false, text: "" }])).toEqual({
      kind: "unusable",
      scannedPageCount: 0
    })
  })

  it.each([encoder.encode("<bill><section><?xm-replace_text unclosed"), new Uint8Array([0xff, 0xfe, 0xfd])])(
    "classifies deterministic XML decoding/parser errors as terminal",
    async (bytes) => {
      let failure: unknown
      try {
        await extractDocument("document:invalid-xml", bytes, "application/xml")
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(DocumentExtractionError)
      expect(classifyDocumentFailure(failure)).toMatchObject({ category: "malformed-document", retryable: false })
    }
  )
  it("accepts quoted processing-instruction data from historical Congress XML", async () => {
    // Reduced from the instructions in 109th H.R. 5681 and 111th H.R. 3200.
    const result = await extractDocument(
      "document:congress-pi",
      encoder.encode(
        '<bill><section><?xm-replace_text "?><p>Legislative text must remain intact.</p></section></bill>'
      ),
      "application/xml"
    )
    expect(result.text).toBe("Legislative text must remain intact.")
  })
  it("extracts structured XML and preserves legal section boundaries", async () => {
    const result = await extractDocument(
      "document:xml",
      encoder.encode(
        "<bill><section><heading>SECTION 1. SHORT TITLE.</heading><p>This Act may be cited.</p></section><section><heading>SEC. 2. DEFINITIONS.</heading><p>In this Act, data means information.</p></section></bill>"
      ),
      "application/xml"
    )
    expect(result.sections).toHaveLength(2)
    expect(result.sections.map((section) => section.identifier)).toEqual(["1.", "2."])
    expect(result.sections[0]?.text).toContain("This Act may be cited")
    expect(result.sections[0]).toMatchObject({ startOffset: 0 })
    expect(result.text.slice(result.sections[1]?.startOffset, result.sections[1]?.endOffset)).toBe(
      result.sections[1]?.text
    )
  })

  it("removes HTML chrome and decodes plain text", async () => {
    const html = await extractDocument(
      "document:html",
      encoder.encode(
        "<html><body><nav>Menu</nav><main><h1>SECTION 1. TITLE.</h1><p>Operative text.</p></main><script>bad()</script></body></html>"
      ),
      "text/html; charset=utf-8"
    )
    expect(html.text).not.toContain("Menu")
    expect(html.text).not.toContain("bad")
    expect(html.text).toContain("Operative text")

    const plain = await extractDocument("document:text", encoder.encode("Section 1.\r\n  Legal   text."), "text/plain")
    expect(plain.text).toBe("Section 1.\nLegal text.")
  })

  it("extracts text from a text-bearing PDF", async () => {
    const pdf = await extractDocument("document:pdf", textPdf, "application/pdf")
    expect(pdf.pageCount).toBe(1)
    expect(pdf.text).toContain("PDF contains usable legislative text")
    expect(pdf.sections[0]?.identifier).toBe("1.")
  }, 15_000)

  it("routes PDFs above the safe local extraction limit to managed OCR", () => {
    expect(() => assertPdfTextExtractionPageCount(MAX_PDF_TEXT_EXTRACTION_PAGES)).not.toThrow()
    let failure: unknown
    try {
      assertPdfTextExtractionPageCount(MAX_PDF_TEXT_EXTRACTION_PAGES + 1)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(DocumentExtractionError)
    expect(classifyDocumentFailure(failure)).toMatchObject({
      category: "ocr-required",
      retryable: false
    })
  })

  it("distinguishes digital, image-only, mixed-scan, and unusable PDF pages locally", () => {
    expect(
      assessPdfOcrEligibility([
        {
          hasRasterImage: false,
          text: "A complete page of digitally encoded legislative text suitable for extraction."
        },
        { hasRasterImage: false, text: "Another complete page of digitally encoded legislative text." }
      ])
    ).toEqual({ kind: "digital-text", scannedPageCount: 0 })
    expect(
      assessPdfOcrEligibility([
        { hasRasterImage: true, text: "" },
        { hasRasterImage: true, text: "page 2" }
      ])
    ).toEqual({ kind: "image-only", scannedPageCount: 2 })
    expect(
      assessPdfOcrEligibility([
        {
          hasRasterImage: false,
          text: "A complete page of digitally encoded legislative text suitable for extraction."
        },
        { hasRasterImage: true, text: "scan" },
        { hasRasterImage: false, text: "Another complete page of digitally encoded legislative text." },
        { hasRasterImage: false, text: "A third complete page of digitally encoded legislative text." }
      ])
    ).toEqual({ kind: "mixed-scan", scannedPageCount: 1 })
    expect(
      assessPdfOcrEligibility([
        ...Array.from({ length: 99 }, () => ({
          hasRasterImage: false,
          text: "A complete page of digitally encoded legislative text suitable for extraction."
        })),
        { hasRasterImage: true, text: "scan" }
      ])
    ).toEqual({ kind: "mixed-scan", scannedPageCount: 1 })
    expect(assessPdfOcrEligibility([{ hasRasterImage: false, text: "page number" }])).toEqual({
      kind: "unusable",
      scannedPageCount: 0
    })
  })

  it("extracts bounded text from modern Office documents", async () => {
    const docx = zipSync({
      "word/document.xml": encoder.encode(
        '<w:document xmlns:w="word"><w:body><w:p><w:r><w:t>SECTION 1. DOCX TEXT.</w:t></w:r></w:p><w:p><w:r><w:t>Operative language.</w:t></w:r></w:p></w:body></w:document>'
      )
    })
    const pptx = zipSync({
      "ppt/slides/slide1.xml": encoder.encode(
        '<p:sld xmlns:p="presentation" xmlns:a="drawing"><a:p><a:r><a:t>SECTION 2. SLIDE TEXT.</a:t></a:r></a:p><a:p><a:r><a:t>Presentation language.</a:t></a:r></a:p></p:sld>'
      )
    })
    const xlsx = zipSync({
      "xl/sharedStrings.xml": encoder.encode(
        "<sst><si><t>SECTION 3. WORKBOOK TEXT.</t></si><si><t>Spreadsheet language.</t></si></sst>"
      ),
      "xl/worksheets/sheet1.xml": encoder.encode(
        '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row></sheetData></worksheet>'
      )
    })

    await expect(
      extractDocument("document:docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    ).resolves.toMatchObject({ text: expect.stringContaining("Operative language") })
    await expect(
      extractDocument(
        "document:pptx",
        pptx,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    ).resolves.toMatchObject({ text: expect.stringContaining("Presentation language") })
    await expect(
      extractDocument("document:xlsx", xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    ).resolves.toMatchObject({ text: expect.stringContaining("Spreadsheet language") })
  })

  it("creates deterministic overlapping fallback chunks", () => {
    const text = "A".repeat(9_000)
    const first = segmentLegalText("document:fallback", text)
    const second = segmentLegalText("document:fallback", text)
    expect(first.length).toBeGreaterThan(2)
    expect(first).toEqual(second)
    expect(first[0]?.text.slice(-400)).toBe(first[1]?.text.slice(0, 400))
    expect(first[0]).toMatchObject({ endOffset: 4000, startOffset: 0 })
    expect(first[1]).toMatchObject({ startOffset: 3600 })
  })

  it("recognizes common state hierarchy and operative-provision headings", () => {
    const text = [
      "TITLE III. GENERAL PROVISIONS",
      "Introductory text.",
      "CHAPTER 12",
      "Chapter text.",
      "ARTICLE IV",
      "Article text.",
      "PART A",
      "Part text.",
      "SECTION 12-34-5. APPLICATION.",
      "Section text.",
      "DEFINITIONS.",
      "Definition text.",
      "EFFECTIVE DATE",
      "Effective-date text.",
      "REPEALER.",
      "Repealer text."
    ].join("\n")

    expect(segmentLegalText("document:state", text).map((section) => section.identifier)).toEqual([
      "III.",
      "12",
      "IV",
      "A",
      "12-34-5.",
      "definitions",
      "effective-date",
      "repealer"
    ])
  })

  it("normalizes whitespace and rejects empty, oversized, and unsupported documents", async () => {
    expect(normalizeLegalText(" A\r\n\tB\u0000\u0002 C \n\n\n D ")).toBe("A\nB C\n\nD")
    await expect(extractDocument("document:empty", new Uint8Array(), "text/plain")).rejects.toThrow("empty")
    await expect(
      extractDocument("document:large", new Uint8Array(MAX_DOCUMENT_BYTES + 1), "text/plain")
    ).rejects.toThrow("exceeds")
    await expect(
      extractDocument("document:binary", encoder.encode("data"), "application/octet-stream")
    ).rejects.toThrow("Unsupported")
  })

  it("classifies permanent processing exceptions as terminal", () => {
    expect(isTerminalDocumentFailure("Document download failed with HTTP 404")).toBe(true)
    expect(isTerminalDocumentFailure("Document URL must use HTTPS")).toBe(true)
    expect(isTerminalDocumentFailure("Document redirect changed to an unsupported protocol")).toBe(true)
    expect(isTerminalDocumentFailure("Document exceeds the 26214400 byte limit")).toBe(true)
    expect(isTerminalDocumentFailure("Document produced no usable text")).toBe(true)
    expect(isTerminalDocumentFailure("Invalid PDF structure.")).toBe(true)
    expect(isTerminalDocumentFailure("Document download failed with HTTP 503")).toBe(false)
  })

  it("assigns stable categories and retryability to document failures", () => {
    expect(classifyDocumentFailure(new TypeError("fetch failed"))).toMatchObject({
      category: "download-transient",
      retryable: true
    })
    expect(classifyDocumentFailure("Document download failed with HTTP 429")).toMatchObject({
      category: "download-transient",
      retryable: true
    })
    expect(classifyDocumentFailure("Document download failed with HTTP 403")).toMatchObject({
      category: "download-permanent",
      retryable: false
    })
    expect(classifyDocumentFailure("Invalid PDF structure.")).toMatchObject({
      category: "malformed-document",
      retryable: false
    })
    expect(classifyDocumentFailure("Cannot read properties of undefined (reading 'addChild')")).toMatchObject({
      category: "malformed-document",
      retryable: false
    })
    expect(classifyDocumentFailure("Invalid Root reference.")).toMatchObject({
      category: "malformed-document",
      retryable: false
    })
    expect(classifyDocumentFailure("Bad (uncompressed) XRef entry: 57R")).toMatchObject({
      category: "malformed-document",
      retryable: false
    })
    expect(classifyDocumentFailure("invalid zip data")).toMatchObject({
      category: "malformed-document",
      retryable: false
    })
    expect(classifyDocumentFailure("Document response contains HTML instead of advertised PDF")).toMatchObject({
      category: "download-transient",
      retryable: true
    })
    expect(classifyDocumentFailure("Congress committee repository reports document not found")).toMatchObject({
      category: "not-found",
      retryable: false
    })
    expect(
      classifyDocumentFailure("California bill PDF is not available from publisher (received application/xml)")
    ).toMatchObject({ category: "not-found", retryable: false })
    expect(classifyDocumentFailure("PDF is image-only or contains too little usable text")).toMatchObject({
      category: "ocr-required",
      retryable: false
    })
    expect(
      classifyDocumentFailure(
        new TypeError("fetch failed: getaddrinfo ENOTFOUND alisondb.legislature.state.al.us"),
        "https://alisondb.legislature.state.al.us/ALISON/SearchableInstruments/2017RS/PrintFiles/HB1-int.pdf"
      )
    ).toMatchObject({ category: "source-inaccessible", retryable: false })
    expect(
      classifyDocumentFailure(
        new TypeError("fetch failed: getaddrinfo ENOTFOUND temporary.example.gov"),
        "https://temporary.example.gov/bill.pdf"
      )
    ).toMatchObject({ category: "download-transient", retryable: true })
  })

  it("rejects publisher chrome and unusably short extracted text", async () => {
    await expect(
      extractDocument("document:placeholder", encoder.encode("Download Bill PDF"), "text/plain")
    ).rejects.toThrow("too little usable text")
    await expect(
      extractDocument(
        "document:publisher-page",
        encoder.encode(
          "For full functionality of this site it is necessary to enable JavaScript. California Legislative Information"
        ),
        "text/plain"
      )
    ).rejects.toThrow("publisher navigation")
  })

  it("classifies raster artifacts as deferred OCR work", async () => {
    await expect(
      extractDocument("document:image", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")
    ).rejects.toThrow("requires OCR")
    expect(classifyDocumentFailure("Document is image-only (image/jpeg) and requires OCR")).toMatchObject({
      category: "ocr-required",
      retryable: false
    })
  })

  it("backs durable retries off exponentially with a fixed ceiling", () => {
    const start = new Date("2026-08-17T00:00:00.000Z")
    expect(documentRetryAt(1, start).toISOString()).toBe("2026-08-17T00:05:00.000Z")
    expect(documentRetryAt(2, start).toISOString()).toBe("2026-08-17T00:10:00.000Z")
    expect(documentRetryAt(20, start).toISOString()).toBe("2026-08-17T06:00:00.000Z")
  })

  it("bounds processing errors to database-safe summaries", () => {
    const message = boundedProcessingError(`failed\u0000\u0002\n${"x".repeat(2_000)}`)
    expect(message).not.toContain("\u0000")
    expect(message).not.toContain("\u0002")
    expect(message).toHaveLength(1000)
    expect(message).toMatch(/^failed x+/)
    expect(sanitizeDatabaseText("legal\u007ftext")).toBe("legal text")
  })
})
