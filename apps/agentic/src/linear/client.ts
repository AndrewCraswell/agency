import { z } from "zod"
import {
  LINEAR_WORK_ITEM_SCHEMA_VERSION,
  LinearCandidateListSchema,
  LinearIssueStateTypeSchema,
  LinearTaskGraphSchema,
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
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    state: z
      .object({
        id: z.uuid(),
        name: z.string(),
        type: LinearIssueStateTypeSchema
      })
      .strict(),
    project: z.object({ id: z.uuid(), name: z.string() }).strict().nullable().optional().default(null),
    relations: z
      .object({
        nodes: z.array(z.unknown()),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }).strict()
      })
      .strict()
      .optional()
      .default({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } }),
    inverseRelations: z
      .object({
        nodes: z.array(z.unknown()),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }).strict()
      })
      .strict()
      .optional()
      .default({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } })
  })
  .strict()

const RawTaskReferenceSchema = z
  .object({
    id: z.uuid(),
    identifier: z.string(),
    state: z.object({ type: LinearIssueStateTypeSchema }).strict()
  })
  .strict()

const RawIssueRelationSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["blocks", "duplicate", "related", "similar"]),
    issue: RawTaskReferenceSchema,
    relatedIssue: RawTaskReferenceSchema
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
      issues: z
        .object({
          nodes: z.array(RawLinearIssueSchema),
          pageInfo: z
            .object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() })
            .strict()
            .optional()
            .default({ hasNextPage: false, endCursor: null })
        })
        .strict()
    }).nullable()
  })
  .strict()

const IssueRelationsResponseSchema = z
  .object({
    issueRelations: z
      .object({
        nodes: z.array(RawIssueRelationSchema),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }).strict()
      })
      .strict()
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
const WorkflowStatesResponseSchema = z
  .object({
    team: z
      .object({
        states: z
          .object({
            nodes: z.array(z.object({ id: z.uuid(), name: z.string(), type: LinearIssueStateTypeSchema }).strict())
          })
          .strict()
      })
      .strict()
      .nullable()
  })
  .strict()
const CommentCreateResponseSchema = z
  .object({
    commentCreate: z.object({ success: z.boolean(), comment: z.object({ id: z.uuid() }).strict().nullable() }).strict()
  })
  .strict()
const IssueUpdateResponseSchema = z
  .object({
    issueUpdate: z.object({ success: z.boolean(), issue: z.object({ id: z.uuid() }).strict().nullable() }).strict()
  })
  .strict()

const CandidateLimitSchema = z.number().int().positive().max(50)

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
  query WorkItemTeamIssues($teamId: String!, $first: Int!, $after: String) {
    team(id: $teamId) {
      id
      key
      name
      issues(
        first: $first
        after: $after
        filter: { state: { type: { in: ["triage", "backlog", "unstarted", "started"] } } }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          identifier
          title
          description
          url
          priority
          createdAt
          updatedAt
          state { id name type }
          project { id name }
        }
      }
    }
  }
`

const issueRelationsQuery = `
  query WorkItemRelations($first: Int!, $after: String) {
    issueRelations(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        type
        issue { id identifier state { type } }
        relatedIssue { id identifier state { type } }
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

const workflowStatesQuery = `
  query WorkItemWorkflowStates($teamId: String!) {
    team(id: $teamId) { states { nodes { id name type } } }
  }
`

const createCommentMutation = `
  mutation RecordAgentEvidence($input: CommentCreateInput!) {
    commentCreate(input: $input) { success comment { id } }
  }
`

const updateIssueMutation = `
  mutation UpdateAgentWorkItem($id: String!, $input: IssueUpdateInput!) {
    issueUpdate(id: $id, input: $input) { success issue { id } }
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

function isTerminalState(stateType: z.infer<typeof LinearIssueStateTypeSchema>): boolean {
  return stateType === "completed" || stateType === "canceled" || stateType === "duplicate"
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

  async listTaskGraph() {
    const team = await this.#resolveTeam()
    const issues = await this.#listTeamIssues(team.id)
    const taskIds = new Set(issues.map((issue) => issue.id))
    const relations = (await this.#listIssueRelations()).filter(
      (relation) => taskIds.has(relation.issue.id) || taskIds.has(relation.relatedIssue.id)
    )
    const edges = relations
      .filter((relation) => relation.type === "blocks")
      .map((relation) => ({
        blocker: this.#taskReference(relation.issue),
        blocked: this.#taskReference(relation.relatedIssue)
      }))
    const taskById = new Map(issues.map((issue) => [issue.id, issue]))
    const openTaskIds = new Set(issues.filter((issue) => !isTerminalState(issue.state.type)).map((issue) => issue.id))
    const incoming = new Map([...openTaskIds].map((taskId) => [taskId, 0]))
    const outgoing = new Map<string, string[]>()
    for (const edge of edges) {
      if (!openTaskIds.has(edge.blocked.id) || isTerminalState(edge.blocker.stateType)) {
        continue
      }
      incoming.set(edge.blocked.id, (incoming.get(edge.blocked.id) ?? 0) + 1)
      if (openTaskIds.has(edge.blocker.id)) {
        outgoing.set(edge.blocker.id, [...(outgoing.get(edge.blocker.id) ?? []), edge.blocked.id])
      }
    }
    const levels: { depth: number; taskIds: string[] }[] = []
    const processed = new Set<string>()
    let frontier = [...openTaskIds].filter((taskId) => incoming.get(taskId) === 0)
    while (frontier.length > 0) {
      frontier.sort((left, right) => this.#compareTasks(taskById.get(left), taskById.get(right), outgoing))
      const taskIds = [...frontier]
      levels.push({ depth: levels.length, taskIds })
      frontier = []
      for (const taskId of taskIds) {
        processed.add(taskId)
        for (const blockedId of outgoing.get(taskId) ?? []) {
          const remaining = (incoming.get(blockedId) ?? 0) - 1
          incoming.set(blockedId, remaining)
          if (remaining === 0) {
            frontier.push(blockedId)
          }
        }
      }
    }
    const readyTaskIds = (levels[0]?.taskIds ?? []).filter((taskId) => {
      const type = taskById.get(taskId)?.state.type
      return type === "backlog" || type === "unstarted"
    })
    const blockedTaskIds = [...openTaskIds].filter((taskId) => !processed.has(taskId))
    const tasks = issues.map((issue) => ({
      schemaVersion: LINEAR_WORK_ITEM_SCHEMA_VERSION,
      source: "linear" as const,
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? "",
      url: issue.url,
      priority: issue.priority,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      state: issue.state,
      team,
      project: issue.project,
      blockedBy: edges.filter((edge) => edge.blocked.id === issue.id).map((edge) => edge.blocker),
      blocks: edges.filter((edge) => edge.blocker.id === issue.id).map((edge) => edge.blocked)
    }))
    return LinearTaskGraphSchema.parse({
      schemaVersion: LINEAR_WORK_ITEM_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      team,
      tasks,
      edges,
      levels,
      readyTaskIds,
      blockedTaskIds
    })
  }

  async listCandidates(limitInput = 50) {
    const limit = CandidateLimitSchema.parse(limitInput)
    const graph = await this.listTaskGraph()
    const taskById = new Map(graph.tasks.map((task) => [task.id, task]))
    const candidates = graph.readyTaskIds.slice(0, limit).map((taskId) => {
      const task = taskById.get(taskId)
      if (task === undefined || (task.state.type !== "backlog" && task.state.type !== "unstarted")) {
        throw new Error(`Dependency-ready Linear task ${taskId} is unavailable`)
      }
      return LinearWorkItemSchema.parse({
        schemaVersion: task.schemaVersion,
        source: task.source,
        id: task.id,
        identifier: task.identifier,
        title: task.title,
        description: task.description,
        url: task.url,
        priority: task.priority,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        state: task.state,
        team: task.team
      })
    })

    if (candidates.length === 0) {
      throw new Error("No dependency-ready Linear tasks were found")
    }

    return LinearCandidateListSchema.parse({
      schemaVersion: LINEAR_WORK_ITEM_SCHEMA_VERSION,
      fetchedAt: this.#now().toISOString(),
      team: graph.team,
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

  async recordAgentActivity(
    issueIdInput: string,
    stateTypeInput: "started" | "completed" | "canceled",
    evidenceBodyInput: string
  ): Promise<void> {
    const issueId = z.uuid().parse(issueIdInput)
    const stateType = z.enum(["started", "completed", "canceled"]).parse(stateTypeInput)
    const evidenceBody = z.string().trim().min(1).max(20_000).parse(evidenceBodyInput)
    const team = await this.#resolveTeam()
    const stateResult = await this.#request(workflowStatesQuery, { teamId: team.id }, WorkflowStatesResponseSchema)
    const state = stateResult.team?.states.nodes.find((candidate) => candidate.type === stateType)
    if (state === undefined) {
      throw new Error(`Linear team ${team.key} has no ${stateType} workflow state`)
    }
    const commentResult = await this.#request(
      createCommentMutation,
      { input: { issueId, body: evidenceBody } },
      CommentCreateResponseSchema
    )
    if (!commentResult.commentCreate.success || commentResult.commentCreate.comment === null) {
      throw new Error("Linear did not record the agent evidence comment")
    }
    const updateResult = await this.#request(
      updateIssueMutation,
      { id: issueId, input: { stateId: state.id } },
      IssueUpdateResponseSchema
    )
    if (!updateResult.issueUpdate.success || updateResult.issueUpdate.issue?.id !== issueId) {
      throw new Error("Linear did not apply the agent workflow state")
    }
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
    const issues: z.output<typeof RawLinearIssueSchema>[] = []
    let after: string | null = null
    do {
      const result: z.output<typeof TeamIssuesResponseSchema> = await this.#request(
        teamIssuesQuery,
        { teamId, first: 100, after },
        TeamIssuesResponseSchema
      )
      if (result.team === null) {
        throw new Error("Linear returned no team for the selected team ID")
      }
      issues.push(...result.team.issues.nodes)
      const pageInfo: { hasNextPage: boolean; endCursor: string | null } = result.team.issues.pageInfo
      if (pageInfo.hasNextPage && pageInfo.endCursor === null) {
        throw new Error("Linear returned an incomplete issue page without an end cursor")
      }
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (after !== null)
    return issues
  }

  async #listIssueRelations() {
    const relations: z.output<typeof RawIssueRelationSchema>[] = []
    let after: string | null = null
    do {
      const result: z.output<typeof IssueRelationsResponseSchema> = await this.#request(
        issueRelationsQuery,
        { first: 100, after },
        IssueRelationsResponseSchema
      )
      relations.push(...result.issueRelations.nodes)
      const pageInfo: { hasNextPage: boolean; endCursor: string | null } = result.issueRelations.pageInfo
      if (pageInfo.hasNextPage && pageInfo.endCursor === null) {
        throw new Error("Linear returned an incomplete relation page without an end cursor")
      }
      after = pageInfo.hasNextPage ? pageInfo.endCursor : null
    } while (after !== null)
    return relations
  }

  #taskReference(reference: z.output<typeof RawTaskReferenceSchema>) {
    return {
      id: reference.id,
      identifier: reference.identifier,
      stateType: reference.state.type
    }
  }

  #compareTasks(
    left: z.output<typeof RawLinearIssueSchema> | undefined,
    right: z.output<typeof RawLinearIssueSchema> | undefined,
    outgoing: ReadonlyMap<string, string[]>
  ): number {
    if (left === undefined || right === undefined) {
      return 0
    }
    const priorityRank = (priority: number) => (priority === 0 ? 5 : priority)
    const priorityDifference = priorityRank(left.priority) - priorityRank(right.priority)
    if (priorityDifference !== 0) {
      return priorityDifference
    }
    const dependencyDifference = (outgoing.get(right.id)?.length ?? 0) - (outgoing.get(left.id)?.length ?? 0)
    if (dependencyDifference !== 0) {
      return dependencyDifference
    }
    return left.identifier.localeCompare(right.identifier, "en", { numeric: true })
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
      const responseText = await response.text()
      throw new Error(`Linear GraphQL request failed with status ${response.status}: ${responseText.slice(0, 500)}`)
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
