import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { ArticlesPage } from "./ArticlesPage"

afterEach(cleanup)

describe("ArticlesPage", () => {
  function renderArticles(articles: React.ComponentProps<typeof ArticlesPage>["articles"] = []) {
    const router = createMemoryRouter([{ path: "/", element: <ArticlesPage articles={articles} /> }])
    return render(<RouterProvider router={router} />)
  }

  it("shows a focused empty state", () => {
    const { container } = renderArticles()

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Articles")
    expect(
      screen.getByText("No articles are ready for review. Generate a draft from an idea to start one.")
    ).toBeInTheDocument()
    expect(container.querySelector('s-link[href="/app/plan"]')).toBeInTheDocument()
  })

  it("opens each article detail page and shows typed suggestion counts", async () => {
    const articles: React.ComponentProps<typeof ArticlesPage>["articles"] = [
      {
        articleId: "22222222-2222-4222-8222-222222222222",
        title: "Wet-weather camping",
        excerpt: "Prepare a campsite for rain.",
        status: "needs_review",
        updatedAt: "2026-07-23T12:00:00.000Z",
        linkTypeCounts: { product: 2, collection: 1, blog: 0, article: 3, page: 1 }
      }
    ]
    const router = createMemoryRouter([
      { path: "/", element: <ArticlesPage articles={articles} /> },
      { path: "/app/articles/:articleId", element: <p>Article detail</p> }
    ])
    const { container } = render(<RouterProvider router={router} />)

    const openCard = container.querySelector('s-clickable[accessibilitylabel="Open Wet-weather camping"]')

    expect(openCard).toBeInTheDocument()
    expect(container.querySelector("s-badge")).toHaveTextContent("Needs review")
    expect(screen.getByRole("group", { name: "Link suggestions by type" })).toHaveTextContent(
      "2 products1 collection3 articles1 page"
    )

    fireEvent.click(openCard!)

    await waitFor(() => expect(screen.getByText("Article detail")).toBeInTheDocument())
    expect(router.state.location.pathname).toBe("/app/articles/22222222-2222-4222-8222-222222222222")
  })

  it("tells merchants when an article has no link suggestions", () => {
    renderArticles([
      {
        articleId: "33333333-3333-4333-8333-333333333333",
        title: "Trail snacks",
        excerpt: "Pack food that survives a long day out.",
        status: "ready_to_publish",
        updatedAt: "2026-07-24T09:30:00.000Z",
        linkTypeCounts: { product: 0, collection: 0, blog: 0, article: 0, page: 0 }
      }
    ])

    expect(screen.getByText("No link suggestions yet")).toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Link suggestions by type" })).not.toBeInTheDocument()
  })
})
