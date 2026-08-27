import { and, eq, inArray, isNull, or, sql } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { replaceEntitySnapshot } from "../../db/queries/entities.js"
import {
  legislativeSessions,
  legislativeTerms,
  organizationMemberships,
  people,
  personAliases,
  syncCheckpoints
} from "../../db/schema/schema.js"
import { jurisdictionId, legislativeSessionId } from "../../legislation/identifiers.js"
import { RetryingHttpClient } from "../http-client.js"
import { createJobCounts, runIngestionJob, type JobResult } from "../job.js"
import { GovInfoCommitteeDirectoryClient } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory, type GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import { parseGovInfoCommitteeDirectory } from "./committee-directory-parser.js"

type CommitteeDirectoryClient = Pick<GovInfoCommitteeDirectoryClient, "discover" | "getText">

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
}

/** Applies complete Congressional Directory editions in issue order, preserving distinct observed tenures. */
export async function executeGovInfoCommitteeSynchronization(
  input: GovInfoCommitteeSynchronizationInput,
  dependencies: GovInfoCommitteeSynchronizationDependencies = {}
): Promise<JobResult> {
  if (!Number.isSafeInteger(input.congress) || input.congress < 1) {
    throw new Error("GovInfo committee Congress must be a positive integer")
  }
  const stream = `govinfo:committee-directory:${input.congress}`
  const client = dependencies.client ?? createClient(input.config)
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
        (directoryPackage) => checkpoint === undefined || directoryPackage.issuedAt > checkpoint
      )
      let applied = checkpoint
      let packageId: string | undefined
      const catalog = await loadCatalog(input.database)
      for (const directoryPackage of packages) {
        const text = await client.getText(directoryPackage)
        counts.read += 1
        const records = parseGovInfoCommitteeDirectory(text)
        const normalized = normalizeGovInfoCommitteeDirectory(records, directoryPackage, catalog, runAt)
        if (normalized.unmatched.length > 0) {
          const examples = normalized.unmatched
            .slice(0, 5)
            .map((failure) => `${failure.name} (${failure.organization})`)
            .join("; ")
          throw new Error(
            `GovInfo package ${directoryPackage.packageId} has ${normalized.unmatched.length} unmatched committee members: ${examples}`
          )
        }
        await replaceEntitySnapshot(input.database, jurisdictionId("us"), normalized.snapshot, {
          membershipDetectionDate: directoryPackage.issuedAt.toISOString().slice(0, 10),
          membershipSessionId: session.id,
          organizationSourceProvider: "govinfo",
          replacePeople: false
        })
        counts.updated += normalized.snapshot.organizations.length + normalized.snapshot.memberships.length
        applied = directoryPackage.issuedAt
        packageId = directoryPackage.packageId
      }
      if (session.hasEnded) {
        await endCongressMemberships(input.database, session.id)
      }
      counts.skipped = discovered.length - packages.length
      return {
        checkpoint: {
          congress: input.congress,
          issuedAt: applied?.toISOString(),
          packageId
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

async function readCheckpoint(database: LegislationDatabase, stream: string): Promise<Date | undefined> {
  const checkpoint = await database.query.syncCheckpoints.findFirst({
    where: and(eq(syncCheckpoints.source, "govinfo"), eq(syncCheckpoints.stream, stream))
  })
  const value = checkpoint?.cursor.issuedAt
  if (typeof value !== "string") {
    return undefined
  }
  const issuedAt = new Date(value)
  return Number.isNaN(issuedAt.getTime()) ? undefined : issuedAt
}

function createClient(config: LegislationConfig): CommitteeDirectoryClient {
  const apiKey = config.ingestion.govInfoApiKey
  if (apiKey === undefined) {
    throw new Error("GOVINFO_API_KEY is required for GovInfo committee synchronization")
  }
  const http = new RetryingHttpClient({
    maxAttempts: config.ingestion.maxAttempts,
    minimumIntervalMs: 100,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
  return new GovInfoCommitteeDirectoryClient({
    apiKey,
    apiUrl: new URL(config.ingestion.govInfoApiUrl),
    http
  })
}
