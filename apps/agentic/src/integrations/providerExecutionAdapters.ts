import { z } from "zod"
import { JsonValueSchema, type JsonValue } from "../workflows/executionContracts"
import {
  ProviderExecutionPortResolver,
  type ProviderConnectionContext,
  type ProviderExecutionPort
} from "./providerPorts"

const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const MAXIMUM_ITEMS = 100
const GitHubNameSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)
const GraphqlResponseSchema = z
  .object({
    data: JsonValueSchema.optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()

export class ProviderMutationRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderMutationRejectedError"
  }
}

async function graphql(
  context: ProviderConnectionContext,
  query: string,
  variables: Record<string, JsonValue>
): Promise<JsonValue> {
  const response = GraphqlResponseSchema.parse(
    await context.request({
      method: "POST",
      endpoint: "/graphql",
      headers: { "Content-Type": "application/json" },
      data: { query, variables }
    })
  )
  if (response.errors !== undefined || response.data === undefined) {
    throw new Error(response.errors?.map(({ message }) => message).join(" ") ?? "Linear returned no data")
  }
  return response.data
}

async function graphqlObject(
  context: ProviderConnectionContext,
  query: string,
  variables: Record<string, JsonValue>
): Promise<Record<string, JsonValue>> {
  return JsonObjectSchema.parse(await graphql(context, query, variables))
}

async function graphqlMutationObject(
  context: ProviderConnectionContext,
  query: string,
  variables: Record<string, JsonValue>
): Promise<Record<string, JsonValue>> {
  const result = await graphqlObject(context, query, variables)
  for (const payload of Object.values(result)) {
    const parsed = z.object({ success: z.boolean().optional() }).passthrough().safeParse(payload)
    if (parsed.success && parsed.data.success === false) {
      throw new ProviderMutationRejectedError("Linear mutation reported success false")
    }
  }
  return result
}

export const githubWorkflowProvider: ProviderExecutionPort = {
  provider: "github",
  resourceType: "repository",
  async read(context, operation, resource, queryInput) {
    const query = JsonObjectSchema.parse(queryInput)
    const repository = GitHubNameSchema.parse(resource.name)
    const root = `/repos/${repository}`
    if (operation === "github.repository") {
      return context.request({ method: "GET", endpoint: root })
    }
    const pullRequestNumber = z.number().int().positive().parse(query.pullRequestNumber)
    if (operation === "github.pull_request") {
      return context.request({ method: "GET", endpoint: `${root}/pulls/${pullRequestNumber}` })
    }
    if (operation === "github.pull_request_comments") {
      return context.request({
        method: "GET",
        endpoint: `${root}/issues/${pullRequestNumber}/comments`,
        params: { per_page: MAXIMUM_ITEMS }
      })
    }
    if (operation === "github.pull_request_reviews") {
      return context.request({
        method: "GET",
        endpoint: `${root}/pulls/${pullRequestNumber}/reviews`,
        params: { per_page: MAXIMUM_ITEMS }
      })
    }
    const reference = z.string().trim().min(1).parse(query.ref)
    return context.request({
      method: "GET",
      endpoint: `${root}/commits/${encodeURIComponent(reference)}/check-runs`,
      params: { per_page: MAXIMUM_ITEMS }
    })
  },
  async act(context, operation, resource, requestInput) {
    const request = JsonObjectSchema.parse(requestInput)
    const repository = GitHubNameSchema.parse(resource.name)
    const root = `/repos/${repository}`
    if (operation === "github.create_or_update_pull_request") {
      const number = request.pullRequestNumber
      const endpoint = typeof number === "number" ? `${root}/pulls/${number}` : `${root}/pulls`
      const method = typeof number === "number" ? "PATCH" : "POST"
      return context.request({ method, endpoint, data: request })
    }
    const pullRequestNumber = z.number().int().positive().parse(request.pullRequestNumber)
    if (operation === "github.add_pull_request_comment") {
      return context.request({
        method: "POST",
        endpoint: `${root}/issues/${pullRequestNumber}/comments`,
        data: { body: request.body }
      })
    }
    if (operation === "github.submit_pull_request_review") {
      return context.request({
        method: "POST",
        endpoint: `${root}/pulls/${pullRequestNumber}/reviews`,
        data: request
      })
    }
    if (operation === "github.request_reviewers") {
      return context.request({
        method: "POST",
        endpoint: `${root}/pulls/${pullRequestNumber}/requested_reviewers`,
        data: request
      })
    }
    if (operation === "github.add_labels") {
      return context.request({
        method: "POST",
        endpoint: `${root}/issues/${pullRequestNumber}/labels`,
        data: { labels: request.labels }
      })
    }
    if (operation === "github.remove_label") {
      return context.request({
        method: "DELETE",
        endpoint: `${root}/issues/${pullRequestNumber}/labels/${encodeURIComponent(z.string().parse(request.label))}`
      })
    }
    if (operation === "github.set_check_status") {
      return context.request({ method: "POST", endpoint: `${root}/check-runs`, data: request })
    }
    if (operation === "github.merge_pull_request") {
      return context.request({
        method: "PUT",
        endpoint: `${root}/pulls/${pullRequestNumber}/merge`,
        data: request
      })
    }
    return context.request({
      method: "PATCH",
      endpoint: `${root}/pulls/${pullRequestNumber}`,
      data: { state: "closed" }
    })
  }
}

export const linearWorkflowProvider: ProviderExecutionPort = {
  provider: "linear",
  resourceType: "team",
  async read(context, operation, resource, queryInput) {
    const query = JsonObjectSchema.parse(queryInput)
    if (operation === "linear.ready_issues") {
      const limit = z.number().int().min(1).max(MAXIMUM_ITEMS).default(25).parse(query.limit)
      return graphql(
        context,
        "query AgencyWorkflowReadyIssues($teamId: String!, $first: Int!) { issues(first: $first, filter: { team: { id: { eq: $teamId } }, state: { type: { nin: [completed, canceled] } } }, orderBy: priority) { nodes { id identifier title description priority url state { id name type } assignee { id name } labels { nodes { id name } } } } }",
        { teamId: resource.externalId, first: limit }
      )
    }
    const issueId = z.string().trim().min(1).parse(query.issueId)
    const selection =
      operation === "linear.issue_comments"
        ? "team { id } comments(first: 100) { nodes { id body createdAt user { id name } } }"
        : "team { id } identifier title description priority url state { id name } assignee { id name } labels { nodes { id name } }"
    const result = JsonObjectSchema.parse(
      await graphql(context, `query AgencyWorkflowIssue($id: String!) { issue(id: $id) { id ${selection} } }`, {
        id: issueId
      })
    )
    const issue = z
      .object({ team: z.object({ id: z.string() }) })
      .passthrough()
      .nullable()
      .parse(result.issue)
    if (issue !== null && issue.team.id !== resource.externalId) {
      throw new Error("Linear task is outside the sealed team scope")
    }
    return result
  },
  async act(context, operation, resource, requestInput) {
    const request = JsonObjectSchema.parse(requestInput)
    if (operation === "linear.create_issue") {
      return graphqlMutationObject(
        context,
        "mutation AgencyCreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }",
        { input: { ...request, teamId: resource.externalId } }
      )
    }
    if (operation === "linear.update_issue") {
      return graphqlMutationObject(
        context,
        "mutation AgencyUpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title url } } }",
        { id: request.issueId, input: request.input }
      )
    }
    if (operation === "linear.add_comment") {
      return graphqlMutationObject(
        context,
        "mutation AgencyAddComment($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body url } } }",
        { input: { issueId: request.issueId, body: request.body } }
      )
    }
    const mutation = operation === "linear.add_label" ? "issueAddLabel" : "issueRemoveLabel"
    return graphqlMutationObject(
      context,
      `mutation AgencyLabel($id: String!, $labelId: String!) { ${mutation}(id: $id, labelId: $labelId) { success } }`,
      { id: request.issueId, labelId: request.labelId }
    )
  }
}

export function createDefaultProviderExecutionPortResolver(): ProviderExecutionPortResolver {
  return new ProviderExecutionPortResolver([githubWorkflowProvider, linearWorkflowProvider])
}
