"use client"

import { defineRegistry, JSONUIProvider, Renderer } from "@json-render/react"
import { createContext, useContext, useRef, useState } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { z } from "zod"
import {
  answerCatalog,
  presentationBlockSchema,
  type PresentationBlock,
  type PresentationReference
} from "../composition"
import type { EntityCard } from "../entityResults"
import { useConversationSession } from "./ConversationSession"
import { RecordCard } from "./EntityResults"
import { MeetingDetails } from "./MeetingDetails"
import { VoteDetails } from "./VoteDetails"

const presentationPartSchema = z
  .object({
    type: z.literal("data-presentation"),
    id: z.string().min(1).max(128),
    data: presentationBlockSchema
  })
  .refine((part) => part.id === part.data.blockId)

type RecordContextValue = Readonly<{
  record: EntityCard
  reference: PresentationReference
  onOpenRecord: (recordId: string) => void
}>
const RecordContext = createContext<RecordContextValue | undefined>(undefined)
type TrustedRecordCardProps = Readonly<{ props: PresentationReference }>
type ReadyRecordProps = Readonly<{ block: Extract<PresentationBlock, { state: "ready" }> }>
type ComposedRecordProps = Readonly<{ part: unknown; isRunning: boolean }>

function RecordUnavailable() {
  return <p className="break-words text-xs text-muted-foreground">This record could not be displayed.</p>
}

function TrustedRecordCard({ props }: TrustedRecordCardProps) {
  const context = useContext(RecordContext)
  if (!context || props.resultId !== context.reference.resultId || props.recordId !== context.record.id) {
    return <RecordUnavailable />
  }
  return <RecordCard record={context.record} resultId={context.reference.resultId} onOpenVote={context.onOpenRecord} />
}

const { registry } = defineRegistry(answerCatalog, { components: { RecordCard: TrustedRecordCard } })

function ReadyRecord({ block }: ReadyRecordProps) {
  const [selectedVote, setSelectedVote] = useState<PresentationReference>()
  const { meetingSelection, setMeetingSelection } = useConversationSession()
  const { stopScroll } = useStickToBottomContext()
  const trigger = useRef<HTMLElement | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const reference = block.spec.elements[block.spec.root]?.props
  if (!reference) {
    return <RecordUnavailable />
  }
  const { resultId } = reference

  function onOpenRecord(recordId: string) {
    stopScroll()
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selection = { resultId, recordId }
    if (block.record.kind === "meeting") {
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
        <RecordContext value={{ record: block.record, reference, onOpenRecord }}>
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
    return <output className="text-xs text-muted-foreground">Loading record...</output>
  }
  return <ReadyRecord block={block} />
}
