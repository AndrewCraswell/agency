import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  DisplayFixtureValidationError,
  MAX_DISPLAY_FIXTURE_CASES,
  MAX_DISPLAY_FIXTURE_TEXT_LENGTH,
  parseDisplayFixtureDocument,
  type DisplayFixtureDocument
} from "./scenario-display-fixtures.js"
import { projectScenarioDisplay } from "./scenario-display-projection.js"

const fixturePath = resolve(import.meta.dirname, "../fixtures/scenario-display-states.json")
const fixtureJson = readFileSync(fixturePath, "utf8")
const fixtures = parseDisplayFixtureDocument(JSON.parse(fixtureJson))
type MutableFixtureDocument = {
  cases: {
    case: {
      expected: {
        decisions: Record<string, unknown>[]
        nonEvents: Record<string, unknown>[]
        status?: unknown
        uncertainty: Record<string, unknown>[]
      }
      result: {
        actualStatus?: unknown
        decisions: Record<string, unknown>[]
        diagnostics?: Record<string, unknown>[]
        error?: unknown
        uncertainty: Record<string, unknown>[]
      }
      scenario: {
        inputs: { atUs: unknown; id: unknown; lines: Record<string, unknown>[] | unknown }[]
        weapon: unknown
      }
    }
    description: unknown
    eventIndex: unknown
    expectedProjection: Record<string, unknown>
    id: unknown
  }[]
  format: unknown
  schemaVersion: unknown
}

function mutableFixtures(): MutableFixtureDocument {
  return structuredClone(fixtures) as unknown as MutableFixtureDocument
}
const expectedFixtureIds = [
  "available-safe-inactive",
  "left-valid-hit-with-buzzer",
  "right-valid-hit-side-mapping",
  "foil-off-target",
  "sabre-yellow-diagnostic-on",
  "sabre-yellow-diagnostic-off",
  "sabre-white-diagnostic-latched",
  "latched-output-persists-through-later-input",
  "reset-result-unavailable",
  "missing-authoritative-result-unavailable"
] as const

describe("display-state acceptance fixtures", () => {
  it("uses the canonical versioned fixture format with unique IDs", () => {
    expect(fixtures.format).toBe("scoring-display-state-fixtures")
    expect(fixtures.schemaVersion).toBe("1.0.0")
    expect(fixtures.cases.map(({ id }) => id)).toEqual(expectedFixtureIds)
    expect(new Set(fixtures.cases.map(({ id }) => id)).size).toBe(fixtures.cases.length)
    expect(fixtures.cases.every(({ description }) => description.length > 0)).toBe(true)
  })

  it.each(fixtures.cases)("projects $id deterministically", (fixture) => {
    const first = projectScenarioDisplay(fixture.case, fixture.eventIndex)
    const second = projectScenarioDisplay(fixture.case, fixture.eventIndex)
    const finalProjection = projectScenarioDisplay(fixture.case, Number.MAX_SAFE_INTEGER)
    const firstSequence = Array.from({ length: finalProjection.eventCount + 1 }, (_, index) =>
      projectScenarioDisplay(fixture.case, index - 1)
    )
    const secondSequence = Array.from({ length: finalProjection.eventCount + 1 }, (_, index) =>
      projectScenarioDisplay(fixture.case, index - 1)
    )
    const actual = {
      accessibleLabel: first.accessibleLabel,
      audibleRequested: first.audibleRequested,
      authoritativeResult: first.authoritativeResult,
      eventKind: first.event?.kind,
      eventLabel: first.event?.label,
      leftLamp: first.leftLamp,
      leftWhiteDiagnostic: first.leftWhiteDiagnostic,
      leftYellowDiagnostic: first.leftYellowDiagnostic,
      rightLamp: first.rightLamp,
      rightWhiteDiagnostic: first.rightWhiteDiagnostic,
      rightYellowDiagnostic: first.rightYellowDiagnostic
    }

    expect(actual).toEqual(fixture.expectedProjection)
    expect(second).toEqual(first)
    expect(secondSequence).toEqual(firstSequence)
    expect(firstSequence[fixture.eventIndex + 1]).toEqual(first)
  })

  it("rejects malformed nested values, duplicates, undeclared diagnostic sources, and event indexes", () => {
    const malformedDocuments: unknown[] = []

    const malformedStatus = structuredClone(fixtures) as DisplayFixtureDocument & {
      cases: { case: { result: { actualStatus: string } } }[]
    }
    malformedStatus.cases[0]!.case.result.actualStatus = "future"
    malformedDocuments.push(malformedStatus)

    const duplicate = structuredClone(fixtures) as DisplayFixtureDocument & { cases: { id: string }[] }
    duplicate.cases[1]!.id = duplicate.cases[0]!.id
    malformedDocuments.push(duplicate)

    const outOfRange = structuredClone(fixtures) as DisplayFixtureDocument & { cases: { eventIndex: number }[] }
    outOfRange.cases[0]!.eventIndex = 1
    malformedDocuments.push(outOfRange)

    const undeclaredSource = structuredClone(fixtures) as DisplayFixtureDocument & {
      cases: { case: { result: { diagnostics?: { sourceInputIds: string[] }[] } } }[]
    }
    undeclaredSource.cases[4]!.case.result.diagnostics![0]!.sourceInputIds = ["not-an-input"]
    malformedDocuments.push(undeclaredSource)

    const invalidPrimitive = structuredClone(fixtures) as DisplayFixtureDocument & {
      cases: { case: { result: { decisions: { signal: { latched: unknown } }[] } } }[]
    }
    invalidPrimitive.cases[1]!.case.result.decisions[0]!.signal.latched = "true"
    malformedDocuments.push(invalidPrimitive)

    for (const document of malformedDocuments)
      expect(() => parseDisplayFixtureDocument(document)).toThrowError("Invalid scenario display fixture document")
  })

  it("enforces fixture document array and string bounds", () => {
    const tooMany = structuredClone(fixtures) as DisplayFixtureDocument & { cases: unknown[] }
    tooMany.cases = Array.from({ length: MAX_DISPLAY_FIXTURE_CASES + 1 }, () => fixtures.cases[0])
    expect(() => parseDisplayFixtureDocument(tooMany)).toThrowError("Invalid scenario display fixture document")

    const overlong = structuredClone(fixtures) as DisplayFixtureDocument & { cases: { description: string }[] }
    overlong.cases[0]!.description = "x".repeat(MAX_DISPLAY_FIXTURE_TEXT_LENGTH + 1)
    expect(() => parseDisplayFixtureDocument(overlong)).toThrowError("Invalid scenario display fixture document")
  })

  it("accepts validated expected markers, uncertainty, and a bounded error", () => {
    const document = mutableFixtures()
    const fixture = document.cases[0]!
    fixture.case.expected.decisions = [
      {
        decisionAtUs: 1,
        disposition: "qualified-hit",
        id: "expected-hit",
        side: "left",
        signal: { audible: "requested", latched: true, visual: "valid-hit" }
      }
    ]
    fixture.case.expected.nonEvents = [
      {
        assertion: "no-decision",
        assertionReasonCode: "below-minimum",
        id: "expected-none",
        window: { throughUs: 2 }
      }
    ]
    fixture.case.expected.uncertainty = [{ atUs: 3, id: "expected-uncertainty" }]
    fixture.case.expected.status = "accepted"
    fixture.case.result.uncertainty = [{ atUs: 4, id: "actual-uncertainty" }]
    fixture.case.result.error = { atInputId: "idle", code: "bounded-diagnostic" }

    expect(parseDisplayFixtureDocument(document).cases).toHaveLength(fixtures.cases.length)

    const sameTimeDiagnostics = mutableFixtures()
    sameTimeDiagnostics.cases[4]!.case.result.diagnostics!.unshift({
      atUs: 100,
      audible: "none",
      indication: "yellow-on",
      latched: false,
      reason: "own-equipment-fault",
      side: "left",
      sourceInputIds: ["right-fault"]
    })
    expect(parseDisplayFixtureDocument(sameTimeDiagnostics).cases).toHaveLength(fixtures.cases.length)
  })

  it("rejects each malformed public fixture boundary without coercion", () => {
    const invalid: unknown[] = [
      null,
      {},
      { ...mutableFixtures(), format: "future" },
      { ...mutableFixtures(), schemaVersion: "2" }
    ]
    const mutations: ((document: MutableFixtureDocument) => void)[] = [
      (document) => {
        document.cases = []
      },
      (document) => {
        document.cases[0] = null as never
      },
      (document) => {
        document.cases[0]!.id = ""
      },
      (document) => {
        document.cases[0]!.description = 1
      },
      (document) => {
        document.cases[0]!.eventIndex = -1
      },
      (document) => {
        document.cases[0]!.case = null as never
      },
      (document) => {
        document.cases[0]!.case.expected = null as never
      },
      (document) => {
        document.cases[0]!.case.result = null as never
      },
      (document) => {
        document.cases[0]!.case.scenario = null as never
      },
      (document) => {
        document.cases[0]!.case.scenario.weapon = "future"
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs = null as never
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs[0] = null as never
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs[0]!.id = ""
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs[0]!.atUs = 1.5
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs[0]!.lines = null
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs[0]!.lines = Array.from({ length: 65 }, (_, index) => ({
          line: `line-${index}`,
          state: "open"
        }))
      },
      (document) => {
        ;(document.cases[0]!.case.scenario.inputs[0]!.lines as Record<string, unknown>[])[0] = null as never
      },
      (document) => {
        ;(document.cases[0]!.case.scenario.inputs[0]!.lines as Record<string, unknown>[])[0]!.line = ""
      },
      (document) => {
        ;(document.cases[0]!.case.scenario.inputs[0]!.lines as Record<string, unknown>[])[0]!.state = 1
      },
      (document) => {
        const lines = document.cases[0]!.case.scenario.inputs[0]!.lines as Record<string, unknown>[]
        lines.push(structuredClone(lines[0]!))
      },
      (document) => {
        document.cases[0]!.case.scenario.inputs.push(structuredClone(document.cases[0]!.case.scenario.inputs[0]!))
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = null as never
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = null as never
      },
      (document) => {
        document.cases[0]!.case.expected.uncertainty = null as never
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [null as never]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          {
            decisionAtUs: -1,
            disposition: "hit",
            id: "id",
            signal: { audible: "none", latched: false, visual: "none" }
          }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          { decisionAtUs: 1, disposition: 1, id: "id", signal: { audible: "none", latched: false, visual: "none" } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          { decisionAtUs: 1, disposition: "hit", signal: { audible: "none", latched: false, visual: "none" } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          {
            decisionAtUs: 1,
            disposition: "hit",
            id: "id",
            side: "centre",
            signal: { audible: "none", latched: false, visual: "none" }
          }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [{ decisionAtUs: 1, disposition: "hit", id: "id", signal: null }]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          {
            decisionAtUs: 1,
            disposition: "hit",
            id: "id",
            signal: { audible: "future", latched: false, visual: "none" }
          }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          { decisionAtUs: 1, disposition: "hit", id: "id", signal: { audible: "none", latched: 1, visual: "none" } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.decisions = [
          {
            decisionAtUs: 1,
            disposition: "hit",
            id: "id",
            signal: { audible: "none", latched: false, visual: "future" }
          }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.uncertainty = [null as never]
      },
      (document) => {
        document.cases[0]!.case.expected.uncertainty = [{ atUs: -1 }]
      },
      (document) => {
        document.cases[0]!.case.expected.uncertainty = [{ atUs: 1, id: "" }]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [null as never]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [
          { assertion: "a", assertionReasonCode: "r", id: "", window: { throughUs: 1 } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [
          { assertion: 1, assertionReasonCode: "r", id: "id", window: { throughUs: 1 } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [
          { assertion: "a", assertionReasonCode: 1, id: "id", window: { throughUs: 1 } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [
          { assertion: "a", assertionReasonCode: "r", id: "id", window: null }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.nonEvents = [
          { assertion: "a", assertionReasonCode: "r", id: "id", window: { throughUs: -1 } }
        ]
      },
      (document) => {
        document.cases[0]!.case.expected.status = "future"
      },
      (document) => {
        document.cases[0]!.case.result.decisions = null as never
      },
      (document) => {
        document.cases[0]!.case.result.uncertainty = null as never
      },
      (document) => {
        document.cases[0]!.case.result.error = 1
      },
      (document) => {
        document.cases[0]!.case.result.error = { atInputId: "" }
      },
      (document) => {
        document.cases[0]!.case.result.error = { code: 1 }
      },
      (document) => {
        document.cases[4]!.case.result.diagnostics = null as never
      },
      (document) => {
        document.cases[5]!.case.result.diagnostics!.reverse()
      },
      (document) => {
        document.cases[0]!.expectedProjection = null as never
      },
      (document) => {
        document.cases[0]!.expectedProjection.accessibleLabel = ""
      },
      (document) => {
        document.cases[0]!.expectedProjection.audibleRequested = "false"
      },
      (document) => {
        document.cases[0]!.expectedProjection.authoritativeResult = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.eventKind = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.eventLabel = 1
      },
      (document) => {
        document.cases[0]!.expectedProjection.leftLamp = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.leftWhiteDiagnostic = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.leftYellowDiagnostic = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.rightLamp = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.rightWhiteDiagnostic = "future"
      },
      (document) => {
        document.cases[0]!.expectedProjection.rightYellowDiagnostic = "future"
      }
    ]
    for (const mutate of mutations) {
      const document = mutableFixtures()
      mutate(document)
      invalid.push(document)
    }
    for (const document of invalid)
      expect(() => parseDisplayFixtureDocument(document)).toThrow(DisplayFixtureValidationError)
  })
})
