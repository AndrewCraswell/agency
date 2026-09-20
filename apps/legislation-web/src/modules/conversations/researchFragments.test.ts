import { createHash } from "node:crypto"
import { expect, it, vi } from "vitest"
import { createResearchFragments, readCompleteResearchResult } from "./researchFragments"

function pages(text = JSON.stringify({ id: "record:1", title: "Policy 🏛️", metadata: "Exact attribution" })) {
  const split = text.indexOf(",") + 1
  const partialResult = {
    sourceTool: "get_person",
    snapshot: createHash("sha256").update(text).digest("base64url"),
    format: "json",
    offsetUnit: "utf16",
    totalCharacters: text.length
  }
  return [
    {
      partial: true,
      partialResult: { ...partialResult, text: text.slice(0, split), textOffset: 0, nextTextOffset: split },
      nextCursor: "next"
    },
    {
      partial: true,
      partialResult: { ...partialResult, text: text.slice(split), textOffset: split, nextTextOffset: null },
      nextCursor: null
    }
  ]
}

it("retains exact content and explicit pending state, and preview reads never advance assembly", () => {
  const [first, last] = pages()
  const fragments = createResearchFragments()
  expect(fragments.read("get_person", first!, true)).toMatchObject({
    projection: undefined,
    assembly: { status: "pending" }
  })
  expect(() => fragments.read("get_person", last!)).toThrow(expect.objectContaining({ code: "invalid_response" }))
  fragments.read("get_person", first!)
  fragments.read("get_person", first!)
  expect(fragments.read("get_person", last!, true)).toMatchObject({
    projection: { id: "record:1", title: "Policy 🏛️", metadata: "Exact attribution" },
    assembly: { status: "complete" }
  })
  expect(fragments.read("get_person", last!)).toMatchObject({ assembly: { status: "complete" } })
})

it("rejects changed identities, gaps, conflicting overlaps and corrupted terminal content", () => {
  const [first, last] = pages()
  for (const modified of [
    { ...last!, partialResult: { ...last!.partialResult, sourceTool: "get_bill" } },
    { ...last!, partialResult: { ...last!.partialResult, snapshot: "different" } },
    { ...last!, partialResult: { ...last!.partialResult, textOffset: last!.partialResult.textOffset + 1 } },
    { ...first!, partialResult: { ...first!.partialResult, text: first!.partialResult.text.replace("id", "ID") } },
    { ...last!, partialResult: { ...last!.partialResult, text: last!.partialResult.text.replace("Policy", "POLICY") } }
  ]) {
    const fragments = createResearchFragments()
    fragments.read("get_person", first!)
    expect(() => fragments.read("get_person", modified)).toThrow(expect.objectContaining({ code: "invalid_response" }))
  }
})

it("normalizes invalid reconstructed JSON rather than treating it as an input error", () => {
  const [first, last] = pages('{"id":"record:1",invalid}')
  const fragments = createResearchFragments()
  fragments.read("get_person", first!)
  expect(() => fragments.read("get_person", last!)).toThrow(expect.objectContaining({ code: "invalid_response" }))
})

it("drains one logical page, preserving its actual next record cursor", async () => {
  const value = { items: [{ id: "record:1", title: "Record" }], nextCursor: "next-record" }
  const [first, last] = pages(JSON.stringify(value))
  const load = vi.fn<() => Promise<unknown>>(async () => last)
  await expect(readCompleteResearchResult("get_person", first, load, new AbortController().signal)).resolves.toEqual(
    value
  )
  expect(load).toHaveBeenCalledExactlyOnceWith("next", expect.any(AbortSignal))
})

it("does not loop on a repeated fragment or load after cancellation", async () => {
  const [first] = pages()
  const load = vi.fn<() => Promise<unknown>>(async () => first)
  await expect(
    readCompleteResearchResult("get_person", first, load, new AbortController().signal)
  ).rejects.toMatchObject({
    code: "invalid_response"
  })
  const controller = new AbortController()
  controller.abort()
  load.mockClear()
  await expect(readCompleteResearchResult("get_person", first, load, controller.signal)).rejects.toMatchObject({
    name: "AbortError"
  })
  expect(load).not.toHaveBeenCalled()
})
