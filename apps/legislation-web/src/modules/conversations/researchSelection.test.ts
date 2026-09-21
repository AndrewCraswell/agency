import {
  prepareResultPage,
  readResultPage,
  researchResultByteLimit
} from "@repo/legislation-core/research/result-pages"
import { expect, it } from "vitest"
import { z } from "zod"
import { createResearchSelections } from "./researchSelection"

const billId = "bill:us:119:hr:9619"
const document = {
  id: `${billId}:document:51af43854225cf7d760326df`,
  billId,
  versionCode: "ih"
}
const alteredId = `${billId}:document:51af43854225cf7d760760df`
const input = { id: billId, documentId: document.id, versionCode: "ih", limit: 50 }

function page(name = "get_bill_text", selection: Record<string, unknown> = input, upstream = "offset-50") {
  return z.object({ nextCursor: z.string() }).parse(prepareResultPage(name, selection, { nextCursor: upstream }, 0))
}

it("retains the returned document bytes without rejecting legitimate undiscovered IDs", () => {
  const selections = createResearchSelections()
  expect(() => selections.validate("get_bill_text", input, "first")).not.toThrow()
  selections.register({ document }, "metadata")
  expect(() => selections.validate("get_bill_text", input, "known")).not.toThrow()
  expect(() =>
    selections.validate("get_bill_text", { ...input, documentId: "explicit-new-document" }, "new")
  ).not.toThrow()
  expect(() => selections.validate("get_bill_text", { ...input, documentId: alteredId }, "unknown")).not.toThrow()
  expect(selections.recover("get_bill_text", { ...input, documentId: alteredId }, "not_found")).toMatchObject({
    action: "select_returned",
    documents: [document]
  })
})

it("retires consumed fragment-only cursors while retaining source and independent evidence continuations", () => {
  const selections = createResearchSelections()
  const name = "get_person"
  const selection = { id: "person:us:1" }
  const raw = { person: { id: selection.id, name: "Member", biography: "x".repeat(researchResultByteLimit + 1) } }
  let result = prepareResultPage(name, selection, raw, 0)
  selections.register(result, "initial")
  let cursor = z.object({ nextCursor: z.string() }).parse(result).nextCursor
  const firstCursor = cursor
  const evidenceCursor = page(name, selection, "research-evidence:retained").nextCursor
  selections.register({ evidencePage: { nextCursor: evidenceCursor } }, "evidence")
  for (let index = 0; index < 3; index++) {
    const consumed = { ...selection, cursor }
    selections.validate(name, consumed, "read")
    const parsed = readResultPage(name, consumed)
    result = prepareResultPage(name, parsed.input, raw, parsed.offset, parsed.snapshot, undefined, parsed.fragment)
    selections.register(result, "next", { tool: name, input: consumed })
    cursor = z.object({ nextCursor: z.string() }).parse(result).nextCursor
  }
  expect(() => selections.validate(name, { ...selection, cursor: firstCursor }, "old")).toThrow(
    expect.objectContaining({ code: "invalid_cursor" })
  )
  expect(() => selections.validate(name, { ...selection, cursor: evidenceCursor }, "separate")).not.toThrow()
  selections.register({}, "evidence-read", { tool: name, input: { ...selection, cursor: evidenceCursor } })
  expect(() => selections.validate(name, { ...selection, cursor: evidenceCursor }, "used")).toThrow(
    expect.objectContaining({ code: "invalid_cursor" })
  )
})

it("does not accumulate consumed citation continuations across long chains", () => {
  const selections = createResearchSelections()
  const name = "get_bill"
  const input = { id: billId }
  let cursor = page(name, input, "research-evidence:0").nextCursor
  selections.register({ nextCursor: cursor }, "initial")
  for (let index = 1; index <= 1700; index++) {
    const consumed = { ...input, cursor }
    selections.validate(name, consumed, "read")
    cursor = page(name, input, `research-evidence:${index}`).nextCursor
    selections.register({ nextCursor: cursor }, "next", { tool: name, input: consumed })
  }
  expect(() => selections.validate(name, { ...input, cursor }, "final")).not.toThrow()
})

it.each([
  ["get_bill_text", { ...input, id: "bill:us:118:hr:9619" }],
  ["get_bill_text", { ...input, versionCode: "eh" }],
  ["compare_bill_versions", { billId: "bill:us:118:hr:9619", documentIds: [document.id, "second"] }],
  ["search_bill_text", { billId: "bill:us:118:hr:9619", documentIds: [document.id], query: "schools" }]
] as const)("rejects a witnessed parent/version mismatch through %s", (name, selection) => {
  const selections = createResearchSelections()
  selections.register({ documents: [document] }, "metadata")
  expect(() => selections.validate(name, selection, "mismatch")).toThrow(
    expect.objectContaining({ code: "invalid_request" })
  )
})

it.each([
  ["get_document_sections", { documentId: document.id }],
  ["read_record_collection", { collection: "document-sections", recordId: document.id }],
  ["compare_bill_versions", { billId, documentIds: [document.id, "explicit-new-version"] }],
  ["search_bill_text", { billId, documentIds: [document.id], query: "schools" }],
  ["get_regulatory_document", { documentId: "11111111-1111-4111-8111-111111111111" }]
] as const)("preserves the canonical %s input without an alias protocol", (name, selection) => {
  const selections = createResearchSelections()
  selections.register({ document }, "metadata")
  const original = structuredClone(selection)
  expect(() => selections.validate(name, selection, "exact")).not.toThrow()
  expect(selection).toEqual(original)
})

it("validates a fresh case-028 continuation but rejects altered bytes and foreign-turn reuse", () => {
  const selection = {
    id: "bill:us:119:hr:8516",
    documentId: "bill:us:119:hr:8516:document:095c920c30294fe484c541ec",
    versionCode: "ih",
    limit: 50
  }
  const returned = page("get_bill_text", selection, "eyJvZmZzZXQiOjUwfQ")
  const altered = page("get_bill_text", selection, "eyJvZmZzZXQiOjUwqQ").nextCursor
  const selections = createResearchSelections()
  selections.register(returned, "page")
  expect(() =>
    selections.validate("get_bill_text", { ...selection, cursor: returned.nextCursor }, "exact")
  ).not.toThrow()
  expect(readResultPage("get_bill_text", { ...selection, cursor: returned.nextCursor }).input.cursor).toBe(
    "eyJvZmZzZXQiOjUwfQ"
  )
  expect(() => selections.validate("get_bill_text", { ...selection, cursor: altered }, "changed")).toThrow(
    expect.objectContaining({ code: "invalid_cursor" })
  )
  expect(selections.recover("get_bill_text", { ...selection, cursor: altered }, "invalid_cursor")).toMatchObject({
    action: "select_returned",
    continuation: { field: "cursor", value: returned.nextCursor }
  })
  expect(() =>
    createResearchSelections().validate("get_bill_text", { ...selection, cursor: returned.nextCursor }, "foreign")
  ).toThrow(expect.objectContaining({ code: "invalid_cursor" }))
})

it.each([
  ["get_document_sections", { ...input }],
  ["get_bill_text", { ...input, id: "bill:us:118:hr:9619" }],
  ["get_bill_text", { ...input, documentId: "different-document" }],
  ["get_bill_text", { ...input, versionCode: "eh" }],
  ["get_bill_text", { ...input, limit: 25 }]
] as const)("retains core continuation binding for %s and changed filters", (name, selection) => {
  const returned = page()
  const selections = createResearchSelections()
  selections.register(returned, "page")
  expect(() => selections.validate(name, { ...selection, cursor: returned.nextCursor }, "wrong-scope")).toThrow(
    expect.objectContaining({ code: "invalid_cursor" })
  )
  expect(selections.recover(name, { ...selection, cursor: returned.nextCursor }, "invalid_cursor")).toMatchObject({
    action: "restart"
  })
})

it("keeps nested child continuations bound to their producing tool and field", () => {
  const selection = { id: billId, childLimit: 1 }
  const returned = prepareResultPage("get_bill", selection, { documents: { nextChildCursor: "child-page" } }, 0)
  const cursor = z.object({ documents: z.object({ nextChildCursor: z.string() }) }).parse(returned)
    .documents.nextChildCursor
  const selections = createResearchSelections()
  selections.register(returned, "page")
  expect(() => selections.validate("get_bill", { ...selection, childCursor: cursor }, "child")).not.toThrow()
  expect(() => selections.validate("get_bill", { ...selection, cursor }, "wrong-field")).toThrow(
    expect.objectContaining({ code: "invalid_cursor" })
  )
  expect(selections.recover("get_bill", { ...selection, cursor }, "invalid_cursor")).toMatchObject({
    action: "select_returned",
    continuation: { field: "childCursor", value: cursor }
  })
  expect(
    selections.recover("get_bill", { ...selection, id: "bill:us:118:hr:9619", cursor }, "invalid_cursor")
  ).toMatchObject({
    action: "restart"
  })
})

it("does not spend another tool's recovery opportunity on an earlier invalid selection", () => {
  const selections = createResearchSelections()
  selections.register(page(), "page")
  selections.recover("get_person", { id: "person:one", cursor: "invalid" }, "invalid_cursor")
  expect(selections.recover("get_bill_text", { ...input, cursor: "invalid" }, "invalid_cursor")).toMatchObject({
    action: "select_returned"
  })
})

it("does not guess a page when several returned continuations have the same bound filters", () => {
  const selections = createResearchSelections()
  selections.register([page(), page("get_bill_text", input, "offset-100")], "pages")
  const failed = { ...input, cursor: "invented" }
  expect(selections.recover("get_bill_text", failed, "invalid_cursor")).toMatchObject({ action: "restart" })
  expect(selections.recover("get_bill_text", failed, "invalid_cursor")).toMatchObject({ action: "answer" })
})

it("offers exact document choices without merging versions, bills or prose IDs", () => {
  const selections = createResearchSelections()
  const second = { ...document, id: "document:second", versionCode: "eh" }
  selections.register(
    {
      documents: [document, second, { ...document, id: "document:foreign", billId: "bill:us:118:hr:9619" }],
      text: JSON.stringify({ document: { ...document, id: alteredId } })
    },
    "metadata"
  )
  expect(selections.recover("get_bill_text", { ...input, documentId: alteredId }, "internal")).toMatchObject({
    action: "select_returned",
    documents: [document]
  })
  const ambiguous = createResearchSelections()
  ambiguous.register({ documents: [document, second] }, "metadata")
  expect(ambiguous.recover("get_bill_text", { id: billId, documentId: alteredId }, "not_found")).toMatchObject({
    action: "select_returned",
    documents: [document, second]
  })
})

it("uses explicit resolution rather than unscoped or excessive replacement choices", () => {
  const selections = createResearchSelections()
  selections.register(
    { documents: Array.from({ length: 4 }, (_, index) => ({ ...document, id: `document:${index}` })) },
    "metadata"
  )
  const recovery = selections.recover("get_bill_text", { ...input, documentId: alteredId }, "not_found")
  expect(recovery).toMatchObject({ action: "resolve_document" })
  expect(recovery).not.toHaveProperty("documents")
  expect(
    createResearchSelections().recover("get_document_sections", { documentId: alteredId }, "not_found")
  ).toMatchObject({ action: "resolve_document" })
  expect(
    createResearchSelections().recover(
      "read_record_collection",
      { collection: "document-sections", recordId: alteredId },
      "not_found"
    )
  ).toMatchObject({ action: "resolve_document" })
})

it.each(["forbidden", "timeout", "precondition_failed", "interrupted"] as const)(
  "does not turn %s into a selection retry",
  (code) => {
    expect(createResearchSelections().recover("get_bill_text", input, code)).toBeUndefined()
  }
)

it("does not substitute another version when a known exact document has a service error", () => {
  const selections = createResearchSelections()
  selections.register({ document }, "metadata")
  expect(selections.recover("get_bill_text", input, "internal")).toBeUndefined()
  expect(selections.recover("get_bill_text", input, "not_found")).toMatchObject({ action: "resolve_document" })
})

it("bounds registry entries and bytes atomically without discarding earlier valid selections", () => {
  const selections = createResearchSelections()
  const returned = page()
  selections.register(returned, "first")
  expect(() =>
    selections.register(
      { documents: Array.from({ length: 1601 }, (_, index) => ({ ...document, id: `document:${index}` })) },
      "count-limit"
    )
  ).toThrow(expect.objectContaining({ code: "result_limit" }))
  expect(() => selections.register({ nextCursor: "x".repeat(researchResultByteLimit + 1) }, "byte-limit")).toThrow(
    expect.objectContaining({ code: "result_limit" })
  )
  expect(() =>
    selections.validate("get_bill_text", { ...input, cursor: returned.nextCursor }, "retained")
  ).not.toThrow()
  expect(selections.recover("get_bill_text", { ...input, documentId: alteredId }, "not_found")).toMatchObject({
    action: "resolve_document"
  })
})

it("rejects contradictory returned metadata without overwriting the earlier document binding", () => {
  const selections = createResearchSelections()
  selections.register({ document }, "first")
  expect(() => selections.register({ document: { ...document, billId: "bill:us:118:hr:9619" } }, "conflict")).toThrow(
    expect.objectContaining({ code: "invalid_response" })
  )
  expect(() => selections.validate("get_bill_text", input, "retained")).not.toThrow()
})
