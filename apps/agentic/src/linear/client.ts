import { z } from "zod"
import {
  LINEAR_WORK_ITEM_SCHEMA_VERSION,
  LinearCandidateListSchema,
  LinearTeamSchema,
  LinearWorkItemSchema
} from "../contracts/linear"

const LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql"
const SEED_MARKER_PREFIX = "agency-agent-platform:seed:"

const SeedIssueSchema = z
  .object({
    key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    priority: z.number().int().min(0).max(4)
  })
  .strict()

const seedIssues = [
  {
    key: "openhands-profile-tests",
    title: "[Agent Trial] Add OpenHands profile helper tests",
    description: `Add focused unit tests for \`src/openhands/profiles.ts\`.

Acceptance criteria:
- Verify \`createAgentServerEnvironment\` maps both supplied secrets and keeps VNC, VS Code, preloaded tools, and webhooks disabled.
- Verify \`createCoderProfile\` preserves the supplied usage ID and returns the pinned model, base URL, and reasoning effort.
- Do not change production behavior.
- \`pnpm --filter agentic exec vitest run src/openhands/profiles.test.ts\` passes.`,
    priority: 4
  },
  {
    key: "langsmith-tracing-tests",
    title: "[Agent Trial] Add LangSmith trace wrapper tests",
    description: `Add focused unit tests for \`src/observability/tracing.ts\`.

Acceptance criteria:
- Mock the LangSmith \`traceable\` boundary without making network requests.
- Verify metadata and tags are copied into the trace options.
- Verify tracing is enabled only when \`LANGSMITH_TRACING\` is exactly \`true\`.
- Verify the wrapped operation result is returned unchanged.
- \`pnpm --filter agentic exec vitest run src/observability/tracing.test.ts\` passes.`,
    priority: 4
  },
  {
    key: "runtime-tests",
    title: "[Agent Trial] Add workflow runtime configuration tests",
    description: `Add focused unit tests for \`src/orchestrator/runtime.ts\`.

Acceptance criteria:
- Cover required environment-variable failures without printing secret values.
- Cover the default workflow artifact root and an explicit artifact-root override.
- Mock external provider construction so tests make no Daytona, GitHub, OpenRouter, or LangSmith requests.
- Do not weaken runtime validation.
- \`pnpm --filter agentic exec vitest run src/orchestrator/runtime.test.ts\` passes.`,
    priority: 4
  }
].map((issue) => SeedIssueSchema.parse(issue))

const LinearClientConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1),
    teamSelector: z.string().trim().min(1).optional(),
    endpoint: z.url()
  })
  .strict()

const GraphqlErrorSchema = z
  .object({
    message: z.string().trim().min(1)
  })
  .passthrough()

const GraphqlEnvelopeSchema = z
  .object({
    data: z.unknown().optional(),
    errors: z.array(GraphqlErrorSchema).optional()
  })
  .passthrough()

const RawLinearIssueSchema = z
  .object({
    id: z.uuid(),
    identifier: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    url: z.url(),
    priority: z.number().int(),
    state: z
      .object({
        id: z.uuid(),
        name: z.string(),
        type: z.string()
      })
      .strict()
  })
  .strict()

const TeamsResponseSchema = z
  .object({
    teams: z.object({ nodes: z.array(LinearTeamSchema) }).strict()
  })
  .strict()

const TeamIssuesResponseSchema = z
  .object({
    team: LinearTeamSchema.extend({
      issues: z.object({ nodes: z.array(RawLinearIssueSchema) }).strict()
    }).nullable()
  })
  .strict()

const IssueCreateResponseSchema = z
  .object({
    issueCreate: z
      .object({
        success: z.boolean(),
        issue: RawLinearIssueSchema.nullable()
      })
      .strict()
  })
  .strict()

const CandidateLimitSchema = z.number().int().positive().max(seedIssues.length)

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type LinearClientOptions = {
  apiKey: string
  teamSelector?: string
  endpoint?: string
  fetcher?: Fetcher
  now?: () => Date
}

const teamQuery = `
  query WorkItemTeams {
    teams { nodes { id key name } }
  }
`

const teamIssuesQuery = `
  query WorkItemTeamIssues($teamId: String!, $first: Int!) {
    team(id: $teamId) {
      id
      key
      name
      issues(first: $first) {
        nodes {
          id
          identifier
          title
          description
          url
          priority
          state { id name type }
        }
      }
    }
  }
`

const createIssueMutation = `
  mutation CreateWorkItem($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        title
        description
        url
        priority
        state { id name type }
      }
    }
  }
`

function seedMarker(key: string): string {
  return `<!-- ${SEED_MARKER_PREFIX}${key} -->`
}

function seedKey(description: string | null): string | null {
  if (description === null) {
    return null
  }
  const match = /<!-- agency-agent-platform:(?:[a-z0-9-]+:)?([a-z0-9-]+) -->/u.exec(description)
  const key = match?.[1]
  if (key === undefined) {
    return null
  }
  return key.replace(/^[a-z]+[0-9]+-(.+)$/u, "$1")
}

export class LinearClient {
  readonly #config: z.output<typeof LinearClientConfigSchema>
  readonly #fetcher: Fetcher
  readonly #now: () => Date

  constructor(options: LinearClientOptions) {
    this.#config = LinearClientConfigSchema.parse({
      apiKey: options.apiKey,
      teamSelector: options.teamSelector,
      endpoint: options.endpoint ?? LINEAR_GRAPHQL_ENDPOINT
    })
    this.#fetcher = options.fetcher ?? fetch
    this.#now = options.now ?? (() => new Date())
  }

  async listCandidates(limitInput = seedIssues.length) {
    const limit = CandidateLimitSchema.parse(limitInput)
    const team = await this.#resolveTeam()
    const issues = await this.#listTeamIssues(team.id)
    const issuesBySeedKey = new Map(
      issues.flatMap((issue) => {
        const key = seedKey(issue.description)
        return key === null ? [] : [[key, issue]]
      })
    )
    const candidates = seedIssues
      .map((seedIssue) => issuesBySeedKey.get(seedIssue.key))
      .filter((issue) => issue !== undefined)
      .filter((issue) => issue.state.type === "backlog" || issue.state.type === "unstarted")
      .slice(0, limit)
      .map((issue) => this.#workItem(team, issue))

    if (candidates.length === 0) {
      throw new Error("No active Linear candidate issues were found; run the seed command first")
    }

    return LinearCandidateListSchema.parse({
      schemaVersion: LINEAR_WORK_ITEM_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      team,
      issues: candidates
    })
  }

  async seedCandidates() {
    const team = await this.#resolveTeam()
    const existingIssues = await this.#listTeamIssues(team.id)
    const existingSeedKeys = new Set(existingIssues.map((issue) => seedKey(issue.description)))

    for (const issue of seedIssues) {
      if (existingSeedKeys.has(issue.key)) {
        continue
      }
      const result = await this.#request(
        createIssueMutation,
        {
          input: {
            teamId: team.id,
            title: issue.title,
            description: `${issue.description}\n\n${seedMarker(issue.key)}`,
            priority: issue.priority
          }
        },
        IssueCreateResponseSchema
      )
      if (!result.issueCreate.success || result.issueCreate.issue === null) {
        throw new Error(`Linear did not create the seed issue ${issue.key}`)
      }
    }

    return this.listCandidates()
  }

  async #resolveTeam() {
    const result = await this.#request(teamQuery, {}, TeamsResponseSchema)
    if (this.#config.teamSelector !== undefined) {
      const normalizedSelector = this.#config.teamSelector.toUpperCase()
      const configuredTeam = result.teams.nodes.find(
        (team) => team.id === this.#config.teamSelector || team.key === normalizedSelector
      )
      if (configuredTeam === undefined) {
        throw new Error("The Linear team selector does not identify a team visible to the configured API key")
      }
      return configuredTeam
    }
    if (result.teams.nodes.length !== 1) {
      throw new Error(
        "--team or LINEAR_TEAM_ID is required when the configured Linear account can access multiple teams"
      )
    }
    const team = result.teams.nodes[0]
    if (team === undefined) {
      throw new Error("The configured Linear API key cannot access any teams")
    }
    return team
  }

  async #listTeamIssues(teamId: string) {
    const result = await this.#request(teamIssuesQuery, { teamId, first: 100 }, TeamIssuesResponseSchema)
    if (result.team === null) {
      throw new Error("Linear returned no team for the selected team ID")
    }
    return result.team.issues.nodes
  }

  #workItem(team: z.output<typeof LinearTeamSchema>, issue: z.output<typeof RawLinearIssueSchema>) {
    return LinearWorkItemSchema.parse({
      schemaVersion: LINEAR_WORK_ITEM_SCHEMA_VERSION,
      source: "linear",
      ...issue,
      description: issue.description,
      team
    })
  }

  async #request<Output>(query: string, variables: Readonly<Record<string, unknown>>, schema: z.ZodType<Output>) {
    const response = await this.#fetcher(this.#config.endpoint, {
      method: "POST",
      headers: {
        Authorization: this.#config.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query, variables })
    })
    if (!response.ok) {
      throw new Error(`Linear GraphQL request failed with status ${response.status}`)
    }
    const envelope = GraphqlEnvelopeSchema.parse(await response.json())
    if (envelope.errors !== undefined && envelope.errors.length > 0) {
      throw new Error(`Linear GraphQL request failed: ${envelope.errors.map((error) => error.message).join("; ")}`)
    }
    return schema.parse(envelope.data)
  }
}

export function createLinearClientFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  teamSelector?: string
): LinearClient {
  const apiKey = environment.LINEAR_API_KEY
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("LINEAR_API_KEY is required")
  }
  return new LinearClient({ apiKey, teamSelector: teamSelector ?? environment.LINEAR_TEAM_ID })
}
