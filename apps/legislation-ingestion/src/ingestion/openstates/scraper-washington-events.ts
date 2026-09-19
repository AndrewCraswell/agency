import { legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"
import { normalizeOpenStatesEvent } from "./events.js"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"
import { scraperEventBillReferences } from "./scraper-event-bill-references.js"

const host = z.object({
  id: z.string().regex(/^[1-9][0-9]*$/),
  agency: z.enum(["House", "Senate", "Joint", "Agency", "Other"]),
  code: z.string().regex(/^[A-Z0-9&]+$/),
  name: z.string().trim().min(1)
})
const recordSchema = z
  .object({
    upstream_id: z.string().regex(/^[1-9][0-9]*$/),
    start_date: z
      .string()
      .transform((value) => value.replace(" ", "T"))
      .pipe(z.iso.datetime({ offset: true })),
    status: z.enum(["confirmed", "cancelled"]),
    sources: z.array(z.object({ url: z.url() })),
    extras: z.object({ agendaId: z.string(), committees: z.array(host).min(1) }),
    participants: z.array(
      z.object({ name: z.string(), entity_type: z.literal("committee"), note: z.literal("host") }).passthrough()
    ),
    agenda: z.array(z.record(z.string(), z.unknown()))
  })
  .passthrough()

const pacific = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
})

/** Canonical preparation only. Execution/archives must independently prove complete source-window coverage. */
export function normalizeWashingtonScraperEvents(
  records: readonly unknown[],
  input: {
    start: string
    end: string
    retrievedAt: Date
  }
) {
  const start = z.iso.date().parse(input.start)
  const end = z.iso.date().parse(input.end)
  z.date().parse(input.retrievedAt)
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000
  if (days < 0 || days > 6 || start < "2025-01-01" || end > "2026-12-31") {
    throw new Error("Washington meeting window is outside the reviewed session or batch bound")
  }
  const seen = new Set<string>()
  return records.map((raw) => {
    const record = recordSchema.parse(raw)
    const expectedSource = `https://app.leg.wa.gov/committeeschedules/Home/Agenda/${record.upstream_id}`
    if (
      record.extras.agendaId !== record.upstream_id ||
      seen.has(record.upstream_id) ||
      !record.sources.some((source) => source.url === expectedSource)
    ) {
      throw new Error("Washington meeting lacks a unique matching official agenda identity")
    }
    seen.add(record.upstream_id)
    const day = record.start_date.slice(0, 10)
    const timestamp = new Date(record.start_date)
    if (day < start || day > end || pacific.format(timestamp).replace(" ", "T") !== record.start_date.slice(0, 19)) {
      throw new Error("Washington meeting clock disagrees with Pacific time or requested window")
    }
    const hosts = record.extras.committees
    if (
      new Set(hosts.map((entry) => entry.id)).size !== hosts.length ||
      record.participants.length !== hosts.length ||
      hosts.some((entry, index) => record.participants[index]?.name !== entry.name)
    ) {
      throw new Error("Washington meeting host identities disagree with participants")
    }
    const result = normalizeOpenStatesEvent(
      {
        ...record,
        id: `wa-agenda-${record.upstream_id}`,
        timezone: "America/Los_Angeles",
        sources: [{ url: expectedSource }],
        participants: record.participants.map((entry) => ({ ...entry, organization: null })),
        agenda: record.agenda.map((entry, order) => ({ ...entry, order }))
      },
      { jurisdictionCode: "wa", retrievedAt: input.retrievedAt }
    )
    result.event.sourceId = record.upstream_id
    result.event.upstreamIds = { washingtonAgenda: record.upstream_id }
    result.event.sourceIsOfficial = true
    result.event.sessionRelationsComplete = true
    result.sessionIds = [legislativeSessionId("wa", scraperBillProfiles.wa.session)]
    result.organizationReferences = hosts.flatMap((entry) =>
      entry.agency === "House" || entry.agency === "Senate"
        ? [`waCommittee:${entry.agency.toLowerCase()}:${entry.code}`]
        : []
    )
    result.event.organizationRelationsComplete = result.organizationReferences.length === hosts.length
    result.event.canonicalFactsComplete = true
    for (const [order, item] of record.agenda.entries()) {
      const agenda = result.agendaItems.find((entry) => entry.agendaItem.ordinal === order)
      if (agenda)
        agenda.billReferences = scraperEventBillReferences(item.related_entities ?? [], {
          state: "wa",
          session: scraperBillProfiles.wa.session,
          identifier: scraperBillProfiles.wa.identifier
        })
    }
    return result
  })
}
