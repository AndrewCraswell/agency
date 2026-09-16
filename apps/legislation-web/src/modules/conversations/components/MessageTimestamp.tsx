"use client"

import type { UIMessage } from "ai"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import { recordedMessageTime } from "../messageTime"
import * as styles from "./ConversationResponse.css"

export function MessageTimestamp({ message }: Readonly<{ message: UIMessage }>) {
  const [isOpen, setIsOpen] = useState(false)
  const recordedAt = recordedMessageTime(message)
  if (!recordedAt) {
    return null
  }
  const date = new Date(recordedAt)
  const short = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
  const full = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(date)
  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger asChild>
        <button type="button" className={styles.messageTime} aria-label={full} onClick={() => setIsOpen(!isOpen)}>
          <time dateTime={recordedAt}>{short}</time>
        </button>
      </TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  )
}
