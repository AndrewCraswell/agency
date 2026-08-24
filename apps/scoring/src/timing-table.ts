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

/**
 * Published FIE timing bands are evidence constraints, not alternate runtime
 * settings. `endpointUncertainty` names where the rule text does not itself
 * choose one executable endpoint.
 */
export type FieTimingBand = {
  readonly earliestUs: number
  readonly endpointUncertainty:
    | "exact-published-endpoint"
    | "fie-tolerance-requires-product-selection"
    | "published-endpoint-needs-product-policy"
  readonly latestUs: number | null
}

export type FieTimingBandEndpoint = "earliest" | "latest"

export type FieTimingBands = {
  readonly epee: {
    readonly contactMinimumUs: FieTimingBand
    readonly doubleHitWindowUs: FieTimingBand
  }
  readonly foil: {
    readonly contactBreakMinimumUs: FieTimingBand
    readonly lockoutUs: FieTimingBand
  }
  readonly sabre: {
    readonly bladeRecoveryUs: FieTimingBand
    readonly bladeRegistrationLatestUs: FieTimingBand
    readonly controlBreakUs: FieTimingBand
    readonly lockoutUs: FieTimingBand
    readonly minimumContactUs: FieTimingBand
    readonly sensitivityTestPointUs: FieTimingBand
  }
}

function deepFreeze<const Value>(value: Value): Value {
  if (typeof value === "object" && value !== null) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue)
    }

    Object.freeze(value)
  }

  return value
}

/**
 * The sole machine-readable source for FIE timing tolerances and endpoint
 * uncertainty. Boundary generation consumes this record; no consumer carries
 * a second set of tolerance literals.
 */
export const FIE_TIMING_BANDS: FieTimingBands = deepFreeze({
  epee: {
    contactMinimumUs: {
      earliestUs: 2_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 10_000
    },
    doubleHitWindowUs: {
      earliestUs: 40_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 50_000
    }
  },
  foil: {
    contactBreakMinimumUs: {
      earliestUs: 13_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 15_000
    },
    lockoutUs: {
      earliestUs: 275_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 325_000
    }
  },
  sabre: {
    bladeRecoveryUs: {
      earliestUs: 10_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 20_000
    },
    bladeRegistrationLatestUs: {
      earliestUs: 0,
      endpointUncertainty: "published-endpoint-needs-product-policy",
      latestUs: 5_000
    },
    controlBreakUs: {
      earliestUs: 1_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 5_000
    },
    lockoutUs: {
      earliestUs: 160_000,
      endpointUncertainty: "fie-tolerance-requires-product-selection",
      latestUs: 180_000
    },
    minimumContactUs: {
      earliestUs: 100,
      endpointUncertainty: "published-endpoint-needs-product-policy",
      latestUs: null
    },
    sensitivityTestPointUs: {
      earliestUs: 1_000,
      endpointUncertainty: "exact-published-endpoint",
      latestUs: 1_000
    }
  }
})

/** Returns a published finite endpoint, rejecting an unbounded request. */
export function getFieTimingBandEndpointUs(band: FieTimingBand, endpoint: FieTimingBandEndpoint): number {
  const value = endpoint === "earliest" ? band.earliestUs : band.latestUs

  if (value === null) {
    throw new RangeError("Requested FIE timing endpoint is unbounded")
  }

  return value
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

function requireWithinFieBand(value: unknown, band: FieTimingBand, path: string): number {
  const timing = requireSafeInteger(value, path, "microsecond")

  if (timing < band.earliestUs || (band.latestUs !== null && timing > band.latestUs)) {
    const upperBound = band.latestUs === null ? "unbounded" : band.latestUs
    throw new RangeError(`${path} must be within ${band.earliestUs}..${upperBound} microseconds`)
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

  requireWithinFieBand(
    epee.contactMinimumUs,
    FIE_TIMING_BANDS.epee.contactMinimumUs,
    "Timing table epee.contactMinimumUs"
  )
  requireWithinFieBand(
    epee.doubleHitWindowUs,
    FIE_TIMING_BANDS.epee.doubleHitWindowUs,
    "Timing table epee.doubleHitWindowUs"
  )
  requireWithinFieBand(
    foil.contactBreakMinimumUs,
    FIE_TIMING_BANDS.foil.contactBreakMinimumUs,
    "Timing table foil.contactBreakMinimumUs"
  )
  requireWithinFieBand(foil.lockoutUs, FIE_TIMING_BANDS.foil.lockoutUs, "Timing table foil.lockoutUs")
  requireWithinFieBand(
    sabre.minimumContactUs,
    FIE_TIMING_BANDS.sabre.minimumContactUs,
    "Timing table sabre.minimumContactUs"
  )
  requireWithinFieBand(
    sabre.sensitivityTestPointUs,
    FIE_TIMING_BANDS.sabre.sensitivityTestPointUs,
    "Timing table sabre.sensitivityTestPointUs"
  )
  requireWithinFieBand(sabre.controlBreakUs, FIE_TIMING_BANDS.sabre.controlBreakUs, "Timing table sabre.controlBreakUs")
  requireWithinFieBand(
    sabre.bladeRegistrationLatestUs,
    FIE_TIMING_BANDS.sabre.bladeRegistrationLatestUs,
    "Timing table sabre.bladeRegistrationLatestUs"
  )
  requireWithinFieBand(
    sabre.bladeRecoveryUs,
    FIE_TIMING_BANDS.sabre.bladeRecoveryUs,
    "Timing table sabre.bladeRecoveryUs"
  )
  requireWithinFieBand(sabre.lockoutUs, FIE_TIMING_BANDS.sabre.lockoutUs, "Timing table sabre.lockoutUs")
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

/**
 * Resolves an optional scorer timing argument. A missing argument keeps the
 * direct scorer API deterministic at the approved timing-1 table; an explicit
 * table is validated before it can affect a decision.
 */
export function resolveTimingTable(argument: TimingTable | undefined): TimingTable {
  if (argument === undefined) {
    return loadTimingTable("timing-1")
  }

  validateTimingTable(argument)
  return loadTimingTable(argument.revision)
}
