import { z } from "zod"
import { ProviderPortResolver, type ProviderResourcePort } from "./providerPorts"

const githubEvents = [
  { eventKey: "pull_request.created", label: "Pull request created" },
  { eventKey: "pull_request.updated", label: "Pull request updated" },
  { eventKey: "pull_request.closed", label: "Pull request closed" },
  { eventKey: "pull_request.merged", label: "Pull request merged" },
  { eventKey: "issue.created", label: "Issue created" },
  { eventKey: "issue.updated", label: "Issue updated" },
  { eventKey: "issue.closed", label: "Issue closed" },
  { eventKey: "issue.reopened", label: "Issue reopened" },
  { eventKey: "issue.comment.created", label: "Issue comment created" },
  { eventKey: "issue.comment.updated", label: "Issue comment updated" },
  { eventKey: "issue.comment.deleted", label: "Issue comment deleted" }
] as const

const linearEvents = [
  { eventKey: "task.created", label: "Issue created" },
  { eventKey: "task.updated", label: "Issue updated" },
  { eventKey: "task.removed", label: "Issue removed" },
  { eventKey: "task.comment.created", label: "Comment created" },
  { eventKey: "task.comment.updated", label: "Comment updated" },
  { eventKey: "task.comment.removed", label: "Comment removed" }
] as const

function normalizedAction(action: string): string {
  const value = action.toLowerCase()
  if (value === "create" || value === "opened") return "created"
  if (value === "edit" || value === "edited" || value === "synchronize" || value === "update") return "updated"
  if (value === "delete") return "deleted"
  if (value === "remove") return "removed"
  return value
}

function knownEvent(events: readonly { eventKey: string }[], eventKey: string): boolean {
  return events.some((event) => event.eventKey === eventKey)
}

const GitHubRepositoriesSchema = z
  .object({
    total_count: z.number().int().nonnegative(),
    repositories: z.array(
      z
        .object({ id: z.number().int().positive(), full_name: z.string().min(1), archived: z.boolean().default(false) })
        .passthrough()
    )
  })
  .passthrough()

const LinearTeamsSchema = z
  .object({
    data: z
      .object({
        teams: z.object({
          nodes: z.array(z.object({ id: z.string().min(1), key: z.string(), name: z.string() })),
          pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
        })
      })
      .optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()

export const githubRepositoryProvider: ProviderResourcePort = {
  provider: "github",
  resourceType: "repository",
  capabilities: ["repository.read", "repository.write", "pull_request.write"],
  events: githubEvents,
  normalizeEvent(input) {
    const objectType = input.objectType.toLowerCase()
    let prefix: string | null = null
    if (objectType.includes("pull")) prefix = "pull_request"
    if (objectType.includes("issue") && objectType.includes("comment")) prefix = "issue.comment"
    if (prefix === null && objectType.includes("issue")) prefix = "issue"
    if (prefix === null) return null
    const eventKey = `${prefix}.${normalizedAction(input.action)}`
    return knownEvent(githubEvents, eventKey)
      ? { eventKey, objectType: prefix, ...(input.objectId === undefined ? {} : { objectId: input.objectId }) }
      : null
  },
  async discover(context) {
    const repositories: Array<z.infer<typeof GitHubRepositoriesSchema>["repositories"][number]> = []
    let page = 1
    let totalCount = 0
    do {
      const response = GitHubRepositoriesSchema.parse(
        await context.request({
          method: "GET",
          endpoint: "/installation/repositories",
          params: { per_page: 100, page }
        })
      )
      repositories.push(...response.repositories)
      totalCount = response.total_count
      page += 1
    } while (repositories.length < totalCount)
    return repositories
      .filter((repository) => !repository.archived)
      .map((repository) => ({ externalId: String(repository.id), name: repository.full_name }))
  }
}

export const linearTaskProvider: ProviderResourcePort = {
  provider: "linear",
  resourceType: "team",
  capabilities: ["team.read", "issue.read", "issue.write"],
  events: linearEvents,
  normalizeEvent(input) {
    const objectType = input.objectType.toLowerCase()
    let prefix: string | null = null
    if (objectType.includes("comment")) prefix = "task.comment"
    if (prefix === null && objectType.includes("issue")) prefix = "task"
    if (prefix === null) return null
    const eventKey = `${prefix}.${normalizedAction(input.action)}`
    return knownEvent(linearEvents, eventKey)
      ? { eventKey, objectType: prefix, ...(input.objectId === undefined ? {} : { objectId: input.objectId }) }
      : null
  },
  async discover(context) {
    const teams: Array<{ id: string; key: string; name: string }> = []
    let cursor: string | null = null
    let hasNextPage = true
    while (hasNextPage) {
      const response = LinearTeamsSchema.parse(
        await context.request({
          method: "POST",
          endpoint: "/graphql",
          headers: { "Content-Type": "application/json" },
          data: {
            query:
              "query AgencyIntegrationTeams($after: String) { teams(first: 100, after: $after) { nodes { id key name } pageInfo { hasNextPage endCursor } } }",
            variables: { after: cursor }
          }
        })
      )
      if (response.data === undefined || response.errors !== undefined) {
        throw new Error("Linear team discovery failed")
      }
      teams.push(...response.data.teams.nodes)
      hasNextPage = response.data.teams.pageInfo.hasNextPage
      cursor = response.data.teams.pageInfo.endCursor
    }
    return teams.map((team) => ({ externalId: team.id, name: `${team.key} ${team.name}` }))
  }
}

export function createDefaultProviderPortResolver(): ProviderPortResolver {
  return new ProviderPortResolver([githubRepositoryProvider, linearTaskProvider])
}
