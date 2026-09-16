import { ingestionContract, ingestionReadinessSchema } from "@repo/legislation-core/domain/ingestion-contract"

export async function checkApiIngestionContract(baseUrl: string, fetcher: typeof fetch = fetch): Promise<void> {
  const origin = new URL(baseUrl)
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("The ingestion gate requires a credential-free HTTPS API origin")
  }
  const response = await fetcher(new URL("/ready", origin), {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`API ingestion gate failed: readiness HTTP ${response.status}`)
  const parsed = ingestionReadinessSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error("API ingestion gate failed: deploy the API contract before the importer")
  const missing = ingestionContract.membershipEndReasons.filter(
    (reason) => !parsed.data.ingestionContract.membershipEndReasons.includes(reason)
  )
  if (missing.length > 0) {
    throw new Error(`API ingestion gate failed: unsupported membership end reasons: ${missing.join(", ")}`)
  }
}
