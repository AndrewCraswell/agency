import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { resolveAgendaBillReferences } from "../../persistence/event-bill-references.js"
import { resolveEventOrganizationReferences } from "../../persistence/event-organization-references.js"
import { archiveScraperAttempt } from "./scraper-archive.js"
import { retainEventWindowPlan } from "./scraper-event-window-plan.js"
import {
  normalizeWashingtonScraperEvents,
  prepareWashingtonEventWindow,
  preparePlannedWashingtonEventWindow
} from "./scraper-washington-events.js"

const context = { start: "2025-01-13", end: "2025-01-19", retrievedAt: new Date("2026-09-19T00:00:00Z") }
it("resolves renamed committee codes through the same scoped publisher ID", () => {
  const raw = fixture()
  raw.extras.committees = [{ id: "34080", agency: "Senate", code: "LGLT", name: "Prior publisher name" }]
  raw.participants[0]!.name = "Prior publisher name"
  const snapshots = normalizeWashingtonScraperEvents([raw], context)
  const candidate = {
    id: "organization:local-government",
    jurisdictionId: "jurisdiction:wa",
    upstreamIds: { "waCommitteeId:2025-26:senate:34080": "retained-source", "waCommittee:senate:LGV": "roster" }
  }
  const [resolved] = resolveEventOrganizationReferences(snapshots, [candidate])
  expect(resolved?.event.organizationRelationsComplete).toBe(true)
  expect(resolved?.organizationIds).toEqual([candidate.id])
  expect(
    resolveEventOrganizationReferences(snapshots, [
      { ...candidate, upstreamIds: { "waCommitteeId:2023-24:senate:34080": "other-session" } }
    ])[0]?.event.organizationRelationsComplete
  ).toBe(false)
})
function fixture() {
  return {
    _id: "temporary-extraction-uuid",
    upstream_id: "32346",
    name: "House Education",
    start_date: "2025-01-14T13:30:00-08:00",
    status: "cancelled",
    classification: "committee-meeting",
    sources: [{ url: "https://app.leg.wa.gov/committeeschedules/Home/Agenda/32346" }],
    extras: {
      publisher_start_date: "2025-01-14T13:30:00-08:00",
      agendaId: "32346",
      committees: [{ id: "31641", agency: "House", code: "ED", name: "House Education" }]
    },
    participants: [
      { name: "House Education", entity_type: "committee", note: "host", organization: { id: "untrusted" } }
    ],
    agenda: [
      { description: "Agency briefing mentions HB 9999", related_entities: [] },
      {
        description: "Testimony",
        related_entities: [{ entity_type: "bill", name: "HB 1000", bill_id: '~{"identifier":"HB 1000"}' }]
      }
    ]
  }
}

it.each(["Joint", "House", "Senate", "Other", "Agency"])(
  "retains %s hosts without abbreviations without inventing organization links",
  (agency) => {
    const raw = fixture()
    raw.extras.committees[0]!.agency = agency
    raw.extras.committees[0]!.code = ""
    const [snapshot] = normalizeWashingtonScraperEvents([raw], context)
    expect(snapshot?.organizationReferences).toEqual([[`waCommitteeId:2025-26:${agency.toLowerCase()}:31641`]])
    expect(resolveEventOrganizationReferences([snapshot!], [])[0]?.event.organizationRelationsComplete).toBe(false)
    expect(snapshot?.event.sourceId).toBe("32346")
    expect(snapshot?.event.sourceIsOfficial).toBe(true)
  }
)

it.each(["Other", "Agency"])("resolves %s hosts only by exact accepted publisher identity", (agency) => {
  const raw = fixture()
  raw.extras.committees[0] = { id: "21488", agency, code: "I900", name: "Publisher host" }
  raw.participants[0]!.name = "Publisher host"
  const rows = normalizeWashingtonScraperEvents([raw], context)
  const reference = `waCommitteeId:2025-26:${agency.toLowerCase()}:21488`
  expect(rows[0]?.organizationReferences).toEqual([[reference]])
  const candidate = {
    id: "organization:accepted-host",
    jurisdictionId: "jurisdiction:wa",
    upstreamIds: { [reference]: "retained publisher evidence" }
  }
  const [resolved] = resolveEventOrganizationReferences(rows, [candidate])
  expect(resolved?.organizationIds).toEqual([candidate.id])
  expect(resolved?.event.organizationRelationsComplete).toBe(true)
  for (const candidates of [
    [],
    [{ ...candidate, jurisdictionId: "jurisdiction:ak" }],
    [{ ...candidate, upstreamIds: { [`waCommittee:${agency.toLowerCase()}:I900`]: "code alone" } }],
    [{ ...candidate, upstreamIds: { [`waCommitteeId:2023-24:${agency.toLowerCase()}:21488`]: "wrong biennium" } }],
    [candidate, { ...candidate, id: "organization:ambiguous" }]
  ]) {
    const [held] = resolveEventOrganizationReferences(rows, candidates)
    expect(held?.organizationIds).toEqual([])
    expect(held?.event.organizationRelationsComplete).toBe(false)
  }
})

it("still rejects malformed nonempty abbreviations", () => {
  const raw = fixture()
  raw.extras.committees[0]!.code = "invalid/code"
  expect(() => normalizeWashingtonScraperEvents([raw], context)).toThrow()
})

async function archivedWindow(ids: string[], records: unknown[]) {
  const objects = new Map<string, Uint8Array>()
  const store = {
    exists: async (path: string) => objects.has(path),
    read: async (path: string) => {
      const bytes = objects.get(path)
      if (!bytes) throw new Error("missing")
      return bytes
    },
    put: async (path: string, bytes: Uint8Array) => {
      if (objects.has(path)) return false
      objects.set(path, bytes)
      return true
    }
  }
  const entries = [
    {
      path: "_data/wa/meeting_window.json",
      value: {
        start: context.start,
        end: context.end,
        complete: true,
        source_url: `https://wslwebservices.leg.wa.gov/CommitteeMeetingService.asmx/GetCommitteeMeetings?beginDate=${context.start}&endDate=${context.end}`,
        source_sha256: "b".repeat(64),
        agenda_ids: ids
      }
    },
    ...records.map((value, index) => ({ path: `_data/wa/event_${index}.json`, value }))
  ]
  const files = entries.map(({ path, value }) => {
    const bytes = Buffer.from(JSON.stringify(value))
    objects.set(path, bytes)
    return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }
  })
  const revision = "d43f853796ceeeb49205f7d144790647764ce105"
  objects.set(
    "attempt.json",
    Buffer.from(
      JSON.stringify({
        work_directory: "/tmp/test",
        status: "extracted",
        exit_code: 0,
        reason: null,
        revision,
        canonical_writes: false,
        semantically_validated: false,
        build_inputs_sha256: "a".repeat(64),
        files,
        request: {
          jurisdiction: "wa",
          domain: "events",
          session: "2025-2026",
          bill_ids: null,
          timeout_seconds: 600,
          revision,
          event_window: { start: context.start, end: context.end }
        }
      })
    )
  )
  const retained = await archiveScraperAttempt(store, store, "wa-events-test")
  return { store, manifestPath: retained.manifestPath, approvedBuild: "a".repeat(64), retrievedAt: context.retrievedAt }
}

it("admits complete retained windows, including empty windows, but never partial inventories", async () => {
  expect((await prepareWashingtonEventWindow(await archivedWindow(["32346"], [fixture()]))).snapshots).toHaveLength(1)
  const empty = await prepareWashingtonEventWindow(await archivedWindow([], []))
  expect(empty.snapshots).toEqual([])
  expect(empty.completeSnapshot).toBe(false)
  for (const [ids, records] of [
    [["32346"], []],
    [[], [fixture()]],
    [["32346", "32346"], [fixture()]]
  ] as const)
    await expect(prepareWashingtonEventWindow(await archivedWindow([...ids], [...records]))).rejects.toThrow()
  const input = await archivedWindow(["32346"], [fixture()])
  await expect(prepareWashingtonEventWindow({ ...input, approvedBuild: "c".repeat(64) })).rejects.toThrow(/approved/)
})

it("binds even empty extractions to the exact frozen work item", async () => {
  const input = await archivedWindow([], [])
  const { path, plan } = await retainEventWindowPlan(input.store, {
    jurisdiction: "wa",
    session: "2025-2026",
    cycle: "test",
    start: context.start,
    end: "2025-01-26",
    daysPerWindow: 7
  })
  const prepared = await preparePlannedWashingtonEventWindow({
    ...input,
    planPath: path,
    windowId: plan.windows[0]!.id
  })
  expect(prepared.planId).toBe(plan.id)
  expect(prepared.snapshots).toEqual([])
  await expect(
    preparePlannedWashingtonEventWindow({ ...input, planPath: path, windowId: plan.windows[1]!.id })
  ).rejects.toThrow(/does not match/)
  await expect(preparePlannedWashingtonEventWindow({ ...input, planPath: path, windowId: "unknown" })).rejects.toThrow(
    /not in/
  )
})

describe("Washington shared event preparation", () => {
  it("accepts signed publisher committee IDs and emits joint references for canonical resolution", () => {
    const record = fixture()
    record.extras.committees = [
      { id: "-5", agency: "Joint", code: "JLARC", name: "Joint Legislative Audit & Review Committee" }
    ]
    record.participants[0]!.name = record.extras.committees[0]!.name
    const [row] = normalizeWashingtonScraperEvents([record], context)
    expect(row?.organizationReferences).toEqual([["waCommitteeId:2025-26:joint:-5", "waCommittee:joint:JLARC"]])
    expect(row?.organizationIds).toEqual([])
    expect(row?.event.organizationRelationsComplete).toBe(true)
    expect(resolveEventOrganizationReferences([row!], [])[0]?.event.organizationRelationsComplete).toBe(false)
    const candidate = {
      id: "organization:fixture:joint",
      jurisdictionId: "jurisdiction:wa",
      upstreamIds: { "waCommittee:joint:JLARC": "https://leg.wa.gov/about-the-legislature/committees/joint/jlarc" }
    }
    expect(resolveEventOrganizationReferences([row!], [candidate])[0]?.organizationIds).toEqual([candidate.id])
    for (const id of ["0", "-0", "-05", "+5", "5.0", "", "--5"]) {
      record.extras.committees[0]!.id = id
      expect(() => normalizeWashingtonScraperEvents([record], context)).toThrow()
    }
  })
  it("preserves publisher date when UTC serialization crosses midnight", () => {
    const [row] = normalizeWashingtonScraperEvents(
      [
        {
          ...fixture(),
          start_date: "2025-01-15T00:00:00+00:00",
          extras: { ...fixture().extras, publisher_start_date: "2025-01-14T16:00:00-08:00" }
        }
      ],
      { ...context, start: "2025-01-14", end: "2025-01-14" }
    )
    expect(row?.event.publisherLocalDate).toBe("2025-01-14")
    expect(row?.event.startAt?.toISOString()).toBe("2025-01-15T00:00:00.000Z")
  })
  it("preserves cancellations, non-bill agenda, provenance and publisher time", () => {
    const [row] = normalizeWashingtonScraperEvents([fixture()], context)
    expect(row?.event).toMatchObject({
      status: "cancelled",
      sourceId: "32346",
      publisherLocalDate: "2025-01-14",
      timezone: "America/Los_Angeles",
      sourceIsOfficial: true
    })
    expect(row?.event.startAt?.toISOString()).toBe("2025-01-14T21:30:00.000Z")
    expect(row?.agendaItems).toHaveLength(2)
    expect(row?.agendaItems[0]?.billReferences).toEqual([])
    expect(row?.agendaItems[1]?.billReferences).toEqual([
      { identifier: "HB 1000", jurisdictionId: "jurisdiction:wa", sessionId: "session:wa:2025-2026" }
    ])
    expect(row?.participants[0]?.organizationId).toBeUndefined()
    expect(row?.organizationReferences).toEqual([["waCommitteeId:2025-26:house:31641", "waCommittee:house:ED"]])
  })
  it("reuses relationship resolvers and refuses unresolved or ambiguous identities", () => {
    const rows = normalizeWashingtonScraperEvents([fixture()], context)
    const resolved = resolveEventOrganizationReferences(rows, [
      { id: "org-ed", jurisdictionId: "jurisdiction:wa", upstreamIds: { "waCommittee:house:ED": "source" } }
    ])
    expect(resolved[0]?.organizationIds).toEqual(["org-ed"])
    expect(resolveEventOrganizationReferences(rows, [])[0]?.event.organizationRelationsComplete).toBe(false)
    const bills = resolveAgendaBillReferences(rows, [
      { id: "bill", identifier: "HB1000", jurisdictionId: "jurisdiction:wa", sessionId: "session:wa:2025-2026" }
    ])
    expect(bills[0]?.agendaItems[1]?.billIds).toEqual(["bill"])
  })
  it("keeps meeting identity when a new extraction changes UUID, title or scheduled time", () => {
    const [first] = normalizeWashingtonScraperEvents([fixture()], context)
    const [changed] = normalizeWashingtonScraperEvents(
      [
        {
          ...fixture(),
          _id: "new-uuid",
          name: "New title",
          start_date: "2025-01-15T14:00:00-08:00",
          extras: { ...fixture().extras, publisher_start_date: "2025-01-15T14:00:00-08:00" }
        }
      ],
      context
    )
    expect(changed?.event.id).toBe(first?.event.id)
  })
  it("rejects invalid source identity, duplicate meetings, clock offsets and scope", () => {
    for (const change of [
      { sources: [{ url: "https://example.org/32346" }] },
      { sources: [{ url: fixture().sources[0]!.url + "?token=untrusted" }] },
      { start_date: "2025-01-14T13:30:00-05:00" },
      { start_date: "2025-01-20T13:30:00-08:00" },
      { participants: [] }
    ])
      expect(() => normalizeWashingtonScraperEvents([{ ...fixture(), ...change }], context)).toThrow()
    expect(() => normalizeWashingtonScraperEvents([fixture(), fixture()], context)).toThrow(/unique/)
    expect(() => normalizeWashingtonScraperEvents([], { ...context, end: "2025-01-20" })).toThrow(/seven/)
    expect(() => normalizeWashingtonScraperEvents([], { ...context, start: "2024-01-01", end: "2024-01-01" })).toThrow(
      /session/
    )
  })
})
