import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import { archiveScraperAttempt } from "./scraper-archive.js"
import { normalizeArchivedScraperBills } from "./scraper-normalize.js"

async function normalizeFixture(
  references = ['~{"name":"Example","chamber":"lower"}'],
  motions = ["Passage"],
  hasPositions = true
) {
  const objects = new Map<string, Uint8Array>()
  const store = {
    exists: async (path: string) => objects.has(path),
    put: async (path: string, bytes: Uint8Array) => {
      if (objects.has(path)) {
        return false
      }
      objects.set(path, bytes)
      return true
    },
    read: async (path: string) => {
      const bytes = objects.get(path)
      if (!bytes) {
        throw new Error("Missing fixture")
      }
      return bytes
    }
  }
  const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
  const records = [
    {
      path: "_data/ak/bill_fixture.json",
      value: {
        _id: "temporary",
        identifier: "HB2",
        legislative_session: "34",
        title: "Test",
        sources: [{ url: "https://www.akleg.gov/basis/Bill/Detail/34?Root=HB2" }],
        actions: [],
        sponsorships: references.map((reference) => ({
          name: "Example",
          primary: true,
          classification: "primary",
          person_id: reference
        })),
        versions: []
      }
    },
    ...motions.map((motion, index) => ({
      path: `_data/ak/vote_event_fixture${index}.json`,
      value: {
        _id: `temporary-vote-${index}`,
        bill: "temporary",
        start_date: "2026-05-07",
        sources: [{ url: "https://www.akleg.gov/basis/Journal/Pages/34?Chamber=H&Bill=HB2&Page=02441#2441" }],
        votes: hasPositions ? [{ voter_name: "Example", option: "yes" }] : [],
        counts: [{ option: "yes", value: 1 }],
        result: "pass",
        motion_text: motion,
        motion_classification: ["passage"]
      }
    }))
  ]
  const files = records.map(({ path, value }) => {
    const bytes = Buffer.from(JSON.stringify(value))
    objects.set(path, bytes)
    return { path, bytes: bytes.length, sha256: digest(bytes) }
  })
  const revision = "d43f853796ceeeb49205f7d144790647764ce105"
  objects.set(
    "attempt.json",
    Buffer.from(
      JSON.stringify({
        work_directory: "/fixture",
        status: "extracted",
        exit_code: 0,
        revision,
        build_inputs_sha256: "a".repeat(64),
        canonical_writes: false,
        semantically_validated: false,
        reason: null,
        files,
        request: {
          jurisdiction: "ak",
          domain: "bills",
          session: "34",
          bill_ids: ["HB2"],
          timeout_seconds: 120,
          revision
        }
      })
    )
  )
  const { manifestPath } = await archiveScraperAttempt(store, store, "ak-mapping")
  return normalizeArchivedScraperBills({
    store,
    manifestPath,
    approvedBuildInputsSha256: "a".repeat(64),
    retrievedAt: new Date("2026-09-15T00:00:00Z")
  })
}

it("maps Alaska canonical identities without inventing vote instants or people", async () => {
  const rows = await normalizeFixture()
  expect(rows).toHaveLength(1)
  expect(rows[0]?.aggregate.bill.id).toContain("ak:34")
  expect(rows[0]?.aggregate.votes?.[0]?.vote.heldAt).toBeUndefined()
  expect(rows[0]?.aggregate.votes?.[0]?.vote.heldDate).toBe("2026-05-07")
  expect(rows[0]?.aggregate.sponsors?.[0]?.personId).toBeUndefined()
  expect(rows[0]?.unresolvedPositions).toBe(1)
})

it("accepts a fully evidenced date-only vote without an invented instant", async () => {
  const rows = await normalizeFixture([], ["(H) PASSED Y1 N0 #2441"])
  expect(rows[0]?.aggregate.votes?.[0]?.vote).toMatchObject({ heldDate: "2026-05-07", timelineComplete: true })
  expect(rows[0]?.aggregate.votes?.[0]?.vote.heldAt).toBeUndefined()
})

it("preserves distinct qualified sponsor observations without resolving people", async () => {
  const lower = '~{"name":"Example","chamber":"lower"}'
  const upper = '~{"name":"Example","chamber":"upper"}'
  const rows = await normalizeFixture([lower, upper])
  const sponsors = rows[0]?.aggregate.sponsors ?? []
  expect(sponsors).toHaveLength(2)
  expect(new Set(sponsors.map((sponsor) => sponsor.id)).size).toBe(2)
  expect(sponsors.every((sponsor) => sponsor.personId === undefined)).toBe(true)
  const reordered = await normalizeFixture([upper, '~{ "chamber": "lower", "name": "Example" }'])
  expect(reordered[0]?.aggregate.sponsors?.map((sponsor) => sponsor.id).sort()).toEqual(
    sponsors.map((sponsor) => sponsor.id).sort()
  )
  await expect(normalizeFixture([lower, '~{"chamber":"lower","name":"Example"}'])).rejects.toThrow(
    "Ambiguous duplicate sponsor observation"
  )
})

it("distinguishes motions on one journal page and withholds missing positions and inferred labels", async () => {
  const rows = await normalizeFixture(
    [],
    ["(H) PASSED Y23 N17 #1046", "(H) EFFECTIVE DATE(S) ADOPTED Y31 N9 #1046", "(H) CONCUR AM OF (S) Y26 N14 #1046"],
    false
  )
  const votes = rows[0]?.aggregate.votes ?? []
  expect(votes).toHaveLength(3)
  expect(new Set(votes.map((entry) => entry.vote.id)).size).toBe(3)
  expect(votes.every((entry) => entry.positions === undefined && entry.vote.classification === "recorded")).toBe(true)
  expect(votes.map((entry) => entry.vote.result)).toEqual(["passed", "passed", "unknown"])
  const corrected = await normalizeFixture([], ["(H) PASSED Y24 N16 #1046"], false)
  expect(corrected[0]?.aggregate.votes?.[0]?.vote.id).toBe(votes[0]?.vote.id)
  await expect(normalizeFixture([], ["(H) PASSED Y23 N17 #1046", "(H) PASSED Y23 N17 #1046"])).rejects.toThrow(
    "duplicate official roll-call identity"
  )
})
