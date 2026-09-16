"use client"

import { useClipboard, useMediaQuery } from "@mantine/hooks"
import { Check, Copy, ExternalLink, X } from "lucide-react"
import { useState } from "react"
import { Button } from "../../../components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "../../../components/ui/sheet"
import { evidenceSourceUrl, formatEvidenceCitation } from "../evidence"
import type { CitationSelection } from "./citationPresentation"
import * as styles from "./ConversationResponse.css"

type EvidencePanelProps = Readonly<{
  selection: CitationSelection | undefined
  onClose: () => void
  returnFocus: () => void
}>

export function EvidencePanel({ selection: currentSelection, onClose, returnFocus }: EvidencePanelProps) {
  const [lastSelection, setLastSelection] = useState(currentSelection)
  if (currentSelection !== undefined && currentSelection !== lastSelection) {
    setLastSelection(currentSelection)
  }
  const selection = currentSelection ?? lastSelection
  const evidence = selection?.evidence
  const sourceUrl = evidence && evidenceSourceUrl(evidence)
  const isNarrow = useMediaQuery("(max-width: 63.99rem)", true)
  const clipboard = useClipboard({ timeout: 1800 })
  return (
    <Sheet
      open={currentSelection !== undefined}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      modal={isNarrow}
    >
      <SheetContent
        className={styles.evidencePanel}
        overlayClassName={styles.overlay}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
        onInteractOutside={(event) => {
          if (!isNarrow) {
            event.preventDefault()
          }
        }}
        aria-describedby={undefined}
      >
        <SheetHeader className="mb-8 flex-row items-center justify-between gap-4 p-0">
          <SheetTitle className="flex items-center gap-2 text-xl font-semibold">
            Source {selection && <span className={styles.citationNumber}>{selection.number}</span>}
          </SheetTitle>
          <SheetClose asChild>
            <Button type="button" size="icon" variant="ghost" aria-label="Close evidence">
              <X aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        {evidence && (
          <div className="space-y-6">
            <h3 className="break-words text-base font-semibold">{evidence.title}</h3>
            <dl className="space-y-3 text-sm">
              {evidence.publisher && (
                <div>
                  <dt className="text-muted-foreground">Publisher</dt>
                  <dd>{evidence.publisher}</dd>
                </div>
              )}
              {evidence.versionLabel && (
                <div>
                  <dt className="text-muted-foreground">Version</dt>
                  <dd>{evidence.versionLabel}</dd>
                </div>
              )}
              {evidence.locator && (
                <div>
                  <dt className="text-muted-foreground">Passage</dt>
                  <dd>{evidence.locator}</dd>
                </div>
              )}
            </dl>
            {evidence.content.state === "available" ? (
              <blockquote className={styles.quote}>{evidence.content.quote}</blockquote>
            ) : (
              <p className="text-sm text-muted-foreground">No passage was retrieved for this source.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {sourceUrl ? (
                <Button asChild variant="outline">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    Open source
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Source unavailable</p>
              )}
              <Button variant="ghost" onClick={() => clipboard.copy(formatEvidenceCitation(evidence))}>
                {clipboard.copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}Copy citation
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
