import type { init } from "@sentry/nextjs"
import { createSentryPrivacy } from "./sentryPrivacy"

const { integration, ...privacy } = createSentryPrivacy()

export const sentryOptions = {
  ...privacy,
  sendDefaultPii: false,
  defaultIntegrations: [],
  integrations: [integration],
  tracesSampler: () => 1,
  traceLifecycle: "static",
  streamGenAiSpans: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  enableLogs: false,
  enableMetrics: false,
  maxBreadcrumbs: 20,
  transportOptions: { bufferSize: 32 }
} satisfies Parameters<typeof init>[0]
