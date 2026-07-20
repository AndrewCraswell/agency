import { z } from "zod"

export const ActionKeySchema = z.enum([
  "assign",
  "publish",
  "run",
  "retry_step",
  "retry_from_here",
  "cancel",
  "resume",
  "run_again",
  "resolve_effect",
  "connect",
  "reconnect",
  "reconcile",
  "refresh",
  "disconnect"
])

export const ActionAvailabilitySchema = z
  .object({
    key: ActionKeySchema,
    allowed: z.boolean(),
    disabledReason: z.string().min(1).nullable(),
    targetLabel: z.string().min(1),
    consequence: z.string().min(1),
    approvalRequirement: z.enum(["none", "confirmation", "required"]),
    requiredCapability: z.string().min(1).nullable()
  })
  .strict()
  .superRefine((action, context) => {
    if (action.allowed && action.disabledReason !== null) {
      context.addIssue({
        code: "custom",
        message: "Allowed actions cannot have a disabled reason",
        path: ["disabledReason"]
      })
    }
    if (!action.allowed && action.disabledReason === null) {
      context.addIssue({
        code: "custom",
        message: "Unavailable actions require a disabled reason",
        path: ["disabledReason"]
      })
    }
  })
