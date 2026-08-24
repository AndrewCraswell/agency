import {
  MAX_TRANSPORT_FRAME_BYTES,
  TRANSPORT_FRAME_CRC_BYTES,
  TRANSPORT_FRAME_HEADER_BYTES
} from "./transport-frame.js"
import { createVirtualClock, type VirtualClock } from "./virtual-clock.js"

/** The two processor endpoints of the scoring apparatus. */
export type ProcessorEndpoint = "esp32" | "stm32"

export type ProcessorLinkDirection = "esp32-to-stm32" | "stm32-to-esp32"

export type VirtualLinkFault =
  | Readonly<{ kind: "corruption"; offset: number; xor: number }>
  | Readonly<{ kind: "delay"; delayUs: number }>
  | Readonly<{ kind: "disconnect" }>
  | Readonly<{ kind: "duplication"; copies: number }>
  | Readonly<{ kind: "loss" }>
  | Readonly<{ kind: "reordering"; delayUs: number }>

export type VirtualLinkAttemptOutcome = "backpressured" | "cancelled" | "disconnected" | "delivered" | "lost" | "queued"

/**
 * One transport attempt, including the original immutable frame and the
 * bytes that would be presented to the receiver. The link never interprets
 * the payload or repairs the wire bytes.
 */
export type VirtualLinkAttempt = Readonly<{
  attemptId: number
  connectionEpoch: number
  copyCount: number
  copyIndex: number
  direction: ProcessorLinkDirection
  frameBytes: Uint8Array
  outcome: VirtualLinkAttemptOutcome
  receiver: ProcessorEndpoint
  scheduledAtUs: number | null
  sender: ProcessorEndpoint
  sequence: number
  submittedAtUs: number
  wireBytes: Uint8Array
  wireSequence: number
  completedAtUs: number | null
  fault: VirtualLinkFault | null
}>

export type VirtualLinkSendOutcome = "backpressured" | "disconnected" | "queued"

export type VirtualLinkSendReceipt = Readonly<{
  attemptIds: readonly number[]
  connectionEpoch: number
  copiesRequested: number
  outcome: VirtualLinkSendOutcome
  submittedAtUs: number
}>

export type VirtualProcessorLinkOptions = Readonly<{
  clock?: VirtualClock
  faultScript?: readonly VirtualLinkFault[]
  onAttempt?: (attempt: VirtualLinkAttempt) => unknown
  onDelivery?: (attempt: VirtualLinkAttempt) => unknown
  queueCapacity?: number
}>

export type VirtualProcessorLink = Readonly<{
  readonly clock: VirtualClock
  readonly connected: boolean
  readonly connectionEpoch: number
  readonly faultScriptPosition: number
  readonly pendingCount: number
  readonly attempts: readonly VirtualLinkAttempt[]
  cancel: (attemptId: number) => boolean
  disconnect: () => number
  reconnect: () => boolean
  send: (sender: ProcessorEndpoint, frameBytes: Uint8Array) => VirtualLinkSendReceipt
}>

export const MIN_VIRTUAL_LINK_FRAME_BYTES = TRANSPORT_FRAME_HEADER_BYTES + TRANSPORT_FRAME_CRC_BYTES
export const DEFAULT_VIRTUAL_LINK_QUEUE_CAPACITY = 64
export const MAX_VIRTUAL_LINK_QUEUE_CAPACITY = 1_024
export const MAX_VIRTUAL_LINK_DUPLICATE_COPIES = 8
export const MAX_VIRTUAL_LINK_FAULT_SCRIPT_ENTRIES = 4_096

type MutableAttempt = {
  attemptId: number
  completedAtUs: number | null
  connectionEpoch: number
  copyCount: number
  copyIndex: number
  direction: ProcessorLinkDirection
  frameBytes: Uint8Array
  outcome: VirtualLinkAttemptOutcome
  receiver: ProcessorEndpoint
  scheduledAtUs: number | null
  sender: ProcessorEndpoint
  sequence: number
  submittedAtUs: number
  timerHandle: number | null
  wireBytes: Uint8Array
  wireSequence: number
  fault: VirtualLinkFault | null
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function assertSafeNonnegativeInteger(value: unknown, description: string): asserts value is number {
  if (!isSafeNonnegativeInteger(value)) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertEndpoint(value: unknown): asserts value is ProcessorEndpoint {
  if (value !== "esp32" && value !== "stm32") {
    throw new TypeError("Virtual processor link endpoint must be stm32 or esp32")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function receiverFor(sender: ProcessorEndpoint): ProcessorEndpoint {
  return sender === "stm32" ? "esp32" : "stm32"
}

function directionFor(sender: ProcessorEndpoint): ProcessorLinkDirection {
  return sender === "stm32" ? "stm32-to-esp32" : "esp32-to-stm32"
}

function readSequence(bytes: Uint8Array): number {
  return bytes[6]! * 0x1_000000 + bytes[7]! * 0x1_0000 + bytes[8]! * 0x100 + bytes[9]!
}

function cloneFault(fault: VirtualLinkFault | null): VirtualLinkFault | null {
  if (fault === null) {
    return null
  }

  return { ...fault }
}

function validateFault(fault: unknown): asserts fault is VirtualLinkFault {
  if (!isRecord(fault) || typeof fault.kind !== "string") {
    throw new TypeError("Invalid virtual processor link fault")
  }

  switch (fault.kind) {
    case "corruption":
      assertSafeNonnegativeInteger(fault.offset, "Virtual link corruption offset")
      const xor = fault.xor
      if (typeof xor !== "number" || !Number.isInteger(xor) || xor < 1 || xor > 0xff) {
        throw new RangeError("Virtual link corruption xor must be an integer from 1 through 255")
      }
      return
    case "delay":
    case "reordering":
      assertSafeNonnegativeInteger(fault.delayUs, "Virtual link delay")
      return
    case "disconnect":
    case "loss":
      return
    case "duplication":
      assertSafeNonnegativeInteger(fault.copies, "Virtual link duplicate copies")
      if (fault.copies < 2 || fault.copies > MAX_VIRTUAL_LINK_DUPLICATE_COPIES) {
        throw new RangeError(
          `Virtual link duplicate copies must be from 2 through ${MAX_VIRTUAL_LINK_DUPLICATE_COPIES}`
        )
      }
      return
    default:
      throw new TypeError("Invalid virtual processor link fault")
  }
}

function cloneAttempt(attempt: MutableAttempt): VirtualLinkAttempt {
  return {
    attemptId: attempt.attemptId,
    completedAtUs: attempt.completedAtUs,
    connectionEpoch: attempt.connectionEpoch,
    copyCount: attempt.copyCount,
    copyIndex: attempt.copyIndex,
    direction: attempt.direction,
    fault: cloneFault(attempt.fault),
    frameBytes: attempt.frameBytes.slice(),
    outcome: attempt.outcome,
    receiver: attempt.receiver,
    scheduledAtUs: attempt.scheduledAtUs,
    sender: attempt.sender,
    sequence: attempt.sequence,
    submittedAtUs: attempt.submittedAtUs,
    wireBytes: attempt.wireBytes.slice(),
    wireSequence: attempt.wireSequence
  }
}

function assertFrameBytes(frameBytes: unknown): asserts frameBytes is Uint8Array {
  if (!(frameBytes instanceof Uint8Array)) {
    throw new TypeError("Virtual processor link frames must be Uint8Array values")
  }

  if (frameBytes.length < MIN_VIRTUAL_LINK_FRAME_BYTES || frameBytes.length > MAX_TRANSPORT_FRAME_BYTES) {
    throw new RangeError(
      `Virtual processor link frames must be between ${MIN_VIRTUAL_LINK_FRAME_BYTES} and ${MAX_TRANSPORT_FRAME_BYTES} bytes`
    )
  }
}

function copyFaultScript(faultScript: readonly VirtualLinkFault[] | undefined): VirtualLinkFault[] {
  if (faultScript === undefined) {
    return []
  }

  if (!Array.isArray(faultScript)) {
    throw new TypeError("Virtual processor link faultScript must be an array")
  }

  if (faultScript.length > MAX_VIRTUAL_LINK_FAULT_SCRIPT_ENTRIES) {
    throw new RangeError(
      `Virtual processor link faultScript cannot exceed ${MAX_VIRTUAL_LINK_FAULT_SCRIPT_ENTRIES} entries`
    )
  }

  return faultScript.map((fault) => {
    validateFault(fault)
    return { ...fault }
  })
}

/**
 * Creates a deterministic, synchronous link between the virtual processors.
 * One fault-script entry is consumed per send. A missing entry means no fault.
 * The link accepts only complete bounded frame-sized byte arrays; transport
 * decoding and sequence acceptance remain receiver responsibilities.
 */
export function createVirtualProcessorLink(options: VirtualProcessorLinkOptions = {}): VirtualProcessorLink {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("Virtual processor link options must be an object")
  }

  const clock = options.clock ?? createVirtualClock()
  if (
    typeof clock !== "object" ||
    clock === null ||
    typeof clock.cancel !== "function" ||
    typeof clock.nowUs !== "function" ||
    typeof clock.scheduleAfter !== "function"
  ) {
    throw new TypeError("Virtual processor link clock must be a virtual clock")
  }

  const queueCapacity = options.queueCapacity ?? DEFAULT_VIRTUAL_LINK_QUEUE_CAPACITY
  assertSafeNonnegativeInteger(queueCapacity, "Virtual processor link queue capacity")
  if (queueCapacity > MAX_VIRTUAL_LINK_QUEUE_CAPACITY) {
    throw new RangeError(`Virtual processor link queue capacity cannot exceed ${MAX_VIRTUAL_LINK_QUEUE_CAPACITY}`)
  }

  if (options.onAttempt !== undefined && typeof options.onAttempt !== "function") {
    throw new TypeError("Virtual processor link onAttempt must be a function")
  }

  if (options.onDelivery !== undefined && typeof options.onDelivery !== "function") {
    throw new TypeError("Virtual processor link onDelivery must be a function")
  }

  const faultScript = copyFaultScript(options.faultScript)
  const mutableAttempts: MutableAttempt[] = []
  const pending = new Set<number>()
  let connected = true
  let connectionEpoch = 0
  let faultScriptPosition = 0
  let nextAttemptId = 0

  function notify(attempt: MutableAttempt): void {
    const snapshot = cloneAttempt(attempt)
    options.onAttempt?.(snapshot)
    if (attempt.outcome === "delivered") {
      options.onDelivery?.(cloneAttempt(attempt))
    }
  }

  function complete(attempt: MutableAttempt, outcome: Exclude<VirtualLinkAttemptOutcome, "queued">): void {
    /* v8 ignore next -- link state only calls complete for a pending attempt */
    if (attempt.outcome !== "queued") {
      return
    }

    pending.delete(attempt.attemptId)
    attempt.timerHandle = null
    attempt.outcome = outcome
    attempt.completedAtUs = clock.nowUs()
    notify(attempt)
  }

  function schedule(attempt: MutableAttempt, delayUs: number): void {
    attempt.scheduledAtUs = clock.nowUs() + delayUs
    pending.add(attempt.attemptId)
    attempt.timerHandle = clock.scheduleAfter(delayUs, () => {
      complete(attempt, attempt.fault?.kind === "loss" ? "lost" : "delivered")
    })
  }

  function makeAttempt(
    sender: ProcessorEndpoint,
    frameBytes: Uint8Array,
    wireBytes: Uint8Array,
    fault: VirtualLinkFault | null,
    copyIndex: number,
    copyCount: number,
    outcome: VirtualLinkAttemptOutcome
  ): MutableAttempt {
    const sequence = readSequence(frameBytes)
    return {
      attemptId: nextAttemptId++,
      completedAtUs: outcome === "queued" ? null : clock.nowUs(),
      connectionEpoch,
      copyCount,
      copyIndex,
      direction: directionFor(sender),
      fault: cloneFault(fault),
      frameBytes: frameBytes.slice(),
      outcome,
      receiver: receiverFor(sender),
      scheduledAtUs: null,
      sender,
      sequence,
      submittedAtUs: clock.nowUs(),
      timerHandle: null,
      wireBytes: wireBytes.slice(),
      wireSequence: readSequence(wireBytes)
    }
  }

  function recordImmediate(
    sender: ProcessorEndpoint,
    frameBytes: Uint8Array,
    fault: VirtualLinkFault | null,
    outcome: Exclude<VirtualLinkAttemptOutcome, "queued" | "delivered" | "lost" | "cancelled">
  ): MutableAttempt {
    const attempt = makeAttempt(sender, frameBytes, frameBytes, fault, 0, 1, outcome)
    mutableAttempts.push(attempt)
    notify(attempt)
    return attempt
  }

  function disconnect(): number {
    if (!connected) {
      return 0
    }

    connected = false
    let dropped = 0
    for (const attempt of mutableAttempts) {
      if (attempt.outcome !== "queued") {
        continue
      }

      clock.cancel(attempt.timerHandle!)
      complete(attempt, "disconnected")
      dropped += 1
    }
    return dropped
  }

  function reconnect(): boolean {
    if (connected) {
      return false
    }

    connected = true
    connectionEpoch += 1
    return true
  }

  function cancel(attemptId: number): boolean {
    assertSafeNonnegativeInteger(attemptId, "Virtual processor link attempt ID")
    const attempt = mutableAttempts.find((candidate) => candidate.attemptId === attemptId)
    if (attempt === undefined || attempt.outcome !== "queued") {
      return false
    }

    clock.cancel(attempt.timerHandle!)
    complete(attempt, "cancelled")
    return true
  }

  function send(sender: ProcessorEndpoint, sourceFrameBytes: Uint8Array): VirtualLinkSendReceipt {
    assertEndpoint(sender)
    assertFrameBytes(sourceFrameBytes)

    const submittedAtUs = clock.nowUs()
    const frameBytes = sourceFrameBytes.slice()
    const scriptedFault = faultScript[faultScriptPosition] ?? null
    if (faultScriptPosition < faultScript.length) {
      faultScriptPosition += 1
    }

    if (scriptedFault?.kind === "corruption" && scriptedFault.offset >= frameBytes.length) {
      throw new RangeError("Virtual link corruption offset must be inside the frame")
    }

    const copiesRequested = scriptedFault?.kind === "duplication" ? scriptedFault.copies : 1
    const delayUs = scriptedFault?.kind === "delay" || scriptedFault?.kind === "reordering" ? scriptedFault.delayUs : 0

    if (!connected) {
      const attempt = recordImmediate(sender, frameBytes, scriptedFault, "disconnected")
      return {
        attemptIds: [attempt.attemptId],
        connectionEpoch,
        copiesRequested,
        outcome: "disconnected",
        submittedAtUs
      }
    }

    if (scriptedFault?.kind === "disconnect") {
      disconnect()
      const attempt = recordImmediate(sender, frameBytes, scriptedFault, "disconnected")
      return {
        attemptIds: [attempt.attemptId],
        connectionEpoch,
        copiesRequested,
        outcome: "disconnected",
        submittedAtUs
      }
    }

    if (copiesRequested > queueCapacity - pending.size) {
      const attempt = recordImmediate(sender, frameBytes, scriptedFault, "backpressured")
      return {
        attemptIds: [attempt.attemptId],
        connectionEpoch,
        copiesRequested,
        outcome: "backpressured",
        submittedAtUs
      }
    }

    if (delayUs > Number.MAX_SAFE_INTEGER - submittedAtUs) {
      throw new RangeError("Virtual processor link delay exceeds the safe timestamp range")
    }

    let wireBytes = frameBytes.slice()
    if (scriptedFault?.kind === "corruption") {
      wireBytes[scriptedFault.offset] ^= scriptedFault.xor
    }

    const attempts: MutableAttempt[] = []
    for (let copyIndex = 0; copyIndex < copiesRequested; copyIndex += 1) {
      const attempt = makeAttempt(sender, frameBytes, wireBytes, scriptedFault, copyIndex, copiesRequested, "queued")
      mutableAttempts.push(attempt)
      attempts.push(attempt)
    }

    for (const attempt of attempts) {
      schedule(attempt, delayUs)
    }

    return {
      attemptIds: attempts.map((attempt) => attempt.attemptId),
      connectionEpoch,
      copiesRequested,
      outcome: "queued",
      submittedAtUs
    }
  }

  return {
    get attempts() {
      return mutableAttempts.map(cloneAttempt)
    },
    cancel,
    get clock() {
      return clock
    },
    get connected() {
      return connected
    },
    get connectionEpoch() {
      return connectionEpoch
    },
    disconnect,
    get faultScriptPosition() {
      return faultScriptPosition
    },
    get pendingCount() {
      return pending.size
    },
    reconnect,
    send
  }
}
