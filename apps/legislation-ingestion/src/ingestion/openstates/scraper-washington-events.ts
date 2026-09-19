import { legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { normalizeOpenStatesEvent } from "./events.js"
import { assertSuccessfulScraperAttempt, readArchivedScraperAttempt } from "./scraper-archive.js"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"
import { scraperEventBillReferences } from "./scraper-event-bill-references.js"
import { readEventWindowPlan } from "./scraper-event-window-plan.js"
import { washingtonEventWindow } from "./scraper-event-window.js"

/** Bind retained extraction to the exact immutable work item before any canonical writes. */
export async function preparePlannedWashingtonEventWindow(input: {
  store: Pick<ArtifactStore, "read">
  planPath: string
  windowId: string
  manifestPath: string
  approvedBuild: string
  retrievedAt: Date
}) {
  const plan = await readEventWindowPlan(input.store, input.planPath)
  if (plan.scope.jurisdiction !== "wa" || plan.scope.session !== scraperBillProfiles.wa.session) {
    throw new Error("Meeting plan is outside the reviewed Washington session")
  }
  const selected = plan.windows.find((entry) => entry.id === input.windowId)
  if (!selected) throw new Error("Meeting window is not in the retained plan")
  washingtonEventWindow.parse(selected.window)
  const prepared = await prepareWashingtonEventWindow(input)
  if (prepared.window.start !== selected.window.start || prepared.window.end !== selected.window.end) {
    throw new Error("Retained extraction does not match the planned meeting window")
  }
  return { ...prepared, planId: plan.id, windowId: selected.id }
}

/** A successful child must cover exactly the publisher inventory, including cancellations and empty windows. */
export async function prepareWashingtonEventWindow(input: {
  store: Pick<ArtifactStore, "read">
  manifestPath: string
  approvedBuild: string
  retrievedAt: Date
}) {
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.approvedBuild)
  const archive = await readArchivedScraperAttempt(input.store, input.manifestPath)
  const attempt = archive.attempt
  if (
    attempt.build_inputs_sha256 !== input.approvedBuild ||
    attempt.request.jurisdiction !== "wa" ||
    attempt.request.domain !== "events"
  ) {
    throw new Error("Washington meeting window is not an approved successful extraction")
  }
  assertSuccessfulScraperAttempt(attempt)
  const window = washingtonEventWindow.parse(attempt.request.event_window)
  const report = z
    .object({
      start: z.string(),
      end: z.string(),
      complete: z.literal(true),
      source_url: z.string(),
      source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      agenda_ids: z.array(z.string().regex(/^[1-9][0-9]*$/))
    })
    .parse(archive.records.find((entry) => entry.path === "_data/wa/meeting_window.json")?.value)
  const expectedUrl = `https://wslwebservices.leg.wa.gov/CommitteeMeetingService.asmx/GetCommitteeMeetings?beginDate=${window.start}&endDate=${window.end}`
  if (
    report.start !== window.start ||
    report.end !== window.end ||
    report.source_url !== expectedUrl ||
    new Set(report.agenda_ids).size !== report.agenda_ids.length
  ) {
    throw new Error("Washington meeting inventory differs from requested window")
  }
  const snapshots = normalizeWashingtonScraperEvents(
    archive.records.filter((entry) => entry.path.startsWith("_data/wa/event_")).map((entry) => entry.value),
    { ...window, retrievedAt: input.retrievedAt }
  )
  if (
    JSON.stringify(snapshots.map((row) => row.event.sourceId).sort()) !== JSON.stringify([...report.agenda_ids].sort())
  ) {
    throw new Error("Washington meeting window is missing or contains extra agenda records")
  }
  return { snapshots, window, completeWindow: true as const, completeSnapshot: false as const }
}

const host = z.object({
  // Publisher identities are signed: joint committees include negative IDs.
  id: z.string().regex(/^-?[1-9][0-9]*$/),
  agency: z.enum(["House", "Senate", "Joint", "Agency", "Other"]),
  // Some publisher hosts have no abbreviation. Their ID/name remain evidence, not a fabricated roster link.
  code: z.string().regex(/^[A-Z0-9&]*$/),
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
    extras: z.object({
      agendaId: z.string(),
      committees: z.array(host).min(1),
      publisher_start_date: z.iso.datetime({ offset: true })
    }),
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
  const { start, end } = washingtonEventWindow.parse({ start: input.start, end: input.end })
  z.date().parse(input.retrievedAt)
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
    const publisherDate = record.extras.publisher_start_date
    const day = publisherDate.slice(0, 10)
    const timestamp = new Date(record.start_date)
    if (
      day < start ||
      day > end ||
      Date.parse(publisherDate) !== timestamp.getTime() ||
      pacific.format(timestamp).replace(" ", "T") !== publisherDate.slice(0, 19)
    ) {
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
        start_date: publisherDate,
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
      entry.agency === "House" || entry.agency === "Senate" || entry.agency === "Joint"
        ? [
            [
              `waCommitteeId:${scraperBillProfiles.wa.biennium}:${entry.agency.toLowerCase()}:${entry.id}`,
              ...(entry.code.length > 0 ? [`waCommittee:${entry.agency.toLowerCase()}:${entry.code}`] : [])
            ]
          ]
        : []
    )
    result.event.organizationRelationsComplete = result.organizationReferences.length === hosts.length
    result.event.canonicalFactsComplete = true
    for (const [order, item] of record.agenda.entries()) {
      const agenda = result.agendaItems.find((entry) => entry.agendaItem.ordinal === order)
      if (agenda) {
        const references = scraperEventBillReferences(item.related_entities, {
          state: "wa",
          session: scraperBillProfiles.wa.session,
          identifier: scraperBillProfiles.wa.identifier
        })
        agenda.billReferences = references.references
        agenda.billReferencesComplete = references.complete
      }
    }
    return result
  })
}
