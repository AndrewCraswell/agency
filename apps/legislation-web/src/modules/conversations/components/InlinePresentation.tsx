"use client"

import { useClipboard } from "@mantine/hooks"
import { Check, CheckCircle2, Copy, ExternalLink, FileQuestion, FileText, Quote } from "lucide-react"
import { useId, useRef, useState } from "react"
import { Button } from "../../../components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../components/ui/tooltip"
import { evidenceSourceUrl, formatEvidenceCitation, humanReadableUrl } from "../evidence"
import type { ContentComponent, PresentationContent } from "../presentationContent"
import { BillProgressCard } from "./BillProgressCard"
import type { CitationSelection } from "./citationPresentation"
import { EntityResults } from "./EntityResults"
import { EvidencePassage } from "./EvidencePassage"
import { VoteDetails } from "./VoteDetails"
import * as compactStyles from "./CompactRecordCard.css"
import * as responseStyles from "./ConversationResponse.css"
import * as styles from "./InlinePresentation.css"

function SourceLink({ url, children }: Readonly<{ url: string; children: string }>) {
  const destination = humanReadableUrl(url)
  if (!destination) {
    return null
  }
  return (
    <Button asChild variant="ghost" size="sm">
      <a href={destination} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink aria-hidden="true" />
      </a>
    </Button>
  )
}

function dateLabel(value: string | null | undefined) {
  if (!value) {
    return "Date not recorded"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date)
}

function QuoteContent({
  content,
  variant,
  citation,
  onEvidence
}: Readonly<{
  content: Extract<PresentationContent, { kind: "evidence" }>
  variant: ContentComponent
  citation?: CitationSelection
  onEvidence?: (selection: CitationSelection) => void
}>) {
  const { evidence } = content
  const descriptionId = useId()
  const clipboard = useClipboard({ timeout: 1800 })
  const [expanded, setExpanded] = useState(false)
  const fullText = evidence.content.state === "available" ? evidence.content.quote : undefined
  const isLong = fullText !== undefined && fullText.length > 600
  const isPartial = evidence.content.state === "available" && evidence.content.truncated === true
  let expandLabel = "Show full passage"
  if (isPartial) {
    expandLabel = "Show retrieved excerpt"
  }
  if (expanded) {
    expandLabel = "Show less"
  }
  const url = evidenceSourceUrl(evidence)
  const isCard = variant === "CitationCard"
  let unavailable = "No passage was retrieved for this source."
  if (evidence.content.state === "failed") {
    unavailable = "The passage could not be loaded."
  } else if (evidence.content.state === "unavailable") {
    unavailable = "The source passage is unavailable."
  }
  const marker =
    citation && onEvidence ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={responseStyles.citationNumber}
            aria-label={`Read source ${citation.number}: ${evidence.title}`}
            onClick={() => onEvidence(citation)}
          >
            {citation.number}
          </button>
        </TooltipTrigger>
        {url && <TooltipContent>{url}</TooltipContent>}
      </Tooltip>
    ) : (
      <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
    )
  const actions = (
    <>
      {url ? <SourceLink url={url}>Read in full</SourceLink> : <span className={styles.note}>Source unavailable</span>}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy citation"
            onClick={() => clipboard.copy(formatEvidenceCitation(evidence))}
          >
            {clipboard.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy citation</TooltipContent>
      </Tooltip>
      <output className="sr-only">{clipboard.copied ? "Citation copied" : ""}</output>
    </>
  )
  const excerpt = (
    <>
      {fullText ? (
        <EvidencePassage
          id={`${descriptionId}-passage`}
          className={isCard ? styles.quote : styles.passageText}
          quote={fullText}
          isScrollable={isLong && !expanded}
        />
      ) : (
        <p className={styles.note}>{unavailable}</p>
      )}
      {isPartial && <p className={styles.note}>Only part of the retrieved passage is shown.</p>}
      {isLong && (
        <div className={styles.plainActions}>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            aria-controls={`${descriptionId}-passage`}
            onClick={() => setExpanded(!expanded)}
          >
            {expandLabel}
          </Button>
          {!expanded && <span className={styles.note}>Passage excerpt</span>}
        </div>
      )}
    </>
  )
  if (variant === "CompactPassageCard") {
    const body = (
      <>
        <Quote className={compactStyles.icon} aria-hidden="true" />
        <span className="min-w-0">
          <span className={compactStyles.title}>{evidence.title}</span>
          {(evidence.publisher || evidence.versionLabel) && (
            <span id={`${descriptionId}-metadata`} className={compactStyles.metadata}>
              {[evidence.publisher, evidence.versionLabel].filter(Boolean).join(", ")}
            </span>
          )}
        </span>
        {evidence.locator && (
          <span id={`${descriptionId}-locator`} className={compactStyles.trailing}>
            {evidence.locator}
          </span>
        )}
      </>
    )
    const describedBy =
      [
        evidence.publisher || evidence.versionLabel ? `${descriptionId}-metadata` : undefined,
        evidence.locator ? `${descriptionId}-locator` : undefined
      ]
        .filter(Boolean)
        .join(" ") || undefined
    if (citation && onEvidence) {
      return (
        <button
          type="button"
          className={compactStyles.card}
          aria-label={`Read source ${citation.number}: ${evidence.title}`}
          aria-describedby={describedBy}
          onClick={() => onEvidence(citation)}
        >
          {body}
        </button>
      )
    }
    return (
      <section className={compactStyles.card} aria-label={`Passage: ${evidence.title}`} aria-describedby={describedBy}>
        {body}
      </section>
    )
  }
  if (!isCard) {
    return (
      <section className={styles.passage} aria-label={`Passage: ${evidence.title}`}>
        {excerpt}
        <div className={styles.sourceLine}>
          {marker} {evidence.title}
          {[evidence.versionLabel, evidence.locator].filter(Boolean).map((value) => (
            <div key={value}>{value}</div>
          ))}
        </div>
        <div className={styles.plainActions}>{actions}</div>
      </section>
    )
  }
  return (
    <section className={styles.card} aria-label={`Citation: ${evidence.title}`}>
      <div className={styles.heading}>
        {marker}
        <div className="min-w-0">
          <p className="text-xs text-primary">{evidence.publisher}</p>
          <h4 className={styles.title}>{evidence.title}</h4>
        </div>
      </div>
      {(evidence.versionLabel || evidence.locator) && (
        <dl className={styles.metadata}>
          {evidence.versionLabel && (
            <div>
              <dt>Version</dt>
              <dd>{evidence.versionLabel}</dd>
            </div>
          )}
          {evidence.locator && (
            <div>
              <dt>Passage</dt>
              <dd>{evidence.locator}</dd>
            </div>
          )}
        </dl>
      )}
      <div className={styles.body}>{excerpt}</div>
      <div className={styles.actions}>{actions}</div>
    </section>
  )
}

function TimelineContent({
  content,
  isProgress
}: Readonly<{ content: Extract<PresentationContent, { kind: "timeline" }>; isProgress: boolean }>) {
  const events = (isProgress ? content.events.filter((event) => event.type === "action") : content.events).map(
    (event) => ({ ...event, sourceUrl: humanReadableUrl(event.sourceUrl) })
  )
  const title = isProgress ? "Recorded bill progress" : "Recorded bill activity"
  return (
    <section className={styles.view} aria-label={title}>
      <h4 className={styles.title}>{title}</h4>
      <div
        className={isProgress ? styles.progressRegion : undefined}
        role={isProgress ? "region" : undefined}
        tabIndex={isProgress ? 0 : undefined}
        aria-label={isProgress ? "Recorded progress steps" : undefined}
      >
        <ol className={isProgress ? styles.progress : styles.timeline}>
          {events.map((event) => (
            <li key={event.id} className={isProgress ? styles.step : styles.event}>
              {isProgress ? (
                <span className={styles.track}>
                  <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                </span>
              ) : (
                <time className={styles.date} dateTime={event.date ?? undefined}>
                  {dateLabel(event.date)}
                </time>
              )}
              <div className={isProgress ? styles.stepBody : styles.eventBody}>
                {event.description}
                {isProgress && (
                  <div>
                    <time className={styles.date} dateTime={event.date ?? undefined}>
                      {dateLabel(event.date)}
                    </time>
                  </div>
                )}
                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex text-primary"
                    aria-label={`Open source: ${event.description}`}
                  >
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {events.length === 0 && <p className={styles.note}>No recorded events were returned.</p>}
      {content.hasMore && (
        <p className={styles.note}>More recorded events are available. This view contains only the retrieved page.</p>
      )}
    </section>
  )
}

function RollCallContent({ content }: Readonly<{ content: Extract<PresentationContent, { kind: "roll-call" }> }>) {
  const [selection, setSelection] = useState<{ resultId: string; recordId: string }>()
  const trigger = useRef<HTMLButtonElement>(null)
  const { record, positions } = content.details
  const visiblePositions = positions.slice(0, 6)
  return (
    <section className={styles.view} aria-label={`Roll call: ${record.title}`}>
      <h4 className={styles.title}>{record.title}</h4>
      <dl className={styles.tallies}>
        {record.tallies.map((tally) => (
          <div key={tally.label}>
            <dd>{new Intl.NumberFormat().format(tally.value)}</dd>
            <dt>{tally.label}</dt>
          </div>
        ))}
      </dl>
      {!content.details.hasCompleteTally && <p className={styles.note}>The complete tally was not returned.</p>}
      <Table
        className={styles.table}
        containerProps={{ className: styles.tableRegion, role: "region", "aria-label": "Member votes", tabIndex: 0 }}
      >
        <caption className="sr-only">Member votes</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Vote</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visiblePositions.map((position) => (
            <TableRow key={position.id}>
              <TableHead scope="row">{position.name ?? "Name not published"}</TableHead>
              <TableCell>{position.option}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {positions.length === 0 && <p className={styles.note}>No member positions were returned.</p>}
      <p className={styles.note}>
        {positions.length > 0 && (
          <>
            Showing {visiblePositions.length} of {positions.length} retrieved positions.{" "}
          </>
        )}
        {content.hasMore && "More positions are available from the source."}
      </p>
      <Button
        ref={trigger}
        variant="ghost"
        size="sm"
        onClick={() => setSelection({ resultId: content.resultId, recordId: record.id })}
      >
        Open full roll call
      </Button>
      <VoteDetails
        selection={selection}
        onClose={() => setSelection(undefined)}
        returnFocus={() => trigger.current?.focus({ preventScroll: true })}
      />
    </section>
  )
}

export function InlinePresentation({
  content,
  variant,
  citation,
  onEvidence,
  answerId
}: Readonly<{
  content: PresentationContent
  variant: ContentComponent
  citation?: CitationSelection
  onEvidence?: (selection: CitationSelection) => void
  answerId: string
}>) {
  if (content.kind === "bill-progress") {
    return <BillProgressCard content={content} />
  }
  if (content.kind === "evidence") {
    return <QuoteContent content={content} variant={variant} citation={citation} onEvidence={onEvidence} />
  }
  if (content.kind === "timeline") {
    return <TimelineContent content={content} isProgress={variant === "ProgressPath"} />
  }
  if (content.kind === "result-list") {
    return <EntityResults initialPage={{ ...content.page, presentation: "list" }} answerId={answerId} />
  }
  if (content.kind === "roll-call") {
    return <RollCallContent content={content} />
  }
  const title = content.state === "not-found" ? "Record not found" : "Passage not collected"
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.heading}>
        <FileQuestion className="size-4 shrink-0 text-subtle" aria-hidden="true" />
        <h4 className={styles.title}>{content.title}</h4>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        <p className={styles.note}>
          {content.state === "not-found"
            ? "No record was returned for this identifier."
            : "No passage was retrieved for this record."}
        </p>
      </div>
      {content.sourceUrl && (
        <div className={styles.actions}>
          <SourceLink url={content.sourceUrl}>Open source</SourceLink>
        </div>
      )}
    </section>
  )
}
