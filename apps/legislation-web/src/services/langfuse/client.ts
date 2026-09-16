export type LangfuseEnvironment = Readonly<Record<string, string | undefined>>

export function langfuseSettings(environment: LangfuseEnvironment) {
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  const baseUrl = environment.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com"
  const url = new URL(baseUrl)
  if (!publicKey || !secretKey || url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Langfuse HTTPS credentials are required.")
  }
  return { publicKey, secretKey, baseUrl }
}

export function createLangfuseClient(environment: LangfuseEnvironment) {
  const { publicKey, secretKey, baseUrl } = langfuseSettings(environment)
  const authorization = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`
  return {
    request(path: string, options: { body?: unknown; signal?: AbortSignal; timeoutMs: number; cache?: RequestCache }) {
      const url = new URL(`/api/public/${path}`, baseUrl)
      const deadline = AbortSignal.timeout(options.timeoutMs)
      return fetch(url, {
        ...(options.body === undefined ? {} : { method: "POST", body: JSON.stringify(options.body) }),
        headers: {
          authorization,
          ...(options.body === undefined ? {} : { "content-type": "application/json" })
        },
        ...(options.cache === undefined ? {} : { cache: options.cache }),
        redirect: "error",
        signal: options.signal === undefined ? deadline : AbortSignal.any([options.signal, deadline])
      })
    }
  }
}
