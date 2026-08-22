import { createEpeeResistanceScoringState, type EpeeResistanceScoringState } from "./epee-resistance.js"
import { createFoilScoringState, type FoilScoringState } from "./foil.js"
import { createSabreScoringState, type SabreScoringState } from "./sabre.js"

export type Weapon = "epee" | "foil" | "sabre"

export type SupervisorAuthorization = "supervisor-authorized"

export type FreshBoutInput = Readonly<{
  boutId: string
  weapon: Weapon
}>

export type BoutResetTransition = Readonly<{
  authorization: SupervisorAuthorization
  cause: "bout-reset"
  nextBoutId: string
}>

export type WeaponChangeTransition = Readonly<{
  authorization: SupervisorAuthorization
  cause: "weapon-change"
  nextBoutId: string
  weapon: Weapon
}>

export type BoutTransition = BoutResetTransition | WeaponChangeTransition

type BoutStateHeader = Readonly<{
  boutId: string
  /** Monotonically increases for each accepted successor bout. */
  boutRevision: number
}>

export type EpeeBoutState = BoutStateHeader &
  Readonly<{
    scoring: EpeeResistanceScoringState
    weapon: "epee"
  }>

export type FoilBoutState = BoutStateHeader &
  Readonly<{
    scoring: FoilScoringState
    weapon: "foil"
  }>

export type SabreBoutState = BoutStateHeader &
  Readonly<{
    scoring: SabreScoringState
    weapon: "sabre"
  }>

/**
 * The scoring state for exactly one bout. It deliberately contains no
 * decision-record collection: record production belongs to the scoring
 * authority's later capture contract.
 */
export type BoutState = EpeeBoutState | FoilBoutState | SabreBoutState

const MAX_BOUT_ID_LENGTH = 96

function isWeapon(value: unknown): value is Weapon {
  return value === "epee" || value === "foil" || value === "sabre"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function assertBoutId(boutId: unknown): asserts boutId is string {
  if (
    typeof boutId !== "string" ||
    boutId.length === 0 ||
    boutId !== boutId.trim() ||
    boutId.length > MAX_BOUT_ID_LENGTH
  ) {
    throw new TypeError(
      "Bout identifiers must be non-empty strings without leading or trailing whitespace and at most 96 characters"
    )
  }
}

function hasExactlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value)

  return keys.length === allowedKeys.length && keys.every((key) => typeof key === "string" && allowedKeys.includes(key))
}

function assertBoutRevision(boutRevision: unknown): asserts boutRevision is number {
  if (typeof boutRevision !== "number" || !Number.isSafeInteger(boutRevision) || boutRevision < 0) {
    throw new RangeError("Bout revisions must be non-negative safe integers")
  }
}

function createBoutState(boutId: string, boutRevision: number, weapon: Weapon): BoutState {
  switch (weapon) {
    case "epee":
      return { boutId, boutRevision, scoring: createEpeeResistanceScoringState(), weapon }
    case "foil":
      return { boutId, boutRevision, scoring: createFoilScoringState(), weapon }
    case "sabre":
      return { boutId, boutRevision, scoring: createSabreScoringState(), weapon }
  }
}

/** Starts a new empty bout at revision zero. */
export function createFreshBoutState(input: FreshBoutInput): BoutState {
  assertBoutId(input.boutId)

  if (!isWeapon(input.weapon)) {
    throw new TypeError("Bouts must select epee, foil, or sabre")
  }

  return createBoutState(input.boutId, 0, input.weapon)
}

/**
 * Validates a request received from the supervisor path. Authorization
 * transport and authentication are outside this state-only contract.
 */
export function parseBoutTransition(value: unknown): BoutTransition {
  if (!isRecord(value)) {
    throw new TypeError("Bout transitions must be objects")
  }

  if (value.cause === "bout-reset") {
    if (!hasExactlyKeys(value, ["authorization", "cause", "nextBoutId"])) {
      throw new TypeError("Bout reset transitions must contain only authorization, cause, and nextBoutId")
    }

    if (value.authorization !== "supervisor-authorized") {
      throw new TypeError("Bout transitions require supervisor authorization")
    }

    assertBoutId(value.nextBoutId)

    return {
      authorization: "supervisor-authorized",
      cause: "bout-reset",
      nextBoutId: value.nextBoutId
    }
  }

  if (value.cause === "weapon-change") {
    if (!hasExactlyKeys(value, ["authorization", "cause", "nextBoutId", "weapon"])) {
      throw new TypeError("Weapon change transitions must contain only authorization, cause, nextBoutId, and weapon")
    }

    if (value.authorization !== "supervisor-authorized") {
      throw new TypeError("Bout transitions require supervisor authorization")
    }

    assertBoutId(value.nextBoutId)

    if (!isWeapon(value.weapon)) {
      throw new TypeError("Weapon changes must select epee, foil, or sabre")
    }

    return {
      authorization: "supervisor-authorized",
      cause: "weapon-change",
      nextBoutId: value.nextBoutId,
      weapon: value.weapon
    }
  }

  throw new TypeError("Bout transitions must declare a supported cause")
}

/**
 * Applies a supervisor-authorized new-bout or weapon transition. It discards
 * all volatile scoring state and intentionally emits no decision record.
 */
export function transitionBoutState(state: BoutState, transition: BoutTransition): BoutState {
  assertBoutId(state.boutId)
  assertBoutRevision(state.boutRevision)

  if (!isWeapon(state.weapon)) {
    throw new TypeError("Bouts must select epee, foil, or sabre")
  }

  const acceptedTransition = parseBoutTransition(transition)

  if (acceptedTransition.nextBoutId === state.boutId) {
    throw new RangeError("Successor bouts must use a new bout identifier")
  }

  if (state.boutRevision === Number.MAX_SAFE_INTEGER) {
    throw new RangeError("Bout revisions cannot exceed the safe integer range")
  }

  const weapon = acceptedTransition.cause === "bout-reset" ? state.weapon : acceptedTransition.weapon

  return createBoutState(acceptedTransition.nextBoutId, state.boutRevision + 1, weapon)
}
