import * as Sentry from "@sentry/nextjs"
import { captureRouterTransitionStart } from "@sentry/nextjs"
import { sentryOptions } from "./services/sentry/sentryOptions"

export const onRouterTransitionStart = captureRouterTransitionStart

Sentry.init({
  ...sentryOptions,
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  defaultIntegrations: undefined,
  integrations: (integrations) => [
    ...integrations.filter((integration) => integration.name === "GlobalHandlers"),
    ...sentryOptions.integrations
  ]
})
