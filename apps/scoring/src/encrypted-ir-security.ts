/**
 * RC-03 encrypted-IR transport contract.
 *
 * This module contains envelope, rate, and replay state contracts only. It
 * does not authenticate, decrypt, generate keys, pair devices, dispatch a
 * command, or authorize operational use. A reviewed target crypto adapter is
 * the only future component permitted to invoke the replay transition helper.
 */
import { REMOTE_PRESS_KINDS, type RemotePressKind } from "./remote-control.js"

export const IR_PROTOCOL_ID = "fencing-ir" as const
export const IR_PROTOCOL_VERSION = 1 as const
export const IR_AEAD_SUITE = "AES-256-GCM-96N-128T" as const
export const IR_AEAD_NONCE_BYTES = 12
export const IR_AEAD_TAG_BYTES = 16
export const IR_COMMAND_CIPHERTEXT_MAX_BYTES = 64
/** Aligns command-id replay retention with the workflow reducer's 4,096-ID ledger. */
export const IR_COMMAND_ID_CAPACITY = 4_096
export const IR_INGRESS_QUEUE_CAPACITY = 4
export const IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND = 24
export const IR_GLOBAL_RATE_LIMIT_PER_SECOND = 64
export const IR_SECURITY_REVIEW_STATUS = "DENY-independent-security-review" as const
export const IR_REPLAY_TRANSITION_AUTHORITY = "non-authoritative" as const
/** A replay calculation never establishes AES-GCM authentication. */
export const IR_REPLAY_AUTHENTICATION_STATUS = "not-proved-by-this-contract" as const
export const IR_WIRE_MAGIC_HEX = "4952" as const
export const IR_WIRE_PRODUCT_PROTOCOL_HEX = "46534952" as const
export const IR_WIRE_SUITE_CODE = 1 as const

/**
 * The ordered v1 wire layout is the only source for field widths and offsets.
 * Header fields precede the variable-length ciphertext; the tag follows the
 * maximum ciphertext slot on the fixed upper-bound layout.
 */
const IR_WIRE_LAYOUT = [
  { bytes: 2, header: true, name: "magic" },
  { bytes: 4, header: true, name: "productProtocol" },
  { bytes: 1, header: true, name: "protocolVersion" },
  { bytes: 1, header: true, name: "suite" },
  { bytes: 16, header: true, name: "apparatusIdentity" },
  { bytes: 16, header: true, name: "remoteIdentity" },
  { bytes: 4, header: true, name: "keyEpoch" },
  { bytes: 8, header: true, name: "counter" },
  { bytes: 16, header: true, name: "commandId" },
  { bytes: 1, header: true, name: "pressKind" },
  { bytes: 1, header: true, name: "ciphertextLength" },
  { bytes: IR_COMMAND_CIPHERTEXT_MAX_BYTES, header: false, name: "ciphertext" },
  { bytes: IR_AEAD_TAG_BYTES, header: false, name: "tag" }
] as const

type IrWireFieldName = (typeof IR_WIRE_LAYOUT)[number]["name"]

function wireField(name: IrWireFieldName): (typeof IR_WIRE_LAYOUT)[number] {
  const field = IR_WIRE_LAYOUT.find((candidate) => candidate.name === name)
  if (field === undefined) throw new Error(`Unknown IR wire field: ${name}`)
  return field
}

function wireOffset(name: IrWireFieldName): number {
  let offset = 0
  for (const field of IR_WIRE_LAYOUT) {
    if (field.name === name) return offset
    offset += field.bytes
  }
  throw new Error(`Unknown IR wire field: ${name}`)
}

function wireHeaderBytes(): number {
  let bytes = 0
  for (const field of IR_WIRE_LAYOUT) {
    if (!field.header) break
    bytes += field.bytes
  }
  return bytes
}

function wireFrameBytes(): number {
  return IR_WIRE_LAYOUT.reduce((total, field) => total + field.bytes, 0)
}

const IR_WIRE_OFFSETS = Object.freeze({
  apparatusIdentity: wireOffset("apparatusIdentity"),
  ciphertext: wireOffset("ciphertext"),
  ciphertextLength: wireOffset("ciphertextLength"),
  commandId: wireOffset("commandId"),
  counter: wireOffset("counter"),
  keyEpoch: wireOffset("keyEpoch"),
  magic: wireOffset("magic"),
  productProtocol: wireOffset("productProtocol"),
  protocolVersion: wireOffset("protocolVersion"),
  remoteIdentity: wireOffset("remoteIdentity"),
  suite: wireOffset("suite"),
  tag: wireOffset("tag"),
  pressKind: wireOffset("pressKind")
})

/** Exact v1 wire widths and derived 70-byte header/150-byte maximum. */
export const IR_WIRE_LAYOUT_BYTES = Object.freeze({
  apparatusIdentity: wireField("apparatusIdentity").bytes,
  ciphertext: wireField("ciphertext").bytes,
  ciphertextLength: wireField("ciphertextLength").bytes,
  commandId: wireField("commandId").bytes,
  counter: wireField("counter").bytes,
  keyEpoch: wireField("keyEpoch").bytes,
  magic: wireField("magic").bytes,
  productProtocol: wireField("productProtocol").bytes,
  protocolVersion: wireField("protocolVersion").bytes,
  remoteIdentity: wireField("remoteIdentity").bytes,
  suite: wireField("suite").bytes,
  tag: wireField("tag").bytes,
  pressKind: wireField("pressKind").bytes
})
export const IR_WIRE_HEADER_BYTES = wireHeaderBytes()
export const IR_MAX_WIRE_FRAME_BYTES = wireFrameBytes()

/** Public NIST SP 800-38D AES-256-GCM test inputs; never product credentials. */
export const IR_AES_256_GCM_NIST_KAT = Object.freeze({
  aad: "3ad77bb40d7a3660a89ecaf32466ef97f5d3d58503b9699de785895a96fdbaaf43b1cd7f598ece23881b00e3ed0306887b0c785e27e8ad3f8223207104725dd4",
  ciphertext:
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad",
  key: "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308",
  nonce: "cafebabefacedbaddecaf888",
  plaintext:
    "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255",
  tag: "c06d76f31930fef37acae23ed465ae62"
})

export type IrSecureEnvelope = Readonly<{
  apparatusIdentity: string
  ciphertext: string
  commandId: string
  counter: string
  keyEpoch: number
  pressKind: RemotePressKind
  protocolId: typeof IR_PROTOCOL_ID
  protocolVersion: typeof IR_PROTOCOL_VERSION
  remoteIdentity: string
  suite: typeof IR_AEAD_SUITE
  tag: string
}>

/** Contains no key. A provisioner resolves the identity/epoch to a protected key slot. */
export type IrPairingRecord = Readonly<{
  apparatusIdentity: string
  keyEpoch: number
  remoteIdentity: string
  status: "active" | "revoked"
}>

export type IrReplayEntry = Readonly<{ commandId: string; counter: string }>

/** Metadata output from a future authenticated/decrypted target adapter. */
export type IrReplayCandidate = Readonly<{
  apparatusIdentity: string
  commandId: string
  counter: string
  keyEpoch: number
  protocolId: typeof IR_PROTOCOL_ID
  protocolVersion: typeof IR_PROTOCOL_VERSION
  remoteIdentity: string
  suite: typeof IR_AEAD_SUITE
}>

/** The target adapter must durably commit and confirm this state before dispatch. */
export type IrReplayState = Readonly<{
  apparatusIdentity: string
  highWatermark: string
  keyEpoch: number
  protocolId: typeof IR_PROTOCOL_ID
  protocolVersion: typeof IR_PROTOCOL_VERSION
  remembered: readonly IrReplayEntry[]
  remoteIdentity: string
  suite: typeof IR_AEAD_SUITE
}>

export type IrReplayTransitionReceipt =
  | Readonly<{
      authentication: typeof IR_REPLAY_AUTHENTICATION_STATUS
      authority: typeof IR_REPLAY_TRANSITION_AUTHORITY
      dispatchAuthorized: false
      disposition: "candidate-fresh"
      reason: null
      replayState: IrReplayState
    }>
  | Readonly<{
      authentication: typeof IR_REPLAY_AUTHENTICATION_STATUS
      authority: typeof IR_REPLAY_TRANSITION_AUTHORITY
      dispatchAuthorized: false
      disposition: "duplicate"
      reason: null
      replayState: IrReplayState
    }>
  | Readonly<{
      authentication: typeof IR_REPLAY_AUTHENTICATION_STATUS
      authority: typeof IR_REPLAY_TRANSITION_AUTHORITY
      dispatchAuthorized: false
      disposition: "rejected"
      reason:
        | "command-id-capacity-exhausted"
        | "command-id-reused"
        | "malformed-frame"
        | "replayed"
        | "revoked-pairing"
        | "state-binding-mismatch"
        | "state-unavailable"
        | "wrong-key-epoch"
        | "wrong-pairing"
      replayState: IrReplayState | null
    }>

export type IrIngressThrottleState = Readonly<{
  globalWindowCount: number
  queuedFrameCount: number
  remoteWindowCounts: readonly Readonly<{ count: number; remoteIdentity: string }>[]
  windowStartedAtMilliseconds: number
}>

export type IrIngressAdmission =
  | Readonly<{ disposition: "admitted" | "released"; reason: null; state: IrIngressThrottleState }>
  | Readonly<{
      disposition: "rejected"
      reason: "clock-regression" | "invalid-ingress" | "queue-capacity-exhausted" | "rate-limited"
      state: IrIngressThrottleState | null
    }>

const ID_HEX_LENGTH = 32
const COMMAND_ID_HEX_LENGTH = 32
const COUNTER_HEX_LENGTH = 16
const ZERO_COUNTER = "0000000000000000"
const MAX_COUNTER = "00000000ffffffff"
const RATE_WINDOW_MILLISECONDS = 1_000

function isStrictPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof key === "string" && descriptor !== undefined && descriptor.enumerable && "value" in descriptor
  })
}

function isStrictDenseArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false
  const ownKeys = Reflect.ownKeys(value)
  if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) return false
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, `${index}`)
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) return false
  }
  return true
}

function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value)
  return actual.length === expected.length && actual.every((key) => typeof key === "string" && expected.includes(key))
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === "string" && value.length === length && /^[0-9a-f]+$/u.test(value)
}

function isIdentity(value: unknown): value is string {
  return isHex(value, ID_HEX_LENGTH)
}

function isBoundedCiphertext(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= IR_COMMAND_CIPHERTEXT_MAX_BYTES * 2 &&
    value.length % 2 === 0 &&
    /^[0-9a-f]+$/u.test(value)
  )
}

function isCounter(value: unknown, permitZero: boolean): value is string {
  return (
    isHex(value, COUNTER_HEX_LENGTH) &&
    (permitZero || value !== ZERO_COUNTER) &&
    BigInt(`0x${value}`) <= BigInt(`0x${MAX_COUNTER}`)
  )
}

function isEpoch(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 0xffff_ffff
}

function isPressKind(value: unknown): value is RemotePressKind {
  return REMOTE_PRESS_KINDS.some((pressKind) => pressKind === value)
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function compareCounters(left: string, right: string): number {
  const leftValue = BigInt(`0x${left}`)
  const rightValue = BigInt(`0x${right}`)
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1
}

function freezeReplayState(
  pairing: IrPairingRecord,
  highWatermark: string,
  remembered: readonly IrReplayEntry[]
): IrReplayState {
  return Object.freeze({
    apparatusIdentity: pairing.apparatusIdentity,
    highWatermark,
    keyEpoch: pairing.keyEpoch,
    protocolId: IR_PROTOCOL_ID,
    protocolVersion: IR_PROTOCOL_VERSION,
    remembered: Object.freeze(remembered.map((entry) => Object.freeze({ ...entry }))),
    remoteIdentity: pairing.remoteIdentity,
    suite: IR_AEAD_SUITE
  })
}

function freezeThrottleState(
  globalWindowCount: number,
  queuedFrameCount: number,
  remoteWindowCounts: readonly Readonly<{ count: number; remoteIdentity: string }>[],
  windowStartedAtMilliseconds: number
): IrIngressThrottleState {
  return Object.freeze({
    globalWindowCount,
    queuedFrameCount,
    remoteWindowCounts: Object.freeze(remoteWindowCounts.map((entry) => Object.freeze({ ...entry }))),
    windowStartedAtMilliseconds
  })
}

/** Derives the fixed 96-bit GCM nonce without ever exposing a traffic key. */
export function deriveIrAeadNonce(keyEpoch: unknown, counter: unknown): string {
  if (!isEpoch(keyEpoch) || !isCounter(counter, false)) {
    throw new TypeError("IR nonce requires a nonzero supported epoch and counter")
  }
  return `${keyEpoch.toString(16).padStart(8, "0")}${counter}`
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function pressKindCode(pressKind: RemotePressKind): number {
  switch (pressKind) {
    case "direct":
      return 1
    case "modified":
      return 2
    case "held":
      return 3
    case "double":
      return 4
  }
}

function pressKindFromCode(code: number): RemotePressKind {
  switch (code) {
    case 1:
      return "direct"
    case 2:
      return "modified"
    case 3:
      return "held"
    case 4:
      return "double"
    default:
      throw new TypeError("IR wire frame has an unsupported press-kind code")
  }
}

/** Serializes the exact 70-byte v1 header used as AES-GCM AAD. */
export function serializeIrCanonicalAad(value: unknown): Uint8Array {
  const envelope = parseIrSecureEnvelope(value)
  const header = new Uint8Array(IR_WIRE_HEADER_BYTES)
  header.set(hexToBytes(IR_WIRE_MAGIC_HEX), IR_WIRE_OFFSETS.magic)
  header.set(hexToBytes(IR_WIRE_PRODUCT_PROTOCOL_HEX), IR_WIRE_OFFSETS.productProtocol)
  header[IR_WIRE_OFFSETS.protocolVersion] = IR_PROTOCOL_VERSION
  header[IR_WIRE_OFFSETS.suite] = IR_WIRE_SUITE_CODE
  header.set(hexToBytes(envelope.apparatusIdentity), IR_WIRE_OFFSETS.apparatusIdentity)
  header.set(hexToBytes(envelope.remoteIdentity), IR_WIRE_OFFSETS.remoteIdentity)
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  view.setUint32(IR_WIRE_OFFSETS.keyEpoch, envelope.keyEpoch, false)
  view.setBigUint64(IR_WIRE_OFFSETS.counter, BigInt(`0x${envelope.counter}`), false)
  header.set(hexToBytes(envelope.commandId), IR_WIRE_OFFSETS.commandId)
  header[IR_WIRE_OFFSETS.pressKind] = pressKindCode(envelope.pressKind)
  header[IR_WIRE_OFFSETS.ciphertextLength] = envelope.ciphertext.length / 2
  return header
}

/** Serializes one complete v1 wire frame; it performs no cryptography. */
export function serializeIrSecureFrame(value: unknown): Uint8Array {
  const envelope = parseIrSecureEnvelope(value)
  const header = serializeIrCanonicalAad(envelope)
  const ciphertext = hexToBytes(envelope.ciphertext)
  const tag = hexToBytes(envelope.tag)
  const frame = new Uint8Array(header.length + ciphertext.length + tag.length)
  frame.set(header, IR_WIRE_OFFSETS.magic)
  frame.set(ciphertext, IR_WIRE_OFFSETS.ciphertext)
  frame.set(tag, IR_WIRE_HEADER_BYTES + ciphertext.length)
  return frame
}

/** Strictly parses one canonical v1 wire frame; it does not verify the GCM tag. */
export function parseIrSecureFrame(value: unknown): IrSecureEnvelope {
  if (!(value instanceof Uint8Array) || Object.getPrototypeOf(value) !== Uint8Array.prototype) {
    throw new TypeError("IR wire frame must be a plain Uint8Array")
  }
  if (value.length < IR_WIRE_HEADER_BYTES + 1 + IR_WIRE_LAYOUT_BYTES.tag || value.length > IR_MAX_WIRE_FRAME_BYTES) {
    throw new TypeError("IR wire frame has an invalid length")
  }
  if (
    bytesToHex(value.subarray(IR_WIRE_OFFSETS.magic, IR_WIRE_OFFSETS.productProtocol)) !== IR_WIRE_MAGIC_HEX ||
    bytesToHex(value.subarray(IR_WIRE_OFFSETS.productProtocol, IR_WIRE_OFFSETS.protocolVersion)) !==
      IR_WIRE_PRODUCT_PROTOCOL_HEX ||
    value[IR_WIRE_OFFSETS.protocolVersion] !== IR_PROTOCOL_VERSION ||
    value[IR_WIRE_OFFSETS.suite] !== IR_WIRE_SUITE_CODE
  ) {
    throw new TypeError("IR wire frame has an unsupported marker, protocol, or suite")
  }
  const ciphertextLength = value[IR_WIRE_OFFSETS.ciphertextLength]
  if (
    ciphertextLength === undefined ||
    ciphertextLength < 1 ||
    ciphertextLength > IR_WIRE_LAYOUT_BYTES.ciphertext ||
    value.length !== IR_WIRE_HEADER_BYTES + ciphertextLength + IR_WIRE_LAYOUT_BYTES.tag
  ) {
    throw new TypeError("IR wire frame has an inconsistent ciphertext length")
  }
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength)
  return parseIrSecureEnvelope({
    apparatusIdentity: bytesToHex(value.subarray(IR_WIRE_OFFSETS.apparatusIdentity, IR_WIRE_OFFSETS.remoteIdentity)),
    ciphertext: bytesToHex(value.subarray(IR_WIRE_OFFSETS.ciphertext, IR_WIRE_OFFSETS.ciphertext + ciphertextLength)),
    commandId: bytesToHex(value.subarray(IR_WIRE_OFFSETS.commandId, IR_WIRE_OFFSETS.pressKind)),
    counter: view.getBigUint64(IR_WIRE_OFFSETS.counter, false).toString(16).padStart(16, "0"),
    keyEpoch: view.getUint32(IR_WIRE_OFFSETS.keyEpoch, false),
    pressKind: pressKindFromCode(value[IR_WIRE_OFFSETS.pressKind] ?? 0),
    protocolId: IR_PROTOCOL_ID,
    protocolVersion: IR_PROTOCOL_VERSION,
    remoteIdentity: bytesToHex(value.subarray(IR_WIRE_OFFSETS.remoteIdentity, IR_WIRE_OFFSETS.keyEpoch)),
    suite: IR_AEAD_SUITE,
    tag: bytesToHex(value.subarray(IR_WIRE_HEADER_BYTES + ciphertextLength))
  })
}

/** Strictly parses a fixed-suite envelope before the selected AES-GCM adapter receives it. */
export function parseIrSecureEnvelope(value: unknown): IrSecureEnvelope {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, [
      "apparatusIdentity",
      "ciphertext",
      "commandId",
      "counter",
      "keyEpoch",
      "pressKind",
      "protocolId",
      "protocolVersion",
      "remoteIdentity",
      "suite",
      "tag"
    ]) ||
    !isIdentity(value.apparatusIdentity) ||
    !isBoundedCiphertext(value.ciphertext) ||
    !isHex(value.commandId, COMMAND_ID_HEX_LENGTH) ||
    !isCounter(value.counter, false) ||
    !isEpoch(value.keyEpoch) ||
    !isPressKind(value.pressKind) ||
    value.protocolId !== IR_PROTOCOL_ID ||
    value.protocolVersion !== IR_PROTOCOL_VERSION ||
    !isIdentity(value.remoteIdentity) ||
    value.suite !== IR_AEAD_SUITE ||
    !isHex(value.tag, IR_AEAD_TAG_BYTES * 2)
  ) {
    throw new TypeError("IR secure envelope has an invalid or unsupported shape")
  }
  return Object.freeze({
    apparatusIdentity: value.apparatusIdentity,
    ciphertext: value.ciphertext,
    commandId: value.commandId,
    counter: value.counter,
    keyEpoch: value.keyEpoch,
    pressKind: value.pressKind,
    protocolId: value.protocolId,
    protocolVersion: value.protocolVersion,
    remoteIdentity: value.remoteIdentity,
    suite: value.suite,
    tag: value.tag
  })
}

function parseIrReplayCandidate(value: unknown): IrReplayCandidate {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, [
      "apparatusIdentity",
      "commandId",
      "counter",
      "keyEpoch",
      "protocolId",
      "protocolVersion",
      "remoteIdentity",
      "suite"
    ]) ||
    !isIdentity(value.apparatusIdentity) ||
    !isHex(value.commandId, COMMAND_ID_HEX_LENGTH) ||
    !isCounter(value.counter, false) ||
    !isEpoch(value.keyEpoch) ||
    value.protocolId !== IR_PROTOCOL_ID ||
    value.protocolVersion !== IR_PROTOCOL_VERSION ||
    !isIdentity(value.remoteIdentity) ||
    value.suite !== IR_AEAD_SUITE
  ) {
    throw new TypeError("IR replay candidate has an invalid or unsupported shape")
  }
  return Object.freeze({
    apparatusIdentity: value.apparatusIdentity,
    commandId: value.commandId,
    counter: value.counter,
    keyEpoch: value.keyEpoch,
    protocolId: value.protocolId,
    protocolVersion: value.protocolVersion,
    remoteIdentity: value.remoteIdentity,
    suite: value.suite
  })
}

function isIrPairingRecord(value: unknown): value is IrPairingRecord {
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, ["apparatusIdentity", "keyEpoch", "remoteIdentity", "status"]) &&
    isIdentity(value.apparatusIdentity) &&
    isEpoch(value.keyEpoch) &&
    isIdentity(value.remoteIdentity) &&
    (value.status === "active" || value.status === "revoked")
  )
}

function isIrReplayEntry(value: unknown, priorCounter: string, highWatermark: string): value is IrReplayEntry {
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, ["commandId", "counter"]) &&
    isHex(value.commandId, COMMAND_ID_HEX_LENGTH) &&
    isCounter(value.counter, false) &&
    compareCounters(value.counter, priorCounter) > 0 &&
    compareCounters(value.counter, highWatermark) <= 0
  )
}

function replayStateMatchesPairing(state: IrReplayState, pairing: IrPairingRecord): boolean {
  return (
    state.apparatusIdentity === pairing.apparatusIdentity &&
    state.keyEpoch === pairing.keyEpoch &&
    state.protocolId === IR_PROTOCOL_ID &&
    state.protocolVersion === IR_PROTOCOL_VERSION &&
    state.remoteIdentity === pairing.remoteIdentity &&
    state.suite === IR_AEAD_SUITE
  )
}

function isIrReplayState(value: unknown): value is IrReplayState {
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
    !isIdentity(value.apparatusIdentity) ||
    !isCounter(value.highWatermark, true) ||
    !isEpoch(value.keyEpoch) ||
    value.protocolId !== IR_PROTOCOL_ID ||
    value.protocolVersion !== IR_PROTOCOL_VERSION ||
    !isStrictDenseArray(value.remembered) ||
    value.remembered.length > IR_COMMAND_ID_CAPACITY ||
    !isIdentity(value.remoteIdentity) ||
    value.suite !== IR_AEAD_SUITE
  ) {
    return false
  }
  if (value.remembered.length === 0) return value.highWatermark === ZERO_COUNTER

  const commandIds = new Set<string>()
  let previousCounter = ZERO_COUNTER
  for (const entry of value.remembered) {
    if (!isIrReplayEntry(entry, previousCounter, value.highWatermark) || commandIds.has(entry.commandId)) return false
    commandIds.add(entry.commandId)
    previousCounter = entry.counter
  }
  return previousCounter === value.highWatermark
}

function rejected(
  reason: Extract<IrReplayTransitionReceipt, Readonly<{ disposition: "rejected" }>>["reason"],
  replayState: IrReplayState | null
): IrReplayTransitionReceipt {
  return {
    authentication: IR_REPLAY_AUTHENTICATION_STATUS,
    authority: IR_REPLAY_TRANSITION_AUTHORITY,
    dispatchAuthorized: false,
    disposition: "rejected",
    reason,
    replayState
  }
}

/** Creates an empty, pair-bound durable replay baseline; counter zero is never transmitted. */
export function createIrReplayState(pairing: unknown): IrReplayState {
  if (!isIrPairingRecord(pairing)) throw new TypeError("IR replay state requires a valid pairing identity")
  return freezeReplayState(pairing, ZERO_COUNTER, [])
}

/**
 * Calculates a non-authoritative replay transition from candidate metadata.
 * It cannot prove authentication or authorize/dispatch a command.
 */
export function calculateIrReplayTransition(
  pairing: unknown,
  replayState: unknown,
  candidateMetadata: unknown
): IrReplayTransitionReceipt {
  if (!isIrReplayState(replayState)) return rejected("state-unavailable", null)
  const currentState = freezeReplayState(
    {
      apparatusIdentity: replayState.apparatusIdentity,
      keyEpoch: replayState.keyEpoch,
      remoteIdentity: replayState.remoteIdentity,
      status: "active"
    },
    replayState.highWatermark,
    replayState.remembered
  )
  if (!isIrPairingRecord(pairing)) return rejected("malformed-frame", currentState)
  if (!replayStateMatchesPairing(currentState, pairing)) return rejected("state-binding-mismatch", currentState)
  let candidate: IrReplayCandidate
  try {
    candidate = parseIrReplayCandidate(candidateMetadata)
  } catch {
    return rejected("malformed-frame", currentState)
  }
  if (pairing.status === "revoked") return rejected("revoked-pairing", currentState)
  if (
    candidate.apparatusIdentity !== pairing.apparatusIdentity ||
    candidate.remoteIdentity !== pairing.remoteIdentity
  ) {
    return rejected("wrong-pairing", currentState)
  }
  if (candidate.keyEpoch !== pairing.keyEpoch) return rejected("wrong-key-epoch", currentState)

  const previousCommand = currentState.remembered.find((entry) => entry.commandId === candidate.commandId)
  if (previousCommand !== undefined && previousCommand.counter !== candidate.counter) {
    return rejected("command-id-reused", currentState)
  }
  if (compareCounters(candidate.counter, currentState.highWatermark) <= 0) {
    if (previousCommand?.counter === candidate.counter) {
      return {
        authentication: IR_REPLAY_AUTHENTICATION_STATUS,
        authority: IR_REPLAY_TRANSITION_AUTHORITY,
        dispatchAuthorized: false,
        disposition: "duplicate",
        reason: null,
        replayState: currentState
      }
    }
    return rejected("replayed", currentState)
  }
  if (currentState.remembered.length === IR_COMMAND_ID_CAPACITY) {
    return rejected("command-id-capacity-exhausted", currentState)
  }
  return {
    authentication: IR_REPLAY_AUTHENTICATION_STATUS,
    authority: IR_REPLAY_TRANSITION_AUTHORITY,
    dispatchAuthorized: false,
    disposition: "candidate-fresh",
    reason: null,
    replayState: freezeReplayState(pairing, candidate.counter, [
      ...currentState.remembered,
      { commandId: candidate.commandId, counter: candidate.counter }
    ])
  }
}

function isRemoteWindowCount(value: unknown): value is Readonly<{ count: number; remoteIdentity: string }> {
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, ["count", "remoteIdentity"]) &&
    isNonnegativeSafeInteger(value.count) &&
    value.count <= IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND &&
    isIdentity(value.remoteIdentity)
  )
}

function isIrIngressThrottleState(value: unknown): value is IrIngressThrottleState {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, [
      "globalWindowCount",
      "queuedFrameCount",
      "remoteWindowCounts",
      "windowStartedAtMilliseconds"
    ]) ||
    !isNonnegativeSafeInteger(value.globalWindowCount) ||
    value.globalWindowCount > IR_GLOBAL_RATE_LIMIT_PER_SECOND ||
    !isNonnegativeSafeInteger(value.queuedFrameCount) ||
    value.queuedFrameCount > IR_INGRESS_QUEUE_CAPACITY ||
    !isStrictDenseArray(value.remoteWindowCounts) ||
    !isNonnegativeSafeInteger(value.windowStartedAtMilliseconds)
  ) {
    return false
  }
  const identities = new Set<string>()
  let counted = 0
  for (const entry of value.remoteWindowCounts) {
    if (!isRemoteWindowCount(entry) || entry.count === 0 || identities.has(entry.remoteIdentity)) return false
    identities.add(entry.remoteIdentity)
    counted += entry.count
  }
  return counted === value.globalWindowCount
}

/** Creates an empty in-memory ingress queue/rate state for a monotonic millisecond clock. */
export function createIrIngressThrottleState(windowStartedAtMilliseconds: unknown): IrIngressThrottleState {
  if (!isNonnegativeSafeInteger(windowStartedAtMilliseconds)) {
    throw new TypeError("IR ingress state requires a nonnegative monotonic millisecond clock")
  }
  return freezeThrottleState(0, 0, [], windowStartedAtMilliseconds)
}

function rejectIngress(
  reason: Extract<IrIngressAdmission, Readonly<{ disposition: "rejected" }>>["reason"],
  state: IrIngressThrottleState | null
): IrIngressAdmission {
  return { disposition: "rejected", reason, state }
}

/** Applies the bounded queue and fixed one-second ingress rate before crypto work starts. */
export function admitIrIngress(
  throttleState: unknown,
  remoteIdentity: unknown,
  observedAtMilliseconds: unknown
): IrIngressAdmission {
  if (!isIrIngressThrottleState(throttleState)) return rejectIngress("invalid-ingress", null)
  const currentThrottleState = freezeThrottleState(
    throttleState.globalWindowCount,
    throttleState.queuedFrameCount,
    throttleState.remoteWindowCounts,
    throttleState.windowStartedAtMilliseconds
  )
  if (!isIdentity(remoteIdentity) || !isNonnegativeSafeInteger(observedAtMilliseconds)) {
    return rejectIngress("invalid-ingress", currentThrottleState)
  }
  if (observedAtMilliseconds < currentThrottleState.windowStartedAtMilliseconds) {
    return rejectIngress("clock-regression", currentThrottleState)
  }
  const withinWindow =
    observedAtMilliseconds - currentThrottleState.windowStartedAtMilliseconds < RATE_WINDOW_MILLISECONDS
  const base = withinWindow
    ? currentThrottleState
    : freezeThrottleState(0, currentThrottleState.queuedFrameCount, [], observedAtMilliseconds)
  if (base.queuedFrameCount === IR_INGRESS_QUEUE_CAPACITY) return rejectIngress("queue-capacity-exhausted", base)
  if (base.globalWindowCount === IR_GLOBAL_RATE_LIMIT_PER_SECOND) return rejectIngress("rate-limited", base)

  const current = base.remoteWindowCounts.find((entry) => entry.remoteIdentity === remoteIdentity)
  if (current?.count === IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND) return rejectIngress("rate-limited", base)
  const remoteWindowCounts =
    current === undefined
      ? [...base.remoteWindowCounts, { count: 1, remoteIdentity }]
      : base.remoteWindowCounts.map((entry) =>
          entry.remoteIdentity === remoteIdentity ? { ...entry, count: entry.count + 1 } : entry
        )
  return {
    disposition: "admitted",
    reason: null,
    state: freezeThrottleState(
      base.globalWindowCount + 1,
      base.queuedFrameCount + 1,
      remoteWindowCounts,
      base.windowStartedAtMilliseconds
    )
  }
}

/** Releases one queue slot after every decode attempt; rate counts remain immutable for their window. */
export function releaseIrIngressSlot(throttleState: unknown): IrIngressAdmission {
  if (!isIrIngressThrottleState(throttleState) || throttleState.queuedFrameCount === 0) {
    return rejectIngress("invalid-ingress", null)
  }
  const currentThrottleState = freezeThrottleState(
    throttleState.globalWindowCount,
    throttleState.queuedFrameCount,
    throttleState.remoteWindowCounts,
    throttleState.windowStartedAtMilliseconds
  )
  return {
    disposition: "released",
    reason: null,
    state: freezeThrottleState(
      currentThrottleState.globalWindowCount,
      currentThrottleState.queuedFrameCount - 1,
      currentThrottleState.remoteWindowCounts,
      currentThrottleState.windowStartedAtMilliseconds
    )
  }
}
