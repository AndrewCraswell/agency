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

function capturePaths(value: unknown, path: string[] = []): string[][] {
  if (typeof value !== "object" || value === null) return [path]
  return [path, ...Object.entries(value).flatMap(([key, child]) => capturePaths(child, [...path, key]))]
}

function changeCapture(path: readonly string[], value: unknown): Record<string, unknown> {
  const capture = example()
  let parent: object = capture
  for (const key of path.slice(0, -1)) {
    const next: unknown = Reflect.get(parent, key)
    if (typeof next !== "object" || next === null) throw new Error(`Invalid fixture path ${path.join(".")}`)
    parent = next
  }
  Reflect.set(parent, path.at(-1)!, value)
  return capture
}

describe("comparison capture input boundaries", () => {
  it.each(
    capturePaths(example())
      .filter((path) => path.length > 0)
      .map((path) => ({ path, label: path.join(".") }))
  )("rejects invalid data at $label", ({ path }) => {
    expect(() => parseReferenceMachineComparisonCapture(changeCapture(path, {}))).toThrow(
      ReferenceMachineComparisonCaptureError
    )
  })

  it("rejects broken evidence identities, ranges and references", () => {
    for (const [path, value] of [
      ["captureId", "UPPER CASE"],
      ["session.startedAt", "invalid"],
      ["session.endedAt", "2000-01-01T00:00:00Z"],
      ["scenarioRef.path", "elsewhere.json"],
      ["scenarioRef.schemaVersion", "unknown"],
      ["scenarioRef.contentDigest", "not-a-digest"],
      ["sources.0.page", 0],
      ["sources.3.page", null],
      ["machines.1.firmware.identity", null],
      ["machines.1.firmware.identityStatus", "unknown"],
      ["machines.1.firmware.identityStatus", "not-applicable"],
      ["instruments.0.calibration.status", "current"],
      ["instruments.0.calibration.calibratedAt", "2026-01-01T00:00:00Z"],
      ["instruments.0.calibration.validThrough", "2000-01-01T00:00:00Z"],
      ["inputs.0.sourceInputIds.0", "missing-input"],
      ["inputs.0.artifactIds.0", "missing-artifact"],
      ["inputs.0.sourceId", "missing-machine"],
      ["outputs.0.machineId", "missing-machine"],
      ["outputs.1.decisionRecordRef.schemaVersion", 2],
      ["artifacts.0.throughUs", -1],
      ["artifacts.0.capturedAt", "2000-01-01T00:00:00Z"],
      ["artifacts.0.contentFormat", "NOT A FORMAT"],
      ["comparisons.0.evidenceArtifactIds.0", "missing-artifact"]
    ] satisfies Array<[string, unknown]>) {
      expect(() => parseReferenceMachineComparisonCapture(changeCapture(path.split("."), value)), path).toThrow(
        ReferenceMachineComparisonCaptureError
      )
    }
  })

  it("rejects sparse and accessor-backed evidence arrays", () => {
    for (const mutate of [
      (items: unknown[]) => {
        delete items[0]
      },
      (items: unknown[]) => {
        Object.defineProperty(items, "0", { enumerable: false })
      },
      (items: unknown[]) => {
        Object.defineProperty(items, "0", {
          enumerable: true,
          get() {
            throw new Error("must not execute")
          }
        })
      }
    ]) {
      const value = example()
      if (!Array.isArray(value.sources)) throw new Error("Missing sources")
      mutate(value.sources)
      expect(() => parseReferenceMachineComparisonCapture(value)).toThrow(ReferenceMachineComparisonCaptureError)
    }
    expect(isReferenceMachineComparisonCapture({})).toBe(false)
  })
})

it("rejects contradictory comparison and calibration evidence", () => {
  const known = parseReferenceMachineComparisonCapture(example())
  const calibration = {
    status: "current",
    calibratedAt: "2026-01-01T00:00:00Z",
    validThrough: "2027-01-01T00:00:00Z",
    certificateDigest: `sha256:${"a".repeat(64)}`
  }
  for (const [path, value] of [
    ["sources", []],
    ["scenarioRef.inputIds", ["same", "same"]],
    [
      "machines.1.firmware",
      {
        ...known.machines[1]!.firmware,
        identityStatus: "unknown",
        identity: null,
        version: null,
        buildDigest: `sha256:${"a".repeat(64)}`
      }
    ],
    ["instruments.0.calibration", { ...calibration, calibratedAt: null }],
    ["instruments.0.calibration", { ...calibration, validThrough: null }],
    ["instruments.0.calibration", { ...calibration, status: "expired", validThrough: "2000-01-01T00:00:00Z" }],
    ["inputs.0.measurement.uncertainty", { kind: "absolute", value: null }],
    ["inputs.0.measurement.instrumentId", "unknown"],
    ["outputs.0.artifactIds", ["unknown"]],
    ["artifacts.0.fromUs", 60_000_000],
    ["machines.1.sourceIds", ["unknown"]],
    ["setup.fixtureId", "unknown"],
    ["outputs.0.id", known.inputs[0]!.id],
    ["comparisons.0.left.observationId", "unknown"],
    ["comparisons.0.right.observationId", "unknown"],
    ["comparisons.0.left.machineId", "unknown"],
    ["comparisons.0.dimension", "input-state"],
    ["comparisons.0.left", { machineId: "fixture", observationId: known.inputs[0]!.id }],
    ["comparisons.0.right", { machineId: "fixture", observationId: known.inputs[0]!.id }]
  ] satisfies Array<[string, unknown]>) {
    expect(() => parseReferenceMachineComparisonCapture(changeCapture(path.split("."), value)), path).toThrow(
      ReferenceMachineComparisonCaptureError
    )
  }
})

it("accepts optional observations and saturates session duration safely", () => {
  const source = parseReferenceMachineComparisonCapture(example())
  const measurement = source.inputs[0]!.measurement
  const optional = {
    ...source,
    notes: undefined,
    inputs: source.inputs.map(({ measurement: _measurement, ...input }) => input),
    outputs: source.outputs.map(({ notes: _notes, decisionRecordRef: _record, ...output }) => ({
      ...output,
      indication: { ...output.indication, latched: null },
      measurement,
      reportedDisposition: null
    }))
  }
  Reflect.deleteProperty(optional, "notes")
  expect(isReferenceMachineComparisonCapture(optional)).toBe(true)
  for (const session of [
    { ...source.session, startedAt: "0001-01-01T00:00:00Z", endedAt: "9999-01-01T00:00:00Z" },
    { ...source.session, wallClockUncertaintyUs: Number.MAX_SAFE_INTEGER }
  ])
    expect(parseReferenceMachineComparisonCapture({ ...source, session }).session).toEqual(session)
  expect(() =>
    parseReferenceMachineComparisonCapture({
      ...source,
      session: { ...source.session, wallClockUncertaintyUs: Number.MAX_SAFE_INTEGER },
      inputs: [{ ...source.inputs[0], atUs: Number.MAX_SAFE_INTEGER, atUncertaintyUs: 1 }]
    })
  ).toThrow(/safe integer/)
  const inputs = [
    { ...source.inputs[0]!, sourceId: "fixture" },
    { ...source.inputs[1]!, sourceId: "scoring-prototype" }
  ]
  const comparison = {
    ...source.comparisons[0]!,
    dimension: "input-state",
    left: { machineId: "fixture", observationId: inputs[0]!.id },
    right: { machineId: "scoring-prototype", observationId: inputs[1]!.id }
  }
  expect(
    parseReferenceMachineComparisonCapture({ ...source, inputs, comparisons: [comparison] }).comparisons[0]!.dimension
  ).toBe("input-state")
})

it("handles non-Error property traps and rejects false array lengths", () => {
  const trap = new Proxy(
    {},
    {
      ownKeys() {
        throw "hostile property trap"
      }
    }
  )
  expect(() => parseReferenceMachineComparisonCapture(trap)).toThrow(ReferenceMachineComparisonCaptureError)
  expect(() => parseReferenceMachineComparisonCapture({ ...example(), session: trap })).toThrow(
    ReferenceMachineComparisonCaptureError
  )
  const source = parseReferenceMachineComparisonCapture(example())
  const mutable = [...source.sources]
  const lengths = new Proxy(mutable, {
    getOwnPropertyDescriptor(target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
      return key === "length" ? { ...descriptor, value: 99 } : descriptor
    }
  })
  expect(() => parseReferenceMachineComparisonCapture({ ...source, sources: lengths })).toThrow(/data length/)
  const failure = new Error("array inspection failed")
  const broken = new Proxy([], {
    getPrototypeOf() {
      throw failure
    }
  })
  expect(() => isReferenceMachineComparisonCapture({ ...source, sources: broken })).toThrow(failure)
  expect(
    parseReferenceMachineComparisonCapture({ ...source, setup: { ...source.setup, fixtureId: null } }).setup.fixtureId
  ).toBeNull()
  expect(
    parseReferenceMachineComparisonCapture({
      ...source,
      inputs: source.inputs.map((input) => ({ ...input, notes: "Observed" }))
    }).inputs[0]!.notes
  ).toBe("Observed")
})
