import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerChatTelemetry } = await import("../../app/chat/telemetry")
    registerChatTelemetry(process.env)
    await import("./sentry.server.config")
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
