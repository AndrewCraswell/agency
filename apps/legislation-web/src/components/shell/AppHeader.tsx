"use client"

import { useMounted } from "@mantine/hooks"
import { MessageSquareText } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useConversationSession } from "../../modules/conversations/components/ConversationSession"
import { ThemeToggle } from "../theme/ThemeToggle"
import { Button } from "../ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as styles from "./AppShell.css"

export function AppHeader({ demo = false }: Readonly<{ demo?: boolean }>) {
  const { chat, isRestoringConversation } = useConversationSession()
  const isMounted = useMounted()
  const isReady = isMounted && !isRestoringConversation
  const canResume = isReady && chat.messages.length > 0
  const conversationHref = canResume ? `/conversations/${encodeURIComponent(chat.id)}` : "/"
  return (
    <header className={demo ? `${styles.header} ${styles.demoHeader}` : styles.header}>
      <Link href="/" aria-label="Rostra home" className={styles.brand}>
        <Image src="/ftkLH.png" alt="" width={demo ? 24 : 22} height={demo ? 24 : 22} priority />
        <span className={styles.wordmark}>Rostra</span>
      </Link>
      {demo && <span className={styles.demoLabel}>Live demo</span>}
      <div className={styles.utilities}>
        {!demo && (
          <Tooltip>
            <TooltipTrigger asChild>
              {isReady ? (
                <Button asChild size="icon-sm" variant="ghost" className={styles.utility}>
                  <Link href={conversationHref} aria-label="Open conversation">
                    <MessageSquareText aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className={styles.utility}
                  aria-label="Open conversation"
                  disabled
                >
                  <MessageSquareText aria-hidden="true" />
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>Open conversation</TooltipContent>
          </Tooltip>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
