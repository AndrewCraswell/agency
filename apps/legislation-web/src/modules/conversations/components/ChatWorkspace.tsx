"use client"

import { useChat } from "@ai-sdk/react"
import { captureException, getReplay } from "@sentry/nextjs"
import { RotateCcw } from "lucide-react"
import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { Fragment, useRef, useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from "../../../components/ai-elements/conversation"
import { AppShell } from "../../../components/shell/AppShell"
import { Button } from "../../../components/ui/button"
import { cn } from "../../../components/ui/utils"
import { diagnosticBreadcrumb } from "../../../services/sentry/diagnosticBreadcrumb"
import type { StagedReference } from "../chatRequest"
import { isClarificationSubmission } from "../chatRequest"
import { composerDraftText, composerMessageMetadata, messageComposerDraft } from "../composerDraft"
import { composerSubmissionBlockedReason } from "../composerPolicy"
import { createConversationExport } from "../conversationExport"
import { entityPageSchema } from "../entityResults"
import { messageResponseOutcome, responseIsIncomplete } from "../responseOutcome"
import { ChatComposer } from "./ChatComposer"
import type { CitationSelection } from "./citationPresentation"
import type { ComposerHandle } from "./ComposerInput"
import { ConversationExport } from "./ConversationExport"
import { ConversationResponse } from "./ConversationResponse"
import { useConversationSession } from "./ConversationSession"
import { EvidencePanel } from "./EvidencePanel"
import { MessageActions } from "./MessageActions"
import { MessageQuestion, MessageReferences } from "./MessageReferences"
import { ReferencePicker } from "./ReferencePicker"
import * as styles from "./ChatWorkspace.css"
import * as responseStyles from "./ConversationResponse.css"

type ChatWorkspaceProps = Readonly<{
  isAvailable?: boolean
  conversationId: string
}>

type ConversationExportTurn = Readonly<{
  id: string
  afterMessageId: string
  json: string
}>

export function ChatWorkspace({ isAvailable = false, conversationId }: ChatWorkspaceProps) {
  const {
    chat,
    isConfirmingClarification,
    cancelClarification,
    draft,
    setDraft,
    references,
    setReferences,
    searchReferences,
    isRestoringConversation,
    hasReloadRecoveryError,
    interruptedMessageId,
    markInterrupted,
    clarificationAnswers
  } = useConversationSession()
  const hasSession = conversationId === chat.id
  const [isReferencePickerOpen, setReferencePickerOpen] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<CitationSelection>()
  const [exportStatus, setExportStatus] = useState<string>()
  const [exportTurns, setExportTurns] = useState<ConversationExportTurn[]>([])
  const evidenceTrigger = useRef<HTMLElement | null>(null)
  function handleEvidence(selection: CitationSelection) {
    evidenceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedCitation(selection)
  }
  const { messages, sendMessage, status, stop, regenerate } = useChat({ chat, throttle: 50 })
  const visibleMessages = messages.filter((message) => !isClarificationSubmission(message))
  const isRunning = status === "submitted" || status === "streaming"
  const isBusy = isRunning || isConfirmingClarification || isRestoringConversation
  const lastMessage = messages.at(-1)
  const messageHistory = messages
    .filter((message) => message.role === "user" && !isClarificationSubmission(message))
    .map(messageComposerDraft)
    .filter((previous) => composerDraftText(previous).trim().length > 0)
  const hasInterruptedResponse = interruptedMessageId !== undefined && interruptedMessageId === lastMessage?.id
  const lastOutcome =
    lastMessage && (lastMessage.role === "assistant" || hasInterruptedResponse)
      ? messageResponseOutcome(lastMessage)
      : undefined
  const hasIncompleteResponse =
    !isRunning && (lastOutcome ? responseIsIncomplete(lastOutcome) : status === "error" || hasInterruptedResponse)
  const outcomeNotices = {
    cancelled: "Response stopped. Any research received is still available.",
    exhausted: "Research reached its response limit. The answer may be incomplete.",
    failed: "Research could not be completed. Your question is still in this conversation.",
    partial: "This response may be incomplete. Any research received is still available.",
    unknown: "Completion could not be confirmed. Your question is still in this conversation.",
    completed: "",
    clarification: ""
  }
  const outcomeNotice = outcomeNotices[lastOutcome?.status ?? "unknown"]
  const composer = useRef<ComposerHandle>(null)
  const isExportCommand = composerDraftText(draft).trim() === "/export"
  const submissionBlockedReason = composerSubmissionBlockedReason({
    draft,
    references,
    isAvailable: isAvailable || isExportCommand,
    isRunning: isRunning && !isExportCommand,
    isRestoring: isRestoringConversation,
    isConfirmingClarification: isConfirmingClarification && !isExportCommand
  })

  function handleSend() {
    if (isExportCommand) {
      if (!hasSession || chat.messages.length === 0) {
        setExportStatus("Start a conversation before exporting.")
        return
      }
      if (isRestoringConversation) {
        return
      }
      try {
        const afterMessageId = visibleMessages.at(-1)?.id
        if (!afterMessageId) {
          setExportStatus("Start a conversation before exporting.")
          return
        }
        const json = JSON.stringify(
          createConversationExport({
            conversationId: chat.id,
            messages: chat.messages,
            status: chat.status,
            interruptedMessageId,
            replayId: getReplay()?.getReplayId(),
            clarificationAnswers
          }),
          null,
          2
        )
        setExportTurns((turns) => [...turns, { id: crypto.randomUUID(), afterMessageId, json }])
        setExportStatus(undefined)
        setDraft([])
      } catch (error) {
        captureException(error, { tags: { operation: "conversation_export", sessionId: chat.id } })
        setExportStatus("The conversation could not be exported. Try again.")
      }
      composer.current?.focus()
      return
    }
    setExportStatus(undefined)
    if (submissionBlockedReason !== undefined) {
      diagnosticBreadcrumb("composer.submit_blocked", { reason: submissionBlockedReason, origin: "browser" })
      return
    }
    if (!hasSession) {
      diagnosticBreadcrumb("composer.submit_blocked", { reason: "session_mismatch", origin: "browser" })
      return
    }
    void sendMessage({
      text: composerDraftText(draft),
      metadata: composerMessageMetadata(draft, references)
    })
    setDraft([])
    composer.current?.focus()
  }

  function handleStop() {
    markInterrupted()
    cancelClarification()
    void stop()
    composer.current?.focus()
  }

  const connectionStatus = exportStatus ?? (isAvailable ? undefined : "Research is not connected yet.")

  const availableReferences = new Map<string, StagedReference>()
  for (const message of messages) {
    for (const part of message.parts) {
      if (
        part.type !== "dynamic-tool" ||
        part.state !== "output-available" ||
        !part.output ||
        typeof part.output !== "object" ||
        !("resultSet" in part.output)
      ) {
        continue
      }
      const result = entityPageSchema.safeParse(part.output.resultSet)
      if (result.success) {
        for (const record of result.data.items) {
          availableReferences.set(`${record.kind}:${record.id}`, {
            resultId: result.data.id,
            recordId: record.id,
            record
          })
        }
      }
    }
  }
  const referenceProps = {
    references,
    onReferenceRequested: () => setReferencePickerOpen(true),
    searchMentions: (query: string, signal: AbortSignal) => searchReferences(query, "mention", signal),
    onRemoveReference: (recordId: string) =>
      setReferences(references.filter((reference) => reference.recordId !== recordId))
  }
  return (
    <AppShell isResearch className={cn(styles.layout, selectedCitation && styles.withEvidence)}>
      <Conversation aria-label="Conversation" aria-live="off" className="min-h-0" initial="instant" resize="instant">
        <ConversationContent className={styles.content} scrollClassName={styles.scroll}>
          <main className={styles.body}>
            {isRestoringConversation && (
              <output className="text-sm text-muted-foreground">Restoring conversation...</output>
            )}
            {!hasSession && !isRestoringConversation && (
              <section className="space-y-4">
                <h1 className="font-display text-2xl">This conversation is no longer available</h1>
                <p className="text-sm text-muted-foreground">
                  Conversations last for this visit. Start a new conversation to continue.
                </p>
                <Button asChild variant="outline">
                  <Link href="/">New conversation</Link>
                </Button>
              </section>
            )}
            {hasSession && (
              <>
                {visibleMessages.map((message) => (
                  <Fragment key={message.id}>
                    {message.role === "assistant" ? (
                      <ConversationResponse
                        message={message}
                        isLatest={message.id === messages.at(-1)?.id}
                        isRunning={isRunning && message.id === messages.at(-1)?.id}
                        isIncomplete={
                          !(isRunning && message.id === messages.at(-1)?.id) &&
                          responseIsIncomplete(messageResponseOutcome(message))
                        }
                        onEvidence={handleEvidence}
                      />
                    ) : (
                      <article
                        tabIndex={-1}
                        aria-label={message.role === "user" ? "Your question" : "Rostra response"}
                        className={responseStyles.questionTurn}
                      >
                        <div className={responseStyles.questionHead}>
                          <h2 className={responseStyles.questionAuthor}>
                            {message.role === "user" ? "You" : "Rostra"}
                          </h2>
                        </div>
                        <div className={responseStyles.questionBubble}>
                          <MessageReferences message={message} />
                          <MessageQuestion message={message} />
                        </div>
                        <MessageActions message={message} />
                      </article>
                    )}
                    {exportTurns
                      .filter((turn) => turn.afterMessageId === message.id)
                      .map((turn) => (
                        <ConversationExport key={turn.id} json={turn.json} />
                      ))}
                  </Fragment>
                ))}
                {isRunning && messages.at(-1)?.role !== "assistant" && (
                  <output className={responseStyles.working}>
                    <LoaderCircle className={responseStyles.spinner} aria-hidden="true" />
                    Preparing research...
                  </output>
                )}
                {hasIncompleteResponse && (
                  <div role="alert" className="space-y-3 text-sm">
                    <p>{outcomeNotice}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void regenerate()
                      }}
                    >
                      <RotateCcw aria-hidden="true" />
                      Try again
                    </Button>
                  </div>
                )}
              </>
            )}
          </main>
        </ConversationContent>
        {hasSession && (
          <ConversationScrollButton
            className={styles.jumpToLatest}
            messageIds={[...visibleMessages.map((message) => message.id), ...exportTurns.map((turn) => turn.id)]}
          />
        )}
      </Conversation>
      {hasSession && (
        <div className={styles.composerDock}>
          <div className="mx-auto w-full max-w-[660px]">
            <ChatComposer
              {...referenceProps}
              draft={draft}
              onDraftChange={setDraft}
              composerRef={composer}
              onSend={handleSend}
              submissionBlockedReason={submissionBlockedReason}
              isRunning={isRestoringConversation || (isBusy && !isExportCommand)}
              messageHistory={messageHistory}
              onStop={handleStop}
              status={connectionStatus}
            />
            {hasReloadRecoveryError && (
              <output className="mt-2 block text-xs text-destructive">
                Reload recovery is unavailable in this tab. Keep this page open to preserve your conversation.
              </output>
            )}
          </div>
        </div>
      )}
      <EvidencePanel
        selection={selectedCitation}
        onClose={() => setSelectedCitation(undefined)}
        returnFocus={() => evidenceTrigger.current?.focus()}
      />
      {isReferencePickerOpen && (
        <ReferencePicker
          draft={draft}
          initial={references}
          available={[...availableReferences.values()]}
          mention={false}
          onClose={() => {
            setReferencePickerOpen(false)
          }}
          onApply={(next) => {
            setReferences(next)
            setReferencePickerOpen(false)
          }}
          returnFocus={() => composer.current?.focus({ preventScroll: true })}
        />
      )}
    </AppShell>
  )
}
