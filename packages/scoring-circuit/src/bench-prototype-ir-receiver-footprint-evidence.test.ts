import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"

describe("BP-146 IR receiver footprint source evidence", () => {
  it("accepts the canonical reviewed source record", () => {
    expect(validateBenchPrototypeIrReceiverFootprintEvidence(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
  })

  it.each([
    ["retrievedAtUtc", "2026-08-24T08:17:00Z"],
    ["retrievedAtUtc", "2026-08-24T08:17:00.000+00:00"],
    ["reviewedAtUtc", "2026-02-30T08:17:00.000Z"]
  ])("rejects a non-canonical source timestamp (%s)", (field, value) => {
    const candidate = structuredClone(benchPrototypeIrReceiverFootprintEvidence)
    Object.defineProperty(candidate.sources[0], field, { value, enumerable: true, writable: true, configurable: true })
    expect(() => validateBenchPrototypeIrReceiverFootprintEvidence(candidate)).toThrow(RangeError)
  })

  it("hash-verifies retained primary PDFs and checks stable source markers", () => {
    const packageRoot = new URL("../", import.meta.url)
    const inflatePdfStreams = (bytes: Buffer) => {
      let decoded = ""
      let cursor = 0
      while ((cursor = bytes.indexOf(Buffer.from("stream"), cursor)) >= 0) {
        const streamStart =
          bytes[cursor + 6] === 13 && bytes[cursor + 7] === 10
            ? cursor + 8
            : bytes[cursor + 6] === 10
              ? cursor + 7
              : cursor + 6
        const streamEnd = bytes.indexOf(Buffer.from("endstream"), streamStart)
        if (streamEnd < 0) break
        try {
          decoded += inflateSync(bytes.subarray(streamStart, streamEnd)).toString("latin1")
        } catch {
          // Metadata and uncompressed streams do not need inflation.
        }
        cursor = streamEnd + "endstream".length
      }
      return decoded
    }

    for (const source of benchPrototypeIrReceiverFootprintEvidence.sources) {
      const bytes = readFileSync(new URL(source.retainedArtifactPath, packageRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
      for (const marker of source.byteMarkers) expect(pdfContent).toContain(marker)
    }
  })
})
