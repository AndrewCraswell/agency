import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppFallback } from "./AppFallback"

describe("AppFallback", () => {
  it("shows the error and lets the viewer retry", async () => {
    const reset = vi.fn<(...args: unknown[]) => void>()
    const user = userEvent.setup()

    render(<AppFallback error={new Error("Graph unavailable")} resetErrorBoundary={reset} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Graph unavailable")

    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it("uses a safe message for an unknown error value", () => {
    render(<AppFallback error="unknown" resetErrorBoundary={vi.fn<(...args: unknown[]) => void>()} />)
    expect(screen.getByRole("alert")).toHaveTextContent("An unexpected error occurred.")
  })
})
