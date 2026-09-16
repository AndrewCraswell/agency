import { startLangfuseTelemetry } from "../../services/langfuse/telemetry"
import { redactCredentials } from "./capture"

let telemetry: ReturnType<typeof startLangfuseTelemetry> | undefined

export function registerChatTelemetry(environment: NodeJS.ProcessEnv) {
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  if (telemetry || !publicKey || !secretKey) {
    return
  }
  telemetry = startLangfuseTelemetry({
    publicKey,
    secretKey,
    baseUrl: environment.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com",
    environment: environment.NODE_ENV,
    mediaUploadEnabled: false,
    mask: ({ data }) => redactCredentials(data)
  })
}

export async function flushChatTelemetry() {
  await telemetry?.flush()
}
