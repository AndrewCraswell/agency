"use client"

import { captureException } from "@sentry/nextjs"
import { StrictMode, type ReactNode } from "react"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"
import { ThemeProvider } from "../theme/ThemeProvider"
import { Button } from "../ui/button"
import { TooltipProvider } from "../ui/tooltip"
import { ConversationSession } from "./ConversationSession"

type ChatProvidersProps = Readonly<{ children: ReactNode }>

function ChatErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl">The conversation could not be displayed</h1>
      <Button className="self-start" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </main>
  )
}

export function ChatProviders({ children }: ChatProvidersProps) {
  return (
    <StrictMode>
      <ThemeProvider>
        <ErrorBoundary
          FallbackComponent={ChatErrorFallback}
          onError={(error) => {
            captureException(error, { tags: { operation: "react_boundary" } })
          }}
        >
          <TooltipProvider delayDuration={300}>
            <ConversationSession>{children}</ConversationSession>
          </TooltipProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </StrictMode>
  )
}
