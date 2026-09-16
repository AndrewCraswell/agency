import { z } from "zod"

export const sourceUrlSchema = z.url({ protocol: /^https?$/ }).pipe(
  z.string().refine((value) => {
    const url = new URL(value)
    if (url.username || url.password) {
      return false
    }
    return ![...url.searchParams.keys()].some((key) => /token|secret|signature|api[_-]?key|^sig$/i.test(key))
  }, "Source links must not contain credentials.")
)

export const evidenceSnapshotSchema = z.strictObject({
  id: z.string().min(1).max(256),
  title: z.string().trim().min(1).max(1000),
  origin: z.enum(["canonical", "web"]),
  publisher: z.string().trim().min(1).max(240).optional(),
  versionLabel: z.string().trim().min(1).max(240).optional(),
  locator: z.string().trim().min(1).max(240).optional(),
  sourceUrl: sourceUrlSchema.nullable(),
  content: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("available"), quote: z.string().min(1).max(20000) }),
    z.strictObject({ state: z.enum(["not-collected", "unavailable", "failed"]) })
  ])
})

export const citedAnswerSchema = z
  .strictObject({
    claims: z
      .array(
        z.strictObject({
          id: z.string().min(1).max(256),
          text: z.string().trim().min(1).max(20000),
          citationIds: z.array(z.string().min(1).max(256)).max(25)
        })
      )
      .max(100),
    citations: z.array(evidenceSnapshotSchema).max(100)
  })
  .superRefine((answer, context) => {
    const citationIds = new Set(answer.citations.map((citation) => citation.id))
    if (citationIds.size !== answer.citations.length) {
      context.addIssue({ code: "custom", path: ["citations"], message: "Citation IDs must be unique." })
    }
    if (new Set(answer.claims.map((claim) => claim.id)).size !== answer.claims.length) {
      context.addIssue({ code: "custom", path: ["claims"], message: "Claim IDs must be unique." })
    }
    answer.claims.forEach((claim, index) => {
      if (
        new Set(claim.citationIds).size !== claim.citationIds.length ||
        claim.citationIds.some((id) => !citationIds.has(id))
      ) {
        context.addIssue({
          code: "custom",
          path: ["claims", index, "citationIds"],
          message: "Claims must reference distinct evidence from this answer."
        })
      }
    })
  })

export type EvidenceSnapshot = z.infer<typeof evidenceSnapshotSchema>

const sourceRecordSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  sourceUrl: z.string().optional(),
  url: z.string().optional(),
  text: z.string().optional(),
  snippet: z.string().optional(),
  heading: z.string().nullable().optional(),
  sectionIdentifier: z.string().nullable().optional(),
  versionCode: z.string().nullable().optional(),
  documentDate: z.string().nullable().optional()
})

export function projectResearchEvidence(data: unknown, createId: () => string): EvidenceSnapshot[] {
  const evidence: EvidenceSnapshot[] = []
  const seen = new Set<string>()
  let visited = 0
  function visit(value: unknown, parent?: z.infer<typeof sourceRecordSchema>, depth = 0) {
    if (++visited > 3000 || depth > 12 || evidence.length >= 40) {
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, parent, depth + 1)
      }
      return
    }
    if (value === null || typeof value !== "object") {
      return
    }
    const parsed = sourceRecordSchema.safeParse(value)
    if (!parsed.success) {
      return
    }
    const record = parsed.data
    let context = parent
    if ("document" in value) {
      const document = sourceRecordSchema.safeParse(value.document)
      if (document.success) {
        context = document.data
      }
    }
    const url = sourceUrlSchema.safeParse(record.sourceUrl ?? record.url ?? context?.sourceUrl)
    if (url.success) {
      const quote = record.text
      const locator = record.sectionIdentifier ?? record.heading ?? undefined
      const key = `${url.data}\n${record.id ?? ""}\n${locator ?? ""}`
      if (!seen.has(key)) {
        const snapshot = evidenceSnapshotSchema.safeParse({
          id: createId(),
          title: record.title ?? record.name ?? context?.title ?? new URL(url.data).hostname,
          origin: "canonical",
          sourceUrl: url.data,
          versionLabel:
            [record.versionCode ?? context?.versionCode, record.documentDate ?? context?.documentDate]
              .filter(Boolean)
              .join(", ") || undefined,
          locator,
          content: quote && quote.length <= 20000 ? { state: "available", quote } : { state: "not-collected" }
        })
        if (snapshot.success) {
          seen.add(key)
          evidence.push(snapshot.data)
        }
      }
    }
    for (const [key, item] of Object.entries(value)) {
      if (key !== "embedding" && item !== null && typeof item === "object") {
        visit(item, context, depth + 1)
      }
    }
  }
  visit(data)
  return evidence
}

export function formatEvidenceCitation(evidence: EvidenceSnapshot) {
  const parts = [evidence.title, evidence.publisher, evidence.versionLabel, evidence.locator]
  if (evidence.content.state === "available") {
    parts.push(evidence.content.quote)
  }
  if (evidence.sourceUrl) {
    parts.push(evidence.sourceUrl)
  }
  return parts.filter((part) => part !== undefined).join("\n")
}
