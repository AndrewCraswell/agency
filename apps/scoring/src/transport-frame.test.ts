import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  calculateCrc32c,
  decodeTransportFrame,
  encodeTransportFrame,
  MAX_TRANSPORT_FRAME_BYTES,
  MAX_TRANSPORT_PAYLOAD_BYTES,
  TRANSPORT_FRAME_HEADER_BYTES
} from "./transport-frame.js"

type GoldenFixture = Readonly<{
  encodedHex: string
  messageType: "decision-record" | "request" | "response" | "status"
  name: string
  payloadHex: string
  receiver: "esp32" | "stm32"
  sequence: number
}>

const GOLDEN_FIXTURES = (
  JSON.parse(readFileSync(new URL("../fixtures/transport-frame-golden.json", import.meta.url), "utf8")) as {
    readonly fixtures: readonly GoldenFixture[]
  }
).fixtures

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

describe("M0-06/M2-05 canonical transport frame", () => {
  it("matches every checked-in golden frame byte for byte", () => {
    expect(GOLDEN_FIXTURES.map(({ messageType }) => messageType)).toEqual([
      "decision-record",
      "request",
      "status",
      "response"
    ])

    for (const { encodedHex, messageType, payloadHex, receiver, sequence } of GOLDEN_FIXTURES) {
      const encoded = encodeTransportFrame({
        flags: 0,
        messageType,
        payload: new Uint8Array(Buffer.from(payloadHex, "hex")),
        sequence
      })

      expect(hex(encoded)).toBe(encodedHex)
      expect(decodeTransportFrame(receiver, encoded)).toEqual({
        flags: 0,
        messageType,
        payload: new Uint8Array(Buffer.from(payloadHex, "hex")),
        sequence
      })
    }

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
    const declaredUndersize = valid.slice()
    declaredUndersize.set([0, 0, 0, 0], 10)

    const cases: readonly [string, Uint8Array][] = [
      ["truncated", valid.slice(0, TRANSPORT_FRAME_HEADER_BYTES - 1)],
      ["magic", withByte(0, 0)],
      ["version", withByte(2, 2)],
      ["message-type", withByte(3, 0xff)],
      ["flags", withByte(5, 1)],
      ["payload-length", declaredOversize],
      ["trailing-bytes", declaredUndersize],
      ["truncated", valid.slice(0, -1)],
      ["trailing-bytes", new Uint8Array([...valid, 0])],
      ["frame-length", new Uint8Array(MAX_TRANSPORT_FRAME_BYTES + 1)],
      ["crc", withByte(TRANSPORT_FRAME_HEADER_BYTES, 2)]
    ]

    for (const [code, bytes] of cases) {
      expect(() => decodeTransportFrame("esp32", bytes)).toThrow(expect.objectContaining({ code }))
    }
  })

  it("rejects non-Uint8Array decoder inputs before reading their length", () => {
    const lengthSpoof = Reflect.construct(Object, []) as { readonly length: number }
    Reflect.defineProperty(lengthSpoof, "length", {
      get: () => {
        throw new Error("decoder must not read a non-byte input length")
      }
    })
    const invalidInputs: readonly unknown[] = [null, [0x53, 0x43], lengthSpoof]

    for (const input of invalidInputs) {
      expect(() => decodeTransportFrame("esp32", input as Uint8Array)).toThrow(
        expect.objectContaining({ code: "frame-input" })
      )
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

  it("leaves duplicate and reorder policy to the stateful firmware receivers", () => {
    const first = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([1]),
      sequence: 10
    })
    const second = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: new Uint8Array([2]),
      sequence: 11
    })

    expect(decodeTransportFrame("esp32", first).sequence).toBe(10)
    expect(decodeTransportFrame("esp32", first).sequence).toBe(10)
    expect(decodeTransportFrame("esp32", second).sequence).toBe(11)
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

  it("round-trips the maximum bounded payload and rejects larger decoder input", () => {
    const maximumPayload = new Uint8Array(MAX_TRANSPORT_PAYLOAD_BYTES)
    maximumPayload[0] = 0x00
    maximumPayload[maximumPayload.length - 1] = 0xff
    const maximumFrame = encodeTransportFrame({
      flags: 0,
      messageType: "decision-record",
      payload: maximumPayload,
      sequence: 0
    })

    expect(maximumFrame).toHaveLength(MAX_TRANSPORT_FRAME_BYTES)
    expect(decodeTransportFrame("esp32", maximumFrame).payload).toEqual(maximumPayload)
    expect(() => decodeTransportFrame("esp32", new Uint8Array(MAX_TRANSPORT_FRAME_BYTES + 1))).toThrow(
      expect.objectContaining({ code: "frame-length" })
    )
  })
})
