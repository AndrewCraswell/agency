import { StrictMode, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { capturedAt } from "./comparisonExamples"
import * as styles from "./ComparisonExampleFrame.css"

type ComparisonExampleFrameProps = Readonly<{
  children: ReactNode
  description: string
}>

export function ComparisonExampleFrame({ children, description }: ComparisonExampleFrameProps) {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Database document comparison</h1>
        <p className={styles.description}>{description}</p>
        <p className={styles.disclaimer}>
          Real stored documents captured {capturedAt.slice(0, 10)}. Diffs are computed locally from the snapshots.
          Extraction artifacts are preserved; this is not a legal interpretation.
        </p>
      </header>
      <StrictMode>
        <ErrorBoundary fallback={<p role="alert">The comparison example could not be rendered.</p>}>
          {children}
        </ErrorBoundary>
      </StrictMode>
    </div>
  )
}
