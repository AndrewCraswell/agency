import { describe, expect, it, vi } from "vitest"
import { detectDocumentContentType, downloadDocument } from "./download.js"

describe("document downloads", () => {
  it("upgrades legacy HTTP source links to HTTPS", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("SECTION 1. Secure text.", {
        headers: { "content-type": "text/plain" },
        status: 200
      })
    )

    await expect(downloadDocument("http://example.gov/bill.txt", { fetch: fetcher })).resolves.toMatchObject({
      contentType: "text/plain"
    })
    expect(fetcher).toHaveBeenCalledWith(new URL("https://example.gov/bill.txt"), expect.any(Object))
  })

  it("submits the California bill PDF auto-download form", async () => {
    const form = `
      <html><body><form id="downloadForm" action="/faces/billPdf.xhtml">
        <input name="javax.faces.ViewState" value="view-state" />
      </form></body></html>`
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(form, {
          headers: { "content-type": "text/html; charset=UTF-8", "set-cookie": "session=abc; Path=/" }
        })
      )
      .mockResolvedValueOnce(new Response("%PDF-test", { headers: { "content-type": "application/pdf" }, status: 200 }))

    const result = await downloadDocument(
      "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202120220AB819&version=20210AB81994CHP",
      { fetch: fetcher }
    )

    expect(result.contentType).toBe("application/pdf")
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[0]).toEqual(new URL("https://leginfo.legislature.ca.gov/faces/billPdf.xhtml"))
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      body: new URLSearchParams({
        "javax.faces.ViewState": "view-state",
        bill_id: "202120220AB819",
        downloadForm: "downloadForm",
        pdf_link2: "pdf_link2",
        version: "20210AB81994CHP"
      }),
      method: "POST"
    })
  })

  it("detects supported content when provider metadata is missing or generic", () => {
    expect(detectDocumentContentType(new TextEncoder().encode("%PDF-1.7"), "application/octet-stream")).toBe(
      "application/pdf"
    )
    expect(detectDocumentContentType(new TextEncoder().encode("SECTION 1. Text"))).toBe("text/plain")
    expect(detectDocumentContentType(new TextEncoder().encode('<?xml version="1.0"?><bill/>'))).toBe("application/xml")
  })

  it("does not pass an HTML interstitial to the PDF extractor", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<!doctype html><html><body>Temporarily unavailable</body></html>", {
        headers: { "content-type": "application/pdf" }
      })
    )

    await expect(downloadDocument("https://example.gov/bill.pdf", { fetch: fetcher })).resolves.toMatchObject({
      contentType: "text/html"
    })
  })

  it("rejects unknown binary content after bounded sniffing", () => {
    expect(() => detectDocumentContentType(new Uint8Array([0, 1, 2, 3]), "application/octet-stream")).toThrow(
      "Unsupported document content type"
    )
  })
})
