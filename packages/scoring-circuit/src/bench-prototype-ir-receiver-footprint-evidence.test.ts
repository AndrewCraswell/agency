import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"

function inflatePdfStreams(bytes: Buffer) {
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

describe("BP-146 IR receiver footprint source evidence", () => {
  it("accepts the canonical reviewed source record", () => {
    expect(validateBenchPrototypeIrReceiverFootprintEvidence(benchPrototypeIrReceiverFootprintEvidence)).toBe(true)
    expect(benchPrototypeIrReceiverFootprintEvidence.publishedElectricalOpticalCharacteristics).toEqual({
      sourceId: "vishay-82491-tsop38438-datasheet",
      sourcePages: "2-3",
      carrierFrequencyKHz: 38,
      agcVariant: "AGC4",
      supplyVoltageV: { minimum: 2, maximum: 5.5 },
      supplyCurrentAtVs3V3mA: {
        minimum: 0.25,
        typical: 0.35,
        maximum: 0.45,
        testCondition: "Ev = 0, VS = 3.3 V"
      },
      transmissionDistanceTest: {
        nominalDistanceM: 30,
        testCondition: "Ev = 0, TSAL6200 IR diode, IF = 50 mA, test signal see Fig. 1"
      },
      halfTransmissionAngleDegrees: 45,
      outputDelaySpecification: "7/f0 < td < 13/f0",
      outputDelayTestCondition: "f0 = carrier frequency, test signal see Fig. 1",
      qualificationState:
        "datasheet-characteristics-only; bench range, angle, latency, flood, reset, and power-off evidence required"
    })
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
    for (const source of benchPrototypeIrReceiverFootprintEvidence.sources) {
      const bytes = readFileSync(new URL(source.retainedArtifactPath, packageRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      const pdfContent = `${bytes.toString("latin1")}\n${inflatePdfStreams(bytes)}`
      for (const marker of source.byteMarkers) expect(pdfContent).toContain(marker)
    }
  })
})
