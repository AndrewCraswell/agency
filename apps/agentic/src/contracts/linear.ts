import { z } from "zod"

export const LINEAR_WORK_ITEM_SCHEMA_VERSION = "1" as const

export const LinearTeamSchema = z
  .object({
    id: z.uuid(),
    key: z.string().regex(/^[A-Z][A-Z0-9]*$/u),
    name: z.string().trim().min(1)
  })
  .strict()

export const LinearWorkItemSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    source: z.literal("linear"),
    id: z.uuid(),
    identifier: z.string().regex(/^[A-Z][A-Z0-9]*-[1-9][0-9]*$/u),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    url: z.url(),
    priority: z.number().int().min(0).max(4),
    state: z
      .object({
        id: z.uuid(),
        name: z.string().trim().min(1),
        type: z.enum(["backlog", "unstarted"])
      })
      .strict(),
    team: LinearTeamSchema
  })
  .strict()

export const LinearCandidateListSchema = z
  .object({
    schemaVersion: z.literal(LINEAR_WORK_ITEM_SCHEMA_VERSION),
    fetchedAt: z.iso.datetime({ offset: true }),
    team: LinearTeamSchema,
    issues: z.array(LinearWorkItemSchema).min(1).max(50)
  })
  .strict()
  .superRefine((candidateList, context) => {
    const issueIds = candidateList.issues.map((issue) => issue.id)
    if (new Set(issueIds).size !== issueIds.length) {
      context.addIssue({ code: "custom", message: "Linear candidate issue IDs must be unique", path: ["issues"] })
    }
    for (const [index, issue] of candidateList.issues.entries()) {
      if (issue.team.id !== candidateList.team.id) {
        context.addIssue({
          code: "custom",
          message: "Every Linear candidate must belong to the selected team",
          path: ["issues", index, "team", "id"]
        })
      }
    }
  })
