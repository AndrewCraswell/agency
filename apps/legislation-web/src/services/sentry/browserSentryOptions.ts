import type { BrowserOptions, browserTracingIntegration } from "@sentry/nextjs"
import { sentryOptions } from "./sentryOptions"
import { telemetryPropagationTarget } from "./telemetryPropagation"
import { resolveTelemetryRoute } from "./telemetryRoutes"

export function createBrowserSentryOptions(
  environment: Readonly<{ NODE_ENV?: string; NEXT_PUBLIC_SENTRY_DSN?: string }>,
  origin: string | undefined,
  createTracingIntegration: typeof browserTracingIntegration
): BrowserOptions {
  const dsn = environment.NEXT_PUBLIC_SENTRY_DSN?.trim()
  const target = dsn
    ? telemetryPropagationTarget(origin, environment.NODE_ENV, { allowLocalHttpInProduction: true })
    : undefined
  const permittedErrors = new Set(["GlobalHandlers", "BrowserApiErrors", "Dedupe", "LinkedErrors"])
  return {
    ...sentryOptions,
    dsn,
    enabled: Boolean(dsn),
    environment: environment.NODE_ENV,
    defaultIntegrations: undefined,
    tracesSampler: () => 0,
    tracePropagationTargets: target ? [target, /^\/(?![\\/])/u] : [],
    integrations: (integrations) => [
      ...integrations.filter((integration) => permittedErrors.has(integration.name)),
      createTracingIntegration({
        instrumentPageLoad: true,
        instrumentNavigation: true,
        markBackgroundSpan: true,
        enableInp: false,
        enableLongTask: false,
        enableLongAnimationFrame: false,
        enableHTTPTimings: false,
        traceFetch: true,
        traceXHR: false,
        linkPreviousTrace: "off",
        ignoreResourceSpans: ["resource.script", "resource.css", "resource.img", "resource.other"],
        ignorePerformanceApiSpans: [/.*/u],
        shouldCreateSpanForRequest: (url) => Boolean(target && (target.test(url) || /^\/(?![\\/])/u.test(url))),
        beforeStartSpan: (span) => {
          const navigation = span.attributes?.["navigation.type"]
          let kind = span.op === "pageload" ? "hard" : "soft"
          if (
            typeof navigation === "string" &&
            ["router.traverse", "router.back", "router.forward", "browser.popstate"].includes(navigation)
          ) {
            kind = "back_forward"
          }
          return {
            ...span,
            name: resolveTelemetryRoute(span.name ?? "").route_template,
            attributes: { "sentry.source": "route", "rostra.navigation.kind": kind }
          }
        }
      }),
      ...sentryOptions.integrations
    ]
  }
}
