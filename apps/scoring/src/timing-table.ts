/**
 * Versioned timing selections for the deterministic scoring rules.
 *
 * This module does not read a clock. A caller supplies the revision identity
 * and receives the canonical, deeply frozen table for that identity.
 */
export type TimingTableRevision = "timing-1"

export type TimingTable = {
  readonly revision: TimingTableRevision
  readonly epee: {
    readonly contactMinimumUs: number
    readonly doubleHitWindowUs: number
  }
  readonly foil: {
    readonly contactBreakMinimumUs: number
    readonly lockoutUs: number
  }
  readonly sabre: {
    readonly bladeRegistrationLatestUs: number
    readonly bladeRecoveryUs: number
    readonly controlBreakUs: number
    readonly lockoutUs: number
    readonly maximumBladeContactInterruptions: number
    readonly minimumContactUs: number
    readonly sensitivityTestPointUs: number
  }
}

const TIMING_TABLE_1: TimingTable = deepFreeze({
  revision: "timing-1",
  epee: {
    contactMinimumUs: 2_000,
    doubleHitWindowUs: 45_000
  },
  foil: {
    contactBreakMinimumUs: 13_000,
    lockoutUs: 300_000
  },
  sabre: {
    bladeRegistrationLatestUs: 5_000,
    bladeRecoveryUs: 20_000,
    controlBreakUs: 3_000,
    lockoutUs: 170_000,
    maximumBladeContactInterruptions: 10,
    minimumContactUs: 100,
    sensitivityTestPointUs: 1_000
  }
})

const TIMING_TABLES: Readonly<Record<TimingTableRevision, TimingTable>> = Object.freeze({
  "timing-1": TIMING_TABLE_1
})

function deepFreeze<const Value>(value: Value): Value {
  if (typeof value === "object" && value !== null) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue)
    }

    Object.freeze(value)
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function requireExactKeys(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`)
  }

  const actualKeys = Reflect.ownKeys(value)

  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${path} has missing or unrecognized fields`)
  }

  return value
}

function requireSafeInteger(value: unknown, path: string, unit: "count" | "microsecond"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${path} must be a non-negative safe integer ${unit} value`)
  }

  return value
}

function requireWithin(value: unknown, min: number, max: number, path: string): number {
  const timing = requireSafeInteger(value, path, "microsecond")

  if (timing < min || timing > max) {
    throw new RangeError(`${path} must be within ${min}..${max} microseconds`)
  }

  return timing
}

function requireExact(value: unknown, expected: number, path: string): void {
  if (value !== expected) {
    throw new RangeError(`${path} must equal the approved timing-1 value ${expected}`)
  }
}

/**
 * Rejects malformed, unknown, out-of-envelope, and non-canonical table data.
 *
 * The FIE timing bands constrain the applicable fields before the exact
 * released selection is checked. A value merely inside a published tolerance
 * is not a substitute for a new reviewed revision.
 */
export function validateTimingTable(candidate: unknown): asserts candidate is TimingTable {
  const table = requireExactKeys(candidate, ["epee", "foil", "revision", "sabre"], "Timing table")

  if (table.revision !== "timing-1") {
    throw new RangeError("Unknown timing-table revision")
  }

  const epee = requireExactKeys(table.epee, ["contactMinimumUs", "doubleHitWindowUs"], "Timing table epee")
  const foil = requireExactKeys(table.foil, ["contactBreakMinimumUs", "lockoutUs"], "Timing table foil")
  const sabre = requireExactKeys(
    table.sabre,
    [
      "bladeRegistrationLatestUs",
      "bladeRecoveryUs",
      "controlBreakUs",
      "lockoutUs",
      "maximumBladeContactInterruptions",
      "minimumContactUs",
      "sensitivityTestPointUs"
    ],
    "Timing table sabre"
  )

  requireWithin(epee.contactMinimumUs, 2_000, 10_000, "Timing table epee.contactMinimumUs")
  requireWithin(epee.doubleHitWindowUs, 40_000, 50_000, "Timing table epee.doubleHitWindowUs")
  requireWithin(foil.contactBreakMinimumUs, 13_000, 15_000, "Timing table foil.contactBreakMinimumUs")
  requireWithin(foil.lockoutUs, 275_000, 325_000, "Timing table foil.lockoutUs")
  const sabreMinimumContactUs = requireSafeInteger(
    sabre.minimumContactUs,
    "Timing table sabre.minimumContactUs",
    "microsecond"
  )
  if (sabreMinimumContactUs < 100) {
    throw new RangeError("Timing table sabre.minimumContactUs must be at least 100 microseconds")
  }
  requireWithin(sabre.sensitivityTestPointUs, 1_000, 1_000, "Timing table sabre.sensitivityTestPointUs")
  requireWithin(sabre.controlBreakUs, 1_000, 5_000, "Timing table sabre.controlBreakUs")
  requireSafeInteger(sabre.bladeRegistrationLatestUs, "Timing table sabre.bladeRegistrationLatestUs", "microsecond")
  requireSafeInteger(sabre.bladeRecoveryUs, "Timing table sabre.bladeRecoveryUs", "microsecond")
  requireWithin(sabre.lockoutUs, 160_000, 180_000, "Timing table sabre.lockoutUs")
  requireSafeInteger(
    sabre.maximumBladeContactInterruptions,
    "Timing table sabre.maximumBladeContactInterruptions",
    "count"
  )

  requireExact(epee.contactMinimumUs, TIMING_TABLE_1.epee.contactMinimumUs, "Timing table epee.contactMinimumUs")
  requireExact(epee.doubleHitWindowUs, TIMING_TABLE_1.epee.doubleHitWindowUs, "Timing table epee.doubleHitWindowUs")
  requireExact(
    foil.contactBreakMinimumUs,
    TIMING_TABLE_1.foil.contactBreakMinimumUs,
    "Timing table foil.contactBreakMinimumUs"
  )
  requireExact(foil.lockoutUs, TIMING_TABLE_1.foil.lockoutUs, "Timing table foil.lockoutUs")
  requireExact(sabre.minimumContactUs, TIMING_TABLE_1.sabre.minimumContactUs, "Timing table sabre.minimumContactUs")
  requireExact(
    sabre.sensitivityTestPointUs,
    TIMING_TABLE_1.sabre.sensitivityTestPointUs,
    "Timing table sabre.sensitivityTestPointUs"
  )
  requireExact(sabre.controlBreakUs, TIMING_TABLE_1.sabre.controlBreakUs, "Timing table sabre.controlBreakUs")
  requireExact(
    sabre.bladeRegistrationLatestUs,
    TIMING_TABLE_1.sabre.bladeRegistrationLatestUs,
    "Timing table sabre.bladeRegistrationLatestUs"
  )
  requireExact(sabre.bladeRecoveryUs, TIMING_TABLE_1.sabre.bladeRecoveryUs, "Timing table sabre.bladeRecoveryUs")
  requireExact(sabre.lockoutUs, TIMING_TABLE_1.sabre.lockoutUs, "Timing table sabre.lockoutUs")
  requireExact(
    sabre.maximumBladeContactInterruptions,
    TIMING_TABLE_1.sabre.maximumBladeContactInterruptions,
    "Timing table sabre.maximumBladeContactInterruptions"
  )
}

/** Loads the canonical immutable table for a known revision, or fails closed. */
export function loadTimingTable(revision: unknown): TimingTable {
  if (typeof revision !== "string") {
    throw new TypeError("Timing-table revision must be a string")
  }

  if (revision !== "timing-1") {
    throw new RangeError("Unknown timing-table revision")
  }

  const table = TIMING_TABLES[revision]

  validateTimingTable(table)
  return table
}
