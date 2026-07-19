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

function operation(request: RequestInfo | URL, init?: RequestInit) {
  expect(request.toString()).toBe("https://api.linear.test/graphql")
  expect(init?.headers).toEqual({ Authorization: "linear-token", "Content-Type": "application/json" })
  return OperationSchema.parse(JSON.parse(init?.body?.toString() ?? "{}"))
}

describe("LinearClient", () => {
  it("fetches only active marked candidates in deterministic seed order", async () => {
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [team] } } })
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
                { ...seedIssues[1], id: "6ab72aa0-dfed-4a0c-9517-f54a91653c33", description: "Unrelated task" }
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

  it("uses a configured team when more than one team is visible", async () => {
    const otherTeam = { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "OPS", name: "Operations" }
    const fetcher = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = operation(request, init)
      if (body.query.includes("WorkItemTeams")) {
        return response({ data: { teams: { nodes: [otherTeam, team] } } })
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
