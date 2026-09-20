// @vitest-environment happy-dom
import { compareDocuments } from "@repo/legislation-diffing/comparison"
import { cleanup, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  chapterCollisionExample,
  pendingDocuments,
  stateWordingExample,
  unchangedExample
} from "../comparisonTestExamples"
import { renderComparison as render } from "../comparisonTestUtils"
import { DiffViewer } from "./DiffViewer"

afterEach(cleanup)

function comparison(left: string, right: string) {
  return compareDocuments({
    left: { id: "left", contentHash: "a".repeat(64), text: left },
    right: { id: "right", contentHash: "b".repeat(64), text: right },
    granularity: "word"
  })
}

describe("library diff viewer", () => {
  it("preserves document identity and labels line counts without legal conclusions", () => {
    render(<DiffViewer {...chapterCollisionExample} />)
    expect(screen.getByText(chapterCollisionExample.state.comparison.left.id)).toBeTruthy()
    expect(screen.getByText(chapterCollisionExample.state.comparison.right.id)).toBeTruthy()
    expect(screen.getByLabelText("Line change counts")).toBeTruthy()
    expect(screen.getByText("Counts describe text lines, not legal changes.")).toBeTruthy()
    expect(screen.getByRole("table")).toBeTruthy()
  })

  it("inserts blank cells and aligns retained lines after multiline insertions", () => {
    const result = comparison("First.\nRetained.\nLast.\n", "First.\nInserted one.\nInserted two.\nRetained.\nLast.\n")
    const { container } = render(<DiffViewer state={{ status: "ready", comparison: result }} defaultViewMode="split" />)
    const inserted = screen.getByText("Inserted one.").closest("tr")
    expect(inserted?.querySelector(".diff-code-omit")).toBeTruthy()
    const retained = screen.getAllByText("Retained.")
    expect(retained).toHaveLength(2)
    expect(retained[0].closest("tr")).toBe(retained[1].closest("tr"))
    const gutters = retained[0].closest("tr")?.querySelectorAll(".diff-gutter")
    expect(gutters?.[0].textContent).toBe("2")
    expect(gutters?.[1].textContent).toBe("4")
    expect(container.querySelectorAll(".diff-code-insert")).toHaveLength(2)
  })

  it("leaves gaps on the right after deletion and supports a unified view", async () => {
    const user = userEvent.setup()
    render(
      <DiffViewer
        state={{ status: "ready", comparison: comparison("First.\nRemoved.\nKept.\n", "First.\nKept.\n") }}
        defaultViewMode="split"
      />
    )
    const removed = screen.getByText("Removed.").closest("tr")
    expect(removed?.querySelector(".diff-code-omit")).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Unified" }))
    expect(screen.getByRole("button", { name: "Unified" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getAllByText("Kept.")).toHaveLength(1)
    expect(screen.getByText("Removed.")).toBeTruthy()
  })

  it("expands identical text with an accessible context control", async () => {
    const user = userEvent.setup()
    render(<DiffViewer {...unchangedExample} />)
    expect(screen.getByRole("status").textContent).toContain("No textual differences found.")
    expect(screen.queryByRole("table")).toBeNull()
    const checkbox = screen.getByRole("checkbox", { name: "Show full context" })
    checkbox.focus()
    await user.keyboard(" ")
    expect(checkbox.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("table")).toBeTruthy()
    expect(screen.getByText("Retained text.")).toBeTruthy()
  })

  it("distinguishes empty texts from unavailable data", () => {
    render(<DiffViewer state={{ status: "ready", comparison: comparison("", "") }} />)
    expect(screen.getByText("Both documents contain no text.")).toBeTruthy()
    expect(screen.queryByRole("table")).toBeNull()
  })

  it.each(["loading", "error", "unavailable"] as const)("keeps %s distinct from an unchanged result", (status) => {
    render(<DiffViewer state={{ status, ...pendingDocuments }} />)
    expect(screen.queryByLabelText("Line change counts")).toBeNull()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("No textual differences found.")).toBeNull()
    expect(screen.getByRole(status === "error" ? "alert" : "status")).toBeTruthy()
  })

  it("delegates retry and preserves safe source links", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn<() => void>()
    const view = render(<DiffViewer state={{ status: "error", ...pendingDocuments }} onRetry={onRetry} />)
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
    view.rerender(<DiffViewer {...stateWordingExample} leftValidatedSourceUrl="https://example.org/source" />)
    expect(screen.getByRole("link", { name: "Open left source (opens in a new tab)" }).getAttribute("href")).toBe(
      "https://example.org/source"
    )
  })

  it("renders source markup literally and uses library inline highlights", () => {
    const { container } = render(
      <DiffViewer
        state={{
          status: "ready",
          comparison: comparison("Keep <b>old</b> text.\n", "Keep <script>new</script> text.\n")
        }}
      />
    )
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("b")).toBeNull()
    expect(container.querySelector(".diff-code-edit")).toBeTruthy()
  })
})
