import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import { z } from "zod"

export const regulatoryStorageContract = "regulatory-edition-storage-2026-09-14"
export const rightsPolicySchema = z.strictObject({
  retainRaw: z.boolean(),
  displayText: z.boolean(),
  localSearch: z.boolean(),
  embeddings: z.boolean(),
  generatedAnswers: z.boolean(),
  exports: z.boolean(),
  sharing: z.boolean(),
  apiMcp: z.boolean(),
  attribution: z.string(),
  territories: z.array(z.string().min(1)).min(1),
  termination: z.enum(["retain", "restrict", "delete"]),
  externalStandardsIncluded: z.literal(false)
})
export const officialFederalRights = rightsPolicySchema.parse({
  retainRaw: true,
  displayText: true,
  localSearch: true,
  embeddings: true,
  generatedAnswers: true,
  exports: true,
  sharing: true,
  apiMcp: true,
  attribution: "Retain official publisher URL and edition provenance.",
  territories: ["worldwide"],
  termination: "retain",
  externalStandardsIncluded: false
})

export function assertRights(value: unknown, operation: "retainRaw" | "displayText" | "localSearch" | "apiMcp") {
  const policy = rightsPolicySchema.parse(value)
  if (!policy[operation]) {
    throw new Error(`rights_denied:${operation}`)
  }
  if (operation === "apiMcp" && !policy.territories.includes("worldwide")) {
    throw new Error("rights_denied:territory")
  }
  return policy
}

export type RegulatoryRecord = z.infer<typeof regulatoryRecordSchema>
export function provisionIdentity(record: RegulatoryRecord) {
  // Source-only structure stays namespaced. Licensed aliases require reviewed resolution before sharing identities.
  return record.identityBasis === "citation"
    ? record.nativeId
    : `source:${record.provenance.sourceId}:${record.nativeId}`
}
export function provisionContent(
  record: Pick<RegulatoryRecord, "contract" | "nodeKind" | "heading" | "text" | "blocks">
) {
  return digest(JSON.stringify([record.contract, record.nodeKind, record.heading, record.text, record.blocks, "en"]))
}

export const leaseSchema = z.strictObject({
  generationId: z.string().regex(/^[a-f0-9]{64}$/),
  token: z.uuid(),
  fence: z.int().positive()
})
export type RegulatoryLease = z.infer<typeof leaseSchema>
export const storageBatchRecords = 100
export const storageBatchBytes = 8 * 1024 * 1024
