import { pipeJsonRender } from "@json-render/core"
import { createUIMessageStream, readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai"
import { describe, expect, it, vi } from "vitest"
import { presentationBlockSchema, type PresentationBlock, type PresentationReference } from "./composition"
import { createCompositionStream } from "./compositionStream"
import type { EntityCard } from "./entityResults"

const resultId = "11111111-1111-4111-8111-111111111111"
const otherResultId = "22222222-2222-4222-8222-222222222222"

function record(id: string, kind: EntityCard["kind"] = "bill"): EntityCard {
  return { id, kind, title: `Retrieved ${id}`, sourceUrl: null, fields: [], tallies: [] }
}

function rootPatch(root = "first") {
  return { op: "add", path: "/root", value: root }
}

function elementPatch(root = "first", recordId = "bill-1", sourceResultId = resultId) {
  return {
    op: "add",
    path: `/elements/${root}`,
    value: { type: "RecordCard", props: { resultId: sourceResultId, recordId }, children: [] }
  }
}

function fence(patches: unknown[]) {
  return `\`\`\`spec\n${patches.map((patch) => JSON.stringify(patch)).join("\n")}\n\`\`\`\n`
}

function textStream(deltas: string[], ending: UIMessageChunk[] = [{ type: "finish", finishReason: "stop" }]) {
  return createUIMessageStream({
    execute({ writer }) {
      writer.write({ type: "start", messageId: "answer" })
      writer.write({ type: "text-start", id: "original" })
      for (const delta of deltas) {
        writer.write({ type: "text-delta", id: "original", delta })
      }
      writer.write({ type: "text-end", id: "original" })
      for (const chunk of ending) {
        writer.write(chunk)
      }
    }
  })
}

function chunkStream(chunks: UIMessageChunk[]) {
  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    }
  })
}

async function collect<Chunk>(stream: ReadableStream<Chunk>) {
  const chunks: Chunk[] = []
  const reader = stream.getReader()
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        return chunks
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
}

function blocks(chunks: UIMessageChunk[]) {
  return chunks.flatMap((chunk) => {
    if (chunk.type !== "data-presentation") {
      return []
    }
    const block = presentationBlockSchema.parse(chunk.data)
    expect(chunk.id).toBe(block.blockId)
    return [block]
  })
}

function text(chunks: UIMessageChunk[]) {
  return chunks.flatMap((chunk) => (chunk.type === "text-delta" ? [chunk.delta] : [])).join("")
}

function resolver(reference: PresentationReference) {
  return record(reference.recordId)
}

async function compose(content: string, resolveRecord = resolver) {
  const onInvalid = vi.fn<(reason: string) => void>()
  const onBlock = vi.fn<(block: PresentationBlock) => void>()
  const resolve = vi.fn<typeof resolveRecord>(resolveRecord)
  const chunks = await collect(
    createCompositionStream(textStream([content]), { resolveRecord: resolve, onInvalid, onBlock })
  )
  expect(chunks.some((chunk) => chunk.type === "data-spec" || chunk.type === "data-composition-context")).toBe(false)
  return { chunks, onInvalid, onBlock, resolve }
}

describe("createCompositionStream", () => {
  it("replaces turn-local handles with canonical IDs before emitting a ready block", async () => {
    const chunks = await collect(
      createCompositionStream(textStream([fence([rootPatch(), elementPatch("first", "bill-1", "r1")])]), {
        canonicalReference: (reference) => ({ ...reference, resultId }),
        resolveRecord: (reference) => {
          expect(reference.resultId).toBe(resultId)
          return record(reference.recordId)
        }
      })
    )
    const ready = blocks(chunks).find((block) => block.state === "ready")
    expect(ready?.state).toBe("ready")
    expect(JSON.stringify(ready)).toContain(resultId)
    expect(JSON.stringify(ready)).not.toContain('"r1"')
  })
  it.each(["RecordGroup", "CompactRecordGroup"])(
    "resolves mixed %s records using each exact result reference",
    async (type) => {
      const patch = {
        op: "add",
        path: "/elements/first",
        value: {
          type,
          props: {
            records: [
              { resultId, recordId: "bill-1" },
              { resultId: otherResultId, recordId: "vote-2" }
            ]
          },
          children: []
        }
      }
      const result = await compose(fence([rootPatch(), patch]), (reference) =>
        record(reference.recordId, reference.recordId === "vote-2" ? "vote" : "bill")
      )
      expect(blocks(result.chunks).at(-1)).toMatchObject({
        state: "ready",
        records: [{ id: "bill-1" }, { id: "vote-2", kind: "vote" }]
      })
      expect(result.resolve.mock.calls).toEqual([
        [{ resultId, recordId: "bill-1" }],
        [{ resultId: otherResultId, recordId: "vote-2" }]
      ])
      const failed = await compose(fence([rootPatch(), patch]), (reference) => {
        if (reference.recordId === "vote-2") {
          throw new Error("Private owner")
        }
        return record(reference.recordId)
      })
      expect(blocks(failed.chunks).at(-1)).toMatchObject({ state: "error", reason: "records" })
      expect(JSON.stringify(failed.chunks)).not.toContain("Private owner")
    }
  )

  it("resolves compact cards through the same record ownership and deduplication rules", async () => {
    const patch = elementPatch()
    const compact = { ...patch, value: { ...patch.value, type: "CompactRecordCard" } }
    const result = await compose(fence([rootPatch(), compact]))
    expect(blocks(result.chunks).at(-1)).toMatchObject({ state: "ready", records: [record("bill-1")] })
    const duplicate = await compose(fence([rootPatch(), compact, rootPatch("second"), elementPatch("second")]))
    expect(blocks(duplicate.chunks).map((block) => block.state)).toEqual(["pending", "ready", "pending", "error"])
  })

  it("resolves selected passage content without trusting model-authored quote text", async () => {
    const contentId = "33333333-3333-4333-8333-333333333333"
    const source = {
      id: contentId,
      kind: "evidence" as const,
      evidence: {
        id: "source-one",
        title: "Published passage",
        origin: "canonical" as const,
        sourceUrl: null,
        content: { state: "available" as const, quote: "Exact source text." }
      }
    }
    const patch = {
      op: "add",
      path: "/elements/first",
      value: { type: "PassageQuote", props: { contentId }, children: [] }
    }
    const resolveContent = vi.fn<() => typeof source>(() => source)
    const chunks = await collect(
      createCompositionStream(textStream([`Before\n${fence([rootPatch(), patch])}After`]), {
        resolveRecord: resolver,
        resolveContent
      })
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(blocks(chunks)[1]).toMatchObject({ records: [], content: source })
    expect(resolveContent).toHaveBeenCalledWith({ contentId })
    expect(text(chunks)).toBe("Before\nAfter")
    const invalid = await compose(
      fence([rootPatch(), { ...patch, value: { ...patch.value, props: { contentId, quote: "Invented" } } }])
    )
    expect(blocks(invalid.chunks).at(-1)?.state).toBe("error")
  })

  it("delivers prose deltas before the upstream text ends", async () => {
    const input = new TransformStream<UIMessageChunk, UIMessageChunk>()
    const writer = input.writable.getWriter()
    const received: UIMessageChunk[] = []
    const finished = createCompositionStream(input.readable, { resolveRecord: resolver }).pipeTo(
      new WritableStream<UIMessageChunk>({
        write(chunk) {
          received.push(chunk)
        }
      })
    )
    try {
      await writer.write({ type: "start", messageId: "answer" })
      await writer.write({ type: "text-start", id: "original" })
      await writer.write({ type: "text-delta", id: "original", delta: "Here is" })
      await vi.waitFor(() => expect(text(received)).toBe("Here is"))
      await writer.write({ type: "text-delta", id: "original", delta: " an education update." })
      await vi.waitFor(() => expect(text(received)).toBe("Here is an education update."))
      expect(received.filter((chunk) => chunk.type === "text-delta").map((chunk) => chunk.delta)).toEqual([
        "Here is",
        " an education update."
      ])
      expect(received.some((chunk) => chunk.type === "data-composition-boundary")).toBe(false)
    } finally {
      await writer.close()
      await finished
    }
  })

  it("does not expand a prose burst into one client update per character", async () => {
    const content = "Retrieved records remain grounded. ".repeat(50) + "中文 cafe\u0301 😀."
    const { chunks } = await compose(content)
    expect(text(chunks)).toBe(content)
    expect(chunks.filter((chunk) => chunk.type === "text-delta")).toHaveLength(1)
  })

  it("rejects the removed bill-comparison component without resolving records", async () => {
    const result = await compose(
      fence([
        rootPatch(),
        { op: "add", path: "/elements/first", value: { type: "BillComparison", props: {}, children: [] } }
      ])
    )
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
  })

  it("streams a selected compact bill page between prose using its trusted content ID", async () => {
    const contentId = "33333333-3333-4333-8333-333333333333"
    const page = {
      id: resultId,
      kind: "bill" as const,
      presentation: "list" as const,
      page: 0,
      items: [record("bill-1"), record("bill-2")],
      start: 1,
      end: 2,
      hasNext: false,
      hasPrevious: false,
      warnings: []
    }
    const source = { id: contentId, kind: "result-list" as const, page }
    const patch = {
      op: "add",
      path: "/elements/first",
      value: { type: "ResultList", props: { contentId }, children: [] }
    }
    const resolveContent = vi.fn<() => typeof source>(() => source)
    const chunks = await collect(
      createCompositionStream(textStream([...`Before\n${fence([rootPatch(), patch])}After`]), {
        resolveRecord: resolver,
        resolveContent
      })
    )
    expect(blocks(chunks).at(-1)).toMatchObject({ state: "ready", records: [], content: source })
    expect(resolveContent).toHaveBeenCalledWith({ contentId })
    expect(text(chunks)).toBe("Before\nAfter")
  })

  it("captures displayed prose and final block states separately from raw spec text", async () => {
    const onComplete = vi.fn<NonNullable<Parameters<typeof createCompositionStream>[1]["onComplete"]>>()
    await collect(
      createCompositionStream(textStream([`Before\n${fence([rootPatch(), elementPatch()])}After`]), {
        resolveRecord: resolver,
        onComplete
      })
    )
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]?.[0]).toMatchObject({
      text: "Before\nAfter",
      isInterrupted: false,
      blocks: [{ state: "ready", records: [record("bill-1")] }]
    })
  })

  it("uses the installed transform's patch shape and synthetic text boundaries", async () => {
    const chunks = await collect(pipeJsonRender(textStream([`Before\n${fence([rootPatch(), elementPatch()])}After`])))
    expect(chunks.filter((chunk) => chunk.type === "data-spec")).toEqual([
      { type: "data-spec", data: { type: "patch", patch: rootPatch() } },
      { type: "data-spec", data: { type: "patch", patch: elementPatch() } }
    ])
    expect(chunks.filter((chunk) => chunk.type === "text-start")).toHaveLength(2)
    expect(text(chunks)).toBe("Before\nAfter")
  })

  it("updates one stable block in the real AI SDK message and preserves prose order", async () => {
    const content = `Before\n${fence([rootPatch(), elementPatch()])}After`
    const onBlock = vi.fn<(block: PresentationBlock) => void>()
    const messages = readUIMessageStream({
      stream: createCompositionStream(textStream([content]), { resolveRecord: resolver, onBlock }),
      terminateOnError: true
    })
    let finalMessage: UIMessage | undefined
    for await (const message of messages) {
      finalMessage = message
    }
    expect(finalMessage?.parts.map((part) => part.type)).toEqual(["text", "data-presentation", "text"])
    expect(finalMessage?.parts[0]).toMatchObject({ text: "Before\n" })
    expect(finalMessage?.parts[1]).toMatchObject({
      id: "presentation-first",
      data: { state: "ready", records: [record("bill-1")] }
    })
    expect(finalMessage?.parts[2]).toMatchObject({ text: "After" })
    expect(onBlock.mock.calls.map(([block]) => block.state)).toEqual(["pending", "ready"])
  })

  it("handles fence and JSON tokens split into single-character source chunks", async () => {
    const content = `Before\n${fence([rootPatch(), elementPatch()])}After`
    const chunks = await collect(createCompositionStream(textStream([...content]), { resolveRecord: resolver }))
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(text(chunks)).toBe("Before\nAfter")
  })

  it("leaves prose-only messages valid without calling the resolver", async () => {
    const result = await compose("Plain text.\n\nMore text and `inline code`.\n")
    expect(text(result.chunks)).toBe("Plain text.\n\nMore text and `inline code`.\n")
    expect(blocks(result.chunks)).toEqual([])
    expect(result.resolve).not.toHaveBeenCalled()
    expect(result.onInvalid).not.toHaveBeenCalled()
  })

  it.each(["", "\n", "Between\n"])("keeps two independently rooted groups with separator %j", async (separator) => {
    const result = await compose(
      `Before\n${fence([rootPatch(), elementPatch()])}${separator}${fence([
        rootPatch("second"),
        elementPatch("second", "bill-2")
      ])}After`
    )
    expect(blocks(result.chunks).map((block) => [block.blockId, block.state])).toEqual([
      ["presentation-first", "pending"],
      ["presentation-first", "ready"],
      ["presentation-second", "pending"],
      ["presentation-second", "ready"]
    ])
    expect(text(result.chunks)).toBe(`Before\n${separator}After`)
  })

  it("accepts consecutive root groups within one fence", async () => {
    const result = await compose(
      fence([rootPatch(), elementPatch(), rootPatch("second"), elementPatch("second", "bill-2")])
    )
    expect(blocks(result.chunks).filter((block) => block.state === "ready")).toHaveLength(2)
  })

  it("does not seal at text-end/start between root and element patches", async () => {
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "text-start", id: "first-text" },
          { type: "text-delta", id: "first-text", delta: `\`\`\`spec\n${JSON.stringify(rootPatch())}\n` },
          { type: "text-end", id: "first-text" },
          { type: "text-start", id: "second-text" },
          { type: "text-delta", id: "second-text", delta: `${JSON.stringify(elementPatch())}\n\`\`\`\nAfter` },
          { type: "text-end", id: "second-text" },
          { type: "finish", finishReason: "stop" }
        ]),
        { resolveRecord: resolver }
      )
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(text(chunks)).toBe("After")
  })

  it("seals a completed block before prose and never mutates it afterward", async () => {
    const result = await compose(
      `${fence([rootPatch(), elementPatch()])}Sealed\n${fence([
        elementPatch("first", "bill-2"),
        rootPatch(),
        elementPatch("first", "bill-3")
      ])}Done`
    )
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(blocks(result.chunks)[1]).toMatchObject({ records: [record("bill-1")] })
    expect(result.resolve).toHaveBeenCalledTimes(1)
    expect(result.onInvalid).toHaveBeenCalled()
  })

  it("deduplicates records across result sets using resolved kind and record ID", async () => {
    const result = await compose(
      fence([rootPatch(), elementPatch(), rootPatch("second"), elementPatch("second", "bill-1", otherResultId)])
    )
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "ready", "pending", "error"])
    expect(result.onInvalid).toHaveBeenCalledWith("Duplicate presentation record.")
  })

  it("does not deduplicate matching IDs belonging to different entity kinds", async () => {
    const result = await compose(
      fence([rootPatch(), elementPatch(), rootPatch("second"), elementPatch("second", "bill-1", otherResultId)]),
      (reference) => record(reference.recordId, reference.resultId === resultId ? "bill" : "person")
    )
    expect(blocks(result.chunks).filter((block) => block.state === "ready")).toHaveLength(2)
  })

  it("limits the answer to three stable blocks including failed blocks", async () => {
    const result = await compose(
      fence(["first", "second", "third", "fourth"].flatMap((root) => [rootPatch(root), elementPatch(root, root)]))
    )
    expect(blocks(result.chunks).filter((block) => block.state === "pending")).toHaveLength(3)
    expect(blocks(result.chunks).filter((block) => block.state === "ready")).toHaveLength(3)
    expect(result.resolve).toHaveBeenCalledTimes(3)
    expect(result.onInvalid).toHaveBeenCalledWith("Presentation block limit exceeded.")
  })

  it.each([
    { resultId: "invented", recordId: "bill-1" },
    { resultId, recordId: "" },
    { resultId, recordId: " " },
    { resultId, recordId: "bill\u0000private" },
    { resultId, recordId: "constructor" },
    { resultId, recordId: "x".repeat(513) },
    { resultId, recordId: { $state: "/record" } },
    { resultId, recordId: "bill-1", title: "Invented title" }
  ])("rejects malformed or unsafe references %j", async (props) => {
    const result = await compose(
      fence([rootPatch(), { ...elementPatch(), value: { type: "RecordCard", props, children: [] } }])
    )
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
  })

  it.each<Record<string, unknown>>([
    { children: ["child"] },
    { on: { press: { action: "navigate" } } },
    { visible: true },
    { state: { selected: true } },
    { actions: {} },
    { slots: {} },
    { type: "Unknown" },
    { constructor: { prototype: { polluted: true } } }
  ])("rejects unsupported element fields %j", async (extra) => {
    const patch = elementPatch()
    const result = await compose(fence([rootPatch(), { ...patch, value: { ...patch.value, ...extra } }]))
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
  })

  it.each([
    { op: "add", path: "/state", value: {} },
    { op: "add", path: "/actions", value: {} },
    { op: "add", path: "/elements/other", value: elementPatch().value },
    { op: "add", path: "/elements/first/props/recordId", value: "bill-2" },
    { op: "add", path: "/elements/__proto__/polluted", value: true },
    { op: "add", path: "/elements/constructor/prototype/polluted", value: true },
    { op: "add", path: "/elements/first~1props", value: elementPatch().value },
    { op: "remove", path: "/root" },
    { op: "move", path: "/root", from: "/state" },
    { op: "copy", path: "/root", from: "/state" },
    { op: "test", path: "/root", value: "first" },
    { op: "add", path: "/root", value: "second", from: "/state" }
  ])("rejects arbitrary patches before applying them %j", async (patch) => {
    const result = await compose(fence([rootPatch(), elementPatch(), patch]))
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false)
  })

  it.each(["__proto__", "constructor", "prototype", "toString", "bad/root", "a".repeat(65)])(
    "rejects unsafe root %s without allocating a block",
    async (root) => {
      const result = await compose(fence([rootPatch(root), elementPatch(root)]))
      expect(blocks(result.chunks)).toEqual([])
      expect(result.resolve).not.toHaveBeenCalled()
      expect(result.onInvalid).toHaveBeenCalled()
    }
  )

  it("rejects oversized repeated patch groups", async () => {
    const result = await compose(fence([rootPatch(), ...Array.from({ length: 30 }, () => elementPatch())]))
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
    expect(result.onInvalid).toHaveBeenCalledWith("Presentation block size limit exceeded.")
  })

  it("rejects byte-heavy blocks even below the patch-count limit", async () => {
    const result = await compose(
      fence([rootPatch(), ...Array.from({ length: 3 }, () => elementPatch("first", "\u4e2d".repeat(512)))])
    )
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(result.resolve).not.toHaveBeenCalled()
  })

  it("converts resolver authorization or expiry failures into an error without exposing details", async () => {
    const result = await compose(fence([rootPatch(), elementPatch()]), () => {
      throw new Error("Private owner and expiry details")
    })
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(JSON.stringify(result.chunks)).not.toContain("Private owner")
    expect(result.resolve).toHaveBeenCalledWith({ resultId, recordId: "bill-1" })
  })

  it("rejects a resolved record whose ID does not match the reference", async () => {
    const result = await compose(fence([rootPatch(), elementPatch()]), () => record("different"))
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
  })

  it.each<UIMessageChunk>([
    { type: "abort", reason: "Stopped" },
    { type: "error", errorText: "Provider failed" },
    { type: "finish", finishReason: "error" }
  ])("settles an open block on $type without trusting a complete but unsealed card", async (ending) => {
    const resolveRecord = vi.fn<typeof resolver>(resolver)
    const onComplete = vi.fn<NonNullable<Parameters<typeof createCompositionStream>[1]["onComplete"]>>()
    const chunks = await collect(
      createCompositionStream(textStream([fence([rootPatch(), elementPatch()])], [ending]), {
        resolveRecord,
        onComplete
      })
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(resolveRecord).not.toHaveBeenCalled()
    expect(chunks).toContainEqual(ending)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]?.[0].isInterrupted).toBe(true)
  })

  it("keeps a completed block immutable when later output is aborted", async () => {
    const chunks = await collect(
      createCompositionStream(
        textStream([`${fence([rootPatch(), elementPatch()])}Already sealed`], [{ type: "abort" }]),
        { resolveRecord: resolver }
      )
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(chunks.at(-1)).toEqual({ type: "abort" })
  })

  it.each([true, false])("settles normal physical end with complete=%s and no finish event", async (isComplete) => {
    const patches = [rootPatch()]
    const content = fence(isComplete ? [...patches, elementPatch()] : patches)
    const chunks = await collect(createCompositionStream(textStream([content], []), { resolveRecord: resolver }))
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", isComplete ? "ready" : "error"])
  })

  it("flushes a final patch without a newline before finish", async () => {
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "text-start", id: "original" },
          {
            type: "text-delta",
            id: "original",
            delta: `${JSON.stringify(rootPatch())}\n${JSON.stringify(elementPatch())}`
          },
          { type: "finish", finishReason: "stop" }
        ]),
        { resolveRecord: resolver }
      )
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" })
  })

  it("retains text metadata, tools, sources, message metadata and finish", async () => {
    const providerMetadata = { provider: { trace: "source-text" } }
    const events: UIMessageChunk[] = [
      { type: "tool-input-available", toolCallId: "call", toolName: "get_bill", input: { id: "bill-1" } },
      { type: "tool-output-available", toolCallId: "call", output: { resultId } },
      { type: "source-url", sourceId: "source", url: "https://example.org/bill" },
      { type: "message-metadata", messageMetadata: { trace: "answer" } },
      { type: "finish", finishReason: "stop", messageMetadata: { complete: true } }
    ]
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "text-start", id: "original", providerMetadata },
          {
            type: "text-delta",
            id: "original",
            delta: `Before\n${fence([rootPatch(), elementPatch()])}After`,
            providerMetadata
          },
          { type: "text-end", id: "original", providerMetadata },
          ...events
        ]),
        { resolveRecord: resolver }
      )
    )
    expect(chunks.filter((chunk) => events.includes(chunk))).toEqual(events)
    expect(text(chunks)).toBe("Before\nAfter")
    const textChunks = chunks.filter(
      (chunk) => chunk.type === "text-start" || chunk.type === "text-delta" || chunk.type === "text-end"
    )
    for (const chunk of textChunks) {
      expect(chunk.providerMetadata).toEqual(providerMetadata)
    }
  })

  it("emits an explicit incomplete outcome when research finishes without an answer", async () => {
    const ending: UIMessageChunk[] = [
      {
        type: "tool-input-available",
        toolCallId: "failed-search",
        toolName: "search_bills",
        input: { query: "accountability" }
      },
      { type: "tool-output-error", toolCallId: "failed-search", errorText: "Search failed" },
      { type: "finish", finishReason: "stop" }
    ]
    const onComplete = vi.fn<NonNullable<Parameters<typeof createCompositionStream>[1]["onComplete"]>>()
    const chunks = await collect(
      createCompositionStream(textStream([], ending), { resolveRecord: resolver, onComplete })
    )
    expect(text(chunks)).toBe("Research ended before an answer was completed. Narrow the question and try again.")
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" })
    expect(onComplete).toHaveBeenCalledWith({
      text: "Research ended before an answer was completed. Narrow the question and try again.",
      blocks: [],
      isInterrupted: true
    })
  })

  it("preserves a completed clarification as distinct from an incomplete answer", async () => {
    const chunks = await collect(
      createCompositionStream(
        textStream(
          [],
          [
            {
              type: "tool-input-available",
              toolCallId: "clarify",
              toolName: "ask_clarification",
              input: { question: "Which jurisdiction?" }
            },
            { type: "tool-output-available", toolCallId: "clarify", output: { clarificationId: "clarification-1" } },
            { type: "finish", finishReason: "stop" }
          ]
        ),
        { resolveRecord: resolver }
      )
    )
    expect(text(chunks)).toBe("")
    expect(chunks.at(-1)).toEqual({ type: "finish", finishReason: "stop" })
  })

  it.each<UIMessageChunk | undefined>([
    { type: "finish", finishReason: "tool-calls" },
    { type: "finish", finishReason: "length" },
    undefined
  ])("reports empty completion without guessing the cause from $type", async (ending) => {
    const onInvalid = vi.fn<(reason: string) => void>()
    const chunks = await collect(
      createCompositionStream(textStream(["   "], ending ? [ending] : []), { resolveRecord: resolver, onInvalid })
    )
    expect(text(chunks)).toContain("Research ended before an answer was completed.")
    expect(onInvalid).toHaveBeenCalledExactlyOnceWith("Research ended without an answer.")
    expect(chunks.filter((chunk) => chunk.type === "finish")).toEqual(ending ? [ending] : [])
  })

  it("does not label a ready presentation-only answer as incomplete", async () => {
    const result = await compose(fence([rootPatch(), elementPatch()]))
    expect(blocks(result.chunks).at(-1)?.state).toBe("ready")
    expect(text(result.chunks)).not.toContain("Research ended before")
    expect(result.onInvalid).not.toHaveBeenCalled()
  })

  it("marks failed-only presentation as incomplete rather than claiming an answer", async () => {
    const result = await compose(fence([rootPatch()]))
    expect(blocks(result.chunks).at(-1)?.state).toBe("error")
    expect(text(result.chunks)).toContain("Research ended before an answer was completed.")
  })

  it("does not treat a failed clarification call as a delivered question", async () => {
    const chunks = await collect(
      createCompositionStream(
        textStream(
          [],
          [
            { type: "tool-input-available", toolCallId: "clarify", toolName: "ask_clarification", input: {} },
            { type: "tool-output-error", toolCallId: "clarify", errorText: "Invalid question" },
            { type: "finish", finishReason: "tool-calls" }
          ]
        ),
        { resolveRecord: resolver }
      )
    )
    expect(text(chunks)).toContain("Research ended before an answer was completed.")
  })

  it("flushes buffered prose before non-text events", async () => {
    const event: UIMessageChunk = { type: "tool-input-start", toolCallId: "call", toolName: "get_bill" }
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "text-start", id: "original" },
          { type: "text-delta", id: "original", delta: "`buffered prose`" },
          event,
          { type: "text-delta", id: "original", delta: "After" },
          { type: "text-end", id: "original" }
        ]),
        { resolveRecord: resolver }
      )
    )
    expect(text(chunks.slice(0, chunks.indexOf(event)))).toBe("`buffered prose`")
    expect(text(chunks)).toBe("`buffered prose`After")
  })

  it("assigns unique text IDs when library-generated and source IDs collide", async () => {
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "text-start", id: "composition-text-1" },
          { type: "text-delta", id: "composition-text-1", delta: "First\n" },
          { type: "text-end", id: "composition-text-1" },
          { type: "text-start", id: "original" },
          { type: "text-delta", id: "original", delta: `Before\n${fence([rootPatch(), elementPatch()])}After` },
          { type: "text-end", id: "original" },
          { type: "text-start", id: "original" },
          { type: "text-delta", id: "original", delta: "Last" },
          { type: "text-end", id: "original" }
        ]),
        { resolveRecord: resolver }
      )
    )
    const starts = chunks.flatMap((chunk) => (chunk.type === "text-start" ? [chunk.id] : []))
    expect(new Set(starts).size).toBe(starts.length)
    expect(starts).toContain("composition-text-2")
    expect(text(chunks)).toBe("First\nBefore\nAfterLast")
    const messages = await collect(readUIMessageStream({ stream: chunkStream(chunks), terminateOnError: true }))
    expect(messages.at(-1)?.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))).toEqual([
      "First\n",
      "Before\n",
      "After",
      "Last"
    ])
  })

  it("detaches completed blocks from resolver objects and callback mutations", async () => {
    const resolved = record("bill-1")
    const onInvalid = vi.fn<(reason: string) => void>(() => {
      throw new Error("Observer failed")
    })
    const chunks = await collect(
      createCompositionStream(textStream([fence([rootPatch(), elementPatch()])]), {
        resolveRecord: () => resolved,
        onInvalid,
        onBlock(block) {
          block.blockId = "changed"
          if (block.state === "ready" && block.records[0]) {
            block.records[0].title = "Changed by observer"
            resolved.title = "Changed resolver object"
            throw new Error("Observer failed")
          }
        }
      })
    )
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "ready"])
    expect(blocks(chunks)[1]).toMatchObject({ blockId: "presentation-first", records: [record("bill-1")] })
    expect(onInvalid).toHaveBeenCalledWith("Presentation block callback failed.")
  })

  it("rejects generated presentation and spec data while preserving unrelated data parts", async () => {
    const other: UIMessageChunk = { type: "data-research", data: { status: "ready" } }
    const onInvalid = vi.fn<(reason: string) => void>()
    const chunks = await collect(
      createCompositionStream(
        chunkStream([
          { type: "data-presentation", id: "forged", data: { state: "pending", blockId: "forged" } },
          { type: "data-spec", data: { type: "patch", patch: rootPatch() } },
          { type: "data-spec", data: { type: "flat", spec: {} } },
          { type: "data-spec", data: { type: "nested", spec: {} } },
          other
        ]),
        { resolveRecord: resolver, onInvalid }
      )
    )
    expect(chunks[0]).toEqual(other)
    expect(text(chunks)).toBe("Research ended before an answer was completed. Narrow the question and try again.")
    expect(onInvalid).toHaveBeenCalledTimes(5)
  })

  it("reports discarded malformed fences once and preserves their position without inventing a card", async () => {
    const result = await compose(`Before\n\`\`\`spec\nnot JSON\n{"type":"Unknown"}\n\`\`\`\nAfter`)
    expect(text(result.chunks)).toBe("Before\nAfter")
    expect(blocks(result.chunks)).toEqual([{ state: "error", blockId: expect.any(String), reason: "presentation" }])
    expect(result.onInvalid).toHaveBeenCalledExactlyOnceWith("Malformed presentation fence.")
    const errorIndex = result.chunks.findIndex((chunk) => chunk.type === "data-presentation")
    expect(text(result.chunks.slice(0, errorIndex))).toBe("Before\n")
    expect(text(result.chunks.slice(errorIndex + 1))).toBe("After")
    expect(result.resolve).not.toHaveBeenCalled()
  })

  it("settles a root whose remaining malformed fenced content was discarded by the library", async () => {
    const result = await compose(`\`\`\`spec\n${JSON.stringify(rootPatch())}\nmalformed\n\`\`\`\nAfter`)
    expect(blocks(result.chunks).map((block) => block.state)).toEqual(["pending", "error"])
  })

  it("settles pending callbacks and propagates downstream cancellation", async () => {
    const cancel = vi.fn<(reason: unknown) => void>()
    const onBlock = vi.fn<(block: PresentationBlock) => void>()
    const onComplete = vi.fn<NonNullable<Parameters<typeof createCompositionStream>[1]["onComplete"]>>()
    const input = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "original" })
        controller.enqueue({ type: "text-delta", id: "original", delta: fence([rootPatch()]) })
      },
      cancel
    })
    const reader = createCompositionStream(input, { resolveRecord: resolver, onBlock, onComplete }).getReader()
    while (true) {
      const next = await reader.read()
      if (next.done || next.value.type === "data-presentation") {
        break
      }
    }
    await reader.cancel("Stopped")
    expect(onBlock.mock.calls.map(([block]) => block.state)).toEqual(["pending", "error"])
    expect(cancel).toHaveBeenCalledWith("Stopped")
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]?.[0].isInterrupted).toBe(true)
  })

  it("settles a pending block when the upstream stream throws", async () => {
    let failSource: (() => void) | undefined
    const input = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "original" })
        controller.enqueue({ type: "text-delta", id: "original", delta: fence([rootPatch()]) })
        failSource = () => controller.error(new Error("Private transport details"))
      }
    })
    const chunks: UIMessageChunk[] = []
    const reader = createCompositionStream(input, { resolveRecord: resolver }).getReader()
    while (true) {
      const next = await reader.read()
      if (next.done) {
        break
      }
      chunks.push(next.value)
      if (next.value.type === "data-presentation") {
        failSource?.()
        failSource = undefined
      }
    }
    expect(blocks(chunks).map((block) => block.state)).toEqual(["pending", "error"])
    expect(chunks).toContainEqual({ type: "error", errorText: "The response stream ended unexpectedly." })
    expect(JSON.stringify(chunks)).not.toContain("Private transport")
  })
})
