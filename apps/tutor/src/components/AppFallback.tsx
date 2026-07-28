import { Button, Text, Title2, tokens } from "@fluentui/react-components"
import type { FallbackProps } from "react-error-boundary"

export function AppFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        alignItems: "flex-start",
        padding: tokens.spacingVerticalXXL
      }}
    >
      <Title2>The skills atlas could not load</Title2>
      <Text>{error instanceof Error ? error.message : "An unexpected error occurred."}</Text>
      <Button appearance="primary" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  )
}
