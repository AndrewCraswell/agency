"use client"

import { useClipboard } from "@mantine/hooks"
import type { UIMessage } from "ai"
import { Check, Copy } from "lucide-react"
import { Button } from "../../../components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import { MessageTimestamp } from "./MessageTimestamp"
import * as styles from "./ConversationResponse.css"

export function MessageActions({ message, isRunning = false }: Readonly<{ message: UIMessage; isRunning?: boolean }>) {
  const clipboard = useClipboard({ timeout: 1800 })
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
  const label = message.role === "user" ? "Copy message" : "Copy response"
  return (
    <div className={styles.messageActions} data-message-actions>
      <MessageTimestamp message={message} />
      {text && !isRunning && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={() => clipboard.copy(text)}>
              {clipboard.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{clipboard.copied ? "Copied" : label}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
