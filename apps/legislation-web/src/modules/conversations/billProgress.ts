import { z } from "zod"
import { entityCardSchema, type EntityPage } from "./entityResults"
import { sourceUrlSchema } from "./evidence"

// Some source actions have descriptions but no classification. Recognize only explicit introduction/referral.
const INTRODUCED_PATTERN = /^introduced in (the )?(house|senate)\b/i
const REFERRED_TO_COMMITTEE_PATTERN = /^referred to\b.*committee/i

function inferClassificationFromDescription(description: string | null | undefined): string[] {
  if (!description) {
    return []
  }
  if (INTRODUCED_PATTERN.test(description)) {
    return ["introduction"]
  }
  if (REFERRED_TO_COMMITTEE_PATTERN.test(description)) {
    return ["referral-committee"]
  }
  return []
}

export const billProgressSchema = z.strictObject({
  id: z.uuid(),
  kind: z.literal("bill-progress"),
  resultId: z.uuid(),
  record: entityCardSchema.refine((record) => record.kind === "bill"),
  stages: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        state: z.enum(["recorded", "current", "unknown"]),
        date: z.iso.date().optional(),
        sourceUrl: sourceUrlSchema.nullish()
      })
    )
    .min(1)
    .max(5),
  hasMore: z.boolean()
})

export function projectBillProgress(data: unknown, page: EntityPage) {
  const record = page.items[0]
  if (!record || record.kind !== "bill") {
    return undefined
  }
  const parsed = z
    .object({
      bill: z.object({
        id: z.literal(record.id),
        chamber: z.string().nullish(),
        jurisdictionId: z.string().optional()
      }),
      progressActions: z.array(
        z.object({
          id: z.string(),
          billId: z.literal(record.id),
          ordinal: z.number(),
          classification: z.array(z.string()),
          chamber: z.string().nullish(),
          actionDate: z.iso.date().nullish(),
          actionAt: z.union([z.iso.datetime({ offset: true }), z.date()]).nullish(),
          sourceUrl: sourceUrlSchema.nullish(),
          description: z.string().nullish()
        })
      ),
      progressTruncated: z.boolean()
    })
    .safeParse(data)
  if (!parsed.success) {
    return undefined
  }
  const { bill, progressActions, progressTruncated } = parsed.data
  const chambers: Record<string, string> = { lower: "House floor", upper: "Senate", unicameral: "Legislature" }
  const stages: z.infer<typeof billProgressSchema>["stages"] = [
    { id: "introduced", label: "Introduced", state: "unknown" },
    { id: "committee", label: "Committee", state: "unknown" },
    { id: "first", label: chambers[bill.chamber ?? ""] ?? "First chamber", state: "unknown" }
  ]
  if (bill.chamber !== "unicameral") {
    let label = "Second chamber"
    if (bill.chamber === "lower") {
      label = "Senate"
    }
    if (bill.chamber === "upper") {
      label = "House floor"
    }
    stages.push({ id: "second", label, state: "unknown" })
  }
  stages.push({
    id: "executive",
    label: bill.jurisdictionId === "jurisdiction:us" ? "President" : "Governor",
    state: "unknown"
  })
  let current: string | undefined
  for (const action of progressActions) {
    const classification =
      action.classification.length > 0 ? action.classification : inferClassificationFromDescription(action.description)
    let stageId: string | undefined
    if (classification.includes("introduction")) {
      stageId = "introduced"
    }
    if (
      classification.some((value) =>
        [
          "referral-committee",
          "committee-passage",
          "committee-passage-favorable",
          "committee-passage-unfavorable"
        ].includes(value)
      )
    ) {
      stageId = "committee"
    }
    if (classification.includes("passage") && action.chamber && bill.chamber) {
      stageId = action.chamber === bill.chamber ? "first" : "second"
    }
    if (
      classification.some((value) =>
        ["executive-receipt", "executive-signature", "executive-veto", "became-law"].includes(value)
      )
    ) {
      stageId = "executive"
    }
    const stage = stages.find((stage) => stage.id === stageId)
    if (stage) {
      stage.state = "recorded"
      stage.date = action.actionAt
        ? new Date(action.actionAt).toISOString().slice(0, 10)
        : (action.actionDate ?? undefined)
      stage.sourceUrl = action.sourceUrl
      current = stage.id
    }
  }
  const latest = stages.find((stage) => stage.id === current)
  const latestAction = progressActions.findLast((action) => {
    const classification =
      action.classification.length > 0 ? action.classification : inferClassificationFromDescription(action.description)
    return classification.length > 0
  })
  const hasTerminalOutcome =
    latestAction?.classification.some((value) =>
      ["executive-signature", "executive-veto", "became-law"].includes(value)
    ) === true
  if (
    latest &&
    !hasTerminalOutcome &&
    !progressTruncated &&
    progressActions.every((action) => action.actionAt || action.actionDate)
  ) {
    latest.state = "current"
  }
  return billProgressSchema.parse({
    id: crypto.randomUUID(),
    kind: "bill-progress",
    resultId: page.id,
    record,
    stages,
    hasMore: progressTruncated
  })
}
