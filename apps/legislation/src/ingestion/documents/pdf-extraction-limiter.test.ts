import { describe, expect, it } from "vitest"
import { createPdfExtractionLimiter } from "./pdf-extraction-limiter.js"

describe("createPdfExtractionLimiter", () => {
  it("serializes concurrent PDF extraction without blocking non-PDF work", async () => {
    const limiter = createPdfExtractionLimiter()
    let activePdfs = 0
    let maximumActivePdfs = 0
    let releaseFirstPdf: (() => void) | undefined
    const firstPdfGate = new Promise<void>((resolve) => {
      releaseFirstPdf = resolve
    })
    let nonPdfRan = false

    const firstPdf = limiter.run("application/pdf", async () => {
      activePdfs += 1
      maximumActivePdfs = Math.max(maximumActivePdfs, activePdfs)
      await firstPdfGate
      activePdfs -= 1
    })
    const secondPdf = limiter.run("application/pdf; charset=binary", async () => {
      activePdfs += 1
      maximumActivePdfs = Math.max(maximumActivePdfs, activePdfs)
      activePdfs -= 1
    })
    await limiter.run("text/html", async () => {
      nonPdfRan = true
    })

    expect(nonPdfRan).toBe(true)
    expect(maximumActivePdfs).toBe(1)
    releaseFirstPdf?.()
    await Promise.all([firstPdf, secondPdf])
    expect(maximumActivePdfs).toBe(1)
  })

  it("rejects an invalid concurrency limit", () => {
    expect(() => createPdfExtractionLimiter(0)).toThrow("positive integer")
  })

  it("releases the shared slot after a failed extraction", async () => {
    const limiter = createPdfExtractionLimiter()
    const gate = Promise.withResolvers<void>()
    const failed = limiter.run("application/pdf", async () => {
      await gate.promise
      throw new Error("decoder failed")
    })
    const observed = failed.catch((error: unknown) => error)
    const next = limiter.run("application/pdf", async () => "next batch")
    gate.resolve()
    expect(await observed).toEqual(new Error("decoder failed"))
    await expect(next).resolves.toBe("next batch")
  })
})
