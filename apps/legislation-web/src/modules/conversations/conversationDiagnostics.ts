import { startInactiveSpan, type Span } from "@sentry/core"
import { z } from "zod"
import { diagnosticBreadcrumb } from "../../services/sentry/diagnosticBreadcrumb"
import { telemetryCorrelationSchema, type TelemetryCorrelation } from "../../services/sentry/telemetryCorrelation"
import type { TelemetryEventName } from "../../services/sentry/telemetryEvents"
import type { ResponseOutcome } from "./responseOutcome"

type Attempt = {
  id: string
  span: Span
  started: number
  correlation: TelemetryCorrelation
  finished: boolean
  hasContent: boolean
}

export function createConversationDiagnostics(now = () => performance.now()) {
  let current: Attempt | undefined
  function record(message: TelemetryEventName, data: Readonly<Record<string, unknown>> = {}) {
    if (current) {
      diagnosticBreadcrumb(message, {
        ...current.correlation,
        operation_id: current.id,
        origin: "browser",
        route_template: "/chat",
        ...data
      })
    }
  }
  function finish(outcome: ResponseOutcome["status"], operationId = current?.id) {
    if (!current || current.finished || current.id !== operationId) {
      return
    }
    current.finished = true
    const data = { outcome, durationMs: Math.max(0, now() - current.started) }
    current.span.setAttributes({ ...current.correlation, ...data })
    if (outcome === "completed" || outcome === "clarification") {
      current.span.setStatus({ code: 1 })
    } else if (outcome === "failed") {
      current.span.setStatus({ code: 2 })
    }
    record("conversation.milestone", { milestone: "terminal_received", ...data })
    current.span.end()
  }
  return {
    begin(isRetry: boolean) {
      const previousId = current?.id
      finish("unknown")
      const id = crypto.randomUUID()
      current = {
        id,
        span: startInactiveSpan({
          name: "/chat",
          op: "ui.action",
          forceTransaction: true,
          attributes: {
            browser_request_id: id,
            operation_id: id,
            origin: "browser",
            ...(isRetry && previousId ? { retry_of_operation_id: previousId } : {})
          }
        }),
        started: now(),
        correlation: { browser_request_id: id },
        finished: false,
        hasContent: false
      }
      record(
        isRetry ? "conversation.retry_requested" : "conversation.submitted",
        isRetry && previousId ? { retry_of_operation_id: previousId } : {}
      )
      return { id, span: current.span }
    },
    response(response: Response, operationId: string) {
      if (!current || current.id !== operationId) {
        return
      }
      const parsed = z.uuid().safeParse(response.headers.get("x-rostra-request-id"))
      if (parsed.success) {
        current.correlation = { ...current.correlation, request_id: parsed.data }
      }
      record("conversation.milestone", {
        milestone: "acknowledgement_received",
        durationMs: Math.max(0, now() - current.started),
        "http.response.status_code": response.status
      })
      if (!response.ok) {
        finish("failed")
      }
    },
    link(metadata: unknown) {
      const parsed = z.object({ correlation: telemetryCorrelationSchema }).safeParse(metadata)
      if (current && parsed.success && parsed.data.correlation.browser_request_id === current.id) {
        current.correlation = { ...parsed.data.correlation, browser_request_id: current.id }
      }
    },
    firstContent() {
      if (current && !current.finished && !current.hasContent) {
        current.hasContent = true
        const firstContentMs = Math.max(0, now() - current.started)
        current.span.setAttribute("firstContentMs", firstContentMs)
        record("conversation.milestone", { milestone: "first_content_rendered", firstContentMs })
      }
    },
    stop() {
      if (current && !current.finished) {
        record("conversation.stop_requested", { hasAnswer: current.hasContent })
        finish("cancelled")
      }
    },
    finish,
    correlation: () => current?.correlation ?? {}
  }
}
