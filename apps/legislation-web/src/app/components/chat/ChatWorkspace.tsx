"use client"

import { useChat } from "@ai-sdk/react"
import { Activity, ArrowUpRight, Columns2, Gavel, RotateCcw, Users } from "lucide-react"
import { LoaderCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton
} from "../../../components/ai-elements/conversation"
import { Suggestion } from "../../../components/ai-elements/suggestion"
import { referenceMessageMetadata, type StagedReference } from "../../lib/chatRequest"
import { isClarificationSubmission } from "../../lib/chatRequest"
import { entityPageSchema } from "../../lib/entityResults"
import type { EvidenceSnapshot } from "../../lib/evidence"
import { cn } from "../../lib/utils"
import { AppShell } from "../shell/AppShell"
import { Button } from "../ui/button"
import { ChatComposer } from "./ChatComposer"
import { ConversationResponse, responseClarification, responseEvidence } from "./ConversationResponse"
import { useConversationSession } from "./ConversationSession"
import { EvidencePanel } from "./EvidencePanel"
import { MessageActions } from "./MessageActions"
import { MessageReferences } from "./MessageReferences"
import { ReferencePicker } from "./ReferencePicker"
import * as styles from "./ChatWorkspace.css"
import * as responseStyles from "./ConversationResponse.css"

const starters = [
  {
    text: "Who has sponsored bills on AI in education?",
    description: "Sponsors, bill numbers, and the proposals they introduced",
    icon: Users
  },
  {
    text: "What is the latest action on housing affordability bills in Congress?",
    description: "Recorded actions, dates, and committee referrals",
    icon: Activity
  },
  {
    text: "How do federal AI bills differ in their requirements for developers?",
    description: "Requirements compared with the relevant bill text",
    icon: Columns2
  },
  {
    text: "Which committees have held hearings on student data privacy?",
    description: "Committee names, hearing dates, and published materials",
    icon: Gavel
  }
]

type ChatWorkspaceProps = Readonly<{ isAvailable?: boolean; conversationId?: string }>

export function ChatWorkspace({ isAvailable = false, conversationId }: ChatWorkspaceProps) {
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
    isRestoringConversation,
    hasReloadRecoveryError,
    interruptedMessageId,
    markInterrupted
  } = useConversationSession()
  const isConversation = conversationId !== undefined
  const hasSession = conversationId === chat.id
  const [wasStopped, setWasStopped] = useState(false)
  const [referenceMode, setReferenceMode] = useState<"all" | "mention">()
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceSnapshot>()
  const evidenceTrigger = useRef<HTMLElement | null>(null)
  function handleEvidence(evidence: EvidenceSnapshot) {
    evidenceTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedEvidence(evidence)
  }
  const { messages, sendMessage, status, stop, regenerate } = useChat({ chat })
  const isRunning = status === "submitted" || status === "streaming"
  const isBusy = isRunning || isConfirmingClarification || isRestoringConversation
  const lastMessage = messages.at(-1)
  const messageHistory = messages
    .filter((message) => message.role === "user" && !isClarificationSubmission(message))
    .map((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    )
    .filter((text) => text.trim().length > 0)
  const hasInterruptedResponse = interruptedMessageId !== undefined && interruptedMessageId === lastMessage?.id
  const textarea = useRef<HTMLTextAreaElement>(null)
  const isNavigating = useRef(false)

  function handleSend() {
    if (!isAvailable || isBusy || !draft.trim() || isNavigating.current) {
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
      text: draft,
      metadata: referenceMessageMetadata(references)
    })
    setDraft("")
    textarea.current?.focus()
  }

  function handleStop() {
    setWasStopped(true)
    markInterrupted()
    cancelClarification()
    void stop()
    textarea.current?.focus()
  }

  let connectionStatus: string | undefined
  if (!isAvailable) {
    connectionStatus = "Research is not connected yet."
  } else if (isConfirmingClarification) {
    connectionStatus = "Confirming your answer..."
  } else if (status === "submitted") {
    connectionStatus = "Waiting for a response..."
  } else if (status === "streaming") {
    connectionStatus = "Responding..."
  } else if (wasStopped) {
    connectionStatus = "Stopped. The response may be incomplete."
  } else if (lastMessage?.role === "assistant" && responseClarification(lastMessage)?.state === "pending") {
    connectionStatus = "Waiting for your answer."
  }

  function handleSuggestion(question: string) {
    setDraft(question)
    textarea.current?.focus()
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
    onReferenceRequested: () => setReferenceMode("all"),
    onMentionRequested: () => setReferenceMode("mention"),
    onRemoveReference: (recordId: string) =>
      setReferences(references.filter((reference) => reference.recordId !== recordId))
  }
  return (
    <AppShell demo className={cn(styles.layout, selectedEvidence && styles.withEvidence)}>
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
                  textareaRef={textarea}
                  onSend={handleSend}
                  hasHomepageGlow
                  isAvailable={isAvailable && !isBusy}
                  status={connectionStatus}
                />
                <section aria-label="Suggested research questions">
                  <div className="grid gap-2">
                    {starters.map(({ text, description, icon: Icon }, index) => (
                      <Suggestion
                        key={text}
                        suggestion={text}
                        onClick={handleSuggestion}
                        aria-label={text}
                        className={cn(styles.suggestion, index === 3 && styles.suggestionExtra)}
                      >
                        <Icon className="size-[15px] text-primary" aria-hidden="true" />
                        <span className={styles.suggestionCopy}>
                          <span className={styles.suggestionQuestion}>{text}</span>
                          <span className={styles.suggestionDescription}>{description}</span>
                        </span>
                        <ArrowUpRight className="size-3.5 text-subtle" aria-hidden="true" />
                      </Suggestion>
                    ))}
                  </div>
                </section>
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
                        evidence={responseEvidence(message)}
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
                          {message.parts.map((part, index) => {
                            if (part.type !== "text") {
                              return null
                            }
                            return (
                              <p key={`${message.id}-${index}`} className="min-w-0">
                                {part.text}
                              </p>
                            )
                          })}
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
              textareaRef={textarea}
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
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(undefined)}
        returnFocus={() => evidenceTrigger.current?.focus()}
      />
      {referenceMode && (
        <ReferencePicker
          initial={references}
          available={[...availableReferences.values()]}
          mention={referenceMode === "mention"}
          onClose={() => {
            setReferenceMode(undefined)
          }}
          onApply={(next) => {
            setReferences(next)
            setReferenceMode(undefined)
          }}
          returnFocus={() => textarea.current?.focus({ preventScroll: true })}
        />
      )}
    </AppShell>
  )
}
