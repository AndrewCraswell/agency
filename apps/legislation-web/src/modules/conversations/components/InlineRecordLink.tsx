"use client"

import type { UIMessage } from "ai"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import { useId, useRef, useState, type ReactNode } from "react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { z } from "zod"
import { recordMentionHref, type PresentationReference } from "../composition"
import { entityPageSchema, type EntityCard } from "../entityResults"
import { recordHref } from "./EntityResults"
import { MeetingDetails } from "./MeetingDetails"
import { VoteDetails } from "./VoteDetails"
import * as styles from "./ConversationResponse.css"

type Mention = Readonly<{ reference: PresentationReference; record: EntityCard }>
type InlineRecordLinkProps = Readonly<{ mention: Mention; children: ReactNode }>
type InspectRecordProps = InlineRecordLinkProps & Readonly<{ descriptionId: string }>
const resultSchema = z.object({ resultSet: entityPageSchema })

export function responseRecordMentions(message: UIMessage) {
  const mentions = new Map<string, Mention>()
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool" || part.state !== "output-available") {
      continue
    }
    const result = resultSchema.safeParse(part.output)
    if (!result.success) {
      continue
    }
    for (const record of result.data.resultSet.items) {
      const reference = { resultId: result.data.resultSet.id, recordId: record.id }
      mentions.set(recordMentionHref(reference), { reference, record })
    }
  }
  return mentions
}

function InspectRecord({ mention, children, descriptionId }: InspectRecordProps) {
  const [isOpen, setIsOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const { stopScroll } = useStickToBottomContext()
  const selection = isOpen ? mention.reference : undefined
  const returnFocus = () => trigger.current?.focus({ preventScroll: true })
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.recordMention}
        aria-describedby={descriptionId}
        onClick={() => {
          stopScroll()
          setIsOpen(true)
        }}
      >
        {children}
      </button>
      {mention.record.kind === "meeting" ? (
        <MeetingDetails selection={selection} onClose={() => setIsOpen(false)} returnFocus={returnFocus} />
      ) : (
        <VoteDetails selection={selection} onClose={() => setIsOpen(false)} returnFocus={returnFocus} />
      )}
    </>
  )
}

export function InlineRecordLink({ mention, children }: InlineRecordLinkProps) {
  const { record, reference } = mention
  const descriptionId = useId()
  const href = recordHref(record, reference.resultId)
  const description =
    href && !href.startsWith("/") ? `Open record in a new tab: ${record.title}` : `Open record: ${record.title}`
  let link: ReactNode
  if (record.kind === "vote" || record.kind === "meeting") {
    link = (
      <InspectRecord mention={mention} descriptionId={descriptionId}>
        {children}
      </InspectRecord>
    )
  } else if (href) {
    link = (
      <Link
        href={href}
        target={href.startsWith("/") ? undefined : "_blank"}
        rel={href.startsWith("/") ? undefined : "noopener noreferrer"}
        className={styles.recordMention}
        aria-describedby={descriptionId}
      >
        {children}
        {!href.startsWith("/") && <ExternalLink className="ml-1 inline size-3" aria-hidden="true" />}
      </Link>
    )
  } else {
    return <span>{children}</span>
  }
  return (
    <>
      {link}
      <span id={descriptionId} hidden>
        {description}
      </span>
    </>
  )
}
