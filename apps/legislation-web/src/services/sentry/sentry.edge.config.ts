import * as Sentry from "@sentry/nextjs"
import { sentryOptions } from "./sentryOptions"

Sentry.init({
  ...sentryOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  skipOpenTelemetrySetup: true
})
