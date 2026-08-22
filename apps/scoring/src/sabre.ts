export type SabreSide = "left" | "right"

/** A trusted projection of the acting sabre onto the opposing return path. */
export type SabreTargetContact = "target" | "nonConductiveSurface" | "indeterminate" | "unavailable"

/**
 * The acquisition layer has already evaluated the FIE 100-ohm external-path
 * requirement. This rule layer deliberately receives no raw analogue value.
 */
export type SabreExternalPathEligibility = "eligible" | "ineligible" | "indeterminate" | "unavailable"

export type SabreOwnEquipmentFault = "present" | "absent" | "indeterminate" | "unavailable"

export type SabreBladeContact = "present" | "absent" | "indeterminate" | "unavailable"

/**
 * `controlBreak` is the trusted projection of a B/C break strictly above
 * 250 ohms. Its three-millisecond duration is qualified below.
 */
export type SabreCircuitBCFault = "normal" | "controlBreak" | "abnormalChange" | "indeterminate" | "unavailable"

export type SabreContact = {
  bladeContact: SabreBladeContact
  circuitBCFault: SabreCircuitBCFault
  externalPathEligibility: SabreExternalPathEligibility
  ownEquipmentFault: SabreOwnEquipmentFault
  targetContact: SabreTargetContact
}

export type SabreSample = {
  atUs: number
  left: SabreContact
  right: SabreContact
}

export type SabreHit = {
  qualifiedAtUs: number
  side: SabreSide
  startedAtUs: number
}

export type SabreYellowDiagnostic = "yellow-on" | "yellow-off" | "indeterminate" | "unavailable"

export type SabreWhiteDiagnostic = "white-on" | "white-off" | "indeterminate" | "unavailable"

export type SabreObservationStatus =
  | "ready"
  | "non-conductive-surface"
  | "external-path-ineligible"
  | "whipover-rejection"
  | "indeterminate"
  | "unavailable"

type SabreSideState = {
  bladeMediated: SabreBladeMediatedHistory | null
  candidateSinceUs: number | null
  controlBreakSinceUs: number | null
  isRegistered: boolean
  observationStatus: SabreObservationStatus
  whiteDiagnostic: SabreWhiteDiagnostic
  yellowDiagnostic: SabreYellowDiagnostic
}

export type SabreBladeMediatedHistory = {
  interruptionCount: number
  lastBladeContact: "present" | "absent"
  startedAtUs: number
}

export type SabreScoringState = {
  firstHitSignalledAtUs: number | null
  hits: readonly SabreHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: SabreSideState
  lockoutEndsAtUs: number | null
  right: SabreSideState
}

export const SABRE_RULES = {
  /** FIE SABRE-03: contacts below this duration must not signal. */
  minimumContactUs: 100,
  /** FIE SABRE-03 sensitivity upper test point. It is not an expiry timer. */
  sensitivityTestPointUs: 1_000,
  /** FIE SABRE-07's nominal control-break duration. */
  provisionalControlBreakUs: 3_000,
  /**
   * Provisional inclusive product endpoint for SABRE-06's 0-4 ms (+1 ms)
   * registration region. M1-07 must replace it with a released rule-table.
   */
  provisionalBladeRegistrationLatestUs: 5_000,
  /**
   * Provisional recovery endpoint for SABRE-06's 15 ms +/- 5 ms behaviour.
   * A retained unsignalled blade-mediated sequence suppresses candidates below
   * this instant.
   */
  provisionalBladeRecoveryUs: 20_000,
  /** SABRE-06's stated maximum number of blade-contact interruptions. */
  maximumBladeContactInterruptions: 10,
  /** FIE SABRE-05 tolerance references, not active product endpoints. */
  eventWindowEarliestUs: 160_000,
  eventWindowLatestUs: 180_000,
  /**
   * Provisional product choice inside FIE SABRE-05's 170 ms +/- 10 ms band.
   * M1-07 must replace this with a reviewed timing-table endpoint policy.
   */
  provisionalLockoutUs: 170_000
} as const

const INITIAL_SIDE_STATE: SabreSideState = {
  bladeMediated: null,
  candidateSinceUs: null,
  controlBreakSinceUs: null,
  isRegistered: false,
  observationStatus: "unavailable",
  whiteDiagnostic: "unavailable",
  yellowDiagnostic: "unavailable"
}

export function createSabreScoringState(): SabreScoringState {
  return {
    firstHitSignalledAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_SIDE_STATE,
    lockoutEndsAtUs: null,
    right: INITIAL_SIDE_STATE
  }
}

function toYellowDiagnostic(ownEquipmentFault: SabreOwnEquipmentFault): SabreYellowDiagnostic {
  if (ownEquipmentFault === "present") {
    return "yellow-on"
  }

  if (ownEquipmentFault === "absent") {
    return "yellow-off"
  }

  return ownEquipmentFault
}

function advanceBladeMediatedHistory(
  state: SabreSideState,
  contact: SabreContact,
  atUs: number
): SabreBladeMediatedHistory | null {
  if (contact.bladeContact === "indeterminate" || contact.bladeContact === "unavailable") {
    return null
  }

  const history = state.bladeMediated

  if (history === null) {
    return contact.targetContact === "target" &&
      contact.externalPathEligibility === "eligible" &&
      contact.bladeContact === "present"
      ? { interruptionCount: 0, lastBladeContact: "present", startedAtUs: atUs }
      : null
  }

  if (atUs - history.startedAtUs >= SABRE_RULES.provisionalBladeRecoveryUs) {
    return null
  }

  const interruptionCount =
    history.lastBladeContact === "present" && contact.bladeContact === "absent"
      ? history.interruptionCount + 1
      : history.interruptionCount

  return {
    interruptionCount,
    lastBladeContact: contact.bladeContact,
    startedAtUs: history.startedAtUs
  }
}

function toObservationStatus(
  contact: SabreContact,
  bladeMediated: SabreBladeMediatedHistory | null,
  atUs: number
): SabreObservationStatus {
  if (contact.targetContact === "indeterminate" || contact.externalPathEligibility === "indeterminate") {
    return "indeterminate"
  }

  if (contact.targetContact === "unavailable" || contact.externalPathEligibility === "unavailable") {
    return "unavailable"
  }

  if (contact.bladeContact === "indeterminate") {
    return "indeterminate"
  }

  if (contact.bladeContact === "unavailable") {
    return "unavailable"
  }

  if (contact.targetContact === "nonConductiveSurface") {
    return "non-conductive-surface"
  }

  if (contact.externalPathEligibility === "ineligible") {
    return "external-path-ineligible"
  }

  if (bladeMediated === null) {
    return "ready"
  }

  const elapsedUs = atUs - bladeMediated.startedAtUs

  if (elapsedUs <= SABRE_RULES.provisionalBladeRegistrationLatestUs) {
    return "ready"
  }

  if (bladeMediated.interruptionCount > SABRE_RULES.maximumBladeContactInterruptions) {
    return "indeterminate"
  }

  return "whipover-rejection"
}

type ContactAdvance = {
  contact: SabreSideState
  hit: SabreHit | null
}

function advanceContact(side: SabreSide, state: SabreSideState, contact: SabreContact, atUs: number): ContactAdvance {
  const bladeMediated = advanceBladeMediatedHistory(state, contact, atUs)
  const observationStatus = toObservationStatus(contact, bladeMediated, atUs)
  const yellowDiagnostic = toYellowDiagnostic(contact.ownEquipmentFault)
  const controlBreakSinceUs = contact.circuitBCFault === "controlBreak" ? (state.controlBreakSinceUs ?? atUs) : null
  const controlBreakQualified =
    controlBreakSinceUs !== null && atUs - controlBreakSinceUs >= SABRE_RULES.provisionalControlBreakUs
  const hasWhiteDiagnostic =
    state.whiteDiagnostic === "white-on" || contact.circuitBCFault === "abnormalChange" || controlBreakQualified
  const whiteDiagnostic: SabreWhiteDiagnostic = hasWhiteDiagnostic
    ? "white-on"
    : contact.circuitBCFault === "indeterminate" || contact.circuitBCFault === "unavailable"
      ? contact.circuitBCFault
      : "white-off"

  const nextState = {
    bladeMediated,
    controlBreakSinceUs,
    isRegistered: state.isRegistered,
    observationStatus,
    whiteDiagnostic,
    yellowDiagnostic
  }

  if (state.isRegistered || observationStatus !== "ready") {
    return { contact: { ...nextState, candidateSinceUs: null }, hit: null }
  }

  const candidateSinceUs = state.candidateSinceUs ?? atUs

  if (atUs - candidateSinceUs < SABRE_RULES.minimumContactUs) {
    return { contact: { ...nextState, candidateSinceUs }, hit: null }
  }

  return {
    contact: { ...nextState, candidateSinceUs: null, isRegistered: true },
    hit: { qualifiedAtUs: atUs, side, startedAtUs: candidateSinceUs }
  }
}

function compareHits(left: SabreHit, right: SabreHit) {
  if (left.startedAtUs !== right.startedAtUs) {
    return left.startedAtUs - right.startedAtUs
  }

  return left.side.localeCompare(right.side)
}

function isValidAtUs(atUs: number) {
  return Number.isSafeInteger(atUs) && atUs >= 0
}

export function advanceSabreScoring(state: SabreScoringState, sample: SabreSample): SabreScoringState {
  if (!isValidAtUs(sample.atUs)) {
    throw new RangeError("Sabre samples must use non-negative safe integer timestamps")
  }

  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Sabre samples must use monotonic timestamps")
  }

  const hasReachedLockout = state.lockoutEndsAtUs !== null && sample.atUs >= state.lockoutEndsAtUs

  if (state.isLocked || hasReachedLockout) {
    return {
      ...state,
      isLocked: true,
      lastSampleAtUs: sample.atUs,
      left: { ...state.left, candidateSinceUs: null },
      right: { ...state.right, candidateSinceUs: null }
    }
  }

  const leftAdvance = advanceContact("left", state.left, sample.left, sample.atUs)
  const rightAdvance = advanceContact("right", state.right, sample.right, sample.atUs)
  const newHits = [leftAdvance.hit, rightAdvance.hit].filter((hit): hit is SabreHit => hit !== null).sort(compareHits)
  const firstHit = newHits.at(0)
  const firstHitSignalledAtUs = state.firstHitSignalledAtUs ?? firstHit?.qualifiedAtUs ?? null
  const lockoutEndsAtUs =
    state.lockoutEndsAtUs ??
    (firstHitSignalledAtUs === null ? null : firstHitSignalledAtUs + SABRE_RULES.provisionalLockoutUs)

  return {
    firstHitSignalledAtUs,
    hits: [...state.hits, ...newHits],
    isLocked: false,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    lockoutEndsAtUs,
    right: rightAdvance.contact
  }
}
