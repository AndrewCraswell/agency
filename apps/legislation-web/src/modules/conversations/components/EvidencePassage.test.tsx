// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import {
  billVersionCitationFixtures,
  markdownEvidenceFixture,
  qualifiedEvidenceFixture
} from "./citationEvidenceFixtures"
import { EvidencePanel } from "./EvidencePanel"
import { EvidencePassage } from "./EvidencePassage"

afterEach(cleanup)

it.each(billVersionCitationFixtures)(
  "preserves the projected bill heading and version in the panel: $title",
  async (evidence) => {
    render(
      <EvidencePanel
        selection={{ answerId: "bill-version-fixture", number: 1, evidence }}
        onClose={() => undefined}
        returnFocus={() => undefined}
      />
    )
    const panel = within(await screen.findByRole("dialog", { name: "Source 1" }))
    expect(panel.getByRole("heading", { name: evidence.title })).toBeDefined()
    expect(panel.getByText(evidence.versionLabel!)).toBeDefined()
    expect(panel.getByText("Section 2")).toBeDefined()
    expect(panel.getByRole("link", { name: "Open source" }).getAttribute("href")).toBe(evidence.sourceUrl)
  }
)

it("renders safe Markdown structure and literal code without executing source HTML", () => {
  const { container } = render(
    <EvidencePassage
      className=""
      quote={[
        "## Retained heading",
        "",
        "| Claim | Context |",
        "| --- | --- |",
        "| Exact words | Before<br>after |",
        "",
        "[Source](https://publisher.example/text) and [Unsafe](javascript:alert(1)).",
        "",
        "![Remote image](https://publisher.example/tracking.png)",
        "",
        "<script>alert('source HTML')</script>",
        "",
        "<button>Not an interactive source control</button>",
        "",
        "`<br>` and `[7](#citation-e549]`"
      ].join("\n")}
    />
  )
  expect(screen.getByRole("heading", { name: "Retained heading" })).toBeDefined()
  expect(screen.getByRole("cell", { name: "Exact words" })).toBeDefined()
  expect(container.querySelectorAll("br")).toHaveLength(1)
  expect(screen.getByRole("link", { name: "Source" }).getAttribute("rel")).toBe("noopener noreferrer")
  expect(screen.queryByRole("link", { name: "Unsafe" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Not an interactive source control" })).toBeNull()
  expect(container.querySelector("script, img, iframe, form")).toBeNull()
  expect([...container.querySelectorAll("code")].map((node) => node.textContent)).toEqual([
    "<br>",
    "[7](#citation-e549]"
  ])
})

it.each([markdownEvidenceFixture, qualifiedEvidenceFixture])(
  "shows all retained context and the partial-read disclosure in the evidence panel: $title",
  async (evidence) => {
    render(
      <EvidencePanel
        selection={{ answerId: "markdown-fixture", number: 1, evidence }}
        onClose={() => undefined}
        returnFocus={() => undefined}
      />
    )
    const panel = within(await screen.findByRole("dialog", { name: "Source 1" }))
    expect(panel.getByRole("heading", { name: evidence.title })).toBeDefined()
    expect(panel.getByText("Synthetic regression fixture")).toBeDefined()
    expect(panel.getByText("Only part of the retrieved passage is shown.")).toBeDefined()
    expect(panel.getByText("Qualification:")).toBeDefined()
    expect(panel.getByRole("link", { name: "Open source" }).getAttribute("href")).toBe(evidence.sourceUrl)
    expect(panel.queryByRole("button", { name: /Show full/ })).toBeNull()
  }
)
