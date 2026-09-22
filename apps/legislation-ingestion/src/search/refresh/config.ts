import { z } from "zod"

const sourceEnvironment = z.object({
  LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL: z.url({ protocol: /^postgres(?:ql)?$/ })
})

export function nodePostgresEndpoint(endpoint: string): string {
  const url = new URL(endpoint)
  if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true")
  }
  return url.href
}

export function productionRefreshEndpoint(environment: NodeJS.ProcessEnv): string {
  const endpoint = sourceEnvironment.parse(environment).LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL
  const url = new URL(endpoint)
  const sslMode = url.searchParams.get("sslmode")
  if (!["require", "verify-ca", "verify-full"].includes(sslMode ?? "")) {
    throw new Error("LEGISLATION_PRODUCTION_REFRESH_DATABASE_URL must require TLS")
  }
  return endpoint
}
