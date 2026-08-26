import { and, eq } from "drizzle-orm"
import type { LegislationConfig } from "../../config/config.js"
import type { LegislationDatabase } from "../../db/database.js"
import { replaceEntitySnapshot } from "../../db/queries/entities.js"
import { legislativeTerms, people, personAliases, syncCheckpoints } from "../../db/schema/schema.js"
import { jurisdictionId } from "../../legislation/identifiers.js"
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
        const normalized = normalizeGovInfoCommitteeDirectory(
          records,
          directoryPackage,
          catalog,
          dependencies.now?.() ?? new Date()
        )
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
          membershipObservedAt: directoryPackage.issuedAt.toISOString().slice(0, 10),
          organizationSourceProvider: "govinfo",
          replacePeople: false
        })
        counts.updated += normalized.snapshot.organizations.length + normalized.snapshot.memberships.length
        applied = directoryPackage.issuedAt
        packageId = directoryPackage.packageId
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
