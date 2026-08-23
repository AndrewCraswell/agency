import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  createScenarioDisplayTimeline,
  isActualAcceptedScenarioDisplay,
  projectScenarioDisplay,
  projectScenarioLines,
  type ScenarioDisplayCase
} from "./scenario-display-projection.js"

function displayCase(
  options: {
    readonly actualStatus?: string
    readonly bladeIndependent?: boolean
    readonly error?: { readonly atInputId?: string; readonly code?: string }
    readonly evaluationMarkers?: boolean
    readonly expectedStatus?: string
    readonly invalidDecisions?: readonly unknown[]
    readonly omitValidDecision?: boolean
    readonly omitActualStatus?: boolean
    readonly sideLessDecision?: boolean
    readonly visual?: string
  } = {}
): ScenarioDisplayCase {
  return {
    expected: {
      decisions: [
        {
          decisionAtUs: 2_000,
          disposition: "qualified-hit",
          id: "expected-right",
          side: "right",
          signal: { audible: "requested", latched: true, visual: "valid-hit" }
        }
      ],
      nonEvents: options.evaluationMarkers
        ? [
            {
              assertion: "no-decision",
              assertionReasonCode: "contact-shorter-than-minimum",
              id: "short-contact",
              window: { throughUs: 1_000 }
            }
          ]
        : [],
      status: options.expectedStatus ?? "accepted",
      uncertainty: options.evaluationMarkers ? [{ atUs: 1_500, id: "expected-clock" }, { atUs: 1_500 }] : []
    },
    result: {
      ...(options.omitActualStatus ? {} : { actualStatus: options.actualStatus ?? "accepted" }),
      decisions: [
        ...(options.invalidDecisions ?? []),
        ...(options.sideLessDecision
          ? [
              {
                decisionAtUs: 1_900,
                disposition: "diagnostic",
                signal: { audible: "none", latched: false, visual: "none" }
              }
            ]
          : []),
        ...(options.omitValidDecision
          ? []
          : [
              {
                decisionAtUs: 2_000,
                disposition: "qualified-hit",
                side: "right",
                signal: {
                  audible: options.visual === undefined ? "requested" : "unexpected",
                  latched: true,
                  visual: options.visual ?? "valid-hit"
                }
              }
            ])
      ],
      error: options.error,
      uncertainty: options.evaluationMarkers ? [{ atUs: 1_700, id: "actual-clock" }, { atUs: 1_700 }] : []
    },
    scenario: {
      inputs: [
        {
          atUs: 0,
          id: "contact",
          lines: options.bladeIndependent
            ? [
                { line: "left.target", state: "closed" },
                { line: "right.blade", state: "closed" }
              ]
            : [
                { line: "right.weapon-circuit", state: "closed" },
                { line: "left.target", state: "grounded" }
              ]
        },
        {
          atUs: 2_000,
          id: "qualified",
          lines: [
            { line: "right.weapon-circuit", state: "closed" },
            { line: "left.target", state: "grounded" }
          ]
        }
      ],
      weapon: "epee"
    }
  }
}

describe("scenario report display projection", () => {
  it("orders equal-time inputs and expectations before authoritative output", () => {
    expect(createScenarioDisplayTimeline(displayCase()).map(({ atUs, kind }) => [atUs, kind])).toEqual([
      [0, "input"],
      [2_000, "input"],
      [2_000, "expected"],
      [2_000, "output"]
    ])
  })

  it("uses only actual result decisions to illuminate lamps and request the buzzer", () => {
    const testCase = displayCase()
    const expectedMarker = projectScenarioDisplay(testCase, 2)
    const actualOutput = projectScenarioDisplay(testCase, 3)

    expect(expectedMarker).toMatchObject({ audibleRequested: false, leftLamp: "off", rightLamp: "off" })
    expect(actualOutput).toMatchObject({
      audibleRequested: true,
      cursorAtUs: 2_000,
      eventCount: 4,
      eventNumber: 4,
      leftFault: true,
      leftLamp: "off",
      latestDecision: { decisionAtUs: 2_000, side: "right" },
      rightContact: true,
      rightLamp: "valid-hit"
    })
    expect(actualOutput.accessibleLabel).toBe(
      "epee; left off; right valid-hit; buzzer requested; event 4/4; cursor 2000 us"
    )
  })

  it("fails closed for unknown visuals and rejected reports", () => {
    const unknownVisual = displayCase({ visual: "future-signal" })
    expect(projectScenarioDisplay(unknownVisual, 3)).toMatchObject({ audibleRequested: false, rightLamp: "off" })

    const rejected = displayCase({
      actualStatus: "rejected",
      error: { atInputId: "qualified", code: "invalid-input" }
    })
    const timeline = createScenarioDisplayTimeline(rejected)
    expect(timeline.map(({ kind }) => kind)).toEqual(["input", "input", "rejection"])
    expect(projectScenarioDisplay(rejected, 2)).toMatchObject({ audibleRequested: false, rightLamp: "off" })
  })

  it("projects accepted actual decisions even when the expectation was rejection", () => {
    const mismatch = displayCase({ expectedStatus: "rejected" })
    expect(isActualAcceptedScenarioDisplay(mismatch)).toBe(true)
    expect(createScenarioDisplayTimeline(mismatch).map(({ kind }) => kind)).toEqual([
      "input",
      "input",
      "expected",
      "output"
    ])
    expect(projectScenarioDisplay(mismatch, 3)).toMatchObject({
      audibleRequested: true,
      rightLamp: "valid-hit"
    })
  })

  it.each([
    { label: "missing", options: { omitActualStatus: true } },
    { label: "unknown", options: { actualStatus: "unknown" } }
  ])("fails closed when actual report status is $label", ({ options }) => {
    const report = displayCase(options)
    expect(isActualAcceptedScenarioDisplay(report)).toBe(false)
    expect(createScenarioDisplayTimeline(report).map(({ kind }) => kind)).toEqual(["rejection", "input", "input"])
    expect(projectScenarioDisplay(report, 2)).toMatchObject({
      audibleRequested: false,
      leftLamp: "off",
      rightLamp: "off"
    })
  })

  it("inserts an early rejection at its causal input and marks later inputs unprocessed", () => {
    const report = displayCase({
      actualStatus: "rejected",
      error: { atInputId: "contact", code: "invalid-first-input" }
    })
    const timeline = createScenarioDisplayTimeline(report)

    expect(timeline.map(({ atUs, id, kind }) => [atUs, id, kind])).toEqual([
      [0, "contact", "input"],
      [0, "rejection-contact", "rejection"],
      [2_000, "qualified", "input"]
    ])
    expect(timeline.filter(({ kind }) => kind === "input").map(({ id }) => id)).toEqual(["contact", "qualified"])
    expect(timeline[2]?.label).toBe("Declared, not processed input 2: qualified")
  })

  it("preserves the real non-monotonic vector's execution order and labels its backward timestamp", () => {
    const scenario = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../docs/golden-scenarios/epee-non-monotonic-time.json"), "utf8")
    )
    const report: ScenarioDisplayCase = {
      expected: scenario.expect,
      result: {
        actualStatus: "rejected",
        decisions: [],
        error: scenario.expect.error,
        uncertainty: []
      },
      scenario
    }
    const timeline = createScenarioDisplayTimeline(report)

    expect(timeline.map(({ atUs, id, kind }) => [atUs, id, kind])).toEqual([
      [10, "first-sample", "input"],
      [9, "backward-sample", "input"],
      [9, "rejection-backward-sample", "rejection"]
    ])
    expect(timeline[1]?.label).toBe(
      "Input-order violation at declared input 2: backward-sample moves backward from 10 us to 9 us"
    )
  })

  it("projects blade state independently from target contact", () => {
    const testCase = displayCase({ bladeIndependent: true })

    expect(projectScenarioDisplay(testCase, 0)).toMatchObject({
      bladeContact: true,
      leftContact: true,
      rightContact: true
    })
  })

  it("projects line context without requiring a report", () => {
    expect(
      projectScenarioLines([
        { line: "left.target", state: "closed" },
        { line: "right.blade", state: "closed" },
        { line: "right.external", state: "indeterminate" }
      ])
    ).toEqual({
      bladeContact: true,
      leftContact: true,
      leftFault: false,
      rightContact: true,
      rightFault: true
    })
  })

  it("renders non-event and uncertainty evidence as markers without granting scoring authority", () => {
    const testCase = displayCase({ evaluationMarkers: true })
    const timeline = createScenarioDisplayTimeline(testCase)

    expect(timeline.map(({ id, kind }) => [id, kind])).toEqual([
      ["contact", "input"],
      ["short-contact", "expected"],
      ["expected-expected-clock", "expected"],
      ["expected-1500", "expected"],
      ["uncertainty-actual-clock", "uncertainty"],
      ["uncertainty-1700", "uncertainty"],
      ["qualified", "input"],
      ["expected-right", "expected"],
      ["actual-right-2000-0", "output"]
    ])
    expect(projectScenarioDisplay(testCase, 5)).toMatchObject({
      audibleRequested: false,
      leftLamp: "off",
      rightLamp: "off"
    })
  })

  it("ignores malformed and side-less report decisions without synthesizing a lamp", () => {
    const testCase = displayCase({
      invalidDecisions: [
        null,
        { decisionAtUs: "bad", disposition: "qualified-hit" },
        { decisionAtUs: 1_000, disposition: 7 },
        { decisionAtUs: 1_000, disposition: "qualified-hit", side: "centre" },
        { decisionAtUs: 1_000, disposition: "qualified-hit", signal: "requested" }
      ],
      omitValidDecision: true,
      sideLessDecision: true
    })
    const timeline = createScenarioDisplayTimeline(testCase)

    expect(timeline.filter(({ kind }) => kind === "output").map(({ id }) => id)).toEqual(["actual-none-1900-5"])
    expect(projectScenarioDisplay(testCase, timeline.length - 1)).toMatchObject({
      audibleRequested: false,
      leftLamp: "off",
      rightLamp: "off"
    })
  })

  it("fails closed for an invalid event index", () => {
    expect(projectScenarioDisplay(displayCase(), Number.NaN)).toMatchObject({
      audibleRequested: false,
      event: null,
      eventNumber: 0,
      leftLamp: "off",
      rightLamp: "off"
    })
  })
})
