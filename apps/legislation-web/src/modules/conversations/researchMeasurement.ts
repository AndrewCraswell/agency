import { z } from "zod"
import { researchFailureCode, type ResearchFailureCode } from "./researchFailure"

export const researchToolMeasurementSchema = z.object({
  runId: z.string().min(1).max(128),
  toolCallId: z.string().min(1).max(256),
  toolName: z.string().min(1).max(128),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  durationMs: z.number().finite().nonnegative(),
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
  attemptCount: z.literal(1),
  internalRetryCount: z.null(),
  retryOfToolCallId: z.null()
})

export type ResearchToolMeasurement = Readonly<z.infer<typeof researchToolMeasurementSchema>>
