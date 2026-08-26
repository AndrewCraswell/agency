import {
  normalizeCongressMemberDetails,
  normalizeCongressMembers,
  type CongressEntityContext,
  type CongressEntitySnapshot
} from "./entities.js"

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
): Promise<
  Pick<CongressEntitySnapshot, "personDetailPersonIds" | "personDetails" | "personJurisdictions" | "people" | "terms">
> {
  const listed = normalizeCongressMembers(members, congress, context)
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
  const detailed = normalizeCongressMemberDetails(details, congress, context)
  return {
    personDetailPersonIds: detailed.personDetailPersonIds,
    personDetails: detailed.personDetails,
    personJurisdictions: detailed.personJurisdictions,
    people: uniqueById([...listed.people, ...detailed.people]),
    terms: uniqueById([...listed.terms, ...detailed.terms])
  }
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

function uniqueById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()]
}
