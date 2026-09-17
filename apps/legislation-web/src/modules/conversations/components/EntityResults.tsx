"use client"

import {
  CalendarDays,
  CalendarClock,
  CircleCheck,
  CircleX,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileDiff,
  Paperclip,
  Landmark,
  Gavel,
  ScrollText,
  User
} from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { Button } from "../../../components/ui/button"
import { Toggle } from "../../../components/ui/toggle"
import { entityLabels, resultTone, ResultExpiredError, type EntityCard, type EntityPage } from "../entityResults"
import { evidenceSourceUrl } from "../evidence"
import { useConversationSession } from "./ConversationSession"
import { MeetingDetails } from "./MeetingDetails"
import { VoteDetails } from "./VoteDetails"
import * as compactStyles from "./CompactRecordCard.css"
import * as styles from "./EntityResults.css"

const icons = {
  bill: ScrollText,
  person: User,
  organization: Landmark,
  meeting: CalendarDays,
  document: FileText,
  amendment: FileDiff,
  vote: Gavel,
  material: Paperclip
}

export function recordActionUnavailable() {
  window.alert("Not implemented")
}

function CardStatus({ outcome, isMeeting = false }: Readonly<{ outcome: string; isMeeting?: boolean }>) {
  let tone = resultTone(outcome)
  const normalized = outcome.trim().toLowerCase()
  if (["serving", "active", "text available", "current text", "agreed"].includes(normalized)) {
    tone = "success"
  }
  if (["in committee", "referred to committee"].includes(normalized)) {
    tone = "pending"
  }
  if (isMeeting && outcome.trim().toLowerCase() === "scheduled") {
    tone = "success"
  }
  let Icon = CircleDot
  if (tone === "success") {
    Icon = CircleCheck
  } else if (tone === "danger") {
    Icon = CircleX
  }
  if (isMeeting && normalized === "scheduled") {
    Icon = CalendarClock
  }
  const labels: Record<string, string> = {
    pass: "Passed",
    fail: "Failed",
    agreed: "Agreed to",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    canceled: "Canceled"
  }
  return (
    <span className={styles.statusRow} data-result-tone={tone}>
      <Icon className={styles.statusIcon} aria-hidden="true" />
      <span>{labels[outcome.trim().toLowerCase()] ?? outcome}</span>
    </span>
  )
}

export function RecordIdentity({
  record,
  children,
  isGrouped = false,
  label
}: Readonly<{ record: EntityCard; children: ReactNode; isGrouped?: boolean; label?: string }>) {
  const Icon = icons[record.kind]
  let status = compactRecordDetails(record).status
  if (record.kind === "document" || record.kind === "material") {
    status = suppliedFact(record, "Status")
  }
  if (record.kind === "organization") {
    status = undefined
    if (record.organizationSummary?.isActive !== undefined) {
      status = record.organizationSummary.isActive ? "Active" : "Inactive"
    }
  }
  const kindLabel =
    record.kind === "organization" && record.organizationSummary?.classification === "committee"
      ? "Committee"
      : entityLabels[record.kind].singular
  return (
    <div className={styles.identity}>
      <div className={styles.eyebrow}>
        <Icon className="size-[13px] shrink-0 text-primary" aria-hidden="true" />
        <span className={styles.kindLabel}>{label ?? kindLabel}</span>
        {record.kind !== "amendment" && record.identifier && (
          <span className={styles.identifier}>{record.identifier}</span>
        )}
        {status && (
          <span className={styles.headerStatus}>
            <CardStatus outcome={status} isMeeting={record.kind === "meeting"} />
          </span>
        )}
      </div>
      {children}
      <RecordMetadata record={record} />
      {!isGrouped && record.kind === "vote" && record.voteSummary?.question && (
        <blockquote className={styles.fullQuote}>{record.voteSummary.question}</blockquote>
      )}
    </div>
  )
}

export function CardActions({
  record,
  resultId,
  onOpenRecord,
  isFollowing
}: Readonly<{
  record: EntityCard
  resultId: string
  onOpenRecord: (id: string) => void
  isFollowing: boolean
}>) {
  const kind = record.kind
  const href = recordHref(record, resultId)
  const textHref = evidenceSourceUrl(record)
  const inspector = kind === "vote" || kind === "meeting"
  return (
    <div className={styles.fullActions}>
      {inspector && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={styles.primaryActionButton}
          onClick={() => onOpenRecord(record.id)}
        >
          Open
        </Button>
      )}
      {!inspector && href && (
        <Button asChild variant="ghost" size="xs" className={styles.primaryActionButton}>
          <Link
            href={href}
            target={href.startsWith("/") ? undefined : "_blank"}
            rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
          >
            Open
          </Link>
        </Button>
      )}
      {["bill", "person", "organization", "meeting"].includes(kind) && (
        <Toggle
          type="button"
          size="sm"
          className={styles.actionButton}
          pressed={isFollowing}
          aria-label="Follow record"
          onPressedChange={recordActionUnavailable}
        >
          {isFollowing ? "Following" : "Follow"}
        </Toggle>
      )}
      {kind === "amendment" && textHref && (
        <Button asChild variant="ghost" size="xs" className={styles.actionButton}>
          <a href={textHref} target="_blank" rel="noopener noreferrer">
            Open source
          </a>
        </Button>
      )}
      <Button type="button" variant="ghost" size="xs" className={styles.actionButton} onClick={recordActionUnavailable}>
        Add to issue
      </Button>
    </div>
  )
}

type CardFact = { label: string; value?: ReactNode; detail?: ReactNode; voteOption?: string }
function FactGrid({ facts }: Readonly<{ facts: CardFact[] }>) {
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue} data-vote-option={fact.voteOption}>
            {fact.value ?? <span className={styles.factDetail}>Not returned</span>}
          </dd>
          {fact.detail && <dd className={styles.factDetail}>{fact.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}

function DateFact({ value }: Readonly<{ value: string }>) {
  if (/^\d{4}$/.test(value)) {
    return <>{value}</>
  }
  return <time dateTime={value}>{compactDate(value) ?? value}</time>
}

function suppliedFact(record: EntityCard, label: string) {
  return record.fields.find((field) => field.label === label)?.value
}

function storedFact(record: EntityCard, label: string): CardFact {
  return { label, ...record.fields.find((field) => field.label === label) }
}

function billActionLabel(description: string | undefined) {
  if (!description) {
    return description
  }
  const labels: ReadonlyArray<readonly [RegExp, string]> = [
    [
      /^(?:In (?:Senate|Assembly|House)\.\s*)?Consideration of Governor['\u2019]s veto pending\.?$/i,
      "Vetoed; waiting for lawmakers to act"
    ],
    [
      /^(?:In (?:Senate|Assembly|House)\.\s*)?Consideration of Governor['\u2019]s veto stricken from file\.?$/i,
      "Vetoed; review taken off the agenda"
    ],
    [/^In committee:\s*Held under submission\.?$/i, "Waiting for a committee decision"],
    [/^Read first time\.\s*To print\.?$/i, "First reading done"]
  ]
  const normalized = description.trim().replaceAll(/\s+/g, " ")
  return labels.find(([pattern]) => pattern.test(normalized))?.[1] ?? description
}

function BillCardBody({ record, isGrouped = false }: Readonly<{ record: EntityCard; isGrouped?: boolean }>) {
  const summary = record.billSummary
  const action = summary?.latestAction
  const actionLabel = billActionLabel(action?.description)
  const introduced = suppliedFact(record, "Introduced")
  return (
    <FactGrid
      facts={[
        {
          label: "Latest action",
          value: action?.date ? <DateFact value={action.date} /> : actionLabel,
          detail: !isGrouped && action?.date ? actionLabel : undefined
        },
        { label: "Introduced", value: introduced ? <DateFact value={introduced} /> : undefined },
        { label: "Versions", value: suppliedFact(record, "Versions") }
      ]}
    />
  )
}

function VoteCardBody({ record }: Readonly<{ record: EntityCard }>) {
  const counts = compactVoteCounts(record.tallies)
  const breakdown = record.tallies
    .filter((tally) => !["yes", "no", "other", "not recorded"].includes(tally.label.toLowerCase()))
    .map((tally) => `${new Intl.NumberFormat().format(tally.value)} ${tally.label.toLowerCase()}`)
    .join(", ")
  const facts: CardFact[] = ["yes", "no", "other"].map((option) => {
    const tally = counts.find((tally) => tally.label === option)
    return {
      label: option,
      value: tally ? new Intl.NumberFormat().format(tally.value) : undefined,
      voteOption: option,
      detail: option === "other" ? breakdown : undefined
    }
  })
  const missing = counts.find((tally) => tally.label === "not recorded")
  if (missing) {
    facts.push({ label: "Not recorded", value: new Intl.NumberFormat().format(missing.value) })
  }
  return <FactGrid facts={facts} />
}

function CivicCardBody({ record }: Readonly<{ record: EntityCard }>) {
  if (record.kind === "person") {
    const term = record.personSummary?.term
    const since = suppliedFact(record, "In office since")
    const start = term?.startDate ?? term?.startYear?.toString()
    const end = term?.endDate ?? term?.endYear?.toString()
    return (
      <FactGrid
        facts={[
          { label: "In office since", value: since ? <DateFact value={since} /> : undefined },
          {
            label: "Current term",
            value: start ? (
              <>
                <DateFact value={start} />
                {end && (
                  <>
                    {" "}
                    to <DateFact value={end} />
                  </>
                )}
              </>
            ) : undefined
          },
          { label: "Committee roles", value: suppliedFact(record, "Committee roles") }
        ]}
      />
    )
  }
  if (record.kind === "organization") {
    return (
      <FactGrid
        facts={[storedFact(record, "Chair"), storedFact(record, "Members"), storedFact(record, "Next meeting")]}
      />
    )
  }
  return (
    <FactGrid
      facts={[
        { label: "Agenda items", value: suppliedFact(record, "Agenda items") },
        { label: "Documents", value: suppliedFact(record, "Documents") },
        { label: "Location", value: record.meetingSummary?.location, detail: suppliedFact(record, "Location detail") }
      ]}
    />
  )
}

function RecordMetadata({ record }: Readonly<{ record: EntityCard }>) {
  if (record.metadata?.length) {
    return (
      <div className={styles.identityMetadata}>
        {record.metadata.map((value, index) => (
          <span key={`${index}-${value}`} className={styles.metadataPart}>
            {value}
          </span>
        ))}
      </div>
    )
  }
  if (record.kind === "amendment") {
    return <AmendmentMetadata record={record} />
  }
  if (!record.subtitle) {
    return null
  }
  if (record.kind === "vote") {
    const date = new Date(record.subtitle)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    return (
      <p className={styles.subtitle}>
        <time dateTime={record.subtitle}>
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC"
          }).format(date)}
        </time>
      </p>
    )
  }
  return <p className={styles.subtitle}>{record.subtitle}</p>
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
  const date = record.amendmentSummary?.submittedDate
  const latest = storedFact(record, "Latest action")
  const latestDetail =
    typeof latest.detail === "string"
      ? latest.detail.replace(/^House amendment offered\b/i, "Amendment proposed")
      : latest.detail
  return (
    <FactGrid
      facts={[
        { label: "Submitted", value: date ? <DateFact value={date} /> : undefined },
        {
          ...latest,
          detail: latestDetail,
          value: typeof latest.value === "string" ? <DateFact value={latest.value} /> : undefined
        },
        { label: "Bill", value: suppliedFact(record, "Bill") }
      ]}
    />
  )
}

function DocumentCard({
  record,
  href,
  isGrouped = false
}: Readonly<{ record: EntityCard; href?: string; isGrouped?: boolean }>) {
  const summary = record.documentSummary
  const versionDate = summary?.versionDate
  const destination = href ?? evidenceSourceUrl(record)
  const isExternal = destination ? !destination.startsWith("/") : false
  const isMaterial = record.kind === "material"
  const primaryLabel = isMaterial ? "Open" : "Open in reader"
  let dateFact: CardFact = { label: "Dated", value: versionDate ? <DateFact value={versionDate} /> : undefined }
  if (summary?.hearingDates) {
    dateFact = { label: "Hearing dates" }
    const dates = summary.hearingDates
    const firstDate = dates[0]
    const lastDate = dates.at(-1)
    if (firstDate && lastDate) {
      const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" })
      dateFact.value = format.formatRange(new Date(`${firstDate}T00:00:00Z`), new Date(`${lastDate}T00:00:00Z`))
    }
  }
  const facts: CardFact[] = isMaterial
    ? [dateFact, storedFact(record, "Pages"), storedFact(record, "Attached to")]
    : [
        {
          label: "Version",
          value: summary?.versionCode,
          detail: versionDate ? <DateFact value={versionDate} /> : undefined
        },
        storedFact(record, "Sections"),
        storedFact(record, "Pages")
      ]
  return (
    <section className={styles.fullCard} aria-label={`${entityLabels[record.kind].singular}: ${record.title}`}>
      <RecordIdentity record={record}>
        {destination ? (
          <Link
            href={destination}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            className={styles.fullTitle}
            data-result-focus
          >
            {record.title}
          </Link>
        ) : (
          <h4 className={styles.fullTitle} tabIndex={-1} data-result-focus>
            {record.title}
          </h4>
        )}
      </RecordIdentity>
      <FactGrid facts={facts} />
      {!isGrouped && (
        <div className={styles.fullActions}>
          {destination ? (
            <Button asChild variant="ghost" size="xs" className={styles.primaryActionButton}>
              <Link
                href={destination}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                {primaryLabel}
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="xs" className={styles.primaryActionButton} disabled>
              {primaryLabel}
            </Button>
          )}
          {isMaterial && destination && (
            <Button asChild variant="ghost" size="xs" className={styles.actionButton}>
              <Link
                href={destination}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
              >
                Read text
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className={styles.actionButton}
            onClick={recordActionUnavailable}
          >
            Add to issue
          </Button>
        </div>
      )}
    </section>
  )
}

export function recordHref(record: EntityCard, resultId: string) {
  if (!["person", "organization", "material"].includes(record.kind)) {
    return evidenceSourceUrl(record) ?? undefined
  }
  return `/records/${record.kind}/${encodeURIComponent(record.id)}?${new URLSearchParams({ result: resultId })}`
}

export function CompactRecordCard({
  record,
  resultId,
  onOpenVote,
  isGrouped = false
}: Readonly<{
  record: EntityCard
  resultId: string
  onOpenVote: (recordId: string) => void
  isGrouped?: boolean
}>) {
  const descriptionId = useId()
  const Icon = icons[record.kind]
  const href = recordHref(record, resultId)
  const opensDetails = record.kind === "vote" || record.kind === "meeting"
  const details = compactRecordDetails(record)
  let metadata = details.metadata
  const status = details.status
  const counts = record.kind === "vote" ? compactVoteCounts(record.tallies) : []
  if (isGrouped && counts.length) {
    metadata = counts.map(({ label, value }) => `${new Intl.NumberFormat().format(value)} ${label}`).join(", ")
  }
  if (isGrouped && record.kind === "meeting") {
    metadata = record.metadata?.[0] || record.subtitle
  }
  const hasInlineTallies = !isGrouped && counts.length > 0
  const className = `${compactStyles.card} ${hasInlineTallies ? compactStyles.voteCard : ""}`
  const describedBy =
    [metadata ? `${descriptionId}-meta` : undefined, hasInlineTallies || status ? `${descriptionId}-status` : undefined]
      .filter(Boolean)
      .join(" ") || undefined
  const body = (
    <>
      <Icon className={compactStyles.icon} aria-hidden="true" />
      <span className="min-w-0">
        <span className={compactStyles.title}>{record.title}</span>
        {metadata && (
          <span id={`${descriptionId}-meta`} className={compactStyles.metadata}>
            {metadata}
          </span>
        )}
      </span>
      {hasInlineTallies ? (
        <span id={`${descriptionId}-status`} className={`${compactStyles.trailing} ${compactStyles.tallies}`}>
          {counts.map(({ label, value }) => (
            <span key={label} className={compactStyles.tally} data-vote-option={label}>
              {new Intl.NumberFormat().format(value)} {label}
            </span>
          ))}
        </span>
      ) : (
        status && (
          <span id={`${descriptionId}-status`} className={compactStyles.trailing}>
            {status}
          </span>
        )
      )}
    </>
  )
  if (opensDetails) {
    return (
      <button
        type="button"
        className={className}
        aria-label={record.title}
        aria-describedby={describedBy}
        data-result-focus
        onClick={() => onOpenVote(record.id)}
      >
        {body}
      </button>
    )
  }
  if (href) {
    return (
      <Link
        href={href}
        target={href.startsWith("/") ? undefined : "_blank"}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
        className={className}
        aria-label={record.title}
        aria-describedby={describedBy}
        data-result-focus
      >
        {body}
      </Link>
    )
  }
  return (
    <section className={className} aria-label={record.title} aria-describedby={describedBy}>
      {body}
    </section>
  )
}

function compactDate(value: string | undefined) {
  if (!value) {
    return undefined
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date)
}

function compactRecordDetails(record: EntityCard) {
  let metadata = record.metadata?.join(", ") || record.subtitle
  let status: string | undefined
  if (record.kind === "bill") {
    status = record.billSummary?.status
    const date = compactDate(record.billSummary?.latestAction?.date)
    metadata = [record.metadata?.[0] || record.subtitle, date ? `Latest action ${date}` : undefined]
      .filter(Boolean)
      .join(", ")
  } else if (record.kind === "person") {
    const active = record.personSummary?.isActive ?? record.personSummary?.term?.isActive
    if (active !== undefined) {
      status = active ? "Serving" : "Inactive"
    }
  } else if (record.kind === "organization") {
    const memberField = record.fields.find((field) => field.label === "Members")
    const members = memberField?.value
    if (members) {
      status = `${members} members`
      if (memberField.detail) {
        status = `${members} recorded members`
      }
    } else if (record.organizationSummary?.isActive !== undefined) {
      status = record.organizationSummary.isActive ? "Active" : "Inactive"
    }
    const classification = record.organizationSummary?.classification
    if (classification && !metadata?.toLowerCase().includes(classification.toLowerCase())) {
      metadata = [metadata, classification].filter(Boolean).join(", ")
    }
  } else if (record.kind === "meeting") {
    const summary = record.meetingSummary
    metadata = [record.metadata?.[0] || record.subtitle, summary?.location].filter(Boolean).join(", ")
    status = summary?.status
  } else if (record.kind === "document" || record.kind === "material") {
    const summary = record.documentSummary
    const date = compactDate(summary?.versionDate)
    const sections = record.fields.find((field) => field.label === "Sections")?.value
    let dated: string | undefined
    if (date) {
      dated = record.kind === "material" ? `Dated ${date}` : `Version dated ${date}`
    }
    if (record.kind === "material") {
      metadata = [summary?.sourceHost, date].filter(Boolean).join(", ")
    } else {
      metadata = [dated, sections ? `${sections} sections` : undefined].filter(Boolean).join(", ")
    }
    status = record.kind === "material" ? record.subtitle : summary?.versionCode
    if (!metadata) {
      metadata = summary?.sourceHost
    }
  } else if (record.kind === "amendment") {
    const summary = record.amendmentSummary
    metadata = [
      summary?.sponsorName ? `Offered by ${summary.sponsorName}` : undefined,
      compactDate(summary?.submittedDate)
    ]
      .filter(Boolean)
      .join(", ")
    status = summary?.status
  } else if (record.kind === "vote") {
    metadata = record.metadata?.join(", ") || compactDate(record.subtitle)
    status = record.voteSummary?.outcome
  }
  const statusLabels: Record<string, string> = {
    pass: "Passed",
    fail: "Failed",
    agreed: "Agreed to",
    adopted: "Adopted",
    withdrawn: "Withdrawn",
    scheduled: "Scheduled",
    published: "Published",
    cancelled: "Cancelled",
    canceled: "Canceled"
  }
  if (status) {
    status = statusLabels[status.trim().toLowerCase()] ?? status
  }
  return { metadata, status }
}

function compactVoteCounts(tallies: EntityCard["tallies"]) {
  const yes = tallies.find((tally) => tally.label.toLowerCase() === "yes")
  const no = tallies.find((tally) => tally.label.toLowerCase() === "no")
  const other = tallies.find((tally) => tally.label.toLowerCase() === "other")
  const remaining = tallies.filter(
    (tally) => !["yes", "no", "other", "not recorded"].includes(tally.label.toLowerCase())
  )
  const counts: Array<{ label: string; value: number }> = []
  if (yes) {
    counts.push({ label: "yes", value: yes.value })
  }
  if (no) {
    counts.push({ label: "no", value: no.value })
  }
  if (other || remaining.length > 0) {
    counts.push({ label: "other", value: other?.value ?? remaining.reduce((total, tally) => total + tally.value, 0) })
  }
  const missing = tallies.find((tally) => tally.label.toLowerCase() === "not recorded")
  if (missing) {
    counts.push({ label: "not recorded", value: missing.value })
  }
  return counts
}

export function RecordCard({
  record,
  resultId,
  onOpenVote,
  isFollowing = false,
  isGrouped = false
}: Readonly<{
  record: EntityCard
  resultId: string
  onOpenVote: (recordId: string) => void
  isFollowing?: boolean
  isGrouped?: boolean
}>) {
  const href = recordHref(record, resultId)
  if (record.kind === "material") {
    return <DocumentCard record={record} href={href} isGrouped={isGrouped} />
  }
  if (record.kind === "document") {
    return <DocumentCard record={record} isGrouped={isGrouped} />
  }
  const displayTitle =
    record.kind !== "amendment" && record.identifier && record.title.startsWith(`${record.identifier} `)
      ? record.title.slice(record.identifier.length + 1)
      : record.title
  let heading = (
    <h4 tabIndex={-1} data-result-focus className={styles.fullTitle} aria-label={record.title}>
      {displayTitle}
    </h4>
  )
  if (record.kind === "vote" || record.kind === "meeting") {
    heading = (
      <button
        type="button"
        className={styles.fullTitle}
        aria-label={record.title}
        data-result-focus
        onClick={() => onOpenVote(record.id)}
      >
        {displayTitle}
      </button>
    )
  } else if (href) {
    heading = (
      <Link
        href={href}
        target={href.startsWith("/") ? undefined : "_blank"}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
        className={styles.fullTitle}
        aria-label={record.title}
        data-result-focus
      >
        {displayTitle}
      </Link>
    )
  }
  return (
    <section className={styles.fullCard} aria-label={`${entityLabels[record.kind].singular}: ${record.title}`}>
      <RecordIdentity record={record} isGrouped={isGrouped}>
        {heading}
      </RecordIdentity>
      {record.kind === "bill" && <BillCardBody record={record} isGrouped={isGrouped} />}
      {record.kind === "vote" && <VoteCardBody record={record} />}
      {["person", "organization", "meeting"].includes(record.kind) && <CivicCardBody record={record} />}
      {record.kind === "amendment" && <AmendmentCardBody record={record} />}
      {!isGrouped && (
        <CardActions record={record} resultId={resultId} onOpenRecord={onOpenVote} isFollowing={isFollowing} />
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
      {(href || record.kind === "vote" || record.kind === "meeting") && (
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
      <Link
        href={href}
        target={href.startsWith("/") ? undefined : "_blank"}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
        className={styles.row}
        data-result-focus
      >
        {body}
      </Link>
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

  let records: ReactNode
  if (page.presentation === "card") {
    records = page.items.map((record) => (
      <RecordCard key={record.id} record={record} resultId={page.id} onOpenVote={openVote} />
    ))
  } else if (page.kind === "bill") {
    records = (
      <div className={compactStyles.group}>
        {page.items.map((record) => (
          <div key={record.id}>
            <CompactRecordCard record={record} resultId={page.id} onOpenVote={openVote} />
          </div>
        ))}
      </div>
    )
  } else {
    records = page.items.map((record, index) => (
      <ResultRow
        key={`${record.id}:${index}`}
        record={record}
        resultId={page.id}
        index={page.start + index}
        onOpenVote={openVote}
      />
    ))
  }
  return (
    <section aria-label={label} aria-busy={isLoading} className="min-w-0 space-y-3">
      <h3 className="text-sm font-semibold">{label}</h3>
      {page.query && <p className="break-words text-xs text-muted-foreground">{page.query}</p>}
      <div ref={content}>
        {records}
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
