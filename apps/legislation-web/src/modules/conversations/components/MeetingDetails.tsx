"use client"

import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Button } from "../../../components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../../../components/ui/sheet"
import { ResultExpiredError, formatMeetingWhen } from "../entityResults"
import type { MeetingDetails as MeetingData } from "../recordDetails"
import { useConversationSession } from "./ConversationSession"
import { ResultBadge } from "./ResultBadge"
import * as shared from "./ConversationResponse.css"
import * as styles from "./MeetingDetails.css"
import * as drawer from "./VoteDetails.css"

type Selection = { resultId: string; recordId: string }

function MeetingContent({ selection }: Readonly<{ selection: Selection }>) {
  const { loadMeetingDetails } = useConversationSession()
  const load = useEffectEvent(loadMeetingDetails)
  const [details, setDetails] = useState<MeetingData>()
  const [failure, setFailure] = useState<"expired" | "failed">()
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(0)
  const notice = useRef<HTMLDivElement>(null)
  const agenda = useRef<HTMLOListElement>(null)
  const shouldFocus = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const result = await load(selection.resultId, selection.recordId, controller.signal)
        if (!controller.signal.aborted) {
          setDetails(result)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure(error instanceof ResultExpiredError ? "expired" : "failed")
        }
      }
    }
    void read()
    return () => controller.abort()
  }, [selection.resultId, selection.recordId, attempt])
  useEffect(() => {
    if (failure) {
      notice.current?.focus()
    }
  }, [failure])
  useEffect(() => {
    if (shouldFocus.current) {
      agenda.current?.querySelector<HTMLElement>("li")?.focus()
      shouldFocus.current = false
    }
  }, [page])
  if (failure) {
    return (
      <div ref={notice} role="alert" tabIndex={-1} className={styles.body}>
        <p>
          {failure === "expired"
            ? "This result has expired. Ask a new question to retrieve current results."
            : "Meeting details could not be loaded. Try again."}
        </p>
        {failure === "expired" ? (
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        ) : (
          <Button
            variant="outline"
            onClick={() => {
              setFailure(undefined)
              setAttempt(attempt + 1)
            }}
          >
            Try again
          </Button>
        )}
      </div>
    )
  }
  if (!details) {
    return (
      <output className={styles.body}>
        <LoaderCircle className={shared.spinner} aria-hidden="true" />
        Loading meeting details...
      </output>
    )
  }
  const summary = details.record.meetingSummary
  const when = summary ? formatMeetingWhen(summary) : undefined
  const items = details.agenda.slice(page * 20, (page + 1) * 20)
  return (
    <>
      <div className={styles.body}>
        <h3 className={styles.title}>{details.record.title}</h3>
        {details.isPartial && <p className={styles.note}>Only part of this record was retrieved.</p>}
        <div className={styles.facts}>
          {when && <p>{when}</p>}
          {summary?.timezone && <p className={styles.note}>{summary.timezone}</p>}
          {summary?.location && <p>{summary.location}</p>}
          {summary?.status && <ResultBadge outcome={summary.status} />}
        </div>
        {details.description && <p>{details.description}</p>}
        <section aria-label="Agenda">
          <h4 className={styles.heading}>Agenda</h4>
          {items.length ? (
            <ol ref={agenda} className={styles.list}>
              {items.map((item, index) => (
                <li key={item.id} tabIndex={-1} className={styles.agendaItem}>
                  <span className={styles.note}>{new Intl.NumberFormat().format(page * 20 + index + 1)}</span>
                  <div>
                    <p>{item.title}</p>
                    {item.description && <p className={styles.note}>{item.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.note}>No agenda items were returned.</p>
          )}
          {details.agenda.length > 20 && (
            <nav aria-label="Agenda pages" className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                aria-label="Previous agenda items"
                disabled={page === 0}
                onClick={() => {
                  shouldFocus.current = true
                  setPage(page - 1)
                }}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <output className={styles.note}>
                {new Intl.NumberFormat().format(page * 20 + 1)}
                {"\u2013"}
                {new Intl.NumberFormat().format(page * 20 + items.length)}
              </output>
              <Button
                variant="outline"
                aria-label="Next agenda items"
                disabled={(page + 1) * 20 >= details.agenda.length}
                onClick={() => {
                  shouldFocus.current = true
                  setPage(page + 1)
                }}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </nav>
          )}
        </section>
        {details.participants.length > 0 && (
          <section aria-label="Listed participants">
            <h4 className={styles.heading}>Listed participants</h4>
            <ul className={styles.list}>
              {details.participants.map((person) => (
                <li key={person.id}>
                  <p>{person.name}</p>
                  {person.role && <p className={styles.note}>{person.role}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {details.documents.length > 0 && (
          <section aria-label="Materials">
            <h4 className={styles.heading}>Materials</h4>
            <ul className={styles.list}>
              {details.documents.map((document) => (
                <li key={document.id}>
                  <Link
                    className="text-primary underline underline-offset-4"
                    href={`/records/material/${encodeURIComponent(document.id)}?${new URLSearchParams({ result: selection.resultId, parent: selection.recordId })}`}
                  >
                    {document.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {details.record.sourceUrl && (
        <SheetFooter className={styles.footer}>
          <a href={details.record.sourceUrl} target="_blank" rel="noopener noreferrer" className={drawer.source}>
            <ExternalLink className="size-3.5" aria-hidden="true" />
            View source
          </a>
        </SheetFooter>
      )}
    </>
  )
}

export function MeetingDetails({
  selection,
  onClose,
  returnFocus
}: Readonly<{ selection: Selection | undefined; onClose: () => void; returnFocus: () => void }>) {
  return (
    <Sheet
      open={selection !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <SheetContent
        className={`${drawer.panel} ${styles.panel}`}
        overlayClassName={shared.overlay}
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <SheetHeader className={`${drawer.header} ${styles.header}`}>
          <SheetTitle className={drawer.heading}>Meeting</SheetTitle>
          <SheetClose asChild>
            <Button size="icon" variant="ghost" aria-label="Close meeting">
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        {selection && <MeetingContent key={`${selection.resultId}:${selection.recordId}`} selection={selection} />}
      </SheetContent>
    </Sheet>
  )
}
