import {
  advanceSabreScoring,
  classifySabreExternalPath,
  createSabreScoringState,
  type SabreContact,
  type SabreDiagnosticDecision,
  type SabreSample,
  type SabreScoringState,
  type SabreSide
} from "./sabre.js"
import type { TimingTable } from "./timing-table.js"

export type SabreScenarioLine = {
  line: string
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
  state: string
}

export type SabreScenarioInput = {
  atUs: number
  id: string
  lines: readonly SabreScenarioLine[]
}

export type SabreScenarioDiagnosticEvidence = SabreDiagnosticDecision & {
  sourceInputIds: readonly string[]
}

export type SabreScenarioEvidence = {
  diagnostics: readonly SabreScenarioDiagnosticEvidence[]
  state: SabreScoringState
}

export class SabreScenarioEvidenceError extends Error {
  readonly inputId: string

  constructor(inputId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : "Sabre scorer rejected input", { cause })
    this.inputId = inputId
  }
}

function lineFor(input: SabreScenarioInput, side: SabreSide, suffix: string): SabreScenarioLine | undefined {
  return input.lines.find((line) => line.line === `${side}.${suffix}`)
}

function projectBlade(line: SabreScenarioLine | undefined): SabreContact["bladeContact"] {
  if (line === undefined || line.state === "open") return "absent"
  if (line.state === "closed") return "present"
  if (line.state === "disconnected") return "unavailable"
  return "indeterminate"
}

function projectTarget(line: SabreScenarioLine | undefined): SabreContact["targetContact"] {
  if (line?.state === "grounded") return "nonConductiveSurface"
  if (line?.state === "closed") return "target"
  if (line?.state === "disconnected") return "unavailable"
  return "indeterminate"
}

function projectExternal(line: SabreScenarioLine | undefined): SabreContact["externalPathEligibility"] {
  if (line === undefined) return "eligible"
  if (line.state === "disconnected") return "unavailable"
  if (line.state === "indeterminate") return "indeterminate"
  if (line.state === "open") {
    return line.resistanceMilliOhms === null && line.resistanceUncertaintyMilliOhms === null
      ? "eligible"
      : "indeterminate"
  }
  if (line.state === "closed") return classifySabreExternalPath(line)
  return "indeterminate"
}

function projectOwnEquipment(line: SabreScenarioLine | undefined): SabreContact["ownEquipmentFault"] {
  if (line === undefined || line.state === "open") return "absent"
  if (line.state === "closed") return "present"
  if (line.state === "disconnected") return "unavailable"
  return "indeterminate"
}

function projectCircuitBC(line: SabreScenarioLine | undefined): SabreContact["circuitBCFault"] {
  if (line === undefined || line.state === "open") return "normal"
  if (line.state === "closed") return "controlBreak"
  if (line.state === "shorted") return "abnormalChange"
  if (line.state === "disconnected") return "unavailable"
  return "indeterminate"
}

function projectContact(input: SabreScenarioInput, side: SabreSide): SabreContact {
  return {
    bladeContact: projectBlade(lineFor(input, side, "blade")),
    circuitBCFault: projectCircuitBC(lineFor(input, side, "control")),
    externalPathEligibility: projectExternal(lineFor(input, side, "external")),
    ownEquipmentFault: projectOwnEquipment(lineFor(input, side, "fault")),
    targetContact: projectTarget(lineFor(input, side, "target"))
  }
}

export function projectSabreScenarioInput(input: SabreScenarioInput): SabreSample {
  return { atUs: input.atUs, left: projectContact(input, "left"), right: projectContact(input, "right") }
}

function uniqueInputIds(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

function compareDiagnostics(left: SabreScenarioDiagnosticEvidence, right: SabreScenarioDiagnosticEvidence): number {
  return left.atUs - right.atUs || left.side.localeCompare(right.side)
}

function requiredSourceInputId(value: string | null): string {
  // The adapter records onset before advancing the scorer. A missing value is
  // therefore an internal invariant violation, not an input-dependent branch.
  /* v8 ignore next 2 */
  if (value === null) throw new Error("Sabre diagnostic onset input is missing")
  return value
}

function diagnosticSources(
  diagnostic: SabreDiagnosticDecision,
  input: SabreScenarioInput,
  yellowOnInputIds: Readonly<Record<SabreSide, string | null>>,
  controlBreakInputIds: Readonly<Record<SabreSide, string | null>>
): string[] {
  if (diagnostic.reason === "own-equipment-clear") {
    return uniqueInputIds([requiredSourceInputId(yellowOnInputIds[diagnostic.side]), input.id])
  }

  if (diagnostic.reason === "control-break-qualified") {
    return uniqueInputIds([requiredSourceInputId(controlBreakInputIds[diagnostic.side]), input.id])
  }

  return [input.id]
}

/**
 * Replays schema-validated sabre logical snapshots and attaches the input IDs
 * that justify each host diagnostic. It does not claim physical acquisition,
 * lamp, or buzzer evidence.
 */
export function runSabreScenarioEvidence(
  inputs: readonly SabreScenarioInput[],
  timingTable?: TimingTable
): SabreScenarioEvidence {
  let state = createSabreScoringState()
  const diagnostics: SabreScenarioDiagnosticEvidence[] = []
  const yellowOnInputIds: Record<SabreSide, string | null> = { left: null, right: null }
  const controlBreakInputIds: Record<SabreSide, string | null> = { left: null, right: null }

  for (const input of inputs) {
    try {
      const sample = projectSabreScenarioInput(input)

      for (const side of ["left", "right"] as const) {
        if (sample[side].ownEquipmentFault === "present" && state[side].yellowDiagnostic !== "yellow-on") {
          yellowOnInputIds[side] = input.id
        }
        if (sample[side].circuitBCFault === "controlBreak") {
          controlBreakInputIds[side] ??= input.id
        } else {
          controlBreakInputIds[side] = null
        }
      }

      const priorDiagnostics = state.diagnostics
      state = advanceSabreScoring(state, sample, timingTable)
      const emitted = state.diagnostics.filter((diagnostic) => !priorDiagnostics.includes(diagnostic))

      diagnostics.push(
        ...emitted.map((diagnostic) => ({
          ...diagnostic,
          sourceInputIds: diagnosticSources(diagnostic, input, yellowOnInputIds, controlBreakInputIds)
        }))
      )

      for (const side of ["left", "right"] as const) {
        if (sample[side].ownEquipmentFault !== "present") yellowOnInputIds[side] = null
      }
    } catch (error) {
      throw new SabreScenarioEvidenceError(input.id, error)
    }
  }

  return { diagnostics: diagnostics.sort(compareDiagnostics), state }
}
