export type OpenStatesScheduleActivationInput = Readonly<{
  activate: boolean
  activateOpenStates: boolean
  openStatesSchedulesEnabled: boolean
}>

/**
 * OpenStates polling requires a provider quota acknowledgement in addition to
 * the normal schedule activation request. Both opt-ins fail closed.
 */
export function resolveOpenStatesScheduleActivation(input: OpenStatesScheduleActivationInput): boolean {
  if (input.activateOpenStates && !input.activate) {
    throw new Error("--activate-openstates requires --activate")
  }
  if (input.activateOpenStates && !input.openStatesSchedulesEnabled) {
    throw new Error("--activate-openstates requires OPENSTATES_SCHEDULES_ENABLED=true")
  }
  return input.activate && input.activateOpenStates && input.openStatesSchedulesEnabled
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
