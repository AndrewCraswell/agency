import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { AsyncStatus } from "./AsyncStatus"

describe("AsyncStatus", () => {
  it("announces visible pending status politely", () => {
    render(
      <AppShell>
        <AsyncStatus message="Publishing workflow" pending />
      </AppShell>
    )

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-atomic", "true")
    expect(status).toHaveTextContent("Publishing workflow")
  })
})
