import { z } from "zod"

const checkpoint = z.object({
  afterBillId: z.string(),
  pendingEmbeddingBillIds: z.array(z.string()).max(100).default([])
})

export function readStateContentCheckpoint(value: unknown, prefix: string) {
  const result = checkpoint.parse(value ?? { afterBillId: "" })
  if ([result.afterBillId, ...result.pendingEmbeddingBillIds].some((id) => id && !id.startsWith(prefix))) {
    throw new Error("Content checkpoint crossed its state/session scope")
  }
  if (
    result.pendingEmbeddingBillIds.some((id) => !id) ||
    new Set(result.pendingEmbeddingBillIds).size !== result.pendingEmbeddingBillIds.length
  ) {
    throw new Error("Content checkpoint contains empty or duplicate pending bill IDs")
  }
  return result
}

export function prioritizeStateContentBills(priority: readonly string[], pending: readonly string[], prefix: string) {
  const merged = [...new Set([...priority, ...pending])]
  return readStateContentCheckpoint({ afterBillId: "", pendingEmbeddingBillIds: merged }, prefix)
    .pendingEmbeddingBillIds
}

export function advanceStateContentCheckpoint(input: {
  previous: string
  discovered: readonly string[]
  discoveryLimit: number
  pendingEmbeddingBillIds: string[]
}) {
  const reachedEnd = input.discoveryLimit > 0 && input.discovered.length < input.discoveryLimit
  return {
    afterBillId: reachedEnd ? "" : (input.discovered.at(-1) ?? input.previous),
    pendingEmbeddingBillIds: input.pendingEmbeddingBillIds,
    scanRoundComplete: reachedEnd && input.pendingEmbeddingBillIds.length === 0
  }
}
