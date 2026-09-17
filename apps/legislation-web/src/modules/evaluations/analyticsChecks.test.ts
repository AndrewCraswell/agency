import { analyticsQuerySchema } from "@repo/legislation-core/research/analytics-contract"
import { describe, expect, it } from "vitest"
import { analyticsMetricProjection } from "./analyticsChecks"

const bindings = [
  { name: "total", grain: "countDistinct:votes.id", filters: [] },
  {
    name: "matching",
    grain: "countDistinct:votes.id",
    filters: [{ field: "positions.option", op: "eq" as const, values: ["absent"] }]
  }
]
const absenceQuery = analyticsQuerySchema.parse({
  dataset: "positions",
  metrics: [
    { name: "recorded", operation: "countDistinct", field: "voteId" },
    {
      name: "absent",
      operation: "countDistinct",
      field: "voteId",
      filters: [{ field: "option", op: "eq", values: ["absent"] }]
    }
  ]
})
const helpers = [
  {
    grain: "countDistinct:documents.id",
    filters: [{ field: "documents.classification", op: "eq" as const, values: ["amendment"] }]
  }
]
const intersectionQuery = analyticsQuerySchema.parse({
  dataset: "bills",
  metrics: [
    { name: "total", operation: "countDistinct", field: "amendments.id" },
    {
      name: "documentCount",
      operation: "countDistinct",
      field: "documents.id",
      filters: [{ field: "documents.classification", op: "eq", values: ["amendment"] }]
    }
  ],
  having: [
    { field: "total", op: "gte", value: 1 },
    { field: "documentCount", op: "gte", value: 1 }
  ]
})

describe("analytics semantic metric validation", () => {
  it("maps aliases by grain and predicate without changing values", () => {
    const result = analyticsMetricProjection(absenceQuery, bindings)
    expect(result.hasValidBindings).toBe(true)
    expect(result.project([{ recorded: 506, absent: 0 }])).toEqual([{ total: 506, matching: 0 }])
    expect(result.project([{ recorded: 0, absent: 506 }])).toEqual([{ total: 0, matching: 506 }])
  })

  it("does not accept another vote category even when both counts are zero", () => {
    const query = structuredClone(absenceQuery)
    query.metrics[1]!.filters[0]!.values = ["not-voting"]
    expect(analyticsMetricProjection(query, bindings).hasValidBindings).toBe(false)
  })

  it("does not accept position counts as distinct vote counts", () => {
    const query = structuredClone(absenceQuery)
    query.metrics[1]!.field = "_key"
    expect(analyticsMetricProjection(query, bindings).hasValidBindings).toBe(false)
  })

  it("accepts a helper only for the declared positive existence predicate", () => {
    const result = analyticsMetricProjection(intersectionQuery, [], helpers)
    expect(result.helperMetrics).toEqual(["documentCount"])
    expect(result.actualMetrics).toEqual(["countDistinct:amendments.id"])
    expect(result.project([{ total: 3, documentCount: 2 }])).toEqual([{ total: 3 }])
  })

  it.each(["no-having", "wrong-threshold", "wrong-classification", "ranked-helper"])(
    "rejects a misleading helper: %s",
    (variant) => {
      const query = structuredClone(intersectionQuery)
      if (variant === "no-having") {
        query.having = []
      }
      if (variant === "wrong-threshold") {
        query.having[1]!.value = 2
      }
      if (variant === "wrong-classification") {
        query.metrics[1]!.filters[0]!.values = ["version"]
      }
      if (variant === "ranked-helper") {
        query.orderBy = [{ field: "documentCount", direction: "desc" }]
      }
      expect(analyticsMetricProjection(query, [], helpers).helperMetrics).toEqual([])
    }
  )

  it("rejects ambiguous aliases and alias collisions", () => {
    const query = structuredClone(absenceQuery)
    query.metrics.push({ ...query.metrics[0]!, name: "duplicate" })
    expect(analyticsMetricProjection(query, bindings).hasValidBindings).toBe(false)
  })
})
