"use client"

import { useClipboard } from "@mantine/hooks"
import { Check, Copy } from "lucide-react"
import Image from "next/image"
import { Button } from "../../../components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import * as styles from "./ConversationResponse.css"

type ConversationExportProps = Readonly<{
  json: string
}>

export function ConversationExport({ json }: ConversationExportProps) {
  const clipboard = useClipboard({ timeout: 1800 })
  let copyStatus = ""
  if (clipboard.error) {
    copyStatus = "Couldn't copy. Select the JSON and copy it manually."
  } else if (clipboard.copied) {
    copyStatus = "Copied"
  }
  return (
    <article aria-label="Rostra export" tabIndex={-1} className={styles.answerTurn}>
      <div className={styles.answerHead}>
        <Image src="/logo.png" alt="" width={15} height={15} className={styles.answerMark} />
        <h2 className={styles.answerAuthor}>Rostra</h2>
      </div>
      <section aria-label="Conversation export" data-conversation-export className="w-full min-w-0 space-y-2">
        <h3 className="text-sm font-medium">Conversation export</h3>
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border">
          <div className="flex shrink-0 items-center justify-between border-b bg-muted px-3 py-1">
            <span className="font-mono text-xs">JSON</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Copy JSON" onClick={() => clipboard.copy(json)}>
                  {clipboard.copied ? (
                    <Check aria-hidden="true" className="text-green-700 dark:text-green-400" />
                  ) : (
                    <Copy aria-hidden="true" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{clipboard.copied ? "Copied" : "Copy JSON"}</TooltipContent>
            </Tooltip>
          </div>
          <pre
            aria-label="Conversation export JSON"
            className="max-h-[60dvh] min-h-0 min-w-0 overflow-y-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed"
          >
            <code className="language-json">{json}</code>
          </pre>
        </div>
        <output className={clipboard.error ? "text-sm text-muted-foreground" : "sr-only"} aria-live="polite">
          {copyStatus}
        </output>
      </section>
    </article>
  )
}
