export type SmokeFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export async function fetchWithTimeout(
  fetchImpl: SmokeFetch,
  input: string | URL,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(input, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
