import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"

const inputSchema = z
  .array(
    z.strictObject({
      versionId: z.string().min(1).max(256),
      body: z.string().min(1).max(200000),
      split: z.enum(["development", "held-out"])
    })
  )
  .min(1)
  .max(128)

/** Candidate coassignment evidence only; lexical similarity cannot establish semantic independence. */
export function screenRegulatoryNearDuplicates(value: unknown) {
  const input = inputSchema
    .parse(value)
    .sort((a, b) => (a.versionId < b.versionId ? -1 : a.versionId > b.versionId ? 1 : 0))
  invariant(new Set(input.map((r) => r.versionId)).size === input.length, "regulatory_duplicate_version_identity")
  invariant(input.reduce((n, r) => n + r.body.length, 0) <= 2000000, "regulatory_duplicate_total_character_limit")
  const rows = input.map((row) => {
    const words =
      row.body
        .normalize("NFKC")
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu) ?? []
    invariant(words.length > 0, "regulatory_duplicate_words_required")
    const shingles = new Set(
      words.slice(0, Math.max(0, words.length - 4)).map((_, i) => words.slice(i, i + 5).join(" "))
    )
    return { ...row, bodyHash: digest(row.body), normalizedHash: digest(words.join(" ")), shingles }
  })
  const neighbors = new Map(rows.map((r) => [r.versionId, new Set<string>()]))
  const pairs: {
    versions: string[]
    crossSplit: boolean
    reason: "normalized_equal" | "shingle_overlap"
    jaccard: number | null
  }[] = []
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    invariant(a, "regulatory_duplicate_row_required")
    for (const b of rows.slice(i + 1)) {
      const small = a.shingles.size <= b.shingles.size ? a.shingles : b.shingles
      const large = small === a.shingles ? b.shingles : a.shingles
      let intersection = 0
      for (const word of small) if (large.has(word)) intersection++
      const union = small.size + large.size - intersection
      const jaccard = union === 0 ? null : intersection / union
      const equal = a.normalizedHash === b.normalizedHash
      if (!equal && (jaccard === null || jaccard < 0.5)) continue
      neighbors.get(a.versionId)?.add(b.versionId)
      neighbors.get(b.versionId)?.add(a.versionId)
      pairs.push({
        versions: [a.versionId, b.versionId],
        crossSplit: a.split !== b.split,
        reason: equal ? "normalized_equal" : "shingle_overlap",
        jaccard
      })
    }
  }
  const seen = new Set<string>()
  const groups = []
  for (const row of rows) {
    if (seen.has(row.versionId)) continue
    const pending = [row.versionId]
    const members: string[] = []
    while (pending.length) {
      const id = pending.pop()
      invariant(id, "regulatory_duplicate_member_required")
      if (seen.has(id)) continue
      seen.add(id)
      members.push(id)
      pending.push(...(neighbors.get(id) ?? []))
    }
    members.sort()
    const splits = new Set(rows.filter((r) => members.includes(r.versionId)).map((r) => r.split))
    groups.push({ groupId: digest(JSON.stringify(members)), members, crossSplit: splits.size > 1 })
  }
  return {
    contract: "regulatory-evaluation-near-duplicates",
    method: "NFKC lowercase Unicode words; normalized equality or five-word-shingle Jaccard >= 0.5",
    inputHash: digest(JSON.stringify(input)),
    records: rows.map(({ versionId, split, bodyHash, normalizedHash }) => ({
      versionId,
      split,
      bodyHash,
      normalizedHash
    })),
    pairs,
    groups,
    crossSplitGroups: groups.filter((g) => g.crossSplit).length,
    sourceProvenanceVerified: false,
    semanticReviewComplete: false,
    splitAssignmentVerified: false,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
}
