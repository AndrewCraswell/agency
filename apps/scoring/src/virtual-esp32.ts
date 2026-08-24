/**
 * Virtual ESP32 decision receiver.
 *
 * This module is intentionally a read-only boundary. It accepts a delivered,
 * STM32-to-ESP32 transport frame, validates the frame and its ordering, and
 * exposes an immutable record returned by the authoritative payload decoder.
 * It does not create, edit, classify, sort, acknowledge, or clear a scoring
 * decision.
 */

import { parseDecisionRecord, type DecisionRecord } from "./decision-record.js"
import { TransportFrameError, decodeTransportFrame, type TransportFrameErrorCode } from "./transport-frame.js"
import type { VirtualLinkAttempt } from "./virtual-processor-link.js"

export const DEFAULT_VIRTUAL_ESP32_MAX_RECORDS = 256
export const MAX_VIRTUAL_ESP32_MAX_RECORDS = 1_024

const MAX_RECORD_CLONE_DEPTH = 12
const MAX_RECORD_CLONE_ENTRIES = 512
const MAX_RECORD_CLONE_STRING_LENGTH = 4_096
const MAX_UINT32 = 0xffff_ffff

/**
 * M2-05 deliberately keeps a decision-record payload opaque. Its canonical
 * codec is therefore injected by the owning M0-05/M3 implementation.
 */
export type AuthoritativeDecisionPayloadDecoder = (payload: Uint8Array) => unknown

export type VirtualEsp32RejectionReason =
  | "backpressure"
  | "delivery"
  | "frame"
  | "frame-metadata"
  | "out-of-order"
  | "payload"
  | "record-duplicate"
  | "sequence-exhausted"

export type VirtualEsp32Receipt = Readonly<{
  frameError: TransportFrameErrorCode | null
  outcome: "accepted" | "ignored" | "rejected"
  reason: VirtualEsp32RejectionReason | null
  record: DecisionRecord | null
  sequence: number | null
}>

export type VirtualEsp32Options = Readonly<{
  decodeDecisionRecordPayload: AuthoritativeDecisionPayloadDecoder
  expectedSequence?: number
  maxRecords?: number
}>

export type VirtualEsp32 = Readonly<{
  readonly expectedSequence: number | null
  readonly isLinkDegraded: boolean
  readonly lastReceipt: VirtualEsp32Receipt | null
  readonly records: readonly DecisionRecord[]
  receive: (delivery: VirtualLinkAttempt) => VirtualEsp32Receipt
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function assertSafeNonnegativeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertUint32(value: unknown, description: string): asserts value is number {
  assertSafeNonnegativeInteger(value, description)
  if (value > MAX_UINT32) {
    throw new RangeError(`${description} must be from 0 through ${MAX_UINT32}`)
  }
}

function assertOptions(value: unknown): asserts value is VirtualEsp32Options {
  if (!isRecord(value)) {
    throw new TypeError("Virtual ESP32 options must be an object")
  }

  const allowedKeys = ["decodeDecisionRecordPayload", "expectedSequence", "maxRecords"]
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    throw new TypeError("Virtual ESP32 options have unrecognized fields")
  }

  if (typeof value.decodeDecisionRecordPayload !== "function") {
    throw new TypeError("Virtual ESP32 requires an authoritative decision payload decoder")
  }

  if (value.expectedSequence !== undefined) {
    assertUint32(value.expectedSequence, "Virtual ESP32 expected sequence")
  }

  if (value.maxRecords !== undefined) {
    assertSafeNonnegativeInteger(value.maxRecords, "Virtual ESP32 maxRecords")
    if (value.maxRecords === 0 || value.maxRecords > MAX_VIRTUAL_ESP32_MAX_RECORDS) {
      throw new RangeError(`Virtual ESP32 maxRecords must be from 1 through ${MAX_VIRTUAL_ESP32_MAX_RECORDS}`)
    }
  }
}

function assertSynchronous(value: unknown, description: string): void {
  if (
    (typeof value === "object" && value !== null && "then" in value && typeof value.then === "function") ||
    (typeof value === "function" && "then" in value && typeof value.then === "function")
  ) {
    throw new TypeError(`${description} must complete synchronously`)
  }
}

function assertPlainDataObject(value: unknown, description: string): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${description} must be a plain object`)
  }

  const actualKeys = Reflect.ownKeys(value)
  for (const key of actualKeys) {
    if (typeof key !== "string") {
      throw new TypeError(`${description} must use string data fields`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${description} must use enumerable data fields`)
    }
  }
}

function assertExactDataObject(
  value: unknown,
  keys: readonly string[],
  description: string
): asserts value is Record<string, unknown> {
  assertPlainDataObject(value, description)
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
}

function assertCanonicalDataArray(value: unknown, description: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${description} must be an array`)
  }

  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1 || !keys.includes("length")) {
    throw new TypeError(`${description} must use canonical data indices only`)
  }

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    /* v8 ignore next -- the canonical own-key check above makes this impossible for an ordinary array. */
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${description} must use canonical data indices only`)
    }
  }
}

function assertExactSignalShape(value: unknown): void {
  assertExactDataObject(value, ["audible", "latched", "visual"], "Decision record signal")
}

function assertExactRawCaptureReferenceShape(value: unknown): void {
  assertExactDataObject(
    value,
    [
      "captureId",
      "contentDigest",
      "contentFormatRevision",
      "firstSequence",
      "fromUs",
      "kind",
      "lastSequence",
      "sampleCount",
      "throughUs"
    ],
    "Decision record raw capture reference"
  )
}

function assertExactOutcomeShape(value: unknown): void {
  assertPlainDataObject(value, "Decision record outcome")
  const disposition = value.disposition
  switch (disposition) {
    case "qualified-hit":
      assertExactDataObject(
        value,
        ["disposition", "hitStartedAtUs", "qualifiedAtUs", "side", "signal", "weapon"],
        "Qualified-hit decision record outcome"
      )
      break
    case "off-target":
      assertExactDataObject(
        value,
        ["disposition", "qualifiedAtUs", "side", "signal", "weapon"],
        "Off-target decision record outcome"
      )
      break
    case "rejected-contact":
      assertExactDataObject(
        value,
        ["attemptedAtUs", "attemptedSide", "disposition", "reason", "signal", "weapon"],
        "Rejected-contact decision record outcome"
      )
      break
    case "line-fault":
      assertExactDataObject(
        value,
        ["detectedAtUs", "diagnostic", "disposition", "lineId", "persistence", "side", "signal"],
        "Line-fault decision record outcome"
      )
      break
    case "reset":
      assertExactDataObject(
        value,
        ["cause", "disposition", "resetAtUs", "scope", "signal"],
        "Reset decision record outcome"
      )
      break
    case "uncertainty":
      if (value.subject === "identity") {
        assertExactDataObject(
          value,
          [
            "disposition",
            "effect",
            "identity",
            "lowerBound",
            "observedAtUs",
            "signal",
            "subject",
            "unit",
            "upperBound"
          ],
          "Identity uncertainty decision record outcome"
        )
        assertExactDataObject(value.identity, ["field", "observed", "status"], "Decision record identity uncertainty")
      } else {
        assertExactDataObject(
          value,
          ["disposition", "effect", "lowerBound", "observedAtUs", "signal", "subject", "unit", "upperBound"],
          "Uncertainty decision record outcome"
        )
      }
      break
    case "calibration":
      assertExactDataObject(
        value,
        ["calibrationId", "disposition", "performedAtUs", "signal", "status"],
        "Calibration decision record outcome"
      )
      break
    default:
      throw new TypeError("Decision record outcome has an unrecognized disposition")
  }
  assertExactSignalShape(value.signal)
}

/** Rejects non-v1 fields before a decoder result can cross into ESP32 storage. */
function assertExactDecisionRecordShape(value: unknown): void {
  assertExactDataObject(
    value,
    ["captureWindow", "decisionAtUs", "outcome", "provenance", "rawCaptureRefs", "recordId", "schemaVersion"],
    "Decision record"
  )
  assertExactDataObject(
    value.captureWindow,
    ["firstSequence", "fromUs", "lastSequence", "throughUs"],
    "Decision record capture window"
  )
  assertExactDataObject(
    value.provenance,
    [
      "calibrationProfileRevision",
      "firmware",
      "hardwareRevision",
      "lineContractRevision",
      "ruleSetRevision",
      "timingTableRevision"
    ],
    "Decision record provenance"
  )
  assertExactDataObject(
    value.provenance.firmware,
    ["buildDigest", "identity", "scoringBootId"],
    "Decision record firmware provenance"
  )
  assertCanonicalDataArray(value.rawCaptureRefs, "Decision record raw capture references")
  for (const rawCaptureReference of value.rawCaptureRefs) {
    assertExactRawCaptureReferenceShape(rawCaptureReference)
  }
  assertExactOutcomeShape(value.outcome)
}

type CloneContext = {
  entries: number
  seen: WeakSet<object>
}

function cloneRecordValue(value: unknown, context: CloneContext, depth: number): unknown {
  /* v8 ignore start -- assertExactDecisionRecordShape has already rejected these defensive invalid-data branches. */
  if (value === null || typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Authoritative decision records cannot contain non-finite numbers")
    }
    return value
  }

  if (typeof value === "string") {
    if (value.length > MAX_RECORD_CLONE_STRING_LENGTH) {
      throw new RangeError(
        `Authoritative decision record strings cannot exceed ${MAX_RECORD_CLONE_STRING_LENGTH} characters`
      )
    }
    return value
  }

  if (typeof value !== "object" || value === null) {
    throw new TypeError("Authoritative decision records must contain only plain data")
  }

  if (depth === MAX_RECORD_CLONE_DEPTH || context.seen.has(value)) {
    throw new RangeError("Authoritative decision records exceed the supported depth or contain a cycle")
  }

  context.seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_RECORD_CLONE_ENTRIES - context.entries) {
        throw new RangeError(`Authoritative decision records cannot exceed ${MAX_RECORD_CLONE_ENTRIES} values`)
      }

      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1 || !keys.includes("length")) {
        throw new TypeError("Authoritative decision record arrays must use canonical data indices only")
      }

      const cloned: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("Authoritative decision record arrays must use canonical data indices only")
        }
        context.entries += 1
        cloned.push(cloneRecordValue(descriptor.value, context, depth + 1))
      }
      return Object.freeze(cloned)
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError("Authoritative decision records must contain only plain objects and arrays")
    }

    const keys = Reflect.ownKeys(value)
    if (
      keys.length > MAX_RECORD_CLONE_ENTRIES - context.entries ||
      keys.some((key) => typeof key !== "string" || key.length === 0 || key.length > MAX_RECORD_CLONE_STRING_LENGTH)
    ) {
      throw new RangeError(`Authoritative decision records cannot exceed ${MAX_RECORD_CLONE_ENTRIES} values`)
    }

    context.entries += keys.length
    const cloned: Record<string, unknown> = {}
    for (const key of keys) {
      if (typeof key !== "string") {
        throw new TypeError("Authoritative decision records must use string keys")
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError("Authoritative decision records cannot contain accessors")
      }
      Object.defineProperty(cloned, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        value: cloneRecordValue(descriptor.value, context, depth + 1),
        writable: true
      })
    }

    return Object.freeze(cloned)
  } finally {
    context.seen.delete(value)
  }
  /* v8 ignore stop */
}

function cloneDecisionRecord(value: unknown): DecisionRecord {
  return parseDecisionRecord(cloneRecordValue(value, { entries: 1, seen: new WeakSet() }, 0))
}

function assertDeliveredStm32Attempt(value: unknown): asserts value is VirtualLinkAttempt {
  if (!isRecord(value)) {
    throw new TypeError("Virtual ESP32 deliveries must be virtual processor-link attempts")
  }

  if (value.sender !== "stm32" || value.receiver !== "esp32" || value.direction !== "stm32-to-esp32") {
    throw new RangeError("Virtual ESP32 accepts only STM32-to-ESP32 link deliveries")
  }

  if (value.outcome !== "delivered") {
    throw new RangeError("Virtual ESP32 accepts only delivered processor-link attempts")
  }

  if (!(value.wireBytes instanceof Uint8Array)) {
    throw new TypeError("Virtual ESP32 link deliveries must contain frame bytes")
  }

  assertUint32(value.sequence, "Virtual ESP32 delivery sequence")
  assertUint32(value.wireSequence, "Virtual ESP32 wire sequence")
}

function receipt(
  outcome: VirtualEsp32Receipt["outcome"],
  sequence: number | null,
  reason: VirtualEsp32RejectionReason | null = null,
  frameError: TransportFrameErrorCode | null = null,
  record: DecisionRecord | null = null
): VirtualEsp32Receipt {
  return Object.freeze({ frameError, outcome, reason, record, sequence })
}

/**
 * Creates a bounded virtual ESP32 receiver. A stream starts either at the
 * explicit expected sequence or at the first accepted complete frame. Recovery
 * is deliberately a new receiver instance: application code cannot reset the
 * stream in order to reinterpret or replay scoring decisions.
 */
export function createVirtualEsp32(options: VirtualEsp32Options): VirtualEsp32 {
  assertOptions(options)

  const maxRecords = options.maxRecords ?? DEFAULT_VIRTUAL_ESP32_MAX_RECORDS
  let expectedSequence = options.expectedSequence ?? null
  let sequenceExhausted = false
  let isLinkDegraded = false
  let lastReceipt: VirtualEsp32Receipt | null = null
  const acceptedRecords: DecisionRecord[] = []
  const acceptedRecordIds = new Set<string>()
  let isReceiving = false

  function advanceExpectedSequence(sequence: number): void {
    if (sequence === MAX_UINT32) {
      expectedSequence = null
      sequenceExhausted = true
      return
    }
    expectedSequence = sequence + 1
  }

  function reject(
    reason: VirtualEsp32RejectionReason,
    sequence: number | null,
    frameError: TransportFrameErrorCode | null = null
  ): VirtualEsp32Receipt {
    if (reason !== "record-duplicate") {
      isLinkDegraded = true
    }
    const result = receipt("rejected", sequence, reason, frameError)
    lastReceipt = result
    return result
  }

  function receive(delivery: VirtualLinkAttempt): VirtualEsp32Receipt {
    if (isReceiving) {
      throw new RangeError("Virtual ESP32 cannot receive a frame while receiving")
    }
    isReceiving = true
    try {
      try {
        assertDeliveredStm32Attempt(delivery)
      } catch {
        return reject("delivery", null)
      }

      let frame
      try {
        frame = decodeTransportFrame("esp32", delivery.wireBytes)
      } catch (error) {
        if (error instanceof TransportFrameError) {
          return reject("frame", delivery.sequence, error.code)
        }
        /* v8 ignore next -- M2-05 exports only TransportFrameError from its decoder. */
        return reject("frame", delivery.sequence)
      }

      if (frame.sequence !== delivery.sequence || frame.sequence !== delivery.wireSequence) {
        return reject("frame-metadata", delivery.sequence)
      }

      if (sequenceExhausted) {
        return reject("sequence-exhausted", frame.sequence)
      }

      if (expectedSequence !== null && frame.sequence < expectedSequence) {
        return reject("out-of-order", frame.sequence)
      }

      if (expectedSequence !== null && frame.sequence > expectedSequence) {
        return reject("out-of-order", frame.sequence)
      }

      if (frame.messageType !== "decision-record") {
        advanceExpectedSequence(frame.sequence)
        const result = receipt("ignored", frame.sequence)
        lastReceipt = result
        return result
      }

      if (acceptedRecords.length === maxRecords) {
        return reject("backpressure", frame.sequence)
      }

      let record: DecisionRecord
      try {
        const decoded = options.decodeDecisionRecordPayload(frame.payload.slice())
        assertSynchronous(decoded, "Virtual ESP32 authoritative payload decoders")
        assertExactDecisionRecordShape(decoded)
        record = cloneDecisionRecord(decoded)
      } catch {
        advanceExpectedSequence(frame.sequence)
        return reject("payload", frame.sequence)
      }

      if (acceptedRecordIds.has(record.recordId)) {
        advanceExpectedSequence(frame.sequence)
        return reject("record-duplicate", frame.sequence)
      }

      acceptedRecords.push(record)
      acceptedRecordIds.add(record.recordId)
      advanceExpectedSequence(frame.sequence)
      const result = receipt("accepted", frame.sequence, null, null, record)
      lastReceipt = result
      return result
    } finally {
      isReceiving = false
    }
  }

  return {
    get expectedSequence() {
      return expectedSequence
    },
    get isLinkDegraded() {
      return isLinkDegraded
    },
    get lastReceipt() {
      return lastReceipt
    },
    get records() {
      return acceptedRecords.slice()
    },
    receive
  }
}
