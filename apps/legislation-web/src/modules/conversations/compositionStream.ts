import { applySpecPatch, pipeJsonRender, type Spec } from "@json-render/core"
import type { UIMessageChunk } from "ai"
import { z } from "zod"
import {
  answerCatalog,
  maximumPresentationBytes,
  presentationBlockSchema,
  presentationElementSchema,
  presentationComponentSchema,
  presentationCitation,
  presentationReferenceSchema,
  presentationReferences,
  presentationSpecSchema,
  type PresentationBlock,
  type PresentationReference
} from "./composition"
import { createCompositionDiagnostics, type CompositionDiagnostic } from "./compositionDiagnostics"
import type { EntityCard } from "./entityResults"
import { contentReferenceSchema, type PresentationContent } from "./presentationContent"

const maximumBlocks = 3
const maximumPatches = 16
const incompleteAnswerText = "Research ended before an answer was completed. Narrow the question and try again."
const unsafeKeys = new Set(["__proto__", "prototype", "constructor", ...Object.getOwnPropertyNames(Object.prototype)])
const rootSchema = presentationSpecSchema.shape.root.refine((root) => !unsafeKeys.has(root))
const patchSchema = z.union([
  z.strictObject({ op: z.enum(["add", "replace"]), path: z.literal("/root"), value: rootSchema }),
  z.strictObject({
    op: z.enum(["add", "replace"]),
    path: z.string().regex(/^\/elements\/[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
    value: presentationElementSchema
  })
])
const specChunkSchema = z.strictObject({
  type: z.literal("data-spec"),
  data: z.strictObject({ type: z.literal("patch"), patch: patchSchema })
})
const textChunkSchema = z.discriminatedUnion("type", [
  z.looseObject({ type: z.literal("text-start"), id: z.string() }),
  z.looseObject({ type: z.literal("text-delta"), id: z.string(), delta: z.string() }),
  z.looseObject({ type: z.literal("text-end"), id: z.string() })
])

type CompositionStreamOptions = {
  resolveRecord: (reference: PresentationReference) => EntityCard
  canonicalReference?: (reference: PresentationReference) => PresentationReference
  resolveContent?: (reference: { contentId: string }) => PresentationContent
  onInvalid?: (reason: string) => void
  onBlock?: (block: PresentationBlock) => void
  onComplete?: (answer: ComposedAnswer) => void
}
export type ComposedAnswer = { text: string; blocks: PresentationBlock[]; isInterrupted: boolean }
type PendingBlock = {
  blockId: string
  root: string
  component?: z.infer<typeof presentationComponentSchema>
  spec: Spec
  bytes: number
  patches: number
}
type TextChunk = Extract<UIMessageChunk, { type: "text-start" | "text-delta" | "text-end" }>

export function createCompositionStream(
  stream: ReadableStream<UIMessageChunk>,
  options: CompositionStreamOptions
): ReadableStream<UIMessageChunk> {
  const contexts = new WeakMap<UIMessageChunk, UIMessageChunk>()
  const boundaries = new WeakSet<UIMessageChunk>()
  const diagnostics = new WeakMap<UIMessageChunk, CompositionDiagnostic>()
  const inspect = createCompositionDiagnostics()
  const roots = new Set<string>()
  const records = new Set<string>()
  const textIds = new Set<string>()
  const clarificationToolCalls = new Set<string>()
  const encoder = new TextEncoder()
  const source = stream.getReader()
  let pending: PendingBlock | undefined
  let sourceText: TextChunk | undefined
  let textMetadata: TextChunk["providerMetadata"]
  let activeTextId: string | undefined
  let nextTextId = 0
  let interruption: string | undefined
  let isTerminated = false
  let isCancelled = false
  let isSourceClosed = false
  let hasCompleted = false
  let renderedText = ""
  let outgoingText: Extract<UIMessageChunk, { type: "text-delta" }> | undefined
  let receivedCharacters = 0
  let invalidFence = false
  let invalidBlockId = 0
  let hasCompletedClarification = false
  const renderedBlocks = new Map<string, PresentationBlock>()

  function flushText(controller: ReadableStreamDefaultController<UIMessageChunk>) {
    if (!outgoingText) {
      return false
    }
    controller.enqueue(outgoingText)
    outgoingText = undefined
    return true
  }

  function emitIncompleteAnswer(controller: ReadableStreamDefaultController<UIMessageChunk>) {
    if (
      interruption ||
      renderedText.trim() ||
      hasCompletedClarification ||
      [...renderedBlocks.values()].some((block) => block.state === "ready")
    ) {
      return
    }
    interruption = "Research ended without an answer."
    report(interruption)
    let id = "incomplete-answer"
    while (textIds.has(id)) {
      nextTextId += 1
      id = `incomplete-answer-${nextTextId}`
    }
    textIds.add(id)
    renderedText += incompleteAnswerText
    controller.enqueue({ type: "text-start", id })
    controller.enqueue({ type: "text-delta", id, delta: incompleteAnswerText })
    controller.enqueue({ type: "text-end", id })
  }

  function complete() {
    if (!hasCompleted) {
      hasCompleted = true
      options.onComplete?.({
        text: renderedText,
        blocks: [...renderedBlocks.values()],
        isInterrupted: isCancelled || Boolean(interruption)
      })
    }
  }

  function report(reason: string) {
    try {
      options.onInvalid?.(reason)
    } catch {
      return
    }
  }

  function emit(block: PresentationBlock, controller?: ReadableStreamDefaultController<UIMessageChunk>) {
    const validated = presentationBlockSchema.parse(block)
    renderedBlocks.set(validated.blockId, validated)
    const citation = presentationCitation(validated)
    if (citation) {
      renderedText += `\n[source](${citation})\n`
    }
    controller?.enqueue({ type: "data-presentation", id: validated.blockId, data: validated })
    try {
      options.onBlock?.(presentationBlockSchema.parse(validated))
    } catch {
      report("Presentation block callback failed.")
    }
  }

  function reject(reason: string, controller?: ReadableStreamDefaultController<UIMessageChunk>) {
    report(reason)
    if (pending) {
      const { blockId, component } = pending
      pending = undefined
      emit(
        { state: "error", blockId, component, reason: interruption || isCancelled ? "interrupted" : "presentation" },
        controller
      )
    }
  }

  function seal(controller: ReadableStreamDefaultController<UIMessageChunk>) {
    if (!pending) {
      return
    }
    if (interruption) {
      reject(interruption, controller)
      return
    }
    const block = pending
    pending = undefined
    const spec = presentationSpecSchema.safeParse(block.spec)
    if (!spec.success) {
      report("Incomplete presentation block.")
      emit({ state: "error", blockId: block.blockId, component: block.component, reason: "presentation" }, controller)
      return
    }
    const references = presentationReferences(spec.data)
    const element = spec.data.elements[spec.data.root]
    const contentReference = element && contentReferenceSchema.safeParse(element.props)
    if (references.length === 0 && !contentReference?.success) {
      report("Missing presentation reference.")
      emit({ state: "error", blockId: block.blockId, component: block.component, reason: "presentation" }, controller)
      return
    }
    let resolving = false
    try {
      if (!answerCatalog.validate(spec.data).success) {
        throw new Error("Invalid catalog element.")
      }
      resolving = true
      if (options.canonicalReference) {
        for (const reference of references) {
          reference.resultId = options.canonicalReference(reference).resultId
        }
      }
      let content: PresentationContent | undefined
      if (contentReference?.success) {
        if (!options.resolveContent) {
          throw new Error("Content resolver is unavailable")
        }
        content = options.resolveContent(contentReference.data)
      }
      const resolvedRecords = references.map((reference) =>
        options.resolveRecord(presentationReferenceSchema.parse(reference))
      )
      resolving = false
      const ready = presentationBlockSchema.parse({
        state: "ready",
        blockId: block.blockId,
        spec: spec.data,
        records: resolvedRecords,
        content
      })
      if (ready.state !== "ready") {
        return
      }
      const recordKeys = ready.records.map((record) => JSON.stringify([record.kind, record.id]))
      if (ready.content) {
        recordKeys.push(
          JSON.stringify([
            ready.content.kind,
            ready.content.kind === "evidence" ? ready.content.evidence.id : ready.content.id
          ])
        )
      }
      if (recordKeys.some((key) => records.has(key))) {
        report("Duplicate presentation record.")
        emit({ state: "error", blockId: block.blockId, component: block.component, reason: "presentation" }, controller)
        return
      }
      recordKeys.forEach((key) => records.add(key))
      emit(ready, controller)
    } catch {
      report("Presentation record could not be resolved or validated.")
      emit(
        {
          state: "error",
          blockId: block.blockId,
          component: block.component,
          reason: resolving ? "records" : "presentation"
        },
        controller
      )
    }
  }

  function acceptPatch(chunk: UIMessageChunk, controller: ReadableStreamDefaultController<UIMessageChunk>) {
    if (invalidFence) {
      return
    }
    if (isTerminated) {
      report("Presentation patch arrived after termination.")
      return
    }
    const identity = z
      .object({
        data: z.object({
          patch: z.object({
            path: z.string(),
            value: z.object({ type: presentationComponentSchema })
          })
        })
      })
      .safeParse(chunk)
    if (pending && identity.success && identity.data.data.patch.path === `/elements/${pending.root}`) {
      pending.component = identity.data.data.patch.value.type
    }
    const parsed = specChunkSchema.safeParse(chunk)
    if (!parsed.success) {
      reject("Invalid or unsupported presentation patch.", controller)
      return
    }
    const patch = parsed.data.data.patch
    if (patch.path === "/root" && typeof patch.value === "string") {
      if (pending?.root === patch.value) {
        reject("Duplicate presentation root.", controller)
        return
      }
      seal(controller)
      if (roots.has(patch.value)) {
        report("Duplicate presentation root.")
        return
      }
      if (renderedBlocks.size >= maximumBlocks) {
        report("Presentation block limit exceeded.")
        return
      }
      roots.add(patch.value)
      pending = {
        blockId: `presentation-${patch.value}`,
        root: patch.value,
        spec: { root: "", elements: {} },
        bytes: 0,
        patches: 0
      }
      emit({ state: "pending", blockId: pending.blockId }, controller)
    } else if (!pending || patch.path !== `/elements/${pending.root}`) {
      reject("Presentation element does not belong to an open root.", controller)
      return
    }
    if (!pending) {
      return
    }
    pending.bytes += encoder.encode(JSON.stringify(patch)).byteLength
    pending.patches += 1
    if (pending.bytes > maximumPresentationBytes || pending.patches > maximumPatches) {
      reject("Presentation block size limit exceeded.", controller)
      return
    }
    applySpecPatch(pending.spec, patch)
  }

  function enqueueDiagnostic(
    diagnostic: CompositionDiagnostic,
    controller: ReadableStreamDefaultController<UIMessageChunk>
  ) {
    if (diagnostic.type === "invalid") {
      controller.enqueue({ type: "text-end", id: "composition-flush" })
    }
    const marker: UIMessageChunk = { type: "data-composition-diagnostic", data: null }
    diagnostics.set(marker, diagnostic)
    controller.enqueue(marker)
  }

  function enqueueSource(chunk: UIMessageChunk, controller: ReadableStreamDefaultController<UIMessageChunk>) {
    const marker: UIMessageChunk = { type: "data-composition-context", data: null }
    contexts.set(marker, chunk)
    controller.enqueue(marker)
    if (chunk.type === "data-presentation" || chunk.type === "data-spec") {
      return
    }
    if (chunk.type === "text-start" || chunk.type === "text-delta" || chunk.type === "text-end") {
      if (!textChunkSchema.safeParse(chunk).success) {
        return
      }
    } else {
      controller.enqueue({ type: "text-end", id: "composition-flush" })
    }
    if (chunk.type === "text-delta") {
      let start = 0
      for (const event of inspect.push(chunk.delta)) {
        if (event.end > start) {
          controller.enqueue({ ...chunk, delta: chunk.delta.slice(start, event.end) })
        }
        start = event.end
        enqueueDiagnostic(event.diagnostic, controller)
      }
      if (start < chunk.delta.length) {
        controller.enqueue({ ...chunk, delta: chunk.delta.slice(start) })
      }
    } else {
      if (chunk.type === "finish" || chunk.type === "abort" || chunk.type === "error") {
        inspect.flush(true).forEach((diagnostic) => enqueueDiagnostic(diagnostic, controller))
      }
      controller.enqueue(chunk)
      if (chunk.type === "text-end") {
        inspect.flush().forEach((diagnostic) => enqueueDiagnostic(diagnostic, controller))
      }
    }
    const boundary: UIMessageChunk = { type: "data-composition-boundary", data: null }
    boundaries.add(boundary)
    controller.enqueue(boundary)
  }

  const normalized = new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      if (isSourceClosed) {
        controller.close()
        return
      }
      try {
        const next = await source.read()
        if (isCancelled) {
          return
        }
        if (next.done) {
          isSourceClosed = true
          source.releaseLock()
          controller.enqueue({ type: "text-end", id: "composition-flush" })
          inspect.flush(true).forEach((diagnostic) => enqueueDiagnostic(diagnostic, controller))
          return
        }
        if (next.value.type === "text-delta") {
          receivedCharacters += next.value.delta.length
          if (receivedCharacters > 256000) {
            throw new Error("Composition input limit exceeded")
          }
        }
        enqueueSource(next.value, controller)
      } catch {
        if (isCancelled) {
          return
        }
        isSourceClosed = true
        source.releaseLock()
        enqueueSource({ type: "error", errorText: "The response stream ended unexpectedly." }, controller)
      }
    },
    async cancel(reason: unknown) {
      isCancelled = true
      if (!isSourceClosed) {
        isSourceClosed = true
        try {
          await source.cancel(reason)
        } finally {
          source.releaseLock()
        }
      }
    }
  })
  const reader = pipeJsonRender(normalized).getReader()

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        while (!isCancelled && (controller.desiredSize ?? 0) > 0) {
          const next = await reader.read()
          if (isCancelled) {
            return
          }
          if (next.done) {
            flushText(controller)
            seal(controller)
            emitIncompleteAnswer(controller)
            complete()
            controller.close()
            reader.releaseLock()
            return
          }
          const chunk = next.value
          if (boundaries.has(chunk)) {
            if (flushText(controller)) {
              return
            }
            continue
          }
          if (chunk.type !== "text-delta") {
            flushText(controller)
          }
          const diagnostic = diagnostics.get(chunk)
          if (diagnostic) {
            if (diagnostic.type === "closed") {
              invalidFence = false
            } else {
              invalidFence = true
              if (pending) {
                reject(diagnostic.reason, controller)
              } else {
                report(diagnostic.reason)
                if (renderedBlocks.size < maximumBlocks) {
                  invalidBlockId += 1
                  emit(
                    { state: "error", blockId: `invalid-presentation-${invalidBlockId}`, reason: "presentation" },
                    controller
                  )
                }
              }
            }
            continue
          }
          const context = contexts.get(chunk)
          if (context) {
            if (
              (context.type === "tool-input-start" || context.type === "tool-input-available") &&
              context.toolName === "ask_clarification"
            ) {
              clarificationToolCalls.add(context.toolCallId)
            } else if (context.type === "tool-output-available" && clarificationToolCalls.has(context.toolCallId)) {
              hasCompletedClarification = true
            }
            if (context.type === "text-start" || context.type === "text-delta" || context.type === "text-end") {
              if (!textChunkSchema.safeParse(context).success) {
                reject("Invalid presentation text chunk.", controller)
                continue
              }
              sourceText = context
              if (context.type !== "text-end") {
                textMetadata = context.providerMetadata
              }
            } else if (context.type === "abort" || context.type === "error") {
              interruption = "Presentation interrupted before completion."
            } else if (context.type === "finish" && context.finishReason === "error") {
              interruption = "Presentation interrupted before completion."
            } else if (context.type === "data-presentation" || context.type === "data-spec") {
              report("Incoming presentation data is not accepted.")
            }
            continue
          }
          if (chunk.type === "data-spec") {
            acceptPatch(chunk, controller)
            continue
          }
          if (chunk.type === "data-presentation") {
            report("Incoming presentation data is not accepted.")
            continue
          }
          if (chunk.type === "text-start" || chunk.type === "text-delta" || chunk.type === "text-end") {
            const parsed = textChunkSchema.safeParse(chunk)
            if (!parsed.success) {
              reject("Invalid presentation text chunk.", controller)
              continue
            }
            if (chunk.type === "text-start") {
              let id = chunk.id
              while (textIds.has(id)) {
                nextTextId += 1
                id = `composition-text-${nextTextId}`
              }
              textIds.add(id)
              activeTextId = id
            }
            if (chunk.type === "text-delta" && chunk.delta.trim()) {
              seal(controller)
            }
            if (chunk.type === "text-delta") {
              renderedText += chunk.delta
            }
            let providerMetadata = chunk.providerMetadata ?? textMetadata
            if (chunk.type === "text-end" && sourceText?.type === "text-end") {
              providerMetadata = sourceText.providerMetadata
            }
            const id = activeTextId ?? chunk.id
            if (chunk.type === "text-delta") {
              outgoingText = { ...chunk, id, providerMetadata, delta: (outgoingText?.delta ?? "") + chunk.delta }
              continue
            }
            controller.enqueue({ ...chunk, id, providerMetadata })
            if (chunk.type === "text-end") {
              activeTextId = undefined
            }
            return
          }
          if (chunk.type === "finish" || chunk.type === "abort" || chunk.type === "error") {
            seal(controller)
            if (chunk.type === "finish") {
              emitIncompleteAnswer(controller)
            }
            isTerminated = true
          }
          controller.enqueue(chunk)
          return
        }
      } catch {
        if (isCancelled) {
          return
        }
        interruption = "Presentation stream failed."
        reject(interruption, controller)
        complete()
        controller.enqueue({ type: "error", errorText: "The response stream ended unexpectedly." })
        controller.close()
        await reader.cancel().catch(() => undefined)
        reader.releaseLock()
      }
    },
    async cancel(reason: unknown) {
      isCancelled = true
      reject("Presentation stream cancelled.")
      complete()
      try {
        await reader.cancel(reason)
      } finally {
        reader.releaseLock()
      }
    }
  })
}
