import { createHash } from "node:crypto"

function normalizeSegment(value: string, field: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll("&", " and ")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")

  if (normalized.length === 0) {
    throw new Error(`${field} must contain at least one letter or number`)
  }

  return normalized
}

function stableHash(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 24)
}

function normalizeBillType(value: string): string {
  return normalizeSegment(value, "bill type").replaceAll("-", "")
}

function normalizeBillNumber(value: string | number): string {
  const normalized = normalizeSegment(String(value), "bill number")
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized
}

export function jurisdictionId(subdivisionCode: string): string {
  return `jurisdiction:${normalizeSegment(subdivisionCode, "subdivision code")}`
}

export function legislativeSessionId(subdivisionCode: string, sessionIdentifier: string): string {
  return `session:${normalizeSegment(subdivisionCode, "subdivision code")}:${normalizeSegment(sessionIdentifier, "session identifier")}`
}

export function billId(
  subdivisionCode: string,
  sessionIdentifier: string,
  billType: string,
  billNumber: string | number
): string {
  return [
    "bill",
    normalizeSegment(subdivisionCode, "subdivision code"),
    normalizeSegment(sessionIdentifier, "session identifier"),
    normalizeBillType(billType),
    normalizeBillNumber(billNumber)
  ].join(":")
}

export function federalBillId(congress: number, billType: string, billNumber: string | number): string {
  if (!Number.isSafeInteger(congress) || congress < 1) {
    throw new Error("congress must be a positive integer")
  }

  return billId("us", String(congress), billType, billNumber)
}

export function personId(provider: string, upstreamId: string): string {
  return `person:${normalizeSegment(provider, "provider")}:${normalizeSegment(upstreamId, "upstream ID")}`
}

export function organizationId(provider: string, upstreamId: string): string {
  return `organization:${normalizeSegment(provider, "provider")}:${normalizeSegment(upstreamId, "upstream ID")}`
}

export function legislativeTermId(personCanonicalId: string, sourceIdentity: string): string {
  return `${personCanonicalId}:term:${stableHash([personCanonicalId, sourceIdentity.normalize("NFKC").trim()])}`
}

export function organizationMembershipId(
  organizationCanonicalId: string,
  personCanonicalId: string,
  sourceIdentity: string
): string {
  return `${organizationCanonicalId}:membership:${stableHash([
    organizationCanonicalId,
    personCanonicalId,
    sourceIdentity.normalize("NFKC").trim()
  ])}`
}

export function legislativeEventId(provider: string, upstreamId: string): string {
  return `event:${normalizeSegment(provider, "provider")}:${normalizeSegment(upstreamId, "upstream ID")}`
}

export function eventChildId(
  kind: "agenda" | "document" | "participant",
  canonicalEventId: string,
  sourceIdentity: string
): string {
  return `${canonicalEventId}:${kind}:${stableHash([kind, canonicalEventId, sourceIdentity.normalize("NFKC").trim()])}`
}

export function childId(
  kind: "action" | "document" | "relation" | "sponsor" | "vote",
  canonicalBillId: string,
  sourceIdentity: string
): string {
  return `${canonicalBillId}:${kind}:${stableHash([kind, canonicalBillId, sourceIdentity.normalize("NFKC").trim()])}`
}

export function documentSectionId(documentId: string, ordinal: number, contentHash: string): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
    throw new Error("section ordinal must be a nonnegative integer")
  }

  return `${documentId}:section:${stableHash([documentId, String(ordinal), contentHash])}`
}

export function assertCanonicalIdentitiesUnique(
  identities: ReadonlyArray<{ canonicalId: string; sourceIdentity: string }>
): void {
  const sourcesByCanonicalId = new Map<string, string>()
  for (const identity of identities) {
    const existing = sourcesByCanonicalId.get(identity.canonicalId)
    if (existing !== undefined && existing !== identity.sourceIdentity) {
      throw new Error(
        `Canonical identity collision for ${identity.canonicalId}: ${existing} and ${identity.sourceIdentity}`
      )
    }
    sourcesByCanonicalId.set(identity.canonicalId, identity.sourceIdentity)
  }
}
