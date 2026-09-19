import { getActiveSpan, spanToJSON, startSpan, type Span } from "@sentry/core"
import { diagnosticBreadcrumb } from "../../services/sentry/diagnosticBreadcrumb"
import { projectSentryMetadata } from "../../services/sentry/sentryPayloadFields"
import type { ResearchToolMeasurement } from "./researchMeasurement"

let failures = 0

export function observeTool<T>(name: string, execute: (span: Span) => Promise<T>): Promise<T> {
  diagnosticBreadcrumb("research.tool_started", { tool_name: name })
  const active = getActiveSpan()
  if (active && spanToJSON(active).data?.["gen_ai.tool.name"] === name) {
    return execute(active)
  }
  return startSpan({ name: "research.tool", op: "gen_ai.execute_tool", attributes: { tool_name: name } }, execute)
}

export function recordToolMeasurement(
  span: Span,
  measurement: ResearchToolMeasurement,
  telemetryId: string,
  stage: "validation" | "dependency" | "enrichment" | "serialization"
) {
  try {
    const data = projectSentryMetadata(
      {
        ...measurement,
        run_id: measurement.runId,
        tool_name: measurement.toolName,
        tool_call_id: telemetryId,
        stage,
        outcome: measurement.failureCode === "interrupted" ? "cancelled" : measurement.outcome
      },
      {}
    )
    span.setAttributes(data)
    span.setStatus({ code: measurement.outcome === "success" ? 1 : 2 })
    diagnosticBreadcrumb("research.tool_finished", data)
  } catch {
    if (failures++ < 10) {
      console.warn("Tool telemetry could not be recorded")
    }
  }
}
