import type { DocumentComparison } from "@repo/legislation-diffing/comparison"
import { AlertCircle, ExternalLink, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { sourceUrlSchema } from "@/modules/conversations/evidence"
import {
  readComparisonDiff,
  type ComparisonDocumentReference,
  type ComparisonPresentationProps
} from "../comparisonPresentation"
import * as styles from "./ComparisonMetadata.css"

type DocumentReferenceProps = Readonly<{
  side: "Left" | "Right"
  document: ComparisonDocumentReference
  displayLabel?: string
  validatedSourceUrl?: string
}>

function DocumentReference({ side, document, displayLabel, validatedSourceUrl }: DocumentReferenceProps) {
  const source = sourceUrlSchema.safeParse(validatedSourceUrl)
  return (
    <div className={styles.document}>
      <p className={styles.side}>
        <FileText size={14} aria-hidden="true" />
        {side} document
      </p>
      {displayLabel && <p className={styles.displayLabel}>{displayLabel}</p>}
      <dl className={styles.identity}>
        <div>
          <dt>Document ID</dt>
          <dd className={styles.identifier}>{document.id}</dd>
        </div>
        <div>
          <dt>Content hash</dt>
          <dd className={styles.hash}>{document.contentHash}</dd>
        </div>
      </dl>
      {source.success && (
        <a className={styles.source} href={source.data} target="_blank" rel="noreferrer noopener">
          Open {side.toLowerCase()} source
          <ExternalLink size={14} aria-hidden="true" />
          <span className={styles.visuallyHidden}> (opens in a new tab)</span>
        </a>
      )}
    </div>
  )
}

const countLabels = [
  ["addedLines", "Added lines"],
  ["deletedLines", "Deleted lines"]
] as const

function HunkCounts({ comparison }: Readonly<{ comparison: DocumentComparison }>) {
  const counts = readComparisonDiff(comparison)
  return (
    <div className={styles.summary}>
      <p className={styles.summaryLabel}>Line changes</p>
      <dl className={styles.counts} aria-label="Line change counts">
        {countLabels.map(([classification, label]) => (
          <div key={classification} className={styles.count}>
            <dt>{label}</dt>
            <dd>{counts[classification]}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.caption}>Counts describe text lines, not legal changes.</p>
    </div>
  )
}

export type ComparisonMetadataProps = ComparisonPresentationProps

export function ComparisonMetadata({
  state,
  leftDisplayLabel,
  rightDisplayLabel,
  leftValidatedSourceUrl,
  rightValidatedSourceUrl,
  onRetry
}: ComparisonMetadataProps) {
  const documents = state.status === "ready" ? state.comparison : state
  return (
    <div className={styles.root}>
      <div className={styles.documents}>
        <DocumentReference
          side="Left"
          document={documents.left}
          displayLabel={leftDisplayLabel}
          validatedSourceUrl={leftValidatedSourceUrl}
        />
        <DocumentReference
          side="Right"
          document={documents.right}
          displayLabel={rightDisplayLabel}
          validatedSourceUrl={rightValidatedSourceUrl}
        />
      </div>
      {state.status === "ready" && <HunkCounts comparison={state.comparison} />}
      {state.status === "loading" && (
        <output className={styles.notice}>
          <Spinner />
          Loading text comparison...
        </output>
      )}
      {state.status === "error" && (
        <div className={styles.error} role="alert">
          <p className={styles.notice}>
            <AlertCircle size={18} aria-hidden="true" />
            Couldn&apos;t load the text comparison.
          </p>
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
      {state.status === "unavailable" && (
        <output className={styles.unavailable}>
          <span className={styles.summaryLabel}>Text comparison unavailable</span>
          <span className={styles.caption}>No comparison result is available for these documents.</span>
        </output>
      )}
    </div>
  )
}
