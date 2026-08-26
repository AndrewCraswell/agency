import { createHash } from "node:crypto"

export type RateLimitDecision = Readonly<{
  allowed: boolean
  limit: number
  remaining: number
  resetAfterSeconds: number
}>

export type RateLimiter = Readonly<{
  consume: (key: string) => RateLimitDecision
}>

type RateLimitOptions = Readonly<{
  clock?: () => number
  limit: number
  maximumKeys: number
  windowMs: number
}>

type RateLimitBucket = Readonly<{ count: number; windowStart: number }>

/**
 * A bounded, per-process fixed-window limiter. It is deliberately small and
 * dependency-free; configure a shared edge limiter before scaling horizontally.
 */
export function createFixedWindowRateLimiter(options: RateLimitOptions): RateLimiter {
  assertValidOptions(options)
  const clock = options.clock ?? Date.now
  const buckets = new Map<string, RateLimitBucket>()

  return {
    consume(key) {
      if (typeof key !== "string" || key.length === 0) {
        throw new RangeError("Rate limit keys must not be empty")
      }
      const fingerprint = keyFingerprint(key)
      const now = clock()
      if (!Number.isFinite(now)) {
        throw new RangeError("Rate limit clock must return a finite number")
      }
      const windowStart = Math.floor(now / options.windowMs) * options.windowMs
      const resetAfterSeconds = Math.max(1, Math.ceil((windowStart + options.windowMs - now) / 1000))
      const current = buckets.get(fingerprint)

      if (current === undefined) {
        evictExpiredBuckets(buckets, windowStart)
        if (buckets.size >= options.maximumKeys) {
          return { allowed: false, limit: options.limit, remaining: 0, resetAfterSeconds }
        }
        buckets.set(fingerprint, { count: 1, windowStart })
        return { allowed: true, limit: options.limit, remaining: options.limit - 1, resetAfterSeconds }
      }

      if (current.windowStart !== windowStart) {
        buckets.set(fingerprint, { count: 1, windowStart })
        return { allowed: true, limit: options.limit, remaining: options.limit - 1, resetAfterSeconds }
      }

      if (current.count >= options.limit) {
        return { allowed: false, limit: options.limit, remaining: 0, resetAfterSeconds }
      }

      const count = current.count + 1
      buckets.set(fingerprint, { count, windowStart })
      return { allowed: true, limit: options.limit, remaining: options.limit - count, resetAfterSeconds }
    }
  }
}

function assertValidOptions(options: RateLimitOptions): void {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new RangeError("Rate limit must be a positive safe integer")
  }
  if (!Number.isSafeInteger(options.maximumKeys) || options.maximumKeys < 1) {
    throw new RangeError("Maximum rate limit keys must be a positive safe integer")
  }
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs < 1) {
    throw new RangeError("Rate limit window must be a positive safe integer")
  }
}

function keyFingerprint(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("base64url")
}

function evictExpiredBuckets(buckets: Map<string, RateLimitBucket>, windowStart: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.windowStart !== windowStart) {
      buckets.delete(key)
    }
  }
}
