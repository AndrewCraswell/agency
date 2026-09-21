import assert from "node:assert/strict"
import { test } from "node:test"
import {
  GitHubIssueLeaseStore,
  LeaseContentionError,
  acquireStagingSchemaLease,
  latestMigrationIdentifier,
  leaseIssueTitle,
  parseLeaseIssueBody,
  readStagingSchemaLease,
  releaseStagingSchemaLease,
  replaceLeaseIssueBody
} from "./legislation-staging-schema-lease.mjs"

const firstRequest = {
  prNumber: 139,
  headSha: "a".repeat(40),
  owner: "octocat",
  durationMinutes: 60,
  appliedMigrationIdentifier: "0002_add_legislation"
}

class MemoryStore {
  constructor() {
    this.lease = null
    this.revision = 0
  }

  async read() {
    return { lease: this.lease, revision: this.revision }
  }

  async write(state, lease) {
    assert.equal(state.revision, this.revision)
    this.lease = lease
    this.revision += 1
  }
}

test("acquires, reads, renews, and releases one owner's lease", async () => {
  const store = new MemoryStore()
  const acquired = await acquireStagingSchemaLease(store, firstRequest, new Date("2026-09-21T10:00:00.000Z"))

  assert.deepEqual(await readStagingSchemaLease(store), acquired)
  assert.deepEqual(
    await acquireStagingSchemaLease(
      store,
      { ...firstRequest, headSha: "b".repeat(40) },
      new Date("2026-09-21T10:30:00.000Z")
    ),
    {
      ...acquired,
      headSha: "b".repeat(40),
      acquiredAt: "2026-09-21T10:30:00.000Z",
      expiresAt: "2026-09-21T11:30:00.000Z"
    }
  )

  await releaseStagingSchemaLease(store, firstRequest)
  assert.equal(await readStagingSchemaLease(store), null)
})

test("rejects contention and a non-owner release while the lease is active", async () => {
  const store = new MemoryStore()
  const acquired = await acquireStagingSchemaLease(store, firstRequest, new Date("2026-09-21T10:00:00.000Z"))
  const contender = { ...firstRequest, prNumber: 141, owner: "hubot" }

  await assert.rejects(
    acquireStagingSchemaLease(store, contender, new Date("2026-09-21T10:30:00.000Z")),
    (error) => error instanceof LeaseContentionError && error.lease === acquired
  )
  await assert.rejects(
    releaseStagingSchemaLease(store, contender),
    (error) => error instanceof LeaseContentionError && error.lease === acquired
  )
  assert.deepEqual(await readStagingSchemaLease(store), acquired)
})

test("permits takeover only after expiration", async () => {
  const store = new MemoryStore()
  await acquireStagingSchemaLease(store, firstRequest, new Date("2026-09-21T10:00:00.000Z"))
  const contender = { ...firstRequest, prNumber: 141, owner: "hubot" }
  const acquired = await acquireStagingSchemaLease(store, contender, new Date("2026-09-21T11:00:00.000Z"))
  assert.equal(acquired.prNumber, 141)
  assert.equal(acquired.owner, "hubot")
})

test("round trips lease state in a dedicated issue marker and rejects corrupt state", () => {
  const { durationMinutes: _durationMinutes, ...leaseOwner } = firstRequest
  const body = replaceLeaseIssueBody("Operational state. Do not edit.", {
    ...leaseOwner,
    acquiredAt: "2026-09-21T10:00:00.000Z",
    expiresAt: "2026-09-21T11:00:00.000Z"
  })
  const lease = parseLeaseIssueBody(body)
  assert.equal(lease.prNumber, 139)
  assert.equal(lease.appliedMigrationIdentifier, "0002_add_legislation")
  assert.throws(() => parseLeaseIssueBody("<!-- legislation-staging-schema-lease:start -->\n{}"), /markers are corrupt/)
  assert.throws(
    () =>
      parseLeaseIssueBody(
        "<!-- legislation-staging-schema-lease:start -->\nnot json\n<!-- legislation-staging-schema-lease:end -->"
      ),
    /not valid JSON/
  )
  assert.throws(() => parseLeaseIssueBody("Operational state only."), /initialized lease state is missing/)
})

test("fails closed on GitHub errors, a wrong issue, or concurrent issue edits", async () => {
  const emptyState = replaceLeaseIssueBody("", null)
  const responses = [
    new Response(JSON.stringify({ title: leaseIssueTitle, body: emptyState, updated_at: "first" })),
    new Response(JSON.stringify({ title: leaseIssueTitle, body: "changed", updated_at: "second" }))
  ]
  const store = new GitHubIssueLeaseStore({
    repository: "octocat/agency",
    issueNumber: 1,
    token: "token",
    fetchImplementation: async () => responses.shift()
  })
  const state = await store.read()
  await assert.rejects(store.write(state, null), /changed while the operation/)

  const wrongIssue = new GitHubIssueLeaseStore({
    repository: "octocat/agency",
    issueNumber: 1,
    token: "token",
    fetchImplementation: async () =>
      new Response(JSON.stringify({ title: "Another issue", body: "", updated_at: "first" }))
  })
  await assert.rejects(wrongIssue.read(), /must be titled/)

  const failedRequest = new GitHubIssueLeaseStore({
    repository: "octocat/agency",
    issueNumber: 1,
    token: "token",
    fetchImplementation: async () => new Response("", { status: 503 })
  })
  await assert.rejects(failedRequest.read(), /HTTP 503/)
})

test("persists acquisition and release through the GitHub issue store", async () => {
  let revision = 0
  let issue = {
    title: leaseIssueTitle,
    body: replaceLeaseIssueBody("", null),
    updated_at: String(revision)
  }
  const store = new GitHubIssueLeaseStore({
    repository: "octocat/agency",
    issueNumber: 1,
    token: "token",
    fetchImplementation: async (_url, init) => {
      if (init.method === "PATCH") {
        issue = {
          ...issue,
          body: JSON.parse(init.body).body,
          updated_at: String(++revision)
        }
      }
      return new Response(JSON.stringify(issue))
    }
  })

  const acquired = await acquireStagingSchemaLease(store, firstRequest, new Date("2026-09-21T10:00:00.000Z"))
  assert.deepEqual(parseLeaseIssueBody(issue.body), acquired)

  await releaseStagingSchemaLease(store, firstRequest)
  assert.equal(parseLeaseIssueBody(issue.body), null)
})

test("derives the applied identifier only from a journal entry with matching SQL", () => {
  const journal = JSON.stringify({
    entries: [
      { idx: 0, tag: "0000_initial" },
      { idx: 1, tag: "0001_add_bills" }
    ]
  })
  assert.equal(latestMigrationIdentifier(journal, ["0000_initial.sql", "0001_add_bills.sql"]), "0001_add_bills")
  assert.throws(() => latestMigrationIdentifier(journal, ["0000_initial.sql"]), /missing SQL entry/)
  assert.throws(() => latestMigrationIdentifier('{"entries":[]}', []), /has no entries/)
})
