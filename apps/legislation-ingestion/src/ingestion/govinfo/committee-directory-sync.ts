import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import {
  legislativeSessions,
  legislativeTerms,
  organizationMemberships,
  people,
  personAliases,
  syncCheckpoints
} from "@repo/legislation-core/database/schema/schema"
import { readDirectoryObservation } from "@repo/legislation-core/domain/committee-directory-observation"
import { jurisdictionId, legislativeSessionId } from "@repo/legislation-core/domain/identifiers"
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import { replaceEntitySnapshot } from "../../persistence/entities.js"
import { RetryingHttpClient } from "../http-client.js"
import { createJobCounts, runIngestionJob, type JobResult } from "../job.js"
import type { ProviderRequestAdmission } from "../provider-request-admission.js"
import { GovInfoCommitteeDirectoryClient } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory, type GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import { committeeRosterFingerprint, directoryDetectionDate } from "./committee-directory-observation.js"

type CommitteeDirectoryClient = Pick<GovInfoCommitteeDirectoryClient, "discover" | "getRecords"> &
  Partial<Pick<GovInfoCommitteeDirectoryClient, "getMemberAliases">>

export interface GovInfoCommitteeSynchronizationInput {
  config: LegislationConfig
  congress: number
  correlationId: string
  database: LegislationDatabase
  restart?: boolean
  workflowExecutionId?: string
}

export interface GovInfoCommitteeSynchronizationDependencies {
  client?: CommitteeDirectoryClient
  loadCatalog?: (database: LegislationDatabase) => Promise<GovInfoPersonCatalog>
  now?: () => Date
  providerAdmission?: ProviderRequestAdmission
}

/** Applies reviewed Congressional Directory editions with atomic coverage assessments and distinct observed tenures. */
export async function executeGovInfoCommitteeSynchronization(
  input: GovInfoCommitteeSynchronizationInput,
  dependencies: GovInfoCommitteeSynchronizationDependencies = {}
): Promise<JobResult> {
  if (!Number.isSafeInteger(input.congress) || input.congress < 1) {
    throw new Error("GovInfo committee Congress must be a positive integer")
  }
  const stream = `govinfo:committee-directory:${input.congress}`
  const client = dependencies.client ?? createClient(input.config, dependencies.providerAdmission)
  const loadCatalog = dependencies.loadCatalog ?? loadFederalPersonCatalog
  const jobInput = {
    checkpointStream: stream,
    correlationId: input.correlationId,
    operation: "committee-directory-sync",
    scope: { congress: input.congress, restart: input.restart === true },
    scopeKey: `committees:${input.congress}`,
    source: "govinfo"
  }
  return runIngestionJob(
    input.database,
    input.workflowExecutionId === undefined
      ? jobInput
      : { ...jobInput, workflowExecutionId: input.workflowExecutionId },
    async () => {
      const counts = createJobCounts()
      const runAt = dependencies.now?.() ?? new Date()
      const session = federalCongressSession(input.congress, runAt)
      await upsertFederalCongressSession(input.database, session)
      const discovered = await client.discover(input.congress)
      counts.discovered = discovered.length
      if (discovered.length === 0) {
        throw new Error(`GovInfo returned no Congressional Directory packages for Congress ${input.congress}`)
      }
      const checkpoint = input.restart === true ? undefined : await readCheckpoint(input.database, stream)
      const packages = discovered.filter(
        (directoryPackage) => checkpoint === undefined || directoryPackage.issuedAt >= checkpoint.issuedAt
      )
      let observation = checkpoint?.observation
      let applied = checkpoint?.issuedAt
      let packageId = checkpoint?.packageId
      const catalog = await loadCatalog(input.database)
      const validated = await mapConcurrent(packages, 2, async (directoryPackage) => {
        const records = await client.getRecords(directoryPackage)
        counts.read += 1
        let normalized = normalizeGovInfoCommitteeDirectory(records, directoryPackage, catalog, runAt)
        if (normalized.unmatched.length > 0 && client.getMemberAliases !== undefined) {
          const unmatched = new Set(normalized.unmatched.map((member) => `${member.chamber}:${member.name}`))
          const candidates = records
            .flatMap((record) => record.members)
            .filter((member) => unmatched.has(`${member.chamber}:${member.name}`))
          const aliases = await client.getMemberAliases(directoryPackage, candidates)
          normalized = normalizeGovInfoCommitteeDirectory(
            records,
            directoryPackage,
            {
              ...catalog,
              aliases: [...catalog.aliases, ...aliases]
            },
            runAt
          )
        }
        if (normalized.unmatched.length > 0) {
          const examples = normalized.unmatched
            .slice(0, 5)
            .map((failure) => `${failure.name} (${failure.organization})`)
            .join("; ")
          throw new Error(
            `GovInfo package ${directoryPackage.packageId} has ${normalized.unmatched.length} unmatched committee members: ${examples}`
          )
        }
        return { directoryPackage, normalized }
      })
      // Reject source/identity failures in later editions before publishing any roster.
      // Individual snapshot/checkpoint commits still make database failures resumable.
      for (const { directoryPackage, normalized } of validated) {
        const fingerprint = committeeRosterFingerprint(normalized.snapshot.memberships)
        if (
          observation === undefined &&
          checkpoint !== undefined &&
          directoryPackage.issuedAt.getTime() === checkpoint.issuedAt.getTime()
        ) {
          // Bootstrap the deployed checkpoint only if today's source agrees with
          // the already-published roster. Never invent a previously unseen change.
          const existing = await input.database
            .select({
              organizationId: organizationMemberships.organizationId,
              personId: organizationMemberships.personId,
              role: organizationMemberships.role
            })
            .from(organizationMemberships)
            .where(
              and(
                eq(organizationMemberships.sourceProvider, "govinfo"),
                eq(organizationMemberships.legislativeSessionId, session.id),
                or(
                  eq(organizationMemberships.isActive, true),
                  eq(organizationMemberships.endedReason, "congress_ended")
                )
              )
            )
          if (committeeRosterFingerprint(existing) !== fingerprint) {
            throw new Error(
              "GovInfo roster differs from the published checkpoint without a saved observation; review is required"
            )
          }
          observation = {
            detectedAt: directoryPackage.issuedAt.toISOString(),
            fingerprint,
            issuedAt: directoryPackage.issuedAt.toISOString(),
            lastModified: directoryPackage.lastModified.toISOString(),
            packageId: directoryPackage.packageId
          }
        }
        const detectedAt = directoryDetectionDate({
          fingerprint,
          issuedAt: directoryPackage.issuedAt,
          lastModified: directoryPackage.lastModified,
          now: runAt,
          packageId: directoryPackage.packageId,
          sessionEnd: session.endDate,
          ...(observation === undefined ? {} : { previous: observation })
        })
        if (detectedAt === undefined) {
          packageId = directoryPackage.packageId
          if (observation !== undefined && directoryPackage.lastModified > new Date(observation.lastModified)) {
            observation.lastModified = directoryPackage.lastModified.toISOString()
          }
          counts.skipped += 1
          continue
        }
        observation = {
          coverage: {
            status: normalized.quarantined.length === 0 ? "complete" : "incomplete",
            quarantined: [...normalized.quarantined]
          },
          detectedAt: detectedAt.toISOString(),
          fingerprint,
          issuedAt: directoryPackage.issuedAt.toISOString(),
          lastModified: directoryPackage.lastModified.toISOString(),
          packageId: directoryPackage.packageId
        }
        for (const membership of normalized.snapshot.memberships) {
          if (membership.endedReason === "historical_at_first_observation") {
            membership.isActive = false
            membership.detectedStartDate = null
            membership.detectedEndDate = null
            membership.lastObservedDate = null
            continue
          }
          membership.detectedStartDate = detectedAt.toISOString().slice(0, 10)
          membership.lastObservedDate = membership.detectedStartDate
          if (session.hasEnded) {
            membership.isActive = false
            membership.endedReason = "congress_ended"
            membership.detectedEndDate = null
          }
        }
        if (session.hasEnded) {
          for (const organization of normalized.snapshot.organizations) {
            organization.isActive = false
          }
        }
        await replaceEntitySnapshot(input.database, jurisdictionId("us"), normalized.snapshot, {
          checkpoint: {
            source: "govinfo",
            stream,
            cursor: {
              congress: input.congress,
              issuedAt: directoryPackage.issuedAt.toISOString(),
              packageId: directoryPackage.packageId,
              observation
            }
          },
          membershipDetectionDate: detectedAt.toISOString().slice(0, 10),
          membershipSessionId: session.id,
          organizationSourceProvider: "govinfo",
          preserveExistingOrganizations: session.hasEnded,
          replacePeople: false,
          statementTimeoutMs: 60_000
        })
        counts.updated += normalized.snapshot.organizations.length + normalized.snapshot.memberships.length
        applied = directoryPackage.issuedAt
        packageId = directoryPackage.packageId
      }
      if (session.hasEnded) {
        await endCongressMemberships(input.database, session.id)
      }
      counts.skipped += discovered.length - packages.length
      return {
        checkpoint: {
          congress: input.congress,
          issuedAt: applied?.toISOString(),
          packageId,
          observation
        },
        counts,
        failures: []
      }
    }
  )
}

/** Deletes reconstructable GovInfo tenures before an explicit range replay. */
export async function resetGovInfoCommitteeMembershipHistory(
  database: LegislationDatabase,
  congresses: readonly number[]
): Promise<void> {
  const sessionIds = congresses.map((congress) => legislativeSessionId("us", String(congress)))
  await database
    .delete(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.sourceProvider, "govinfo"),
        sessionIds.length === 0
          ? isNull(organizationMemberships.legislativeSessionId)
          : or(
              isNull(organizationMemberships.legislativeSessionId),
              inArray(organizationMemberships.legislativeSessionId, sessionIds)
            )
      )
    )
}

interface FederalCongressSession {
  endDate: string
  hasEnded: boolean
  id: string
  identifier: string
  isActive: boolean
  name: string
  startDate: string
}

function federalCongressSession(congress: number, now: Date): FederalCongressSession {
  const startYear = 1789 + (congress - 1) * 2
  const startDate = `${startYear}-01-03`
  const endDate = `${startYear + 2}-01-03`
  const today = now.toISOString().slice(0, 10)
  return {
    endDate,
    hasEnded: today >= endDate,
    id: legislativeSessionId("us", String(congress)),
    identifier: String(congress),
    isActive: today >= startDate && today < endDate,
    name: `${ordinal(congress)} Congress`,
    startDate
  }
}

function ordinal(value: number): string {
  const remainder100 = value % 100
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`
  }
  switch (value % 10) {
    case 1:
      return `${value}st`
    case 2:
      return `${value}nd`
    case 3:
      return `${value}rd`
    default:
      return `${value}th`
  }
}

async function upsertFederalCongressSession(
  database: LegislationDatabase,
  session: FederalCongressSession
): Promise<void> {
  await database
    .insert(legislativeSessions)
    .values({
      classification: "congress",
      endDate: session.endDate,
      id: session.id,
      identifier: session.identifier,
      isActive: session.isActive,
      jurisdictionId: jurisdictionId("us"),
      name: session.name,
      startDate: session.startDate
    })
    .onConflictDoUpdate({
      set: {
        classification: sql`excluded.classification`,
        endDate: sql`excluded.end_date`,
        isActive: sql`excluded.is_active`,
        name: sql`excluded.name`,
        startDate: sql`excluded.start_date`,
        updatedAt: new Date()
      },
      target: legislativeSessions.id
    })
}

async function endCongressMemberships(database: LegislationDatabase, sessionId: string): Promise<void> {
  await database
    .update(organizationMemberships)
    .set({ endedReason: "congress_ended", isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(organizationMemberships.legislativeSessionId, sessionId),
        eq(organizationMemberships.sourceProvider, "govinfo"),
        eq(organizationMemberships.isActive, true)
      )
    )
}

async function loadFederalPersonCatalog(database: LegislationDatabase): Promise<GovInfoPersonCatalog> {
  const federalJurisdictionId = jurisdictionId("us")
  const [personRows, termRows, aliasRows] = await Promise.all([
    database
      .select({ familyName: people.familyName, givenName: people.givenName, id: people.id, name: people.name })
      .from(people)
      .where(eq(people.jurisdictionId, federalJurisdictionId)),
    database
      .select({
        chamber: legislativeTerms.chamber,
        district: legislativeTerms.district,
        isActive: legislativeTerms.isActive,
        personId: legislativeTerms.personId,
        sourceId: legislativeTerms.sourceId
      })
      .from(legislativeTerms)
      .where(eq(legislativeTerms.jurisdictionId, federalJurisdictionId)),
    database
      .select({ name: personAliases.name, personId: personAliases.personId })
      .from(personAliases)
      .innerJoin(people, eq(personAliases.personId, people.id))
      .where(eq(people.jurisdictionId, federalJurisdictionId))
  ])
  return { aliases: aliasRows, people: personRows, terms: termRows }
}

async function readCheckpoint(database: LegislationDatabase, stream: string) {
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "govinfo"), eq(syncCheckpoints.stream, stream))
  })
  const value = checkpoint?.cursor.issuedAt
  if (typeof value !== "string") {
    return undefined
  }
  const issuedAt = new Date(value)
  if (Number.isNaN(issuedAt.getTime())) {
    throw new Error("GovInfo committee checkpoint has an invalid issue date")
  }
  return {
    issuedAt,
    packageId: typeof checkpoint?.cursor.packageId === "string" ? checkpoint.cursor.packageId : undefined,
    observation: readDirectoryObservation(checkpoint?.cursor.observation)
  }
}

function createClient(config: LegislationConfig, admission?: ProviderRequestAdmission): CommitteeDirectoryClient {
  const apiKey = config.ingestion.govInfoApiKey
  if (apiKey === undefined) {
    throw new Error("GOVINFO_API_KEY is required for GovInfo committee synchronization")
  }
  const http = new RetryingHttpClient({
    afterAttemptComplete: admission === undefined ? undefined : (telemetry) => admission.afterAttempt(telemetry),
    beforeAttempt: admission === undefined ? undefined : () => admission.beforeAttempt(),
    maxAttempts: config.ingestion.maxAttempts,
    minimumIntervalMs: admission === undefined ? 100 : 0,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
  return new GovInfoCommitteeDirectoryClient({
    apiKey,
    apiUrl: new URL(config.ingestion.govInfoApiUrl),
    http
  })
}
