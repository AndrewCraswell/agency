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
