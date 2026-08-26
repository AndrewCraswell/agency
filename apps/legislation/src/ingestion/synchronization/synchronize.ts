import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { and, eq } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { replaceEntitySnapshot } from "../../db/queries/entities.js"
import { upsertEventSnapshots } from "../../db/queries/events.js"
import { syncCheckpoints } from "../../db/schema/schema.js"
import {
  formatSynchronizationIdentity,
  type CongressScopedSynchronizationIdentity,
  type GovInfoSynchronizationIdentity,
  type OpenStatesSynchronizationIdentity,
  type SynchronizationIdentity
} from "../../trigger/identities.js"
import { synchronizeCongressAmendments } from "../congress/amendments-sync.js"
import { type CongressClient, CongressClient as DefaultCongressClient } from "../congress/client.js"
import { normalizeCongressCommittees, normalizeCongressMembers } from "../congress/entities.js"
import { synchronizeCongressEvents } from "../congress/events-sync.js"
import { synchronizeCongressCommitteeReports } from "../congress/reports-sync.js"
import { synchronizeCongress } from "../congress/sync.js"
import { synchronizeCongressHouseVotes } from "../congress/votes-sync.js"
import { AzureBlobArtifactStore } from "../documents/artifact-store.js"
import { RetryingHttpClient, type HttpRequestTelemetry } from "../http-client.js"
import { createJobCounts, runIngestionJob, type JobCounts, type JobResult } from "../job.js"
import { type OpenStatesClient, OpenStatesClient as DefaultOpenStatesClient } from "../openstates/client.js"
import { openStatesJurisdictionId, openStatesJurisdictionNames } from "../openstates/coverage.js"
import { normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "../openstates/entities.js"
import { normalizeOpenStatesEvent } from "../openstates/events.js"
import { importOpenStatesRecords } from "../openstates/import.js"
import { ArtifactSourceStore, LocalSourceStore, type SourceStore } from "../source-store.js"

const DAY_IN_MILLISECONDS = 86_400_000
const OPENSTATES_BILL_OVERLAP_MILLISECONDS = 3_600_000

type OpenStatesSynchronizationClient = Pick<OpenStatesClient, "bills" | "committees" | "events" | "people">
type CongressSynchronizationClient = Pick<
  CongressClient,
  | "amendments"
  | "committeeMeetings"
  | "committeeReports"
  | "committees"
  | "getAmendmentBundle"
  | "getBillBundle"
  | "getCommitteeMeeting"
  | "getCommitteeReportBundle"
  | "getHearing"
  | "getHouseVoteBundle"
  | "hearings"
  | "houseVotes"
  | "listUpdated"
  | "members"
>

type SynchronizationOperationResult = Awaited<ReturnType<Parameters<typeof runIngestionJob>[2]>>
type ApiSynchronizationIdentity = Exclude<SynchronizationIdentity, GovInfoSynchronizationIdentity>
type SynchronizationFailure = JobResult["failures"][number]
type SynchronizationRouteName =
  | "congress-amendments"
  | "congress-bills"
  | "congress-committee-reports"
  | "congress-entities"
  | "congress-events"
  | "congress-house-votes"
  | "openstates-bills"
  | "openstates-entities"
  | "openstates-events"

type SynchronizationRouteContext = Readonly<{
  congressAmendmentLimit?: number
  config: LegislationConfig
  congressClient?: CongressSynchronizationClient
  database: LegislationDatabase
  identity: SynchronizationIdentity
  now: Date
  onProgress?: (event: Readonly<Record<string, unknown>>) => void
  openStatesClient?: OpenStatesSynchronizationClient
  openStatesBillsFrom?: Date
  sourceStore?: SourceStore
}>

type SynchronizationRoute = (context: SynchronizationRouteContext) => Promise<SynchronizationOperationResult>

export type SynchronizationExecutionInput = Readonly<{
  /** Limits one historical amendment child so it can checkpoint before Trigger's duration ceiling. */
  congressAmendmentLimit?: number
  config: LegislationConfig
  correlationId: string
  database: LegislationDatabase
  identity: SynchronizationIdentity
  onProgress?: (event: Readonly<Record<string, unknown>>) => void
  workflowExecutionId?: string
}>

export type SynchronizationExecutionDependencies = Readonly<{
  congressClient?: CongressSynchronizationClient
  now?: () => Date
  openStatesClient?: OpenStatesSynchronizationClient
  openStatesBillsFrom?: Date
  routes?: Partial<Record<SynchronizationRouteName, SynchronizationRoute>>
  runIngestionJob?: typeof runIngestionJob
  sourceStore?: SourceStore
}>

/**
 * Runs exactly one canonical synchronization scope without invoking the CLI.
 *
 * The caller owns database lifecycle and correlation identifiers. The job runner owns
 * the renewable lease for the operation and scope key derived from the identity.
 */
export async function executeSynchronization(
  input: SynchronizationExecutionInput,
  dependencies: SynchronizationExecutionDependencies = {}
): Promise<JobResult> {
  const identity = assertCanonicalIdentity(input.identity)
  const routeName = synchronizationRouteName(identity)
  assertProviderCredentials(input.config, identity)
  const now = dependencies.now?.() ?? new Date()
  const openStatesBillsFrom =
    dependencies.openStatesBillsFrom ?? (await resolveOpenStatesBillsFrom(input.database, identity, now))
  const route = dependencies.routes?.[routeName] ?? defaultSynchronizationRoutes[routeName]
  const run = dependencies.runIngestionJob ?? runIngestionJob

  return run(input.database, createSynchronizationJobInput(input, identity, now, openStatesBillsFrom), async () =>
    route({
      congressAmendmentLimit: input.congressAmendmentLimit,
      config: input.config,
      congressClient: dependencies.congressClient,
      database: input.database,
      identity,
      now,
      onProgress: input.onProgress,
      openStatesClient: dependencies.openStatesClient,
      openStatesBillsFrom,
      sourceStore: dependencies.sourceStore
    })
  )
}

const defaultSynchronizationRoutes: Record<SynchronizationRouteName, SynchronizationRoute> = {
  "congress-amendments": synchronizeCongressAmendmentsForScope,
  "congress-bills": synchronizeCongressBillsForScope,
  "congress-committee-reports": synchronizeCongressCommitteeReportsForScope,
  "congress-entities": synchronizeCongressEntitiesForScope,
  "congress-events": synchronizeCongressEventsForScope,
  "congress-house-votes": synchronizeCongressHouseVotesForScope,
  "openstates-bills": synchronizeOpenStatesBillsForScope,
  "openstates-entities": synchronizeOpenStatesEntitiesForScope,
  "openstates-events": synchronizeOpenStatesEventsForScope
}

async function synchronizeOpenStatesBillsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = openStatesIdentityFor(context.identity, "bills")
  const from = context.openStatesBillsFrom ?? new Date(context.now.getTime() - 7 * DAY_IN_MILLISECONDS)
  const client = context.openStatesClient ?? createOpenStatesClient(context.config)
  const counts = createJobCounts()
  const failures: SynchronizationFailure[] = []
  let checkpoint: Readonly<Record<string, unknown>> | undefined
  let page = 1

  for await (const records of client.bills({
    from,
    jurisdiction: openStatesJurisdictionNames[identity.scope]
  })) {
    const contentHash = createHash("sha256").update(JSON.stringify(records)).digest("hex")
    const imported = await importOpenStatesRecords(
      context.database,
      {
        jurisdictionCode: identity.scope,
        jurisdictionName: openStatesJurisdictionNames[identity.scope],
        retrievedAt: new Date()
      },
      records,
      {
        concurrency: context.config.ingestion.concurrency,
        contentHash,
        stream: `api-${identity.scope}-${from.toISOString()}-${page}`
      }
    )
    addJobCounts(counts, imported.counts)
    failures.push(...imported.failures)
    checkpoint = imported.checkpoint
    page += 1
  }

  return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
}

async function synchronizeOpenStatesEntitiesForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = openStatesIdentityFor(context.identity, "entities")
  const client = context.openStatesClient ?? createOpenStatesClient(context.config)
  const counts = createJobCounts()
  const failures: SynchronizationFailure[] = []

  try {
    const jurisdictionId = openStatesJurisdictionId(identity.scope)
    const rawPeople: unknown[] = []
    const rawCommittees: unknown[] = []
    for await (const page of client.people({ jurisdictionId })) {
      rawPeople.push(...page)
    }
    for await (const page of client.committees({ jurisdictionId })) {
      rawCommittees.push(...page)
    }
    const retrievedAt = new Date()
    const normalizedPeople = normalizeOpenStatesPeople(rawPeople, { jurisdictionCode: identity.scope, retrievedAt })
    const normalizedCommittees = normalizeOpenStatesCommittees(rawCommittees, {
      jurisdictionCode: identity.scope,
      retrievedAt
    })
    const peopleById = new Map(
      [...normalizedPeople.people, ...normalizedCommittees.people].map((person) => [person.id, person])
    )
    const termsById = new Map([...normalizedPeople.terms, ...normalizedCommittees.terms].map((term) => [term.id, term]))
    await replaceEntitySnapshot(context.database, `jurisdiction:${identity.scope}`, {
      memberships: normalizedCommittees.memberships,
      organizations: normalizedCommittees.organizations,
      personAliasPersonIds: normalizedPeople.personAliasPersonIds,
      personAliases: normalizedPeople.personAliases,
      people: [...peopleById.values()],
      terms: [...termsById.values()]
    })
    const records =
      peopleById.size +
      termsById.size +
      normalizedCommittees.organizations.length +
      normalizedCommittees.memberships.length
    counts.discovered += records
    counts.read += records
    counts.updated += records
  } catch (error) {
    counts.failed += 1
    failures.push({
      identifier: identity.scope,
      message: error instanceof Error ? error.message : "Unknown Open States entity synchronization failure",
      retryable: true
    })
  }

  return { counts, failures }
}

async function synchronizeOpenStatesEventsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = openStatesIdentityFor(context.identity, "events")
  const from = new Date(context.now.getTime() - 30 * DAY_IN_MILLISECONDS)
  const to = new Date(context.now.getTime() + 90 * DAY_IN_MILLISECONDS)
  const client = context.openStatesClient ?? createOpenStatesClient(context.config)
  const counts = createJobCounts()
  const failures: SynchronizationFailure[] = []

  try {
    for await (const page of client.events({
      from,
      jurisdictionId: openStatesJurisdictionId(identity.scope),
      to
    })) {
      counts.discovered += page.length
      const retrievedAt = new Date()
      const snapshots = page.flatMap((record) => {
        try {
          return [normalizeOpenStatesEvent(record, { jurisdictionCode: identity.scope, retrievedAt })]
        } catch (error) {
          counts.failed += 1
          failures.push({
            identifier: identity.scope,
            message: error instanceof Error ? error.message : "Unknown Open States event normalization failure",
            retryable: false
          })
          return []
        }
      })
      await upsertEventSnapshots(context.database, snapshots)
      counts.read += snapshots.length
      counts.updated += snapshots.length
    }
  } catch (error) {
    counts.failed += 1
    failures.push({
      identifier: identity.scope,
      message: error instanceof Error ? error.message : "Unknown Open States event synchronization failure",
      retryable: true
    })
  }

  return { counts, failures }
}

async function synchronizeCongressBillsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  return synchronizeCongress(context.database, client, {
    onProgress: context.onProgress,
    sourceStore: sourceStoreFor(context),
    stream: formatSynchronizationIdentity(context.identity)
  })
}

async function synchronizeCongressEntitiesForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = congressIdentityFor(context.identity, "entities")
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  const members: unknown[] = []
  const committees: unknown[] = []
  for await (const page of client.members(identity.scope)) {
    members.push(...page)
  }
  for await (const page of client.committees(identity.scope)) {
    committees.push(...page)
  }
  const memberSnapshot = normalizeCongressMembers(members, identity.scope)
  const committeeSnapshot = normalizeCongressCommittees(committees, { retrievedAt: new Date() })
  const peopleById = new Map(memberSnapshot.people.map((person) => [person.id, person]))
  const termsById = new Map(memberSnapshot.terms.map((term) => [term.id, term]))
  const organizationsById = new Map(
    committeeSnapshot.organizations.map((organization) => [organization.id, organization])
  )
  await replaceEntitySnapshot(context.database, "jurisdiction:us", {
    memberships: [],
    organizations: [...organizationsById.values()],
    personAliasPersonIds: [],
    personAliases: [],
    people: [...peopleById.values()],
    terms: [...termsById.values()]
  })
  const records = peopleById.size + termsById.size + organizationsById.size
  return { counts: createJobCounts({ discovered: records, read: records, updated: records }), failures: [] }
}

async function synchronizeCongressAmendmentsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = congressIdentityFor(context.identity, "amendments")
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  return synchronizeCongressAmendments(context.database, client, identity.scope, {
    limit: context.congressAmendmentLimit,
    sourceStore: sourceStoreFor(context)
  })
}

async function synchronizeCongressEventsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = congressIdentityFor(context.identity, "events")
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  const counts = createJobCounts()
  const failures: SynchronizationFailure[] = []
  const sourceStore = sourceStoreFor(context)
  let checkpoint: Readonly<Record<string, unknown>> | undefined

  for (const domain of ["meetings", "hearings"] as const) {
    const synchronized = await synchronizeCongressEvents(context.database, client, identity.scope, domain, {
      sourceStore
    })
    addJobCounts(counts, synchronized.counts)
    failures.push(...synchronized.failures)
    checkpoint = { congress: identity.scope, domain, ...synchronized.checkpoint }
  }

  return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
}

async function synchronizeCongressHouseVotesForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = congressIdentityFor(context.identity, "house-votes")
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  const counts = createJobCounts()
  const failures: SynchronizationFailure[] = []
  const sourceStore = sourceStoreFor(context)
  let checkpoint: Readonly<Record<string, unknown>> | undefined

  for (const session of [1, 2]) {
    const synchronized = await synchronizeCongressHouseVotes(context.database, client, identity.scope, session, {
      concurrency: context.config.ingestion.concurrency,
      sourceStore
    })
    addJobCounts(counts, synchronized.counts)
    failures.push(...synchronized.failures)
    checkpoint = { congress: identity.scope, session, ...synchronized.checkpoint }
  }

  return checkpoint === undefined ? { counts, failures } : { checkpoint, counts, failures }
}

async function synchronizeCongressCommitteeReportsForScope(
  context: SynchronizationRouteContext
): Promise<SynchronizationOperationResult> {
  const identity = congressIdentityFor(context.identity, "committee-reports")
  const client = context.congressClient ?? createCongressClient(context.config, context.onProgress)
  return synchronizeCongressCommitteeReports(context.database, client, identity.scope, {
    sourceStore: sourceStoreFor(context)
  })
}

function createSynchronizationJobInput(
  input: SynchronizationExecutionInput,
  identity: SynchronizationIdentity,
  now: Date,
  openStatesBillsFrom: Date | undefined
): Parameters<typeof runIngestionJob>[1] {
  const formattedIdentity = formatSynchronizationIdentity(identity)
  const scopeKey = `${identity.domain}:${identity.scope}`
  const scope = synchronizationScope(identity, formattedIdentity, now, openStatesBillsFrom)
  return input.workflowExecutionId === undefined
    ? {
        correlationId: input.correlationId,
        checkpointStream: formattedIdentity,
        operation: synchronizationOperation(identity),
        scope,
        scopeKey,
        source: identity.provider
      }
    : {
        correlationId: input.correlationId,
        checkpointStream: formattedIdentity,
        operation: synchronizationOperation(identity),
        scope,
        scopeKey,
        source: identity.provider,
        workflowExecutionId: input.workflowExecutionId
      }
}

function synchronizationScope(
  identity: SynchronizationIdentity,
  formattedIdentity: string,
  now: Date,
  openStatesBillsFrom: Date | undefined
): Readonly<Record<string, unknown>> {
  if (identity.provider === "openstates") {
    if (identity.domain === "bills") {
      return {
        from: (openStatesBillsFrom ?? new Date(now.getTime() - 7 * DAY_IN_MILLISECONDS)).toISOString(),
        identity: formattedIdentity,
        jurisdiction: identity.scope
      }
    }
    if (identity.domain === "events") {
      return {
        from: new Date(now.getTime() - 30 * DAY_IN_MILLISECONDS).toISOString(),
        identity: formattedIdentity,
        jurisdiction: identity.scope,
        to: new Date(now.getTime() + 90 * DAY_IN_MILLISECONDS).toISOString()
      }
    }
    return { identity: formattedIdentity, jurisdiction: identity.scope }
  }

  return identity.domain === "bills"
    ? { identity: formattedIdentity, scope: identity.scope }
    : { congress: identity.scope, identity: formattedIdentity }
}

async function resolveOpenStatesBillsFrom(
  database: LegislationDatabase,
  identity: SynchronizationIdentity,
  now: Date
): Promise<Date | undefined> {
  if (identity.provider !== "openstates" || identity.domain !== "bills") {
    return undefined
  }
  const stream = formatSynchronizationIdentity(identity)
  const checkpoints = await database
    .select({ watermark: syncCheckpoints.watermark })
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, "openstates"), eq(syncCheckpoints.stream, stream)))
    .limit(1)
  const watermark = checkpoints[0]?.watermark
  return watermark === null || watermark === undefined
    ? new Date(now.getTime() - 7 * DAY_IN_MILLISECONDS)
    : new Date(watermark.getTime() - OPENSTATES_BILL_OVERLAP_MILLISECONDS)
}

function synchronizationOperation(identity: SynchronizationIdentity): string {
  if (identity.provider === "openstates") {
    if (identity.domain === "bills") {
      return "incremental-sync"
    }
    if (identity.domain === "entities") {
      return "current-entities"
    }
    return "events-sync"
  }

  if (identity.domain === "bills") {
    return "incremental-sync"
  }
  if (identity.domain === "entities") {
    return "current-entities"
  }
  return `${identity.domain}-sync`
}

function synchronizationRouteName(identity: SynchronizationIdentity): SynchronizationRouteName {
  if (identity.provider === "openstates") {
    if (identity.domain === "bills") {
      return "openstates-bills"
    }
    if (identity.domain === "entities") {
      return "openstates-entities"
    }
    return "openstates-events"
  }
  if (identity.domain === "bills") {
    return "congress-bills"
  }
  if (identity.domain === "amendments") {
    return "congress-amendments"
  }
  if (identity.domain === "entities") {
    return "congress-entities"
  }
  if (identity.domain === "events") {
    return "congress-events"
  }
  if (identity.domain === "house-votes") {
    return "congress-house-votes"
  }
  return "congress-committee-reports"
}

function assertCanonicalIdentity(identity: SynchronizationIdentity): ApiSynchronizationIdentity {
  formatSynchronizationIdentity(identity)
  if (identity.provider === "govinfo") {
    throw new Error("GovInfo synchronization must use the BILLSTATUS synchronization service")
  }
  return identity
}

function assertProviderCredentials(config: LegislationConfig, identity: SynchronizationIdentity): void {
  if (identity.provider === "openstates" && config.ingestion.openStatesApiKey === undefined) {
    throw new Error("OPENSTATES_API_KEY is required for OpenStates synchronization")
  }
  if (identity.provider === "congress" && config.ingestion.congressApiKey === undefined) {
    throw new Error("CONGRESS_API_KEY is required for Congress.gov synchronization")
  }
}

function createOpenStatesClient(config: LegislationConfig): OpenStatesSynchronizationClient {
  const apiKey = config.ingestion.openStatesApiKey
  if (apiKey === undefined) {
    throw new Error("OPENSTATES_API_KEY is required for OpenStates synchronization")
  }
  return new DefaultOpenStatesClient({
    apiKey,
    baseUrl: new URL(config.ingestion.openStatesApiUrl),
    http: new RetryingHttpClient({
      maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
      // Transitional API access is locally paced, but production Open States
      // schedules remain inactive because the account's daily quota cannot
      // support freshness. Self-hosted scrapers replace this path.
      minimumIntervalMs: 800,
      requestTimeoutMs: config.ingestion.requestTimeoutMs
    })
  })
}

function createCongressClient(
  config: LegislationConfig,
  onProgress: SynchronizationRouteContext["onProgress"]
): CongressSynchronizationClient {
  const apiKey = config.ingestion.congressApiKey
  if (apiKey === undefined) {
    throw new Error("CONGRESS_API_KEY is required for Congress.gov synchronization")
  }
  return new DefaultCongressClient({
    apiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: new RetryingHttpClient({
      maxAttempts: config.ingestion.maxAttempts,
      // Local CLI use only. Trigger recurring and historical work receives a
      // coordinator-issued request budget in congress-wave-coordinator.
      minimumIntervalMs: 750,
      onAttemptComplete: (telemetry) => onProgress?.(congressRequestTelemetry(telemetry)),
      requestTimeoutMs: config.ingestion.requestTimeoutMs
    }),
    onPage: onProgress
  })
}

function congressRequestTelemetry(telemetry: HttpRequestTelemetry): Readonly<Record<string, unknown>> {
  return { provider: "congress", type: "provider-http", ...telemetry }
}

function sourceStoreFor(context: SynchronizationRouteContext): SourceStore {
  if (context.sourceStore !== undefined) {
    return context.sourceStore
  }
  if (context.config.azure.storageAccount !== undefined) {
    return new ArtifactSourceStore(
      new AzureBlobArtifactStore(context.config.azure.storageAccount, context.config.azure.federalSourceContainer)
    )
  }
  return new LocalSourceStore(resolve(context.config.ingestion.sourceDirectory, "federal"))
}

function openStatesIdentityFor(
  identity: SynchronizationIdentity,
  domain: OpenStatesSynchronizationIdentity["domain"]
): OpenStatesSynchronizationIdentity {
  if (identity.provider === "openstates" && identity.domain === domain) {
    return identity
  }
  throw new Error(`Expected an OpenStates ${domain} synchronization identity`)
}

function congressIdentityFor(
  identity: SynchronizationIdentity,
  domain: CongressScopedSynchronizationIdentity["domain"]
): CongressScopedSynchronizationIdentity {
  if (identity.provider === "congress" && identity.domain === domain) {
    return identity
  }
  throw new Error(`Expected a Congress ${domain} synchronization identity`)
}

function addJobCounts(target: JobCounts, source: JobCounts): void {
  target.discovered += source.discovered
  target.failed += source.failed
  target.inserted += source.inserted
  target.read += source.read
  target.skipped += source.skipped
  target.unchanged += source.unchanged
  target.updated += source.updated
}
