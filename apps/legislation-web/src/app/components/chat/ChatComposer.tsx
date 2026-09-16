"use client"

import { useMediaQuery } from "@mantine/hooks"
import { ArrowUp, Plus, Square, X } from "lucide-react"
import { useId, useRef, type KeyboardEvent, type Ref } from "react"
import type { StagedReference } from "../../lib/chatRequest"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as styles from "./ChatComposer.css"
import * as referenceStyles from "./ReferencePicker.css"

type ChatComposerProps = Readonly<{
  draft: string
  onDraftChange: (draft: string) => void
  onSend: () => void
  onStop?: () => void
  onReferenceRequested?: () => void
  isRunning?: boolean
  isAvailable?: boolean
  hasHomepageGlow?: boolean
  status?: string
  textareaRef?: Ref<HTMLTextAreaElement>
  messageHistory?: readonly string[]
  references?: readonly StagedReference[]
  onRemoveReference?: (recordId: string) => void
  onMentionRequested?: () => void
}>

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  onStop,
  onReferenceRequested,
  isRunning = false,
  isAvailable = true,
  hasHomepageGlow = false,
  status,
  textareaRef,
  messageHistory = [],
  references = [],
  onRemoveReference,
  onMentionRequested
}: ChatComposerProps) {
  const id = useId()
  const isMobile = useMediaQuery("(max-width: 40rem)", true)
  const canSend = isAvailable && !isRunning && draft.trim().length > 0
  const historyPosition = useRef<{ entries: readonly string[]; index: number; draft: string; recalled: string } | null>(
    null
  )

  function submit() {
    historyPosition.current = null
    onSend()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return
    }
    if (
      event.key === "@" &&
      onMentionRequested &&
      (event.currentTarget.selectionStart === 0 || /\s/.test(draft[event.currentTarget.selectionStart - 1] ?? ""))
    ) {
      event.preventDefault()
      onMentionRequested()
      return
    }
    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      const field = event.currentTarget
      const position = historyPosition.current
      const isRecalling = position !== null && position.recalled === draft
      const isSelectedRecall = isRecalling && field.selectionStart === 0 && field.selectionEnd === draft.length
      if (field.selectionStart !== field.selectionEnd && !isSelectedRecall) {
        return
      }
      const isUp = event.key === "ArrowUp"
      const isMultiline = draft.includes("\n")
      if (
        isMultiline &&
        !isSelectedRecall &&
        ((isUp && field.selectionStart !== 0) || (!isUp && field.selectionEnd !== draft.length))
      ) {
        return
      }
      let current = position
      if (!isRecalling) {
        if (!isUp || messageHistory.length === 0) {
          return
        }
        current = { entries: [...messageHistory], index: messageHistory.length, draft, recalled: draft }
      }
      if (!current) {
        return
      }
      event.preventDefault()
      const index = Math.max(0, Math.min(current.entries.length, current.index + (isUp ? -1 : 1)))
      const recalled = current.entries[index] ?? current.draft
      historyPosition.current = { ...current, index, recalled }
      onDraftChange(recalled)
      requestAnimationFrame(() => {
        if (document.activeElement === field && field.value === recalled) {
          field.select()
        }
      })
      return
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229 || isMobile) {
      return
    }
    event.preventDefault()
    if (canSend) {
      submit()
    }
  }

  return (
    <div>
      <form
        className={cn(styles.composer, hasHomepageGlow && styles.homepageGlow)}
        onSubmit={(event) => {
          event.preventDefault()
          if (canSend) {
            submit()
          }
        }}
      >
        <label className="sr-only" htmlFor={id}>
          Your question
        </label>
        <Textarea
          id={id}
          ref={textareaRef}
          value={draft}
          rows={2}
          onChange={(event) => {
            historyPosition.current = null
            onDraftChange(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask a research question..."
          aria-describedby={status ? `${id}-status` : undefined}
          className={cn(
            styles.question,
            "resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-base dark:bg-transparent"
          )}
        />
        {references.length > 0 && (
          <div className={referenceStyles.chips} aria-label="Selected references">
            {references.map((reference) => (
              <span key={`${reference.record.kind}:${reference.recordId}`} className={referenceStyles.chip}>
                <span className={referenceStyles.chipLabel} title={reference.record.title}>
                  {reference.record.title}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove reference: ${reference.record.title}`}
                  type="button"
                  onClick={() => onRemoveReference?.(reference.recordId)}
                >
                  <X className="size-3" aria-hidden="true" />
                </Button>
              </span>
            ))}
          </div>
        )}
        <div className={styles.bar}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={styles.reference}
                aria-label="Add references"
                aria-disabled={!onReferenceRequested}
                onClick={onReferenceRequested}
              >
                <Plus className="size-5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {onReferenceRequested ? "Add references" : "Reference library is not connected yet."}
            </TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          {isRunning ? (
            <Button
              type="button"
              className={styles.send}
              aria-label="Stop response"
              onClick={onStop}
              disabled={!onStop}
            >
              <Square className="size-[18px]" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" className={styles.send} aria-label="Send question" disabled={!canSend}>
              <ArrowUp className="size-[18px]" aria-hidden="true" />
            </Button>
          )}
        </div>
      </form>
      {status && (
        <output id={`${id}-status`} className="mt-2 block text-xs text-subtle">
          {status}
        </output>
      )}
    </div>
  )
}
