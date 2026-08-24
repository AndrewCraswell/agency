import {
  FIE_TIMING_BANDS,
  getFieTimingBandEndpointUs,
  loadTimingTable,
  validateTimingTable,
  type TimingTable,
  type TimingTableRevision
} from "./timing-table.js"

export type TimingBoundaryWeapon = "epee" | "foil" | "sabre"
export type TimingBoundarySide = "left" | "right"
export type TimingBoundaryPosition = "below" | "at" | "above"
export type TimingBoundaryKind = "runtime" | "reference"

export type TimingBoundaryVector = {
  readonly id: string
  readonly weapon: TimingBoundaryWeapon
  readonly boundary: string
  readonly kind: TimingBoundaryKind
  readonly side: TimingBoundarySide
  readonly position: TimingBoundaryPosition
  readonly boundaryUs: number
  readonly elapsedUs: number
}

type BoundaryDefinition = {
  readonly boundary: string
  readonly kind: TimingBoundaryKind
  readonly references?: readonly ReferenceDefinition[]
  readonly weapon: TimingBoundaryWeapon
  readonly valueUs: (table: TimingTable) => number
}

type ReferenceDefinition = {
  readonly boundary: string
  readonly valueUs: (table: TimingTable) => number
}

const SIDES: readonly TimingBoundarySide[] = ["left", "right"]
const POSITIONS: readonly TimingBoundaryPosition[] = ["below", "at", "above"]

/**
 * Only the rule identity already used by the committed golden corpus is
 * approved. New weapon rule identities must be reviewed before they can map
 * to a timing table; they are intentionally not guessed here.
 */
const APPROVED_RULE_TO_TIMING: Readonly<Record<string, TimingTableRevision>> = Object.freeze({
  "fie-2026-epee": "timing-1",
  "fie-2026-foil": "timing-1",
  "fie-2026-sabre": "timing-1"
})

const BOUNDARIES: readonly BoundaryDefinition[] = [
  {
    boundary: "contact-minimum",
    kind: "runtime",
    references: [
      {
        boundary: "contact-minimum-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.epee.contactMinimumUs, "latest")
      }
    ],
    valueUs: (table) => table.epee.contactMinimumUs,
    weapon: "epee"
  },
  {
    boundary: "double-hit-window",
    kind: "runtime",
    references: [
      {
        boundary: "double-hit-window-envelope-earliest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.epee.doubleHitWindowUs, "earliest")
      },
      {
        boundary: "double-hit-window-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.epee.doubleHitWindowUs, "latest")
      }
    ],
    valueUs: (table) => table.epee.doubleHitWindowUs,
    weapon: "epee"
  },
  {
    boundary: "contact-break-minimum",
    kind: "runtime",
    references: [
      {
        boundary: "contact-break-minimum-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.foil.contactBreakMinimumUs, "latest")
      }
    ],
    valueUs: (table) => table.foil.contactBreakMinimumUs,
    weapon: "foil"
  },
  {
    boundary: "lockout",
    kind: "runtime",
    references: [
      {
        boundary: "lockout-envelope-earliest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.foil.lockoutUs, "earliest")
      },
      {
        boundary: "lockout-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.foil.lockoutUs, "latest")
      }
    ],
    valueUs: (table) => table.foil.lockoutUs,
    weapon: "foil"
  },
  {
    boundary: "minimum-contact",
    kind: "runtime",
    valueUs: (table) => table.sabre.minimumContactUs,
    weapon: "sabre"
  },
  {
    boundary: "blade-registration-latest",
    kind: "runtime",
    valueUs: (table) => table.sabre.bladeRegistrationLatestUs,
    weapon: "sabre"
  },
  {
    boundary: "blade-recovery",
    kind: "runtime",
    valueUs: (table) => table.sabre.bladeRecoveryUs,
    weapon: "sabre"
  },
  {
    boundary: "control-break",
    kind: "runtime",
    references: [
      {
        boundary: "control-break-envelope-earliest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.controlBreakUs, "earliest")
      },
      {
        boundary: "control-break-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.controlBreakUs, "latest")
      }
    ],
    valueUs: (table) => table.sabre.controlBreakUs,
    weapon: "sabre"
  },
  {
    boundary: "lockout",
    kind: "runtime",
    references: [
      {
        boundary: "lockout-envelope-earliest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "earliest")
      },
      {
        boundary: "lockout-envelope-latest",
        valueUs: () => getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "latest")
      }
    ],
    valueUs: (table) => table.sabre.lockoutUs,
    weapon: "sabre"
  },
  {
    boundary: "sensitivity-test-point",
    kind: "reference",
    valueUs: (table) => table.sabre.sensitivityTestPointUs,
    weapon: "sabre"
  }
]

function offsetFor(position: TimingBoundaryPosition): number {
  if (position === "below") {
    return -1
  }

  if (position === "above") {
    return 1
  }

  return 0
}

function makeVector(
  definition: BoundaryDefinition,
  side: TimingBoundarySide,
  position: TimingBoundaryPosition,
  boundaryUs: number
): TimingBoundaryVector {
  const elapsedUs = boundaryUs + offsetFor(position)

  return Object.freeze({
    boundary: definition.boundary,
    boundaryUs,
    elapsedUs,
    id: `${definition.weapon}.${definition.boundary}.${side}.${position}`,
    kind: definition.kind,
    position,
    side,
    weapon: definition.weapon
  })
}

/**
 * Generates the ordered below, at, and above vectors for every published
 * timing scalar. A supplied table is validated before any value is read.
 */
export function generateTimingBoundaryVectors(
  table: TimingTable = loadTimingTable("timing-1")
): readonly TimingBoundaryVector[] {
  validateTimingTable(table)

  const vectors = BOUNDARIES.flatMap((definition) => {
    const boundaryUs = definition.valueUs(table)
    const runtimeVectors = SIDES.flatMap((side) =>
      POSITIONS.map((position) => makeVector(definition, side, position, boundaryUs))
    )
    const referenceVectors = (definition.references ?? []).flatMap((reference) =>
      SIDES.map((side) =>
        makeVector(
          { ...definition, boundary: reference.boundary, kind: "reference", valueUs: reference.valueUs },
          side,
          "at",
          reference.valueUs(table)
        )
      )
    )

    return [...runtimeVectors, ...referenceVectors]
  })

  return Object.freeze(vectors)
}

/** Loads the table selected by an approved golden-scenario rule identity. */
export function loadTimingTableForRuleRevision(ruleRevision: unknown): TimingTable {
  if (typeof ruleRevision !== "string") {
    throw new RangeError("unknown-rule-revision")
  }

  if (!Object.hasOwn(APPROVED_RULE_TO_TIMING, ruleRevision)) {
    throw new RangeError("unknown-rule-revision")
  }

  const timingRevision = APPROVED_RULE_TO_TIMING[ruleRevision]
  return loadTimingTable(timingRevision)
}

/** Exposes the reviewed mapping for manifest and harness diagnostics. */
export function approvedRuleRevisionMappings(): Readonly<Record<string, TimingTableRevision>> {
  return APPROVED_RULE_TO_TIMING
}
