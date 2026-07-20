import { ModalRenderer } from "@1js/fluentui-modal-manager"
import { FluentProvider, Toaster, webLightTheme } from "@fluentui/react-components"
import type { ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { appToasterId } from "@/hooks/useAppToast"
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
    <ErrorBoundary FallbackComponent={FallbackError}>
      <Toaster toasterId={appToasterId} position="top-end" pauseOnHover pauseOnWindowBlur />
      {children}
      <ModalRenderer />
    </ErrorBoundary>
  </FluentProvider>
)
