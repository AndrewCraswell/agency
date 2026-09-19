import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import type { LegislationConfig } from "../../config/config.js"
import { replaceEntitySnapshot } from "../../persistence/entities.js"
import { CongressClient } from "../congress/client.js"
import { hydrateCongressMemberSnapshot } from "../congress/member-details.js"
import { RetryingHttpClient } from "../http-client.js"
import { createJobCounts } from "../job-result.js"
import { runIngestionJob, type JobResult } from "../job.js"

interface CongressEntityClient {
  getMember(bioguideId: string): Promise<unknown>
  members(congress: number): AsyncIterable<readonly unknown[]>
}

export type CongressEntityRangeInput = Readonly<{
  config: LegislationConfig
  correlationId: string
  database: LegislationDatabase
  endCongress: number
  startCongress: number
  workflowExecutionId?: string
}>

export type CongressEntityRangeDependencies = Readonly<{
  client?: CongressEntityClient
  replaceEntitySnapshot?: typeof replaceEntitySnapshot
  runIngestionJob?: typeof runIngestionJob
}>

/** Rebuilds the federal entity snapshot across the complete configured Congress range. */
export async function executeCongressEntityRangeBackfill(
  input: CongressEntityRangeInput,
  dependencies: CongressEntityRangeDependencies = {}
): Promise<JobResult> {
  validateRange(input.startCongress, input.endCongress)
  const client = dependencies.client ?? createClient(input.config)
  const replaceSnapshot = dependencies.replaceEntitySnapshot ?? replaceEntitySnapshot
  const run = dependencies.runIngestionJob ?? runIngestionJob
  const jobInput = {
    correlationId: input.correlationId,
    operation: "current-entities",
    scope: { endCongress: input.endCongress, startCongress: input.startCongress },
    scopeKey: input.startCongress === input.endCongress ? `entities:${input.startCongress}` : "entities:all",
    source: "congress"
  }
  return run(
    input.database,
    input.workflowExecutionId === undefined
      ? jobInput
      : { ...jobInput, workflowExecutionId: input.workflowExecutionId },
    async () => {
      const peopleById = new Map()
      const memberSnapshots: Array<Awaited<ReturnType<typeof hydrateCongressMemberSnapshot>>> = []
      const termsById = new Map()
      const memberDetailCache = new Map<string, unknown>()
      for (let congress = input.startCongress; congress <= input.endCongress; congress += 1) {
        const members: unknown[] = []
        for await (const page of client.members(congress)) {
          members.push(...page)
        }
        if (members.length === 0) {
          throw new Error(`Congress ${congress} returned no members; refusing to replace the federal entity snapshot`)
        }
        const context = { retrievedAt: new Date() }
        const memberSnapshot = await hydrateCongressMemberSnapshot(
          members,
          congress,
          context,
          client,
          memberDetailCache
        )
        memberSnapshots.push(memberSnapshot)
        for (const person of memberSnapshot.people) {
          peopleById.set(person.id, person)
        }
        for (const term of memberSnapshot.terms) {
          termsById.set(term.id, term)
        }
      }
      await replaceSnapshot(
        input.database,
        "jurisdiction:us",
        {
          memberships: [],
          organizations: [],
          personAliasPersonIds: unique(memberSnapshots.flatMap((snapshot) => snapshot.personAliasPersonIds)),
          personAliasSourceProvider: "congress",
          personAliases: uniqueById(
            memberSnapshots.flatMap((snapshot) => snapshot.personAliases),
            (alias) => `${alias.personId}:${alias.sourceIdentity}`
          ),
          personExternalIdentifiers: uniqueById(
            memberSnapshots.flatMap((snapshot) => snapshot.personExternalIdentifiers ?? []),
            (identifier) => `${identifier.personId}:${identifier.sourceIdentity}`
          ),
          personDetailPersonIds: memberDetailsByPersonId(memberSnapshots).map((detail) => detail.personId),
          personDetailSourceProvider: "congress",
          personDetails: memberDetailsByPersonId(memberSnapshots),
          personJurisdictions: memberJurisdictionsByPersonId(memberSnapshots),
          people: [...peopleById.values()],
          termPersonIds: unique(memberSnapshots.flatMap((snapshot) => snapshot.termPersonIds ?? [])),
          termSourceProvider: "congress",
          terms: [...termsById.values()]
        },
        { replaceOrganizations: false }
      )
      const records = peopleById.size + termsById.size
      return { counts: createJobCounts({ discovered: records, read: records, updated: records }), failures: [] }
    }
  )
}

function memberDetailsByPersonId(snapshots: ReadonlyArray<Awaited<ReturnType<typeof hydrateCongressMemberSnapshot>>>) {
  return uniqueById(
    snapshots.flatMap((snapshot) => snapshot.personDetails ?? []),
    (detail) => detail.personId
  )
}

function memberJurisdictionsByPersonId(
  snapshots: ReadonlyArray<Awaited<ReturnType<typeof hydrateCongressMemberSnapshot>>>
) {
  return uniqueById(
    snapshots.flatMap((snapshot) => snapshot.personJurisdictions ?? []),
    (record) => `${record.personId}:${record.jurisdictionId}:${record.sourceIdentity}`
  )
}

function uniqueById<T>(values: readonly T[], identity: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()]
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function createClient(config: LegislationConfig): CongressEntityClient {
  const apiKey = config.ingestion.congressApiKey
  if (apiKey === undefined) {
    throw new Error("CONGRESS_API_KEY is required for Congress entity backfill")
  }
  return new CongressClient({
    apiKey,
    baseUrl: new URL(config.ingestion.congressApiUrl),
    http: new RetryingHttpClient({
      maxAttempts: config.ingestion.maxAttempts,
      minimumIntervalMs: 800,
      requestTimeoutMs: config.ingestion.requestTimeoutMs
    })
  })
}

function validateRange(start: number, end: number): void {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new Error("Congress entity backfill requires a valid positive inclusive range")
  }
}
