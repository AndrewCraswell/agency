import { RouterProvider } from "@tanstack/react-router"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { router } from "@/router"
import { ApiMock } from "@/tests/server"

describe("NotFoundPage", () => {
  it("returns an unknown address to Operations", async () => {
    ApiMock.get("/api/control-plane/runs", {
      data: { schemaVersion: "1", fetchedAt: "2026-07-20T09:00:00.000Z", agents: [], runs: [] }
    })
    ApiMock.get("/api/control-plane/work-items", {
      data: {
        schemaVersion: "1",
        fetchedAt: "2026-07-20T09:00:00.000Z",
        items: [],
        total: 0,
        previousCursor: null,
        nextCursor: null,
        aggregates: {
          all: 0,
          todo: 0,
          inProgress: 0,
          blocked: 0,
          repositories: [],
          assignees: [],
          priorities: []
        }
      }
    })
    window.history.pushState({}, "", "/unsupported-address")

    render(
      <AppShell>
        <NuqsTestingAdapter>
          <RouterProvider router={router} />
        </NuqsTestingAdapter>
      </AppShell>
    )

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("link", { name: "Go to Operations" }))
    expect(await screen.findByRole("heading", { name: "Operations" })).toBeInTheDocument()
    expect(window.location.pathname).toBe("/")
  })
})
