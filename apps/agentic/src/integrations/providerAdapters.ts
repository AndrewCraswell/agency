import { z } from "zod"
import { ProviderPortResolver, type ProviderResourcePort } from "./providerPorts"

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
