"use client"

import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react"
import { createContext, useContext, useRef, useState } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { z } from "zod"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import {
  answerCatalog,
  comparisonColumns,
  comparisonValue,
  presentationBlockSchema,
  presentationReferences,
  type BillComparisonProps,
  type PresentationBlock,
  type PresentationReference
} from "../composition"
import type { EntityCard } from "../entityResults"
import { useConversationSession } from "./ConversationSession"
import { RecordCard } from "./EntityResults"
import { InlineRecordLink } from "./InlineRecordLink"
import { MeetingDetails } from "./MeetingDetails"
import { VoteDetails } from "./VoteDetails"
import * as styles from "./ComposedRecord.css"

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
type TrustedBillComparisonProps = Readonly<{ props: BillComparisonProps }>
type ReadyRecordProps = Readonly<{ block: Extract<PresentationBlock, { state: "ready" }> }>
type ComposedRecordProps = Readonly<{ part: unknown; isRunning: boolean }>

function RecordUnavailable() {
  return <p className="break-words text-xs text-muted-foreground">This content could not be displayed.</p>
}

function TrustedRecordCard({ props }: TrustedRecordCardProps) {
  const context = useContext(RecordContext)
  const record = context?.records[0]
  if (
    !context ||
    !record ||
    context.records.length !== 1 ||
    props.resultId !== context.references[0]?.resultId ||
    props.recordId !== record.id
  ) {
    return <RecordUnavailable />
  }
  return <RecordCard record={record} resultId={props.resultId} onOpenVote={context.onOpenRecord} />
}

function TrustedBillComparison({ props }: TrustedBillComparisonProps) {
  const context = useContext(RecordContext)
  if (
    !context ||
    props.records.length !== context.records.length ||
    props.records.some(
      (reference, index) =>
        reference.resultId !== context.references[index]?.resultId || reference.recordId !== context.records[index]?.id
    )
  ) {
    return <RecordUnavailable />
  }
  return (
    <Table
      className={styles.table}
      containerProps={{ className: styles.comparison, role: "region", "aria-label": "Bill comparison", tabIndex: 0 }}
    >
      <caption className={styles.caption}>Bill comparison</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className={`${styles.cell} whitespace-normal`}>
            Bill
          </TableHead>
          {props.columns.map((column) => (
            <TableHead key={column} scope="col" className={`${styles.cell} whitespace-normal`}>
              {comparisonColumns[column]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {context.records.map((record, index) => {
          const reference = context.references[index]
          if (!reference) {
            return null
          }
          return (
            <TableRow key={record.id}>
              <TableHead scope="row" className={`${styles.cell} whitespace-normal`}>
                <InlineRecordLink mention={{ record, reference }}>{record.title}</InlineRecordLink>
              </TableHead>
              {props.columns.map((column) => (
                <TableCell key={column} className={`${styles.cell} whitespace-normal`}>
                  {comparisonValue(record, column) ?? <span className={styles.absent}>Not returned</span>}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

const { registry } = defineRegistry(answerCatalog, {
  components: { RecordCard: TrustedRecordCard, BillComparison: TrustedBillComparison }
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
    return <RecordUnavailable />
  }
  const { resultId } = reference

  function onOpenRecord(recordId: string) {
    stopScroll()
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selection = { resultId, recordId }
    if (block.records[0]?.kind === "meeting") {
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
          meetingSelection?.resultId === reference.resultId && meetingSelection.recordId === reference.recordId
            ? meetingSelection
            : undefined
        }
        onClose={() => setMeetingSelection(undefined)}
        returnFocus={returnFocus}
      />
    </>
  )
}

export function ComposedRecord({ part, isRunning }: ComposedRecordProps) {
  const parsed = presentationPartSchema.safeParse(part)
  if (!parsed.success || parsed.data.data.state === "error") {
    return <RecordUnavailable />
  }
  const block = parsed.data.data
  if (block.state === "pending") {
    if (!isRunning) {
      return <RecordUnavailable />
    }
    return <output className="text-xs text-muted-foreground">Loading content...</output>
  }
  return <ReadyRecord block={block} />
}
