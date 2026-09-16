import { z } from "zod"

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
    const url = new URL(
      `/api/public/v2/prompts/${promptName}`,
      environment.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com"
    )
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Invalid Langfuse URL.")
    }
    if (version === undefined) {
      url.searchParams.set("label", promptLabel)
    } else {
      url.searchParams.set("version", String(z.number().int().positive().parse(version)))
    }
    const response = await fetch(url, {
      headers: { authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
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
