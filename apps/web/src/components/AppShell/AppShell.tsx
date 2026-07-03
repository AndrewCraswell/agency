import { FluentProvider, webLightTheme } from "@fluentui/react-components"
import type { ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { FallbackError } from "./FallbackError"

interface AppShellProps {
  children: ReactNode
}

/**
 * App-wide providers: the Fluent UI theme and a top-level error boundary.
 * Wrap the app (and Storybook stories / tests) with this so every surface gets
 * the same context.
 */
export const AppShell = ({ children }: AppShellProps) => (
  <FluentProvider theme={webLightTheme}>
    <ErrorBoundary FallbackComponent={FallbackError}>{children}</ErrorBoundary>
  </FluentProvider>
)
