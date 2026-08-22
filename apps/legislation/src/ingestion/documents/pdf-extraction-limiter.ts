/**
 * PDF.js expands and indexes a document while extracting its text. Keeping
 * downloads concurrent is useful for publisher latency, but extracting more
 * than one PDF at a time in the same Trigger worker can multiply that peak
 * memory well beyond the compressed response size.
 */
export function createPdfExtractionLimiter(maximumConcurrency = 1): {
  run<T>(contentType: string, operation: () => Promise<T>): Promise<T>
} {
  if (!Number.isSafeInteger(maximumConcurrency) || maximumConcurrency < 1) {
    throw new Error("PDF extraction concurrency must be a positive integer")
  }

  let active = 0
  const waiters: Array<() => void> = []

  async function acquire(): Promise<void> {
    if (active < maximumConcurrency) {
      active += 1
      return
    }
    await new Promise<void>((resolve) => waiters.push(resolve))
    active += 1
  }

  function release(): void {
    active -= 1
    waiters.shift()?.()
  }

  return {
    async run<T>(contentType: string, operation: () => Promise<T>): Promise<T> {
      if (contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/pdf") {
        return await operation()
      }
      await acquire()
      try {
        return await operation()
      } finally {
        release()
      }
    }
  }
}
