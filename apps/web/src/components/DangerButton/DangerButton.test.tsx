import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { DangerButton } from "./DangerButton"

describe("DangerButton", () => {
  it("forwards button content, icons, and interactions", async () => {
    const onClick = vi.fn<() => void>()
    render(
      <AppShell>
        <DangerButton icon={<span data-testid="icon" />} onClick={onClick}>
          Delete workflow
        </DangerButton>
      </AppShell>
    )

    const button = screen.getByRole("button", { name: "Delete workflow" })
    expect(button).toContainElement(screen.getByTestId("icon"))
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
