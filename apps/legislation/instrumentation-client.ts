import * as Sentry from "@sentry/nextjs"
import { replayIntegration } from "@sentry/nextjs"
import { privateSentryOptions } from "./app/lib/sentryPrivacy"

Sentry.init({
  ...privateSentryOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  defaultIntegrations: undefined,
  integrations: (integrations) => [
    ...integrations.filter((integration) => integration.name === "GlobalHandlers"),
    replayIntegration({
      maskAllText: false,
      maskAllInputs: false,
      blockAllMedia: false,
      networkCaptureBodies: false,
      networkDetailAllowUrls: [],
      beforeAddRecordingEvent: () => null
    })
  ],
  replaysSessionSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  replaysOnErrorSampleRate: 1
})
