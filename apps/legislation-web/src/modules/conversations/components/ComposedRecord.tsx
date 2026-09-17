"use client"

import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react"
import { CircleSlash, CircleX, FileText, TriangleAlert } from "lucide-react"
import { createContext, useContext, useRef, useState } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { z } from "zod"
import { Spinner } from "../../../components/ui/spinner"
import {
  answerCatalog,
  presentationBlockSchema,
  presentationReferences,
  type PresentationBlock,
  type PresentationReference
} from "../composition"
import type { EntityCard } from "../entityResults"
import { contentComponentSchema, type PresentationContent, type ContentComponent } from "../presentationContent"
import type { CitationSelection } from "./citationPresentation"
import { useConversationSession } from "./ConversationSession"
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

type RecordContextValue = Readonly<{
  records: EntityCard[]
  references: PresentationReference[]
  onOpenRecord: (recordId: string) => void
}>
const RecordContext = createContext<RecordContextValue | undefined>(undefined)
type TrustedRecordCardProps = Readonly<{ props: PresentationReference }>
type ReadyRecordProps = Readonly<{ block: Extract<PresentationBlock, { state: "ready" }> }>
type ComposedRecordProps = Readonly<{
  part: unknown
  isRunning: boolean
  citation?: CitationSelection
  onEvidence?: (selection: CitationSelection) => void
  answerId?: string
}>
const ContentContext = createContext<
  | Readonly<{
      content: PresentationContent
      variant: ContentComponent
      citation?: CitationSelection
      onEvidence?: (selection: CitationSelection) => void
      answerId: string
    }>
  | undefined
>(undefined)

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

function TrustedRecordCard({ props, compact = false }: TrustedRecordCardProps & { compact?: boolean }) {
  const context = useContext(RecordContext)
  const record = context?.records[0]
  if (
    !context ||
    !record ||
    context.records.length !== 1 ||
    props.resultId !== context.references[0]?.resultId ||
    props.recordId !== record.id
  ) {
    return <PresentationFailure />
  }
  if (compact) {
    return <CompactRecordCard record={record} resultId={props.resultId} onOpenVote={context.onOpenRecord} />
  }
  return <RecordCard record={record} resultId={props.resultId} onOpenVote={context.onOpenRecord} />
}

function TrustedCompactRecordCard({ props }: TrustedRecordCardProps) {
  return <TrustedRecordCard props={props} compact />
}

function TrustedRecordGroup({
  props,
  compact = false
}: Readonly<{ props: { records: PresentationReference[] }; compact?: boolean }>) {
  const context = useContext(RecordContext)
  if (
    !context ||
    props.records.length !== context.records.length ||
    props.records.some(
      (reference, index) =>
        reference.recordId !== context.records[index]?.id || reference.resultId !== context.references[index]?.resultId
    )
  ) {
    return <PresentationFailure />
  }
  return (
    <RecordGroup
      compact={compact}
      items={context.records.map((record, index) => ({ record, resultId: props.records[index]!.resultId }))}
      onOpenRecord={context.onOpenRecord}
    />
  )
}

function TrustedCompactRecordGroup({ props }: Readonly<{ props: { records: PresentationReference[] } }>) {
  return <TrustedRecordGroup props={props} compact />
}

function TrustedContent({ props }: Readonly<{ props: { contentId: string } }>) {
  const context = useContext(ContentContext)
  if (!context || context.content.id !== props.contentId) {
    return <PresentationFailure />
  }
  return <InlinePresentation {...context} />
}

const { registry } = defineRegistry(answerCatalog, {
  components: {
    BillProgressCard: TrustedContent,
    RecordGroup: TrustedRecordGroup,
    CompactRecordGroup: TrustedCompactRecordGroup,
    RecordCard: TrustedRecordCard,
    CompactRecordCard: TrustedCompactRecordCard,
    CitationCard: TrustedContent,
    CompactPassageCard: TrustedContent,
    PassageQuote: TrustedContent,
    ResultList: TrustedContent,
    ProgressPath: TrustedContent,
    RecordTimeline: TrustedContent,
    RollCall: TrustedContent,
    RecordStatus: TrustedContent
  }
})

function ReadyRecord({ block }: ReadyRecordProps) {
  const [selectedVote, setSelectedVote] = useState<PresentationReference>()
  const { meetingSelection, setMeetingSelection } = useConversationSession()
  const { stopScroll } = useStickToBottomContext()
  const trigger = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const references = presentationReferences(block.spec)
  const reference = references[0]
  if (!reference) {
    return <PresentationFailure />
  }
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
        <RecordContext value={{ records: block.records, references, onOpenRecord }}>
          <JSONUIProvider registry={registry}>
            <Renderer spec={block.spec} registry={registry} />
          </JSONUIProvider>
        </RecordContext>
      </div>
      <VoteDetails selection={selectedVote} onClose={() => setSelectedVote(undefined)} returnFocus={returnFocus} />
      <MeetingDetails
        selection={
          references.some(
            (reference) =>
              meetingSelection?.resultId === reference.resultId && meetingSelection.recordId === reference.recordId
          )
            ? meetingSelection
            : undefined
        }
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
  if (block.content) {
    const variant = contentComponentSchema.parse(block.spec.elements[block.spec.root]?.type)
    return (
      <ContentContext value={{ content: block.content, variant, citation, onEvidence, answerId }}>
        <JSONUIProvider registry={registry}>
          <Renderer spec={block.spec} registry={registry} />
        </JSONUIProvider>
      </ContentContext>
    )
  }
  return <ReadyRecord block={block} />
}
