import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { LinearClient, createLinearClientFromEnvironment } from "./client"

const OperationSchema = z
  .object({
    query: z.string(),
    variables: z.record(z.string(), z.unknown())
  })
  .strict()
const IssueCreateInputSchema = z
  .object({
    title: z.string(),
    description: z.string()
  })
  .passthrough()

const team = { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
const state = { id: "7a766a80-3d80-4bd8-8143-b19f4fc8d4c7", name: "Todo", type: "unstarted" }
const seedIssues = [
  ["openhands-profile-tests", "FEN-101", "Add profile tests"],
  ["langsmith-tracing-tests", "FEN-102", "Add tracing tests"],
  ["runtime-tests", "FEN-103", "Add runtime tests"]
].map(([key, identifier, title], index) => ({
  id: `b0c6449e-380d-4e37-bcc4-4c86dff6bb${index + 1}d`,
  identifier,
  title,
  description: `Acceptance criteria.\n\n<!-- agency-agent-platform:seed:${key} -->`,
  url: `https://linear.app/fencing-club/issue/${identifier}/task`,
  priority: 4,
  state
}))

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function emptyRelations() {
  return response({
    data: { issueRelations: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } }
  })
}

function operation(request: RequestInfo | URL, init?: RequestInit) {
  expect(request.toString()).toBe("https://api.linear.test/graphql")
  expect(init?.headers).toEqual({ Authorization: "linear-token", "Content-Type": "application/json" })
  return OperationSchema.parse(JSON.parse(init?.body?.toString() ?? "{}"))
}

describe("LinearClient", () => {
  it("records delivery evidence before completing the Linear task", async () => {
    const issueId = seedIssues[0]?.id
    if (issueId === undefined) {
      throw new Error("Expected a seeded issue")
    }
    const completedState = { id: "e516f7df-9985-42c9-a4cc-e9c490a638ea", name: "Done", type: "completed" }
    const operations: z.infer<typeof OperationSchema>[] = []
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      operations.push(body)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [team] } } })
      }
      if (body.query.includes("WorkItemWorkflowStates")) {
        return response({ data: { team: { states: { nodes: [state, completedState] } } } })
      }
      if (body.query.includes("RecordAgentEvidence")) {
        return response({
          data: { commentCreate: { success: true, comment: { id: "5694b68b-a2f0-4458-a2a6-5fd394a00d79" } } }
        })
      }
      return response({ data: { issueUpdate: { success: true, issue: { id: issueId } } } })
    })
    const client = new LinearClient({
      apiKey: "linear-token",
      teamSelector: "FEN",
      endpoint: "https://api.linear.test/graphql",
      fetcher
    })

    await client.recordAgentActivity(issueId, "completed", "Merged PR #42 after one review round.")

    expect(operations.map(({ query }) => query.match(/(?:query|mutation)\s+([A-Za-z]+)/u)?.[1])).toEqual([
      "WorkItemTeams",
      "WorkItemWorkflowStates",
      "RecordAgentEvidence",
      "UpdateAgentWorkItem"
    ])
    expect(operations.at(-2)?.variables).toEqual({
      input: { issueId, body: "Merged PR #42 after one review round." }
    })
    expect(operations.at(-1)?.variables).toEqual({ id: issueId, input: { stateId: completedState.id } })
  })

  it("returns dependency-ready active tasks in deterministic priority order", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [team] } } })
      }
      if (body.query.includes("WorkItemRelations")) {
        return emptyRelations()
      }
      return response({
        data: {
          team: {
            ...team,
            issues: {
              nodes: [
                seedIssues[2],
                { ...seedIssues[1], state: { ...state, type: "completed" } },
                seedIssues[0],
                {
                  ...seedIssues[1],
                  id: "6ab72aa0-dfed-4a0c-9517-f54a91653c33",
                  identifier: "FEN-104",
                  description: "Unrelated task"
                }
              ]
            }
          }
        }
      })
    })
    const client = new LinearClient({
      apiKey: "linear-token",
      endpoint: "https://api.linear.test/graphql",
      fetcher,
      now: () => new Date("2026-07-19T04:15:00.000Z")
    })

    const result = await client.listCandidates(2)

    expect(result.issues.map((issue) => issue.identifier)).toEqual(["FEN-101", "FEN-103"])
    expect(result.fetchedAt).toBe("2026-07-19T04:15:00.000Z")
  })

  it("paginates every team task and sorts dependency levels", async () => {
    const blocker = { ...seedIssues[0], priority: 2 }
    const blocked = { ...seedIssues[1], priority: 1 }
    const relation = {
      id: "53d155de-4d6c-4802-a0c9-58e5426fba26",
      type: "blocks",
      issue: { id: blocker.id, identifier: blocker.identifier, state: { type: "unstarted" } },
      relatedIssue: { id: blocked.id, identifier: blocked.identifier, state: { type: "unstarted" } }
    }
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [team] } } })
      }
      if (body.query.includes("WorkItemRelations")) {
        return response({
          data: { issueRelations: { nodes: [relation], pageInfo: { hasNextPage: false, endCursor: null } } }
        })
      }
      if (body.variables.after === null) {
        return response({
          data: {
            team: {
              ...team,
              issues: {
                nodes: [blocker],
                pageInfo: { hasNextPage: true, endCursor: "page-2" }
              }
            }
          }
        })
      }
      return response({
        data: {
          team: {
            ...team,
            issues: {
              nodes: [blocked],
              pageInfo: { hasNextPage: false, endCursor: null }
            }
          }
        }
      })
    })
    const client = new LinearClient({ apiKey: "linear-token", endpoint: "https://api.linear.test/graphql", fetcher })

    const graph = await client.listTaskGraph()

    expect(graph.tasks).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.levels.map((level) => level.taskIds)).toEqual([[blocker.id], [blocked.id]])
    expect(graph.readyTaskIds).toEqual([blocker.id])
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it("uses a configured team when more than one team is visible", async () => {
    const otherTeam = { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "OPS", name: "Operations" }
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [otherTeam, team] } } })
      }
      if (body.query.includes("WorkItemRelations")) {
        return emptyRelations()
      }
      expect(body.variables.teamId).toBe(team.id)
      return response({ data: { team: { ...team, issues: { nodes: seedIssues } } } })
    })
    const client = new LinearClient({
      apiKey: "linear-token",
      teamSelector: "fen",
      endpoint: "https://api.linear.test/graphql",
      fetcher
    })

    await expect(client.listCandidates(1)).resolves.toMatchObject({ team, issues: [{ identifier: "FEN-101" }] })
  })

  it("requires a team selector for multiple visible teams", async () => {
    const fetcher = vi.fn(async () =>
      response({
        data: {
          teams: {
            nodes: [team, { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "OPS", name: "Operations" }]
          }
        }
      })
    )
    const client = new LinearClient({ apiKey: "linear-token", fetcher })

    await expect(client.listCandidates()).rejects.toThrow("--team or LINEAR_TEAM_ID is required")
  })

  it("creates only missing seed issues", async () => {
    const createdIssues: unknown[] = []
    let listRequestCount = 0
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [team] } } })
      }
      if (body.query.includes("WorkItemRelations")) {
        return emptyRelations()
      }
      if (body.query.includes("WorkItemTeamIssues")) {
        listRequestCount += 1
        const nodes = listRequestCount === 1 ? [seedIssues[0]] : seedIssues
        return response({ data: { team: { ...team, issues: { nodes } } } })
      }
      const input = IssueCreateInputSchema.parse(body.variables.input)
      createdIssues.push(input)
      const createdIssue = seedIssues[createdIssues.length]
      return response({ data: { issueCreate: { success: true, issue: createdIssue } } })
    })
    const client = new LinearClient({
      apiKey: "linear-token",
      endpoint: "https://api.linear.test/graphql",
      fetcher
    })

    const result = await client.seedCandidates()

    expect(createdIssues).toHaveLength(2)
    expect(result.issues).toHaveLength(3)
  })

  it("reports HTTP and GraphQL failures without exposing credentials", async () => {
    const httpClient = new LinearClient({ apiKey: "secret-token", fetcher: async () => response({}, 503) })
    await expect(httpClient.listCandidates()).rejects.toThrow("status 503")

    const graphqlClient = new LinearClient({
      apiKey: "secret-token",
      fetcher: async () => response({ errors: [{ message: "query rejected" }] })
    })
    await expect(graphqlClient.listCandidates()).rejects.toThrow("query rejected")
  })
})

describe("createLinearClientFromEnvironment", () => {
  it("requires a Linear API key", () => {
    expect(() => createLinearClientFromEnvironment({})).toThrow("LINEAR_API_KEY is required")
  })

  it("lets an explicit team selector override the environment fallback", async () => {
    const client = createLinearClientFromEnvironment(
      { LINEAR_API_KEY: "linear-token", LINEAR_TEAM_ID: "9539b499-1c48-4770-ab32-da1cbda14d57" },
      "FEN"
    )
    expect(client).toBeInstanceOf(LinearClient)
  })
})
