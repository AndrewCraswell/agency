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
