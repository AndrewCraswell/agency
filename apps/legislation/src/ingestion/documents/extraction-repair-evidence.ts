import { z } from "zod"

export const extractionRepairEvidence = z.strictObject({
  documentId: z.string().min(1),
  billId: z.string().min(1),
  sourceUrl: z.url(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  previousTextHash: z.string().regex(/^[a-f0-9]{32}$/)
})
