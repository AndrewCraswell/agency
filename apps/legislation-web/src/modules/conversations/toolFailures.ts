import { captureException } from "@sentry/core"
import { InvalidToolInputError, NoSuchToolError } from "ai"
import { z } from "zod"
import { createCorrelationDiagnostics, createOpaqueTelemetryIds } from "../../services/sentry/telemetryCorrelation"
import { ResearchFailure } from "./researchFailure"
import { researchToolMeasurementSchema, type ResearchToolMeasurement } from "./researchMeasurement"

type ToolFailure = Readonly<{
  toolCallId: string
  toolName: string
  error: unknown
  durationMs?: number
  resultBytes?: number
  measurement?: ResearchToolMeasurement
}>

export function createToolFailureReporter(runId: string) {
  const reported = new Set<string>()
  const ids = createOpaqueTelemetryIds(createCorrelationDiagnostics())
  return ({ toolCallId, toolName, error, durationMs, resultBytes, measurement }: ToolFailure) => {
    if (reported.has(toolCallId)) {
      return
    }
    let failure = error instanceof ResearchFailure ? error : new ResearchFailure("internal", crypto.randomUUID())
    if (InvalidToolInputError.isInstance(error) || NoSuchToolError.isInstance(error) || error instanceof z.ZodError) {
      failure = new ResearchFailure("invalid_request", failure.reference)
    }
    if (failure.code === "interrupted") {
      return
    }
    reported.add(toolCallId)
    captureException(failure, {
      tags: {
        operation: "tool_call",
        tool: toolName,
        category: failure.code,
        reference: failure.reference,
        runId,
        tool_call_id: ids.get(toolCallId)
      },
      extra: {
        durationMs,
        resultBytes,
        measurement: measurement === undefined ? undefined : researchToolMeasurementSchema.parse(measurement)
      }
    })
  }
}
