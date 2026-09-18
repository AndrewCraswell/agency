import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { auditLegalPassageManifestAdmission } from "./passage-manifest-admission.js"
import { preparationPlanParametersSchema } from "./preparation-plan.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({
  catalogPath: z.string().trim().min(1),
  catalogHash: hashSchema,
  environment: z.string().trim().min(1).max(100),
  waveId: z.uuid(),
  source: z.enum(["ecfr", "govinfo-cfr", "govinfo-fr"]),
  publishedBefore: z.iso.datetime({ offset: true }),
  limit: z.int().min(1).max(25).default(10),
  batchSize: z.int().min(1).max(2000).optional()
})

export type LegalPassageBackfillStart = z.input<typeof inputSchema>

/** Read-only operator preview. The catalog is re-audited before a Trigger payload can be produced. */
export async function inspectLegalPassageBackfillStart(pool: pg.Pool, value: LegalPassageBackfillStart) {
  const input = inputSchema.parse(value)
  const audited = await auditLegalPassageManifestAdmission(pool, {
    catalogPath: input.catalogPath,
    catalogHash: input.catalogHash,
    batchSize: input.batchSize
  })
  const expectedScope = input.source === "govinfo-fr" ? "publication" : "edition"
  invariant(audited.admission.scopeKind === expectedScope, "legal_passage_backfill_scope_mismatch")
  const parameters = preparationPlanParametersSchema.parse({
    source: input.source,
    model: audited.model,
    publishedBefore: new Date(input.publishedBefore).toISOString(),
    limit: input.limit,
    retryBlocked: false,
    pendingOnly: false,
    manifestAdmission: audited.admission
  })
  const payload = { controller: { waveId: input.waveId, ...parameters } }
  const planId = digest(
    JSON.stringify(["legal-passage-backfill-start-2026-09-17", input.environment, input.catalogHash, payload])
  )
  return {
    contract: "legal-passage-backfill-start" as const,
    status: "planned" as const,
    environment: input.environment,
    planId,
    catalog: {
      hash: audited.catalogHash,
      model: audited.model,
      tokenizerId: audited.tokenizerId
    },
    totals: audited.totals,
    canApply: audited.totals.pending > 0,
    payload
  }
}

/** Apply remains impossible until the operator binds the preview to trusted deployment configuration. */
export function requireLegalPassageBackfillApply(
  report: Awaited<ReturnType<typeof inspectLegalPassageBackfillStart>>,
  value: { environment?: string; model?: string; planId?: string }
) {
  invariant(report.canApply, "legal_passage_backfill_no_pending_versions")
  invariant(value.planId === report.planId, "legal_passage_backfill_plan_changed")
  invariant(value.environment === report.environment, "legal_passage_backfill_environment_mismatch")
  invariant(value.model === report.catalog.model, "legal_passage_backfill_model_not_selected")
  return report.payload
}
