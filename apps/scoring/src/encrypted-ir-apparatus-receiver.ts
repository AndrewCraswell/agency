/**
 * RC-13 application-side encrypted-IR receive boundary.
 *
 * AES-GCM is deliberately supplied by the apparatus crypto boundary. This
 * module has no key material, crypto fallback, or authority to reinterpret an
 * unauthenticated frame. It only creates a logical paired-handheld command
 * after authentication, strict payload decoding, and replay commitment.
 */
import {
  admitIrIngress,
  calculateIrReplayTransition,
  createIrIngressThrottleState,
  createIrReplayState,
  deriveIrAeadNonce,
  parseIrSecureFrame,
  releaseIrIngressSlot,
  serializeIrCanonicalAad,
  type IrIngressThrottleState,
  type IrPairingRecord,
  type IrReplayState,
  type IrSecureEnvelope
} from "./encrypted-ir-security.js"
import {
  REMOTE_CONTROL_SCHEMA_VERSION,
  parseRemoteCommand,
  type ControllerPermission,
  type RemoteCommand,
  type RemoteCommandKey
} from "./remote-control.js"
import { isRemoteIdentifier } from "./remote-identifier.js"

export const IR_COMMAND_PAYLOAD_VERSION = 1 as const

const DIRECT_COMMAND_CODES = Object.freeze({
  1: "score.increment.left",
  2: "score.increment.right",
  3: "score.decrement.left",
  4: "score.decrement.right",
  5: "clock.toggle",
  6: "clock.adjust.positive",
  7: "clock.adjust.negative",
  8: "clock.loadConfigured",
  9: "penalty.award.left",
  10: "penalty.award.right",
  11: "break.start.oneMinute",
  12: "workflow.undo",
  13: "weapon.showOrAdvance",
  15: "scoring.rearm",
  16: "cards.reset"
} as const satisfies Readonly<Record<number, RemoteCommandKey>>)

export type IrCompactCommand = (typeof DIRECT_COMMAND_CODES)[keyof typeof DIRECT_COMMAND_CODES]

export type IrLogicalRemoteBinding = Readonly<{
  authorityRevision: number
  controllerId: string
  pairing: IrPairingRecord
  permission: ControllerPermission
  remoteId: string
}>

/** The key-slot owner must return null for authentication failure. */
export type IrAuthenticatedDecryptor = Readonly<{
  decryptAuthenticated: (
    input: Readonly<{
      aad: Uint8Array
      ciphertext: Uint8Array
      envelope: IrSecureEnvelope
      nonce: Uint8Array
      tag: Uint8Array
    }>
  ) => Promise<Uint8Array | null>
}>

export type EncryptedIrApparatusReceiver = Readonly<{
  receive: (frame: unknown, atUs: unknown) => Promise<EncryptedIrReceiveReceipt>
  readonly replayStates: readonly IrReplayState[]
  readonly throttleState: IrIngressThrottleState
}>

export type EncryptedIrApparatusReceiverOptions = Readonly<{
  bindings: readonly IrLogicalRemoteBinding[]
  crypto: IrAuthenticatedDecryptor
  dispatch: (command: RemoteCommand) => Promise<void> | void
  initialReplayStates?: readonly IrReplayState[]
  initialThrottleState?: IrIngressThrottleState
}>

export type EncryptedIrReceiveReceipt =
  | Readonly<{ command: RemoteCommand; disposition: "accepted"; reason: null; replayState: IrReplayState }>
  | Readonly<{ command: null; disposition: "duplicate"; reason: null; replayState: IrReplayState }>
  | Readonly<{
      command: null
      disposition: "rejected"
      reason:
        | "authentication-failed"
        | "dispatch-failed"
        | "invalid-payload"
        | "malformed-frame"
        | "replayed"
        | "revoked-pairing"
        | "throttled"
        | "wrong-key-epoch"
        | "wrong-pairing"
      replayState: IrReplayState | null
    }>

function isStrictPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof key === "string" && descriptor !== undefined && descriptor.enumerable && "value" in descriptor
  })
}

function isDenseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1 || !keys.includes("length")) return false
  const length = Object.getOwnPropertyDescriptor(value, "length")
  if (length === undefined || !("value" in length) || length.value !== value.length || length.enumerable) return false
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, `${index}`)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) return false
  }
  return true
}

function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(value)
  return keys.length === expected.length && keys.every((key) => typeof key === "string" && expected.includes(key))
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function bytesFromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1)
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  return bytes
}

/** Rejects hidden properties, accessors, nonplain containers, aliases, and cycles before any options read. */
function assertIndependentPlainGraph(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return
  if (seen.has(value)) throw new TypeError("Encrypted IR receiver options must not contain aliases or cycles")
  seen.add(value)
  if (typeof value === "function") return
  if (isDenseArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, `${index}`)
      if (descriptor === undefined || !("value" in descriptor))
        throw new TypeError("Encrypted IR receiver has an invalid array")
      assertIndependentPlainGraph(descriptor.value, seen)
    }
    return
  }
  if (!isStrictPlainRecord(value)) throw new TypeError("Encrypted IR receiver options require plain data containers")
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor))
      throw new TypeError("Encrypted IR receiver has an invalid record")
    assertIndependentPlainGraph(descriptor.value, seen)
  }
}

function parseBinding(value: unknown): IrLogicalRemoteBinding {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, ["authorityRevision", "controllerId", "pairing", "permission", "remoteId"]) ||
    !isNonnegativeSafeInteger(value.authorityRevision) ||
    !isRemoteIdentifier(value.controllerId) ||
    !isRemoteIdentifier(value.remoteId) ||
    (value.permission !== "referee" && value.permission !== "supervisor")
  ) {
    throw new TypeError("Encrypted IR logical binding has an invalid shape")
  }
  const pairing = value.pairing
  if (
    !isStrictPlainRecord(pairing) ||
    !hasExactlyKeys(pairing, ["apparatusIdentity", "keyEpoch", "remoteIdentity", "status"]) ||
    typeof pairing.apparatusIdentity !== "string" ||
    typeof pairing.remoteIdentity !== "string" ||
    typeof pairing.keyEpoch !== "number" ||
    (pairing.status !== "active" && pairing.status !== "revoked")
  ) {
    throw new TypeError("Encrypted IR logical binding has an invalid pairing")
  }
  const parsedPairing: IrPairingRecord = {
    apparatusIdentity: pairing.apparatusIdentity,
    keyEpoch: pairing.keyEpoch,
    remoteIdentity: pairing.remoteIdentity,
    status: pairing.status
  }
  // createIrReplayState is the canonical strict pairing parser.
  createIrReplayState(parsedPairing)
  return Object.freeze({
    authorityRevision: value.authorityRevision,
    controllerId: value.controllerId,
    pairing: Object.freeze(parsedPairing),
    permission: value.permission,
    remoteId: value.remoteId
  })
}

/** Encodes the fixed two-byte v1 direct-command payload for controlled fixtures or senders. */
export function encodeIrCompactCommandPayload(command: unknown): Uint8Array {
  const entry = Object.entries(DIRECT_COMMAND_CODES).find(([, value]) => value === command)
  if (entry === undefined) throw new TypeError("Encrypted IR payload command is unsupported")
  return Uint8Array.of(IR_COMMAND_PAYLOAD_VERSION, Number(entry[0]))
}

function isCompactCommandCode(value: number): value is keyof typeof DIRECT_COMMAND_CODES {
  return Object.hasOwn(DIRECT_COMMAND_CODES, value)
}

/** Decodes only v1 direct, empty-payload command codes. Unsupported extensions fail closed. */
export function decodeIrCompactCommandPayload(value: unknown): IrCompactCommand {
  if (!(value instanceof Uint8Array) || Object.getPrototypeOf(value) !== Uint8Array.prototype || value.length !== 2) {
    throw new TypeError("Encrypted IR payload has an invalid length")
  }
  if (value[0] !== IR_COMMAND_PAYLOAD_VERSION) throw new TypeError("Encrypted IR payload has an unsupported version")
  const code = value[1]
  if (code === undefined || !isCompactCommandCode(code)) {
    throw new TypeError("Encrypted IR payload has an unsupported command code")
  }
  const command = DIRECT_COMMAND_CODES[code]
  return command
}

function remoteCommand(
  binding: IrLogicalRemoteBinding,
  envelope: IrSecureEnvelope,
  command: IrCompactCommand
): RemoteCommand {
  if (envelope.pressKind !== "direct") throw new TypeError("Encrypted IR payload requires a direct press")
  const counter = Number.parseInt(envelope.counter, 16)
  if (!Number.isSafeInteger(counter)) throw new TypeError("Encrypted IR counter exceeds logical command precision")
  return parseRemoteCommand({
    apparatusId: envelope.apparatusIdentity,
    authority: {
      authorityRevision: binding.authorityRevision,
      controllerId: binding.controllerId,
      kind: "paired-handheld",
      permission: binding.permission
    },
    command,
    commandId: envelope.commandId,
    counter,
    payload: {},
    pressKind: envelope.pressKind,
    remoteId: binding.remoteId,
    schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
  })
}

function replayCandidate(envelope: IrSecureEnvelope) {
  return {
    apparatusIdentity: envelope.apparatusIdentity,
    commandId: envelope.commandId,
    counter: envelope.counter,
    keyEpoch: envelope.keyEpoch,
    protocolId: envelope.protocolId,
    protocolVersion: envelope.protocolVersion,
    remoteIdentity: envelope.remoteIdentity,
    suite: envelope.suite
  }
}

function freezeThrottleState(value: IrIngressThrottleState): IrIngressThrottleState {
  return Object.freeze({
    globalWindowCount: value.globalWindowCount,
    queuedFrameCount: value.queuedFrameCount,
    remoteWindowCounts: Object.freeze(
      value.remoteWindowCounts.map((entry) =>
        Object.freeze({ count: entry.count, remoteIdentity: entry.remoteIdentity })
      )
    ),
    windowStartedAtUs: value.windowStartedAtUs
  })
}

function canonicalizeInitialThrottleState(value: unknown, remoteIdentity: string): IrIngressThrottleState {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, ["globalWindowCount", "queuedFrameCount", "remoteWindowCounts", "windowStartedAtUs"]) ||
    !isDenseArray(value.remoteWindowCounts) ||
    !isNonnegativeSafeInteger(value.globalWindowCount) ||
    !isNonnegativeSafeInteger(value.windowStartedAtUs) ||
    value.queuedFrameCount !== 0
  ) {
    throw new TypeError("Encrypted IR initial throttle state has an invalid shape")
  }
  const entries = value.remoteWindowCounts.map((entry) => {
    if (
      !isStrictPlainRecord(entry) ||
      !hasExactlyKeys(entry, ["count", "remoteIdentity"]) ||
      !isNonnegativeSafeInteger(entry.count) ||
      typeof entry.remoteIdentity !== "string"
    ) {
      throw new TypeError("Encrypted IR initial throttle state has an invalid remote count")
    }
    return Object.freeze({ count: entry.count, remoteIdentity: entry.remoteIdentity })
  })
  if (new Set(entries.map((entry) => entry.remoteIdentity)).size !== entries.length) {
    throw new TypeError("Encrypted IR initial throttle state has duplicate remote counts")
  }
  const candidate = Object.freeze({
    globalWindowCount: value.globalWindowCount,
    queuedFrameCount: value.queuedFrameCount,
    remoteWindowCounts: Object.freeze(entries),
    windowStartedAtUs: value.windowStartedAtUs
  })
  if (admitIrIngress(candidate, remoteIdentity, candidate.windowStartedAtUs).disposition !== "admitted") {
    throw new TypeError("Encrypted IR initial throttle state is not admissible")
  }
  return freezeThrottleState(candidate)
}

function canonicalizeInitialReplayState(value: unknown, binding: IrLogicalRemoteBinding): IrReplayState {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, [
      "apparatusIdentity",
      "highWatermark",
      "keyEpoch",
      "protocolId",
      "protocolVersion",
      "remembered",
      "remoteIdentity",
      "suite"
    ]) ||
    !isDenseArray(value.remembered) ||
    value.apparatusIdentity !== binding.pairing.apparatusIdentity ||
    value.keyEpoch !== binding.pairing.keyEpoch ||
    value.remoteIdentity !== binding.pairing.remoteIdentity
  ) {
    throw new TypeError("Encrypted IR replay state does not exactly match its logical remote binding")
  }
  if (value.remembered.length === 0) {
    const empty = createIrReplayState(binding.pairing)
    if (
      value.highWatermark !== empty.highWatermark ||
      value.protocolId !== empty.protocolId ||
      value.protocolVersion !== empty.protocolVersion ||
      value.suite !== empty.suite
    ) {
      throw new TypeError("Encrypted IR empty replay state is not canonical")
    }
    return empty
  }
  const last = value.remembered.at(-1)
  if (!isStrictPlainRecord(last) || !hasExactlyKeys(last, ["commandId", "counter"])) {
    throw new TypeError("Encrypted IR replay state has an invalid final entry")
  }
  const validation = calculateIrReplayTransition(binding.pairing, value, {
    apparatusIdentity: value.apparatusIdentity,
    commandId: last.commandId,
    counter: last.counter,
    keyEpoch: value.keyEpoch,
    protocolId: value.protocolId,
    protocolVersion: value.protocolVersion,
    remoteIdentity: value.remoteIdentity,
    suite: value.suite
  })
  if (validation.disposition !== "duplicate" || validation.replayState === null) {
    throw new TypeError("Encrypted IR replay state failed canonical validation")
  }
  return validation.replayState
}

/**
 * Creates a receive service for explicitly reviewed pairing-to-logical-remote
 * bindings. The caller owns durable replay persistence; this apparatus-level
 * service never invents an identity, key, or crypto implementation.
 */
export function createEncryptedIrApparatusReceiver(
  options: EncryptedIrApparatusReceiverOptions
): EncryptedIrApparatusReceiver {
  assertIndependentPlainGraph(options)
  if (
    !isStrictPlainRecord(options) ||
    !hasExactlyKeys(
      options,
      ["bindings", "crypto", "dispatch", "initialReplayStates", "initialThrottleState"].filter((key) =>
        Object.hasOwn(options, key)
      )
    ) ||
    !isDenseArray(options.bindings) ||
    !isStrictPlainRecord(options.crypto) ||
    !hasExactlyKeys(options.crypto, ["decryptAuthenticated"]) ||
    typeof options.crypto.decryptAuthenticated !== "function" ||
    typeof options.dispatch !== "function"
  ) {
    throw new TypeError("Encrypted IR receiver options have an invalid shape")
  }
  if (options.initialReplayStates !== undefined && !isDenseArray(options.initialReplayStates)) {
    throw new TypeError("Encrypted IR receiver replay states must be a dense array")
  }

  const bindings = options.bindings.map(parseBinding)
  if (
    bindings.length === 0 ||
    new Set(bindings.map((binding) => binding.pairing.remoteIdentity)).size !== bindings.length ||
    new Set(bindings.map((binding) => binding.remoteId)).size !== bindings.length ||
    new Set(bindings.map((binding) => binding.controllerId)).size !== bindings.length
  ) {
    throw new TypeError("Encrypted IR receiver requires unique logical remote bindings")
  }
  const bindingsByRemoteIdentity = new Map(bindings.map((binding) => [binding.pairing.remoteIdentity, binding]))
  const replayStates = new Map<string, IrReplayState>()
  for (const binding of bindings) replayStates.set(binding.pairing.remoteIdentity, createIrReplayState(binding.pairing))
  const initialReplayRemoteIdentities = new Set<string>()
  for (const replayState of options.initialReplayStates ?? []) {
    if (
      !isStrictPlainRecord(replayState) ||
      !hasExactlyKeys(replayState, [
        "apparatusIdentity",
        "highWatermark",
        "keyEpoch",
        "protocolId",
        "protocolVersion",
        "remembered",
        "remoteIdentity",
        "suite"
      ]) ||
      typeof replayState.remoteIdentity !== "string"
    ) {
      throw new TypeError("Encrypted IR replay state has an invalid shape")
    }
    const binding = bindingsByRemoteIdentity.get(replayState.remoteIdentity)
    if (binding === undefined) throw new TypeError("Encrypted IR replay state has no logical remote binding")
    if (initialReplayRemoteIdentities.has(replayState.remoteIdentity)) {
      throw new TypeError("Encrypted IR receiver initial replay states must be unique")
    }
    initialReplayRemoteIdentities.add(replayState.remoteIdentity)
    replayStates.set(binding.pairing.remoteIdentity, canonicalizeInitialReplayState(replayState, binding))
  }
  let throttleState =
    options.initialThrottleState === undefined
      ? createIrIngressThrottleState(0)
      : canonicalizeInitialThrottleState(options.initialThrottleState, bindings[0].pairing.remoteIdentity)

  return Object.freeze({
    async receive(frame: unknown, atUs: unknown): Promise<EncryptedIrReceiveReceipt> {
      let envelope: IrSecureEnvelope
      try {
        envelope = parseIrSecureFrame(frame)
      } catch {
        return { command: null, disposition: "rejected", reason: "malformed-frame", replayState: null }
      }
      const admission = admitIrIngress(throttleState, envelope.remoteIdentity, atUs)
      if (admission.disposition !== "admitted") {
        return { command: null, disposition: "rejected", reason: "throttled", replayState: null }
      }
      throttleState = admission.state
      try {
        const binding = bindingsByRemoteIdentity.get(envelope.remoteIdentity)
        if (binding === undefined || binding.pairing.apparatusIdentity !== envelope.apparatusIdentity) {
          return { command: null, disposition: "rejected", reason: "wrong-pairing", replayState: null }
        }
        if (binding.pairing.status === "revoked") {
          return { command: null, disposition: "rejected", reason: "revoked-pairing", replayState: null }
        }
        if (binding.pairing.keyEpoch !== envelope.keyEpoch) {
          return { command: null, disposition: "rejected", reason: "wrong-key-epoch", replayState: null }
        }
        let plaintext: Uint8Array | null
        try {
          plaintext = await options.crypto.decryptAuthenticated({
            aad: serializeIrCanonicalAad(envelope),
            ciphertext: bytesFromHex(envelope.ciphertext),
            envelope,
            nonce: bytesFromHex(deriveIrAeadNonce(envelope.keyEpoch, envelope.counter)),
            tag: bytesFromHex(envelope.tag)
          })
        } catch {
          return { command: null, disposition: "rejected", reason: "authentication-failed", replayState: null }
        }
        if (
          plaintext === null ||
          !(plaintext instanceof Uint8Array) ||
          Object.getPrototypeOf(plaintext) !== Uint8Array.prototype
        ) {
          return { command: null, disposition: "rejected", reason: "authentication-failed", replayState: null }
        }
        let command: RemoteCommand
        try {
          command = remoteCommand(binding, envelope, decodeIrCompactCommandPayload(plaintext))
        } catch {
          return { command: null, disposition: "rejected", reason: "invalid-payload", replayState: null }
        }
        const replayState = replayStates.get(binding.pairing.remoteIdentity)
        const transition = calculateIrReplayTransition(binding.pairing, replayState ?? null, replayCandidate(envelope))
        if (transition.disposition === "duplicate") {
          return { command: null, disposition: "duplicate", reason: null, replayState: transition.replayState }
        }
        if (transition.disposition !== "candidate-fresh") {
          return {
            command: null,
            disposition: "rejected",
            reason: transition.reason === "replayed" ? "replayed" : "wrong-pairing",
            replayState: transition.replayState
          }
        }
        replayStates.set(binding.pairing.remoteIdentity, transition.replayState)
        try {
          await options.dispatch(command)
        } catch {
          return {
            command: null,
            disposition: "rejected",
            reason: "dispatch-failed",
            replayState: transition.replayState
          }
        }
        return { command, disposition: "accepted", reason: null, replayState: transition.replayState }
      } finally {
        const released = releaseIrIngressSlot(throttleState)
        if (released.disposition === "released") throttleState = released.state
      }
    },
    get replayStates(): readonly IrReplayState[] {
      return Object.freeze([...replayStates.values()])
    },
    get throttleState(): IrIngressThrottleState {
      return throttleState
    }
  })
}
