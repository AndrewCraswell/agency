import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import invariant from "tiny-invariant"
import { AppShell } from "@/components/AppShell/AppShell"
import { router } from "./router"
import "the-new-css-reset/css/reset.css"
import "./style.css"

const container = document.getElementById("app")
invariant(container, "Root container #app was not found in the document")

createRoot(container).render(
  <StrictMode>
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  </StrictMode>
)
