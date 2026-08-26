import { afterAll, describe, expect, it, vi } from "vitest"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import {
  createCongressSynchronizationIdentity,
  createOpenStatesSynchronizationIdentity,
  formatSynchronizationIdentity,
  type SynchronizationIdentity
} from "../../trigger/identities.js"
import { createJobCounts, runIngestionJob, type JobResult } from "../job.js"
import {
  executeSynchronization,
  type SynchronizationExecutionDependencies,
  type SynchronizationExecutionInput
} from "./synchronize.js"

const config = loadConfig({ CONGRESS_API_KEY: "congress-key", NODE_ENV: "test", OPENSTATES_API_KEY: "openstates-key" })
const { database, pool } = createDatabase(config.database)
const fixedNow = new Date("2026-08-18T12:00:00.000Z")

afterAll(async () => {
  await pool.end()
})

describe("executeSynchronization", () => {
  it("routes every canonical identity to its isolated operation and scope key", async () => {
    const inputs: Parameters<typeof runIngestionJob>[1][] = []
    const routeCalls: string[] = []
    const dependencies: SynchronizationExecutionDependencies = {
      now: () => fixedNow,
      openStatesBillsFrom: new Date("2026-08-11T12:00:00.000Z"),
      routes: {
        "congress-amendments": async () => routeResult(routeCalls, "congress-amendments"),
        "congress-bills": async () => routeResult(routeCalls, "congress-bills"),
        "congress-committee-reports": async () => routeResult(routeCalls, "congress-committee-reports"),
        "congress-entities": async () => routeResult(routeCalls, "congress-entities"),
        "congress-events": async () => routeResult(routeCalls, "congress-events"),
        "congress-house-votes": async () => routeResult(routeCalls, "congress-house-votes"),
        "openstates-bills": async () => routeResult(routeCalls, "openstates-bills"),
        "openstates-entities": async () => routeResult(routeCalls, "openstates-entities"),
        "openstates-events": async () => routeResult(routeCalls, "openstates-events")
      },
      runIngestionJob: createJobRunner(inputs)
    }
    const cases = [
      {
        identity: createOpenStatesSynchronizationIdentity("bills", "ca"),
        operation: "incremental-sync",
        route: "openstates-bills",
        scopeKey: "bills:ca"
      },
      {
        identity: createOpenStatesSynchronizationIdentity("entities", "tx"),
        operation: "current-entities",
        route: "openstates-entities",
        scopeKey: "entities:tx"
      },
      {
        identity: createOpenStatesSynchronizationIdentity("events", "dc"),
        operation: "events-sync",
        route: "openstates-events",
        scopeKey: "events:dc"
      },
      {
        identity: createCongressSynchronizationIdentity("bills"),
        operation: "incremental-sync",
        route: "congress-bills",
        scopeKey: "bills:current"
      },
      {
        identity: createCongressSynchronizationIdentity("amendments", 119),
        operation: "amendments-sync",
        route: "congress-amendments",
        scopeKey: "amendments:119"
      },
      {
        identity: createCongressSynchronizationIdentity("entities", 119),
        operation: "current-entities",
        route: "congress-entities",
        scopeKey: "entities:119"
      },
      {
        identity: createCongressSynchronizationIdentity("events", 119),
        operation: "events-sync",
        route: "congress-events",
        scopeKey: "events:119"
      },
      {
        identity: createCongressSynchronizationIdentity("house-votes", 119),
        operation: "house-votes-sync",
        route: "congress-house-votes",
        scopeKey: "house-votes:119"
      },
      {
        identity: createCongressSynchronizationIdentity("committee-reports", 119),
        operation: "committee-reports-sync",
        route: "congress-committee-reports",
        scopeKey: "committee-reports:119"
      }
    ]

    for (const item of cases) {
      const result = await executeSynchronization(executionInput(item.identity), dependencies)
      expect(result.status).toBe("succeeded")
    }

    expect(routeCalls).toEqual(cases.map((item) => item.route))
    expect(inputs).toHaveLength(cases.length)
    for (const [index, item] of cases.entries()) {
      const jobInput = inputs[index]
      expect(jobInput).toMatchObject({
        correlationId: "trigger-run",
        operation: item.operation,
        scopeKey: item.scopeKey,
        source: item.identity.provider,
        workflowExecutionId: "trigger-execution"
      })
      expect(jobInput?.scope.identity).toBe(formatSynchronizationIdentity(item.identity))
    }
    expect(inputs[0]?.scope.from).toBe("2026-08-11T12:00:00.000Z")
    expect(inputs[2]?.scope).toMatchObject({
      from: "2026-07-19T12:00:00.000Z",
      to: "2026-11-16T12:00:00.000Z"
    })
  })

  it("rejects execution without the provider credential before acquiring a lease", async () => {
    const missingOpenStatesKey = loadConfig({ CONGRESS_API_KEY: "congress-key", NODE_ENV: "test" })
    const dependencies: SynchronizationExecutionDependencies = {
      runIngestionJob: async () => {
        throw new Error("The job runner must not be called")
      }
    }

    await expect(
      executeSynchronization(
        {
          ...executionInput(createOpenStatesSynchronizationIdentity("bills", "ca")),
          config: missingOpenStatesKey
        },
        dependencies
      )
    ).rejects.toThrow("OPENSTATES_API_KEY is required")
  })

  it("rejects Congress.gov execution without the provider credential before acquiring a lease", async () => {
    const missingCongressKey = loadConfig({ NODE_ENV: "test", OPENSTATES_API_KEY: "openstates-key" })
    const dependencies: SynchronizationExecutionDependencies = {
      runIngestionJob: async () => {
        throw new Error("The job runner must not be called")
      }
    }

    await expect(
      executeSynchronization(
        {
          ...executionInput(createCongressSynchronizationIdentity("bills")),
          config: missingCongressKey
        },
        dependencies
      )
    ).rejects.toThrow("CONGRESS_API_KEY is required")
  })

  it("hydrates and persists Congress member detail through the default daily entity route", async () => {
    const replaceSnapshot = vi.fn<() => Promise<void>>(async () => undefined)
    const getMember = vi.fn<(bioguideId: string) => Promise<unknown>>(async (bioguideId) => ({
      bioguideId,
      currentMember: true,
      officialUrl: "https://example.house.gov/",
      terms: {
        item: [
          {
            chamber: "House of Representatives",
            congress: 119,
            memberType: "Representative",
            startYear: 2025
          }
        ]
      }
    }))
    const congressClient = {
      async *committees() {
        yield []
      },
      getMember,
      async *members() {
        yield [
          {
            bioguideId: "D000001",
            name: "Daily Example",
            terms: { item: [{ chamber: "House of Representatives", startYear: 2025 }] },
            url: "https://api.congress.gov/member/D000001"
          }
        ]
      }
    }

    const result = await executeSynchronization(
      executionInput(createCongressSynchronizationIdentity("entities", 119)),
      {
        congressClient: congressClient as never,
        replaceEntitySnapshot: replaceSnapshot as never,
        runIngestionJob: createJobRunner([])
      }
    )

    expect(result.status).toBe("succeeded")
    expect(getMember).toHaveBeenCalledWith("D000001")
    expect(replaceSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      "jurisdiction:us",
      expect.objectContaining({
        personDetailSourceProvider: "congress",
        personDetails: [expect.objectContaining({ personId: "person:congress:d000001" })],
        personJurisdictions: [expect.objectContaining({ personId: "person:congress:d000001" })],
        terms: [expect.objectContaining({ officeTitle: "Representative", role: "Representative" })]
      })
    )
  })
})

function executionInput(identity: SynchronizationIdentity): SynchronizationExecutionInput {
  return {
    config,
    correlationId: "trigger-run",
    database,
    identity,
    workflowExecutionId: "trigger-execution"
  }
}

function createJobRunner(
  inputs: Parameters<typeof runIngestionJob>[1][]
): SynchronizationExecutionDependencies["runIngestionJob"] {
  return async (_database, input, operation): Promise<JobResult> => {
    inputs.push(input)
    const result = await operation("run-1")
    return {
      ...result,
      correlationId: input.correlationId,
      operation: input.operation,
      runId: "run-1",
      source: input.source,
      status: result.counts.failed === 0 ? "succeeded" : "partial",
      workflowExecutionId: input.workflowExecutionId
    }
  }
}

function routeResult(routeCalls: string[], route: string) {
  routeCalls.push(route)
  return Promise.resolve({ counts: createJobCounts(), failures: [] })
}
