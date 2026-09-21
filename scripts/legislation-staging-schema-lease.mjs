import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { appendFile, readFile, readdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"

export const leaseIssueTitle = "Legislation staging schema lease"

const markerStart = "<!-- legislation-staging-schema-lease:start -->"
const markerEnd = "<!-- legislation-staging-schema-lease:end -->"
const leaseVersion = 1
const shaPattern = /^[0-9a-f]{40}$/i
const migrationPattern = /^\d{4}_[a-z0-9_]+$/
const leaseFields = ["acquiredAt", "appliedMigrationIdentifier", "expiresAt", "headSha", "owner", "prNumber"]

export class LeaseContentionError extends Error {
  constructor(lease) {
    super(`Staging schema is leased by PR #${lease.prNumber} (${lease.owner}) until ${lease.expiresAt}.`)
    this.name = "LeaseContentionError"
    this.lease = lease
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid staging schema lease: ${name} must be a non-empty string.`)
  }
  return value
}

function parseTimestamp(value, name) {
  requireNonEmptyString(value, name)
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error(`Invalid staging schema lease: ${name} must be an ISO timestamp.`)
  }
  return timestamp
}

export function validateLease(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid staging schema lease: lease must be an object.")
  }
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(leaseFields)) {
    throw new Error("Invalid staging schema lease: lease fields do not match the supported contract.")
  }
  if (!Number.isSafeInteger(value.prNumber) || value.prNumber <= 0) {
    throw new Error("Invalid staging schema lease: prNumber must be a positive integer.")
  }
  if (!shaPattern.test(requireNonEmptyString(value.headSha, "headSha"))) {
    throw new Error("Invalid staging schema lease: headSha must be a full commit SHA.")
  }
  requireNonEmptyString(value.owner, "owner")
  if (!migrationPattern.test(requireNonEmptyString(value.appliedMigrationIdentifier, "appliedMigrationIdentifier"))) {
    throw new Error(
      "Invalid staging schema lease: appliedMigrationIdentifier must be a canonical migration identifier."
    )
  }
  const acquiredAt = parseTimestamp(value.acquiredAt, "acquiredAt")
  const expiresAt = parseTimestamp(value.expiresAt, "expiresAt")
  if (expiresAt <= acquiredAt) {
    throw new Error("Invalid staging schema lease: expiresAt must follow acquiredAt.")
  }

  return {
    prNumber: value.prNumber,
    headSha: value.headSha.toLowerCase(),
    owner: value.owner,
    acquiredAt: value.acquiredAt,
    expiresAt: value.expiresAt,
    appliedMigrationIdentifier: value.appliedMigrationIdentifier
  }
}

export function parseLeaseIssueBody(body) {
  const content = body ?? ""
  const start = content.indexOf(markerStart)
  const end = content.indexOf(markerEnd)
  if (start === -1 && end === -1) {
    throw new Error("Invalid staging schema lease issue: initialized lease state is missing.")
  }
  if (
    start === -1 ||
    end === -1 ||
    end < start ||
    content.indexOf(markerStart, start + 1) !== -1 ||
    content.indexOf(markerEnd, end + 1) !== -1
  ) {
    throw new Error("Invalid staging schema lease issue: lease markers are corrupt.")
  }

  let document
  try {
    document = JSON.parse(content.slice(start + markerStart.length, end).trim())
  } catch {
    throw new Error("Invalid staging schema lease issue: lease state is not valid JSON.")
  }
  if (
    !document ||
    typeof document !== "object" ||
    Array.isArray(document) ||
    document.version !== leaseVersion ||
    JSON.stringify(Object.keys(document).sort()) !== JSON.stringify(["lease", "version"])
  ) {
    throw new Error("Invalid staging schema lease issue: unsupported lease document.")
  }
  return document.lease === null ? null : validateLease(document.lease)
}

export function replaceLeaseIssueBody(body, lease) {
  const content = body ?? ""
  const start = content.indexOf(markerStart)
  const end = content.indexOf(markerEnd)
  if (
    (start === -1) !== (end === -1) ||
    (start !== -1 &&
      (end < start || content.indexOf(markerStart, start + 1) !== -1 || content.indexOf(markerEnd, end + 1) !== -1))
  ) {
    throw new Error("Invalid staging schema lease issue: lease markers are corrupt.")
  }
  const document = `${markerStart}\n${JSON.stringify({ version: leaseVersion, lease }, null, 2)}\n${markerEnd}`
  if (start === -1) return `${content.trimEnd()}${content.trim() ? "\n\n" : ""}${document}\n`
  return `${content.slice(0, start)}${document}${content.slice(end + markerEnd.length)}`
}

export function createLease(request, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.valueOf())) throw new Error("Invalid current time.")
  if (!Number.isSafeInteger(request.durationMinutes) || request.durationMinutes <= 0) {
    throw new Error("Lease duration must be a positive integer number of minutes.")
  }
  return validateLease({
    prNumber: request.prNumber,
    headSha: request.headSha,
    owner: request.owner,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.valueOf() + request.durationMinutes * 60_000).toISOString(),
    appliedMigrationIdentifier: request.appliedMigrationIdentifier
  })
}

function sameOwner(lease, request) {
  return lease.prNumber === request.prNumber && lease.owner === request.owner
}

export async function readStagingSchemaLease(store) {
  const state = await store.read()
  return state.lease
}

export async function acquireStagingSchemaLease(store, request, now = new Date()) {
  const state = await store.read()
  const current = state.lease
  if (current && Date.parse(current.expiresAt) > now.valueOf() && !sameOwner(current, request)) {
    throw new LeaseContentionError(current)
  }

  const next = createLease(request, now)
  await store.write(state, next)
  const persisted = await store.read()
  assert.deepEqual(persisted.lease, next, "Staging schema lease write was not persisted.")
  return next
}

export async function releaseStagingSchemaLease(store, request) {
  const state = await store.read()
  if (!state.lease) throw new Error("Cannot release staging schema lease: no lease is recorded.")
  if (!sameOwner(state.lease, request)) throw new LeaseContentionError(state.lease)

  await store.write(state, null)
  const persisted = await store.read()
  assert.equal(persisted.lease, null, "Staging schema lease release was not persisted.")
}

export function latestMigrationIdentifier(journalText, sqlFileNames) {
  let journal
  try {
    journal = JSON.parse(journalText)
  } catch {
    throw new Error("Canonical migration journal is not valid JSON.")
  }
  if (!journal || !Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error("Canonical migration journal has no entries.")
  }
  const invalidEntry = journal.entries.find(
    (entry, index) =>
      !entry ||
      !Number.isSafeInteger(entry.idx) ||
      entry.idx !== index ||
      !migrationPattern.test(entry.tag) ||
      !sqlFileNames.includes(`${entry.tag}.sql`)
  )
  if (invalidEntry) {
    throw new Error("Canonical migration journal has an invalid or missing SQL entry.")
  }
  const entry = journal.entries.at(-1)
  return entry.tag
}

export class GitHubIssueLeaseStore {
  constructor({ repository, issueNumber, token, fetchImplementation = fetch }) {
    if (!/^[^/]+\/[^/]+$/.test(requireNonEmptyString(repository, "repository"))) {
      throw new Error("GitHub repository must use owner/name format.")
    }
    if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
      throw new Error("Lease issue number must be a positive integer.")
    }
    this.repository = repository
    this.issueNumber = issueNumber
    this.token = requireNonEmptyString(token, "token")
    this.fetchImplementation = fetchImplementation
  }

  async request(method, body) {
    const response = await this.fetchImplementation(
      `https://api.github.com/repos/${this.repository}/issues/${this.issueNumber}`,
      {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.token}`,
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000)
      }
    )
    if (!response.ok) {
      throw new Error(`GitHub lease issue request failed with HTTP ${response.status}.`)
    }
    const issue = await response.json()
    if (issue.title !== leaseIssueTitle) {
      throw new Error(`Configured lease issue must be titled "${leaseIssueTitle}".`)
    }
    return issue
  }

  async read() {
    const issue = await this.request("GET")
    return { body: issue.body ?? "", updatedAt: issue.updated_at, lease: parseLeaseIssueBody(issue.body) }
  }

  async write(state, lease) {
    const current = await this.request("GET")
    if (current.updated_at !== state.updatedAt || (current.body ?? "") !== state.body) {
      throw new Error("Staging schema lease changed while the operation was in progress.")
    }
    await this.request("PATCH", { body: replaceLeaseIssueBody(state.body, lease) })
  }
}

function readArgument(name, { required = true } = {}) {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (required && !value) throw new Error(`Missing required ${name} argument.`)
  return value
}

function positiveInteger(value, name) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`)
  return parsed
}

async function migrationIdentifierFromWorkingTree() {
  const directory = new URL("../packages/legislation-core/src/database/migrations/", import.meta.url)
  const journal = await readFile(new URL("meta/_journal.json", directory), "utf8")
  return latestMigrationIdentifier(journal, await readdir(directory))
}

function migrationIdentifierFromGitRef(ref) {
  if (!shaPattern.test(ref)) throw new Error("--git-ref must be a full commit SHA.")
  const root = "packages/legislation-core/src/database/migrations"
  const journal = execFileSync("git", ["show", `${ref}:${root}/meta/_journal.json`], { encoding: "utf8" })
  const tree = execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", root], {
    encoding: "utf8"
  })
    .split(/\r?\n/)
    .map((path) => path.slice(path.lastIndexOf("/") + 1))
    .filter(Boolean)
  return latestMigrationIdentifier(journal, tree)
}

function leaseStoreFromEnvironment() {
  return new GitHubIssueLeaseStore({
    repository: process.env.GITHUB_REPOSITORY,
    issueNumber: positiveInteger(process.env.STAGING_SCHEMA_LEASE_ISSUE, "STAGING_SCHEMA_LEASE_ISSUE"),
    token: process.env.GITHUB_TOKEN
  })
}

async function writeOutput(lease) {
  const output = JSON.stringify(lease)
  console.log(output)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `lease=${output}\n`)
}

async function main() {
  const command = readArgument("--command")
  if (command === "migration-id") {
    const gitRef = readArgument("--git-ref", { required: false })
    const identifier = gitRef ? migrationIdentifierFromGitRef(gitRef) : await migrationIdentifierFromWorkingTree()
    console.log(identifier)
    if (process.env.GITHUB_OUTPUT) {
      await appendFile(process.env.GITHUB_OUTPUT, `migration_identifier=${identifier}\n`)
    }
    return
  }

  const store = leaseStoreFromEnvironment()
  if (command === "read") {
    await writeOutput(await readStagingSchemaLease(store))
    return
  }

  const request = {
    prNumber: positiveInteger(readArgument("--pr"), "--pr"),
    owner: readArgument("--owner")
  }
  if (command === "acquire") {
    request.headSha = readArgument("--head-sha")
    request.appliedMigrationIdentifier = readArgument("--migration-id")
    request.durationMinutes = positiveInteger(readArgument("--duration-minutes"), "--duration-minutes")
    await writeOutput(await acquireStagingSchemaLease(store, request))
    return
  }
  if (command === "release") {
    await releaseStagingSchemaLease(store, request)
    await writeOutput(null)
    return
  }
  throw new Error(`Unsupported --command ${command}.`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
