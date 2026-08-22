import { describe, expect, it } from "vitest"
import {
  createFreshBoutState,
  parseBoutTransition,
  transitionBoutState,
  type BoutState,
  type Weapon
} from "./bout-state.js"
import { advanceEpeeResistanceScoring, type EpeeResistanceContact } from "./epee-resistance.js"
import { advanceFoilScoring, type FoilContact } from "./foil.js"
import { advanceSabreScoring, SABRE_RULES, type SabreContact } from "./sabre.js"

const EPEE_OPEN: EpeeResistanceContact = {
  circuitComplete: "open",
  contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundPathResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const EPEE_CLOSED: EpeeResistanceContact = {
  circuitComplete: "closed",
  contactResistance: { resistanceMilliOhms: 10_000, resistanceUncertaintyMilliOhms: 0 },
  groundPathResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const EPEE_GROUNDED: EpeeResistanceContact = {
  ...EPEE_CLOSED,
  groundedMaterial: "grounded"
}
const FOIL_CLOSED: FoilContact = {
  circuitBreak: "closed",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
}
const FOIL_ON_TARGET: FoilContact = { ...FOIL_CLOSED, circuitBreak: "open", insulationDiagnostic: "outsideRange" }

const SABRE_READY: SabreContact = {
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "present",
  targetContact: "target"
}
const SABRE_DIAGNOSTIC: SabreContact = { ...SABRE_READY, circuitBCFault: "abnormalChange" }

function activeBout(weapon: Weapon): BoutState {
  const fresh = createFreshBoutState({ boutId: `source-${weapon}`, weapon })

  switch (fresh.weapon) {
    case "epee": {
      const candidate = advanceEpeeResistanceScoring(fresh.scoring, {
        atUs: 0,
        left: EPEE_CLOSED,
        right: EPEE_OPEN
      })
      const scored = advanceEpeeResistanceScoring(candidate, { atUs: 2_000, left: EPEE_CLOSED, right: EPEE_OPEN })
      const withDiagnostic = advanceEpeeResistanceScoring(scored, {
        atUs: 3_000,
        left: EPEE_GROUNDED,
        right: EPEE_OPEN
      })
      const locked = advanceEpeeResistanceScoring(withDiagnostic, { atUs: 45_001, left: EPEE_OPEN, right: EPEE_OPEN })

      return { ...fresh, scoring: locked }
    }
    case "foil": {
      const candidate = advanceFoilScoring(fresh.scoring, { atUs: 0, left: FOIL_ON_TARGET, right: FOIL_CLOSED })
      const scored = advanceFoilScoring(candidate, { atUs: 13_000, left: FOIL_ON_TARGET, right: FOIL_CLOSED })
      const locked = advanceFoilScoring(scored, { atUs: 313_000, left: FOIL_CLOSED, right: FOIL_CLOSED })

      return { ...fresh, scoring: locked }
    }
    case "sabre": {
      const candidate = advanceSabreScoring(fresh.scoring, { atUs: 0, left: SABRE_DIAGNOSTIC, right: SABRE_READY })
      const scored = advanceSabreScoring(candidate, { atUs: 100, left: SABRE_DIAGNOSTIC, right: SABRE_READY })
      const locked = advanceSabreScoring(scored, {
        atUs: 100 + SABRE_RULES.provisionalLockoutUs,
        left: SABRE_DIAGNOSTIC,
        right: SABRE_READY
      })

      return { ...fresh, scoring: locked }
    }
  }
}

function candidateBout(weapon: Weapon): BoutState {
  const fresh = createFreshBoutState({ boutId: `candidate-${weapon}`, weapon })

  switch (fresh.weapon) {
    case "epee":
      return {
        ...fresh,
        scoring: advanceEpeeResistanceScoring(fresh.scoring, { atUs: 0, left: EPEE_CLOSED, right: EPEE_OPEN })
      }
    case "foil":
      return {
        ...fresh,
        scoring: advanceFoilScoring(fresh.scoring, { atUs: 0, left: FOIL_ON_TARGET, right: FOIL_CLOSED })
      }
    case "sabre":
      return {
        ...fresh,
        scoring: advanceSabreScoring(fresh.scoring, { atUs: 0, left: SABRE_READY, right: SABRE_READY })
      }
  }
}

function expectActiveScoringState(state: BoutState) {
  expect(state.scoring.hits).not.toEqual([])
  expect(state.scoring.isLocked).toBe(true)

  switch (state.weapon) {
    case "epee":
      expect(state.scoring.decisions).toContainEqual(
        expect.objectContaining({ disposition: "grounded-material-rejection" })
      )
      return
    case "foil":
      expect(state.scoring.left.insulationDiagnostic).toBe("outsideRange")
      return
    case "sabre":
      expect(state.scoring.left).toMatchObject({ whiteDiagnostic: "white-on", yellowDiagnostic: "yellow-on" })
  }
}

function callCreateFreshBoutState(input: unknown): BoutState {
  return Reflect.apply(createFreshBoutState, undefined, [input])
}

function callTransitionBoutState(state: unknown, transition: unknown): BoutState {
  return Reflect.apply(transitionBoutState, undefined, [state, transition])
}

describe("bout state transitions", () => {
  it("creates each weapon as a distinct empty scoring state", () => {
    for (const weapon of ["epee", "foil", "sabre"] as const) {
      const state = createFreshBoutState({ boutId: `fresh-${weapon}`, weapon })

      expect(state).toMatchObject({ boutId: `fresh-${weapon}`, boutRevision: 0, weapon })
      expect(state.scoring.hits).toEqual([])
      expect(state.scoring.isLocked).toBe(false)
      expect(state.scoring.lastSampleAtUs).toBeNull()
    }
  })

  it.each([
    ["epee", "epee"],
    ["epee", "foil"],
    ["epee", "sabre"],
    ["foil", "epee"],
    ["foil", "foil"],
    ["foil", "sabre"],
    ["sabre", "epee"],
    ["sabre", "foil"],
    ["sabre", "sabre"]
  ] as const)("clears all volatile state when changing from %s to %s", (fromWeapon, toWeapon) => {
    const original = activeBout(fromWeapon)
    const originalSnapshot = structuredClone(original)
    expectActiveScoringState(original)
    const next = transitionBoutState(original, {
      authorization: "supervisor-authorized",
      cause: "weapon-change",
      nextBoutId: `next-${fromWeapon}-${toWeapon}`,
      weapon: toWeapon
    })
    const expected = createFreshBoutState({ boutId: `next-${fromWeapon}-${toWeapon}`, weapon: toWeapon })

    expect(next).toEqual({ ...expected, boutRevision: 1 })
    expect(next).not.toHaveProperty("decisionRecords")
    expect(original).toEqual(originalSnapshot)
  })

  it.each(["epee", "foil", "sabre"] as const)("clears a pending %s candidate", (weapon) => {
    const original = candidateBout(weapon)
    const next = transitionBoutState(original, {
      authorization: "supervisor-authorized",
      cause: "bout-reset",
      nextBoutId: `candidate-cleared-${weapon}`
    })

    switch (original.weapon) {
      case "epee":
        expect(original.scoring.left.candidateSinceUs).toBe(0)
        break
      case "foil":
        expect(original.scoring.left.candidate).toMatchObject({ startedAtUs: 0 })
        break
      case "sabre":
        expect(original.scoring.left.candidateSinceUs).toBe(0)
        break
    }

    expect(next).toEqual({
      ...createFreshBoutState({ boutId: `candidate-cleared-${weapon}`, weapon }),
      boutRevision: 1
    })
  })

  it("resets to a new bout with the same weapon only after supervisor authorization", () => {
    const original = activeBout("sabre")
    const next = transitionBoutState(original, {
      authorization: "supervisor-authorized",
      cause: "bout-reset",
      nextBoutId: "sabre-reset"
    })

    expect(next).toEqual({ ...createFreshBoutState({ boutId: "sabre-reset", weapon: "sabre" }), boutRevision: 1 })
  })

  it("uses caller-provided stable identifiers and deterministic successor revisions", () => {
    const first = createFreshBoutState({ boutId: "bout-alpha", weapon: "foil" })
    const second = transitionBoutState(first, {
      authorization: "supervisor-authorized",
      cause: "bout-reset",
      nextBoutId: "bout-beta"
    })
    const third = transitionBoutState(second, {
      authorization: "supervisor-authorized",
      cause: "weapon-change",
      nextBoutId: "bout-gamma",
      weapon: "epee"
    })

    expect([first, second, third].map(({ boutId, boutRevision }) => ({ boutId, boutRevision }))).toEqual([
      { boutId: "bout-alpha", boutRevision: 0 },
      { boutId: "bout-beta", boutRevision: 1 },
      { boutId: "bout-gamma", boutRevision: 2 }
    ])
  })

  it("rejects malformed, unauthorized, and lifecycle-like transition requests", () => {
    const malformedTransitions: readonly unknown[] = [
      null,
      { authorization: "operator", cause: "bout-reset", nextBoutId: "next" },
      { authorization: "operator", cause: "weapon-change", nextBoutId: "next", weapon: "foil" },
      { authorization: "supervisor-authorized", cause: "brownout", nextBoutId: "next" },
      { authorization: "supervisor-authorized", cause: "weapon-change", nextBoutId: "next", weapon: "swordfish" },
      { authorization: "supervisor-authorized", cause: "weapon-change", nextBoutId: "   ", weapon: "foil" }
    ]

    for (const transition of malformedTransitions) {
      expect(() => parseBoutTransition(transition)).toThrow(TypeError)
    }
  })

  it("accepts only the documented properties for each supervisor transition", () => {
    expect(() =>
      parseBoutTransition({
        authorization: "supervisor-authorized",
        cause: "bout-reset",
        nextBoutId: "next",
        extra: true
      })
    ).toThrow(new TypeError("Bout reset transitions must contain only authorization, cause, and nextBoutId"))

    expect(() =>
      parseBoutTransition({
        authorization: "supervisor-authorized",
        cause: "weapon-change",
        nextBoutId: "next",
        weapon: "foil",
        extra: true
      })
    ).toThrow(new TypeError("Weapon change transitions must contain only authorization, cause, nextBoutId, and weapon"))

    expect(() =>
      parseBoutTransition({ authorization: "supervisor-authorized", cause: "bout-reset", extra: true })
    ).toThrow(new TypeError("Bout reset transitions must contain only authorization, cause, and nextBoutId"))

    const transitionWithSymbol = {
      authorization: "supervisor-authorized",
      cause: "bout-reset",
      [Symbol("unexpected")]: true
    }
    expect(() => parseBoutTransition(transitionWithSymbol)).toThrow(
      new TypeError("Bout reset transitions must contain only authorization, cause, and nextBoutId")
    )
  })

  it("rejects invalid identity use and exhausted revisions", () => {
    const invalidBoutIds = ["", " leading", "trailing ", "a".repeat(97)]
    const identifierError = new TypeError(
      "Bout identifiers must be non-empty strings without leading or trailing whitespace and at most 96 characters"
    )

    for (const boutId of invalidBoutIds) {
      expect(() => createFreshBoutState({ boutId, weapon: "epee" })).toThrow(identifierError)
      expect(() =>
        parseBoutTransition({
          authorization: "supervisor-authorized",
          cause: "weapon-change",
          nextBoutId: boutId,
          weapon: "foil"
        })
      ).toThrow(identifierError)
    }

    const first = createFreshBoutState({ boutId: "first", weapon: "foil" })
    expect(() =>
      transitionBoutState(first, {
        authorization: "supervisor-authorized",
        cause: "bout-reset",
        nextBoutId: "first"
      })
    ).toThrow(new RangeError("Successor bouts must use a new bout identifier"))

    const exhausted = { ...first, boutRevision: Number.MAX_SAFE_INTEGER }
    expect(() =>
      transitionBoutState(exhausted, {
        authorization: "supervisor-authorized",
        cause: "bout-reset",
        nextBoutId: "after-exhaustion"
      })
    ).toThrow(new RangeError("Bout revisions cannot exceed the safe integer range"))

    expect(() => callCreateFreshBoutState({ boutId: "weapon-check", weapon: "swordfish" })).toThrow(
      new TypeError("Bouts must select epee, foil, or sabre")
    )

    expect(() =>
      callTransitionBoutState(
        { ...first, boutRevision: -1 },
        { authorization: "supervisor-authorized", cause: "bout-reset", nextBoutId: "negative-revision" }
      )
    ).toThrow(new RangeError("Bout revisions must be non-negative safe integers"))

    expect(() =>
      callTransitionBoutState(
        { ...first, weapon: "swordfish" },
        { authorization: "supervisor-authorized", cause: "bout-reset", nextBoutId: "unknown-weapon" }
      )
    ).toThrow(new TypeError("Bouts must select epee, foil, or sabre"))
  })
})
