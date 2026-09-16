import { normalizeCongressMemberDetails, type CongressEntityContext, type CongressEntitySnapshot } from "./entities.js"

export interface CongressMemberDetailClient {
  getMember(bioguideId: string): Promise<unknown>
}

/** Fetches each listed member detail once and lets detail records supersede collection-level person and term facts. */
export async function hydrateCongressMemberSnapshot(
  members: readonly unknown[],
  congress: number,
  context: CongressEntityContext,
  client: CongressMemberDetailClient,
  detailCache = new Map<string, unknown>()
): Promise<CongressEntitySnapshot> {
  const membersByBioguideId = new Map<string, unknown>()
  for (const member of members) {
    membersByBioguideId.set(memberBioguideId(member), member)
  }
  const details = []
  for (const [bioguideId, member] of membersByBioguideId) {
    let detail = detailCache.get(bioguideId)
    if (!detailCache.has(bioguideId)) {
      detail = await client.getMember(bioguideId)
      detailCache.set(bioguideId, detail)
    }
    details.push({ detail, member })
  }
  // Career-wide collection terms have different IDs from Congress-specific
  // detail terms. Unioning them preserves duplicates instead of superseding
  // the collection facts. The complete detail snapshot is authoritative.
  return normalizeCongressMemberDetails(details, congress, context)
}

function memberBioguideId(input: unknown): string {
  if (typeof input !== "object" || input === null || !("bioguideId" in input) || typeof input.bioguideId !== "string") {
    throw new Error("Congress member collection record lacks a bioguideId")
  }
  const bioguideId = input.bioguideId.trim()
  if (bioguideId.length === 0) {
    throw new Error("Congress member collection record lacks a bioguideId")
  }
  return bioguideId
}
