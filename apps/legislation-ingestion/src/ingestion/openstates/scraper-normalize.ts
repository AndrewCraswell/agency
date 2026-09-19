import { isDeepStrictEqual } from "node:util"
import { childId, legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { northCarolinaCommitteeIdentifiers } from "./committee-identifiers.js"
import { normalizeOpenStatesEvent } from "./events.js"
import { normalizeOpenStatesBill } from "./normalize.js"
import { assertSuccessfulScraperAttempt, readArchivedScraperAttempt } from "./scraper-archive.js"
import { assertScraperBillBatchScope, readScraperBillPlan } from "./scraper-batches.js"
import { scraperBillProfiles } from "./scraper-bill-profiles.js"
import { readScraperBillDispatch } from "./scraper-dispatch.js"
import { scraperVoteChamberFromEvidence } from "./scraper-vote-chamber.js"
import { washingtonVoteEvidence } from "./scraper-washington-vote.js"

function explicitAlaskaOutcome(motion: string) {
  if (/\b(?:FAILED|NOT ADOPTED)\b/.test(motion)) {
    return "fail"
  }
  if (/\b(?:PASSED|ADOPTED)\b/.test(motion)) {
    return "pass"
  }
  return "unknown"
}

/** Official notice number survives title, time and location corrections; no calendar-row UUID is persisted. */
export function normalizeNcScraperEvents(records: readonly unknown[], retrievedAt: Date) {
  z.date().parse(retrievedAt)
  const seen = new Set<string>()
  return records.map((input) => {
    const record = z
      .object({
        upstream_id: z.string().regex(/^[1-9][0-9]*$/),
        status: z.string(),
        sources: z.array(z.object({ url: z.url({ protocol: /^https$/ }) })),
        participants: z.array(z.object({ name: z.string().min(1) }).passthrough()),
        agenda: z.array(z.record(z.string(), z.unknown()))
      })
      .passthrough()
      .parse(input)
    const prefix = `https://www.ncleg.gov/Committees/NoticeDocument/${record.upstream_id}/`
    const notice = record.sources.find((entry) => entry.url.startsWith(prefix))
    if (!notice || seen.has(record.upstream_id)) {
      throw new Error("Missing or duplicate NC meeting notice identity")
    }
    seen.add(record.upstream_id)
    const snapshot = normalizeOpenStatesEvent(
      {
        ...record,
        // Pinned upstream used "passed" solely when the scheduled time elapsed, not as an outcome observation.
        status: record.status === "passed" ? "other" : record.status,
        id: `nc-notice-${record.upstream_id}`,
        sources: [notice],
        participants: record.participants.map((entry) => ({ ...entry, organization: null })),
        agenda: record.agenda.map((entry, order) => ({ ...entry, order }))
      },
      { jurisdictionCode: "nc", retrievedAt }
    )
    snapshot.event.sourceId = record.upstream_id
    snapshot.event.upstreamIds = { ncNoticeDocument: record.upstream_id }
    snapshot.event.sessionRelationsComplete = true
    snapshot.sessionIds = [legislativeSessionId("nc", "2025")]
    const organizationReferences = Object.keys(northCarolinaCommitteeIdentifiers(record.sources))
    snapshot.event.organizationRelationsComplete = organizationReferences.length === 1
    snapshot.organizationReferences = organizationReferences
    return snapshot
  })
}

/** A retained extraction is evidence, not authorization; verify its exact lane and approved build before promotion. */
export async function prepareArchivedNcScraperEvents(input: {
  store: Pick<ArtifactStore, "read">
  manifestPath: string
  approvedBuildInputsSha256: string
  retrievedAt: Date
}) {
  const approved = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.approvedBuildInputsSha256)
  z.date().parse(input.retrievedAt)
  const archive = await readArchivedScraperAttempt(input.store, input.manifestPath)
  const { attempt, records } = archive
  if (attempt.build_inputs_sha256 !== approved) {
    throw new Error("Scraper build is not approved for corrected meeting facts")
  }
  assertSuccessfulScraperAttempt(attempt)
  if (
    attempt.request.jurisdiction !== "nc" ||
    attempt.request.domain !== "events" ||
    attempt.request.session !== null ||
    attempt.request.bill_ids !== null ||
    attempt.request.event_keys !== undefined
  ) {
    throw new Error("Scraper attempt is not a completed North Carolina event extraction")
  }
  const eventRecords = records
    .filter((record) => record.path.startsWith("_data/nc/event_"))
    .map((record) => record.value)
  return {
    status: "prepared" as const,
    canonicalWrites: false as const,
    provenance: {
      runId: archive.runId,
      manifestPath: input.manifestPath,
      manifestSha256: archive.manifestSha256,
      buildInputsSha256: approved
    },
    // The current-calendar scraper can legitimately emit no event records
    // between published notices. The caller treats that as a verified no-op;
    // it must never infer that previously observed meetings were deleted.
    snapshots: normalizeNcScraperEvents(eventRecords, input.retrievedAt)
  }
}

const source = z.object({ url: z.url({ protocol: /^https$/ }) })
const personReference = z.string().regex(/^ocd-person\/[a-f0-9-]{36}$/)
const position = z.object({ voter_name: z.string().min(1), voter_id: z.string().optional(), option: z.string().min(1) })
const voteSchema = z
  .object({
    _id: z.string().min(1),
    bill: z.string().min(1),
    sources: z.array(source).min(1),
    votes: z.array(position),
    counts: z.array(z.object({ option: z.string().min(1), value: z.number().int().nonnegative() })),
    result: z.string().min(1),
    motion_text: z.string().min(1),
    motion_classification: z.array(z.string())
  })
  .passthrough()
const billSchema = z
  .object({
    _id: z.string().min(1),
    legislative_session: z.string(),
    identifier: z.string(),
    title: z.string().min(1),
    sources: z.array(source).min(1),
    actions: z.array(
      z
        .object({ date: z.string().min(1), description: z.string().min(1), classification: z.array(z.string()) })
        .passthrough()
    ),
    sponsorships: z.array(
      z
        .object({
          name: z.string().min(1),
          primary: z.boolean(),
          classification: z.string(),
          person_id: z.string().nullable().optional()
        })
        .passthrough()
    ),
    versions: z.array(
      z
        .object({
          links: z.array(source.extend({ media_type: z.string().optional() })).min(1),
          note: z.string().optional()
        })
        .passthrough()
    )
  })
  .passthrough()

/** Raw UUIDs join records only within one extraction. Never persist them as provider identities. */
type NcBillInput = {
  bills: readonly unknown[]
  votes: readonly unknown[]
  requestedIds: readonly string[]
  retrievedAt: Date
}

export function normalizeNcScraperBills(input: NcBillInput) {
  return normalizeBills(input, false, "nc")
}

/** The approved fingerprint comes from deployment configuration, never the incoming attempt. */
export async function normalizeArchivedScraperBills(input: {
  store: Pick<ArtifactStore, "read">
  manifestPath: string
  approvedBuildInputsSha256: string
  retrievedAt: Date
}) {
  const archive = await readArchivedScraperAttempt(input.store, input.manifestPath)
  return normalizeVerifiedArchive(archive, input.approvedBuildInputsSha256, input.retrievedAt)
}

/** Preparation is read-only. A coordinator must still verify dispatch freshness and own the batch lease. */
export async function prepareArchivedScraperBillBatch(input: {
  store: Pick<ArtifactStore, "read">
  dispatchPath: string
  now: Date
  planPath: string
  batchId: string
  manifestPath: string
  approvedBuildInputsSha256: string
  retrievedAt: Date
}) {
  z.date().parse(input.retrievedAt)
  const dispatch = await readScraperBillDispatch(input.store, input.dispatchPath, input.now)
  if (dispatch.planPath !== input.planPath || dispatch.batchId !== input.batchId) {
    throw new Error("Scraper dispatch does not match requested batch")
  }
  const plan = await readScraperBillPlan(input.store, input.planPath)
  const archive = await readArchivedScraperAttempt(input.store, input.manifestPath)
  if (archive.runId !== dispatch.runId) {
    throw new Error("Scraper archive does not match dispatched attempt")
  }
  assertScraperBillBatchScope(plan, input.batchId, archive.attempt.request)
  const rows = normalizeVerifiedArchive(archive, input.approvedBuildInputsSha256, input.retrievedAt)
  return {
    status: "prepared" as const,
    canonicalWrites: false as const,
    scope: { jurisdiction: plan.jurisdiction, session: plan.session },
    provenance: {
      inventoryId: plan.inventoryId,
      cycleId: plan.cycleId,
      dispatchPath: input.dispatchPath,
      runId: dispatch.runId,
      batchId: input.batchId,
      manifestPath: input.manifestPath,
      manifestSha256: archive.manifestSha256,
      buildInputsSha256: input.approvedBuildInputsSha256
    },
    rows
  }
}

function normalizeVerifiedArchive(
  archive: Awaited<ReturnType<typeof readArchivedScraperAttempt>>,
  approvedBuildInputsSha256: string,
  retrievedAt: Date
) {
  const approved = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(approvedBuildInputsSha256)
  const { attempt, records } = archive
  if (attempt.build_inputs_sha256 !== approved) {
    throw new Error("Scraper build is not approved for corrected vote clocks")
  }
  assertSuccessfulScraperAttempt(attempt)
  if (
    attempt.request.domain !== "bills" ||
    attempt.request.session !== scraperBillProfiles[attempt.request.jurisdiction].session ||
    !attempt.request.bill_ids
  ) {
    throw new Error("Scraper attempt is not a completed bounded bill extraction")
  }
  return normalizeBills(
    {
      bills: records
        .filter((record) => record.path.startsWith(`_data/${attempt.request.jurisdiction}/bill_`))
        .map((record) => record.value),
      votes: records
        .filter((record) => record.path.startsWith(`_data/${attempt.request.jurisdiction}/vote_event_`))
        .map((record) => record.value),
      requestedIds: attempt.request.bill_ids,
      retrievedAt
    },
    true,
    attempt.request.jurisdiction
  )
}

function normalizeBills(input: NcBillInput, hasVerifiedClock: boolean, jurisdiction: keyof typeof scraperBillProfiles) {
  const isNc = jurisdiction === "nc"
  const isWa = jurisdiction === "wa"
  const profile = scraperBillProfiles[jurisdiction]
  const session = profile.session
  const requested = z.array(z.string().regex(profile.identifier)).min(1).max(10).parse(input.requestedIds)
  if (new Set(requested).size !== requested.length || new Set(requested.map((id) => id[0])).size !== 1) {
    throw new Error("Invalid NC batch scope")
  }
  const bills = input.bills.map((record) =>
    billSchema
      .extend({
        legislative_session: z.literal(session),
        identifier: z.string().regex(isNc ? /^[HS](?:B|JR|R) [1-9][0-9]*$/ : profile.identifier)
      })
      .parse(record)
  )
  const votes = input.votes.map((record) => voteSchema.parse(record))
  const rawIds = new Set(bills.map((bill) => bill._id))
  if (rawIds.size !== bills.length || votes.some((vote) => !rawIds.has(vote.bill))) {
    throw new Error("Ambiguous or orphaned scraper relationship")
  }
  const emitted = bills.map((bill) => (isNc ? bill.identifier.replace(/(?:B|JR|R) /, "") : bill.identifier))
  if (
    new Set(emitted).size !== emitted.length ||
    emitted.length !== requested.length ||
    emitted.some((id) => !requested.includes(id))
  ) {
    throw new Error("Incomplete or out-of-scope NC bill batch")
  }
  const seenVotes = new Set<string>()
  return bills.map((bill, index) => {
    const observations = bill.sponsorships.map((sponsor) => {
      const reference = sponsor.person_id
      // A lookup expression is evidence, not a resolved person. Canonicalize its
      // fields so JSON whitespace/key order cannot change the observation ID.
      const selector = reference?.startsWith("~")
        ? z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .parse(JSON.parse(reference.slice(1)))
        : undefined
      const qualifiers = Object.entries(selector ?? {})
        .filter(([key]) => key !== "name")
        .sort(([left], [right]) => left.localeCompare(right))
      // Resolved IDs enrich an observation; they are not its identity. Name-only
      // selectors retain the ordinary name/classification observation key.
      const identity = [sponsor.name, sponsor.classification]
      return {
        ...sponsor,
        source_observation_id: JSON.stringify(
          qualifiers.length ? [...identity, Object.fromEntries(qualifiers)] : identity
        )
      }
    })
    const uniqueSponsors = new Map<string, (typeof observations)[number]>()
    for (const sponsor of observations) {
      const previous = uniqueSponsors.get(sponsor.source_observation_id)
      if (previous !== undefined && !isDeepStrictEqual(previous, sponsor)) {
        throw new Error("Ambiguous duplicate sponsor observation")
      }
      // Repeated identical publisher rows do not create another relationship.
      // The untouched retained archive remains the evidence for every occurrence.
      uniqueSponsors.set(sponsor.source_observation_id, sponsor)
    }
    const sponsorships = [...uniqueSponsors.values()]
    const official = isNc
      ? `https://www.ncleg.gov/BillLookUp/2025/${emitted[index]}`
      : isWa
        ? "https://app.leg.wa.gov/billsummary/?BillNumber=" +
          bill.identifier.split(" ")[1] +
          "&Year=2025&Initiative=false"
        : `https://www.akleg.gov/basis/Bill/Detail/34?Root=${emitted[index]}`
    if (!bill.sources.some((entry) => entry.url === official)) {
      throw new Error("NC bill source identity mismatch")
    }
    const washingtonFacts = new Map<string, ReturnType<typeof washingtonVoteEvidence>>()
    const selectedVotes = votes
      .filter((vote) => vote.bill === bill._id)
      .map((vote) => {
        const wa = isWa ? washingtonVoteEvidence(vote, bill) : undefined
        const urls = vote.sources
          .map((entry) => entry.url)
          .filter((url) =>
            wa
              ? url === wa.sourceUrl
              : isNc
                ? /^https:\/\/www\.ncleg\.gov\/Legislation\/Votes\/RollCallVoteTranscript\/2025\/[HS]\/[1-9][0-9]*$/.test(
                    url
                  )
                : new URL(url).origin === "https://www.akleg.gov" &&
                  new URL(url).pathname === "/basis/Journal/Pages/34" &&
                  new URL(url).searchParams.get("Bill") === bill.identifier &&
                  /^[0-9]+$/.test(new URL(url).searchParams.get("Page") ?? "")
          )
        const officialVoteUrl = urls[0]
        if (urls.length !== 1 || officialVoteUrl === undefined) {
          throw new Error("Missing or duplicate official roll-call source")
        }
        // A journal page can contain passage, amendments and effective-date votes.
        // Tally corrections must not rename the same motion observation.
        const motionIdentity = vote.motion_text
          .replace(/\b[YNEA][0-9]+\b/g, "")
          .replace(/\s+/g, " ")
          .trim()
        const identity = wa
          ? wa.identity
          : isNc
            ? officialVoteUrl
            : JSON.stringify([officialVoteUrl, z.iso.date().parse(vote.start_date), motionIdentity])
        if (seenVotes.has(identity)) {
          throw new Error("Missing or duplicate official roll-call identity")
        }
        seenVotes.add(identity)
        if (wa) washingtonFacts.set(identity, wa)
        if (new Set(vote.votes.map((entry) => entry.voter_id ?? entry.voter_name)).size !== vote.votes.length) {
          throw new Error("Ambiguous duplicate source voter")
        }
        let verifiedStartDate: string | undefined
        if (hasVerifiedClock) {
          verifiedStartDate = isNc
            ? z.iso.datetime({ offset: true }).parse(vote.start_date)
            : z.iso.date().parse(vote.start_date)
        }
        return {
          ...vote,
          id: identity,
          // The pinned Alaska parser labels every motion passage and infers some
          // outcomes from simple majorities. Retain only explicit outcomes here.
          classification: isNc ? vote.classification : [],
          motion_classification: isNc ? vote.motion_classification : [],
          result: wa ? wa.result : isNc ? vote.result : explicitAlaskaOutcome(vote.motion_text),
          organization: undefined,
          organization_id: undefined,
          // Older builds lose PM. Only a verified archive from the approved corrected build supplies the instant.
          start_date: verifiedStartDate,
          votes: vote.votes.map((entry) => ({
            ...entry,
            voter_id: personReference.safeParse(entry.voter_id).success ? entry.voter_id : undefined
          }))
        }
      })
    const result = normalizeOpenStatesBill(
      {
        ...bill,
        _id: undefined,
        id: undefined,
        from_organization: undefined,
        sources: [{ url: official }],
        actions: bill.actions.map((action) => ({ ...action, organization: undefined, organization_id: undefined })),
        sponsorships: sponsorships.map((sponsor) => ({
          ...sponsor,
          person: undefined,
          person_id: personReference.safeParse(sponsor.person_id).success ? sponsor.person_id : undefined,
          organization: undefined
        })),
        votes: selectedVotes
      },
      {
        jurisdictionCode: jurisdiction,
        jurisdictionName: isNc ? "North Carolina" : isWa ? "Washington" : "Alaska",
        retrievedAt: input.retrievedAt
      }
    )
    const aggregate = result.aggregate
    // This adapter does not resolve these references. Absence is not a removal snapshot.
    aggregate.organizations = undefined
    aggregate.relations = undefined
    const occurrences = new Map<string, number>()
    aggregate.actions = aggregate.actions?.map((action) => {
      const identity = JSON.stringify([action.actionDate, action.description, action.classification])
      const occurrence = occurrences.get(identity) ?? 0
      occurrences.set(identity, occurrence + 1)
      return { ...action, id: childId("action", aggregate.bill.id, `${identity}:${occurrence}`) }
    })
    // Preserve source-only positions; never manufacture people from a name expression.
    aggregate.people = aggregate.people?.filter((person) => !person.upstreamIds?.openstatesVoteName)
    aggregate.votes = aggregate.votes?.map((entry) => ({
      ...entry,
      vote: {
        ...entry.vote,
        ...(isWa
          ? {
              result:
                washingtonFacts.get(entry.vote.sourceId ?? "")?.result === "unknown" ? "unknown" : entry.vote.result,
              timelineComplete:
                washingtonFacts.get(entry.vote.sourceId ?? "")?.result === "unknown"
                  ? false
                  : entry.vote.timelineComplete,
              rollCallNumber: washingtonFacts.get(entry.vote.sourceId ?? "")?.sequence
            }
          : {}),
        chamber: isWa
          ? washingtonFacts.get(entry.vote.sourceId ?? "")?.chamber
          : scraperVoteChamberFromEvidence({
              motion: entry.vote.motion,
              positionCount: entry.positions?.length ?? 0,
              session,
              sourceUrl: entry.vote.sourceUrl ?? null,
              state: jurisdiction
            })
      },
      positions: entry.positions?.length
        ? entry.positions.map((entryPosition) => {
            if (entryPosition.sourcePersonId?.startsWith("vote-name:")) {
              return { ...entryPosition, personId: undefined, sourcePersonId: undefined }
            }
            return entryPosition
          })
        : undefined
    }))
    aggregate.bill.chamber = bill.identifier.startsWith("H") ? "lower" : "upper"
    return {
      aggregate,
      unresolvedPositions:
        aggregate.votes?.reduce(
          (count, vote) => count + (vote.positions?.filter((entry) => !entry.personId).length ?? 0),
          0
        ) ?? 0
    }
  })
}
