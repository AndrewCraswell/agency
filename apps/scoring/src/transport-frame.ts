/**
 * M0-06 binary envelope validation and encoding.
 *
 * This module transports opaque, already-authoritative payload bytes. It does
 * not parse decision records, retain frames, or make sequence-acceptance
 * decisions for a receiver.
 */

export const TRANSPORT_FRAME_MAGIC = new Uint8Array([0x53, 0x43])
export const TRANSPORT_FRAME_VERSION = 1
export const TRANSPORT_FRAME_HEADER_BYTES = 14
export const TRANSPORT_FRAME_CRC_BYTES = 4
export const MAX_TRANSPORT_PAYLOAD_BYTES = 4_096
export const MAX_TRANSPORT_FRAME_BYTES =
  TRANSPORT_FRAME_HEADER_BYTES + MAX_TRANSPORT_PAYLOAD_BYTES + TRANSPORT_FRAME_CRC_BYTES

const MAX_UINT16 = 0xffff
const MAX_UINT32 = 0xffff_ffff

export type TransportMessageType = "decision-record" | "request" | "response" | "status"
export type TransportReceiver = "esp32" | "stm32"

export type TransportFrame = Readonly<{
  flags: number
  messageType: TransportMessageType
  payload: Uint8Array
  sequence: number
}>

export type TransportFrameErrorCode =
  | "crc"
  | "direction"
  | "frame-input"
  | "frame-length"
  | "flags"
  | "magic"
  | "message-type"
  | "payload"
  | "payload-length"
  | "sequence"
  | "trailing-bytes"
  | "truncated"
  | "version"

export class TransportFrameError extends Error {
  readonly code: TransportFrameErrorCode

  constructor(code: TransportFrameErrorCode) {
    super(`Invalid transport frame: ${code}`)
    this.code = code
    this.name = "TransportFrameError"
  }
}

function assertUnsignedInteger(value: number, maximum: number, code: TransportFrameErrorCode): void {
  if (!Number.isInteger(value)) {
    throw new TransportFrameError(code)
  }

  if (value < 0) {
    throw new TransportFrameError(code)
  }

  if (value > maximum) {
    throw new TransportFrameError(code)
  }
}

function messageTypeCode(messageType: TransportMessageType): number {
  switch (messageType) {
    case "decision-record":
      return 1
    case "status":
      return 2
    case "request":
      return 3
    case "response":
      return 4
    default:
      throw new TransportFrameError("message-type")
  }
}

function messageTypeFromCode(code: number): TransportMessageType {
  switch (code) {
    case 1:
      return "decision-record"
    case 2:
      return "status"
    case 3:
      return "request"
    case 4:
      return "response"
    default:
      throw new TransportFrameError("message-type")
  }
}

function assertMessageDirection(receiver: TransportReceiver, messageType: TransportMessageType): void {
  if (receiver === "esp32" && messageType !== "request") {
    return
  }

  if (receiver === "stm32" && messageType === "request") {
    return
  }

  throw new TransportFrameError("direction")
}

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 8
  bytes[offset + 1] = value
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value >>> 24
  bytes[offset + 1] = value >>> 16
  bytes[offset + 2] = value >>> 8
  bytes[offset + 3] = value
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! * 0x100 + bytes[offset + 1]!
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! * 0x1_000000 + bytes[offset + 1]! * 0x1_0000 + bytes[offset + 2]! * 0x100 + bytes[offset + 3]!
}

/** Calculates the reflected Castagnoli CRC, without the frame's CRC field. */
export function calculateCrc32c(bytes: Uint8Array): number {
  let crc = 0xffff_ffff

  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0x82f6_3b78 : 0)
    }
  }

  return (crc ^ 0xffff_ffff) >>> 0
}

/** Encodes one complete, unfragmented frame in canonical big-endian byte order. */
export function encodeTransportFrame(frame: TransportFrame): Uint8Array {
  assertUnsignedInteger(frame.flags, MAX_UINT16, "flags")
  assertUnsignedInteger(frame.sequence, MAX_UINT32, "sequence")

  if (frame.flags !== 0) {
    throw new TransportFrameError("flags")
  }

  if (!(frame.payload instanceof Uint8Array)) {
    throw new TransportFrameError("payload")
  }

  if (frame.payload.length > MAX_TRANSPORT_PAYLOAD_BYTES) {
    throw new TransportFrameError("payload-length")
  }

  const type = messageTypeCode(frame.messageType)
  const payloadLength = frame.payload.length
  const encoded = new Uint8Array(TRANSPORT_FRAME_HEADER_BYTES + payloadLength + TRANSPORT_FRAME_CRC_BYTES)
  encoded.set(TRANSPORT_FRAME_MAGIC, 0)
  encoded[2] = TRANSPORT_FRAME_VERSION
  encoded[3] = type
  writeUint16(encoded, 4, frame.flags)
  writeUint32(encoded, 6, frame.sequence)
  writeUint32(encoded, 10, payloadLength)
  encoded.set(frame.payload, TRANSPORT_FRAME_HEADER_BYTES)
  writeUint32(encoded, TRANSPORT_FRAME_HEADER_BYTES + payloadLength, calculateCrc32c(encoded.subarray(0, -4)))

  return encoded
}

/**
 * Decodes a complete frame for one explicit receiver. Sequence acceptance is
 * deliberately receiver state, so this function neither accepts nor discards
 * duplicates or reorders.
 */
export function decodeTransportFrame(receiver: TransportReceiver, bytes: Uint8Array): TransportFrame {
  if (!(bytes instanceof Uint8Array)) {
    throw new TransportFrameError("frame-input")
  }

  if (bytes.length < TRANSPORT_FRAME_HEADER_BYTES) {
    throw new TransportFrameError("truncated")
  }

  if (bytes.length > MAX_TRANSPORT_FRAME_BYTES) {
    throw new TransportFrameError("frame-length")
  }

  if (bytes[0] !== TRANSPORT_FRAME_MAGIC[0] || bytes[1] !== TRANSPORT_FRAME_MAGIC[1]) {
    throw new TransportFrameError("magic")
  }

  if (bytes[2] !== TRANSPORT_FRAME_VERSION) {
    throw new TransportFrameError("version")
  }

  const messageType = messageTypeFromCode(bytes[3]!)
  assertMessageDirection(receiver, messageType)
  const flags = readUint16(bytes, 4)
  if (flags !== 0) {
    throw new TransportFrameError("flags")
  }

  const sequence = readUint32(bytes, 6)
  const payloadLength = readUint32(bytes, 10)
  if (payloadLength > MAX_TRANSPORT_PAYLOAD_BYTES) {
    throw new TransportFrameError("payload-length")
  }

  const payloadEnd = TRANSPORT_FRAME_HEADER_BYTES + payloadLength
  const expectedLength = payloadEnd + TRANSPORT_FRAME_CRC_BYTES
  if (bytes.length < expectedLength) {
    throw new TransportFrameError("truncated")
  }

  if (bytes.length > expectedLength) {
    throw new TransportFrameError("trailing-bytes")
  }

  if (calculateCrc32c(bytes.subarray(0, payloadEnd)) !== readUint32(bytes, payloadEnd)) {
    throw new TransportFrameError("crc")
  }

  return { flags, messageType, payload: bytes.slice(TRANSPORT_FRAME_HEADER_BYTES, payloadEnd), sequence }
}
