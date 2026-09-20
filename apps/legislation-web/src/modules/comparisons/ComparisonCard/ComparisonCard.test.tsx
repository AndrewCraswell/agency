// @vitest-environment happy-dom
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { pendingDocuments, stateWordingExample, unchangedExample } from "../comparisonTestExamples"
import { renderComparison as render } from "../comparisonTestUtils"
import { ComparisonCard } from "./ComparisonCard"

afterEach(cleanup)

describe("ComparisonCard", () => {
  it("shows document identities and factual text-hunk counts before expansion", () => {
    render(<ComparisonCard {...stateWordingExample} />)
    const { comparison } = stateWordingExample.state
    expect(screen.getByText(comparison.left.id)).toBeTruthy()
    expect(screen.getByText(comparison.right.id)).toBeTruthy()
    expect(screen.getByLabelText("Line change counts").textContent).toContain("Added lines1")
    expect(screen.getByRole("button", { name: "Open text comparison" }).getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("region", { name: "Text comparison" })).toBeNull()
  })

  it("opens the shared viewer with Enter and collapses with Space while preserving trigger focus", async () => {
    const user = userEvent.setup()
    render(<ComparisonCard {...stateWordingExample} />)
    const trigger = screen.getByRole("button", { name: "Open text comparison" })
    await user.tab()
    expect(document.activeElement).toBe(trigger)
    await user.keyboard("{Enter}")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("region", { name: "Text comparison" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Close text comparison" })).toBe(trigger)
    expect(screen.getAllByText(stateWordingExample.state.comparison.left.id)).toHaveLength(1)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Unified" }))
    await user.tab({ shift: true })
    await user.keyboard(" ")
    expect(screen.queryByRole("region", { name: "Text comparison" })).toBeNull()
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(trigger)
    expect(screen.getByLabelText("Line change counts")).toBeTruthy()
  })

  it("can start expanded and preserves display labels and validated sources in the viewer", () => {
    render(
      <ComparisonCard
        {...stateWordingExample}
        defaultOpen
        leftValidatedSourceUrl="https://example.org/left"
        rightValidatedSourceUrl="https://example.org/right"
      />
    )
    expect(screen.getByRole("region", { name: "Text comparison" })).toBeTruthy()
    expect(screen.getByText(stateWordingExample.leftDisplayLabel)).toBeTruthy()
    expect(screen.getByText(stateWordingExample.rightDisplayLabel)).toBeTruthy()
    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(screen.getByRole("link", { name: "Open left source (opens in a new tab)" }).getAttribute("href")).toBe(
      "https://example.org/left"
    )
  })

  it("clearly identifies unchanged text but still allows inspection", async () => {
    const user = userEvent.setup()
    render(<ComparisonCard {...unchangedExample} />)
    expect(screen.getByRole("status").textContent).toBe("No textual differences found.")
    await user.click(screen.getByRole("button", { name: "Open text comparison" }))
    await user.click(screen.getByRole("checkbox", { name: "Show full context" }))
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getAllByText("No textual differences found.")).toHaveLength(1)
  })

  it.each(["loading", "error", "unavailable"] as const)(
    "does not expose an empty viewer or stale counts when %s",
    (status) => {
      const view = render(<ComparisonCard {...stateWordingExample} defaultOpen />)
      view.rerender(<ComparisonCard state={{ status, ...pendingDocuments }} defaultOpen />)
      expect(screen.queryByRole("region", { name: "Text comparison" })).toBeNull()
      expect(screen.queryByRole("button", { name: /text comparison/ })).toBeNull()
      expect(screen.queryByLabelText("Line change counts")).toBeNull()
      expect(screen.queryByText("No textual differences found.")).toBeNull()
      expect(screen.getByText(pendingDocuments.left.id)).toBeTruthy()
      expect(screen.getByText(pendingDocuments.right.id)).toBeTruthy()
      expect(screen.getByRole(status === "error" ? "alert" : "status")).toBeTruthy()
    }
  )

  it("delegates retry to the host", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn<() => void>()
    render(<ComparisonCard state={{ status: "error", ...pendingDocuments }} onRetry={onRetry} />)
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "Open text comparison" })).toBeNull()
  })

  it("gives separate open cards distinct disclosure controls", async () => {
    const user = userEvent.setup()
    render(
      <>
        <ComparisonCard {...stateWordingExample} />
        <ComparisonCard {...unchangedExample} />
      </>
    )
    const controls = screen.getAllByRole("button", { name: "Open text comparison" })
    await user.click(controls[0])
    await user.click(controls[1])
    expect(controls[0]?.getAttribute("aria-controls")).toBeTruthy()
    expect(controls[0]?.getAttribute("aria-controls")).not.toBe(controls[1]?.getAttribute("aria-controls"))
  })
})
