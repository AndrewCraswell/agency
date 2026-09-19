import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import { archiveScraperAttempt } from "./scraper-archive.js"
import { normalizeArchivedScraperBills } from "./scraper-normalize.js"
import { washingtonVoteEvidence } from "./scraper-washington-vote.js"

it("replays a verified Washington archive through the shared mapper without turning unknown into a majority outcome", async () => {
  const objects = new Map<string, Uint8Array>()
  const store = {
    exists: async (path: string) => objects.has(path),
    put: async (path: string, bytes: Uint8Array) => {
      if (objects.has(path)) return false
      objects.set(path, bytes)
      return true
    },
    read: async (path: string) => {
      const bytes = objects.get(path)
      if (!bytes) throw new Error("Missing fixture")
      return bytes
    }
  }
  const files = [
    {
      path: "_data/wa/bill_fixture.json",
      value: {
        _id: "temporary",
        identifier: "SB 5000",
        legislative_session: "2025-2026",
        title: "Test",
        sources: [{ url: "https://app.leg.wa.gov/billsummary/?BillNumber=5000&Year=2025&Initiative=false" }],
        actions: [],
        sponsorships: [],
        versions: []
      }
    },
    {
      path: "_data/wa/vote_event_fixture.json",
      value: {
        ...vote(),
        _id: "temporary-vote",
        bill: "temporary",
        result: "pass",
        motion_classification: ["passage"]
      }
    }
  ].map(({ path, value }) => {
    const bytes = Buffer.from(JSON.stringify(value))
    objects.set(path, bytes)
    return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }
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
          jurisdiction: "wa",
          domain: "bills",
          session: "2025-2026",
          bill_ids: ["SB 5000"],
          timeout_seconds: 120,
          revision
        }
      })
    )
  )
  const { manifestPath } = await archiveScraperAttempt(store, store, "wa-mapping")
  const input = {
    store,
    manifestPath,
    approvedBuildInputsSha256: "a".repeat(64),
    retrievedAt: new Date("2026-09-19T00:00:00Z")
  }
  const rows = await normalizeArchivedScraperBills(input)
  expect(await normalizeArchivedScraperBills(input)).toEqual(rows)
  expect(rows[0]?.aggregate.bill.id).toBe("bill:wa:2025-2026:sb:5000")
  expect(rows[0]?.aggregate.votes?.[0]?.vote).toMatchObject({
    result: "unknown",
    timelineComplete: false,
    chamber: "upper",
    heldDate: "2026-01-28",
    rollCallNumber: "17"
  })
  expect(rows[0]?.aggregate.votes?.[0]?.vote.heldAt).toBeUndefined()
  await expect(normalizeArchivedScraperBills({ ...input, approvedBuildInputsSha256: "b".repeat(64) })).rejects.toThrow(
    "not approved"
  )
})

const bill = {
  identifier: "SB 5000",
  actions: [
    {
      date: "2026-01-28",
      organization_id: '~{"classification":"upper"}',
      description: "Third reading, passed; yeas, 1; nays, 0; absent, 0; excused, 0."
    }
  ]
}
function vote() {
  return {
    bill_identifier: bill.identifier,
    legislative_session: "2025-2026",
    organization: '~{"classification":"upper"}',
    start_date: "2026-01-28",
    motion_text: "Final Passage (#17)",
    sources: [
      { url: "https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetRollCalls?billNumber=5000&biennium=2025-26" }
    ],
    counts: [
      { option: "yes", value: 1 },
      { option: "no", value: 0 },
      { option: "other", value: 0 }
    ],
    votes: [{ voter_name: "Example", option: "yes" }]
  }
}

it("uses the source sequence and matching action, not scraper UUIDs or majority inference", () => {
  const facts = washingtonVoteEvidence(vote(), bill)
  expect(facts).toMatchObject({ chamber: "upper", date: "2026-01-28", sequence: "17", result: "pass" })
  expect(washingtonVoteEvidence({ ...vote(), motion_text: "Amendment (#17)" }, bill)).toMatchObject({
    identity: facts.identity,
    result: "unknown"
  })
  expect(washingtonVoteEvidence(vote(), { ...bill, actions: [] }).result).toBe("unknown")
  expect(washingtonVoteEvidence(vote(), { ...bill, actions: [...bill.actions, ...bill.actions] }).result).toBe(
    "unknown"
  )
  expect(
    washingtonVoteEvidence(vote(), {
      ...bill,
      actions: bill.actions.map((a) => ({ ...a, description: a.description.replace("passed", "failed") }))
    }).result
  ).toBe("fail")
})

it.each([
  { date: "2026-01-29" },
  { organization_id: '~{"classification":"lower"}' },
  { description: "Third reading, passed; yeas, 2; nays, 0; absent, 0; excused, 0." }
])("withholds outcomes from nonmatching action evidence %j", (change) => {
  expect(
    washingtonVoteEvidence(vote(), { ...bill, actions: bill.actions.map((a) => ({ ...a, ...change })) }).result
  ).toBe("unknown")
})

it.each([
  { bill_identifier: "SB 5001" },
  { legislative_session: "2023-2024" },
  { organization: '~{"classification":"executive"}' },
  { motion_text: "Final Passage" },
  { motion_text: "Final Passage (#0)" },
  { start_date: "2026-01-28T00:00:00Z" },
  { votes: [] },
  { votes: [{ voter_name: "Example", option: "no" }] },
  {
    votes: [
      { voter_name: "Example", option: "yes" },
      { voter_name: "Example", option: "yes" }
    ]
  }
])("rejects incomplete or conflicting roll-call evidence %j", (change) => {
  expect(() => washingtonVoteEvidence({ ...vote(), ...change }, bill)).toThrow()
})

it.each([
  "http://wslwebservices.leg.wa.gov/legislationservice.asmx/GetRollCalls?billNumber=5000&biennium=2025-26",
  "https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetRollCalls?billNumber=5001&biennium=2025-26",
  "https://wslwebservices.leg.wa.gov/legislationservice.asmx/GetRollCalls?billNumber=5000&biennium=2025-26&billNumber=5000"
])("rejects untrusted or mismatched source %s", (url) => {
  expect(() => washingtonVoteEvidence({ ...vote(), sources: [{ url }] }, bill)).toThrow()
})
