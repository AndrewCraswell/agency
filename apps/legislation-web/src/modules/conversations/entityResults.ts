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
  identifier: z.string().optional(),
  subtitle: z.string().optional(),
  metadata: z.array(z.string()).optional(),
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
          startYear: z.number().int().positive().optional(),
          endYear: z.number().int().positive().optional(),
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
      billId: z.string().optional(),
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
  fields: z.array(z.object({ label: z.string(), value: z.string(), detail: z.string().optional() })),
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

function chamberLabel(record: Record<string, unknown>) {
  const labels: Record<string, string> = {
    lower: "House",
    upper: "Senate",
    unicameral: "Legislature",
    legislature: "Legislature"
  }
  const chamber = text(record, "chamber")
  return [text(record, "jurisdictionName"), chamber ? (labels[chamber] ?? chamber) : undefined]
    .filter(Boolean)
    .join(" ")
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
  const metadata: string[] = []
  const addText = (label: string, value: string | undefined, detail?: string) => {
    if (value) {
      fields.push({ label, value, detail })
    }
  }
  const addDate = (label: string, value: unknown) => {
    const date = z.union([z.iso.date(), z.iso.datetime({ offset: true }), z.date()]).safeParse(value)
    if (date.success) {
      fields.push({
        label,
        value: date.data instanceof Date ? date.data.toISOString().slice(0, 10) : date.data.slice(0, 10)
      })
    }
  }
  const addCount = (label: string, value: unknown, detail?: string) => {
    const count = z.number().int().nonnegative().safeParse(value)
    if (count.success) {
      fields.push({ label, value: String(count.data), detail })
    }
  }
  if (kind === "bill") {
    addDate("Introduced", record.introducedDate ?? record.introducedAt)
    addCount("Versions", record.versionCount)
  }
  if (kind === "document" || kind === "material") {
    addCount("Sections", record.sectionCount ?? container.sectionCount)
    addCount("Pages", record.pageCount ?? record.ocrPageCount)
    const contentType = text(record, "contentType") ?? text(record, "mimeType")
    if (
      contentType &&
      ["application/xml", "text/xml", "text/html", "application/xhtml+xml", "text/plain"].includes(
        contentType.split(";", 1)[0]!.trim().toLowerCase()
      ) &&
      !fields.some((field) => field.label === "Pages")
    ) {
      addText("Pages", "Not paginated")
    }
    const formats: Record<string, string> = {
      "application/pdf": "PDF",
      "application/xml": "XML",
      "text/xml": "XML",
      "text/html": "HTML",
      "application/xhtml+xml": "HTML",
      "text/plain": "Text"
    }
    if (contentType) {
      metadata.push(formats[contentType] ?? contentType)
    }
    addText("Status", record.processingStatus === "processed" ? "Text available" : undefined)
  }
  if (kind === "meeting") {
    for (const [label, collection, countKey] of [
      ["Agenda items", "agendaItems", "agendaItemCount"],
      ["Documents", "documents", "documentCount"]
    ]) {
      const rows = z.array(z.object({ eventId: z.literal(id) })).safeParse(container[collection])
      let count = record[countKey]
      if (count === undefined && rows.success && container.truncated !== true) {
        count = rows.data.length
      }
      addCount(label, count, record.canonicalFactsComplete === false ? "Recorded" : undefined)
    }
  }
  if (kind === "organization") {
    const count = z.number().int().nonnegative().safeParse(record.recordedMemberCount)
    if (count.success && (count.data > 0 || record.membershipRelationsComplete === true)) {
      addCount(
        "Members",
        count.data,
        record.membershipRelationsComplete === true ? undefined : "Recorded active members"
      )
    } else {
      addCount("Members", record.memberCount)
    }
    addText("Chair", text(record, "chairName"))
    const next = recordSchema.safeParse(container.nextMeeting)
    if (next.success) {
      const meeting = projectCard(next.data, "meeting", "event")
      const date = meeting?.meetingSummary?.startAt
      addText("Next meeting", meeting?.subtitle ?? (date ? `${date.slice(0, 10)} (UTC)` : undefined))
    } else if (container.nextMeeting === null) {
      addText("Next meeting", "None recorded")
    }
  }
  if (kind === "person") {
    const count = z.number().int().positive().safeParse(record.recordedCommitteeRoleCount)
    if (count.success) {
      addCount("Committee roles", count.data, "Recorded active roles")
    }
    addDate("In office since", record.inOfficeSince)
    if (!fields.some((field) => field.label === "In office since")) {
      addCount("In office since", record.inOfficeSinceYear)
    }
  }
  if (kind === "amendment") {
    addText("Bill", text(record, "billIdentifier"), text(record, "billTitle"))
    const actions = z
      .array(z.object({ amendmentId: z.literal(id), actionDate: z.iso.date().nullish(), description: z.string() }))
      .safeParse(container.actions)
    if (actions.success && container.truncated !== true) {
      const date = actions.data
        .flatMap((action) => (action.actionDate ? [action.actionDate] : []))
        .sort()
        .at(-1)
      if (date) {
        const descriptions = new Set(
          actions.data.filter((action) => action.actionDate === date).map((action) => action.description)
        )
        addText("Latest action", date, descriptions.size === 1 ? [...descriptions][0] : undefined)
      }
    }
  }
  if (kind === "material") {
    const links = z
      .array(
        z.object({
          materialId: z.literal(id),
          billIdentifier: z.string().nullish(),
          amendmentIdentifier: z.string().nullish(),
          meetingName: z.string().nullish(),
          organizationName: z.string().nullish()
        })
      )
      .safeParse(container.links)
    if (links.success) {
      const names = [
        ...new Set(
          links.data.flatMap((link) =>
            [link.billIdentifier, link.amendmentIdentifier, link.meetingName, link.organizationName].filter(
              (name): name is string => typeof name === "string"
            )
          )
        )
      ]
      addText("Attached to", names[0], names.slice(1).join(", ") || undefined)
    }
  }
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
      metadata.push(...[chamberLabel(record), sessionName].filter((value): value is string => Boolean(value)))
      const sponsor = text(record, "sponsorName")
      const sponsorCount = z.number().int().positive().safeParse(record.sponsorCount)
      if (sponsor) {
        metadata.push(
          sponsorCount.success && sponsorCount.data > 1 ? `${sponsor} and ${sponsorCount.data - 1} others` : sponsor
        )
      }
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
      subtitle = [text(record, "jurisdictionName"), text(record, "party")].filter(Boolean).join(", ") || undefined
      personSummary = { isActive: typeof record.isActive === "boolean" ? record.isActive : undefined }
      const terms = z
        .array(
          z.object({
            chamber: z.string().nullish(),
            district: z.string().nullish(),
            officeTitle: z.string().nullish(),
            startDate: z.iso.date().nullish(),
            endDate: z.iso.date().nullish(),
            startYear: z.number().int().positive().nullish(),
            endYear: z.number().int().positive().nullish(),
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
            startYear: term.startYear ?? undefined,
            endYear: term.endYear ?? undefined,
            isActive: term.isActive ?? undefined
          }
          subtitle =
            [term.officeTitle, term.district ? `District ${term.district}` : undefined, text(record, "party")]
              .filter(Boolean)
              .join(", ") || undefined
        }
      }
      const term = personSummary.term
      const office = [term?.officeTitle, term?.district ? `District ${term.district}` : undefined]
        .filter(Boolean)
        .join(", ")
      metadata.push(
        ...[chamberLabel({ ...record, chamber: term?.chamber }), office, text(record, "party")].filter(
          (value): value is string => Boolean(value)
        )
      )
      break
    }
    case "organization":
      subtitle = [text(record, "jurisdictionName"), text(record, "chamber")].filter(Boolean).join(", ") || undefined
      organizationSummary = {
        classification: text(record, "classification"),
        description: text(record, "description"),
        isActive: typeof record.isActive === "boolean" ? record.isActive : undefined
      }
      metadata.push(chamberLabel(record))
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
        location: location.success
          ? (text(location.data, "name") ?? text(location.data, "room") ?? text(location.data, "address"))
          : undefined,
        status: text(record, "status")
      }
      subtitle = formatMeetingWhen(meetingSummary)
      if (location.success) {
        addText("Location detail", text(location.data, "building"))
      }
      const participants = z
        .array(
          z.object({
            participant: z.object({ eventId: z.literal(id) }),
            organization: z.object({ name: z.string() }).nullish()
          })
        )
        .safeParse(container.participants)
      if (subtitle) {
        metadata.push(subtitle)
      }
      if (participants.success) {
        metadata.push(
          ...new Set(participants.data.flatMap((item) => (item.organization ? [item.organization.name] : [])))
        )
      }
      if (!subtitle && meetingSummary.startAt) {
        metadata.unshift(
          `${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(meetingSummary.startAt))} UTC`
        )
      }
      break
    }
    case "document": {
      const date = z.iso.date().safeParse(record.documentDate)
      documentSummary = {
        billId: text(record, "billId"),
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
      metadata.unshift(...[documentSummary.sourceHost, subtitle].filter((value): value is string => Boolean(value)))
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
      metadata.push(
        ...[chamberLabel(record), amendmentSummary.sponsorName].filter((value): value is string => Boolean(value))
      )
      break
    }
    case "vote":
      subtitle = text(record, "heldDate") ?? text(record, "heldAt")
      if (text(record, "organizationName")) {
        metadata.push(text(record, "organizationName")!)
      }
      if (subtitle) {
        const date = new Date(subtitle)
        if (!Number.isNaN(date.getTime())) {
          metadata.push(new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date))
        }
      }
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
    identifier:
      text(record, "identifier") ??
      text(record, "printedIdentifier") ??
      (kind === "document" ? text(record, "billIdentifier") : undefined),
    subtitle,
    metadata: metadata.filter(Boolean),
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
