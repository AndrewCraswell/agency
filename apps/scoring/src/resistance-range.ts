export type ResistanceMeasurement = {
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
}

export type ResistanceRange = {
  max: number
  min: number
}

export type ResistanceRangeErrors = {
  incomplete: () => Error
  invalid: () => Error
  overflow: () => Error
}

/**
 * Validates a paired resistance observation and constructs its conservative
 * integer interval. Callers supply errors so their public diagnostic contract
 * remains weapon-specific.
 */
export function getResistanceRange(
  measurement: ResistanceMeasurement,
  errors: ResistanceRangeErrors
): ResistanceRange | null {
  const { resistanceMilliOhms, resistanceUncertaintyMilliOhms } = measurement

  if (resistanceMilliOhms === null && resistanceUncertaintyMilliOhms === null) {
    return null
  }

  if (resistanceMilliOhms === null || resistanceUncertaintyMilliOhms === null) {
    throw errors.incomplete()
  }

  if (
    !Number.isSafeInteger(resistanceMilliOhms) ||
    resistanceMilliOhms < 0 ||
    !Number.isSafeInteger(resistanceUncertaintyMilliOhms) ||
    resistanceUncertaintyMilliOhms < 0
  ) {
    throw errors.invalid()
  }

  if (resistanceMilliOhms > Number.MAX_SAFE_INTEGER - resistanceUncertaintyMilliOhms) {
    throw errors.overflow()
  }

  return {
    max: resistanceMilliOhms + resistanceUncertaintyMilliOhms,
    min: Math.max(0, resistanceMilliOhms - resistanceUncertaintyMilliOhms)
  }
}
