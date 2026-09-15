import { z } from "zod"
import { stateContentScope } from "../../ingestion/openstates/state-content.js"

export const stateContentPayload = z.strictObject({
  state: stateContentScope,
  session: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .optional(),
  billConcurrency: z.number().int().min(1).max(4).default(2),
  billLimit: z.number().int().min(1).max(10).default(8)
})
export const stateContentControllerPayload = stateContentPayload.extend({
  maxContinuations: z.number().int().min(1).max(100).default(10)
})

const successfulStateContentResult = z.object({
  status: z.literal("succeeded"),
  checkpoint: z.object({ scanRoundComplete: z.boolean(), ingestionComplete: z.literal(false) })
})

/** A recorded job failure must fail the hosted task so its retry policy can run. */
export function requireSuccessfulStateContentResult<T>(result: T): T {
  successfulStateContentResult.parse(result)
  return result
}

export function requireStateContentActivation(state: "nc" | "ak", configured: string | undefined) {
  const enabled =
    configured
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? []
  const approved = z.array(stateContentScope).parse(enabled)
  if (!approved.includes(state)) {
    throw new Error(`State content activation is not approved for ${state}`)
  }
}

/** A scan boundary is not evidence that pending documents, OCR or indexing are complete. */
export async function runStateContentContinuations(
  maxContinuations: number,
  run: (continuation: number) => Promise<{ ok: boolean; output?: unknown }>
) {
  z.number().int().min(1).max(100).parse(maxContinuations)
  let scanRounds = 0
  for (let continuation = 0; continuation < maxContinuations; continuation += 1) {
    const result = await run(continuation)
    if (!result.ok) {
      throw new Error("State content child failed; resume from its durable state")
    }
    const output = successfulStateContentResult.parse(result.output)
    if (output.checkpoint.scanRoundComplete) {
      scanRounds += 1
    }
  }
  return {
    reason: "continuation_budget" as const,
    continuations: maxContinuations,
    scanRounds,
    ingestionComplete: false
  }
}
