import type { init } from "@sentry/nextjs"

export const sentryOptions = {
  sendDefaultPii: false,
  defaultIntegrations: [],
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  maxBreadcrumbs: 0
} satisfies Parameters<typeof init>[0]
