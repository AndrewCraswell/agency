import { describe, expect, it } from "vitest"
import { clarificationInputSchema, clarificationRequestSchema, clarificationResponseSchemaFor } from "./clarification"

const request = clarificationRequestSchema.parse({
  id: "2f1b652a-b068-4c44-bb0a-daf032ab958e",
  revision: 1,
  state: "pending",
  input: {
    kind: "single",
    question: "Which jurisdiction should this research cover?",
    allowSkip: true,
    allowFreeText: false,
    options: [
      { id: "washington", label: "Washington" },
      { id: "colorado", label: "Colorado" }
    ]
  }
})

const answer = {
  requestId: request.id,
  revision: request.revision,
  status: "answered",
  selectedIds: ["washington"],
  text: ""
}

describe("clarification contract", () => {
  it("accepts a choice bound to the active question", () => {
    expect(clarificationResponseSchemaFor(request).parse(answer)).toEqual(answer)
  })

  it.each([
    { selectedIds: [] },
    { selectedIds: ["washington", "colorado"] },
    { selectedIds: ["washington", "washington"] },
    { selectedIds: ["invented-option"] },
    { revision: 2 },
    { requestId: "b5213931-3abd-494a-8d29-2a6d21acbc95" },
    { text: "Unexpected text" },
    { approved: true },
    { selectedIds: ["washington"], recordId: "forged-record" }
  ])("rejects invalid or stale response %j", (change) => {
    expect(clarificationResponseSchemaFor(request).safeParse({ ...answer, ...change }).success).toBe(false)
  })

  it.each(["answered", "skipped", "superseded", "expired"])("rejects a response to a %s question", (state) => {
    const inactive = clarificationRequestSchema.parse({ ...request, state })
    expect(clarificationResponseSchemaFor(inactive).safeParse(answer).success).toBe(false)
  })

  it("permits explicit skipping without answer fields", () => {
    const skipped = { requestId: request.id, revision: 1, status: "skipped" }
    expect(clarificationResponseSchemaFor(request).parse(skipped)).toEqual(skipped)
    expect(clarificationResponseSchemaFor(request).safeParse({ ...answer, status: "skipped" }).success).toBe(false)
    const required = clarificationRequestSchema.parse({ ...request, input: { ...request.input, allowSkip: false } })
    expect(clarificationResponseSchemaFor(required).safeParse(skipped).success).toBe(false)
  })

  it("supports a free-text alternative only when offered", () => {
    const freeText = clarificationRequestSchema.parse({ ...request, input: { ...request.input, allowFreeText: true } })
    const response = { ...answer, selectedIds: [], text: "  A different jurisdiction  " }
    expect(clarificationResponseSchemaFor(freeText).parse(response)).toMatchObject({ text: "A different jurisdiction" })
    expect(clarificationResponseSchemaFor(freeText).safeParse({ ...response, text: "  " }).success).toBe(false)
  })

  it("enforces multiple-choice cardinality", () => {
    const multiple = clarificationRequestSchema.parse({
      ...request,
      input: { ...request.input, kind: "multiple", minSelections: 2, maxSelections: 2 }
    })
    expect(clarificationResponseSchemaFor(multiple).safeParse(answer).success).toBe(false)
    expect(
      clarificationResponseSchemaFor(multiple).safeParse({ ...answer, selectedIds: ["washington", "colorado"] }).success
    ).toBe(true)
  })

  it("requires bounded nonempty text for a text question", () => {
    const text = clarificationRequestSchema.parse({
      ...request,
      input: { kind: "text", question: "What is your research question?", allowSkip: false }
    })
    const schema = clarificationResponseSchemaFor(text)
    expect(schema.safeParse({ ...answer, selectedIds: [], text: "Housing affordability" }).success).toBe(true)
    expect(schema.safeParse({ ...answer, selectedIds: [], text: " " }).success).toBe(false)
    expect(schema.safeParse({ ...answer, selectedIds: [], text: "x".repeat(2001) }).success).toBe(false)
    expect(schema.safeParse({ ...answer, text: "Housing affordability" }).success).toBe(false)
  })

  it("rejects duplicate option IDs and impossible selection bounds", () => {
    const duplicateOptions = [
      { id: "same", label: "First" },
      { id: "same", label: "Second" }
    ]
    expect(clarificationInputSchema.safeParse({ ...request.input, options: duplicateOptions }).success).toBe(false)
    expect(
      clarificationInputSchema.safeParse({ ...request.input, kind: "multiple", minSelections: 3, maxSelections: 2 })
        .success
    ).toBe(false)
    expect(
      clarificationInputSchema.safeParse({ ...request.input, kind: "multiple", minSelections: 1, maxSelections: 3 })
        .success
    ).toBe(false)
  })
})
