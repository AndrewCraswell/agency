import { z } from "zod"
import { sourceUrlSchema } from "./evidence"
import { sessionLabel } from "./sessionLabels"

export const entityKindSchema = z.enum([
  "bill",
  "person",
  "organization",
  "meeting",
  "document",
  "amendment",
  "vote",
  "material"
])
export type EntityKind = z.infer<typeof entityKindSchema>
export const entityLabels: Record<EntityKind, { singular: string; plural: string }> = {
  bill: { singular: "Bill", plural: "Bills" },
  person: { singular: "Person", plural: "People" },
  organization: { singular: "Organization", plural: "Committees and organizations" },
  meeting: { singular: "Meeting", plural: "Meetings" },
  document: { singular: "Document", plural: "Document versions" },
  amendment: { singular: "Amendment", plural: "Amendments" },
  vote: { singular: "Vote", plural: "Votes" },
  material: { singular: "Material", plural: "Supporting materials" }
}

export const entityCardSchema = z.object({
  id: z.string(),
  kind: entityKindSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  sourceUrl: sourceUrlSchema.nullable(),
  personSummary: z
    .object({
      isActive: z.boolean().optional(),
      term: z
        .object({
          chamber: z.string().optional(),
          district: z.string().optional(),
          officeTitle: z.string().optional(),
          startDate: z.iso.date().optional(),
          endDate: z.iso.date().optional(),
          isActive: z.boolean().optional()
        })
        .optional()
    })
    .optional(),
  organizationSummary: z
    .object({
      classification: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional()
    })
    .optional(),
  meetingSummary: z
    .object({
      startAt: z.iso.datetime({ offset: true }).optional(),
      localDate: z.iso.date().optional(),
      timezone: z.string().optional(),
      allDay: z.boolean(),
      location: z.string().optional(),
      status: z.string().optional()
    })
    .optional(),
  amendmentSummary: z
    .object({
      sponsorName: z.string().optional(),
      submittedDate: z.iso.date().optional(),
      status: z.string().optional()
    })
    .optional(),
  documentSummary: z
    .object({
      versionDate: z.iso.date().optional(),
      versionCode: z.string().optional(),
      sourceHost: z.string().optional()
    })
    .optional(),
  voteSummary: z.object({ question: z.string().optional(), outcome: z.string().optional() }).optional(),
  billSummary: z
    .object({
      sessionId: z.string().optional(),
      sessionName: z.string().optional(),
      status: z.string().optional(),
      latestAction: z.object({ description: z.string(), date: z.string().optional() }).optional()
    })
    .optional(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  tallies: z.array(z.object({ label: z.string(), value: z.number().int().nonnegative() }))
})
export type EntityCard = z.infer<typeof entityCardSchema>
export function resultTone(outcome: string) {
  const normalized = outcome.trim().toLowerCase()
  if (
    ["passed", "pass", "adopted", "approved", "agreed to", "adopted by the committee", "adopted in committee"].includes(
      normalized
    )
  ) {
    return "success"
  }
  if (
    ["failed", "fail", "rejected", "defeated", "not passed", "not adopted", "not approved", "not agreed to"].includes(
      normalized
    )
  ) {
    return "danger"
  }
  if (["pending", "in progress", "under consideration", "postponed", "deferred"].includes(normalized)) {
    return "pending"
  }
  return "neutral"
}

export function voteCardTallies(tallies: EntityCard["tallies"]) {
  const summary = tallies.filter((tally) => tally.label === "Yes" || tally.label === "No")
  const categories = ["Yes", "No", "Absent", "Abstain", "Not voting", "Present", "Proxy", "Paired", "Other"]
  const hasCompleteTally =
    tallies.length === categories.length && categories.every((label) => tallies.some((tally) => tally.label === label))
  if (hasCompleteTally) {
    summary.push({ label: "Total", value: tallies.reduce((total, tally) => total + tally.value, 0) })
  }
  return summary
}

export const entityPageSchema = z.object({
  id: z.uuid(),
  kind: entityKindSchema,
  presentation: z.enum(["card", "list"]),
  page: z.number().int().nonnegative(),
  items: z.array(entityCardSchema).max(5),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
  warnings: z.array(z.string()),
  query: z.string().optional()
})
export type EntityPage = z.infer<typeof entityPageSchema>
export class ResultExpiredError extends Error {
  constructor() {
    super(
      "These results have expired. Ask a new question to retrieve current results. Previously loaded records are still shown."
    )
    this.name = "ResultExpiredError"
  }
}

export const entityPageRequestSchema = z.strictObject({
  action: z.literal("page-results"),
  sessionKey: z.uuid(),
  resultId: z.uuid(),
  page: z.number().int().min(0).max(199)
})

const tools: Readonly<Record<string, { kind: EntityKind; key: string }>> = {
  search_bills: { kind: "bill", key: "bill" },
  get_bill: { kind: "bill", key: "bill" },
  get_bills: { kind: "bill", key: "bill" },
  find_related_bills: { kind: "bill", key: "bill" },
  search_people: { kind: "person", key: "person" },
  get_person: { kind: "person", key: "person" },
  search_organizations: { kind: "organization", key: "organization" },
  get_organization: { kind: "organization", key: "organization" },
  search_events: { kind: "meeting", key: "event" },
  get_event: { kind: "meeting", key: "event" },
  search_votes: { kind: "vote", key: "vote" },
  get_vote: { kind: "vote", key: "vote" },
  get_votes: { kind: "vote", key: "vote" },
  get_bill_votes: { kind: "vote", key: "vote" },
  search_amendments: { kind: "amendment", key: "amendment" },
  get_amendment: { kind: "amendment", key: "amendment" },
  get_amendments: { kind: "amendment", key: "amendment" },
  search_amendments_for_bills: { kind: "amendment", key: "amendment" },
  search_bill_text: { kind: "document", key: "document" },
  get_bill_text: { kind: "document", key: "document" },
  search_supporting_materials: { kind: "material", key: "material" },
  get_supporting_material: { kind: "material", key: "material" }
}
const recordSchema = z.record(z.string(), z.unknown())
const detailTools = new Set([
  "get_bill",
  "get_person",
  "get_organization",
  "get_event",
  "get_vote",
  "get_amendment",
  "get_bill_text",
  "get_supporting_material"
])
const pageSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.string().nullish(),
  truncated: z.boolean().optional(),
  warnings: z.array(z.string()).optional()
})

function text(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

function projectCard(value: unknown, kind: EntityKind, key: string): EntityCard | undefined {
  const parsed = recordSchema.safeParse(value)
  if (!parsed.success) {
    return undefined
  }
  if ("error" in parsed.data) {
    const id = text(parsed.data, "id")
    if (!id) {
      return undefined
    }
    return { id, kind, title: "Record unavailable", sourceUrl: null, fields: [], tallies: [] }
  }
  const batch = recordSchema.safeParse(parsed.data.data)
  const container = batch.success ? batch.data : parsed.data
  const nested = recordSchema.safeParse(container[key])
  const record = nested.success ? nested.data : container
  const id = text(record, "id")
  const title =
    text(record, "title") ?? text(record, "name") ?? text(record, "motion") ?? text(record, "printedIdentifier")
  if (!id || !title) {
    return undefined
  }
  const source = sourceUrlSchema.safeParse(record.sourceUrl ?? record.websiteUrl)
  const fields: EntityCard["fields"] = []
  let subtitle: string | undefined
  let displayTitle = title
  const tallies: EntityCard["tallies"] = []
  let billSummary: EntityCard["billSummary"]
  let voteSummary: EntityCard["voteSummary"]
  let documentSummary: EntityCard["documentSummary"]
  let amendmentSummary: EntityCard["amendmentSummary"]
  let meetingSummary: EntityCard["meetingSummary"]
  let personSummary: EntityCard["personSummary"]
  let organizationSummary: EntityCard["organizationSummary"]
  switch (kind) {
    case "bill": {
      const identifier = text(record, "identifier")
      if (identifier && !title.startsWith(identifier)) {
        displayTitle = `${identifier} ${title}`
      }
      const sessionId = text(record, "sessionId")
      const sessionName = sessionId ? sessionLabel(sessionId, text(record, "sessionName")) : text(record, "sessionName")
      subtitle = [text(record, "chamber"), sessionName].filter(Boolean).join(", ") || undefined
      billSummary = { sessionId, sessionName, status: text(record, "status") }
      const latest = z
        .object({
          billId: z.literal(id),
          description: z.string().trim().min(1),
          actionDate: z.string().nullish()
        })
        .safeParse(container.latestAction)
      if (latest.success) {
        billSummary.latestAction = { description: latest.data.description, date: latest.data.actionDate ?? undefined }
      }
      break
    }
    case "person": {
      subtitle = text(record, "party")
      personSummary = { isActive: typeof record.isActive === "boolean" ? record.isActive : undefined }
      const terms = z
        .array(
          z.object({
            chamber: z.string().nullish(),
            district: z.string().nullish(),
            officeTitle: z.string().nullish(),
            startDate: z.iso.date().nullish(),
            endDate: z.iso.date().nullish(),
            isActive: z.boolean().nullish()
          })
        )
        .safeParse(container.terms)
      if (terms.success) {
        const active = terms.data.filter((term) => term.isActive === true)
        const term = active.length === 1 ? active[0] : undefined
        if (term) {
          personSummary.term = {
            chamber: term.chamber ?? undefined,
            district: term.district ?? undefined,
            officeTitle: term.officeTitle ?? undefined,
            startDate: term.startDate ?? undefined,
            endDate: term.endDate ?? undefined,
            isActive: term.isActive ?? undefined
          }
          subtitle =
            [term.officeTitle, term.district ? `District ${term.district}` : undefined, text(record, "party")]
              .filter(Boolean)
              .join(", ") || undefined
        }
      }
      break
    }
    case "organization":
      subtitle = [text(record, "chamber"), text(record, "classification")].filter(Boolean).join(", ") || undefined
      organizationSummary = {
        classification: text(record, "classification"),
        description: text(record, "description"),
        isActive: typeof record.isActive === "boolean" ? record.isActive : undefined
      }
      break
    case "meeting": {
      const startAt = z.union([z.date(), z.iso.datetime({ offset: true })]).safeParse(record.startAt)
      const localDate = z.iso.date().safeParse(record.publisherLocalDate)
      let timezone = text(record, "timezone")
      if (timezone) {
        try {
          new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format()
        } catch {
          timezone = undefined
        }
      }
      const location = recordSchema.safeParse(record.location)
      meetingSummary = {
        startAt: startAt.success ? new Date(startAt.data).toISOString() : undefined,
        localDate: localDate.success ? localDate.data : undefined,
        timezone,
        allDay: record.allDay === true,
        location: location.success ? (text(location.data, "name") ?? text(location.data, "address")) : undefined,
        status: text(record, "status")
      }
      subtitle = formatMeetingWhen(meetingSummary)
      break
    }
    case "document": {
      const date = z.iso.date().safeParse(record.documentDate)
      documentSummary = {
        versionDate: date.success ? date.data : undefined,
        versionCode: text(record, "versionCode"),
        sourceHost: source.success ? new URL(source.data).hostname : undefined
      }
      subtitle = documentSummary.versionCode
      break
    }
    case "material": {
      subtitle = text(record, "classification")
      const date = z.iso.date().safeParse(record.documentDate)
      documentSummary = {
        versionDate: date.success ? date.data : undefined,
        sourceHost: source.success ? new URL(source.data).hostname : undefined
      }
      break
    }
    case "amendment": {
      const date = z.iso.date().safeParse(record.submittedDate)
      amendmentSummary = {
        sponsorName: text(record, "sponsorName"),
        submittedDate: date.success ? date.data : undefined,
        status: text(record, "status")
      }
      subtitle = amendmentSummary.sponsorName
      break
    }
    case "vote":
      subtitle = text(record, "heldAt")
      voteSummary = { question: text(record, "question"), outcome: text(record, "result") }
      for (const [label, key] of [
        ["Yes", "yesCount"],
        ["No", "noCount"],
        ["Absent", "absentCount"],
        ["Abstain", "abstainCount"],
        ["Not voting", "notVotingCount"],
        ["Present", "presentCount"],
        ["Proxy", "proxyCount"],
        ["Paired", "pairedCount"],
        ["Other", "otherCount"]
      ]) {
        const value = record[key]
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
          tallies.push({ label, value })
        }
      }
      break
  }
  return {
    id,
    kind,
    title: displayTitle,
    subtitle,
    sourceUrl: source.success ? source.data : null,
    fields,
    tallies,
    billSummary,
    voteSummary,
    documentSummary,
    amendmentSummary,
    meetingSummary,
    personSummary,
    organizationSummary
  }
}

export function formatMeetingWhen(summary: NonNullable<EntityCard["meetingSummary"]>) {
  if (summary.allDay || !summary.timezone || !summary.startAt) {
    if (!summary.localDate) {
      return undefined
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${summary.localDate}T00:00:00Z`)
    )
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: summary.timezone
  }).format(new Date(summary.startAt))
}

export function projectEntityResult(toolName: string, data: unknown) {
  const config = tools[toolName]
  if (!config) {
    return undefined
  }
  const page = pageSchema.safeParse(data)
  const values = page.success ? page.data.items : [data]
  const items = values.map((value) => projectCard(value, config.kind, config.key))
  if (items.some((item) => item === undefined)) {
    return undefined
  }
  const presentation: EntityPage["presentation"] = detailTools.has(toolName) ? "card" : "list"
  return {
    kind: config.kind,
    presentation,
    items: items.filter((item) => item !== undefined),
    nextCursor: page.success ? (page.data.nextCursor ?? undefined) : undefined,
    warnings: page.success
      ? [
          ...(page.data.warnings ?? []),
          ...(page.data.truncated && !page.data.nextCursor
            ? ["Only the retrieved records are shown. More records may be available."]
            : [])
        ]
      : [],
    truncated: page.success ? (page.data.truncated ?? false) : false
  }
}
