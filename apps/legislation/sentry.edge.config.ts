import * as Sentry from "@sentry/nextjs"
import { privateSentryOptions } from "./app/lib/sentryPrivacy"

Sentry.init({
  ...privateSentryOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  skipOpenTelemetrySetup: true
})
