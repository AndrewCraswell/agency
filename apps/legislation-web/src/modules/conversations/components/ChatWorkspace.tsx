"use client"

import { useChat } from "@ai-sdk/react"
import { RotateCcw } from "lucide-react"
import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, useRef, useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from "../../../components/ai-elements/conversation"
import { AppShell } from "../../../components/shell/AppShell"
import { Button } from "../../../components/ui/button"
import { cn } from "../../../components/ui/utils"
import type { StagedReference } from "../chatRequest"
import { isClarificationSubmission } from "../chatRequest"
import {
  composerDraftText,
  composerMessageMetadata,
  composerReferences,
  messageComposerDraft,
  textDraft
} from "../composerDraft"
import { entityPageSchema } from "../entityResults"
import type { ResearchSuggestion } from "../suggestions"
import { ChatComposer } from "./ChatComposer"
import type { CitationSelection } from "./citationPresentation"
import type { ComposerHandle } from "./ComposerInput"
import { ConversationResponse } from "./ConversationResponse"
import { useConversationSession } from "./ConversationSession"
import { EvidencePanel } from "./EvidencePanel"
import { MessageActions } from "./MessageActions"
import { MessageQuestion, MessageReferences } from "./MessageReferences"
import { ReferencePicker } from "./ReferencePicker"
import { ResearchSuggestions, ResearchSuggestionsLoading } from "./ResearchSuggestions"
import * as styles from "./ChatWorkspace.css"
import * as responseStyles from "./ConversationResponse.css"

type ChatWorkspaceProps = Readonly<{
  isAvailable?: boolean
  conversationId?: string
  suggestions?: Promise<ResearchSuggestion[]>
}>

export function ChatWorkspace({ isAvailable = false, conversationId, suggestions }: ChatWorkspaceProps) {
  const router = useRouter()
  const {
    chat,
    startConversation,
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
    markInterrupted
  } = useConversationSession()
  const isConversation = conversationId !== undefined
  const hasSession = conversationId === chat.id
  const [wasStopped, setWasStopped] = useState(false)
  const [isReferencePickerOpen, setReferencePickerOpen] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState<CitationSelection>()
  const evidenceTrigger = useRef<HTMLElement | null>(null)
  function handleEvidence(selection: CitationSelection) {
    evidenceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedCitation(selection)
  }
  const { messages, sendMessage, status, stop, regenerate } = useChat({ chat, throttle: 50 })
  const isRunning = status === "submitted" || status === "streaming"
  const isBusy = isRunning || isConfirmingClarification || isRestoringConversation
  const lastMessage = messages.at(-1)
  const messageHistory = messages
    .filter((message) => message.role === "user" && !isClarificationSubmission(message))
    .map(messageComposerDraft)
    .filter((previous) => composerDraftText(previous).trim().length > 0)
  const hasInterruptedResponse = interruptedMessageId !== undefined && interruptedMessageId === lastMessage?.id
  const composer = useRef<ComposerHandle>(null)
  const isNavigating = useRef(false)

  function handleSend() {
    if (
      !isAvailable ||
      isBusy ||
      !composerDraftText(draft).trim() ||
      composerReferences(draft, references).length > 12 ||
      isNavigating.current
    ) {
      return
    }
    if (!isConversation) {
      isNavigating.current = true
      const id = startConversation(draft)
      router.push(`/conversations/${encodeURIComponent(id)}`)
      return
    }
    if (!hasSession) {
      return
    }
    setWasStopped(false)
    void sendMessage({
      text: composerDraftText(draft),
      metadata: composerMessageMetadata(draft, references)
    })
    setDraft([])
    composer.current?.focus()
  }

  function handleStop() {
    setWasStopped(true)
    markInterrupted()
    cancelClarification()
    void stop()
    composer.current?.focus()
  }

  const connectionStatus = isAvailable ? undefined : "Research is not connected yet."

  function handleSuggestion(question: string) {
    setDraft(textDraft(question))
    composer.current?.focus()
  }

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
    <AppShell demo className={cn(styles.layout, selectedCitation && styles.withEvidence)}>
      <Conversation aria-label="Conversation" aria-live="off" className="min-h-0" initial="instant" resize="instant">
        <ConversationContent
          className={cn(styles.content, isConversation && styles.threadContent)}
          scrollClassName={styles.scroll}
        >
          <main className={cn(styles.start, isConversation && styles.threadBody)}>
            {!isConversation && (
              <>
                <div className={styles.heading}>
                  <h1 className={styles.title}>
                    <span className={styles.headlineWide}>
                      Know what lawmakers are proposing. And what it means for you.
                    </span>
                    <span className={styles.headlineNarrow}>Know what lawmakers are proposing.</span>
                  </h1>
                  <p className={styles.mobileDescription}>
                    Turn a policy question into a clearer picture of the proposals, people, and decisions behind it.
                  </p>
                </div>
                <ChatComposer
                  {...referenceProps}
                  draft={draft}
                  onDraftChange={setDraft}
                  composerRef={composer}
                  onSend={handleSend}
                  hasHomepageGlow
                  isAvailable={isAvailable && !isBusy}
                  status={connectionStatus}
                />
                {suggestions && (
                  <Suspense fallback={<ResearchSuggestionsLoading />}>
                    <ResearchSuggestions suggestions={suggestions} onSelect={handleSuggestion} />
                  </Suspense>
                )}
                <p className={styles.dataNote}>
                  Ask in your own words. Rostra brings together bill text, votes, and hearing records so you can compare
                  proposals and check the sources. Coverage varies by jurisdiction and date.
                </p>
              </>
            )}
            {isConversation && isRestoringConversation && (
              <output className="text-sm text-muted-foreground">Restoring conversation...</output>
            )}
            {isConversation && !hasSession && !isRestoringConversation && (
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
            {isConversation && hasSession && (
              <>
                {messages
                  .filter((message) => !isClarificationSubmission(message))
                  .map((message) =>
                    message.role === "assistant" ? (
                      <ConversationResponse
                        key={message.id}
                        message={message}
                        isLatest={message.id === messages.at(-1)?.id}
                        isRunning={isRunning && message.id === messages.at(-1)?.id}
                        isIncomplete={
                          message.id === interruptedMessageId ||
                          ((wasStopped || status === "error") && message.id === messages.at(-1)?.id)
                        }
                        onEvidence={handleEvidence}
                      />
                    ) : (
                      <article
                        key={message.id}
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
                    )
                  )}
                {isRunning && messages.at(-1)?.role !== "assistant" && (
                  <output className={responseStyles.working}>
                    <LoaderCircle className={responseStyles.spinner} aria-hidden="true" />
                    Preparing research...
                  </output>
                )}
                {(status === "error" || (hasInterruptedResponse && !isRunning)) && (
                  <div role="alert" className="space-y-3 text-sm">
                    <p>The response was interrupted. Your question is still in this conversation.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setWasStopped(false)
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
        {isConversation && hasSession && (
          <ConversationScrollButton
            className={styles.jumpToLatest}
            messageIds={messages.filter((message) => !isClarificationSubmission(message)).map((message) => message.id)}
          />
        )}
      </Conversation>
      {isConversation && hasSession && (
        <div className={styles.composerDock}>
          <div className="mx-auto w-full max-w-[660px]">
            <ChatComposer
              {...referenceProps}
              draft={draft}
              onDraftChange={setDraft}
              composerRef={composer}
              onSend={handleSend}
              isAvailable={isAvailable}
              isRunning={isBusy}
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
