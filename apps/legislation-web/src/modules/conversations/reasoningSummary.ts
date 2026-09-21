import type { TextStreamPart, ToolSet } from "ai"
import { z } from "zod"

const reasoningSummaryDetailSchema = z.object({
  type: z.literal("reasoning.summary"),
  summary: z.string()
})

const reasoningMetadataSchema = z.object({
  openrouter: z.object({
    reasoning_details: z.array(z.unknown())
  })
})

function summaryText(part: Extract<TextStreamPart<ToolSet>, { type: "reasoning-end" }>) {
  const metadata = reasoningMetadataSchema.safeParse(part.providerMetadata)
  if (!metadata.success) {
    return undefined
  }
  const text = metadata.data.openrouter.reasoning_details
    .flatMap((detail) => {
      const summary = reasoningSummaryDetailSchema.safeParse(detail)
      return summary.success ? [summary.data.summary] : []
    })
    .join("")
    .trim()
  return text || undefined
}

export function exposeReasoningSummaries<TOOLS extends ToolSet>(
  stream: ReadableStream<TextStreamPart<TOOLS>>
): ReadableStream<TextStreamPart<TOOLS>> {
  let reasoningId: string | undefined
  let buffered: TextStreamPart<TOOLS>[] = []

  return stream.pipeThrough(
    new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "reasoning-start") {
          for (const bufferedPart of buffered) {
            controller.enqueue(bufferedPart)
          }
          reasoningId = part.id
          buffered = []
          return
        }
        if (part.type === "reasoning-delta" || part.type === "reasoning-file") {
          return
        }
        if (part.type === "reasoning-end") {
          const text = summaryText(part)
          if (text) {
            const id = reasoningId ?? part.id
            controller.enqueue({ type: "reasoning-start", id })
            controller.enqueue({ type: "reasoning-delta", id, text })
            controller.enqueue({ type: "reasoning-end", id })
          }
          for (const bufferedPart of buffered) {
            controller.enqueue(bufferedPart)
          }
          reasoningId = undefined
          buffered = []
          return
        }
        if (reasoningId !== undefined) {
          buffered.push(part)
          return
        }
        controller.enqueue(part)
      },
      flush(controller) {
        for (const part of buffered) {
          controller.enqueue(part)
        }
      }
    })
  )
}
