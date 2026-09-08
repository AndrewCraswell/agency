import { createHash } from "node:crypto"
import { z } from "zod"

const coverageSchema = z
  .object({
    status: z.enum(["complete", "incomplete"]),
    quarantined: z.array(
      z.object({
        chamber: z.enum(["lower", "upper"]),
        name: z.string().min(1),
        organization: z.string().min(1),
        reason: z.literal("source_term_contradiction"),
        personId: z.string().regex(/^person:congress:[a-z]\d{6}$/)
      })
    )
  })
  .refine((coverage) => (coverage.status === "incomplete") === coverage.quarantined.length > 0, {
    message: "Incomplete committee coverage must retain its quarantined assignments"
  })

const observationSchema = z.object({
  // Absence means no saved coverage assessment, never implicit completeness.
  coverage: coverageSchema.optional(),
  detectedAt: z.iso.datetime(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAt: z.iso.datetime(),
  lastModified: z.iso.datetime(),
  packageId: z.string()
})

export type CommitteeDirectoryObservation = z.infer<typeof observationSchema>

export function readDirectoryObservation(value: unknown): CommitteeDirectoryObservation | undefined {
  if (value === undefined) {
    return undefined
  }
  return observationSchema.parse(value)
}

/** Hash roster identity and role, excluding retrieval times and metadata-only updates. */
export function committeeRosterFingerprint(
  memberships: readonly {
    organizationId: string
    personId: string
    role?: string | null
  }[]
): string {
  const unique = new Map(
    memberships.map((member) => [JSON.stringify([member.organizationId, member.personId]), member])
  )
  const rows = [...unique.values()]
    .map((member) => JSON.stringify([member.organizationId, member.personId, member.role ?? "member"]))
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
