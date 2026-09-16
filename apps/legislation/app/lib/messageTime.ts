import type { UIMessage } from "ai"
import { z } from "zod"

const metadataSchema = z.looseObject({ createdAt: z.iso.datetime().optional() })
export const messageAcknowledgementSchema = z.object({
  messageId: z.string().min(1).max(128),
  acceptedAt: z.iso.datetime()
})

export function recordedMessageTime(message: UIMessage) {
  const metadata = metadataSchema.safeParse(message.metadata)
  return metadata.success ? metadata.data.createdAt : undefined
}

export function acknowledgeMessage(messages: UIMessage[], input: unknown) {
  const acknowledgement = messageAcknowledgementSchema.safeParse(input)
  if (!acknowledgement.success) {
    return messages
  }
  return messages.map((message) => {
    if (message.role !== "user" || message.id !== acknowledgement.data.messageId || recordedMessageTime(message)) {
      return message
    }
    const metadata = metadataSchema.safeParse(message.metadata)
    return {
      ...message,
      metadata: { ...(metadata.success ? metadata.data : {}), createdAt: acknowledgement.data.acceptedAt }
    }
  })
}
