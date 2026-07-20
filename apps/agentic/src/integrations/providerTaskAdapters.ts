import { z } from "zod"
import type { ProviderTask, ProviderTaskPort, ProviderTaskQuery } from "./providerPorts"
import { ProviderTaskPortResolver } from "./providerPorts"

const TaskCursorSchema = z
  .object({ after: z.string().nullable(), history: z.array(z.string().nullable()).max(100) })
  .strict()
const LinearTaskSchema = z
  .object({
    id: z.string().min(1),
    identifier: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    url: z.url(),
    priority: z.number().int(),
    state: z.object({ id: z.string().min(1), name: z.string().min(1), type: z.string().min(1) }).strict(),
    assignee: z
      .object({ id: z.string().min(1), name: z.string().min(1) })
      .strict()
      .nullable(),
    labels: z
      .object({ nodes: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).strict()) })
      .strict(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true })
  })
  .strict()
const LinearTaskPageSchema = z
  .object({
    data: z
      .object({
        team: z
          .object({
            issues: z
              .object({
                nodes: z.array(LinearTaskSchema),
                pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }).strict()
              })
              .strict()
          })
          .strict()
          .nullable()
      })
      .strict()
      .optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()
const LinearTaskDetailSchema = z
  .object({
    data: z
      .object({ issue: LinearTaskSchema.extend({ team: z.object({ id: z.string().min(1) }).strict() }).nullable() })
      .optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()
const LinearTaskCommentsSchema = z
  .object({
    data: z
      .object({
        issue: z
          .object({
            team: z.object({ id: z.string().min(1) }).strict(),
            comments: z
              .object({
                nodes: z.array(
                  z
                    .object({
                      id: z.string().min(1),
                      body: z.string(),
                      createdAt: z.iso.datetime({ offset: true }),
                      user: z
                        .object({ id: z.string().min(1), name: z.string().min(1) })
                        .strict()
                        .nullable()
                    })
                    .strict()
                )
              })
              .strict()
          })
          .strict()
          .nullable()
      })
      .optional(),
    errors: z.array(z.object({ message: z.string() }).passthrough()).optional()
  })
  .passthrough()

function decodeCursor(cursor: string | undefined): z.infer<typeof TaskCursorSchema> {
  if (cursor === undefined) return { after: null, history: [] }
  try {
    return TaskCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")))
  } catch {
    throw new Error("Task cursor is invalid")
  }
}

function encodeCursor(cursor: z.infer<typeof TaskCursorSchema>): string {
  return Buffer.from(JSON.stringify(TaskCursorSchema.parse(cursor)), "utf8").toString("base64url")
}

function taskFilter(teamId: string, query: ProviderTaskQuery): Record<string, unknown> {
  const filters: Record<string, unknown>[] = [{ team: { id: { eq: teamId } } }]
  if (query.query !== undefined) {
    filters.push({
      or: [
        { identifier: { containsIgnoreCase: query.query } },
        { title: { containsIgnoreCase: query.query } },
        { description: { containsIgnoreCase: query.query } }
      ]
    })
  }
  if (query.status !== undefined) filters.push({ state: { type: { eq: query.status } } })
  if (query.assignee !== undefined) filters.push({ assignee: { id: { eq: query.assignee } } })
  if (query.label !== undefined) filters.push({ labels: { id: { eq: query.label } } })
  return { and: filters }
}

function normalizeTask(task: z.infer<typeof LinearTaskSchema>): ProviderTask {
  return {
    id: task.id,
    identifier: task.identifier,
    title: task.title,
    description: task.description ?? "",
    url: task.url,
    priority: task.priority,
    state: task.state,
    assignee: task.assignee,
    labels: task.labels.nodes,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }
}

function assertGraphqlResponse(response: { data?: unknown; errors?: readonly { message: string }[] }): void {
  if (response.errors !== undefined || response.data === undefined) {
    throw new Error(response.errors?.map(({ message }) => message).join(" ") ?? "Linear returned no data")
  }
}

export const linearTaskReadProvider: ProviderTaskPort = {
  provider: "linear",
  resourceType: "team",
  async list(context, resource, query) {
    const cursor = decodeCursor(query.cursor)
    const response = LinearTaskPageSchema.parse(
      await context.request({
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: {
          query:
            "query AgencyTaskboard($teamId: String!, $first: Int!, $after: String, $filter: IssueFilter) { team(id: $teamId) { issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) { nodes { id identifier title description url priority state { id name type } assignee { id name } labels { nodes { id name } } createdAt updatedAt } pageInfo { hasNextPage endCursor } } } }",
          variables: {
            teamId: resource.externalId,
            first: query.pageSize,
            after: cursor.after,
            filter: taskFilter(resource.externalId, query)
          }
        }
      })
    )
    assertGraphqlResponse(response)
    if (response.data?.team === null) throw new Error("Task resource was not found")
    const issues = response.data?.team?.issues
    if (issues === undefined) throw new Error("Linear returned no task page")
    const previousAfter = cursor.history.at(-1)
    return {
      items: issues.nodes.map(normalizeTask),
      previousCursor:
        previousAfter === undefined
          ? null
          : encodeCursor({ after: previousAfter, history: cursor.history.slice(0, -1) }),
      nextCursor:
        issues.pageInfo.hasNextPage && issues.pageInfo.endCursor !== null
          ? encodeCursor({ after: issues.pageInfo.endCursor, history: [...cursor.history, cursor.after] })
          : null
    }
  },
  async get(context, resource, taskId) {
    const response = LinearTaskDetailSchema.parse(
      await context.request({
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: {
          query:
            "query AgencyTaskboardTask($id: String!) { issue(id: $id) { id identifier title description url priority state { id name type } assignee { id name } labels { nodes { id name } } createdAt updatedAt team { id } } }",
          variables: { id: taskId }
        }
      })
    )
    assertGraphqlResponse(response)
    const task = response.data?.issue
    if (task === null || task === undefined) return null
    if (task.team.id !== resource.externalId) throw new Error("Task does not belong to the selected resource")
    return normalizeTask(task)
  },
  async comments(context, resource, taskId) {
    const response = LinearTaskCommentsSchema.parse(
      await context.request({
        method: "POST",
        endpoint: "/graphql",
        headers: { "Content-Type": "application/json" },
        data: {
          query:
            "query AgencyTaskboardComments($id: String!) { issue(id: $id) { team { id } comments(first: 100) { nodes { id body createdAt user { id name } } } } }",
          variables: { id: taskId }
        }
      })
    )
    assertGraphqlResponse(response)
    const issue = response.data?.issue
    if (issue === null || issue === undefined) return []
    if (issue.team.id !== resource.externalId) throw new Error("Task does not belong to the selected resource")
    return issue.comments.nodes.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: comment.user
    }))
  }
}

export function createDefaultProviderTaskPortResolver(): ProviderTaskPortResolver {
  return new ProviderTaskPortResolver([linearTaskReadProvider])
}
