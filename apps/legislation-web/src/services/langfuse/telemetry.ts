import { LangfuseSpanProcessor } from "@langfuse/otel"
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { registerTelemetry } from "ai"

export function startLangfuseTelemetry(options: ConstructorParameters<typeof LangfuseSpanProcessor>[0]) {
  const processor = new LangfuseSpanProcessor(options)
  const sdk = new NodeSDK({ spanProcessors: [processor] })
  sdk.start()
  registerTelemetry(new LangfuseVercelAiSdkIntegration())
  return {
    flush: () => processor.forceFlush(),
    shutdown: () => sdk.shutdown()
  }
}
