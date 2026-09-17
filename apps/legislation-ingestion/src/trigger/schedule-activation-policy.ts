import { z } from "zod"
import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"

type OpenStatesJurisdiction = (typeof supportedOpenStatesJurisdictions)[number]

export type OpenStatesScheduleActivationInput = Readonly<{
  activate: boolean
  activateOpenStates: boolean
  openStatesSchedulesEnabled: boolean
  enabledJurisdictions: readonly OpenStatesJurisdiction[]
}>

/**
 * OpenStates polling requires a provider quota acknowledgement in addition to
 * the normal schedule activation request. Both opt-ins fail closed.
 */
export function resolveOpenStatesScheduleActivation(
  input: OpenStatesScheduleActivationInput
): readonly OpenStatesJurisdiction[] {
  if (input.activateOpenStates && !input.activate) {
    throw new Error("--activate-openstates requires --activate")
  }
  if (input.activateOpenStates && !input.openStatesSchedulesEnabled) {
    throw new Error("--activate-openstates requires OPENSTATES_SCHEDULES_ENABLED=true")
  }
  if (input.activateOpenStates && input.enabledJurisdictions.length === 0) {
    throw new Error("--activate-openstates requires at least one OPENSTATES_SCHEDULES_ENABLED_STATES jurisdiction")
  }
  return input.activate && input.activateOpenStates && input.openStatesSchedulesEnabled
    ? input.enabledJurisdictions
    : []
}

export function parseOpenStatesScheduleGate(value: string | undefined): boolean {
  if (value === undefined || value.trim() === "" || value.trim().toLowerCase() === "false") {
    return false
  }
  if (value.trim().toLowerCase() === "true") {
    return true
  }
  throw new Error("OPENSTATES_SCHEDULES_ENABLED must be true or false")
}

export function parseOpenStatesScheduleJurisdictions(value: string | undefined): readonly OpenStatesJurisdiction[] {
  const values =
    value
      ?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? []
  const parsed = z.array(z.enum(supportedOpenStatesJurisdictions)).parse(values)
  if (new Set(parsed).size !== parsed.length) {
    throw new Error("OPENSTATES_SCHEDULES_ENABLED_STATES contains duplicate jurisdictions")
  }
  return parsed
}
