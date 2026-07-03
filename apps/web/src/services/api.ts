import { z } from "zod"
import { env } from "./env"

const welcomeSchema = z.object({
  message: z.string()
})

/** Fetches the welcome message from the API, validated with zod. */
export async function getWelcomeMessage(): Promise<string> {
  const response = await fetch(`${env.VITE_API_BASE_URL}/api/welcome`)
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }
  const data = welcomeSchema.parse(await response.json())
  return data.message
}
