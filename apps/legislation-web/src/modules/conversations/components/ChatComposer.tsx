"use client"

import { useMediaQuery } from "@mantine/hooks"
import { ArrowUp, Plus, Square, X } from "lucide-react"
import { useId, type Ref } from "react"
import { Button } from "../../../components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import { cn } from "../../../components/ui/utils"
import type { StagedReference } from "../chatRequest"
import { composerDraftText, composerReferences, type ComposerDraft } from "../composerDraft"
import { ComposerInput, type ComposerHandle } from "./ComposerInput"
import * as styles from "./ChatComposer.css"
import * as referenceStyles from "./ReferencePicker.css"

type ChatComposerProps = Readonly<{
  draft: ComposerDraft
  onDraftChange: (draft: ComposerDraft) => void
  onSend: () => void
  onStop?: () => void
  onReferenceRequested?: () => void
  isRunning?: boolean
  isAvailable?: boolean
  hasHomepageGlow?: boolean
  status?: string
  composerRef?: Ref<ComposerHandle>
  messageHistory?: readonly ComposerDraft[]
  references?: readonly StagedReference[]
  onRemoveReference?: (recordId: string) => void
  searchMentions?: (query: string, signal: AbortSignal) => Promise<StagedReference[]>
  focusOnMount?: boolean
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
  composerRef,
  messageHistory = [],
  references = [],
  onRemoveReference,
  searchMentions,
  focusOnMount
}: ChatComposerProps) {
  const id = useId()
  const isMobile = useMediaQuery("(max-width: 40rem)", true)
  const canSend =
    isAvailable &&
    !isRunning &&
    composerDraftText(draft).trim().length > 0 &&
    composerReferences(draft, references).length <= 12

  function submit() {
    onSend()
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
        <ComposerInput
          draft={draft}
          onDraftChange={onDraftChange}
          composerRef={composerRef}
          onSend={submit}
          canSend={canSend}
          isMobile={isMobile}
          references={references}
          messageHistory={messageHistory}
          searchMentions={searchMentions}
          focusOnMount={focusOnMount}
          describedBy={status ? `${id}-status` : undefined}
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
