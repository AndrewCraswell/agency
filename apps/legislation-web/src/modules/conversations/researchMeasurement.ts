import { z } from "zod"
import { researchFailureCode, type ResearchFailureCode } from "./researchFailure"

export const researchToolMeasurementSchema = z.object({
  runId: z.string().min(1).max(128),
  toolCallId: z.string().min(1).max(256),
  toolName: z.string().min(1).max(128),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime(),
  durationMs: z.number().finite().nonnegative().nullable(),
  unavailableReason: z.literal("execution_not_observed").optional(),
  dependencyDurationMs: z.number().finite().nonnegative().nullable(),
  rawResultBytes: z.number().int().nonnegative().nullable(),
  enrichedResultBytes: z.number().int().nonnegative().nullable(),
  modelResultBytes: z.number().int().nonnegative().nullable(),
  resultCount: z.number().int().nonnegative().nullable(),
  hasNextPage: z.boolean().nullable(),
  outcome: z.enum(["success", "error"]),
  failureCode: z
    .custom<ResearchFailureCode>((value) => typeof value === "string" && researchFailureCode(value) === value)
    .nullable(),
  attemptCount: z.union([z.literal(1), z.null()]),
  internalRetryCount: z.null(),
  retryOfToolCallId: z.null()
})

export type ResearchToolMeasurement = Readonly<z.infer<typeof researchToolMeasurementSchema>>

export function unobservedToolFailure(
  runId: string,
  toolCallId: string,
  toolName: string,
  failureCode: ResearchFailureCode | null
): ResearchToolMeasurement {
  return {
    runId,
    toolCallId,
    toolName,
    failureCode,
    startedAt: null,
    finishedAt: new Date().toISOString(),
    durationMs: null,
    unavailableReason: "execution_not_observed",
    dependencyDurationMs: null,
    rawResultBytes: null,
    enrichedResultBytes: null,
    modelResultBytes: null,
    resultCount: null,
    hasNextPage: null,
    outcome: "error",
    attemptCount: null,
    internalRetryCount: null,
    retryOfToolCallId: null
  }
}
