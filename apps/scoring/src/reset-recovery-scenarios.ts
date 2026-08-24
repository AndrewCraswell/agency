/**
 * M2-10 host-side reset and recovery scenario model.
 *
 * It deliberately coordinates existing virtual boundaries instead of
 * reimplementing scoring, link framing, or journal persistence.  Its purpose
 * is to make reset ownership and recovery evidence executable.
 */

import type { DecisionRecord } from "./decision-record.js"
import {
  createEventJournal,
  type EventJournal,
  type EventJournalAppendReceipt,
  type EventJournalRecovery,
  type EventJournalStorage
} from "./event-journal.js"
import { createVirtualProcessorLink, type VirtualProcessorLink } from "./virtual-processor-link.js"

export const MAX_RESET_RECOVERY_DIAGNOSTICS = 256

export type ResetRecoveryCause = "brownout" | "firmware-update" | "operator" | "power-on" | "watchdog"
export type ScoringAvailability = "available" | "awaiting-supervisor-disposition" | "unavailable"
export type ApplicationAvailability = "available" | "awaiting-record-reception" | "unavailable"
export type PrimaryOutputState = "latched" | "safe-inactive"

export type ResetRecoveryDiagnostic = Readonly<{
  applicationBootId: string
  atUs: number
  cause: ResetRecoveryCause | "link-loss" | "link-reconnect" | "whole-device-power-loss"
  detail:
    | "application-recovery-awaits-record-reception"
    | "automatic-esp32-to-stm32-reset-forbidden"
    | "journal-recovery"
    | "link-lost"
    | "link-restored-awaits-validation"
    | "scoring-recovery-awaits-supervisor-disposition"
    | "stm32-technical-recovery-failed"
    | "warm-reset-latch-unresolved"
  journalRecovery: EventJournalRecovery
  primaryOutput: PrimaryOutputState
  scoringAvailability: ScoringAvailability
  scoringBootId: string
  sequence: number
  subject: "application" | "journal" | "processor-link" | "scoring" | "whole-apparatus"
}>

export type Stm32RecoveryGates = Readonly<{
  acquisitionAndLineSafety: boolean
  clockAndConfiguration: boolean
  railAndResetSupervision: boolean
  safeOutputControls: boolean
  watchdogArmed: boolean
}>

export type ResetRecoveryScenarioOptions = Readonly<{
  applicationBootId: string
  journalStorage: EventJournalStorage
  maxDiagnostics?: number
  maxJournalRecords?: number
  processorLink?: VirtualProcessorLink
  scoringBootId: string
}>

export type ResetRecoveryScenario = Readonly<{
  readonly applicationAvailability: ApplicationAvailability
  readonly applicationBootId: string
  appendDurableRecord: (record: DecisionRecord) => EventJournalAppendReceipt
  completeApplicationRecovery: () => void
  completeStm32TechnicalRecovery: (gates: Stm32RecoveryGates) => boolean
  confirmApplicationRecordReception: () => void
  readonly diagnostics: readonly ResetRecoveryDiagnostic[]
  disconnectLink: () => void
  readonly journal: EventJournal
  readonly link: VirtualProcessorLink
  observeStm32PrimaryOutput: (state: PrimaryOutputState) => void
  reconnectLink: () => void
  requestForbiddenEsp32ToStm32Reset: () => false
  resetApplication: (cause: ResetRecoveryCause) => void
  resetStm32: (cause: ResetRecoveryCause) => void
  restoreWholeDevicePower: () => void
  readonly scoringAvailability: ScoringAvailability
  readonly scoringBootId: string
  readonly primaryOutput: PrimaryOutputState
  supervisorAuthorizeNewScoringState: () => void
  wholeDevicePowerLoss: () => void
}>

const MAX_IDENTIFIER_LENGTH = 128

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertIdentifier(value: unknown, description: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    throw new TypeError(`${description} must be a bounded identifier`)
  }
}

function assertResetCause(value: unknown): asserts value is ResetRecoveryCause {
  if (
    value !== "brownout" &&
    value !== "firmware-update" &&
    value !== "operator" &&
    value !== "power-on" &&
    value !== "watchdog"
  ) {
    throw new TypeError("Reset recovery cause is not recognized")
  }
}

function assertPositiveBoundedInteger(value: unknown, description: string, maximum: number): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${description} must be from 1 through ${maximum}`)
  }
}

function readOptionDataField(options: Record<string, unknown>, key: string, required: boolean): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(options, key)
  if (descriptor === undefined) {
    if (required) {
      throw new TypeError(`Reset recovery scenario options require ${key}`)
    }
    return undefined
  }
  if (!descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`Reset recovery scenario option ${key} must be an enumerable data field`)
  }
  return descriptor.value
}

function assertScenarioOptions(value: unknown): asserts value is ResetRecoveryScenarioOptions {
  if (!isRecord(value)) {
    throw new TypeError("Reset recovery scenario options must be an object")
  }

  const allowed = [
    "applicationBootId",
    "journalStorage",
    "maxDiagnostics",
    "maxJournalRecords",
    "processorLink",
    "scoringBootId"
  ]
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.includes(key)) {
      throw new TypeError("Reset recovery scenario options have an unrecognized field")
    }
  }

  const applicationBootId = readOptionDataField(value, "applicationBootId", true)
  const journalStorage = readOptionDataField(value, "journalStorage", true)
  const maxDiagnostics = readOptionDataField(value, "maxDiagnostics", false)
  const maxJournalRecords = readOptionDataField(value, "maxJournalRecords", false)
  const processorLink = readOptionDataField(value, "processorLink", false)
  const scoringBootId = readOptionDataField(value, "scoringBootId", true)
  assertIdentifier(applicationBootId, "Application boot ID")
  assertIdentifier(scoringBootId, "Scoring boot ID")
  if (typeof journalStorage !== "object" || journalStorage === null) {
    throw new TypeError("Reset recovery scenario requires journal storage")
  }
  if (maxDiagnostics !== undefined) {
    assertPositiveBoundedInteger(maxDiagnostics, "Reset recovery diagnostic capacity", MAX_RESET_RECOVERY_DIAGNOSTICS)
  }
  if (maxJournalRecords !== undefined) {
    assertPositiveBoundedInteger(maxJournalRecords, "Reset recovery journal capacity", 32)
  }
  if (processorLink !== undefined) {
    if (
      !isRecord(processorLink) ||
      typeof processorLink.connected !== "boolean" ||
      typeof processorLink.disconnect !== "function" ||
      typeof processorLink.reconnect !== "function" ||
      !isRecord(processorLink.clock) ||
      typeof processorLink.clock.nowUs !== "function"
    ) {
      throw new TypeError("Reset recovery processor link must be a virtual processor link")
    }
  }
}

function assertRecoveryGates(value: unknown): asserts value is Stm32RecoveryGates {
  if (!isRecord(value)) {
    throw new TypeError("STM32 recovery gates must be an object")
  }
  const keys = [
    "acquisitionAndLineSafety",
    "clockAndConfiguration",
    "railAndResetSupervision",
    "safeOutputControls",
    "watchdogArmed"
  ]
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError("STM32 recovery gates must have the canonical fields")
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "boolean"
    ) {
      throw new TypeError("STM32 recovery gates must contain enumerable boolean data fields")
    }
  }
}

function nextBootId(base: string, resetCount: number): string {
  const suffix = `-recovery-${resetCount}`
  if (base.length + suffix.length > MAX_IDENTIFIER_LENGTH) {
    throw new RangeError("Reset recovery boot ID capacity is exhausted")
  }
  return `${base}${suffix}`
}

/**
 * Models reset ownership around the existing journal and processor-link
 * virtual boundaries. It never invokes a scorer or derives a primary output.
 */
export function createResetRecoveryScenario(options: ResetRecoveryScenarioOptions): ResetRecoveryScenario {
  assertScenarioOptions(options)
  const maxDiagnostics = options.maxDiagnostics ?? MAX_RESET_RECOVERY_DIAGNOSTICS
  const link = options.processorLink ?? createVirtualProcessorLink()
  let journal = createEventJournal({ maxRecords: options.maxJournalRecords, storage: options.journalStorage })
  const applicationBootIdBase = options.applicationBootId
  const scoringBootIdBase = options.scoringBootId
  let applicationBootId = options.applicationBootId
  let applicationAvailability: ApplicationAvailability =
    journal.recovery.status === "corrupt" ? "unavailable" : "available"
  let scoringBootId = options.scoringBootId
  let scoringAvailability: ScoringAvailability = "available"
  let primaryOutput: PrimaryOutputState = "safe-inactive"
  let isWholeDevicePowerAbsent = false
  let applicationResetCount = 0
  let scoringResetCount = 0
  const diagnostics: ResetRecoveryDiagnostic[] = []

  function appendDiagnostic(
    subject: ResetRecoveryDiagnostic["subject"],
    cause: ResetRecoveryDiagnostic["cause"],
    detail: ResetRecoveryDiagnostic["detail"]
  ): void {
    /* v8 ignore next -- all lifecycle actions reserve their complete diagnostic count before state mutation. */
    if (diagnostics.length === maxDiagnostics) {
      throw new RangeError("Reset recovery diagnostic capacity is exhausted")
    }
    diagnostics.push(
      Object.freeze({
        applicationBootId,
        atUs: link.clock.nowUs(),
        cause,
        detail,
        journalRecovery: Object.freeze({ ...journal.recovery }),
        primaryOutput,
        scoringAvailability,
        scoringBootId,
        sequence: diagnostics.length,
        subject
      })
    )
  }

  function reserveDiagnostics(count: number): void {
    if (count > maxDiagnostics - diagnostics.length) {
      throw new RangeError("Reset recovery diagnostic capacity is exhausted")
    }
  }

  if (journal.recovery.status === "corrupt") {
    appendDiagnostic("journal", "power-on", "journal-recovery")
  }

  function resetStm32(cause: ResetRecoveryCause): void {
    assertResetCause(cause)
    if (isWholeDevicePowerAbsent) {
      throw new RangeError("STM32 cannot reset while whole-device power is absent")
    }
    const nextResetCount = scoringResetCount + 1
    const nextScoringBootId = nextBootId(scoringBootIdBase, nextResetCount)
    reserveDiagnostics(1)
    scoringResetCount = nextResetCount
    scoringBootId = nextScoringBootId
    scoringAvailability = "unavailable"
    primaryOutput = "safe-inactive"
    appendDiagnostic("scoring", cause, "warm-reset-latch-unresolved")
  }

  function completeStm32TechnicalRecovery(gates: Stm32RecoveryGates): boolean {
    assertRecoveryGates(gates)
    if (isWholeDevicePowerAbsent) {
      throw new RangeError("STM32 recovery cannot complete while whole-device power is absent")
    }
    if (scoringAvailability !== "unavailable") {
      throw new RangeError("STM32 technical recovery requires an unavailable STM32")
    }
    reserveDiagnostics(1)
    const passed =
      gates.acquisitionAndLineSafety &&
      gates.clockAndConfiguration &&
      gates.railAndResetSupervision &&
      gates.safeOutputControls &&
      gates.watchdogArmed
    if (!passed) {
      appendDiagnostic("scoring", "operator", "stm32-technical-recovery-failed")
      return false
    }
    scoringAvailability = "awaiting-supervisor-disposition"
    appendDiagnostic("scoring", "operator", "scoring-recovery-awaits-supervisor-disposition")
    return true
  }

  function supervisorAuthorizeNewScoringState(): void {
    if (isWholeDevicePowerAbsent || scoringAvailability !== "awaiting-supervisor-disposition") {
      throw new RangeError("Supervisor disposition requires completed STM32 technical recovery")
    }
    scoringAvailability = "available"
    primaryOutput = "safe-inactive"
  }

  function resetApplication(cause: ResetRecoveryCause): void {
    assertResetCause(cause)
    if (isWholeDevicePowerAbsent) {
      throw new RangeError("ESP32 cannot reset while whole-device power is absent")
    }
    const nextResetCount = applicationResetCount + 1
    const nextApplicationBootId = nextBootId(applicationBootIdBase, nextResetCount)
    const recoveredJournal = createEventJournal({
      maxRecords: options.maxJournalRecords,
      storage: options.journalStorage
    })
    reserveDiagnostics(1)
    applicationResetCount = nextResetCount
    applicationBootId = nextApplicationBootId
    applicationAvailability = "unavailable"
    journal = recoveredJournal
    appendDiagnostic("application", cause, "journal-recovery")
  }

  function completeApplicationRecovery(): void {
    if (isWholeDevicePowerAbsent || applicationAvailability !== "unavailable") {
      throw new RangeError("Application recovery requires an unavailable ESP32")
    }
    reserveDiagnostics(1)
    if (journal.recovery.status === "corrupt") {
      appendDiagnostic("journal", "operator", "journal-recovery")
      return
    }
    applicationAvailability = "awaiting-record-reception"
    appendDiagnostic("application", "operator", "application-recovery-awaits-record-reception")
  }

  function confirmApplicationRecordReception(): void {
    if (applicationAvailability !== "awaiting-record-reception" || !link.connected) {
      throw new RangeError("Application record reception requires a connected recovering ESP32")
    }
    applicationAvailability = "available"
  }

  function disconnectLink(): void {
    if (!link.connected) {
      return
    }
    reserveDiagnostics(1)
    link.disconnect()
    appendDiagnostic("processor-link", "link-loss", "link-lost")
  }

  function reconnectLink(): void {
    if (link.connected) {
      return
    }
    reserveDiagnostics(1)
    link.reconnect()
    appendDiagnostic("processor-link", "link-reconnect", "link-restored-awaits-validation")
  }

  function wholeDevicePowerLoss(): void {
    if (isWholeDevicePowerAbsent) {
      return
    }
    reserveDiagnostics(link.connected ? 2 : 1)
    isWholeDevicePowerAbsent = true
    applicationAvailability = "unavailable"
    scoringAvailability = "unavailable"
    primaryOutput = "safe-inactive"
    if (link.connected) {
      link.disconnect()
      appendDiagnostic("processor-link", "link-loss", "link-lost")
    }
    appendDiagnostic("whole-apparatus", "whole-device-power-loss", "warm-reset-latch-unresolved")
  }

  function restoreWholeDevicePower(): void {
    if (!isWholeDevicePowerAbsent) {
      throw new RangeError("Whole-device restoration requires an active power-loss state")
    }
    const nextApplicationResetCount = applicationResetCount + 1
    const nextScoringResetCount = scoringResetCount + 1
    const nextApplicationBootId = nextBootId(applicationBootIdBase, nextApplicationResetCount)
    const nextScoringBootId = nextBootId(scoringBootIdBase, nextScoringResetCount)
    const recoveredJournal = createEventJournal({
      maxRecords: options.maxJournalRecords,
      storage: options.journalStorage
    })
    reserveDiagnostics(1)
    isWholeDevicePowerAbsent = false
    applicationResetCount = nextApplicationResetCount
    scoringResetCount = nextScoringResetCount
    applicationBootId = nextApplicationBootId
    scoringBootId = nextScoringBootId
    journal = recoveredJournal
    appendDiagnostic("journal", "power-on", "journal-recovery")
  }

  function observeStm32PrimaryOutput(state: PrimaryOutputState): void {
    if (state !== "latched" && state !== "safe-inactive") {
      throw new TypeError("STM32 primary output state is not recognized")
    }
    if (state === "latched" && scoringAvailability !== "available") {
      throw new RangeError("An unavailable STM32 cannot assert a primary output")
    }
    primaryOutput = state
  }

  function requestForbiddenEsp32ToStm32Reset(): false {
    reserveDiagnostics(1)
    appendDiagnostic("application", "operator", "automatic-esp32-to-stm32-reset-forbidden")
    return false
  }

  return Object.freeze({
    get applicationAvailability() {
      return applicationAvailability
    },
    get applicationBootId() {
      return applicationBootId
    },
    appendDurableRecord(record: DecisionRecord) {
      if (isWholeDevicePowerAbsent || applicationAvailability !== "available") {
        throw new RangeError("Durable record append requires an available powered application controller")
      }
      return journal.append(record)
    },
    completeApplicationRecovery,
    completeStm32TechnicalRecovery,
    confirmApplicationRecordReception,
    get diagnostics() {
      return Object.freeze(diagnostics.slice())
    },
    disconnectLink,
    get journal() {
      return journal
    },
    link,
    observeStm32PrimaryOutput,
    reconnectLink,
    requestForbiddenEsp32ToStm32Reset,
    resetApplication,
    resetStm32,
    restoreWholeDevicePower,
    get scoringAvailability() {
      return scoringAvailability
    },
    get scoringBootId() {
      return scoringBootId
    },
    get primaryOutput() {
      return primaryOutput
    },
    supervisorAuthorizeNewScoringState,
    wholeDevicePowerLoss
  })
}
