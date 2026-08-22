import { describe, expect, it } from "vitest"
import {
  calculateCrc32c,
  decodeTransportFrame,
  encodeTransportFrame,
  MAX_TRANSPORT_FRAME_BYTES,
  MAX_TRANSPORT_PAYLOAD_BYTES,
  TRANSPORT_FRAME_HEADER_BYTES
} from "./transport-frame.js"

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

describe("M0-06 transport frame", () => {
  it("matches the documented golden decision-record frame byte for byte", () => {
    const encoded = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([0x00, 0x7f, 0x80, 0xff]),
      sequence: 0x0102_0304
    })

    expect(hex(encoded)).toBe("5343010100000102030400000004007f80ff01de6abe")
    expect(decodeTransportFrame("esp32", encoded)).toEqual({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([0x00, 0x7f, 0x80, 0xff]),
      sequence: 0x0102_0304
    })
  })

  it("matches golden empty and maximum-sequence frames", () => {
    const emptyRequest = encodeTransportFrame({
      flags: 0,
      messageType: "request",
      payload: new Uint8Array(),
      sequence: 0
    })
    const maximumSequenceStatus = encodeTransportFrame({
      flags: 0,
      messageType: "status",
      payload: new Uint8Array([0xa5]),
      sequence: 0xffff_ffff
    })

    expect(hex(emptyRequest)).toBe("5343010300000000000000000000452025ea")
    expect(hex(maximumSequenceStatus)).toBe("534301020000ffffffff00000001a52b9989f7")
    expect(decodeTransportFrame("stm32", emptyRequest)).toMatchObject({ messageType: "request", sequence: 0 })
    expect(decodeTransportFrame("esp32", maximumSequenceStatus)).toMatchObject({
      messageType: "status",
      sequence: 0xffff_ffff
    })
    expect(
      decodeTransportFrame(
        "esp32",
        encodeTransportFrame({ flags: 0, messageType: "response", payload: new Uint8Array(), sequence: 7 })
      )
    ).toMatchObject({
      messageType: "response",
      sequence: 7
    })
  })

  it("uses the Castagnoli CRC-32C check value", () => {
    expect(calculateCrc32c(new TextEncoder().encode("123456789"))).toBe(0xe306_9283)
  })

  it("rejects every malformed frame outcome without yielding a payload", () => {
    const valid = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([1]),
      sequence: 2
    })
    const withByte = (offset: number, value: number): Uint8Array => {
      const altered = valid.slice()
      altered[offset] = value
      return altered
    }
    const declaredOversize = valid.slice()
    declaredOversize.set([0, 0, 0x10, 1], 10)

    const cases: readonly [string, Uint8Array][] = [
      ["truncated", valid.slice(0, TRANSPORT_FRAME_HEADER_BYTES - 1)],
      ["magic", withByte(0, 0)],
      ["version", withByte(2, 2)],
      ["message-type", withByte(3, 0xff)],
      ["flags", withByte(5, 1)],
      ["payload-length", declaredOversize],
      ["truncated", valid.slice(0, -1)],
      ["trailing-bytes", new Uint8Array([...valid, 0])],
      ["crc", withByte(TRANSPORT_FRAME_HEADER_BYTES, 2)]
    ]

    for (const [code, bytes] of cases) {
      expect(() => decodeTransportFrame("esp32", bytes)).toThrow(expect.objectContaining({ code }))
    }
  })

  it("enforces the receiver direction before returning payload bytes", () => {
    const request = encodeTransportFrame({
      flags: 0,
      messageType: "request",
      payload: new Uint8Array([1]),
      sequence: 3
    })
    const decision = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([2]),
      sequence: 4
    })

    expect(() => decodeTransportFrame("esp32", request)).toThrow(expect.objectContaining({ code: "direction" }))
    expect(() => decodeTransportFrame("stm32", decision)).toThrow(expect.objectContaining({ code: "direction" }))
  })

  it("bounds encoder inputs before allocating a frame", () => {
    const payload = new Uint8Array(MAX_TRANSPORT_PAYLOAD_BYTES + 1)
    const base = { flags: 0, messageType: "request" as const, payload: new Uint8Array(), sequence: 0 }

    expect(() => encodeTransportFrame({ ...base, flags: 0.5 })).toThrow(expect.objectContaining({ code: "flags" }))
    expect(() => encodeTransportFrame({ ...base, flags: -1 })).toThrow(expect.objectContaining({ code: "flags" }))
    expect(() => encodeTransportFrame({ ...base, flags: 0x1_0000 })).toThrow(expect.objectContaining({ code: "flags" }))
    expect(() => encodeTransportFrame({ ...base, flags: 1 })).toThrow(expect.objectContaining({ code: "flags" }))
    expect(() => encodeTransportFrame({ ...base, sequence: 0.5 })).toThrow(
      expect.objectContaining({ code: "sequence" })
    )
    expect(() => encodeTransportFrame({ ...base, sequence: -1 })).toThrow(expect.objectContaining({ code: "sequence" }))
    expect(() => encodeTransportFrame({ ...base, sequence: 0x1_0000_0000 })).toThrow(
      expect.objectContaining({ code: "sequence" })
    )
    expect(() => encodeTransportFrame({ ...base, payload })).toThrow(
      expect.objectContaining({ code: "payload-length" })
    )
    expect(() => encodeTransportFrame({ ...base, messageType: "unknown" as never })).toThrow(
      expect.objectContaining({ code: "message-type" })
    )
    expect(() => encodeTransportFrame({ ...base, payload: "not-bytes" as never })).toThrow(
      expect.objectContaining({ code: "payload" })
    )
    expect(MAX_TRANSPORT_FRAME_BYTES).toBe(4_114)
  })
})
