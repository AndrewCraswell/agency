import type { UIMessage } from "ai"
import { z } from "zod"
import { clarificationRequestSchema, clarificationResponseSchema } from "./clarification"
import { entityCardSchema, entityKindSchema } from "./entityResults"

const clarificationSubmissionMetadata = z.object({ clarificationRequestId: z.uuid() })

export const conversationReferenceSchema = z.object({
  resultId: z.uuid(),
  recordId: z.string().min(1).max(512)
})
export const stagedReferenceSchema = conversationReferenceSchema.extend({ record: entityCardSchema })
export type StagedReference = z.infer<typeof stagedReferenceSchema>
export function referenceMessageMetadata(references: readonly StagedReference[]) {
  return { references: structuredClone(references) }
}

export function messageReferenceSnapshots(message: UIMessage) {
  const metadata = z.object({ references: z.array(stagedReferenceSchema).max(12) }).safeParse(message.metadata)
  return metadata.success ? metadata.data.references : []
}

export function refreshStagedReferences(selected: readonly StagedReference[], results: readonly StagedReference[]) {
  const current = new Map(results.map((reference) => [`${reference.record.kind}:${reference.recordId}`, reference]))
  return selected.map((reference) => current.get(`${reference.record.kind}:${reference.recordId}`) ?? reference)
}

export const referenceSearchSchema = z.strictObject({
  action: z.literal("search-references"),
  sessionKey: z.uuid(),
  kind: z.union([z.literal("all"), entityKindSchema.exclude(["document"])]),
  query: z.string().trim().min(2).max(200)
})

export function isClarificationSubmission(message: UIMessage) {
  return message.role === "user" && clarificationSubmissionMetadata.safeParse(message.metadata).success
}

export function conversationTextMessages(messages: readonly UIMessage[]) {
  return messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts.flatMap((part) => {
        if (part.type === "text") {
          return [{ type: "text", text: part.text }]
        }
        if (
          part.type === "dynamic-tool" &&
          part.toolName === "ask_clarification" &&
          part.state === "output-available"
        ) {
          const parsed = z.object({ clarification: clarificationRequestSchema }).safeParse(part.output)
          if (parsed.success) {
            return [{ type: "text", text: parsed.data.clarification.input.question }]
          }
        }
        return []
      })
    }))
    .filter((message) => message.parts.length > 0)
}

export const clarificationAnswerRequestSchema = z.strictObject({
  action: z.literal("answer-clarification"),
  sessionKey: z.uuid(),
  response: clarificationResponseSchema
})

export const chatRequestSchema = z
  .object({
    sessionKey: z.uuid(),
    clarificationId: z.uuid().optional(),
    references: z.array(conversationReferenceSchema).max(12).optional(),
    messages: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          role: z.enum(["user", "assistant"]),
          parts: z.array(z.object({ type: z.literal("text"), text: z.string().max(24000) })).min(1)
        })
      )
      .min(1)
  })
  .superRefine((request, context) => {
    if (request.messages.at(-1)?.role !== "user") {
      context.addIssue({ code: "custom", message: "The conversation must end with a user question." })
    }
    if (request.messages.at(-1)?.parts.every((part) => part.text.trim().length === 0)) {
      context.addIssue({ code: "custom", message: "Enter a question." })
    }
  })

export function chatIsAvailable(environment: NodeJS.ProcessEnv) {
  if (!environment.OPENROUTER_API_KEY?.trim()) {
    return false
  }
  return environment.NODE_ENV === "development" || productionChatOrigin(environment) !== null
}

function productionChatOrigin(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV !== "production") {
    return null
  }
  try {
    const url = new URL(environment.LEGISLATION_PUBLIC_API_BASE_URL ?? "")
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export function chatRequestIsAllowed(request: Request, environment: NodeJS.ProcessEnv) {
  const url = new URL(request.url)
  const origin = request.headers.get("origin")
  if (environment.NODE_ENV === "development") {
    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && origin === url.origin
  }
  const trustedOrigin = productionChatOrigin(environment)
  return trustedOrigin !== null && origin === trustedOrigin && url.origin === trustedOrigin
}
