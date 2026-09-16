import { gzipSync, zipSync } from "fflate"
import { describe, expect, it } from "vitest"
import { decodeArchiveRecords } from "./archive.js"

const encoder = new TextEncoder()

describe("archive decoding", () => {
  it("decodes bounded JSON, JSONL, gzip, and ZIP inputs", () => {
    expect(decodeArchiveRecords(encoder.encode('[{"id":1}]'))).toEqual([{ id: 1 }])
    expect(decodeArchiveRecords(gzipSync(encoder.encode('[{"id":2}]')))).toEqual([{ id: 2 }])
    expect(decodeArchiveRecords(zipSync({ "bills.jsonl": encoder.encode('{"id":3}\n{"id":4}\n') }))).toEqual([
      { id: 3 },
      { id: 4 }
    ])
  })

  it("rejects archives whose decoded content exceeds the configured bound", () => {
    const large = encoder.encode(JSON.stringify([{ text: "x".repeat(500) }]))
    expect(() => decodeArchiveRecords(gzipSync(large), 100)).toThrow("expands beyond")
    expect(() => decodeArchiveRecords(zipSync({ "large.json": large }), 100)).toThrow("expands beyond")
    expect(() => decodeArchiveRecords(large, 100)).toThrow("exceeds")
  })
})
