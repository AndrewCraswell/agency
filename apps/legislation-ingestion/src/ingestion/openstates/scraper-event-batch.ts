import { createHash } from "node:crypto"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { normalizeOpenStatesEvent } from "./events.js"
import { readArchivedScraperAttempt } from "./scraper-archive.js"
import { scraperEventBillReferences } from "./scraper-event-bill-references.js"

const eventSchema = z
  .object({
    upstream_id: z.string().regex(/^[HSJ]:[A-Z0-9&]+:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/),
    start_date: z.iso.datetime({ offset: true }),
    sources: z.array(z.object({ url: z.url() })),
    participants: z.array(z.record(z.string(), z.unknown())).default([]),
    agenda: z.array(z.record(z.string(), z.unknown())).default([])
  })
  .passthrough()

export function normalizeAlaskaScraperEvent(input: unknown, retrievedAt: Date) {
  const record = eventSchema.parse(input)
  const [chamber, sponsor, ...timestampParts] = record.upstream_id.split(":")
  const timestamp = timestampParts.join(":")
  if (Date.parse(timestamp) !== Date.parse(record.start_date)) {
    throw new Error("Alaska meeting timestamp disagrees with occurrence identity")
  }
  const expectedMeeting = `${chamber}${sponsor} ${timestamp.slice(0, 10)} ${timestamp.slice(11, 19)}`
  const source = record.sources.find(({ url }) => {
    const parsed = new URL(url)
    return (
      parsed.origin === "https://www.akleg.gov" &&
      parsed.pathname === "/basis/Meeting/Detail" &&
      parsed.searchParams.get("Meeting") === expectedMeeting
    )
  })
  if (!source) {
    throw new Error("Alaska meeting lacks matching official occurrence source")
  }
  const id = `ak-meeting-34-${createHash("sha256").update(record.upstream_id).digest("hex")}`
  const result = normalizeOpenStatesEvent(
    {
      ...record,
      id,
      start_date: timestamp,
      timezone: "America/Anchorage",
      sources: [source],
      participants: record.participants.map((participant) => ({ ...participant, organization: null })),
      agenda: record.agenda.map((item, order) => ({ ...item, order }))
    },
    { jurisdictionCode: "ak", retrievedAt }
  )
  result.event.sourceId = record.upstream_id
  result.event.upstreamIds = { alaskaMeetingOccurrence: record.upstream_id, session: "34" }
  result.sessionIds = ["session:ak:34"]
  result.organizationReferences = [`akCommittee:34:${chamber}${sponsor}`]
  // This adapter is admitted only for the verified Legislature 34 extraction lane.
  // A single explicit host is the source's organization set, not a name-based canonical match.
  const host = z.object({ entity_type: z.literal("committee"), note: z.literal("host"), name: z.string().min(1) })
  const hostDeclared = record.participants.length === 1 && host.safeParse(record.participants[0]).success
  result.event.sessionRelationsComplete = true
  result.event.organizationRelationsComplete = hostDeclared
  result.event.canonicalFactsComplete =
    hostDeclared &&
    result.event.provenanceComplete === true &&
    !["HOUSE", "SENATE", "JOINT"].includes(result.event.name.trim())
  for (const [ordinal, item] of record.agenda.entries()) {
    const agenda = result.agendaItems.find((entry) => entry.agendaItem.ordinal === ordinal)
    if (!agenda) {
      continue
    }
    agenda.billReferences = scraperEventBillReferences(item.related_entities ?? [], {
      state: "ak",
      session: "34",
      identifier: /^[HS](?:B|R|JR|J|CR|SC|SCR) [1-9][0-9]{0,4}$/
    }).references
  }
  return result
}

/** Admits only the selected, verified batch. Never infers deletion from this partial snapshot. */
export async function prepareAlaskaEventBatch(
  store: Pick<ArtifactStore, "read">,
  manifestPath: string,
  approvedBuild: string,
  retrievedAt: Date
) {
  const archive = await readArchivedScraperAttempt(store, manifestPath)
  const { attempt } = archive
  if (
    attempt.status !== "extracted" ||
    attempt.build_inputs_sha256 !== approvedBuild ||
    attempt.request.jurisdiction !== "ak" ||
    attempt.request.domain !== "events" ||
    attempt.request.session !== "34"
  ) {
    throw new Error("Alaska event batch is not an approved successful extraction")
  }
  const selected = attempt.request.event_keys ?? []
  const reportRecord = archive.records.find((record) => record.path === "_data/ak/meeting_partition.json")
  const report = z
    .object({
      selected_occurrences: z.array(z.string()),
      complete_snapshot: z.boolean(),
      quarantined: z.array(z.object({ occurrence_key: z.string(), source_rows: z.array(z.string()).min(2) }))
    })
    .parse(reportRecord?.value)
  if (
    JSON.stringify([...selected].sort()) !== JSON.stringify([...report.selected_occurrences].sort()) ||
    report.quarantined.some((item) => selected.includes(item.occurrence_key))
  ) {
    throw new Error("Alaska event batch selection or quarantine mismatch")
  }
  const snapshots = archive.records
    .filter((record) => record.path.startsWith("_data/ak/event_"))
    .map((record) => normalizeAlaskaScraperEvent(record.value, retrievedAt))
  const keys = snapshots.map((snapshot) => snapshot.event.sourceId)
  if (
    !selected.length ||
    keys.length !== selected.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !selected.includes(key ?? ""))
  ) {
    throw new Error("Alaska event batch is missing or duplicates selected occurrences")
  }
  return { snapshots, quarantinedOccurrences: report.quarantined.length, completeSnapshot: false as const }
}
