import { createHash } from "node:crypto"
import { researchResultFragmentSchema } from "@repo/legislation-core/research/result-pages"
import { z } from "zod"
import { ResearchFailure } from "./researchFailure"

type JsonValue = z.infer<ReturnType<typeof z.json>>
type Assembly = { text: string; totalCharacters: number }

// Owned by one research run, or one result-store page load. No independent persistence or lifetime.
export function createResearchFragments() {
  const assemblies = new Map<string, Assembly>()
  return {
    read(tool: string, data: JsonValue, preview = false) {
      const parsed = researchResultFragmentSchema.safeParse(data)
      if (!parsed.success) {
        if (data && typeof data === "object" && "partialResult" in data) {
          throw new ResearchFailure("invalid_response", crypto.randomUUID())
        }
        return { projection: data }
      }
      const fragment = parsed.data.partialResult
      const key = `${tool}:${fragment.snapshot}`
      const previous = assemblies.get(key)
      const end = fragment.textOffset + fragment.text.length
      const isComplete = fragment.nextTextOffset === null
      if (
        fragment.sourceTool !== tool ||
        end > fragment.totalCharacters ||
        (isComplete ? end !== fragment.totalCharacters : fragment.nextTextOffset !== end || !parsed.data.nextCursor) ||
        (previous && previous.totalCharacters !== fragment.totalCharacters) ||
        (!previous && fragment.textOffset !== 0) ||
        (previous && fragment.textOffset > previous.text.length) ||
        (previous &&
          fragment.textOffset < previous.text.length &&
          previous.text.slice(fragment.textOffset, end) !== fragment.text)
      ) {
        throw new ResearchFailure("invalid_response", crypto.randomUUID())
      }
      const text = previous && end <= previous.text.length ? previous.text : (previous?.text ?? "") + fragment.text
      let projection: JsonValue | undefined
      if (isComplete) {
        if (createHash("sha256").update(text).digest("base64url") !== fragment.snapshot) {
          throw new ResearchFailure("invalid_response", crypto.randomUUID())
        }
        try {
          projection = z.json().parse(JSON.parse(text))
        } catch {
          throw new ResearchFailure("invalid_response", crypto.randomUUID())
        }
      }
      if (!preview) {
        assemblies.set(key, { text, totalCharacters: fragment.totalCharacters })
      }
      return {
        projection,
        assembly: {
          status: isComplete ? ("complete" as const) : ("pending" as const),
          snapshot: fragment.snapshot,
          receivedCharacters: Math.min(text.length, end),
          totalCharacters: fragment.totalCharacters
        }
      }
    }
  }
}

export async function readCompleteResearchResult(
  tool: string,
  initial: unknown,
  load: (cursor: string, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal
) {
  const fragments = createResearchFragments()
  let data = z.json().parse(initial)
  for (;;) {
    signal.throwIfAborted()
    const result = fragments.read(tool, data)
    if (result.projection !== undefined) {
      return result.projection
    }
    const page = researchResultFragmentSchema.parse(data)
    if (!page.nextCursor) {
      throw new ResearchFailure("invalid_response", crypto.randomUUID())
    }
    const currentOffset = page.partialResult.textOffset
    data = z.json().parse(await load(page.nextCursor, signal))
    const next = researchResultFragmentSchema.parse(data)
    if (next.partialResult.snapshot !== page.partialResult.snapshot || next.partialResult.textOffset <= currentOffset) {
      throw new ResearchFailure("invalid_response", crypto.randomUUID())
    }
  }
}
