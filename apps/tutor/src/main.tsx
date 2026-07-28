import { FluentProvider, webLightTheme } from "@fluentui/react-components"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "react-error-boundary"
import invariant from "tiny-invariant"
import { App } from "@/App"
import { AppFallback } from "@/components/AppFallback"
import "the-new-css-reset/css/reset.css"
import "@xyflow/react/dist/style.css"
import "./style.css"

const container = document.getElementById("app")
invariant(container, "Root container #app was not found in the document")

createRoot(container).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <ErrorBoundary FallbackComponent={AppFallback}>
        <App />
      </ErrorBoundary>
    </FluentProvider>
  </StrictMode>
)
