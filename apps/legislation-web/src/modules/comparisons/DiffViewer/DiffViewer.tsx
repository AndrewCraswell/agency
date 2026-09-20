"use client"

import { useMediaQuery } from "@mantine/hooks"
import type { DocumentComparison } from "@repo/legislation-diffing/comparison"
import { useId, useState } from "react"
import {
  Decoration,
  Diff,
  Hunk,
  expandFromRawCode,
  markEdits,
  textLinesToHunk,
  tokenize,
  type GutterOptions
} from "react-diff-view"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ComparisonMetadata } from "../ComparisonMetadata/ComparisonMetadata"
import { readComparisonDiff, type ComparisonPresentationProps } from "../comparisonPresentation"
import "react-diff-view/style/index.css"
import * as styles from "./DiffViewer.css"

export type DiffViewerProps = ComparisonPresentationProps &
  Readonly<{
    defaultShowUnchanged?: boolean
    defaultViewMode?: "unified" | "split"
  }>

function renderGutter({ change, renderDefault }: GutterOptions) {
  let marker = ""
  if (change.type === "insert") {
    marker = "+"
  }
  if (change.type === "delete") {
    marker = "-"
  }
  return (
    <span aria-label={`${change.type} line`}>
      {marker}
      {renderDefault()}
    </span>
  )
}

function ComparisonText({
  comparison,
  defaultShowUnchanged,
  defaultViewMode
}: Readonly<{ comparison: DocumentComparison; defaultShowUnchanged: boolean; defaultViewMode: "unified" | "split" }>) {
  const [showContext, setShowContext] = useState(defaultShowUnchanged)
  const [selectedView, setSelectedView] = useState(defaultViewMode)
  const isNarrow = useMediaQuery("(max-width: 48rem)")
  const viewMode = isNarrow ? "unified" : selectedView
  const contextId = useId()
  const diffId = useId()
  const parsed = readComparisonDiff(comparison)
  const oldSource = comparison.hunks.map((hunk) => hunk.leftText ?? "").join("")
  const lines = oldSource.split("\n")
  if (lines.at(-1) === "") {
    lines.pop()
  }
  const isUnchanged = parsed.addedLines === 0 && parsed.deletedLines === 0
  let hunks = parsed.hunks
  if (showContext && lines.length) {
    if (isUnchanged) {
      const context = textLinesToHunk(lines, 1, 1)
      hunks = context ? [context] : []
    } else {
      hunks = expandFromRawCode(hunks, lines, 1, lines.length + 1)
    }
  }
  const tokens = tokenize(hunks, { highlight: false, enhancers: [markEdits(hunks, { type: "line" })] })
  return (
    <>
      {isUnchanged && (
        <output className={styles.unchangedNotice}>
          No textual differences found.
          {comparison.left.textLength === 0 && comparison.right.textLength === 0 && (
            <span className={styles.emptyNotice}>Both documents contain no text.</span>
          )}
        </output>
      )}
      {(comparison.left.textLength > 0 || comparison.right.textLength > 0) && (
        <div className={styles.toolbar}>
          <fieldset className={styles.viewControls}>
            <legend className={styles.visuallyHidden}>Diff layout</legend>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "unified" ? "secondary" : "outline"}
              aria-pressed={viewMode === "unified"}
              onClick={() => setSelectedView("unified")}
            >
              Unified
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "split" ? "secondary" : "outline"}
              aria-pressed={viewMode === "split"}
              disabled={isNarrow}
              onClick={() => setSelectedView("split")}
            >
              Side by side
            </Button>
          </fieldset>
          <label className={styles.contextControl} htmlFor={contextId}>
            <Checkbox
              id={contextId}
              checked={showContext}
              onCheckedChange={(checked) => setShowContext(checked === true)}
              aria-controls={diffId}
            />
            Show full context
          </label>
        </div>
      )}
      {hunks.length > 0 && (
        <section id={diffId} className={styles.library} aria-label="Document text diff">
          <Diff viewType={viewMode} diffType="modify" hunks={hunks} tokens={tokens} renderGutter={renderGutter}>
            {(visible) =>
              visible.flatMap((hunk) => [
                <Decoration key={`header:${hunk.content}`}>{hunk.content}</Decoration>,
                <Hunk key={hunk.content} hunk={hunk} />
              ])
            }
          </Diff>
        </section>
      )}
    </>
  )
}

export function DiffViewer({
  defaultShowUnchanged = false,
  defaultViewMode = "unified",
  ...presentation
}: DiffViewerProps) {
  const headingId = useId()
  const { state } = presentation
  return (
    <section className={styles.root} aria-labelledby={headingId} aria-busy={state.status === "loading"}>
      <h2 id={headingId} className={styles.heading}>
        Text comparison
      </h2>
      <ComparisonMetadata {...presentation} />
      {state.status === "ready" && (
        <ComparisonText
          key={JSON.stringify([state.comparison.left, state.comparison.right, state.comparison.granularity])}
          comparison={state.comparison}
          defaultShowUnchanged={defaultShowUnchanged}
          defaultViewMode={defaultViewMode}
        />
      )}
    </section>
  )
}
