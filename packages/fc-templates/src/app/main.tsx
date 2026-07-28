import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { router } from "./router.tsx"
import "./styles.css"

const container = document.getElementById("root")
if (!container) {
  throw new Error("index.html is missing the #root element")
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
