"use client"

import { CircleSlash, CircleX, FileText, TriangleAlert } from "lucide-react"
import { useRef, useState } from "react"
import invariant from "tiny-invariant"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { z } from "zod"
import { Spinner } from "../../../components/ui/spinner"
import {
  presentationBlockSchema,
  presentationReferences,
  type PresentationBlock,
  type PresentationReference
} from "../composition"
import type { CitationSelection } from "./citationPresentation"
import { CompactRecordCard, RecordCard } from "./EntityResults"
import { InlinePresentation } from "./InlinePresentation"
import { MeetingDetails } from "./MeetingDetails"
import { RecordGroup } from "./RecordGroup"
import { VoteDetails } from "./VoteDetails"
import * as styles from "./ComposedRecord.css"
import * as cardStyles from "./EntityResults.css"

const presentationPartSchema = z
  .object({
    type: z.literal("data-presentation"),
    id: z.string().min(1).max(128),
    data: presentationBlockSchema
  })
  .refine((part) => part.id === part.data.blockId)

type ReadyRecordProps = Readonly<{ block: Extract<PresentationBlock, { state: "ready" }> }>
type ComposedRecordProps = Readonly<{
  part: unknown
  isRunning: boolean
  citation?: CitationSelection
  onEvidence?: (selection: CitationSelection) => void
  answerId?: string
}>

function PresentationFailure({
  reason = "presentation"
}: Readonly<{
  reason?: "presentation" | "records" | "interrupted"
}>) {
  let title = "Content could not be displayed"
  let message = "This content could not be displayed."
  let status = "Invalid reference"
  let StatusIcon = CircleX
  if (reason === "records") {
    title = "Record unavailable"
    message = "A selected record could not be loaded."
    status = "Unavailable"
    StatusIcon = CircleSlash
  } else if (reason === "interrupted") {
    title = "Content incomplete"
    message = "The response ended before this content was ready."
    status = "Interrupted"
    StatusIcon = TriangleAlert
  }
  return (
    <section className={cardStyles.fullCard} aria-label={title}>
      <div className={cardStyles.identity}>
        <div className={cardStyles.eyebrow}>
          <FileText className="size-[13px] shrink-0 text-primary" aria-hidden="true" />
          <span className={cardStyles.kindLabel}>Content</span>
          <span className={styles.status}>
            <StatusIcon className="size-[13px] shrink-0 text-destructive" aria-hidden="true" />
            {status}
          </span>
        </div>
        <h4 className={styles.title}>{title}</h4>
      </div>
      <p className={styles.explanation} role="alert">
        {message}
      </p>
    </section>
  )
}

function RecordLoading() {
  return (
    <output className={`${cardStyles.fullCard} ${styles.loading}`} aria-label="Loading content...">
      <span className="sr-only">Loading content...</span>
      <span className={cardStyles.identity} aria-hidden="true">
        <span className={cardStyles.eyebrow}>
          <FileText className="size-[13px] shrink-0 text-primary" />
          <span className={cardStyles.kindLabel}>Content</span>
          <span className={styles.status}>
            <Spinner className="size-[13px] text-muted-foreground" />
            Reading
          </span>
        </span>
        <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
        <span className={`${styles.skeleton} ${styles.skeletonMeta}`} />
      </span>
      <span className={styles.explanation}>The selected content is being read.</span>
    </output>
  )
}

function ReadyRecord({ block }: ReadyRecordProps) {
  const [selectedVote, setSelectedVote] = useState<PresentationReference>()
  const [meetingSelection, setMeetingSelection] = useState<PresentationReference>()
  const { stopScroll } = useStickToBottomContext()
  const trigger = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const references = presentationReferences(block.spec)
  const reference = references[0]
  const record = block.records[0]
  const element = block.spec.elements[block.spec.root]
  invariant(element && reference && record, "Validated record presentations require a root and resolved records")
  const isGroup = element.type === "RecordGroup" || element.type === "CompactRecordGroup"
  const isCompact = element.type === "CompactRecordCard" || element.type === "CompactRecordGroup"
  const Card = isCompact ? CompactRecordCard : RecordCard
  function onOpenRecord(recordId: string) {
    const selectedReference = references.find((reference) => reference.recordId === recordId)
    if (!selectedReference) {
      return
    }
    stopScroll()
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selection = selectedReference
    if (block.records.find((record) => record.id === recordId)?.kind === "meeting") {
      setMeetingSelection(selection)
    } else {
      setSelectedVote(selection)
    }
  }

  function returnFocus() {
    if (trigger.current?.isConnected) {
      trigger.current.focus({ preventScroll: true })
    } else {
      content.current?.querySelector<HTMLElement>("[data-result-focus]")?.focus({ preventScroll: true })
    }
  }

  return (
    <>
      <div ref={content} className="min-w-0">
        {isGroup ? (
          <RecordGroup
            compact={isCompact}
            items={block.records.map((record, index) => {
              const reference = references[index]
              invariant(reference, "Validated record groups require a reference for each record")
              return { record, resultId: reference.resultId }
            })}
            onOpenRecord={onOpenRecord}
          />
        ) : (
          <Card record={record} resultId={reference.resultId} onOpenVote={onOpenRecord} />
        )}
      </div>
      <VoteDetails selection={selectedVote} onClose={() => setSelectedVote(undefined)} returnFocus={returnFocus} />
      <MeetingDetails
        selection={meetingSelection}
        onClose={() => setMeetingSelection(undefined)}
        returnFocus={returnFocus}
      />
    </>
  )
}

export function ComposedRecord({
  part,
  isRunning,
  citation,
  onEvidence,
  answerId = "inline-content"
}: ComposedRecordProps) {
  const parsed = presentationPartSchema.safeParse(part)
  if (!parsed.success) {
    return <PresentationFailure />
  }
  const block = parsed.data.data
  if (block.state === "error") {
    return <PresentationFailure reason={block.reason} />
  }
  if (block.state === "pending") {
    if (!isRunning) {
      return <PresentationFailure reason="interrupted" />
    }
    return <RecordLoading />
  }
  const element = block.spec.elements[block.spec.root]
  invariant(element, "Validated presentations require a root")
  if (
    element.type === "RecordCard" ||
    element.type === "CompactRecordCard" ||
    element.type === "RecordGroup" ||
    element.type === "CompactRecordGroup"
  ) {
    return <ReadyRecord block={block} />
  }
  invariant(block.content, "Validated content presentations require resolved content")
  return (
    <InlinePresentation
      content={block.content}
      variant={element.type}
      citation={citation}
      onEvidence={onEvidence}
      answerId={answerId}
    />
  )
}
