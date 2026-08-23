import {
  classifyFoilClosedCircuitResistance,
  classifyFoilEarthContactResistance,
  classifyFoilExteriorResistance,
  classifyFoilLogicalContext,
  type FoilApparatusMode,
  type FoilLogicalContactContext
} from "./foil-evidence.js"
import type { TimingTable } from "./timing-table.js"

export type FoilClassificationKind =
  | "closed-circuit-resistance"
  | "earth-contact-resistance"
  | "exterior-resistance"
  | "logical-context"

export type FoilScenarioLine = {
  line: string
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
  state: string
}

export type FoilClassificationInput = {
  atUs: number
  id: string
  lines: readonly FoilScenarioLine[]
}

export type FoilScenarioClassification = {
  atUs: number
  disposition: string
  kind: FoilClassificationKind
  permittedIndications?: readonly string[]
  rangeMilliOhms?: { max: number; min: number } | null
  sourceInputId: string
}

function logicalContext(line: string): [FoilApparatusMode, FoilLogicalContactContext] | null {
  const match = /^(?:left|right)\.(standard|anti-blocking)\.(.+)$/.exec(line)
  if (match === null) return null
  const mode: FoilApparatusMode = match[1] === "standard" ? "standard" : "anti-blocking"
  const context = match[2]
  if (context === "blade-contact") return [mode, context]
  if (context === "conductive-jacket-without-tip-break") return [mode, context]
  if (context === "guard-or-piste") return [mode, context]
  if (context === "own-weapon-to-jacket-insulation-short") return [mode, context]
  return null
}

function classificationForInput(input: FoilClassificationInput, timingTable: TimingTable): FoilScenarioClassification {
  if (input.lines.length !== 1) throw new TypeError(`Foil classification input ${input.id} must contain one line`)
  const line = input.lines[0]
  /* v8 ignore next -- established by the exact-one guard. */
  if (line === undefined) throw new TypeError(`Foil classification input ${input.id} has no line`)
  const base = { atUs: input.atUs, sourceInputId: input.id }

  if (line.line.endsWith(".qualified-break.exterior-resistance")) {
    if (line.state !== "open" || input.atUs < timingTable.foil.contactBreakMinimumUs)
      throw new TypeError("Foil exterior resistance requires a timing-qualified open break")
    return { ...base, kind: "exterior-resistance", ...classifyFoilExteriorResistance(line) }
  }
  if (line.line.endsWith(".closed-circuit-resistance")) {
    if (line.state !== "closed") throw new TypeError("Foil closed-circuit resistance requires closed state")
    return { ...base, kind: "closed-circuit-resistance", ...classifyFoilClosedCircuitResistance(line) }
  }
  if (line.line.endsWith(".earth-contact-resistance")) {
    if (line.state !== "grounded") throw new TypeError("Foil earth-contact resistance requires grounded state")
    return { ...base, kind: "earth-contact-resistance", ...classifyFoilEarthContactResistance(line) }
  }

  const logical = logicalContext(line.line)
  if (logical === null) throw new TypeError(`Unsupported foil classification line ${line.line}`)
  const [mode, context] = logical
  const expectedState = context === "guard-or-piste" ? "grounded" : context.includes("short") ? "shorted" : "closed"
  if (line.state !== expectedState || line.resistanceMilliOhms !== null || line.resistanceUncertaintyMilliOhms !== null)
    throw new TypeError(`Foil logical context ${context} has incompatible line evidence`)
  return { ...base, kind: "logical-context", ...classifyFoilLogicalContext(mode, context) }
}

/** Derives one host classification from every listed input, in declared order. */
export function classifyFoilScenarioInputs(
  inputs: readonly FoilClassificationInput[],
  declaredLineNames: readonly string[],
  timingTable: TimingTable
): FoilScenarioClassification[] {
  const declared = new Set(declaredLineNames)
  return inputs.map((input) => {
    if (input.lines.some((line) => !declared.has(line.line)))
      throw new TypeError(`Foil classification input ${input.id} uses an undeclared line`)
    return classificationForInput(input, timingTable)
  })
}
