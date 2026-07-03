import { Button, Text, Title2, tokens } from "@fluentui/react-components"
import type { FallbackProps } from "react-error-boundary"

/** Top-level error UI rendered by the app shell's error boundary. */
export const FallbackError = ({ error, resetErrorBoundary }: FallbackProps) => (
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
    <Title2>Something went wrong</Title2>
    <Text>{error instanceof Error ? error.message : "An unexpected error occurred."}</Text>
    <Button appearance="primary" onClick={resetErrorBoundary}>
      Try again
    </Button>
  </div>
)
