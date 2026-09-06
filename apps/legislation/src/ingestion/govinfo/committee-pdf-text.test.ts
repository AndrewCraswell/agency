import { describe, expect, it, vi } from "vitest"
import { extractGovInfoCommitteePdfText } from "./committee-pdf-text.js"

const mocks = vi.hoisted(() => ({ getDocument: vi.fn<() => unknown>() }))
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: mocks.getDocument }))

describe("GovInfo PDF coordinate reading order", () => {
  it("orders a heading before its roster even when the content stream emits members first", async () => {
    const destroy = vi.fn<() => void>()
    mocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          view: [0, 0, 612, 792],
          getTextContent: async () => ({
            items: [
              { str: "John Person (OR)", transform: [1, 0, 0, 1, 320, 600], width: 90, height: 8 },
              { str: "Jane Person (WA) CHAIR", transform: [1, 0, 0, 1, 90, 600], width: 180, height: 8 },
              { str: "DEFENSE", transform: [1, 0, 0, 1, 250, 630], width: 60, height: 10 }
            ]
          }),
          cleanup: vi.fn<() => void>()
        })
      }),
      destroy
    })
    const result = await extractGovInfoCommitteePdfText(new Uint8Array([1]))
    expect(result.indexOf("DEFENSE")).toBeLessThan(result.indexOf("Jane Person"))
    expect(result).toContain("Jane Person (WA) CHAIR    John Person (OR)")
    expect(destroy).toHaveBeenCalledOnce()
  })
})
