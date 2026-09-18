"use client"

import type { UIMessage } from "ai"
import { ChevronDown, ChevronRight, ExternalLink, LoaderCircle } from "lucide-react"
import Image from "next/image"
import { createContext, useContext, useState, type ComponentProps } from "react"
import { z } from "zod"
import { MessageResponse } from "../../../components/ai-elements/message"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import { clarificationRequestSchema } from "../clarification"
import { presentationCitation, presentationEvidence } from "../composition"
import { entityPageSchema } from "../entityResults"
import {
  evidenceSnapshotSchema,
  evidenceSourceUrl,
  humanReadableUrl,
  researchContextSchema,
  type EvidenceSnapshot
} from "../evidence"
import { createCitationPresentation, type CitationSelection } from "./citationPresentation"
import { ClarificationQuestion, ClarificationReceiptStatus } from "./ClarificationQuestion"
import { ComposedRecord } from "./ComposedRecord"
import { useConversationSession } from "./ConversationSession"
import { InlineRecordLink, responseRecordMentions } from "./InlineRecordLink"
import { MessageActions } from "./MessageActions"
import { answerReferenceDefinitions, orderedAnswerParts } from "./orderedAnswer"
import { OrderedAnswerContent } from "./OrderedAnswerContent"
import { ResearchActivity } from "./ResearchActivity"
import * as styles from "./ConversationResponse.css"

const evidenceOutputSchema = z.object({ evidence: z.array(evidenceSnapshotSchema).max(40) })
const resultWarningsSchema = z.object({ resultSet: entityPageSchema.pick({ warnings: true }) })
type CitationContext = Readonly<{
  presentation: ReturnType<typeof createCitationPresentation>
  recordMentions: ReturnType<typeof responseRecordMentions>
  isRunning: boolean
  onEvidence: (selection: CitationSelection) => void
}>
const EvidenceContext = createContext<CitationContext | undefined>(undefined)
type ConversationResponseProps = Readonly<{
  message: UIMessage
  isRunning: boolean
  isIncomplete: boolean
  isLatest?: boolean
  evidence?: EvidenceSnapshot[]
  onEvidence: (selection: CitationSelection) => void
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
    if (part.type === "data-research-context") {
      const context = researchContextSchema.safeParse(part.data)
      if (context.success) {
        for (const source of context.data.evidence) {
          found.set(source.id, source)
        }
      }
    }
    if (part.type === "data-presentation") {
      const source = presentationEvidence(part.data)
      if (source) {
        found.set(source.id, source)
      }
    }
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
  if (href?.startsWith("#record-")) {
    const mention = context?.recordMentions.get(href)
    return mention ? <InlineRecordLink mention={mention}>{children}</InlineRecordLink> : <span>{children}</span>
  }
  const citation = context?.presentation.resolveCitation(href)
  if (context && citation) {
    const url = evidenceSourceUrl(citation.evidence)
    const button = (
      <button
        type="button"
        className={styles.citation}
        aria-label={`Read source ${citation.number}: ${citation.evidence.title}`}
        onClick={() => context.onEvidence(citation)}
      >
        {citation.number}
      </button>
    )
    if (!url) {
      return button
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent className="max-w-[min(32rem,calc(100vw-2rem))] break-all">{url}</TooltipContent>
      </Tooltip>
    )
  }
  if (href?.startsWith("#citation-")) {
    const reference = context?.presentation.resolveReference(href)
    if (!reference) {
      return null
    }
    const label = context?.isRunning
      ? `Citation ${reference.number} pending`
      : `Citation ${reference.number} unavailable`
    const explanation = context?.isRunning
      ? "This citation has not matched a retrieved source yet."
      : "This citation does not match a retrieved source."
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={styles.unresolvedCitation} aria-label={label} aria-disabled="true">
            {reference.number}
          </button>
        </TooltipTrigger>
        <TooltipContent>{explanation}</TooltipContent>
      </Tooltip>
    )
  }
  const destination = humanReadableUrl(href)
  if (!destination) {
    return <span>{children}</span>
  }
  return (
    <a href={destination} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
      {children}
      <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
    </a>
  )
}

function OmittedImage() {
  return null
}

const markdownComponents = { a: CitationLink, img: OmittedImage }

function responsePresentation(
  message: UIMessage,
  suppliedEvidence: EvidenceSnapshot[] | undefined,
  previousNumbers?: ReadonlyMap<string, number>
) {
  const text = orderedAnswerParts(message.parts)
    .map((part) => {
      if (part.type === "text") {
        return part.text
      }
      if (part.part.type !== "data-presentation") {
        return ""
      }
      const href = presentationCitation(part.part.data)
      return href ? `[source](${href})` : ""
    })
    .join("\n\n")
  return {
    message,
    suppliedEvidence,
    text,
    presentation: createCitationPresentation(
      message.id,
      text,
      [
        ...(suppliedEvidence ?? responseEvidence(message)),
        ...message.parts.flatMap((part) => {
          const source = part.type === "data-presentation" ? presentationEvidence(part.data) : undefined
          return source ? [source] : []
        })
      ],
      previousNumbers
    ),
    referenceDefinitions: answerReferenceDefinitions(text),
    recordMentions: responseRecordMentions(message)
  }
}

export function ConversationResponse({
  message,
  isRunning,
  isIncomplete,
  isLatest = false,
  evidence: suppliedEvidence,
  onEvidence
}: ConversationResponseProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [areSourcesExpanded, setAreSourcesExpanded] = useState(false)
  const { answerClarification, clarificationAnswers } = useConversationSession()
  const clarification = responseClarification(message)
  const acceptedResponse = clarification && clarificationAnswers[clarification.id]
  const steps = message.parts
    .filter((part) => part.type === "dynamic-tool")
    .filter(
      (part) => part.toolName !== "ask_clarification" || part.state === "output-error" || part.state === "output-denied"
    )
  const [answer, setAnswer] = useState(() => responsePresentation(message, suppliedEvidence))
  if (answer.message !== message || answer.suppliedEvidence !== suppliedEvidence) {
    setAnswer(
      responsePresentation(
        message,
        suppliedEvidence,
        answer.message.id === message.id ? answer.presentation.numbers : undefined
      )
    )
  }
  const { text, presentation, referenceDefinitions, recordMentions } = answer
  const number = new Intl.NumberFormat()
  const answerParts = orderedAnswerParts(message.parts)
  const resultWarnings = [
    ...new Set(
      message.parts.flatMap((part) => {
        if (part.type !== "dynamic-tool" || part.state !== "output-available") {
          return []
        }
        const parsed = resultWarningsSchema.safeParse(part.output)
        return parsed.success ? parsed.data.resultSet.warnings.map((warning) => warning.trim()).filter(Boolean) : []
      })
    )
  ]

  return (
    <article
      aria-label="Rostra response"
      tabIndex={-1}
      className={`${styles.answerTurn} ${acceptedResponse ? styles.receiptTurn : ""}`}
    >
      <div className={styles.answerHead}>
        <Image src="/logo.png" alt="" width={15} height={15} className={styles.answerMark} />
        <h2 className={styles.answerAuthor}>Rostra</h2>
        {acceptedResponse && <ClarificationReceiptStatus response={acceptedResponse} />}
        {isIncomplete && <span className="text-xs text-muted-foreground">Incomplete response</span>}
      </div>
      {steps.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className={styles.activityTrigger}>
            <ChevronRight
              className={`size-4 shrink-0 text-subtle ${isExpanded ? "rotate-90" : ""}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">Research activity</span>
            <span className={styles.activityCount}>
              {number.format(steps.length)} {steps.length === 1 ? "step" : "steps"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className={styles.activityItems}>
            {steps.map((part) => (
              <ResearchActivity
                key={part.toolCallId}
                part={part}
                isRunning={isRunning}
                previousParts={message.parts.slice(0, message.parts.indexOf(part))}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
      <EvidenceContext value={{ presentation, recordMentions, isRunning, onEvidence }}>
        <OrderedAnswerContent
          key={message.id}
          parts={answerParts}
          isRunning={isRunning}
          renderPart={(part, animate) => {
            const key = `${message.id}:${part.key}`
            if (part.type === "presentation") {
              const href = part.part.type === "data-presentation" ? presentationCitation(part.part.data) : undefined
              return (
                <ComposedRecord
                  key={key}
                  part={part.part}
                  isRunning={isRunning}
                  answerId={message.id}
                  citation={href ? presentation.resolveCitation(href) : undefined}
                  onEvidence={onEvidence}
                />
              )
            }
            if (!part.text) {
              return null
            }
            return (
              <MessageResponse
                key={key}
                className={styles.markdown}
                mode={isRunning ? "streaming" : "static"}
                isAnimating={isRunning}
                animated={animate}
                controls={false}
                skipHtml
                components={markdownComponents}
              >
                {presentation.formatCitationGroups(
                  referenceDefinitions ? `${referenceDefinitions}\n\n${part.text}` : part.text
                )}
              </MessageResponse>
            )
          }}
        >
          {clarification && !isRunning && (
            <ClarificationQuestion
              request={{
                ...clarification,
                state:
                  clarification.state === "pending" && (!isLatest || isIncomplete) ? "superseded" : clarification.state
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
          {isRunning && !clarification && !text && (
            <output className={styles.working}>
              <LoaderCircle className={styles.spinner} aria-hidden="true" />
              Researching...
            </output>
          )}
          {resultWarnings.map((warning) => (
            <p key={warning} className="break-words text-xs text-muted-foreground">
              {warning}
            </p>
          ))}
          {presentation.references.length > 0 && (
            <section aria-label="Sources" className="space-y-2">
              <Collapsible open={areSourcesExpanded} onOpenChange={setAreSourcesExpanded}>
                <h3>
                  <CollapsibleTrigger className={styles.sourcesTrigger}>
                    <span>Sources</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {number.format(presentation.references.length)}
                    </span>
                    <ChevronDown
                      className={`ml-auto size-4 shrink-0 ${areSourcesExpanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                </h3>
                <CollapsibleContent>
                  {presentation.references.map((citation) => {
                    const source = citation.evidence
                    if (!source) {
                      return (
                        <div
                          key={citation.referenceId}
                          className={styles.unavailableSource}
                          role="note"
                          aria-label={
                            isRunning ? `Source ${citation.number} pending` : `Source ${citation.number} unavailable`
                          }
                        >
                          <span className={styles.unavailableSourceNumber} aria-hidden="true">
                            {citation.number}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {isRunning ? "Source pending" : "Source unavailable"}
                          </span>
                        </div>
                      )
                    }
                    const url = evidenceSourceUrl(source)
                    return (
                      <button
                        key={source.id}
                        type="button"
                        className={styles.source}
                        aria-label={`Read source ${citation.number}: ${source.title}`}
                        onClick={() =>
                          onEvidence({ answerId: citation.answerId, number: citation.number, evidence: source })
                        }
                      >
                        <span className={styles.sourceNumber} aria-hidden="true">
                          {citation.number}
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          <span className="block font-medium">{source.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {url ? new URL(url).hostname : "Source unavailable"}
                          </span>
                          {source.versionLabel && (
                            <span className="block text-xs text-muted-foreground">{source.versionLabel}</span>
                          )}
                          {source.locator && (
                            <span className="block text-xs text-muted-foreground">{source.locator}</span>
                          )}
                        </span>
                        <ExternalLink className="mt-1 size-4 shrink-0" aria-hidden="true" />
                      </button>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            </section>
          )}
          <MessageActions message={message} isRunning={isRunning} />
        </OrderedAnswerContent>
      </EvidenceContext>
    </article>
  )
}
