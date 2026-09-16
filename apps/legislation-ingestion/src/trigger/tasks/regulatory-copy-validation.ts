import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  finalizeLegalPassageCopy,
  legalCopyValidationPageSchema,
  verifyLegalPassageCopyPage
} from "../../ingestion/regulations/passage-copy-readiness.js"

/** Pages only save evidence. Finalization must be requested explicitly after every page has passed. */
export const regulatoryCopyValidation = task({
  id: "regulatory-copy-validation",
  maxDuration: 180,
  queue: { name: "regulatory-copy-validation", concurrencyLimit: 2 },
  run: async (value: unknown) => runRegulatoryCopyValidation(value)
})

export async function runRegulatoryCopyValidation(value: unknown) {
  const input = z
    .union([
      legalCopyValidationPageSchema,
      z.strictObject({ operation: z.literal("finalize"), preparationId: z.string().regex(/^[a-f0-9]{64}$/) })
    ])
    .parse(value)
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const sourceUrl = new URL(env.DATABASE_URL)
  const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (
    ![sourceUrl.protocol, targetUrl.protocol].every((protocol) => ["postgres:", "postgresql:"].includes(protocol)) ||
    sourceUrl.pathname === "/legislation_passage_search" ||
    targetUrl.pathname !== "/legislation_passage_search" ||
    sourceUrl.host === targetUrl.host
  ) {
    throw new Error("Regulatory validation requires the separate PostgreSQL search host")
  }
  const source = new pg.Pool({ connectionString: sourceUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  const target = new pg.Pool({ connectionString: targetUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  try {
    return await ("operation" in input
      ? finalizeLegalPassageCopy(source, target, input.preparationId)
      : verifyLegalPassageCopyPage(source, target, input))
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}
