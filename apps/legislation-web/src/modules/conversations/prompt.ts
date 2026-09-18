import { z } from "zod"
import { createLangfuseClient } from "../../services/langfuse/client"

const promptName = "legislative-research"
const promptLabel = "production"
const promptSchema = z.object({
  name: z.literal(promptName),
  type: z.literal("text"),
  version: z.number().int().positive(),
  labels: z.array(z.string()),
  prompt: z.string().trim().min(1)
})

export function researchDateContext(acceptedAt: Date) {
  const timestamp = acceptedAt.toISOString()
  return [
    "TRUSTED REQUEST DATE CONTEXT",
    JSON.stringify({ timestamp, currentDate: timestamp.slice(0, 10), timeZone: "UTC" }),
    "Use this server date as today, not a date inferred from model knowledge, earlier messages, source text or static prompt examples. It takes precedence over conflicting current-date assumptions. For date-only cutoffs without an explicit timezone, compare calendar dates in UTC: dates before currentDate are past, equal dates are today, and only later dates are future. Respect an explicitly requested timezone using the timestamp; if timezone ambiguity materially affects the answer, clarify that ambiguity without assuming the cutoff is future.",
    "Apply this distinction to answer prose and every ask_clarification field, including question, description and option labels/descriptions. Do not describe a same-day cutoff as future or require the user to replace it. Preserve the user's requested as-of date, including historical dates; do not silently replace it with today or latest available. Independent jurisdiction or scope clarification may still be needed.",
    "Today's date does not establish complete source coverage, ingestion freshness, legal effective dates or events later in the day. Qualify those limits independently using retrieved evidence. For a genuinely future cutoff, distinguish records available now from prospective or unknown events; do not invent future evidence."
  ].join("\n")
}

export async function getResearchPrompt(
  environment: Readonly<Record<string, string | undefined>>,
  signal: AbortSignal,
  version?: number
) {
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  if (!publicKey || !secretKey) {
    throw new Error("Langfuse prompt credentials are not configured.")
  }
  try {
    const client = createLangfuseClient(environment)
    const query = new URLSearchParams()
    if (version === undefined) {
      query.set("label", promptLabel)
    } else {
      query.set("version", String(z.number().int().positive().parse(version)))
    }
    const response = await client.request(`v2/prompts/${promptName}?${query}`, {
      cache: "no-store",
      signal,
      timeoutMs: 10000
    })
    if (!response.ok) {
      throw new Error("Langfuse prompt request failed.")
    }
    const prompt = promptSchema.parse(await response.json())
    if (version === undefined ? !prompt.labels.includes(promptLabel) : prompt.version !== version) {
      throw new Error("Langfuse prompt selection mismatch.")
    }
    return prompt
  } catch {
    throw new Error("Langfuse research prompt is unavailable.")
  }
}
