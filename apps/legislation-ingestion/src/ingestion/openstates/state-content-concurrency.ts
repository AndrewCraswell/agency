import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"

/** Drain active siblings before rejecting, so the owner may safely release its lease. */
export async function runStateContentBills<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>
) {
  const errors: unknown[] = []
  await mapConcurrent(values, concurrency, async (value) => {
    if (errors.length > 0) {
      return
    }
    try {
      await operation(value)
    } catch (error) {
      errors.push(error)
    }
  })
  if (errors.length > 0) {
    throw new AggregateError(errors, "State content batch failed; active siblings drained before release")
  }
}
