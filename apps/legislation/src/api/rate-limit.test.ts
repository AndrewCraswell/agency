import { describe, expect, it } from "vitest"
import { createFixedWindowRateLimiter } from "./rate-limit.js"

describe("createFixedWindowRateLimiter", () => {
  it.each([
    { limit: 0, maximumKeys: 1, windowMs: 1_000 },
    { limit: 1, maximumKeys: 0, windowMs: 1_000 },
    { limit: 1, maximumKeys: 1, windowMs: 0 },
    { limit: Number.NaN, maximumKeys: 1, windowMs: 1_000 },
    { limit: 1, maximumKeys: Number.POSITIVE_INFINITY, windowMs: 1_000 }
  ])("rejects unsafe configuration %#", (options) => {
    expect(() => createFixedWindowRateLimiter(options)).toThrow(RangeError)
  })

  it("rejects empty keys instead of collapsing callers into one bucket", () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, maximumKeys: 2, windowMs: 1_000 })

    expect(() => limiter.consume("")).toThrow("must not be empty")
  })

  it("keeps distinct long keys independent while retaining only fixed-size fingerprints", () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, maximumKeys: 2, windowMs: 1_000 })

    expect(limiter.consume("a".repeat(10_000)).allowed).toBe(true)
    expect(limiter.consume("b".repeat(10_000)).allowed).toBe(true)
    expect(limiter.consume("c".repeat(10_000)).allowed).toBe(false)
  })

  it("rejects a clock that does not produce finite timestamps", () => {
    const limiter = createFixedWindowRateLimiter({ clock: () => Number.NaN, limit: 1, maximumKeys: 1, windowMs: 1_000 })

    expect(() => limiter.consume("principal")).toThrow("clock must return a finite number")
  })

  it("enforces a deterministic fixed window and resets at its boundary", () => {
    let now = 100
    const limiter = createFixedWindowRateLimiter({ clock: () => now, limit: 2, maximumKeys: 2, windowMs: 1_000 })

    expect(limiter.consume("principal")).toEqual({ allowed: true, limit: 2, remaining: 1, resetAfterSeconds: 1 })
    expect(limiter.consume("principal")).toEqual({ allowed: true, limit: 2, remaining: 0, resetAfterSeconds: 1 })
    expect(limiter.consume("principal")).toEqual({ allowed: false, limit: 2, remaining: 0, resetAfterSeconds: 1 })

    now = 1_000
    expect(limiter.consume("principal")).toEqual({ allowed: true, limit: 2, remaining: 1, resetAfterSeconds: 1 })
  })

  it("bounds tracked identities and admits new identities after expired buckets are evicted", () => {
    let now = 100
    const limiter = createFixedWindowRateLimiter({ clock: () => now, limit: 1, maximumKeys: 1, windowMs: 1_000 })

    expect(limiter.consume("first").allowed).toBe(true)
    expect(limiter.consume("second").allowed).toBe(false)

    now = 1_000
    expect(limiter.consume("second").allowed).toBe(true)
  })
})
