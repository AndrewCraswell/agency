import type pg from "pg"
import { z } from "zod"
import { getRequestContext } from "../auth/request-context.js"
import { searchCopiedLegalPassages } from "../ingestion/regulations/passage-search.js"
import { legalPassageScopeSchema } from "../ingestion/regulations/passage-storage.js"
import { LegislationError } from "../legislation/errors.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({
  scope: legalPassageScopeSchema,
  generationId: hash,
  preparationId: hash,
  query: z.string().trim().min(1).max(500),
  limit: z.int().min(1).max(50).optional()
})

/** Application boundary for the opt-in canary. This is not a registered HTTP route or MCP tool. */
export function createLegalSearchCanary(source: pg.Pool, target: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (unparsed: unknown) => {
    // Only the verified request context supplies identity. Headers and request-body identity fields are not accepted.
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = inputSchema.parse(unparsed)
    try {
      return await searchCopiedLegalPassages(source, target, { ...input, apiAccess: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      if (
        message.startsWith("rights_denied:") ||
        message === "Invariant failed: rights_profile_unavailable" ||
        message === "Invariant failed: legal_api_source_unsupported"
      ) {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      throw error
    }
  }
}
