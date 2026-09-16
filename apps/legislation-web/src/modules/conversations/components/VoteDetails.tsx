"use client"

import { ChevronLeft, ChevronRight, ExternalLink, LoaderCircle, RotateCcw, X } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Button } from "../../../components/ui/button"
import { Progress } from "../../../components/ui/progress"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "../../../components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table"
import { ResultExpiredError } from "../entityResults"
import type { VoteDetails as VoteDetailsData } from "../recordDetails"
import { useConversationSession } from "./ConversationSession"
import { ResultBadge } from "./ResultBadge"
import * as shared from "./ConversationResponse.css"
import * as styles from "./VoteDetails.css"

type Selection = Readonly<{ resultId: string; recordId: string }>
const positionLabels: Record<string, string> = {
  yes: "Yes",
  no: "No",
  absent: "Absent",
  abstain: "Abstain",
  "not-voting": "Not voting",
  present: "Present",
  proxy: "Proxy",
  paired: "Paired",
  other: "Other"
}

export function VoteDetails({
  selection,
  onClose,
  returnFocus
}: Readonly<{
  selection: Selection | undefined
  onClose: () => void
  returnFocus: () => void
}>) {
  const { loadVoteDetails } = useConversationSession()
  const [details, setDetails] = useState<VoteDetailsData>()
  const [failure, setFailure] = useState<{ message: string; isExpired: boolean }>()
  const failureNotice = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(selection !== undefined)
  const [attempt, setAttempt] = useState(0)
  const [positionPage, setPositionPage] = useState(0)
  const positionsSection = useRef<HTMLElement>(null)
  const shouldFocusPosition = useRef(false)
  const [requested, setRequested] = useState({ selection, attempt })
  if (selection && (selection !== requested.selection || attempt !== requested.attempt)) {
    setRequested({ selection, attempt })
    setIsLoading(true)
    setFailure(undefined)
    setDetails(undefined)
    setPositionPage(0)
  }
  const load = useEffectEvent(loadVoteDetails)
  useEffect(() => {
    if (!selection) {
      return
    }
    const controller = new AbortController()
    const { resultId, recordId } = selection
    async function fetchDetails() {
      try {
        const next = await load(resultId, recordId, controller.signal)
        if (!controller.signal.aborted) {
          setDetails(next)
          setIsLoading(false)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure({
            message:
              error instanceof ResultExpiredError
                ? "This result has expired. Ask a new question to retrieve current results."
                : "Vote details could not be loaded. Try again.",
            isExpired: error instanceof ResultExpiredError
          })
          setIsLoading(false)
        }
      }
    }
    void fetchDetails()
    return () => controller.abort()
  }, [selection, attempt])
  useEffect(() => {
    if (failure) {
      failureNotice.current?.focus({ preventScroll: true })
    }
  }, [failure])
  useEffect(() => {
    if (shouldFocusPosition.current) {
      positionsSection.current?.querySelector<HTMLElement>("tbody th")?.focus()
      shouldFocusPosition.current = false
    }
  }, [positionPage])
  const positions = details?.positions.slice(positionPage * 25, (positionPage + 1) * 25) ?? []
  const total = details?.record.tallies.reduce((sum, tally) => sum + tally.value, 0) ?? 0
  function navigatePositions(nextPage: number) {
    if (!details || nextPage < 0 || nextPage * 25 >= details.positions.length) {
      return
    }
    shouldFocusPosition.current = true
    setPositionPage(nextPage)
  }
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
        className={styles.panel}
        overlayClassName={shared.overlay}
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <SheetHeader className={styles.header}>
          <SheetTitle className={styles.heading}>Vote details</SheetTitle>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close vote details">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        {isLoading && (
          <output className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className={shared.spinner} aria-hidden="true" />
            Loading vote details...
          </output>
        )}
        {failure && (
          <div
            ref={failureNotice}
            tabIndex={-1}
            role="alert"
            className="space-y-3 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <p>{failure.message}</p>
            {failure.isExpired ? (
              <SheetClose asChild>
                <Button variant="outline">
                  <X aria-hidden="true" />
                  Close
                </Button>
              </SheetClose>
            ) : (
              <Button variant="outline" onClick={() => setAttempt(attempt + 1)}>
                <RotateCcw aria-hidden="true" />
                Try again
              </Button>
            )}
          </div>
        )}
        {details && (
          <>
            <div className={styles.facts}>
              <h3 className={styles.motion}>{details.record.title}</h3>
              {details.heldAt && (
                <time className={styles.date} dateTime={details.heldAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC"
                  }).format(new Date(details.heldAt))}
                </time>
              )}
              {details.record.voteSummary?.outcome && <ResultBadge outcome={details.record.voteSummary.outcome} />}
            </div>
            {details.record.tallies.length > 0 && (
              <section aria-label="Reported counts" className={styles.tallies}>
                <h3 className={styles.label}>Reported counts</h3>
                <dl>
                  {details.record.tallies.map((tally) => (
                    <div
                      key={tally.label}
                      className={styles.tally}
                      data-has-proportion={details.hasCompleteTally && total > 0}
                    >
                      <dt>{tally.label}</dt>
                      {details.hasCompleteTally && total > 0 && (
                        <dd>
                          <Progress
                            className={styles.meter}
                            data-option={tally.label.toLowerCase()}
                            aria-label={`${tally.label} proportion`}
                            max={total}
                            value={tally.value}
                          />
                        </dd>
                      )}
                      <dd className={styles.count} data-option={tally.label.toLowerCase()}>
                        {new Intl.NumberFormat().format(tally.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            <section ref={positionsSection} aria-label="Published positions">
              <h3 className={styles.positionHeading}>Published positions</h3>
              {positions.length > 0 ? (
                <Table className={styles.positions}>
                  <TableHeader className="sr-only">
                    <TableRow>
                      <TableHead scope="col">Member</TableHead>
                      <TableHead scope="col">Position</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableHead scope="row" tabIndex={-1} className={styles.positionName}>
                          {position.name ?? "Name not published"}
                        </TableHead>
                        <TableCell className={styles.positionOption}>
                          {positionLabels[position.option] ?? position.option}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-3 text-sm text-muted-foreground">No member positions were returned.</p>
              )}
            </section>
            <dl className={styles.coverage}>
              <dt>Positions shown</dt>
              <dd>{new Intl.NumberFormat().format(positions.length)}</dd>
            </dl>
            {details.positions.length > 25 && (
              <nav aria-label="Published positions pages" className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  disabled={positionPage === 0}
                  onClick={() => navigatePositions(positionPage - 1)}
                  aria-label="Previous positions"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <output aria-live="polite" className={styles.label}>
                  {new Intl.NumberFormat().format(positionPage * 25 + 1)}
                  {"\u2013"}
                  {new Intl.NumberFormat().format(positionPage * 25 + positions.length)}
                </output>
                <Button
                  variant="outline"
                  disabled={(positionPage + 1) * 25 >= details.positions.length}
                  onClick={() => navigatePositions(positionPage + 1)}
                  aria-label="Next positions"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </nav>
            )}
            {details.record.sourceUrl && (
              <SheetFooter className={styles.footer}>
                <a
                  className={styles.source}
                  href={details.record.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View source (opens in new tab)"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  View source
                </a>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
