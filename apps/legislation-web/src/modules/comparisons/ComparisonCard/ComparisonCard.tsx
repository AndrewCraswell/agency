"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ComparisonMetadata } from "../ComparisonMetadata/ComparisonMetadata"
import type { ComparisonPresentationProps } from "../comparisonPresentation"
import { DiffViewer } from "../DiffViewer/DiffViewer"
import * as styles from "./ComparisonCard.css"

export type ComparisonCardProps = ComparisonPresentationProps &
  Readonly<{
    defaultOpen?: boolean
  }>

export function ComparisonCard({ defaultOpen = false, ...presentation }: ComparisonCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const headingId = useId()
  const { state } = presentation
  const isViewerOpen = isOpen && state.status === "ready"
  return (
    <section className={styles.root} aria-labelledby={headingId} aria-busy={state.status === "loading"}>
      <Collapsible open={isViewerOpen} onOpenChange={setIsOpen}>
        <div className={styles.header}>
          <h2 id={headingId} className={styles.heading}>
            Document comparison
          </h2>
          {state.status === "ready" && (
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" className={styles.trigger}>
                {isViewerOpen ? "Close text comparison" : "Open text comparison"}
                {isViewerOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        {!isViewerOpen && (
          <>
            <ComparisonMetadata {...presentation} />
            {state.status === "ready" &&
              state.comparison.counts.added === 0 &&
              state.comparison.counts.changed === 0 &&
              state.comparison.counts.removed === 0 && (
                <output className={styles.unchanged}>No textual differences found.</output>
              )}
          </>
        )}
        <CollapsibleContent>
          <DiffViewer {...presentation} />
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
