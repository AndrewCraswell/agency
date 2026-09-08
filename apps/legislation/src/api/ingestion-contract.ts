import { z } from "zod"
import { organizationMembershipEndReasons } from "../legislation/membership.js"

/** Values the serving API can project from importer-owned records. */
export const ingestionContract = {
  membershipEndReasons: organizationMembershipEndReasons
}

const readinessSchema = z.object({
  status: z.literal("ready"),
  ingestionContract: z.object({ membershipEndReasons: z.array(z.string()) })
})

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
  if (!response.ok) {
    throw new Error(`API ingestion gate failed: readiness HTTP ${response.status}`)
  }
  const parsed = readinessSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error("API ingestion gate failed: deploy the API contract before the importer")
  }
  const missing = organizationMembershipEndReasons.filter(
    (reason) => !parsed.data.ingestionContract.membershipEndReasons.includes(reason)
  )
  if (missing.length > 0) {
    throw new Error(`API ingestion gate failed: unsupported membership end reasons: ${missing.join(", ")}`)
  }
}
