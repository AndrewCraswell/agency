import type { EpeeResistanceContact, EpeeResistanceSample, EpeeResistanceScoringState } from "./epee-resistance.js"
import type { FoilContact, FoilSample, FoilScoringState } from "./foil.js"
import type { SabreContact, SabreSample, SabreScoringState } from "./sabre.js"

export const DEFAULT_PROPERTY_SEED = 0x1a09_2026
export const DEFAULT_PROPERTY_CASE_COUNT = 24

export type ScoringPropertyCase =
  | {
      readonly id: string
      readonly samples: readonly EpeeResistanceSample[]
      readonly weapon: "epee"
    }
  | {
      readonly id: string
      readonly samples: readonly FoilSample[]
      readonly weapon: "foil"
    }
  | {
      readonly id: string
      readonly samples: readonly SabreSample[]
      readonly weapon: "sabre"
    }

export type ScoringPropertyCorpus = Readonly<{
  cases: readonly ScoringPropertyCase[]
  seed: number
}>

const NO_MEASUREMENT = Object.freeze({
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
})
const NORMAL_10_OHM = Object.freeze({
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 0
})
const EXCEPTIONAL_100_OHM = Object.freeze({
  resistanceMilliOhms: 100_000,
  resistanceUncertaintyMilliOhms: 0
})
const UNCERTAIN_10_OHM = Object.freeze({
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 1
})

const EPEE_OPEN: EpeeResistanceContact = Object.freeze({
  circuitComplete: "open",
  contactResistance: NO_MEASUREMENT,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
})
const EPEE_NORMAL: EpeeResistanceContact = Object.freeze({
  circuitComplete: "closed",
  contactResistance: NORMAL_10_OHM,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
})
const EPEE_EXCEPTIONAL: EpeeResistanceContact = Object.freeze({
  circuitComplete: "closed",
  contactResistance: EXCEPTIONAL_100_OHM,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
})
const EPEE_GROUNDED: EpeeResistanceContact = Object.freeze({
  circuitComplete: "closed",
  contactResistance: EXCEPTIONAL_100_OHM,
  groundPathResistance: EXCEPTIONAL_100_OHM,
  groundedMaterial: "grounded",
  lineIntegrity: "intact"
})
const EPEE_UNCERTAIN: EpeeResistanceContact = Object.freeze({
  circuitComplete: "closed",
  contactResistance: UNCERTAIN_10_OHM,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
})
const EPEE_UNSAFE: readonly EpeeResistanceContact[] = [
  { ...EPEE_NORMAL, lineIntegrity: "cross-line" },
  { ...EPEE_NORMAL, lineIntegrity: "out-of-range" },
  { ...EPEE_NORMAL, lineIntegrity: "indeterminate" },
  { ...EPEE_NORMAL, lineIntegrity: "unavailable" },
  { ...EPEE_NORMAL, circuitComplete: "indeterminate" },
  { ...EPEE_NORMAL, circuitComplete: "unavailable" },
  { ...EPEE_NORMAL, groundedMaterial: "indeterminate" },
  { ...EPEE_NORMAL, groundedMaterial: "unavailable" },
  EPEE_UNCERTAIN,
  EPEE_GROUNDED,
  { ...EPEE_NORMAL, contactResistance: NO_MEASUREMENT }
]
const EPEE_CONTACTS: readonly EpeeResistanceContact[] = [
  EPEE_OPEN,
  EPEE_NORMAL,
  EPEE_EXCEPTIONAL,
  EPEE_GROUNDED,
  EPEE_UNCERTAIN,
  ...EPEE_UNSAFE
]

const FOIL_CLOSED: FoilContact = Object.freeze({
  circuitBreak: "closed",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
})
const FOIL_ON_TARGET: FoilContact = Object.freeze({ ...FOIL_CLOSED, circuitBreak: "open" })
const FOIL_OFF_TARGET: FoilContact = Object.freeze({ ...FOIL_ON_TARGET, targetContext: "nonTarget" })
const FOIL_CONTACTS: readonly FoilContact[] = [
  FOIL_CLOSED,
  FOIL_ON_TARGET,
  FOIL_OFF_TARGET,
  { ...FOIL_ON_TARGET, targetContext: "grounded" },
  { ...FOIL_ON_TARGET, integrity: "lameFault" },
  { ...FOIL_ON_TARGET, integrity: "weaponFault" },
  { ...FOIL_ON_TARGET, integrity: "indeterminate" },
  { ...FOIL_ON_TARGET, integrity: "unavailable" },
  { ...FOIL_ON_TARGET, circuitBreak: "indeterminate" },
  { ...FOIL_ON_TARGET, circuitBreak: "unavailable" },
  { ...FOIL_ON_TARGET, targetContext: "indeterminate" },
  { ...FOIL_ON_TARGET, targetContext: "unavailable" }
]

const SABRE_READY: SabreContact = Object.freeze({
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "absent",
  targetContact: "target"
})
const SABRE_NON_CONDUCTIVE: SabreContact = Object.freeze({
  ...SABRE_READY,
  targetContact: "nonConductiveSurface"
})
const SABRE_CONTACTS: readonly SabreContact[] = [
  SABRE_READY,
  SABRE_NON_CONDUCTIVE,
  { ...SABRE_READY, bladeContact: "present" },
  { ...SABRE_READY, targetContact: "indeterminate" },
  { ...SABRE_READY, targetContact: "unavailable" },
  { ...SABRE_READY, externalPathEligibility: "ineligible" },
  { ...SABRE_READY, externalPathEligibility: "indeterminate" },
  { ...SABRE_READY, externalPathEligibility: "unavailable" },
  { ...SABRE_READY, bladeContact: "indeterminate" },
  { ...SABRE_READY, bladeContact: "unavailable" },
  { ...SABRE_READY, ownEquipmentFault: "present" },
  { ...SABRE_READY, circuitBCFault: "abnormalChange" }
]

type SeededRandom = {
  nextInt(maxExclusive: number): number
  pick<Value>(values: readonly Value[]): Value
}

function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0

  return {
    nextInt(maxExclusive) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state % maxExclusive
    },
    pick<Value>(values: readonly Value[]): Value {
      return values[this.nextInt(values.length)]
    }
  }
}

function assertSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("Property seeds must be unsigned 32-bit integers")
  }
}

function assertCaseCount(caseCount: number): void {
  if (!Number.isSafeInteger(caseCount) || caseCount < 1 || caseCount > 256) {
    throw new RangeError("Property corpus size must be a safe integer from 1 through 256")
  }
}

function makeEpeeCase(random: SeededRandom, index: number): ScoringPropertyCase {
  let atUs = random.nextInt(4_000)
  const samples: EpeeResistanceSample[] = []

  for (let sampleIndex = 0; sampleIndex < 2 + random.nextInt(5); sampleIndex += 1) {
    samples.push({ atUs, left: random.pick(EPEE_CONTACTS), right: random.pick(EPEE_CONTACTS) })
    atUs += 1 + random.nextInt(20_000)
  }

  return { id: `epee-${index}`, samples, weapon: "epee" }
}

function makeFoilCase(random: SeededRandom, index: number): ScoringPropertyCase {
  let atUs = random.nextInt(4_000)
  const samples: FoilSample[] = []

  for (let sampleIndex = 0; sampleIndex < 2 + random.nextInt(5); sampleIndex += 1) {
    samples.push({ atUs, left: random.pick(FOIL_CONTACTS), right: random.pick(FOIL_CONTACTS) })
    atUs += 1 + random.nextInt(80_000)
  }

  return { id: `foil-${index}`, samples, weapon: "foil" }
}

function makeSabreCase(random: SeededRandom, index: number): ScoringPropertyCase {
  let atUs = random.nextInt(4_000)
  const samples: SabreSample[] = []

  for (let sampleIndex = 0; sampleIndex < 2 + random.nextInt(5); sampleIndex += 1) {
    samples.push({ atUs, left: random.pick(SABRE_CONTACTS), right: random.pick(SABRE_CONTACTS) })
    atUs += 1 + random.nextInt(40_000)
  }

  return { id: `sabre-${index}`, samples, weapon: "sabre" }
}

function makeCase(random: SeededRandom, index: number): ScoringPropertyCase {
  const weapon = index % 3

  if (weapon === 0) {
    return makeEpeeCase(random, index)
  }

  if (weapon === 1) {
    return makeFoilCase(random, index)
  }

  return makeSabreCase(random, index)
}

/**
 * Creates a bounded, monotonic, serializable corpus. The LCG is deliberately
 * local to this harness so replay never depends on wall-clock time or a
 * property-testing package version.
 */
export function generateScoringPropertyCorpus(
  seed: number = DEFAULT_PROPERTY_SEED,
  caseCount: number = DEFAULT_PROPERTY_CASE_COUNT
): ScoringPropertyCorpus {
  assertSeed(seed)
  assertCaseCount(caseCount)
  const random = createSeededRandom(seed)
  const cases = Array.from({ length: caseCount }, (_, index) => makeCase(random, index))

  return { cases, seed }
}

type SafetyCase =
  | { readonly contact: EpeeResistanceContact; readonly weapon: "epee" }
  | { readonly contact: FoilContact; readonly weapon: "foil" }
  | { readonly contact: SabreContact; readonly weapon: "sabre" }

const SAFETY_CASES: readonly SafetyCase[] = [
  ...EPEE_UNSAFE.map((contact) => ({ contact, weapon: "epee" as const })),
  ...FOIL_CONTACTS.slice(3).map((contact) => ({ contact, weapon: "foil" as const })),
  ...SABRE_CONTACTS.slice(3, 10).map((contact) => ({ contact, weapon: "sabre" as const }))
]

/**
 * Returns one two-sample case for each unsafe authoritative line projection.
 * The seed only changes the timestamp offset; the safety coverage remains
 * fixed and reviewable.
 */
export function generateNoHitSafetyCorpus(seed: number = DEFAULT_PROPERTY_SEED): readonly ScoringPropertyCase[] {
  assertSeed(seed)
  const random = createSeededRandom(seed)

  return SAFETY_CASES.map((unsafeCase, index) => {
    const atUs = random.nextInt(4_000)
    const elapsedUs = unsafeCase.weapon === "epee" ? 10_000 : unsafeCase.weapon === "foil" ? 20_000 : 1_000
    const id = `${unsafeCase.weapon}-unsafe-${index}`

    if (unsafeCase.weapon === "epee") {
      return {
        id,
        samples: [
          { atUs, left: unsafeCase.contact, right: unsafeCase.contact },
          { atUs: atUs + elapsedUs, left: unsafeCase.contact, right: unsafeCase.contact }
        ],
        weapon: "epee"
      }
    }

    if (unsafeCase.weapon === "foil") {
      return {
        id,
        samples: [
          { atUs, left: unsafeCase.contact, right: unsafeCase.contact },
          { atUs: atUs + elapsedUs, left: unsafeCase.contact, right: unsafeCase.contact }
        ],
        weapon: "foil"
      }
    }

    return {
      id,
      samples: [
        { atUs, left: unsafeCase.contact, right: unsafeCase.contact },
        { atUs: atUs + elapsedUs, left: unsafeCase.contact, right: unsafeCase.contact }
      ],
      weapon: "sabre"
    }
  })
}

/** Returns the stable hexadecimal seed included in failure diagnostics. */
export function formatPropertySeed(seed: number): string {
  assertSeed(seed)
  return `0x${seed.toString(16).padStart(8, "0")}`
}

/** Serializes the corpus in stable property order for byte-for-byte replay. */
export function serializeScoringPropertyCorpus(corpus: ScoringPropertyCorpus): string {
  return JSON.stringify(corpus)
}

/** Adds the seed and case name to a property failure for direct replay. */
export function runSeededProperty<T>(seed: number, propertyName: string, property: () => T): T {
  try {
    return property()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Scoring property failed seed=${formatPropertySeed(seed)} case=${propertyName}: ${detail}`, {
      cause: error
    })
  }
}

export type ScoringStateForProperty = EpeeResistanceScoringState | FoilScoringState | SabreScoringState
