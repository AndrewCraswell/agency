import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  assertCurrentGoldenVectorExport,
  createGoldenVectorExport,
  deriveSabreInterruptionAtUs,
  GOLDEN_VECTOR_EXPORT_FORMAT,
  GOLDEN_VECTOR_EXPORT_SCHEMA_VERSION,
  serializeGoldenVectorExport
} from "./golden-vector-exporter.js"

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    )
  }

  return value
}

describe("golden-vector exporter", () => {
  it("derives the complete all-weapon M1-08 runtime corpus", () => {
    const exported = createGoldenVectorExport()

    expect(exported.format).toBe(GOLDEN_VECTOR_EXPORT_FORMAT)
    expect(exported.schemaVersion).toBe(GOLDEN_VECTOR_EXPORT_SCHEMA_VERSION)
    expect(exported.source).toBe("m1-08-runtime-boundary-vectors")
    expect(exported.ordering).toBe("m1-08-generation-order")
    expect(exported.ruleSetRevision).toBe("rules-1")
    expect(exported.timingTableRevision).toBe("timing-1")
    expect(exported.timeUnit).toBe("us")
    expect(exported.resistanceUnit).toBe("milliOhm")
    expect(exported.vectors).toHaveLength(54)
    expect(new Set(exported.vectors.map(({ weapon }) => weapon))).toEqual(new Set(["epee", "foil", "sabre"]))
    expect(exported.vectors.every(({ stimulus }) => stimulus.samples.length > 0)).toBe(true)
  })

  it("uses rule-derived inputs and expected outcomes at every selected endpoint", () => {
    const exported = createGoldenVectorExport()
    const byId = new Map(exported.vectors.map((vector) => [vector.id, vector]))

    expect(byId.get("epee.contact-minimum.left.below")?.expected.hits).toHaveLength(0)
    expect(byId.get("epee.contact-minimum.left.at")?.expected.hits).toHaveLength(1)
    expect(byId.get("epee.double-hit-window.left.above")?.expected.hits).toHaveLength(1)
    expect(byId.get("epee.double-hit-window.left.at")?.expected.hits).toHaveLength(2)
    expect(byId.get("foil.lockout.left.below")?.expected.hits).toHaveLength(2)
    expect(byId.get("foil.lockout.left.at")?.expected.hits).toHaveLength(1)
    expect(byId.get("sabre.blade-registration-latest.left.above")?.expected.hits).toHaveLength(0)
    expect(byId.get("sabre.blade-recovery.left.below")?.expected.hits).toHaveLength(0)
    expect(byId.get("sabre.blade-recovery.left.at")?.expected.hits).toHaveLength(1)
    expect(byId.get("sabre.control-break.left.below")?.expected.disposition).toBe("diagnostic")
    expect(byId.get("sabre.control-break.left.below")?.expected.diagnostics).toContainEqual({
      code: "sabre-white",
      side: "left",
      value: "white-off"
    })
  })

  it("fails closed when the sabre pre-boundary sample cannot be derived", () => {
    expect(deriveSabreInterruptionAtUs(100)).toBe(99)
    expect(() => deriveSabreInterruptionAtUs(0)).toThrow(
      new RangeError("timing-1 sabre minimum contact must permit a pre-boundary sample")
    )
    expect(() => deriveSabreInterruptionAtUs("100")).toThrow(
      new RangeError("timing-1 sabre minimum contact must permit a pre-boundary sample")
    )
  })

  it("does not export references or planned and unsupported sources", () => {
    const exported = createGoldenVectorExport()

    expect(exported.vectors.every(({ id }) => !id.includes("sensitivity-test-point"))).toBe(true)
    expect(() => createGoldenVectorExport({ scenarioStatus: "planned" })).toThrow(
      new RangeError("Planned M0-07 scenarios cannot be exported as firmware vectors")
    )
    expect(() => createGoldenVectorExport({ scenarioStatus: "unsupported" })).toThrow(
      new RangeError("Unsupported M0-07 scenario status")
    )
    expect(() => createGoldenVectorExport(null)).toThrow(
      new TypeError("Golden-vector export options must be an object")
    )
    expect(() => createGoldenVectorExport({ source: "golden-scenario-manifest" })).toThrow(
      new RangeError("Unsupported golden-vector export source")
    )
    expect(() => createGoldenVectorExport({ timingTableRevision: "timing-2" })).toThrow(
      new RangeError("Unsupported timing-table revision")
    )
    expect(() => createGoldenVectorExport({ unexpected: true })).toThrow(
      new TypeError("Golden-vector export options contain an unsupported field")
    )
  })

  it("serializes repeated exports byte-identically with a content digest", () => {
    const first = serializeGoldenVectorExport(createGoldenVectorExport())
    const second = serializeGoldenVectorExport(createGoldenVectorExport())

    expect(second).toBe(first)
    expect(first.endsWith("\n")).toBe(true)
    expect(createHash("sha256").update(first, "utf8").digest("hex")).toHaveLength(64)
  })

  it("detects a stale generated artifact and accepts the current one", () => {
    const current = createGoldenVectorExport()

    expect(() => assertCurrentGoldenVectorExport(current)).not.toThrow()
    expect(() =>
      assertCurrentGoldenVectorExport({
        ...current,
        vectors: current.vectors.slice(0, -1)
      })
    ).toThrow(new RangeError("Golden-vector export digest mismatch"))
  })

  it("rejects an altered timing identity in a checked artifact", () => {
    const current = createGoldenVectorExport()
    const altered = {
      ...current,
      timingTableRevision: "timing-2"
    } as unknown as typeof current

    expect(() => serializeGoldenVectorExport(altered)).toThrow(new RangeError("Golden-vector export digest mismatch"))
  })

  it("rejects non-JSON values before a malformed artifact can be serialized", () => {
    const current = createGoldenVectorExport()
    const malformed = {
      ...current,
      vectors: undefined
    } as unknown as typeof current

    expect(() => serializeGoldenVectorExport(malformed)).toThrow(
      new TypeError("Golden-vector export contains a non-JSON value")
    )
  })

  it("reports a stale artifact after its digest is internally repaired", () => {
    const current = createGoldenVectorExport()
    const alteredWithoutDigest = {
      ...current,
      vectors: current.vectors.slice(0, -1)
    }
    const { digest: _digest, ...unsigned } = alteredWithoutDigest
    const repaired = {
      ...alteredWithoutDigest,
      digest: `sha256:${createHash("sha256")
        .update(JSON.stringify(canonicalize(unsigned)), "utf8")
        .digest("hex")}`
    } as unknown as typeof current

    expect(() => assertCurrentGoldenVectorExport(repaired)).toThrow(new RangeError("Stale golden-vector export"))
  })

  it("accepts the checked language-neutral artifact", () => {
    const rawArtifact = readFileSync(new URL("../fixtures/golden-vector-export.json", import.meta.url), "utf8")
    const artifact = JSON.parse(rawArtifact)

    expect(() => assertCurrentGoldenVectorExport(artifact)).not.toThrow()
    expect(rawArtifact).toBe(serializeGoldenVectorExport(createGoldenVectorExport()))
  })
})
