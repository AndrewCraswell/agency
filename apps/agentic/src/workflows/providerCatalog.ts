import { z } from "zod"

export const ProviderOperationSchema = z.enum([
  "github.repository",
  "github.pull_request",
  "github.pull_request_comments",
  "github.pull_request_reviews",
  "github.checks",
  "github.create_or_update_pull_request",
  "github.add_pull_request_comment",
  "github.submit_pull_request_review",
  "github.request_reviewers",
  "github.add_labels",
  "github.remove_label",
  "github.set_check_status",
  "github.merge_pull_request",
  "github.close_pull_request",
  "linear.ready_issues",
  "linear.issue",
  "linear.issue_comments",
  "linear.create_issue",
  "linear.update_issue",
  "linear.add_comment",
  "linear.add_label",
  "linear.remove_label"
])

export type ProviderOperation = z.infer<typeof ProviderOperationSchema>
export type ProviderOperationDefinition = {
  operation: ProviderOperation
  provider: "github" | "linear"
  mode: "read" | "write"
  resourceType: "repository" | "team"
  capability: "repository.read" | "repository.write" | "pull_request.write" | "team.read" | "issue.read" | "issue.write"
  label: string
}

const ProviderInputSchemas: Record<ProviderOperation, z.ZodType<Record<string, unknown>>> = {
  "github.repository": z.object({}).passthrough(),
  "github.pull_request": z.object({ pullRequestNumber: z.number().int().positive() }).passthrough(),
  "github.pull_request_comments": z.object({ pullRequestNumber: z.number().int().positive() }).passthrough(),
  "github.pull_request_reviews": z.object({ pullRequestNumber: z.number().int().positive() }).passthrough(),
  "github.checks": z.object({ ref: z.string().trim().min(1) }).passthrough(),
  "github.create_or_update_pull_request": z
    .object({
      pullRequestNumber: z.number().int().positive().optional(),
      title: z.string().trim().min(1).optional(),
      head: z.string().trim().min(1).optional(),
      base: z.string().trim().min(1).optional()
    })
    .passthrough()
    .superRefine((request, context) => {
      if (
        request.pullRequestNumber === undefined &&
        (request.title === undefined || request.head === undefined || request.base === undefined)
      ) {
        context.addIssue({ code: "custom", message: "Creating a pull request requires title, head, and base." })
      }
    }),
  "github.add_pull_request_comment": z
    .object({ pullRequestNumber: z.number().int().positive(), body: z.string().trim().min(1) })
    .passthrough(),
  "github.submit_pull_request_review": z
    .object({ pullRequestNumber: z.number().int().positive(), event: z.string().trim().min(1) })
    .passthrough(),
  "github.request_reviewers": z
    .object({ pullRequestNumber: z.number().int().positive(), reviewers: z.array(z.string().trim().min(1)).min(1) })
    .passthrough(),
  "github.add_labels": z
    .object({ pullRequestNumber: z.number().int().positive(), labels: z.array(z.string().trim().min(1)).min(1) })
    .passthrough(),
  "github.remove_label": z
    .object({ pullRequestNumber: z.number().int().positive(), label: z.string().trim().min(1) })
    .passthrough(),
  "github.set_check_status": z
    .object({ name: z.string().trim().min(1), head_sha: z.string().trim().min(1), status: z.string().trim().min(1) })
    .passthrough(),
  "github.merge_pull_request": z.object({ pullRequestNumber: z.number().int().positive() }).passthrough(),
  "github.close_pull_request": z.object({ pullRequestNumber: z.number().int().positive() }).passthrough(),
  "linear.ready_issues": z.object({ limit: z.number().int().min(1).max(100).optional() }).passthrough(),
  "linear.issue": z.object({ issueId: z.string().trim().min(1) }).passthrough(),
  "linear.issue_comments": z.object({ issueId: z.string().trim().min(1) }).passthrough(),
  "linear.create_issue": z.object({ title: z.string().trim().min(1) }).passthrough(),
  "linear.update_issue": z
    .object({ issueId: z.string().trim().min(1), input: z.record(z.string(), z.unknown()) })
    .passthrough(),
  "linear.add_comment": z.object({ issueId: z.string().trim().min(1), body: z.string().trim().min(1) }).passthrough(),
  "linear.add_label": z.object({ issueId: z.string().trim().min(1), labelId: z.string().trim().min(1) }).passthrough(),
  "linear.remove_label": z
    .object({ issueId: z.string().trim().min(1), labelId: z.string().trim().min(1) })
    .passthrough()
}

const definitions: ProviderOperationDefinition[] = [
  {
    operation: "github.repository",
    provider: "github",
    mode: "read",
    resourceType: "repository",
    capability: "repository.read",
    label: "Repository metadata"
  },
  {
    operation: "github.pull_request",
    provider: "github",
    mode: "read",
    resourceType: "repository",
    capability: "repository.read",
    label: "Pull request"
  },
  {
    operation: "github.pull_request_comments",
    provider: "github",
    mode: "read",
    resourceType: "repository",
    capability: "repository.read",
    label: "Pull request comments"
  },
  {
    operation: "github.pull_request_reviews",
    provider: "github",
    mode: "read",
    resourceType: "repository",
    capability: "repository.read",
    label: "Pull request reviews"
  },
  {
    operation: "github.checks",
    provider: "github",
    mode: "read",
    resourceType: "repository",
    capability: "repository.read",
    label: "Commit checks"
  },
  {
    operation: "github.create_or_update_pull_request",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Create or update pull request"
  },
  {
    operation: "github.add_pull_request_comment",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Add pull request comment"
  },
  {
    operation: "github.submit_pull_request_review",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Submit pull request review"
  },
  {
    operation: "github.request_reviewers",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Request reviewers"
  },
  {
    operation: "github.add_labels",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "repository.write",
    label: "Add labels"
  },
  {
    operation: "github.remove_label",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "repository.write",
    label: "Remove label"
  },
  {
    operation: "github.set_check_status",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "repository.write",
    label: "Set check status"
  },
  {
    operation: "github.merge_pull_request",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Merge pull request"
  },
  {
    operation: "github.close_pull_request",
    provider: "github",
    mode: "write",
    resourceType: "repository",
    capability: "pull_request.write",
    label: "Close pull request"
  },
  {
    operation: "linear.ready_issues",
    provider: "linear",
    mode: "read",
    resourceType: "team",
    capability: "issue.read",
    label: "Ready tasks"
  },
  {
    operation: "linear.issue",
    provider: "linear",
    mode: "read",
    resourceType: "team",
    capability: "issue.read",
    label: "Task"
  },
  {
    operation: "linear.issue_comments",
    provider: "linear",
    mode: "read",
    resourceType: "team",
    capability: "issue.read",
    label: "Task comments"
  },
  {
    operation: "linear.create_issue",
    provider: "linear",
    mode: "write",
    resourceType: "team",
    capability: "issue.write",
    label: "Create task"
  },
  {
    operation: "linear.update_issue",
    provider: "linear",
    mode: "write",
    resourceType: "team",
    capability: "issue.write",
    label: "Update task"
  },
  {
    operation: "linear.add_comment",
    provider: "linear",
    mode: "write",
    resourceType: "team",
    capability: "issue.write",
    label: "Add task comment"
  },
  {
    operation: "linear.add_label",
    provider: "linear",
    mode: "write",
    resourceType: "team",
    capability: "issue.write",
    label: "Add task label"
  },
  {
    operation: "linear.remove_label",
    provider: "linear",
    mode: "write",
    resourceType: "team",
    capability: "issue.write",
    label: "Remove task label"
  }
]

export function listProviderOperations(mode?: "read" | "write"): ProviderOperationDefinition[] {
  return definitions.filter((definition) => mode === undefined || definition.mode === mode)
}

export function getProviderOperation(operationInput: string): ProviderOperationDefinition {
  const operation = ProviderOperationSchema.parse(operationInput)
  const definition = definitions.find((candidate) => candidate.operation === operation)
  if (definition === undefined) throw new Error(`Provider operation ${operation} is unavailable`)
  return definition
}

export function validateProviderOperationInput(
  operationInput: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const operation = ProviderOperationSchema.parse(operationInput)
  return ProviderInputSchemas[operation].parse(input)
}
