import { safeValidateUIMessages, type UIMessage } from "ai"
import { z } from "zod"
import { stagedReferenceSchema, type StagedReference } from "./chatRequest"
import { clarificationRequestSchema, clarificationResponseSchema, type ClarificationResponse } from "./clarification"
import { composerDraftSchema, type ComposerDraft } from "./composerDraft"
import { presentationBlockSchema } from "./composition"

export const developmentConversationKey = "rostra.development.conversation"

const snapshotSchema = z.object({
  id: z.string().min(1).max(128),
  sessionKey: z.uuid(),
  draft: composerDraftSchema,
  references: z.array(stagedReferenceSchema).max(12).optional(),
  messages: z.array(z.unknown()),
  clarificationAnswers: z.record(z.string(), clarificationResponseSchema),
  interruptedMessageId: z.string().optional()
})

export type DevelopmentConversation = Readonly<{
  id: string
  sessionKey: string
  draft: ComposerDraft
  references?: StagedReference[]
  messages: UIMessage[]
  clarificationAnswers: Record<string, ClarificationResponse>
  interruptedMessageId?: string
}>

export async function parseDevelopmentConversation(serialized: string): Promise<DevelopmentConversation | undefined> {
  let input: unknown
  try {
    input = JSON.parse(serialized)
  } catch {
    return undefined
  }
  const snapshot = snapshotSchema.safeParse(input)
  if (!snapshot.success) {
    return undefined
  }
  const validated = await safeValidateUIMessages({
    messages: snapshot.data.messages,
    dataSchemas: { presentation: presentationBlockSchema }
  })
  if (!validated.success) {
    return undefined
  }
  const messages = validated.data.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "dynamic-tool" || part.toolName !== "ask_clarification" || part.state !== "output-available") {
        return part
      }
      const output = z.object({ clarification: clarificationRequestSchema }).safeParse(part.output)
      if (!output.success || snapshot.data.clarificationAnswers[output.data.clarification.id]) {
        return part
      }
      return { ...part, output: { clarification: { ...output.data.clarification, state: "expired" } } }
    })
  }))
  return { ...snapshot.data, messages }
}
