"use client"

import {
  CalendarDays,
  MapPin,
  CircleCheck,
  CircleX,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileDiff,
  ExternalLink,
  Landmark,
  Gavel,
  ScrollText,
  UserRound
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { Button } from "../../../components/ui/button"
import { entityLabels, ResultExpiredError, voteCardTallies, type EntityCard, type EntityPage } from "../entityResults"
import { useConversationSession } from "./ConversationSession"
import { MeetingDetails } from "./MeetingDetails"
import { ResultBadge } from "./ResultBadge"
import { VoteDetails } from "./VoteDetails"
import * as styles from "./EntityResults.css"

const icons = {
  bill: ScrollText,
  person: UserRound,
  organization: Landmark,
  meeting: CalendarDays,
  document: FileText,
  amendment: FileDiff,
  vote: Gavel,
  material: FileText
}

function BillCardBody({ record }: Readonly<{ record: EntityCard }>) {
  const summary = record.billSummary
  if (!summary?.status && !summary?.latestAction) {
    return null
  }
  const action = summary.latestAction
  let actionDate = action?.date
  if (actionDate && /^\d{4}-\d{2}-\d{2}$/.test(actionDate)) {
    const date = new Date(`${actionDate}T00:00:00Z`)
    if (!Number.isNaN(date.getTime())) {
      actionDate = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(date)
    }
  }
  return (
    <div className={styles.body}>
      {summary.status && (
        <div className={styles.statusRow}>
          <CircleDot
            className={
              summary.status.toLowerCase() === "in committee"
                ? styles.committeeStatusIcon
                : "size-[13px] shrink-0 text-subtle"
            }
            aria-hidden="true"
          />
          <span>{summary.status}</span>
        </div>
      )}
      {action && (
        <p>
          Latest action {actionDate && <time dateTime={action.date}>{actionDate}, </time>}
          {action.description}
        </p>
      )}
    </div>
  )
}

function VoteCardBody({ record }: Readonly<{ record: EntityCard }>) {
  const summary = record.voteSummary
  const tallies = voteCardTallies(record.tallies)
  if (!summary?.question && !summary?.outcome && record.tallies.length === 0) {
    return null
  }
  return (
    <div className={`${styles.body} ${styles.voteBody}`}>
      {summary?.question && (
        <div className={styles.voteQuestion}>
          <h4 className={styles.voteQuestionLabel}>Question as put</h4>
          <blockquote className={styles.voteQuestionText}>{summary.question}</blockquote>
        </div>
      )}
      {summary?.outcome && <ResultBadge outcome={summary.outcome} />}
      {tallies.length > 0 && (
        <dl className={styles.voteTallies}>
          {tallies.map((tally) => (
            <div key={tally.label} className={styles.voteTally}>
              <dt className={styles.voteTallyLabel}>{tally.label}</dt>
              <dd className={styles.voteTallyValue} data-vote-option={tally.label.toLowerCase()}>
                {new Intl.NumberFormat().format(tally.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function CivicCardBody({ record }: Readonly<{ record: EntityCard }>) {
  const person = record.personSummary
  const organization = record.organizationSummary
  const meeting = record.meetingSummary
  const active = person?.isActive ?? organization?.isActive
  const term = person?.term
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`)
    )
  const hasContent = active !== undefined || term || organization?.description || meeting?.location || meeting?.status
  if (!hasContent) {
    return null
  }
  return (
    <div className={styles.body}>
      {active !== undefined && (
        <div className={styles.statusRow}>
          {active ? (
            <CircleCheck className="size-[13px] shrink-0 text-[var(--state-success)]" aria-hidden="true" />
          ) : (
            <CircleDot className="size-[13px] shrink-0 text-subtle" aria-hidden="true" />
          )}
          <span>{active ? "Active" : "Inactive"}</span>
        </div>
      )}
      {term?.startDate && (
        <p>
          Current term began <time dateTime={term.startDate}>{formatDate(term.startDate)}</time>
        </p>
      )}
      {term?.endDate && (
        <p>
          Term ends <time dateTime={term.endDate}>{formatDate(term.endDate)}</time>
        </p>
      )}
      {organization?.description && <p>{organization.description}</p>}
      {meeting?.location && (
        <div className={styles.documentSource}>
          <MapPin className="size-[13px] shrink-0 text-subtle" aria-hidden="true" />
          <span>{meeting.location}</span>
        </div>
      )}
      {meeting?.status && <ResultBadge outcome={meeting.status} />}
    </div>
  )
}

function AmendmentMetadata({ record }: Readonly<{ record: EntityCard }>) {
  const summary = record.amendmentSummary
  if (!summary?.sponsorName && !summary?.submittedDate) {
    return null
  }
  return (
    <p className={styles.subtitle}>
      {summary.sponsorName && <>Offered by {summary.sponsorName}</>}
      {summary.sponsorName && summary.submittedDate && ", "}
      {!summary.sponsorName && summary.submittedDate && "Submitted "}
      {summary.submittedDate && (
        <time dateTime={summary.submittedDate}>
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC"
          }).format(new Date(`${summary.submittedDate}T00:00:00Z`))}
        </time>
      )}
    </p>
  )
}

function AmendmentCardBody({ record }: Readonly<{ record: EntityCard }>) {
  const status = record.amendmentSummary?.status
  if (!status) {
    return null
  }
  let StatusIcon = CircleDot
  let iconClass = "size-[13px] shrink-0 text-subtle"
  const normalizedStatus = status.trim().toLowerCase()
  if (["adopted", "agreed to", "passed", "adopted in committee"].includes(normalizedStatus)) {
    StatusIcon = CircleCheck
    iconClass = "size-[13px] shrink-0 text-[var(--state-success)]"
  } else if (["failed", "rejected", "defeated", "not agreed to"].includes(normalizedStatus)) {
    StatusIcon = CircleX
    iconClass = "size-[13px] shrink-0 text-[var(--state-danger)]"
  }
  return (
    <div className={styles.body}>
      <div className={styles.statusRow}>
        <StatusIcon className={iconClass} aria-hidden="true" />
        <span>{status}</span>
      </div>
    </div>
  )
}

function DocumentCard({ record, href }: Readonly<{ record: EntityCard; href?: string }>) {
  const summary = record.documentSummary
  const versionDate = summary?.versionDate
  const formattedDate = versionDate
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${versionDate}T00:00:00Z`))
    : undefined
  return (
    <section className={styles.card} aria-label={`${entityLabels[record.kind].singular}: ${record.title}`}>
      <div className={styles.head}>
        <FileText className="size-[15px] shrink-0 text-subtle" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {href ? (
            <Link href={href} className={styles.title} data-result-focus>
              {record.title}
            </Link>
          ) : (
            <h4 className={styles.documentTitle} tabIndex={-1} data-result-focus>
              {record.title}
            </h4>
          )}
          {record.kind === "material" && record.subtitle && <p className={styles.subtitle}>{record.subtitle}</p>}
          {versionDate && (
            <p className={styles.subtitle}>
              {record.kind === "material" ? "Dated " : "Version dated "}
              <time dateTime={versionDate}>{formattedDate}</time>
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-subtle">{entityLabels[record.kind].singular}</span>
      </div>
      {(summary?.sourceHost || summary?.versionCode) && (
        <div className={styles.body}>
          {summary.sourceHost && (
            <div className={styles.documentSource}>
              <Landmark className="size-[13px] shrink-0 text-subtle" aria-hidden="true" />
              <span>{summary.sourceHost}</span>
            </div>
          )}
          {summary.versionCode && <p>Version {summary.versionCode}</p>}
        </div>
      )}
      {record.sourceUrl && (
        <div className={styles.cardActions}>
          <a
            href={record.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sourceAction}
            aria-label={`Open source: ${record.title}`}
          >
            Open source
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      )}
    </section>
  )
}

function recordHref(record: EntityCard, resultId: string) {
  if (!["person", "organization", "material"].includes(record.kind)) {
    return undefined
  }
  return `/records/${record.kind}/${encodeURIComponent(record.id)}?${new URLSearchParams({ result: resultId })}`
}

export function RecordCard({
  record,
  resultId,
  onOpenVote
}: Readonly<{ record: EntityCard; resultId: string; onOpenVote: (recordId: string) => void }>) {
  const href = recordHref(record, resultId)
  if (record.kind === "material") {
    return <DocumentCard record={record} href={href} />
  }
  if (record.kind === "document") {
    return <DocumentCard record={record} />
  }
  const Icon = icons[record.kind]
  let heading = (
    <h4 tabIndex={-1} data-result-focus className={styles.title}>
      {record.title}
    </h4>
  )
  if (record.kind === "vote" || record.kind === "meeting") {
    heading = (
      <button
        type="button"
        className={`${styles.title} ${styles.cardTitleLink} text-left`}
        data-result-focus
        onClick={() => onOpenVote(record.id)}
      >
        {record.title}
      </button>
    )
  } else if (href) {
    heading = (
      <Link href={href} className={`${styles.title} ${styles.cardTitleLink}`} data-result-focus>
        {record.title}
      </Link>
    )
  } else if (record.sourceUrl) {
    heading = (
      <a
        href={record.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${styles.title} ${styles.cardTitleLink}`}
        data-result-focus
      >
        {record.title}
      </a>
    )
  }
  return (
    <section className={styles.card} aria-label={`${entityLabels[record.kind].singular}: ${record.title}`}>
      <div className={styles.head}>
        <Icon className="size-[15px] shrink-0 text-subtle" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {heading}
          {record.kind === "amendment" ? (
            <AmendmentMetadata record={record} />
          ) : (
            record.subtitle && <p className={styles.subtitle}>{record.subtitle}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-subtle">{entityLabels[record.kind].singular}</span>
      </div>
      {record.kind === "bill" && <BillCardBody record={record} />}
      {record.kind === "vote" && <VoteCardBody record={record} />}
      {["person", "organization", "meeting"].includes(record.kind) && <CivicCardBody record={record} />}
      {record.kind === "amendment" && <AmendmentCardBody record={record} />}
      {record.kind !== "bill" &&
        record.kind !== "vote" &&
        record.kind !== "amendment" &&
        (record.fields.length > 0 || record.tallies.length > 0) && (
          <div className={styles.body}>
            {record.fields.map((field) => (
              <p key={field.label}>
                <span className="font-medium">{field.label}: </span>
                {field.value}
              </p>
            ))}
            {record.tallies.length > 0 && (
              <dl className={styles.tallies}>
                {record.tallies.map((tally) => (
                  <div key={tally.label}>
                    <dd className="font-mono text-base text-foreground">
                      {new Intl.NumberFormat().format(tally.value)}
                    </dd>
                    <dt>{tally.label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
    </section>
  )
}

function ResultRow({
  record,
  index,
  resultId,
  onOpenVote
}: Readonly<{ record: EntityCard; index: number; resultId: string; onOpenVote: (recordId: string) => void }>) {
  const href = recordHref(record, resultId)
  const body = (
    <>
      <span className={styles.index}>{new Intl.NumberFormat().format(index)}</span>
      <span className="min-w-0 flex-1">
        <span className={styles.title}>{record.title}</span>
        {record.subtitle && <span className={styles.subtitle}>{record.subtitle}</span>}
      </span>
      {(href || record.sourceUrl || record.kind === "vote" || record.kind === "meeting") && (
        <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden="true" />
      )}
    </>
  )
  if (record.kind === "vote" || record.kind === "meeting") {
    return (
      <button type="button" className={styles.row} data-result-focus onClick={() => onOpenVote(record.id)}>
        {body}
      </button>
    )
  }
  if (href) {
    return (
      <Link href={href} className={styles.row} data-result-focus>
        {body}
      </Link>
    )
  }
  if (record.sourceUrl) {
    return (
      <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.row} data-result-focus>
        {body}
      </a>
    )
  }
  return (
    <div className={styles.row} tabIndex={-1} data-result-focus>
      {body}
    </div>
  )
}

export function EntityResults({ initialPage, answerId }: Readonly<{ initialPage: EntityPage; answerId: string }>) {
  const [page, setPage] = useState(initialPage)
  const [isLoading, setIsLoading] = useState(false)
  const [failedPage, setFailedPage] = useState<number>()
  const [expiryMessage, setExpiryMessage] = useState<string>()
  const request = useRef<AbortController | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const expiredNotice = useRef<HTMLDivElement>(null)
  const shouldFocusResult = useRef(false)
  const [selectedVote, setSelectedVote] = useState<{ resultId: string; recordId: string }>()
  const { meetingSelection, setMeetingSelection } = useConversationSession()
  const voteTrigger = useRef<HTMLElement | null>(null)
  const { loadResultPage } = useConversationSession()
  const { stopScroll } = useStickToBottomContext()
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (shouldFocusResult.current) {
      content.current?.querySelector<HTMLElement>("[data-result-focus]")?.focus({ preventScroll: true })
      shouldFocusResult.current = false
    }
  }, [page])
  useEffect(() => {
    if (failedPage !== undefined) {
      retryButton.current?.focus({ preventScroll: true })
    }
  }, [failedPage])
  useEffect(() => {
    if (expiryMessage) {
      expiredNotice.current?.focus({ preventScroll: true })
    }
  }, [expiryMessage])
  const label = entityLabels[page.kind].plural
  const number = new Intl.NumberFormat()
  const range = `${number.format(page.start)}\u2013${number.format(page.end)}`

  function openVote(recordId: string) {
    stopScroll()
    voteTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (page.items.find((record) => record.id === recordId)?.kind === "meeting") {
      setMeetingSelection({ resultId: page.id, recordId })
    } else {
      setSelectedVote({ resultId: page.id, recordId })
    }
  }

  async function navigate(target: number) {
    if (request.current || expiryMessage) {
      return
    }
    stopScroll()
    const controller = new AbortController()
    request.current = controller
    setIsLoading(true)
    setFailedPage(undefined)
    try {
      const next = await loadResultPage(page.id, target, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      shouldFocusResult.current = true
      setPage(next)
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ResultExpiredError) {
          setExpiryMessage(error.message)
        } else {
          setFailedPage(target)
        }
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
      if (request.current === controller) {
        request.current = null
      }
    }
  }

  return (
    <section aria-label={label} aria-busy={isLoading} className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold">{label}</h3>
      {page.query && <p className="break-words text-xs text-muted-foreground">{page.query}</p>}
      <div ref={content}>
        {page.presentation === "card"
          ? page.items.map((record) => (
              <RecordCard key={record.id} record={record} resultId={page.id} onOpenVote={openVote} />
            ))
          : page.items.map((record, index) => (
              <ResultRow
                key={`${record.id}:${index}`}
                record={record}
                resultId={page.id}
                index={page.start + index}
                onOpenVote={openVote}
              />
            ))}
        {page.items.length === 0 && <p className="text-sm text-muted-foreground">No records returned.</p>}
      </div>
      {page.warnings.map((warning) => (
        <p key={warning} className="break-words text-xs text-muted-foreground">
          {warning}
        </p>
      ))}
      {isLoading && (
        <output className={styles.retrievalStatus} aria-live="polite">
          Loading results. Previously loaded records are still shown.
        </output>
      )}
      {expiryMessage && (
        <div role="alert" ref={expiredNotice} tabIndex={-1} className={styles.retrievalStatus}>
          {expiryMessage}
        </div>
      )}
      {failedPage !== undefined && (
        <div role="alert" className={styles.retrievalStatus}>
          <p>This page could not be loaded. Previously loaded results are unchanged.</p>
          <Button
            type="button"
            className={styles.retryButton}
            ref={retryButton}
            onClick={() => {
              void navigate(failedPage)
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {(page.hasNext || page.hasPrevious) && (
        <nav aria-label={`${label} in answer ${answerId}`} className={styles.pager}>
          <Button
            type="button"
            variant="outline"
            className={styles.pageButton}
            disabled={isLoading || !!expiryMessage || !page.hasPrevious}
            onClick={() => {
              void navigate(page.page - 1)
            }}
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Previous
          </Button>
          <output className="min-w-0 flex-1 text-center text-xs text-muted-foreground" aria-live="polite">
            {range}
          </output>
          <Button
            type="button"
            variant="outline"
            className={styles.pageButton}
            disabled={isLoading || !!expiryMessage || !page.hasNext}
            onClick={() => {
              void navigate(page.page + 1)
            }}
          >
            Next
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        </nav>
      )}
      <VoteDetails
        selection={selectedVote}
        onClose={() => setSelectedVote(undefined)}
        returnFocus={() => voteTrigger.current?.focus({ preventScroll: true })}
      />
      <MeetingDetails
        selection={meetingSelection?.resultId === page.id ? meetingSelection : undefined}
        onClose={() => setMeetingSelection(undefined)}
        returnFocus={() => {
          if (voteTrigger.current?.isConnected) {
            voteTrigger.current.focus({ preventScroll: true })
          } else {
            content.current?.querySelector<HTMLElement>("[data-result-focus]")?.focus()
          }
        }}
      />
    </section>
  )
}
