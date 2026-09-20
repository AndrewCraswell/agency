import { render, type RenderResult } from "@testing-library/react"
import { StrictMode, type ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"

function ComparisonTestShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <StrictMode>
      <ErrorBoundary fallback={<p role="alert">Comparison render failed.</p>}>{children}</ErrorBoundary>
    </StrictMode>
  )
}

export function renderComparison(element: ReactNode): RenderResult {
  return render(element, { wrapper: ComparisonTestShell })
}
