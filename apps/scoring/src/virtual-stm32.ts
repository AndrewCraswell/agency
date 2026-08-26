import { loadTimingTable, type TimingTable, type TimingTableRevision } from "./timing-table.js"
import type { VirtualClock } from "./virtual-clock.js"
import { createVirtualClock } from "./virtual-clock.js"
import {
  validateVirtualFrontEndSnapshot,
  VIRTUAL_FRONT_END_PHASE_PROFILES,
  type VirtualFrontEndSnapshot
} from "./virtual-front-end.js"

/** The three approved weapon identities at the STM32 scoring boundary. */
export type VirtualStm32Weapon = "epee" | "foil" | "sabre"

export type VirtualStm32ScorerContext = Readonly<{
  atUs: number
  timingTable: TimingTable
  weapon: VirtualStm32Weapon
}>

export type VirtualStm32ScorerAdvance<State, Outcome> = Readonly<{
  outcome: Outcome | null
  state: State
}>

/**
 * An STM32-owned input adapter and scorer for exactly one weapon. It receives
 * canonical front-end snapshots, decides their phase completeness, and may
 * return one authority outcome. Application code has no equivalent path.
 */
export type VirtualStm32WeaponScorer<State, Outcome> = Readonly<{
  advance: (
    state: State,
    snapshot: VirtualFrontEndSnapshot,
    context: VirtualStm32ScorerContext
  ) => VirtualStm32ScorerAdvance<State, Outcome>
  createState: (context: Omit<VirtualStm32ScorerContext, "atUs">) => State
  weapon: VirtualStm32Weapon
}>

export type VirtualStm32AuthoritativeOutcome<Outcome> = Readonly<{
  atUs: number
  outcome: Outcome
  source: "weapon-scorer"
  timingTableRevision: TimingTableRevision
  weapon: VirtualStm32Weapon
}>

export type VirtualStm32SnapshotReceipt<Outcome> = Readonly<{
  atUs: number
  outcome: VirtualStm32AuthoritativeOutcome<Outcome> | null
  status: "ignored-unselected-profile" | "ignored-untrusted" | "scored"
}>

export type VirtualStm32Options<State, Outcome> = Readonly<{
  clock?: VirtualClock
  maxSnapshots?: number
  onAuthoritativeOutcome?: (outcome: VirtualStm32AuthoritativeOutcome<Outcome>) => unknown
  scorer: VirtualStm32WeaponScorer<State, Outcome>
  timingTableRevision: TimingTableRevision
  weapon: VirtualStm32Weapon
}>

export type VirtualStm32<Outcome> = Readonly<{
  readonly clock: VirtualClock
  readonly isUnavailable: boolean
  readonly lastReceipt: VirtualStm32SnapshotReceipt<Outcome> | null
  readonly processedSnapshotCount: number
  readonly timingTableRevision: TimingTableRevision
  readonly weapon: VirtualStm32Weapon
  ingestSnapshot: (snapshot: VirtualFrontEndSnapshot) => VirtualStm32SnapshotReceipt<Outcome>
}>

export const DEFAULT_VIRTUAL_STM32_MAX_SNAPSHOTS = 100_000
export const MAX_VIRTUAL_STM32_MAX_SNAPSHOTS = 1_000_000
const MAX_AUTHORITATIVE_OUTCOME_DEPTH = 8
const MAX_AUTHORITATIVE_OUTCOME_ENTRIES = 128
const MAX_AUTHORITATIVE_OUTCOME_STRING_LENGTH = 512

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], description: string): void {
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
}

function assertAllowedKeys(value: Record<string, unknown>, keys: readonly string[], description: string): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${description} has unrecognized fields`)
  }
}

function assertSafeNonNegativeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertWeapon(value: unknown): asserts value is VirtualStm32Weapon {
  if (value !== "epee" && value !== "foil" && value !== "sabre") {
    throw new TypeError("Virtual STM32 weapon must be epee, foil, or sabre")
  }
}

function assertClock(value: unknown): asserts value is VirtualClock {
  if (
    !isRecord(value) ||
    typeof value.advanceTo !== "function" ||
    typeof value.nowUs !== "function" ||
    typeof value.scheduleAt !== "function"
  ) {
    throw new TypeError("Virtual STM32 clock must be a virtual clock")
  }
}

function assertScorer<State, Outcome>(value: unknown): asserts value is VirtualStm32WeaponScorer<State, Outcome> {
  if (
    !isRecord(value) ||
    typeof value.advance !== "function" ||
    typeof value.createState !== "function" ||
    !Object.hasOwn(value, "weapon")
  ) {
    throw new TypeError("Virtual STM32 scorer must provide a weapon, state factory, and advance function")
  }

  assertWeapon(value.weapon)
}

function assertCanonicalSnapshot(value: unknown): asserts value is VirtualFrontEndSnapshot {
  if (!isRecord(value)) {
    throw new TypeError("Virtual STM32 snapshots must be canonical virtual front-end snapshots")
  }

  assertExactKeys(
    value,
    ["atUs", "contradictoryRelationIds", "phase", "relations", "transitions", "trust"],
    "Virtual STM32 snapshots"
  )
  assertSafeNonNegativeInteger(value.atUs, "Virtual STM32 snapshot timestamps")

  if (value.trust !== "available" && value.trust !== "indeterminate" && value.trust !== "unavailable") {
    throw new TypeError("Virtual STM32 snapshots must declare front-end trust")
  }

  validateVirtualFrontEndSnapshot(value)
}

/**
 * The M2-02 acquisition registry, rather than an application-provided rule,
 * binds every canonical phase to its reviewed weapon profile.
 */
function weaponForReviewedPhase(snapshot: VirtualFrontEndSnapshot): VirtualStm32Weapon {
  const profile = VIRTUAL_FRONT_END_PHASE_PROFILES.find((candidate) => candidate.id === snapshot.phase.id)
  if (profile === undefined) {
    throw new RangeError("Virtual STM32 snapshots must use a reviewed acquisition phase")
  }
  return profile.weapon
}

function assertSynchronousResult(value: unknown, description: string): void {
  if (
    (typeof value === "object" && value !== null && "then" in value && typeof value.then === "function") ||
    (typeof value === "function" && "then" in value && typeof value.then === "function")
  ) {
    throw new TypeError(`${description} must complete synchronously`)
  }
}

function assertAdvance<State, Outcome>(value: unknown): asserts value is VirtualStm32ScorerAdvance<State, Outcome> {
  if (!isRecord(value)) {
    throw new TypeError("Virtual STM32 scorers must return a state and an outcome")
  }

  assertExactKeys(value, ["outcome", "state"], "Virtual STM32 scorer results")
  if (value.outcome === undefined) {
    throw new TypeError("Virtual STM32 scorer outcomes must be an outcome or null")
  }
}

type OutcomeCloneContext = {
  entries: number
  seen: WeakSet<object>
}

function cloneAuthoritativeOutcomeValue(value: unknown, context: OutcomeCloneContext, depth: number): unknown {
  if (value === null || typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Virtual STM32 authoritative outcomes cannot contain non-finite numbers")
    }
    return value
  }

  if (typeof value === "string") {
    if (value.length > MAX_AUTHORITATIVE_OUTCOME_STRING_LENGTH) {
      throw new RangeError(
        `Virtual STM32 authoritative outcome strings cannot exceed ${MAX_AUTHORITATIVE_OUTCOME_STRING_LENGTH} characters`
      )
    }
    return value
  }

  if (typeof value !== "object" || value === null) {
    throw new TypeError("Virtual STM32 authoritative outcomes must contain only plain data")
  }

  if (depth === MAX_AUTHORITATIVE_OUTCOME_DEPTH || context.seen.has(value)) {
    throw new RangeError("Virtual STM32 authoritative outcomes exceed the supported depth or contain a cycle")
  }

  context.seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_AUTHORITATIVE_OUTCOME_ENTRIES - context.entries) {
        throw new RangeError(
          `Virtual STM32 authoritative outcomes cannot exceed ${MAX_AUTHORITATIVE_OUTCOME_ENTRIES} values`
        )
      }

      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1 || !keys.includes("length")) {
        throw new TypeError("Virtual STM32 authoritative outcome arrays must use canonical data indices only")
      }

      const cloned: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("Virtual STM32 authoritative outcome arrays must use canonical data indices only")
        }

        context.entries += 1
        cloned.push(cloneAuthoritativeOutcomeValue(descriptor.value, context, depth + 1))
      }

      return Object.freeze(cloned)
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError("Virtual STM32 authoritative outcomes must contain only plain objects and arrays")
    }

    const keys = Reflect.ownKeys(value)
    if (
      keys.length > MAX_AUTHORITATIVE_OUTCOME_ENTRIES - context.entries ||
      keys.some(
        (key) => typeof key === "string" && (key.length === 0 || key.length > MAX_AUTHORITATIVE_OUTCOME_STRING_LENGTH)
      )
    ) {
      throw new RangeError(
        `Virtual STM32 authoritative outcomes cannot exceed ${MAX_AUTHORITATIVE_OUTCOME_ENTRIES} values`
      )
    }
    context.entries += keys.length

    const cloned: Record<string, unknown> = {}
    for (const key of keys) {
      if (typeof key !== "string") {
        throw new TypeError("Virtual STM32 authoritative outcomes must use string keys")
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError("Virtual STM32 authoritative outcomes cannot contain accessors")
      }
      Object.defineProperty(cloned, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        value: cloneAuthoritativeOutcomeValue(descriptor.value, context, depth + 1),
        writable: true
      })
    }

    return Object.freeze(cloned)
  } finally {
    context.seen.delete(value)
  }
}

function cloneAuthoritativeOutcome<Outcome>(outcome: Outcome): Outcome {
  return cloneAuthoritativeOutcomeValue(outcome, { entries: 1, seen: new WeakSet() }, 0) as Outcome
}

/**
 * Creates a bounded, host-only STM32 scoring shell. It advances the supplied
 * virtual clock to each canonical snapshot and exposes outcomes only after the
 * selected authoritative weapon scorer returns one.
 */
export function createVirtualStm32<State, Outcome>(
  options: VirtualStm32Options<State, Outcome>
): VirtualStm32<Outcome> {
  if (!isRecord(options)) {
    throw new TypeError("Virtual STM32 options must be an object")
  }

  assertAllowedKeys(
    options,
    ["clock", "maxSnapshots", "onAuthoritativeOutcome", "scorer", "timingTableRevision", "weapon"],
    "Virtual STM32 options"
  )
  assertWeapon(options.weapon)
  assertScorer<State, Outcome>(options.scorer)
  if (options.scorer.weapon !== options.weapon) {
    throw new RangeError("Virtual STM32 scorer weapon must match the selected weapon")
  }

  if (options.onAuthoritativeOutcome !== undefined && typeof options.onAuthoritativeOutcome !== "function") {
    throw new TypeError("Virtual STM32 authoritative outcome observers must be functions")
  }

  const maxSnapshots = options.maxSnapshots ?? DEFAULT_VIRTUAL_STM32_MAX_SNAPSHOTS
  assertSafeNonNegativeInteger(maxSnapshots, "Virtual STM32 maxSnapshots")
  if (maxSnapshots === 0 || maxSnapshots > MAX_VIRTUAL_STM32_MAX_SNAPSHOTS) {
    throw new RangeError(`Virtual STM32 maxSnapshots must be from 1 through ${MAX_VIRTUAL_STM32_MAX_SNAPSHOTS}`)
  }

  const clock = options.clock ?? createVirtualClock()
  assertClock(clock)
  const timingTable = loadTimingTable(options.timingTableRevision)
  const configuration = { timingTable, weapon: options.weapon } as const
  const initialScoringState = options.scorer.createState(configuration)
  assertSynchronousResult(initialScoringState, "Virtual STM32 scorer state factories")
  let scoringState = initialScoringState
  let lastSnapshotAtUs: number | null = null
  let processedSnapshotCount = 0
  let isScoring = false
  let isUnavailable = false
  let lastReceipt: VirtualStm32SnapshotReceipt<Outcome> | null = null

  function ingestSnapshot(snapshot: VirtualFrontEndSnapshot): VirtualStm32SnapshotReceipt<Outcome> {
    assertCanonicalSnapshot(snapshot)
    if (isUnavailable) {
      throw new RangeError("Virtual STM32 is unavailable after an authoritative outcome observer failure")
    }
    if (isScoring) {
      throw new RangeError("Virtual STM32 cannot accept a snapshot while scoring")
    }

    if (lastSnapshotAtUs !== null && snapshot.atUs < lastSnapshotAtUs) {
      throw new RangeError("Virtual STM32 snapshots must use monotonic timestamps")
    }

    if (snapshot.atUs < clock.nowUs()) {
      throw new RangeError("Virtual STM32 snapshots cannot precede the virtual clock")
    }

    if (processedSnapshotCount === maxSnapshots) {
      throw new RangeError(`Virtual STM32 snapshot limit of ${maxSnapshots} reached`)
    }

    let receipt: VirtualStm32SnapshotReceipt<Outcome> | null = null
    clock.scheduleAt(snapshot.atUs, (atUs) => {
      isScoring = true
      try {
        if (weaponForReviewedPhase(snapshot) !== options.weapon) {
          receipt = Object.freeze({ atUs, outcome: null, status: "ignored-unselected-profile" as const })
          lastReceipt = receipt
          lastSnapshotAtUs = atUs
          processedSnapshotCount += 1
          return
        }

        if (snapshot.trust !== "available") {
          receipt = Object.freeze({ atUs, outcome: null, status: "ignored-untrusted" as const })
          lastReceipt = receipt
          lastSnapshotAtUs = atUs
          processedSnapshotCount += 1
          return
        }

        const advanced = options.scorer.advance(scoringState, snapshot, { ...configuration, atUs })
        assertSynchronousResult(advanced, "Virtual STM32 scorers")
        assertAdvance<State, Outcome>(advanced)
        const outcome =
          advanced.outcome === null
            ? null
            : Object.freeze({
                atUs,
                outcome: cloneAuthoritativeOutcome(advanced.outcome),
                source: "weapon-scorer" as const,
                timingTableRevision: timingTable.revision,
                weapon: options.weapon
              })
        receipt = Object.freeze({ atUs, outcome, status: "scored" as const })
        scoringState = advanced.state
        lastReceipt = receipt
        lastSnapshotAtUs = atUs
        processedSnapshotCount += 1
        if (outcome !== null) {
          try {
            assertSynchronousResult(
              options.onAuthoritativeOutcome?.(outcome),
              "Virtual STM32 authoritative outcome observers"
            )
          } catch (error) {
            isUnavailable = true
            throw error
          }
        }
      } finally {
        isScoring = false
      }
    })
    clock.advanceTo(snapshot.atUs)

    /* v8 ignore next -- a conforming virtual clock always executes the scheduled callback at its deadline. */
    if (receipt === null) {
      throw new Error("Virtual STM32 scheduled snapshot was not processed")
    }

    return receipt
  }

  return {
    get clock() {
      return clock
    },
    ingestSnapshot,
    get isUnavailable() {
      return isUnavailable
    },
    get lastReceipt() {
      return lastReceipt
    },
    get processedSnapshotCount() {
      return processedSnapshotCount
    },
    timingTableRevision: timingTable.revision,
    weapon: options.weapon
  }
}
