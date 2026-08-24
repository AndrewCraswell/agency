import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  createScenarioDisplayTimeline,
  isActualAcceptedScenarioDisplay,
  isScenarioDisplayDecision,
  isScenarioDisplayDiagnostic,
  projectScenarioDisplay,
  projectScenarioLines,
  type ScenarioDisplayCase,
  type ScenarioDisplayDiagnostic
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
      authoritativeResult: "available",
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
      "epee; authoritative result available; left primary off; left yellow off; left white off; right primary valid-hit; right yellow off; right white off; buzzer requested; event 4/4; cursor 2000 us"
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
    expect(projectScenarioDisplay(rejected, 2).authoritativeResult).toBe("unavailable")
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
    expect(timeline.map(({ playbackAtUs }) => playbackAtUs)).toEqual([10, 10, 10])
    expect(projectScenarioDisplay(report, 1)).toMatchObject({ cursorAtUs: 10 })
    expect(projectScenarioDisplay(report, 1).accessibleLabel).toContain("declared event time 9 us")
  })

  it("advances playback only when raw evidence catches up after a backward timestamp", () => {
    const base = displayCase({ actualStatus: "rejected", error: { atInputId: "qualified", code: "invalid-time" } })
    const report: ScenarioDisplayCase = {
      ...base,
      scenario: {
        ...base.scenario,
        inputs: [
          { ...base.scenario.inputs[0]!, atUs: 10 },
          { ...base.scenario.inputs[1]!, atUs: 9 },
          { atUs: 12, id: "recovered-time", lines: [] }
        ]
      }
    }

    expect(createScenarioDisplayTimeline(report).map(({ atUs, playbackAtUs }) => [atUs, playbackAtUs])).toEqual([
      [10, 10],
      [9, 10],
      [9, 10],
      [12, 12]
    ])
  })

  it("keeps accepted monotonic event and playback coordinates equal", () => {
    const timeline = createScenarioDisplayTimeline(displayCase())
    expect(timeline.every((event) => event.atUs === event.playbackAtUs)).toBe(true)
  })

  it("keeps missing-status playback nondecreasing and excludes result outputs", () => {
    const timeline = createScenarioDisplayTimeline(displayCase({ omitActualStatus: true }))
    expect(timeline.some(({ kind }) => kind === "output")).toBe(false)
    expect(timeline.map(({ playbackAtUs }) => playbackAtUs)).toEqual(
      timeline.map(({ playbackAtUs }) => playbackAtUs).toSorted((left, right) => left - right)
    )
  })

  it("projects validated sabre diagnostics as side-local non-scoring output", () => {
    const base = displayCase({ omitValidDecision: true })
    const report: ScenarioDisplayCase = {
      ...base,
      result: {
        ...base.result,
        diagnostics: [
          {
            atUs: 100,
            audible: "none",
            indication: "yellow-on",
            latched: false,
            reason: "own-equipment-fault",
            side: "left",
            sourceInputIds: ["contact"]
          },
          {
            atUs: 200,
            audible: "none",
            indication: "yellow-off",
            latched: false,
            reason: "own-equipment-clear",
            side: "left",
            sourceInputIds: ["contact", "qualified"]
          },
          {
            atUs: 300,
            audible: "requested",
            indication: "white-on",
            latched: true,
            reason: "control-break-qualified",
            side: "right",
            sourceInputIds: ["contact", "qualified"]
          }
        ]
      },
      scenario: { ...base.scenario, weapon: "sabre" }
    }
    const timeline = createScenarioDisplayTimeline(report)
    const yellowOnIndex = timeline.findIndex(({ label }) => label === "yellow-on")
    const yellowOffIndex = timeline.findIndex(({ label }) => label === "yellow-off")
    const whiteOnIndex = timeline.findIndex(({ label }) => label === "white-on")

    expect(projectScenarioDisplay(report, yellowOnIndex)).toMatchObject({
      leftLamp: "off",
      leftYellowDiagnostic: "on",
      rightLamp: "off"
    })
    expect(projectScenarioDisplay(report, yellowOffIndex - 1)).toMatchObject({ leftYellowDiagnostic: "on" })
    expect(projectScenarioDisplay(report, yellowOffIndex)).toMatchObject({
      leftLamp: "off",
      leftYellowDiagnostic: "off",
      rightLamp: "off"
    })
    expect(projectScenarioDisplay(report, whiteOnIndex)).toMatchObject({
      audibleRequested: true,
      latestDecision: null,
      rightLamp: "off",
      rightWhiteDiagnostic: "on"
    })
  })

  it("keeps primary, yellow, and white channels independent and clears only yellow", () => {
    const base = displayCase({ omitValidDecision: true })
    const report: ScenarioDisplayCase = {
      ...base,
      result: {
        ...base.result,
        decisions: [
          {
            decisionAtUs: 100,
            disposition: "qualified-hit",
            side: "left",
            signal: { audible: "requested", latched: true, visual: "valid-hit" }
          }
        ],
        diagnostics: [
          {
            atUs: 150,
            audible: "none",
            indication: "yellow-on",
            latched: false,
            reason: "own-equipment-fault",
            side: "left",
            sourceInputIds: ["contact"]
          },
          {
            atUs: 200,
            audible: "requested",
            indication: "white-on",
            latched: true,
            reason: "circuit-bc-abnormal-change",
            side: "left",
            sourceInputIds: ["contact"]
          },
          {
            atUs: 300,
            audible: "none",
            indication: "yellow-off",
            latched: false,
            reason: "own-equipment-clear",
            side: "left",
            sourceInputIds: ["contact", "clear"]
          }
        ]
      },
      scenario: {
        ...base.scenario,
        inputs: [
          { ...base.scenario.inputs[0]!, atUs: 0, id: "contact" },
          { atUs: 300, id: "clear", lines: [] }
        ],
        weapon: "sabre"
      }
    }
    const timeline = createScenarioDisplayTimeline(report)
    const whiteIndex = timeline.findIndex(({ label }) => label === "white-on")
    const yellowOffIndex = timeline.findIndex(({ label }) => label === "yellow-off")

    expect(projectScenarioDisplay(report, whiteIndex)).toMatchObject({
      leftLamp: "valid-hit",
      leftWhiteDiagnostic: "on",
      leftYellowDiagnostic: "on"
    })
    expect(projectScenarioDisplay(report, yellowOffIndex)).toMatchObject({
      leftLamp: "valid-hit",
      leftWhiteDiagnostic: "on",
      leftYellowDiagnostic: "off"
    })
  })

  it("contains an adversarial non-latched decision visual to its projection event", () => {
    const base = displayCase({ omitValidDecision: true })
    const report: ScenarioDisplayCase = {
      ...base,
      result: {
        ...base.result,
        decisions: [
          {
            decisionAtUs: 100,
            disposition: "qualified-hit",
            side: "right",
            signal: { audible: "requested", latched: false, visual: "valid-hit" }
          }
        ],
        uncertainty: [{ atUs: 200, id: "later-projection-event" }]
      },
      scenario: { ...base.scenario, inputs: [{ ...base.scenario.inputs[0]!, atUs: 0 }] }
    }
    const timeline = createScenarioDisplayTimeline(report)
    const outputIndex = timeline.findIndex(({ kind }) => kind === "output")
    const laterIndex = timeline.findIndex(({ kind }) => kind === "uncertainty")

    expect(projectScenarioDisplay(report, outputIndex)).toMatchObject({
      audibleRequested: true,
      rightLamp: "valid-hit"
    })
    expect(projectScenarioDisplay(report, laterIndex)).toMatchObject({ audibleRequested: false, rightLamp: "off" })
  })

  it("does not convert a strict diagnostic decision visual into a primary lamp", () => {
    const base = displayCase({ omitValidDecision: true })
    const report: ScenarioDisplayCase = {
      ...base,
      result: {
        ...base.result,
        decisions: [
          {
            decisionAtUs: 100,
            disposition: "line-fault",
            side: "left",
            signal: { audible: "none", latched: true, visual: "diagnostic" }
          }
        ]
      }
    }

    expect(projectScenarioDisplay(report, Number.MAX_SAFE_INTEGER)).toMatchObject({
      leftLamp: "off",
      leftWhiteDiagnostic: "off",
      leftYellowDiagnostic: "off"
    })
  })

  it("rejects malformed or incoherent sabre diagnostics", () => {
    const base = displayCase({ omitValidDecision: true })
    const report: ScenarioDisplayCase = {
      ...base,
      result: {
        ...base.result,
        diagnostics: [
          {
            atUs: 100,
            audible: "requested",
            indication: "yellow-on",
            latched: false,
            reason: "own-equipment-fault",
            side: "left",
            sourceInputIds: ["contact"]
          }
        ]
      },
      scenario: { ...base.scenario, weapon: "sabre" }
    }
    expect(() => createScenarioDisplayTimeline(report)).toThrowError("Invalid scenario display projection")

    const validDiagnostic: ScenarioDisplayDiagnostic = {
      atUs: 100,
      audible: "none",
      indication: "yellow-on",
      latched: false,
      reason: "own-equipment-fault",
      side: "left",
      sourceInputIds: ["contact"]
    }
    const invalidSource: ScenarioDisplayCase = {
      ...report,
      result: { ...report.result, diagnostics: [{ ...validDiagnostic, sourceInputIds: ["undeclared"] }] }
    }
    expect(() => createScenarioDisplayTimeline(invalidSource)).toThrowError("Invalid scenario display projection")

    const unordered: ScenarioDisplayCase = {
      ...report,
      result: {
        ...report.result,
        diagnostics: [{ ...validDiagnostic, atUs: 200 }, validDiagnostic]
      }
    }
    expect(() => createScenarioDisplayTimeline(unordered)).toThrowError("Invalid scenario display projection")

    const wrongWeapon: ScenarioDisplayCase = {
      ...report,
      result: { ...report.result, diagnostics: [validDiagnostic] },
      scenario: { ...report.scenario, weapon: "epee" }
    }
    expect(() => createScenarioDisplayTimeline(wrongWeapon)).toThrowError("Invalid scenario display projection")
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
        {
          decisionAtUs: -1,
          disposition: "qualified-hit",
          signal: { audible: "none", latched: true, visual: "valid-hit" }
        },
        {
          decisionAtUs: 1.5,
          disposition: "qualified-hit",
          signal: { audible: "none", latched: true, visual: "valid-hit" }
        },
        {
          decisionAtUs: Number.MAX_SAFE_INTEGER + 1,
          disposition: "qualified-hit",
          signal: { audible: "none", latched: true, visual: "valid-hit" }
        },
        { decisionAtUs: 1_000, disposition: 7 },
        { decisionAtUs: 1_000, disposition: "", signal: { audible: "none", latched: true, visual: "valid-hit" } },
        { decisionAtUs: 1_000, disposition: "qualified-hit", side: "centre" },
        { decisionAtUs: 1_000, disposition: "qualified-hit", signal: "requested" },
        {
          decisionAtUs: 1_000,
          disposition: "qualified-hit",
          signal: { audible: "future", latched: true, visual: "valid-hit" }
        },
        {
          decisionAtUs: 1_000,
          disposition: "qualified-hit",
          signal: { audible: "none", latched: "true", visual: "valid-hit" }
        },
        {
          decisionAtUs: 1_000,
          disposition: "qualified-hit",
          signal: { audible: "none", latched: true, visual: "future" }
        }
      ],
      omitValidDecision: true,
      sideLessDecision: true
    })
    const timeline = createScenarioDisplayTimeline(testCase)

    expect(timeline.filter(({ kind }) => kind === "output")).toHaveLength(1)
    expect(projectScenarioDisplay(testCase, timeline.length - 1)).toMatchObject({
      audibleRequested: false,
      leftLamp: "off",
      rightLamp: "off"
    })
  })

  it("rejects arrays through the shared display record predicates", () => {
    expect(isScenarioDisplayDecision([])).toBe(false)
    expect(isScenarioDisplayDiagnostic([])).toBe(false)
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
