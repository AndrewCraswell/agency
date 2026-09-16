import { z } from "zod"

const optionSchema = z.strictObject({
  id: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(500).optional(),
  recordId: z.string().trim().min(1).max(256).optional()
})

const questionFields = {
  question: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(500).optional(),
  allowSkip: z.boolean()
}

const choiceFields = {
  ...questionFields,
  options: z.array(optionSchema).min(2).max(12),
  allowFreeText: z.boolean()
}

export const clarificationInputSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({ ...questionFields, kind: z.literal("text") }),
    z.strictObject({ ...choiceFields, kind: z.literal("single") }),
    z.strictObject({
      ...choiceFields,
      kind: z.literal("multiple"),
      minSelections: z.number().int().min(1).max(12),
      maxSelections: z.number().int().min(1).max(12)
    })
  ])
  .superRefine((input, context) => {
    if (input.kind === "text") {
      return
    }
    if (new Set(input.options.map((option) => option.id)).size !== input.options.length) {
      context.addIssue({ code: "custom", path: ["options"], message: "Each option must have a unique ID." })
    }
    if (
      input.kind === "multiple" &&
      (input.minSelections > input.maxSelections || input.maxSelections > input.options.length)
    ) {
      context.addIssue({
        code: "custom",
        path: ["maxSelections"],
        message: "Selection bounds must fit the available options."
      })
    }
  })

export const clarificationRequestSchema = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().positive(),
  state: z.enum(["pending", "answered", "skipped", "superseded", "expired"]),
  input: clarificationInputSchema
})

const responseIdentity = {
  requestId: z.uuid(),
  revision: z.number().int().positive()
}

export const clarificationResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...responseIdentity, status: z.literal("skipped") }),
  z.strictObject({
    ...responseIdentity,
    status: z.literal("answered"),
    selectedIds: z.array(z.string().trim().min(1).max(128)).max(12),
    text: z.string().trim().max(2000)
  })
])

export type ClarificationInput = z.infer<typeof clarificationInputSchema>
export type ClarificationRequest = z.infer<typeof clarificationRequestSchema>
export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>

export function clarificationResponseSchemaFor(request: ClarificationRequest) {
  return clarificationResponseSchema.superRefine((response, context) => {
    if (request.state !== "pending") {
      context.addIssue({ code: "custom", message: "This question is no longer active." })
      return
    }
    if (response.requestId !== request.id || response.revision !== request.revision) {
      context.addIssue({ code: "custom", message: "This response does not match the active question." })
      return
    }

    const input = request.input
    if (response.status === "skipped") {
      if (!input.allowSkip) {
        context.addIssue({ code: "custom", message: "This question requires an answer." })
      }
      return
    }

    const hasText = response.text.length > 0
    if (input.kind === "text") {
      if (response.selectedIds.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["selectedIds"],
          message: "This question accepts text, not option IDs."
        })
      }
      if (!hasText) {
        context.addIssue({ code: "custom", path: ["text"], message: "Enter an answer." })
      }
      return
    }

    const selectedIds = new Set(response.selectedIds)
    if (selectedIds.size !== response.selectedIds.length) {
      context.addIssue({ code: "custom", path: ["selectedIds"], message: "Select each option only once." })
    }
    const availableIds = new Set(input.options.map((option) => option.id))
    if (response.selectedIds.some((id) => !availableIds.has(id))) {
      context.addIssue({ code: "custom", path: ["selectedIds"], message: "Choose from the available options." })
    }
    if (hasText && !input.allowFreeText) {
      context.addIssue({ code: "custom", path: ["text"], message: "This question accepts only the available options." })
    }
    if (response.selectedIds.length === 0 && input.allowFreeText && hasText) {
      return
    }
    if (input.kind === "single" && response.selectedIds.length !== 1) {
      context.addIssue({ code: "custom", path: ["selectedIds"], message: "Choose one option." })
    }
    if (
      input.kind === "multiple" &&
      (response.selectedIds.length < input.minSelections || response.selectedIds.length > input.maxSelections)
    ) {
      context.addIssue({
        code: "custom",
        path: ["selectedIds"],
        message: `Choose between ${input.minSelections} and ${input.maxSelections} options.`
      })
    }
  })
}
