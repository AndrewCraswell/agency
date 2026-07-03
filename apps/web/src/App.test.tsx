import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { ApiMock } from "@/tests/server"
import { App } from "./App"

const renderApp = () =>
  render(
    <AppShell>
      <App />
    </AppShell>
  )

describe("App", () => {
  it("renders the header and default message", () => {
    renderApp()
    expect(screen.getByRole("heading", { name: "Web" })).toBeInTheDocument()
    expect(screen.getByText("Welcome to the web app")).toBeInTheDocument()
  })

  it("loads and shows the welcome message from the API", async () => {
    ApiMock.get("/api/welcome", { data: { message: "Hello from the mock" } })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole("button", { name: /load message/i }))

    expect(await screen.findByText("Hello from the mock")).toBeInTheDocument()
  })
})
