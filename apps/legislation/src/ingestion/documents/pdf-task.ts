/** Keep the process alive while PDF.js is pending, and dispose before releasing its caller. */
export async function runPdfTask<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  destroy: () => Promise<void>,
  timeoutError: Error,
  timeoutMs = 120_000
): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    // Intentionally referenced: PDF.js can leave an unresolved promise with no active handles.
    timer = setTimeout(() => {
      controller.abort(timeoutError)
      reject(timeoutError)
    }, timeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline])
  } finally {
    controller.abort()
    try {
      await destroy()
    } finally {
      clearTimeout(timer)
    }
  }
}
