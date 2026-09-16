import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { registerTelemetry } from "ai"
import { redactCredentials } from "./capture"

let processor: LangfuseSpanProcessor | undefined

export function registerChatTelemetry(environment: NodeJS.ProcessEnv) {
  const publicKey = environment.LANGFUSE_PUBLIC_KEY?.trim()
  const secretKey = environment.LANGFUSE_SECRET_KEY?.trim()
  if (processor || !publicKey || !secretKey) {
    return
  }
  processor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl: environment.LANGFUSE_BASE_URL ?? "https://us.cloud.langfuse.com",
    environment: environment.NODE_ENV,
    mediaUploadEnabled: false,
    mask: ({ data }) => redactCredentials(data)
  })
  const sdk = new NodeSDK({ spanProcessors: [processor] })
  sdk.start()
  registerTelemetry(new LangfuseVercelAiSdkIntegration())
}

export async function flushChatTelemetry() {
  await processor?.forceFlush()
}
