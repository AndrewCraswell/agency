import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ErrorBoundary } from "react-error-boundary"
import { TooltipProvider } from "@/components/ui/tooltip"
import { App } from "./App"
import "./styles.css"

const root = document.querySelector("#root")

if (!(root instanceof HTMLElement)) throw new Error("Simulator root element is unavailable")

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary fallback={<p role="alert">The scoring simulator could not be displayed.</p>}>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>
)
