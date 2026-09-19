import { z } from "zod"
import { extractionRepairEvidence } from "../../ingestion/documents/extraction-repair-evidence.js"
import { stateContentNextWork } from "../../ingestion/openstates/state-content-backlog.js"
import { stateContentScope } from "../../ingestion/openstates/state-content-scope.js"

export const stateContentPayload = z.strictObject({
  state: stateContentScope,
  session: z
    .string()
    .regex(/^[A-Za-z0-9-]+$/)
    .optional(),
  billConcurrency: z.number().int().min(1).max(4).default(2),
  billLimit: z.number().int().min(1).max(10).default(8),
  extractionRepairs: z.array(extractionRepairEvidence).max(10).optional()
})
export const stateContentControllerPayload = stateContentPayload.extend({
  maxContinuations: z.number().int().min(1).max(100).default(10)
})

/** Explicit schedule identity; never silently substitute a current session for a historical one. */
export function stateContentSchedulePlan(externalId: string | undefined, configured: string | undefined) {
  const identity = z
    .string()
    .regex(/^(nc|ak):[A-Za-z0-9-]+$/)
    .parse(externalId)
  const [state, session] = identity.split(":")
  const payload = stateContentControllerPayload.parse({ state, session, maxContinuations: 1 })
  requireStateContentActivation(payload.state, configured)
  return { identity, payload }
}

const successfulStateContentResult = z.object({
  status: z.literal("succeeded"),
  checkpoint: z.object({
    scanRoundComplete: z.boolean(),
    ingestionComplete: z.literal(false),
    nextWork: stateContentNextWork
  })
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

/** Audited repairs cannot cross the explicitly selected state/session boundary. */
export function requireStateRepairScope(
  state: "nc" | "ak",
  session: string | undefined,
  repairs: z.infer<typeof extractionRepairEvidence>[]
) {
  if (repairs.length > 0 && !session) {
    throw new Error("Extraction repairs require an exact session")
  }
  const prefix = `bill:${state}:${session?.toLowerCase()}:`
  if (repairs.some((repair) => !repair.billId.startsWith(prefix))) {
    throw new Error("Extraction repair is outside the approved state/session")
  }
  if (new Set(repairs.map((repair) => repair.documentId)).size !== repairs.length) {
    throw new Error("Duplicate extraction repair target")
  }
}

/** A scan boundary is not evidence that pending documents, OCR or indexing are complete. */
export async function runStateContentContinuations(
  maxContinuations: number,
  run: (continuation: number) => Promise<{ ok: boolean; output?: unknown }>,
  now: () => number = Date.now
) {
  z.number().int().min(1).max(100).parse(maxContinuations)
  let scanRounds = 0
  const startedAt = now()
  for (let continuation = 0; continuation < maxContinuations; continuation += 1) {
    const result = await run(continuation)
    if (!result.ok) {
      throw new Error("State content child failed; resume from its durable state")
    }
    const output = successfulStateContentResult.parse(result.output)
    if (output.checkpoint.scanRoundComplete) {
      scanRounds += 1
    }
    const nextWork = output.checkpoint.nextWork
    if (nextWork.kind !== "continue") {
      if (!output.checkpoint.scanRoundComplete) throw new Error("Cannot stop before a complete content scan")
      return {
        reason: nextWork.kind,
        continuations: continuation + 1,
        scanRounds,
        ingestionComplete: false as const,
        nextWork
      }
    }
    // Yield between children well before the controller's four-hour deadline.
    if (now() - startedAt >= 10 * 60_000) {
      return {
        reason: "time_budget",
        continuations: continuation + 1,
        scanRounds,
        ingestionComplete: false as const,
        nextWork
      }
    }
  }
  return {
    reason: "continuation_budget" as const,
    continuations: maxContinuations,
    scanRounds,
    ingestionComplete: false,
    nextWork: { kind: "continue" as const }
  }
}
