import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"
import { FallbackError } from "./FallbackError"

describe("FallbackError", () => {
  it("shows an Error message and calls reset when retried", async () => {
    const resetErrorBoundary = vi.fn<() => void>()
    const user = userEvent.setup()

    render(
      <AppShell>
        <FallbackError error={new Error("Boom")} resetErrorBoundary={resetErrorBoundary} />
      </AppShell>
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Boom")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(resetErrorBoundary).toHaveBeenCalledOnce()
  })

  it("falls back to a generic message for non-Error values", () => {
    render(
      <AppShell>
        <FallbackError error="oops" resetErrorBoundary={vi.fn<() => void>()} />
      </AppShell>
    )

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument()
  })
})
