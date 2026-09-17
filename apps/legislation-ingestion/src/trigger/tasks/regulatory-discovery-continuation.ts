import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, tasks } from "@trigger.dev/sdk"
import { z } from "zod"
import {
  legalDiscoveryDispatchPayloadSchema,
  legalDiscoveryStageSchema
} from "../../ingestion/regulations/discovery-dispatch.js"

const scopeSchema = z.strictObject({
  sourceId: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]),
  scopeKey: z.string().regex(/^[a-f0-9]{64}$/)
})

/** Replenishes a bounded source-stage window after canonical worker completion; it never registers a schedule. */
export async function continueRegulatoryDiscoveryStage(
  stageValue: unknown,
  payloadValue: unknown,
  scopeValue: unknown
) {
  const stage = legalDiscoveryStageSchema.parse(stageValue)
  const payload = legalDiscoveryDispatchPayloadSchema.parse(payloadValue)
  const scope = scopeSchema.parse(scopeValue)
  const key = digest(JSON.stringify(["regulatory-discovery-controller-continuation-2026-09-17", stage, payload]))
  const next = await tasks.trigger(
    "regulatory-discovery-controller",
    { ...scope, afterUnitKey: null, limit: 25 },
    {
      idempotencyKey: await idempotencyKeys.create(`regulatory-discovery-controller:${key}`, { scope: "global" })
    }
  )
  return z.object({ id: z.string().trim().min(1).max(256) }).parse(next)
}
