import { describe, expect, it } from "vitest"
import {
  extractDocument,
  MAX_DOCUMENT_BYTES,
  normalizeLegalText,
  sanitizeDatabaseText,
  segmentLegalText
} from "./extract.js"
import { boundedProcessingError, isTerminalDocumentFailure } from "./process.js"

const encoder = new TextEncoder()
const textPdf = Buffer.from(
  "JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCAzMDAgMzAwIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwODE2MDIxMjAzLTA3JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwODE2MDIxMjAzLTA3JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDE3MAo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIDEgMCAwIDEgMzAgMjUwIFRtIChTRUNUSU9OIDEuIFBERiBURVNULikgVGogVCogRVQKQlQgMSAwIDAgMSAzMCAyMzAgVG0gKFRoaXMgUERGIGNvbnRhaW5zIHVzYWJsZSBsZWdpc2xhdGl2ZSB0ZXh0LikgVGogVCogRVQKIAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNDYwIDAwMDAwIG4gCjAwMDAwMDA3MjEgMDAwMDAgbiAKMDAwMDAwMDc4MCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzxjNmRmZDc4ZGFlNjRhNWUzMzE5MmUzN2JlZWY5M2QyZD48YzZkZmQ3OGRhZTY0YTVlMzMxOTJlMzdiZWVmOTNkMmQ+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDUgMCBSCi9Sb290IDQgMCBSCi9TaXplIDgKPj4Kc3RhcnR4cmVmCjEwMDAKJSVFT0YK",
  "base64"
)

describe("legislative document extraction", () => {
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
    expect(pdf.text).toContain("PDF contains usable legislative text")
    expect(pdf.sections[0]?.identifier).toBe("1.")
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
    expect(isTerminalDocumentFailure("Document exceeds the 26214400 byte limit")).toBe(true)
    expect(isTerminalDocumentFailure("Document produced no usable text")).toBe(true)
    expect(isTerminalDocumentFailure("Document download failed with HTTP 503")).toBe(false)
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
