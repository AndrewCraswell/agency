import { beforeEach, expect, it, vi } from "vitest"
import { extractDocument } from "./extract.js"

type TestPage = {
  cleanup: () => void
  getTextContent: () => Promise<{ items: { str: string }[] }>
}
const pdf = vi.hoisted(() => ({ getDocument: vi.fn<() => unknown>() }))
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: pdf.getDocument,
  OPS: { constructPath: 1, paintImageXObject: 2 }
}))
beforeEach(() => vi.clearAllMocks())

it("releases each decoded page before reading the next page", async () => {
  const cleanup = vi.fn<() => void>()
  const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const getPage = vi.fn<(number: number) => Promise<TestPage>>(async (number) => {
    expect(cleanup).toHaveBeenCalledTimes(number - 1)
    return {
      cleanup,
      getTextContent: async () => ({
        items: [{ str: "This legislative document contains enough digital text for extraction." }]
      })
    }
  })
  pdf.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 3, getPage }), destroy })
  await extractDocument("document:pages", new TextEncoder().encode("%PDF-1.7"), "application/pdf")
  expect(cleanup).toHaveBeenCalledTimes(3)
  expect(destroy).toHaveBeenCalledOnce()
})

it("releases page resources and the document when decoding fails", async () => {
  const cleanup = vi.fn<() => void>()
  const destroy = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  pdf.getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        cleanup,
        getTextContent: async () => {
          throw new Error("page decoding failed")
        }
      })
    }),
    destroy
  })
  await expect(
    extractDocument("document:broken", new TextEncoder().encode("%PDF-1.7"), "application/pdf")
  ).rejects.toThrow("page decoding failed")
  expect(cleanup).toHaveBeenCalledOnce()
  expect(destroy).toHaveBeenCalledOnce()
})
