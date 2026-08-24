import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ReferenceMachineComparisonCaptureError,
  isReferenceMachineComparisonCapture,
  parseReferenceMachineComparisonCapture
} from "./reference-machine-comparison-capture.js"

function example(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(new URL("../docs/reference-machine-comparison-capture.example.json", import.meta.url), "utf8")
  ) as Record<string, unknown>
}

function expectCaptureError(action: () => unknown, code: ReferenceMachineComparisonCaptureError["code"]): void {
  try {
    action()
    throw new Error("expected capture parser to reject the value")
  } catch (error) {
    expect(error).toBeInstanceOf(ReferenceMachineComparisonCaptureError)
    expect((error as ReferenceMachineComparisonCaptureError).code).toBe(code)
  }
}

describe("reference-machine comparison capture", () => {
  it("parses the bounded example and freezes every evidence boundary", () => {
    const parsed = parseReferenceMachineComparisonCapture(example())

    expect(parsed.format).toBe("scoring-reference-machine-comparison-capture")
    expect(parsed.schemaVersion).toBe("1.0.0")
    expect(parsed.sources.find(({ id }) => id === "favero-t2016")?.authority).toBe("prior-art")
    expect(parsed.sources.find(({ id }) => id === "favero-t2016")?.use).toBe("comparison-context")
    expect(parsed.comparisons[0]?.relationship).toBe("same")
    expect(parsed.comparisons[1]?.relationship).toBe("different")
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed.sources)).toBe(true)
    expect(Object.isFrozen(parsed.sources[0])).toBe(true)
    expect(Object.isFrozen(parsed.sources[0]?.authority)).toBe(true)
    expect(Object.isFrozen(parsed.comparisons[1]?.delta)).toBe(true)
  })

  it("rejects unknown keys and non-plain data before reading values", () => {
    const unknownField = example()
    unknownField.expected = { disposition: "qualified-hit" }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(unknownField), "fields")

    const accessor = example()
    Object.defineProperty(accessor, "notes", { enumerable: true, get: () => "read me" })
    expectCaptureError(() => parseReferenceMachineComparisonCapture(accessor), "fields")

    const nullPrototype = example()
    Object.setPrototypeOf(nullPrototype, null)
    expectCaptureError(() => parseReferenceMachineComparisonCapture(nullPrototype), "fields")

    const symbolic = example()
    Object.defineProperty(symbolic, Symbol("evidence"), { enumerable: true, value: "not-json" })
    expectCaptureError(() => parseReferenceMachineComparisonCapture(symbolic), "fields")
  })

  it("fails closed for unsupported versions and authority promotion", () => {
    const unknownVersion = example()
    unknownVersion.schemaVersion = "2.0.0"
    expectCaptureError(() => parseReferenceMachineComparisonCapture(unknownVersion), "value")

    const priorArtAsNormative = example()
    const sources = priorArtAsNormative.sources as Array<Record<string, unknown>>
    sources[3] = { ...sources[3], use: "normative-context" }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(priorArtAsNormative), "authority")

    const implementationWithPage = example()
    const implementationSources = implementationWithPage.sources as Array<Record<string, unknown>>
    implementationSources[0] = { ...implementationSources[0], page: 1 }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(implementationWithPage), "authority")
  })

  it("requires resolvable provenance and keeps comparison disposition descriptive", () => {
    const missingArtifact = example()
    const outputs = missingArtifact.outputs as Array<Record<string, unknown>>
    outputs[0] = { ...outputs[0], artifactIds: ["artifact-does-not-exist"] }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(missingArtifact), "reference")

    const sameMachineComparison = example()
    const comparisons = sameMachineComparison.comparisons as Array<Record<string, unknown>>
    comparisons[0] = {
      ...comparisons[0],
      left: { machineId: "scoring-prototype", observationId: "prototype-output-001" },
      right: { machineId: "scoring-prototype", observationId: "prototype-output-001" }
    }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(sameMachineComparison), "value")

    const parsed = parseReferenceMachineComparisonCapture(example())
    expect(parsed.outputs[0]?.reportedDisposition).toBe("qualified-hit")
    expect(parsed.outputs[0]?.decisionRecordRef).toBeNull()
    expect(parsed.comparisons[0]).not.toHaveProperty("expected")
    expect(parsed.comparisons[0]).not.toHaveProperty("threshold")
  })

  it("enforces equipment calibration, uncertainty, units, and bounded timestamps", () => {
    const currentWithoutCertificate = example()
    const instruments = currentWithoutCertificate.instruments as Array<Record<string, unknown>>
    instruments[0] = {
      ...instruments[0],
      calibration: {
        status: "current",
        calibratedAt: "2026-08-22T17:00:00Z",
        validThrough: "2026-08-23T17:00:00Z",
        certificateDigest: null
      }
    }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(currentWithoutCertificate), "authority")

    const unknownUncertainty = example()
    const setup = unknownUncertainty.setup as Record<string, unknown>
    const environment = setup.environment as Array<Record<string, unknown>>
    environment[0] = {
      ...environment[0],
      measurement: {
        ...(environment[0]?.measurement as Record<string, unknown>),
        uncertainty: { kind: "unknown", value: 1 }
      }
    }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(unknownUncertainty), "value")

    const negativeResistance = example()
    const inputs = negativeResistance.inputs as Array<Record<string, unknown>>
    inputs[0] = {
      ...inputs[0],
      measurement: { ...(inputs[0]?.measurement as Record<string, unknown>), value: -1 }
    }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(negativeResistance), "integer")

    const outsideSessionArtifact = example()
    const artifacts = outsideSessionArtifact.artifacts as Array<Record<string, unknown>>
    artifacts[0] = { ...artifacts[0], capturedAt: "2026-08-22T19:00:00Z" }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(outsideSessionArtifact), "value")

    const outsideSessionObservation = example()
    const outputs = outsideSessionObservation.outputs as Array<Record<string, unknown>>
    outputs[0] = { ...outputs[0], atUs: Number.MAX_SAFE_INTEGER }
    expectCaptureError(() => parseReferenceMachineComparisonCapture(outsideSessionObservation), "bounds")
  })

  it("exposes a fail-closed type guard", () => {
    expect(isReferenceMachineComparisonCapture(example())).toBe(true)
    expect(isReferenceMachineComparisonCapture({})).toBe(false)
    expect(isReferenceMachineComparisonCapture(null)).toBe(false)
  })
})
