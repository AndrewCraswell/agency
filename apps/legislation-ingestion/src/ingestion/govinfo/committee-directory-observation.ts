import { createHash } from "node:crypto"
import type { CommitteeDirectoryObservation } from "@repo/legislation-core/domain/committee-directory-observation"
import type { OrganizationMembershipEndReason } from "@repo/legislation-core/domain/membership"

/** Hash source assignment semantics, excluding retrieval metadata and local Congress closure. */
export function committeeRosterFingerprint(
  memberships: readonly {
    organizationId: string
    personId: string
    role?: string | null
    endedReason?: OrganizationMembershipEndReason | null
  }[]
): string {
  const unique = new Map(
    memberships.map((member) => [JSON.stringify([member.organizationId, member.personId]), member])
  )
  const rows = [...unique.values()]
    .map((member) =>
      JSON.stringify([
        member.organizationId,
        member.personId,
        member.role ?? "member",
        // An archived mention is not positive evidence of active service. Local
        // Congress-end reconciliation, however, must not change the source hash.
        ...(member.endedReason === "historical_at_first_observation" ? [member.endedReason] : [])
      ])
    )
    .sort()
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex")
}

export function directoryDetectionDate(input: {
  fingerprint: string
  issuedAt: Date
  lastModified: Date
  now: Date
  packageId: string
  previous?: CommitteeDirectoryObservation
  sessionEnd: string
}): Date | undefined {
  const previous = input.previous
  if (previous === undefined) {
    return input.issuedAt
  }
  if (input.packageId !== previous.packageId) {
    if (input.issuedAt <= new Date(previous.detectedAt)) {
      throw new Error("GovInfo edition predates the last observed roster; chronological replay is required")
    }
    return input.issuedAt
  }
  if (input.fingerprint === previous.fingerprint) {
    return undefined
  }
  if (
    input.lastModified <= new Date(previous.detectedAt) ||
    input.lastModified <= new Date(previous.lastModified) ||
    input.lastModified > input.now
  ) {
    throw new Error("GovInfo changed roster lacks a later valid source modification date")
  }
  if (input.lastModified.toISOString().slice(0, 10) >= input.sessionEnd) {
    throw new Error("GovInfo correction was published after Congress ended; historical replay is required")
  }
  return input.lastModified
}
