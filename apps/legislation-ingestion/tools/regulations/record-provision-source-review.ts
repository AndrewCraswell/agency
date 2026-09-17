import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  inspectLegalProvisionSourceReview,
  legalProvisionSourceReviewRequestSchema,
  registerLegalProvisionSourceReview
} from "../../src/ingestion/regulations/provision-source-review.js"

const { values } = parseArgs({
  options: {
    request: { type: "string" },
    evidence: { type: "string" },
    environment: { type: "string" },
    apply: { type: "boolean", default: false },
    plan: { type: "string" }
  }
})
const requestPath = resolve(z.string().min(1).parse(values.request))
const evidencePath = resolve(z.string().min(1).parse(values.evidence))
const environment = z.string().min(1).parse(values.environment)
const request = legalProvisionSourceReviewRequestSchema.parse(JSON.parse(await readFile(requestPath, "utf8")))
const corroboration = request.corroboration[0]
invariant(corroboration && request.corroboration.length === 1, "legal_provision_source_review_evidence_count")
const evidenceStat = await stat(evidencePath)
const evidenceBytes = await readFile(evidencePath)
invariant(
  evidenceStat.isFile() &&
    evidenceStat.size === corroboration.bytes &&
    evidenceBytes.length === corroboration.bytes &&
    digest(evidenceBytes) === corroboration.artifactHash,
  "legal_provision_source_review_evidence_changed"
)
const connectionString = z.url().parse(process.env.DATABASE_URL)
const target = new URL(connectionString)
invariant(
  ["postgres:", "postgresql:"].includes(target.protocol) &&
    target.pathname !== "/" &&
    target.pathname !== "/legislation_passage_search",
  "legal_provision_source_review_wrong_database"
)
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
try {
  const inspected = await inspectLegalProvisionSourceReview(pool, request)
  const planId = digest(
    JSON.stringify({
      contract: "legal-provision-source-review-plan-2026-09-17",
      environment,
      database: target.pathname,
      reviewHash: inspected.reviewHash
    })
  )
  if (values.apply !== true) {
    process.stdout.write(
      `${JSON.stringify({ status: "planned", planId, environment, reviewHash: inspected.reviewHash, evidence: inspected.evidence }, null, 2)}\n`
    )
  } else {
    invariant(process.env.REGULATORY_ENVIRONMENT?.trim() === environment, "legal_provision_source_review_environment")
    invariant(values.plan === planId, "legal_provision_source_review_plan_changed")
    const result = await registerLegalProvisionSourceReview(pool, request)
    process.stdout.write(`${JSON.stringify({ status: "recorded", planId, ...result }, null, 2)}\n`)
  }
} finally {
  await pool.end()
}
