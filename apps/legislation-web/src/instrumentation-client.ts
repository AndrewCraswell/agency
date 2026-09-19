import { browserTracingIntegration, captureRouterTransitionStart, init } from "@sentry/nextjs"
import { createBrowserSentryOptions } from "./services/sentry/browserSentryOptions"
import { initializeBrowserWebVitals } from "./services/sentry/browserTelemetry"

export const onRouterTransitionStart = captureRouterTransitionStart

init(
  createBrowserSentryOptions(
    {
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NODE_ENV: process.env.NODE_ENV
    },
    typeof window === "undefined" ? undefined : window.location.origin,
    browserTracingIntegration
  )
)
initializeBrowserWebVitals()
