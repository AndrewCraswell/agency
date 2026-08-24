import { describe, expect, it } from "vitest"
import { calculateCrc32c } from "./crc32c.js"

describe("app-internal CRC-32C primitive", () => {
  it("calculates the reflected Castagnoli check value", () => {
    expect(calculateCrc32c(new TextEncoder().encode("123456789"))).toBe(0xe306_9283)
  })

  it("accepts empty and binary input without changing the unsigned result", () => {
    expect(calculateCrc32c(new Uint8Array())).toBe(0)
    expect(calculateCrc32c(new Uint8Array([0, 0xff, 0x80, 1]))).toBe(0xd0ca_1995)
  })
})
