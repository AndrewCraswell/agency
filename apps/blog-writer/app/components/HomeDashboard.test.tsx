import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { HomeArticle, HomeOverview } from "../persistence/home-overview-repository.server"
import { HomeDashboard } from "./HomeDashboard"

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"))
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("HomeDashboard", () => {
  const emptyOverview: HomeOverview = {
    articles: [],
    articleCounts: { draft: 0, needs_review: 0, ready_to_publish: 0, published: 0, needs_attention: 0, failed: 0 },
    ideasToReview: 0,
    scheduledIdeaCount: 0,
    scheduledIdeas: [],
    unscheduledIdeaCount: 0,
    generatingCount: 0,
    failedJobs: []
  }

  function createArticle(overrides: Partial<HomeArticle> = {}): HomeArticle {
    return {
      articleId: "22222222-2222-4222-8222-222222222222",
      title: "Wet-weather camping",
      status: "needs_review",
      updatedAt: "2026-07-23T12:00:00.000Z",
      hasUnpublishedChanges: false,
      proposedCrosslinkCount: 0,
      proposedFurtherReadingCount: 0,
      staleLinkCount: 0,
      publishedAt: null,
      shopifyArticleUrl: null,
      ...overrides
    }
  }

  function renderHome(overrides: Partial<React.ComponentProps<typeof HomeDashboard>> = {}) {
    const props: React.ComponentProps<typeof HomeDashboard> = {
      syncStatus: "ready",
      activeResourceCount: 31,
      lastSynchronizedAt: "2026-07-26T09:00:00.000Z",
      subscribedSourceCount: 1,
      overview: emptyOverview,
      ...overrides
    }
    const router = createMemoryRouter([
      { path: "/", element: <HomeDashboard {...props} /> },
      { path: "/app/articles/:articleId", element: <p>Article detail</p> },
      { path: "/app/plan", element: <p>Plan</p> }
    ])
    return { ...render(<RouterProvider router={router} />), router }
  }

  it("guides a new store through setup before any editorial work exists", () => {
    const { container } = renderHome({ syncStatus: "pending", lastSynchronizedAt: null, subscribedSourceCount: 0 })

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Home")
    expect(screen.getByText("Three steps to your first draft.")).toBeInTheDocument()
    expect(screen.getByText("Sync your store content")).toBeInTheDocument()
    expect(screen.getByText("Store content hasn't been synced yet.")).toBeInTheDocument()
    expect(container.querySelector('s-section[heading="Needs attention"]')).not.toBeInTheDocument()
  })

  it("marks a completed setup step as done", () => {
    const { container } = renderHome({ subscribedSourceCount: 2 })

    const setup = container.querySelector('s-section[heading="Get set up"]')
    expect(setup?.querySelectorAll('s-badge[tone="success"]')).toHaveLength(2)
  })

  it("ranks a failed job above work that only needs review", () => {
    renderHome({
      overview: {
        ...emptyOverview,
        articles: [createArticle()],
        failedJobs: [
          {
            jobId: "44444444-4444-4444-8444-444444444444",
            jobType: "draft_generation",
            lastErrorCode: "upstream_unavailable",
            failedAt: "2026-07-26T08:00:00.000Z"
          }
        ]
      }
    })

    const headings = screen.getAllByText(/didn't finish|Wet-weather camping/)

    expect(headings[0]).toHaveTextContent("Draft generation didn't finish")
    expect(screen.getByText(/with the error upstream_unavailable/)).toBeInTheDocument()
  })

  it("opens the article that needs attention", async () => {
    // Router navigation settles on real timers, and this case asserts a destination rather than a relative time.
    vi.useRealTimers()
    const { container, router } = renderHome({
      overview: { ...emptyOverview, articles: [createArticle({ status: "needs_attention", staleLinkCount: 2 })] }
    })

    expect(
      screen.getByText("Something this article links to has changed, so 2 links are out of date.")
    ).toBeInTheDocument()

    fireEvent.click(container.querySelector("s-clickable")!)

    await waitFor(() => expect(screen.getByText("Article detail")).toBeInTheDocument())
    expect(router.state.location.pathname).toBe("/app/articles/22222222-2222-4222-8222-222222222222")
  })

  it("counts the pipeline and the links waiting for a decision", () => {
    const { container } = renderHome({
      overview: {
        ...emptyOverview,
        articles: [createArticle({ proposedCrosslinkCount: 2, proposedFurtherReadingCount: 1 })],
        articleCounts: {
          draft: 1,
          needs_review: 2,
          ready_to_publish: 1,
          published: 4,
          needs_attention: 0,
          failed: 0
        },
        ideasToReview: 3,
        scheduledIdeaCount: 5,
        generatingCount: 1
      }
    })

    expect(container.querySelector('s-clickable[accessibilitylabel="Ideas to review, 3"]')).toBeInTheDocument()
    expect(container.querySelector('s-clickable[accessibilitylabel="In review, 3"]')).toBeInTheDocument()
    expect(container.querySelector('s-clickable[accessibilitylabel="Published, 4"]')).toBeInTheDocument()
    expect(screen.getByText("2 storefront links")).toBeInTheDocument()
    expect(screen.getByText("1 further reading")).toBeInTheDocument()
    expect(screen.queryByText("Links to decide")).not.toBeInTheDocument()
  })

  it("lists an article once when several things are outstanding", () => {
    renderHome({
      overview: {
        ...emptyOverview,
        articles: [
          createArticle({
            title: "Trail food that travels",
            status: "needs_review",
            hasUnpublishedChanges: true,
            proposedCrosslinkCount: 2
          })
        ],
        articleCounts: { ...emptyOverview.articleCounts, needs_review: 1 }
      }
    })

    expect(screen.getAllByText("Trail food that travels")).toHaveLength(2)
    expect(screen.getByText("A new draft is ready for you to read.")).toBeInTheDocument()
    expect(screen.queryByText("Readers still see the version you published last.")).not.toBeInTheDocument()
  })

  it("lists the week ahead and the approved ideas without a date", () => {
    renderHome({
      overview: {
        ...emptyOverview,
        scheduledIdeaCount: 1,
        scheduledIdeas: [
          { ideaId: "11111111-1111-4111-8111-111111111111", title: "Trail snacks", scheduledFor: "2026-07-28" }
        ],
        unscheduledIdeaCount: 1
      }
    })

    expect(screen.getByText("Trail snacks")).toBeInTheDocument()
    expect(screen.getByText("1 approved idea has no date yet.")).toBeInTheDocument()
  })

  it("reports published work without claiming a search outcome", () => {
    renderHome({
      overview: {
        ...emptyOverview,
        articles: [
          createArticle({
            status: "published",
            publishedAt: "2026-07-24T12:00:00.000Z",
            hasUnpublishedChanges: true
          })
        ],
        articleCounts: { draft: 0, needs_review: 0, ready_to_publish: 0, published: 1, needs_attention: 0, failed: 0 }
      }
    })

    expect(screen.getByText("Published 2 days ago, with newer changes saved")).toBeInTheDocument()
  })

  it("says when nothing needs attention", () => {
    renderHome({
      overview: {
        ...emptyOverview,
        articles: [createArticle({ status: "published", publishedAt: "2026-07-24T12:00:00.000Z" })],
        articleCounts: { draft: 0, needs_review: 0, ready_to_publish: 0, published: 1, needs_attention: 0, failed: 0 }
      }
    })

    expect(screen.getByText("Nothing needs you right now. Your published work is up to date.")).toBeInTheDocument()
  })

  it("describes a failed store sync as recoverable work", () => {
    renderHome({
      syncStatus: "failed",
      overview: { ...emptyOverview, articles: [createArticle({ status: "published" })] }
    })

    expect(screen.getByText("Store sync didn't finish")).toBeInTheDocument()
    expect(screen.getByText("Start the sync again from Settings.")).toBeInTheDocument()
  })
})
