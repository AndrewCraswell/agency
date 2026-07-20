import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { RootLayout } from "./RootLayout"

const route = vi.hoisted(() => ({ pathname: "/workflows" }))

vi.mock("@tanstack/react-router", () => ({
  createLink:
    () =>
    ({ children, icon, to, onClick }: { children: ReactNode; icon: ReactNode; to: string; onClick?: () => void }) => (
      <a href={to} onClick={onClick}>
        {icon}
        {children}
      </a>
    ),
  Outlet: () => <div>Route content</div>,
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: route.pathname } })
}))

describe("RootLayout", () => {
  it("collapses for workflows and preserves manual choices within each route area", async () => {
    const view = render(
      <AppShell>
        <RootLayout />
      </AppShell>
    )

    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Expand navigation" }))
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument()

    route.pathname = "/"
    view.rerender(
      <AppShell>
        <RootLayout />
      </AppShell>
    )
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Collapse navigation" }))
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument()
  })
})
