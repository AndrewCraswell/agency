import { describe, expect, it } from "vitest"
import { createFreshBoutState, transitionBoutState, type BoutState, type Weapon } from "./bout-state.js"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceContact,
  type EpeeResistanceDecision,
  type EpeeResistanceSample,
  type EpeeResistanceScoringState
} from "./epee-resistance.js"
import {
  advanceFoilScoring,
  createFoilScoringState,
  type FoilContact,
  type FoilSample,
  type FoilScoringState
} from "./foil.js"
import {
  advanceSabreScoring,
  createSabreScoringState,
  type SabreContact,
  type SabreSample,
  type SabreScoringState
} from "./sabre.js"
import {
  DEFAULT_PROPERTY_CASE_COUNT,
  DEFAULT_PROPERTY_SEED,
  formatPropertySeed,
  generateNoHitSafetyCorpus,
  generateScoringPropertyCorpus,
  runSeededProperty,
  serializeScoringPropertyCorpus,
  type ScoringPropertyCase,
  type ScoringStateForProperty
} from "./scoring-property-harness.js"

const PROPERTY_SEED = DEFAULT_PROPERTY_SEED
const EPEE_NORMAL: EpeeResistanceContact = {
  circuitComplete: "closed",
  contactResistance: { resistanceMilliOhms: 10_000, resistanceUncertaintyMilliOhms: 0 },
  groundPathResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const EPEE_OPEN: EpeeResistanceContact = {
  circuitComplete: "open",
  contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundPathResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const FOIL_ON_TARGET: FoilContact = {
  circuitBreak: "open",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
}
const FOIL_CLOSED: FoilContact = { ...FOIL_ON_TARGET, circuitBreak: "closed" }
const SABRE_READY: SabreContact = {
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "absent",
  targetContact: "target"
}
const SABRE_NON_CONDUCTIVE: SabreContact = { ...SABRE_READY, targetContact: "nonConductiveSurface" }

function replayEpee(samples: readonly EpeeResistanceSample[]): EpeeResistanceScoringState {
  return samples.reduce(
    (state, sample) => advanceEpeeResistanceScoring(state, sample),
    createEpeeResistanceScoringState()
  )
}

function replayFoil(samples: readonly FoilSample[]): FoilScoringState {
  return samples.reduce((state, sample) => advanceFoilScoring(state, sample), createFoilScoringState())
}

function replaySabre(samples: readonly SabreSample[]): SabreScoringState {
  return samples.reduce((state, sample) => advanceSabreScoring(state, sample), createSabreScoringState())
}

function replay(input: ScoringPropertyCase): ScoringStateForProperty {
  switch (input.weapon) {
    case "epee":
      return replayEpee(input.samples)
    case "foil":
      return replayFoil(input.samples)
    case "sabre":
      return replaySabre(input.samples)
  }
}

function swapSide(side: "left" | "right"): "left" | "right" {
  return side === "left" ? "right" : "left"
}

function compareSide(left: "left" | "right", right: "left" | "right"): number {
  if (left === right) {
    return 0
  }

  return left === "left" ? -1 : 1
}

function compareHit(
  left: { startedAtUs: number; side: "left" | "right" },
  right: { startedAtUs: number; side: "left" | "right" }
): number {
  return left.startedAtUs - right.startedAtUs || compareSide(left.side, right.side)
}

function decisionAtUs(decision: EpeeResistanceDecision): number {
  return decision.disposition === "qualified-hit" ? decision.hit.qualifiedAtUs : decision.atUs
}

function decisionSide(decision: EpeeResistanceDecision): "left" | "right" {
  return decision.disposition === "qualified-hit" ? decision.hit.side : decision.side
}

function compareDecision(left: EpeeResistanceDecision, right: EpeeResistanceDecision): number {
  return decisionAtUs(left) - decisionAtUs(right) || compareSide(decisionSide(left), decisionSide(right))
}

function mirrorEpeeDecision(decision: EpeeResistanceDecision): EpeeResistanceDecision {
  if (decision.disposition === "qualified-hit") {
    return { ...decision, hit: { ...decision.hit, side: swapSide(decision.hit.side) } }
  }

  return { ...decision, side: swapSide(decision.side) }
}

function mirrorEpeeState(state: EpeeResistanceScoringState): EpeeResistanceScoringState {
  return {
    ...state,
    decisions: state.decisions.map(mirrorEpeeDecision).sort(compareDecision),
    hits: state.hits.map((hit) => ({ ...hit, side: swapSide(hit.side) })).sort(compareHit),
    left: state.right,
    right: state.left
  }
}

function mirrorFoilState(state: FoilScoringState): FoilScoringState {
  return {
    ...state,
    hits: state.hits.map((hit) => ({ ...hit, side: swapSide(hit.side) })).sort(compareHit),
    left: state.right,
    right: state.left
  }
}

function mirrorSabreState(state: SabreScoringState): SabreScoringState {
  return {
    ...state,
    hits: state.hits.map((hit) => ({ ...hit, side: swapSide(hit.side) })).sort(compareHit),
    left: state.right,
    right: state.left
  }
}

function mirrorCase(input: ScoringPropertyCase): ScoringPropertyCase {
  switch (input.weapon) {
    case "epee":
      return {
        ...input,
        samples: input.samples.map((sample) => ({ ...sample, left: sample.right, right: sample.left }))
      }
    case "foil":
      return {
        ...input,
        samples: input.samples.map((sample) => ({ ...sample, left: sample.right, right: sample.left }))
      }
    case "sabre":
      return {
        ...input,
        samples: input.samples.map((sample) => ({ ...sample, left: sample.right, right: sample.left }))
      }
  }
}

function mirroredState(input: ScoringPropertyCase): ScoringStateForProperty {
  switch (input.weapon) {
    case "epee":
      return mirrorEpeeState(replayEpee(input.samples))
    case "foil":
      return mirrorFoilState(replayFoil(input.samples))
    case "sabre":
      return mirrorSabreState(replaySabre(input.samples))
  }
}

function firstSample(input: ScoringPropertyCase): EpeeResistanceSample | FoilSample | SabreSample {
  const sample = input.samples[0]

  if (sample === undefined) {
    throw new Error(`Property case ${input.id} has no samples`)
  }

  return sample
}

function expectMonotonicFailure(input: ScoringPropertyCase): void {
  if (input.weapon === "epee") {
    const sample = input.samples.at(-1)
    if (sample === undefined) {
      throw new Error(`Property case ${input.id} has no samples`)
    }
    const state = replayEpee(input.samples)
    const backdated = { ...sample, atUs: sample.atUs - 1 }
    expect(() => advanceEpeeResistanceScoring(state, backdated)).toThrow(
      new RangeError("Epee resistance samples must use monotonic timestamps")
    )
    return
  }

  if (input.weapon === "foil") {
    const sample = input.samples.at(-1)
    if (sample === undefined) {
      throw new Error(`Property case ${input.id} has no samples`)
    }
    const state = replayFoil(input.samples)
    const backdated = { ...sample, atUs: sample.atUs - 1 }
    expect(() => advanceFoilScoring(state, backdated)).toThrow(
      new RangeError("Foil samples must use monotonic timestamps")
    )
    return
  }

  const sample = input.samples.at(-1)
  if (sample === undefined) {
    throw new Error(`Property case ${input.id} has no samples`)
  }
  const state = replaySabre(input.samples)
  const backdated = { ...sample, atUs: sample.atUs - 1 }
  expect(() => advanceSabreScoring(state, backdated)).toThrow(
    new RangeError("Sabre samples must use monotonic timestamps")
  )
}

function makeGeneratedVolatileBout(input: ScoringPropertyCase, index: number): BoutState {
  const startUs = firstSample(input).atUs + index

  if (input.weapon === "epee") {
    let scoring = createEpeeResistanceScoringState()
    scoring = advanceEpeeResistanceScoring(scoring, { atUs: startUs, left: EPEE_NORMAL, right: EPEE_OPEN })
    scoring = advanceEpeeResistanceScoring(scoring, {
      atUs: startUs + 2_000,
      left: EPEE_NORMAL,
      right: EPEE_OPEN
    })
    const fresh = createFreshBoutState({ boutId: `generated-${index}`, weapon: "epee" })
    if (fresh.weapon !== "epee") {
      throw new Error("Expected epee fresh bout")
    }
    return { ...fresh, scoring }
  }

  if (input.weapon === "foil") {
    let scoring = createFoilScoringState()
    scoring = advanceFoilScoring(scoring, { atUs: startUs, left: FOIL_ON_TARGET, right: FOIL_CLOSED })
    scoring = advanceFoilScoring(scoring, {
      atUs: startUs + 13_000,
      left: FOIL_ON_TARGET,
      right: FOIL_CLOSED
    })
    const fresh = createFreshBoutState({ boutId: `generated-${index}`, weapon: "foil" })
    if (fresh.weapon !== "foil") {
      throw new Error("Expected foil fresh bout")
    }
    return { ...fresh, scoring }
  }

  let scoring = createSabreScoringState()
  scoring = advanceSabreScoring(scoring, { atUs: startUs, left: SABRE_READY, right: SABRE_NON_CONDUCTIVE })
  scoring = advanceSabreScoring(scoring, {
    atUs: startUs + 100,
    left: SABRE_READY,
    right: SABRE_NON_CONDUCTIVE
  })
  const fresh = createFreshBoutState({ boutId: `generated-${index}`, weapon: "sabre" })
  if (fresh.weapon !== "sabre") {
    throw new Error("Expected sabre fresh bout")
  }
  return { ...fresh, scoring }
}

function expectedFreshBout(boutId: string, weapon: Weapon): BoutState {
  return { ...createFreshBoutState({ boutId, weapon }), boutRevision: 1 }
}

describe("bounded seeded scoring properties", () => {
  it("serializes equal seeds byte-identically and reports a replayable seed", () => {
    const first = generateScoringPropertyCorpus(PROPERTY_SEED)
    const second = generateScoringPropertyCorpus(PROPERTY_SEED)
    const firstBytes = Buffer.from(serializeScoringPropertyCorpus(first), "utf8")
    const secondBytes = Buffer.from(serializeScoringPropertyCorpus(second), "utf8")

    expect(first).toEqual(second)
    expect(firstBytes).toEqual(secondBytes)
    expect(first.cases).toHaveLength(DEFAULT_PROPERTY_CASE_COUNT)
    expect(formatPropertySeed(PROPERTY_SEED)).toBe("0x1a092026")
    expect(serializeScoringPropertyCorpus(first)).not.toBe(
      serializeScoringPropertyCorpus(generateScoringPropertyCorpus(PROPERTY_SEED + 1))
    )
  })

  it("replays every seeded scorer deterministically without mutating its corpus input", () => {
    const corpus = generateScoringPropertyCorpus(PROPERTY_SEED)
    const serializedInput = serializeScoringPropertyCorpus(corpus)

    for (const input of corpus.cases) {
      runSeededProperty(PROPERTY_SEED, input.id, () => {
        const firstState = replay(input)
        const secondState = replay(input)
        const firstBytes = Buffer.from(JSON.stringify(firstState), "utf8")
        const secondBytes = Buffer.from(JSON.stringify(secondState), "utf8")

        expect(secondState).toEqual(firstState)
        expect(secondBytes).toEqual(firstBytes)
        expect(serializeScoringPropertyCorpus(corpus)).toBe(serializedInput)
      })
    }

    expect(serializeScoringPropertyCorpus(corpus)).toBe(serializedInput)
  })

  it("rejects unrepresentable seeds and unbounded corpus sizes", () => {
    expect(() => generateScoringPropertyCorpus(-1)).toThrow(
      new RangeError("Property seeds must be unsigned 32-bit integers")
    )
    expect(() => generateScoringPropertyCorpus(0, 0)).toThrow(
      new RangeError("Property corpus size must be a safe integer from 1 through 256")
    )
    expect(() => formatPropertySeed(0x1_0000_0000)).toThrow(
      new RangeError("Property seeds must be unsigned 32-bit integers")
    )
  })

  it("adds seed and case context to both Error and non-Error failures", () => {
    expect(runSeededProperty(PROPERTY_SEED, "success", () => "ok")).toBe("ok")
    expect(() =>
      runSeededProperty(PROPERTY_SEED, "counterexample", () => {
        throw new Error("expected failure")
      })
    ).toThrow("Scoring property failed seed=0x1a092026 case=counterexample: expected failure")
    expect(() =>
      runSeededProperty(PROPERTY_SEED, "non-error", () => {
        throw "expected string failure"
      })
    ).toThrow("Scoring property failed seed=0x1a092026 case=non-error: expected string failure")
  })

  it("preserves authoritative left/right symmetry with stable ordering", () => {
    const corpus = generateScoringPropertyCorpus(PROPERTY_SEED)

    for (const input of corpus.cases) {
      runSeededProperty(PROPERTY_SEED, input.id, () => {
        const actual = replay(mirrorCase(input))
        expect(actual).toEqual(mirroredState(input))
      })
    }
  })

  it("fails closed for every generated backdated timestamp", () => {
    const corpus = generateScoringPropertyCorpus(PROPERTY_SEED)

    for (const input of corpus.cases) {
      runSeededProperty(PROPERTY_SEED, input.id, () => expectMonotonicFailure(input))
    }
  })

  it("cannot create hits from indeterminate, unavailable, or unsafe line projections", () => {
    const safetyCorpus = generateNoHitSafetyCorpus(PROPERTY_SEED)

    expect(safetyCorpus).toHaveLength(27)

    for (const input of safetyCorpus) {
      runSeededProperty(PROPERTY_SEED, input.id, () => expect(replay(input).hits, input.id).toEqual([]))
    }
  })

  it("clears generated volatile state across reset and every weapon change", () => {
    const corpus = generateScoringPropertyCorpus(PROPERTY_SEED)
    const firstByWeapon = new Map<Weapon, ScoringPropertyCase>()

    for (const input of corpus.cases) {
      if (!firstByWeapon.has(input.weapon)) {
        firstByWeapon.set(input.weapon, input)
      }
    }

    for (const [weapon, input] of firstByWeapon) {
      const active = makeGeneratedVolatileBout(input, input.samples.length)
      expect(active.scoring.hits.length, `${weapon} generated hit`).toBe(1)

      const resetId = `${active.boutId}-reset`
      const reset = transitionBoutState(active, {
        authorization: "supervisor-authorized",
        cause: "bout-reset",
        nextBoutId: resetId
      })
      expect(reset).toEqual(expectedFreshBout(resetId, weapon))

      for (const changedWeapon of ["epee", "foil", "sabre"] as const) {
        const changedId = `${active.boutId}-${changedWeapon}`
        const changed = transitionBoutState(active, {
          authorization: "supervisor-authorized",
          cause: "weapon-change",
          nextBoutId: changedId,
          weapon: changedWeapon
        })
        expect(changed).toEqual(expectedFreshBout(changedId, changedWeapon))
      }
    }
  })
})
