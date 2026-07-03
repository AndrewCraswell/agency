import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { AboutPage } from "./AboutPage"

describe("AboutPage", () => {
  it("renders the about heading", () => {
    render(
      <AppShell>
        <AboutPage />
      </AppShell>
    )
    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
  })
})
