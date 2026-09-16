import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerChatTelemetry } = await import("./modules/conversations/telemetry")
    registerChatTelemetry(process.env)
    await import("./services/sentry/sentry.server.config")
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./services/sentry/sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
