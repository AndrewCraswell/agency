import { expect, it } from "vitest"
import { z } from "zod"
import { createResearchTools, modelInputSchema, researchModelOutput } from "./research"

it("exposes short evidence ids to the model without mutating browser snapshots or record references", () => {
  const evidence = {
    id: "stable-evidence-identity",
    citationRef: "e1",
    title: "Introduced text",
    origin: "canonical",
    sourceUrl: "https://publisher.example/bill",
    content: { state: "not-collected" }
  }
  const output = { data: { bill: { id: "bill:us:119:hr:1" } }, evidence: [evidence], resultSet: { id: "result-set" } }
  const model = researchModelOutput({ output })
  expect(model.type).toBe("text")
  expect(JSON.parse(model.value)).toEqual({
    ...output,
    evidence: [
      {
        id: "e1",
        title: evidence.title,
        origin: evidence.origin,
        sourceUrl: evidence.sourceUrl,
        content: evidence.content
      }
    ]
  })
  expect(model.value).not.toContain("stable-evidence-identity")
  expect(output.evidence[0]?.id).toBe("stable-evidence-identity")
})

it("requires run-scoped references in model output instead of falling back to long evidence ids", () => {
  expect(() =>
    researchModelOutput({
      output: {
        evidence: [
          { id: "stable", title: "Text", origin: "canonical", sourceUrl: null, content: { state: "not-collected" } }
        ]
      }
    })
  ).toThrow(z.ZodError)
})

it("preserves canonical search limits and cursor inputs", () => {
  const schema = modelInputSchema(
    z.object({ query: z.string(), limit: z.number().int().min(1).max(100).optional(), cursor: z.string().optional() })
  )
  expect(schema.parse({ query: "education", limit: null, cursor: null })).toEqual({ query: "education" })
  expect(schema.parse({ query: "education", limit: 100, cursor: "opaque" })).toEqual({
    query: "education",
    limit: 100,
    cursor: "opaque"
  })
  expect(schema.safeParse({ query: "education", limit: 101, cursor: null }).success).toBe(false)
})

it("preserves canonical batch sizes and child limits", () => {
  const schema = modelInputSchema(
    z.object({ ids: z.array(z.string().startsWith("bill:")).max(25), childLimit: z.number().max(25).optional() })
  )
  expect(schema.parse({ ids: ["bill:1"], childLimit: null })).toEqual({ ids: ["bill:1"] })
  expect(schema.safeParse({ ids: Array.from({ length: 25 }, () => "bill:1"), childLimit: 25 }).success).toBe(true)
  expect(schema.safeParse({ ids: ["bill:1"], childLimit: 26 }).success).toBe(false)
  expect(schema.safeParse({ ids: ["invalid"], childLimit: 1 }).success).toBe(false)
})

it("admits configured production research before checking cancellation", () => {
  const cancellation = new Error("Request cancelled")
  expect(() =>
    createResearchTools(
      {
        NODE_ENV: "production",
        OPENROUTER_API_KEY: "fixture",
        LEGISLATION_PUBLIC_API_BASE_URL: "https://research.example"
      },
      AbortSignal.abort(cancellation)
    )
  ).toThrow(cancellation)
})

it("rejects unconfigured production research", () => {
  expect(() => createResearchTools({ NODE_ENV: "production" }, new AbortController().signal)).toThrow(
    "Research is unavailable in this environment."
  )
})
