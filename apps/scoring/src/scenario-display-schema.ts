type DisplaySide = "left" | "right"

type ScenarioDisplaySignal = {
  readonly audible: "none" | "requested"
  readonly latched: boolean
  readonly visual: "diagnostic" | "none" | "off-target" | "valid-hit"
}

type ScenarioDisplayDecisionRecord = Record<string, unknown> & {
  readonly decisionAtUs: number
  readonly disposition: string
  readonly side?: DisplaySide
  readonly signal: ScenarioDisplaySignal
}

type ScenarioDisplayDiagnosticRecord = Record<string, unknown> & {
  readonly atUs: number
  readonly audible: "none" | "requested"
  readonly indication: "white-on" | "yellow-off" | "yellow-on"
  readonly latched: boolean
  readonly reason:
    | "circuit-bc-abnormal-change"
    | "control-break-qualified"
    | "own-equipment-clear"
    | "own-equipment-fault"
  readonly side: DisplaySide
  readonly sourceInputIds: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isScenarioDisplaySignal(value: unknown): value is ScenarioDisplaySignal {
  return (
    isRecord(value) &&
    isOneOf(value.audible, ["none", "requested"]) &&
    typeof value.latched === "boolean" &&
    isOneOf(value.visual, ["diagnostic", "none", "off-target", "valid-hit"])
  )
}

export function isScenarioDisplayDecision(value: unknown): value is ScenarioDisplayDecisionRecord {
  return (
    isRecord(value) &&
    isNonnegativeSafeInteger(value.decisionAtUs) &&
    typeof value.disposition === "string" &&
    value.disposition.length > 0 &&
    (value.side === undefined || value.side === "left" || value.side === "right") &&
    isScenarioDisplaySignal(value.signal)
  )
}

export function isScenarioDisplayDiagnostic(value: unknown): value is ScenarioDisplayDiagnosticRecord {
  return (
    isRecord(value) &&
    isNonnegativeSafeInteger(value.atUs) &&
    isOneOf(value.audible, ["none", "requested"]) &&
    isOneOf(value.indication, ["white-on", "yellow-off", "yellow-on"]) &&
    typeof value.latched === "boolean" &&
    isOneOf(value.reason, [
      "circuit-bc-abnormal-change",
      "control-break-qualified",
      "own-equipment-clear",
      "own-equipment-fault"
    ]) &&
    isOneOf(value.side, ["left", "right"]) &&
    Array.isArray(value.sourceInputIds) &&
    value.sourceInputIds.length >= 1 &&
    value.sourceInputIds.length <= 2 &&
    value.sourceInputIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 128) &&
    new Set(value.sourceInputIds).size === value.sourceInputIds.length &&
    ((value.indication === "white-on" && value.latched && value.audible === "requested") ||
      (value.indication !== "white-on" && !value.latched && value.audible === "none")) &&
    ((value.indication === "yellow-on" && value.reason === "own-equipment-fault") ||
      (value.indication === "yellow-off" && value.reason === "own-equipment-clear") ||
      (value.indication === "white-on" &&
        (value.reason === "circuit-bc-abnormal-change" || value.reason === "control-break-qualified")))
  )
}
