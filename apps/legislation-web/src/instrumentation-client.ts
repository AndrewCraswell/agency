import { browserTracingIntegration, captureRouterTransitionStart, init, makeFetchTransport } from "@sentry/nextjs"
import { createBrowserSentryOptions } from "./services/sentry/browserSentryOptions"
import { initializeBrowserWebVitals } from "./services/sentry/browserTelemetry"
import { diagnosticTransport } from "./services/sentry/diagnosticTransport"

export const onRouterTransitionStart = captureRouterTransitionStart

init({
  ...createBrowserSentryOptions(
    {
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      NODE_ENV: process.env.NODE_ENV
    },
    typeof window === "undefined" ? undefined : window.location.origin,
    browserTracingIntegration
  ),
  transport: diagnosticTransport(makeFetchTransport)
})
initializeBrowserWebVitals()
