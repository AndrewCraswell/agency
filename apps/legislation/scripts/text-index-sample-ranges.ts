/** Alphabetic upper bounds avoid locale-dependent punctuation ordering. */
export const textIndexSampleRanges = [
  { jurisdiction: "ak", prefix: "bill:ak:", upperBound: "bill:al:", target: 2000 },
  { jurisdiction: "ca", prefix: "bill:ca:", upperBound: "bill:cb:", target: 2000 },
  { jurisdiction: "ny", prefix: "bill:ny:", upperBound: "bill:nz:", target: 2000 },
  { jurisdiction: "tx", prefix: "bill:tx:", upperBound: "bill:ty:", target: 2000 },
  { jurisdiction: "us", prefix: "bill:us:", upperBound: "bill:ut:", target: 2000 }
] as const

export function validateSampleStratum(jurisdiction: string, count: number, target: number) {
  if (!Number.isSafeInteger(count) || count !== target) {
    throw new Error(`Incomplete benchmark stratum ${jurisdiction}: copied ${count}, expected ${target}`)
  }
}
