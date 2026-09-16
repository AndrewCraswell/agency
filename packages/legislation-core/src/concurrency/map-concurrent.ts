export async function mapConcurrent<Value, Result>(
  values: readonly Value[],
  concurrency: number,
  operation: (value: Value, index: number) => Promise<Result>
): Promise<Result[]> {
  const results: Result[] = []
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++
      const value = values[index]
      if (value !== undefined) {
        results[index] = await operation(value, index)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), values.length) }, worker))
  return results
}
