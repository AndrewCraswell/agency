"use client"

import { useChat } from "@ai-sdk/react"
import { ChevronDown } from "lucide-react"
import { useRouter } from "next/navigation"
import { Suspense, use, useRef, useState, type MouseEvent, type ReactNode } from "react"
import { AppShell } from "../../../components/shell/AppShell"
import { Button } from "../../../components/ui/button"
import { Skeleton } from "../../../components/ui/skeleton"
import { MAX_CONVERSATION_REFERENCES, type StagedReference } from "../../conversations/chatRequest"
import { ChatComposer } from "../../conversations/components/ChatComposer"
import type { ComposerHandle } from "../../conversations/components/ComposerInput"
import { useConversationSession } from "../../conversations/components/ConversationSession"
import { ReferencePicker } from "../../conversations/components/ReferencePicker"
import { composerReferences, textDraft } from "../../conversations/composerDraft"
import type { ComposerDraft } from "../../conversations/composerDraft"
import { composerSubmissionBlockedReason } from "../../conversations/composerPolicy"
import type { ResearchSuggestion } from "../../conversations/suggestions"
import { HomepageConnections } from "./HomepageConnections"
import { HomepageProof } from "./HomepageProof"
import * as styles from "./HomepageLanding.css"

const questionRows = [
  [0, 1],
  [1, 3],
  [3, 5],
  [5, 6]
] as const

function FreshSuggestions({
  suggestions,
  onSelect
}: Readonly<{ suggestions: Promise<ResearchSuggestion[]>; onSelect: (text: string) => void }>) {
  const questions = use(suggestions)
  if (questions.length === 0) {
    return null
  }
  return (
    <div className={styles.questions} aria-label="Suggested research questions">
      {questionRows.map(([start, end]) => (
        <div key={start} className={styles.questionRow}>
          {questions.slice(start, end).map((question) => (
            <Button
              key={question.text}
              variant="outline"
              className={styles.question}
              onClick={() => onSelect(question.text)}
            >
              {question.text}
            </Button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function HomepageLanding({
  isAvailable = false,
  suggestions,
  children
}: Readonly<{ isAvailable?: boolean; suggestions?: Promise<ResearchSuggestion[]>; children?: ReactNode }>) {
  const router = useRouter()
  const session = useConversationSession()
  const { status } = useChat({ chat: session.chat, throttle: 50 })
  const composer = useRef<ComposerHandle>(null)
  const isNavigating = useRef(false)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const submissionBlockedReason = composerSubmissionBlockedReason({
    draft: session.draft,
    references: session.references,
    isAvailable,
    isRunning: status === "submitted" || status === "streaming",
    isRestoring: session.isRestoringConversation,
    isConfirmingClarification: session.isConfirmingClarification
  })

  function send() {
    if (submissionBlockedReason !== undefined || isNavigating.current) {
      return
    }
    isNavigating.current = true
    const id = session.startConversation(session.draft)
    router.push(`/conversations/${encodeURIComponent(id)}`)
  }

  function selectQuestion(question: string) {
    session.setDraft(textDraft(question))
    composer.current?.focus({ preventScroll: true })
  }

  function showAnswer(event: MouseEvent<HTMLAnchorElement>) {
    const section = document.getElementById("example-answer")
    if (!section || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return
    }
    event.preventDefault()
    section.focus({ preventScroll: true })
    section.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start"
    })
  }

  function addMentions(references: StagedReference[]) {
    const existing = composerReferences(session.draft, session.references)
    const draft: ComposerDraft = [...session.draft]
    for (const reference of references) {
      if (existing.length >= MAX_CONVERSATION_REFERENCES) {
        break
      }
      if (existing.some((item) => item.recordId === reference.recordId && item.record.kind === reference.record.kind)) {
        continue
      }
      if (draft.length > 0) {
        draft.push({ type: "text", text: " " })
      }
      draft.push({ type: "mention", reference }, { type: "text", text: " " })
      existing.push(reference)
    }
    session.setDraft(draft)
    composer.current?.focus()
  }

  return (
    <AppShell isResearch className={styles.page}>
      <a href="#research" className={styles.skip}>
        Skip to research
      </a>
      <main>
        <section id="research" aria-labelledby="homepage-title" className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heading}>
              <h1 id="homepage-title" className={styles.title}>
                Research legislation. Read the source.
              </h1>
              <p className={styles.description}>
                Find out what a bill proposes, how its wording changed, or how lawmakers voted. Follow the citations to
                the source text.
              </p>
            </div>
            <div className={styles.composer}>
              <ChatComposer
                draft={session.draft}
                onDraftChange={session.setDraft}
                onSend={send}
                submissionBlockedReason={submissionBlockedReason}
                hasHomepageGlow
                composerRef={composer}
                references={session.references}
                onRemoveReference={(recordId) =>
                  session.setReferences(session.references.filter((reference) => reference.recordId !== recordId))
                }
                onReferenceRequested={() => setPickerOpen(true)}
                searchMentions={(query, signal) => session.searchReferences(query, "mention", signal)}
              />
            </div>
            {suggestions && (
              <Suspense
                fallback={
                  <output className={styles.questions} aria-label="Loading research questions" aria-busy="true">
                    {questionRows.map(([start, end]) => (
                      <div key={start} className={styles.questionRow}>
                        {Array.from({ length: end - start }, (_, index) => (
                          <Skeleton key={index} className={styles.questionSkeleton} aria-hidden="true" />
                        ))}
                      </div>
                    ))}
                  </output>
                }
              >
                <FreshSuggestions suggestions={suggestions} onSelect={selectQuestion} />
              </Suspense>
            )}
          </div>
          <a href="#example-answer" className={styles.handoff} onClick={showAnswer}>
            <span>See what an answer looks like</span>
            <ChevronDown className={styles.handoffArrow} aria-hidden="true" size={18} />
          </a>
        </section>
        <HomepageProof />
        <HomepageConnections isAvailable={isAvailable} onMention={addMentions} />
        {children}
      </main>
      {isPickerOpen && (
        <ReferencePicker
          draft={session.draft}
          initial={session.references}
          available={[]}
          mention={false}
          onApply={(references) => {
            session.setReferences(references)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
          returnFocus={() => composer.current?.focus()}
        />
      )}
    </AppShell>
  )
}
