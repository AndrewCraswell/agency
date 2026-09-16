"use client"

import { useReducedMotion } from "@mantine/hooks"
import { ArrowDown } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom"
import { cn } from "@/lib/utils"

export type ConversationProps = ComponentProps<typeof StickToBottom>

export const Conversation = ({ className, ...props }: ConversationProps) => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
)

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>

export const ConversationContent = ({ className, ...props }: ConversationContentProps) => (
  <StickToBottom.Content className={cn("flex flex-col gap-8 p-4", className)} {...props} />
)

export function ConversationScrollButton({
  className,
  messageIds
}: Readonly<{ className?: string; messageIds: readonly string[] }>) {
  const { isAtBottom, scrollToBottom, contentRef } = useStickToBottomContext()
  const isReducedMotion = useReducedMotion()
  const [seenMessageIds, setSeenMessageIds] = useState(messageIds)
  if (
    isAtBottom &&
    (messageIds.length !== seenMessageIds.length || messageIds.some((id, index) => id !== seenMessageIds[index]))
  ) {
    setSeenMessageIds(messageIds)
  }
  const seen = new Set(seenMessageIds)
  const newMessageCount = messageIds.filter((id) => !seen.has(id)).length
  if (isAtBottom) {
    return null
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const articles = contentRef.current?.querySelectorAll("article")
        const latest = articles?.item(articles.length - 1)
        latest?.focus({ preventScroll: true })
        void scrollToBottom({ animation: isReducedMotion ? "instant" : "smooth" })
      }}
    >
      <ArrowDown className="size-[13px] shrink-0 text-muted-foreground" aria-hidden="true" />
      <span>Jump to latest</span>
      {newMessageCount > 0 && (
        <span className="font-normal text-subtle">{new Intl.NumberFormat().format(newMessageCount)} new</span>
      )}
    </button>
  )
}
