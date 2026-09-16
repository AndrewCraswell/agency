"use client"

import { useReducedMotion } from "@mantine/hooks"
import type { UIMessage } from "ai"
import { ChevronDown, ChevronRight, ExternalLink, LoaderCircle } from "lucide-react"
import Image from "next/image"
import { createContext, useContext, useState, type ComponentProps } from "react"
import { z } from "zod"
import { MessageResponse } from "../../../components/ai-elements/message"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"
import { clarificationRequestSchema } from "../clarification"
import { entityPageSchema } from "../entityResults"
import { evidenceSnapshotSchema, sourceUrlSchema, type EvidenceSnapshot } from "../evidence"
import { ClarificationQuestion, ClarificationReceiptStatus } from "./ClarificationQuestion"
import { useConversationSession } from "./ConversationSession"
import { EntityResults } from "./EntityResults"
import { MessageActions } from "./MessageActions"
import { ResearchActivity } from "./ResearchActivity"
import * as styles from "./ConversationResponse.css"

const evidenceOutputSchema = z.object({ evidence: z.array(evidenceSnapshotSchema).max(40) })
type CitationContext = Readonly<{ evidence: EvidenceSnapshot[]; onEvidence: (evidence: EvidenceSnapshot) => void }>
const EvidenceContext = createContext<CitationContext | undefined>(undefined)
type ConversationResponseProps = CitationContext &
  Readonly<{
    message: UIMessage
    isRunning: boolean
    isIncomplete: boolean
    isLatest?: boolean
  }>

export function responseClarification(message: UIMessage) {
  for (const part of message.parts) {
    if (part.type === "dynamic-tool" && part.toolName === "ask_clarification" && part.state === "output-available") {
      const parsed = z.object({ clarification: clarificationRequestSchema }).safeParse(part.output)
      if (parsed.success) {
        return parsed.data.clarification
      }
    }
  }
  return undefined
}

export function responseEvidence(message: UIMessage): EvidenceSnapshot[] {
  const found = new Map<string, EvidenceSnapshot>()
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") {
      continue
    }
    const parsed = evidenceOutputSchema.safeParse(part.output)
    if (parsed.success) {
      for (const evidence of parsed.data.evidence) {
        found.set(evidence.id, evidence)
      }
    }
  }
  return [...found.values()]
}

function CitationLink({ href, children }: ComponentProps<"a">) {
  const context = useContext(EvidenceContext)
  const source = context?.evidence.find((item) => href === `#citation-${item.id}` || href === item.sourceUrl)
  if (source) {
    return (
      <button
        type="button"
        className={styles.citation}
        aria-label={`Read source: ${source.title}`}
        onClick={() => context?.onEvidence(source)}
      >
        {children}
      </button>
    )
  }
  const safeUrl = sourceUrlSchema.safeParse(href)
  if (!safeUrl.success) {
    return <span>{children}</span>
  }
  return (
    <a href={safeUrl.data} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
      {children}
      <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
    </a>
  )
}

function OmittedImage() {
  return null
}

const markdownComponents = { a: CitationLink, img: OmittedImage }

export function ConversationResponse({
  message,
  isRunning,
  isIncomplete,
  isLatest = false,
  evidence,
  onEvidence
}: ConversationResponseProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [areSourcesExpanded, setAreSourcesExpanded] = useState(false)
  const { answerClarification, clarificationAnswers } = useConversationSession()
  const clarification = responseClarification(message)
  const acceptedResponse = clarification && clarificationAnswers[clarification.id]
  const isReducedMotion = useReducedMotion()
  const steps = message.parts
    .filter((part) => part.type === "dynamic-tool")
    .filter(
      (part) => part.toolName !== "ask_clarification" || part.state === "output-error" || part.state === "output-denied"
    )
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
  const failed = steps.filter((part) => part.state === "output-error" || part.state === "output-denied").length
  const activitySteps = steps.filter((part) => part.state !== "output-error" && part.state !== "output-denied")
  const number = new Intl.NumberFormat()
  const resultPages = message.parts.flatMap((part) => {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") {
      return []
    }
    const parsed = z.object({ resultSet: entityPageSchema }).safeParse(part.output)
    return parsed.success ? [parsed.data.resultSet] : []
  })

  return (
    <article
      aria-label="Rostra response"
      tabIndex={-1}
      className={`${styles.answerTurn} ${acceptedResponse ? styles.receiptTurn : ""}`}
    >
      <div className={styles.answerHead}>
        <Image src="/ftkLH.png" alt="" width={15} height={15} className={styles.answerMark} />
        <h2 className={styles.answerAuthor}>Rostra</h2>
        {acceptedResponse && <ClarificationReceiptStatus response={acceptedResponse} />}
        {isIncomplete && <span className="text-xs text-muted-foreground">Incomplete response</span>}
      </div>
      {activitySteps.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className={styles.activityTrigger}>
            <ChevronRight
              className={`size-4 shrink-0 text-subtle ${isExpanded ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">Research activity</span>
            <span className={styles.activityCount}>
              {number.format(activitySteps.length)} {activitySteps.length === 1 ? "step" : "steps"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className={styles.activityItems}>
            {activitySteps.map((part) => (
              <ResearchActivity key={part.toolCallId} part={part} isRunning={isRunning} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
      {failed > 0 &&
        steps
          .filter((part) => part.state === "output-error" || part.state === "output-denied")
          .map((part) => <ResearchActivity key={part.toolCallId} part={part} isRunning={isRunning} />)}
      {text && (
        <EvidenceContext value={{ evidence, onEvidence }}>
          <MessageResponse
            className={styles.markdown}
            mode={isRunning ? "streaming" : "static"}
            isAnimating={isRunning}
            animated={!isReducedMotion}
            controls={false}
            skipHtml
            components={markdownComponents}
          >
            {text}
          </MessageResponse>
        </EvidenceContext>
      )}
      {clarification && !isRunning && (
        <ClarificationQuestion
          request={{
            ...clarification,
            state: clarification.state === "pending" && (!isLatest || isIncomplete) ? "superseded" : clarification.state
          }}
          acceptedResponse={acceptedResponse}
          hasAuthorHeader
          onAnswer={async (response) => {
            const labels =
              clarification.input.kind !== "text" && response.status === "answered"
                ? clarification.input.options
                    .filter((option) => response.selectedIds.includes(option.id))
                    .map((option) => option.label)
                : []
            const text =
              response.status === "skipped"
                ? "Skip this clarification."
                : [...labels, response.text].filter(Boolean).join("\n")
            await answerClarification(response, text)
          }}
        />
      )}
      {isRunning && !clarification && (
        <output className={styles.working}>
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
          {text ? "Writing response..." : "Researching..."}
        </output>
      )}
      {resultPages.map((page) => (
        <EntityResults key={page.id} initialPage={page} answerId={message.id} />
      ))}
      {evidence.length > 0 && (
        <section aria-label="Retrieved sources" className="space-y-2">
          <Collapsible open={areSourcesExpanded} onOpenChange={setAreSourcesExpanded}>
            <h3>
              <CollapsibleTrigger className={styles.sourcesTrigger}>
                <span>Retrieved sources</span>
                <span className="font-mono text-xs text-muted-foreground">{number.format(evidence.length)}</span>
                <ChevronDown
                  className={`ml-auto size-4 shrink-0 ${areSourcesExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
            </h3>
            <CollapsibleContent>
              {evidence.map((source) => (
                <button key={source.id} type="button" className={styles.source} onClick={() => onEvidence(source)}>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="block font-medium">{source.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {source.sourceUrl ? new URL(source.sourceUrl).hostname : "Source unavailable"}
                    </span>
                    {source.versionLabel && (
                      <span className="block text-xs text-muted-foreground">{source.versionLabel}</span>
                    )}
                    {source.locator && <span className="block text-xs text-muted-foreground">{source.locator}</span>}
                  </span>
                  <ExternalLink className="mt-1 size-4 shrink-0" aria-hidden="true" />
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        </section>
      )}
      <MessageActions message={message} isRunning={isRunning} />
    </article>
  )
}
