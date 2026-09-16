"use client"

import { ArrowLeft, ChevronDown, ExternalLink, LoaderCircle, MessageSquareText } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ResultExpiredError } from "../../lib/entityResults"
import type { ProfileDetails } from "../../lib/recordDetails"
import { AppShell } from "../shell/AppShell"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible"
import { useConversationSession } from "./ConversationSession"
import * as styles from "./RecordProfile.css"

const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))
const materialStates: Record<string, string> = {
  pending: "Text is waiting to be processed.",
  processing: "Text is being prepared.",
  failed: "Text processing failed. The original source may still be available.",
  unsupported: "This format cannot be previewed here.",
  processed: "No readable text was returned."
}

export function RecordProfile({
  kind,
  recordId,
  resultId,
  parentRecordId
}: Readonly<{
  kind: "person" | "organization" | "material"
  recordId: string
  resultId?: string
  parentRecordId?: string
}>) {
  const { chat, loadProfileDetails, isRestoringConversation, references, setReferences } = useConversationSession()
  const router = useRouter()
  const load = useEffectEvent(loadProfileDetails)
  const [details, setDetails] = useState<ProfileDetails>()
  const [failure, setFailure] = useState<"expired" | "failed">()
  const [attempt, setAttempt] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [pageFailed, setPageFailed] = useState(false)
  const notice = useRef<HTMLDivElement>(null)
  const moreRequest = useRef<AbortController | null>(null)
  const isReferenceSelected = references.some((reference) => reference.recordId === recordId)
  function askAboutRecord() {
    if (!resultId || !details || parentRecordId || (!isReferenceSelected && references.length >= 12)) {
      return
    }
    if (!isReferenceSelected) {
      setReferences([...references, { resultId, recordId, record: details.record }])
    }
    router.push(`/conversations/${encodeURIComponent(chat.id)}`)
  }
  useEffect(() => {
    if (isRestoringConversation || !resultId) {
      return
    }
    const controller = new AbortController()
    async function read() {
      try {
        const next = await load(resultId!, recordId, controller.signal, undefined, parentRecordId)
        if (!controller.signal.aborted) {
          if (next.record.kind !== kind) {
            throw new Error("Record kind mismatch")
          }
          setDetails(next)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailure(error instanceof ResultExpiredError ? "expired" : "failed")
        }
      }
    }
    void read()
    return () => {
      controller.abort()
      moreRequest.current?.abort()
    }
  }, [kind, recordId, resultId, parentRecordId, isRestoringConversation, attempt])
  useEffect(() => {
    if (failure) {
      notice.current?.focus()
    }
  }, [failure])
  async function loadMore() {
    if (!resultId || !details?.nextCursor || moreRequest.current) {
      return
    }
    const controller = new AbortController()
    moreRequest.current = controller
    setIsLoadingMore(true)
    setPageFailed(false)
    try {
      const next = await loadProfileDetails(resultId, recordId, controller.signal, details.nextCursor)
      if (next.nextCursor === details.nextCursor || details.sections.length + next.sections.length > 1000) {
        throw new Error("Material continuation did not advance within the display limit")
      }
      if (!controller.signal.aborted) {
        setDetails((current) =>
          current
            ? { ...current, sections: [...current.sections, ...next.sections], nextCursor: next.nextCursor }
            : next
        )
      }
    } catch {
      if (!controller.signal.aborted) {
        setPageFailed(true)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingMore(false)
      }
      moreRequest.current = null
    }
  }
  return (
    <AppShell>
      <main className={styles.content}>
        {isRestoringConversation ? (
          <Button variant="ghost" className={styles.back} disabled>
            <ArrowLeft aria-hidden="true" />
            Back to conversation
          </Button>
        ) : (
          <Link className={styles.back} href={`/conversations/${encodeURIComponent(chat.id)}`}>
            <ArrowLeft aria-hidden="true" />
            Back to conversation
          </Link>
        )}
        {(!resultId || failure) && (
          <div ref={notice} role="alert" tabIndex={-1} className={styles.section}>
            <h1 className={styles.heading}>
              {failure === "failed"
                ? "Record could not be loaded"
                : "This record is no longer available in this conversation"}
            </h1>
            <p>
              {failure === "failed"
                ? "Try again to load the record."
                : "Ask a new question to retrieve current results."}
            </p>
            {failure === "failed" && (
              <Button
                className="self-start"
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
        )}
        {resultId && !failure && !details && (
          <output className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Loading record...
          </output>
        )}
        {details && (
          <>
            <div className={styles.identity}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{details.record.title}</h1>
                {!parentRecordId && (
                  <Button
                    className="h-11 shrink-0"
                    disabled={!isReferenceSelected && references.length >= 12}
                    onClick={askAboutRecord}
                  >
                    <MessageSquareText aria-hidden="true" />
                    Ask
                  </Button>
                )}
              </div>
              {kind === "person" && (details.party || details.officeLabel) && (
                <div className={styles.affiliation}>
                  {details.party && (
                    <Badge variant="secondary" className={styles.party}>
                      {details.party}
                    </Badge>
                  )}
                  {details.officeLabel && <p className={styles.metadata}>{details.officeLabel}</p>}
                </div>
              )}
              {kind === "material" && details.record.subtitle && (
                <p className={styles.metadata}>{details.record.subtitle}</p>
              )}
            </div>
            {kind === "material" ? (
              <>
                <div className={styles.reading}>
                  {details.sections.length ? (
                    details.sections.map((section) => (
                      <section key={section.id} className={styles.section}>
                        {section.heading && <h2 className={styles.heading}>{section.heading}</h2>}
                        <p className={styles.passage}>{section.text}</p>
                      </section>
                    ))
                  ) : (
                    <p>
                      {materialStates[details.processingStatus ?? ""] ?? "Text is not available for this material."}
                    </p>
                  )}
                </div>
                {pageFailed && <p role="alert">More text could not be loaded. Previously loaded text is unchanged.</p>}
                {details.nextCursor && (
                  <Button
                    variant="outline"
                    disabled={isLoadingMore}
                    className="self-start"
                    onClick={() => void loadMore()}
                  >
                    {isLoadingMore ? "Loading text..." : "Load more text"}
                  </Button>
                )}
              </>
            ) : (
              <div className={styles.sections}>
                <section className={styles.section}>
                  <h2 className={styles.heading}>{kind === "person" ? "Public service" : "About"}</h2>
                  {kind === "person" &&
                    (details.terms.length ? (
                      details.terms.map((term) => (
                        <div key={term.id} className={styles.term}>
                          <h3 className="font-medium">{term.title ?? "Recorded term"}</h3>
                          {term.district && <p className={styles.metadata}>District {term.district}</p>}
                          {(term.startDate || term.endDate) && (
                            <p className={styles.metadata}>
                              {term.startDate && <time dateTime={term.startDate}>{date(term.startDate)}</time>}
                              {term.startDate && term.endDate && " to "}
                              {term.endDate && <time dateTime={term.endDate}>{date(term.endDate)}</time>}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className={styles.metadata}>No service history was returned.</p>
                    ))}
                  {kind === "organization" && (
                    <>
                      {details.record.organizationSummary?.classification && (
                        <p>{details.record.organizationSummary.classification}</p>
                      )}
                      {details.description && <p>{details.description}</p>}
                    </>
                  )}
                </section>
              </div>
            )}
            {kind !== "material" && details.record.sourceUrl && (
              <Collapsible className={styles.sources}>
                <CollapsibleTrigger className={`${styles.back} group`}>
                  <ChevronDown className="size-3.5 group-data-[state=open]:rotate-180" aria-hidden="true" />
                  Sources
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <a
                    className={styles.source}
                    href={details.record.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    View source
                  </a>
                </CollapsibleContent>
              </Collapsible>
            )}
            {kind === "material" && details.record.sourceUrl && (
              <Button asChild variant="outline" className="self-start">
                <a href={details.record.sourceUrl} target="_blank" rel="noopener noreferrer">
                  View original source
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}
