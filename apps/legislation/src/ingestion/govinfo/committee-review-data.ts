import { z } from "zod"
import identities105 from "./review-data/105-identities.json" with { type: "json" }
import assignments106 from "./review-data/106-historical-assignments.json" with { type: "json" }
import identities106 from "./review-data/106-identities.json" with { type: "json" }
import assignments107 from "./review-data/107-historical-assignments.json" with { type: "json" }
import identities108 from "./review-data/108-identities.json" with { type: "json" }
import identities109 from "./review-data/109-identities.json" with { type: "json" }
import identities113 from "./review-data/113-identities.json" with { type: "json" }

const text = z.string().min(1)
const contextSchema = z.strictObject({ name: text, parentName: text.optional() })
const identitySchema = z.strictObject({
  printedName: text,
  state: z.string().regex(/^[A-Z]{2}$/),
  canonicalState: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  chamber: z.enum(["lower", "upper"]),
  personId: text,
  canonicalName: text,
  givenName: text,
  familyName: text,
  district: text.nullable(),
  contexts: z.array(contextSchema).min(1),
  corroboration: z
    .strictObject({
      name: text,
      count: z.number().int().positive(),
      state: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      contexts: z.array(contextSchema).min(1).optional()
    })
    .optional()
})
const editionSchema = z.strictObject({
  packageId: z.string().regex(/^CDIR-\d{4}-\d{2}-\d{2}$/),
  congress: z.number().int().positive(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  organizations: z.number().int().positive(),
  entries: z.number().int().positive()
})
const datasetSchema = z.strictObject({
  reviewNotes: z.array(text).optional(),
  historicalAtFirstObservation: z.literal(true).optional(),
  editions: z.array(editionSchema).min(1),
  identities: z.array(identitySchema).min(1)
})

export type IdentityReview = z.infer<typeof editionSchema> & {
  historicalAtFirstObservation?: true
  identities: readonly z.infer<typeof identitySchema>[]
}

/** Load trusted, repository-reviewed data, never a source-supplied override. */
export function loadCommitteeReviewData(input: unknown) {
  const datasets = z.array(datasetSchema).parse(input)
  const identities: IdentityReview[] = []
  const historicalAssignments: IdentityReview[] = []
  const editions = new Set<string>()
  for (const dataset of datasets) {
    const contexts = new Set<string>()
    for (const identity of dataset.identities) {
      for (const context of identity.contexts) {
        const key = JSON.stringify([
          identity.printedName,
          identity.state,
          identity.chamber,
          context.name,
          context.parentName
        ])
        if (contexts.has(key)) {
          throw new Error(`Duplicate committee review context for ${identity.printedName}`)
        }
        contexts.add(key)
      }
    }
    for (const edition of dataset.editions) {
      const key = `${dataset.historicalAtFirstObservation === true ? "historical" : "identity"}:${edition.packageId}`
      if (editions.has(key)) {
        throw new Error(`Duplicate committee review edition ${edition.packageId}`)
      }
      editions.add(key)
      const review: IdentityReview = { ...edition, identities: dataset.identities }
      if (dataset.historicalAtFirstObservation === true) {
        historicalAssignments.push({ ...review, historicalAtFirstObservation: true })
      } else {
        identities.push(review)
      }
    }
  }
  return { identities, historicalAssignments }
}

const loaded = loadCommitteeReviewData([
  identities105,
  identities106,
  identities108,
  identities109,
  identities113,
  assignments106,
  assignments107
])
export const committeeIdentityReviews: readonly IdentityReview[] = loaded.identities
export const historicalAssignmentReviews: readonly IdentityReview[] = loaded.historicalAssignments
