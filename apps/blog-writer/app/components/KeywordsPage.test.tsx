import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { OpportunityRow } from "../persistence/opportunity-repository.server"
import { KeywordsPage } from "./KeywordsPage"
import type { KeywordsPageProps } from "./KeywordsPage"

afterEach(cleanup)

// The admin injects this global at runtime, so a test rendering the page has to stand in for it.
const toast = vi.fn<(message: string, options?: { action?: string }) => void>()
vi.stubGlobal("shopify", { toast: { show: toast } })

const market = { countryCode: "US", languageCode: "en", locationName: "United States" }

function opportunity(overrides: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    clusterId: "cluster-a",
    detector: "competitor_gap",
    verdict: "new_article",
    supporting: [
      { detector: "rising_demand", verdict: "new_article", evidence: ["Demand rose 40% over three months"] }
    ],
    scope: null,
    evidence: ["Three competitors hold the top ten and the store holds nothing"],
    score: 0.724,
    scoreComponents: [{ name: "demand", value: 0.3, reason: "5,000 searches a month across the set" }],
    cluster: {
      headKeyword: "snowboard height chart",
      keywords: ["snowboard height chart", "snowboard size chart", "what size snowboard do i need"],
      keywordCount: 6,
      demand: 5000,
      headDemand: 3200,
      difficulty: 24.5,
      mainIntent: "informational",
      ourBestPosition: null,
      competitorDomains: ["evo.com", "the-house.com"]
    },
    claim: null,
    isDismissed: false,
    ...overrides
  }
}

function renderKeywords(overrides: Partial<KeywordsPageProps> = {}) {
  const props: KeywordsPageProps = {
    market,
    lastImport: null,
    list: {
      importId: "import-1",
      measuredAt: new Date().toISOString(),
      calibration: null,
      opportunities: [opportunity()],
      suppressed: []
    },
    actionResult: null,
    ...overrides
  }
  const router = createMemoryRouter([{ path: "/", element: <KeywordsPage {...props} /> }])
  return render(<RouterProvider router={router} />)
}

describe("KeywordsPage", () => {
  it("dates the figures so a stale number is not read as a current one", () => {
    const { container } = renderKeywords({
      list: {
        importId: "import-1",
        measuredAt: "2026-03-04T12:00:00.000Z",
        calibration: null,
        opportunities: [opportunity()],
        suppressed: []
      }
    })

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Keywords")
    expect(container.querySelector("s-section")).toHaveTextContent("Collected Mar 4, 2026")
  })

  it("sends an unresolved market to settings instead of showing numbers", () => {
    const { container } = renderKeywords({ market: null })

    const banner = container.querySelector('s-banner[slot="supplemental-start"]')
    expect(banner).toHaveAttribute("heading", "Search isn't measured yet")
    expect(container.querySelector("s-table")).not.toBeInTheDocument()
    expect(container.querySelector('s-link[href="/app/settings"]')).toBeInTheDocument()
  })

  it("shows one banner at a time, with the unresolved market outranking a running import", () => {
    const { container } = renderKeywords({
      market: null,
      lastImport: {
        importId: "import-2",
        status: "running",
        trigger: "manual",
        requestedAt: new Date().toISOString(),
        completedAt: null,
        rowCount: 0,
        cost: "0",
        errorCode: null,
        domains: []
      }
    })

    const banners = container.querySelectorAll('s-banner[slot="supplemental-start"]')
    expect(banners).toHaveLength(1)
    expect(banners[0]).toHaveAttribute("heading", "Search isn't measured yet")
  })

  it("gives a cluster one row carrying its shape, its numbers, and its recommendation", () => {
    const { container } = renderKeywords()

    const rows = container.querySelectorAll("s-table-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent("Competitor gap")
    expect(rows[0]).toHaveTextContent("snowboard height chart")
    expect(rows[0]).toHaveTextContent("6 terms")
    expect(rows[0]).toHaveTextContent("Write a new article")
    expect(rows[0]).toHaveTextContent("25,000")
    expect(rows[0]).toHaveTextContent("24.5")
  })

  it("opens the score components without leaving the list", () => {
    const { container } = renderKeywords()

    // The list is interleaved so one rule cannot fill it, so the score has to be on the row for the order to read.
    expect(container.querySelectorAll("s-table-row")[0]?.children[3]).toHaveTextContent("72")
    const popover = container.querySelector("s-popover#keyword-score-cluster-a")
    // The score is kept as a fraction of one and shown out of a hundred, so a row reads in whole points.
    expect(popover).toHaveTextContent("It scores 72 out of 100")
    expect(popover).toHaveTextContent("How many people search for it")
    expect(popover).toHaveTextContent("5,000 searches a month across the set")
    expect(popover).toHaveTextContent("Three competitors hold the top ten and the store holds nothing")
    // The rules that did not decide the recommendation are noise next to the score that did.
    expect(popover).not.toHaveTextContent("Rising demand")
    expect(container.querySelector('s-button[commandfor="keyword-score-cluster-a"]')).toHaveTextContent(
      "Why this ranks here"
    )
  })

  it("notes the work a subject already produced beside the subject, not in place of the action", () => {
    const { container } = renderKeywords({
      list: {
        importId: "import-1",
        measuredAt: new Date().toISOString(),
        calibration: null,
        opportunities: [
          opportunity({ claim: { kind: "idea", id: "idea-1", title: "How to size a snowboard", count: 2 } })
        ],
        suppressed: []
      }
    })

    expect(screen.getByText("2 ideas in your plan")).toBeInTheDocument()
    expect(screen.getByText("Generate an idea")).toBeInTheDocument()
    expect(container.querySelector('s-link[href="/app/plan"]')).toBeInTheDocument()
  })

  it("lets the merchant drop and add terms before spending a generation", () => {
    const { container } = renderKeywords()

    fireEvent.click(screen.getByText("Generate an idea"))

    const modal = container.querySelector("s-modal#keyword-generate-modal")
    expect(modal?.querySelector('s-text-area[name="focus"]')).toHaveAttribute("value", "snowboard height chart")
    expect(modal?.querySelector('s-select[name="ideaType"]')).toHaveAttribute("value", "any")

    const chips = [...(modal?.querySelectorAll("s-clickable-chip") ?? [])]
    expect(chips).toHaveLength(3)
    expect(chips[1]).toHaveTextContent("snowboard size chart")

    fireEvent.click(screen.getByText("Add"))
    expect(modal?.querySelectorAll("s-clickable-chip")).toHaveLength(3)
  })

  it("announces a generated idea without leaving a banner on the list", () => {
    const { container } = renderKeywords({ actionResult: { ok: true, intent: "generateIdea" } })

    expect(toast).toHaveBeenCalledWith("Idea added to your plan", expect.objectContaining({ action: "View plan" }))
    expect(container.querySelector('s-banner[tone="success"]')).toBeNull()
  })

  it("keeps dismissal out of the row's plain reach and behind a reason", () => {
    const { container } = renderKeywords()

    expect(screen.getByText("Generate an idea")).toBeInTheDocument()
    const menu = container.querySelector("s-menu#keyword-actions-cluster-a")
    expect(menu).toHaveTextContent("Dismiss this subject")
    expect(container.querySelector('s-modal#keyword-dismiss-modal s-text-area[name="reason"]')).toHaveAttribute(
      "label",
      "Why is it not worth writing?"
    )
  })

  it("offers a dismissed cluster its way back from the set-aside view", () => {
    const { container } = renderKeywords({
      list: {
        importId: "import-1",
        measuredAt: new Date().toISOString(),
        calibration: null,
        opportunities: [],
        suppressed: [opportunity({ isDismissed: true, verdict: "no_action" })]
      }
    })

    // The default view holds only what is worth writing, so a dismissed cluster starts out of sight.
    expect(container.querySelectorAll("s-table-row")).toHaveLength(0)
    expect(container.querySelector('s-select[name="view"]')).toBeInTheDocument()
  })

  it("tells a store with no collection what to do instead of showing an empty table", () => {
    const { container } = renderKeywords({
      list: { importId: null, measuredAt: null, calibration: null, opportunities: [], suppressed: [] }
    })

    expect(
      screen.getByText("Collect keyword data to see which subjects are worth writing about, and why.")
    ).toBeInTheDocument()
    expect(container.querySelector("s-table")).not.toBeInTheDocument()
  })
})
