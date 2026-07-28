import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, describe, expect, it } from "vitest"
import { SettingsPage } from "./SettingsPage"

afterEach(cleanup)

describe("SettingsPage", () => {
  const resourceCounts = { product: 24, collection: 8, blog: 2, article: 6, page: 2 }
  const keywordImport = { market: null, competitorDomains: [], lastImport: null }
  const supportedMarkets = [
    { countryCode: "US", languageCode: "en", locationName: "United States" },
    { countryCode: "CA", languageCode: "fr", locationName: "Canada" }
  ]

  function renderSettings(props: Partial<React.ComponentProps<typeof SettingsPage>> = {}) {
    const element = (
      <SettingsPage
        syncStatus="ready"
        activeResourceCount={42}
        activeResourceCounts={resourceCounts}
        embeddedResourceCount={42}
        contentDrift="current"
        lastSynchronizedAt="2026-07-23T12:00:00.000Z"
        brandBrief=""
        competitorDomains={[]}
        subscribedBlogs={[]}
        keywordImport={keywordImport}
        supportedMarkets={supportedMarkets}
        actionResult={null}
        {...props}
      />
    )
    const router = createMemoryRouter([{ path: "/", element }])
    return { ...render(<RouterProvider router={router} />), router }
  }

  it("lists store content and source settings", () => {
    const { container } = renderSettings()

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Settings")
    expect(screen.getByRole("group", { name: "Synced resources by type" })).toHaveTextContent(
      "Products24Collections8Blogs2Articles6Pages2Total synced42"
    )
    // Being copied across and being usable are different facts, and the merchant is told which one they have.
    expect(screen.getByText("All of your content is ready to use.")).toBeInTheDocument()
    expect(screen.getByText(/Last synced Jul 23, 2026/)).toBeInTheDocument()
    expect(container.querySelector('s-section[heading="Competitor domains"]')).toBeInTheDocument()
    expect(container.querySelector('s-text-field[name="competitorDomain"]')).toHaveAttribute(
      "label",
      "Competitor domain"
    )
    expect(screen.getByText("No competitor domains have been added.")).toBeInTheDocument()
    expect(container.querySelector('s-section[heading="Subscribed blogs"]')).toBeInTheDocument()
    expect(container.querySelector('s-text-field[name="blogAddress"]')).toHaveAttribute("label", "Blog address")
    expect(screen.getByText("No blogs have been added.")).toBeInTheDocument()
  })

  it("separates content that is synced from content that can be used", () => {
    // A sync finishes in seconds and the preparation behind it takes minutes, so a store that reports only the sync
    // sends the merchant off to use a feature that has nothing to answer them with yet.
    renderSettings({ embeddedResourceCount: 0 })
    expect(
      screen.getByText("Preparing your content for search. Store-specific ideas and links wait until this finishes.")
    ).toBeInTheDocument()

    renderSettings({ embeddedResourceCount: 30 })
    expect(screen.getByText("30 of 42 items are ready to use. We're still preparing the rest.")).toBeInTheDocument()
  })

  it("renders competitor domains and subscribed blogs with tenant actions", () => {
    const { container } = renderSettings({
      competitorDomains: ["competitor.example"],
      subscribedBlogs: [
        {
          hostname: "publisher.example",
          url: "https://publisher.example/blog/",
          title: "Publisher blog",
          lastSynchronizedAt: "2026-07-22T10:00:00.000Z"
        }
      ]
    })

    expect(screen.getByText("competitor.example")).toBeInTheDocument()
    expect(container.querySelector('s-button[accessibilitylabel="Remove competitor.example"]')).toBeInTheDocument()
    expect(container.querySelector('s-link[href="https://publisher.example/blog/"]')).toHaveTextContent(
      "Publisher blog"
    )
    expect(screen.getByText("publisher.example")).toBeInTheDocument()
    expect(
      container.querySelector('s-button[accessibilitylabel="Unsubscribe from Publisher blog"]')
    ).toBeInTheDocument()
  })

  it("summarizes the last keyword collection", () => {
    const { container } = renderSettings({
      keywordImport: {
        market: { countryCode: "US", locationName: "United States", languageCode: "en" },
        competitorDomains: ["competitor.example"],
        lastImport: {
          importId: "import-1",
          status: "succeeded",
          trigger: "manual",
          requestedAt: "2026-07-24T09:00:00.000Z",
          completedAt: "2026-07-24T09:00:30.000Z",
          rowCount: 1500,
          cost: "0.792000",
          errorCode: null,
          domains: [
            {
              domain: "shop.example",
              isOwnDomain: true,
              status: "succeeded",
              rowCount: 500,
              availableRowCount: 500,
              domainRank: 12,
              errorCode: null
            },
            {
              domain: "competitor.example",
              isOwnDomain: false,
              status: "succeeded",
              rowCount: 1000,
              availableRowCount: 27401,
              domainRank: 78,
              errorCode: null
            }
          ]
        }
      }
    })

    expect(container.querySelector('s-select[name="marketCountryCode"]')).toHaveAttribute("value", "US")
    expect(container.querySelector('s-select[name="marketLanguageCode"]')).toHaveAttribute("value", "en")
    expect(screen.getByText("Your store")).toBeInTheDocument()
    expect(screen.getByText("1,000 of 27,401 keywords")).toBeInTheDocument()
    expect(screen.getByText(/Last collected Jul 24, 2026/)).toBeInTheDocument()
  })

  it.each([
    ["pending", "Not synced"],
    ["syncing", "Syncing"],
    ["failed", "Sync failed"]
  ] as const)("badges the %s synchronization state", (syncStatus, badge) => {
    renderSettings({ syncStatus, lastSynchronizedAt: null })

    expect(screen.getByText(badge)).toBeInTheDocument()
    expect(screen.getByText("Never synced")).toBeInTheDocument()
  })

  it("claims the content is current only while the store still matches it", () => {
    // A finished sync says the app succeeded, not that the merchant has left their store alone since. Reporting the
    // one as the other is how a store that changed an hour ago keeps calling itself up to date.
    renderSettings({ contentDrift: "changed" })
    expect(screen.getByText("Needs updating")).toBeInTheDocument()
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument()
    expect(
      screen.getByText(
        "Your store has changed since the last sync. Sync again so ideas and links use your current products and posts."
      )
    ).toBeInTheDocument()
  })

  it("claims nothing about the content when the store could not be asked", () => {
    // Being unable to reach Shopify is not evidence either way, and guessing in either direction is worse than
    // reporting the one thing that is known: a sync happened.
    renderSettings({ contentDrift: "unknown" })

    expect(screen.getByText("Synced")).toBeInTheDocument()
    expect(screen.queryByText("Up to date")).not.toBeInTheDocument()
    expect(screen.queryByText(/Your store has changed/)).not.toBeInTheDocument()
  })

  it("explains a failed sync", () => {
    renderSettings({ syncStatus: "failed" })

    expect(screen.getByText("The last sync didn't finish. Try again.")).toBeInTheDocument()
  })

  it.each([
    [{ ok: true, intent: "sync" }, "Store content is up to date.", "success"],
    [{ ok: false, intent: "sync" }, "That sync didn't finish. Try again.", "critical"],
    [{ ok: true, intent: "addCompetitorDomain" }, "Competitor added.", "success"],
    [{ ok: true, intent: "subscribeToBlog" }, "Blog subscribed.", "success"],
    [
      { ok: false, intent: "subscribeToBlog", error: "invalidBlogAddress" },
      "Enter a valid blog address, such as example.com/blog.",
      "critical"
    ],
    [
      { ok: true, intent: "importKeywords", keywordImportOutcome: "current" },
      "Keyword data has been updated. We automatically collect it each month.",
      "info"
    ],
    [
      { ok: true, intent: "importKeywords", keywordImportOutcome: "current", keywordImportForced: true },
      "Keyword data collected.",
      "success"
    ]
  ] as const)("banners the action result", (actionResult, message, tone) => {
    const { container } = renderSettings({ syncStatus: "pending", actionResult })

    expect(screen.getByText(message)).toBeInTheDocument()
    expect(container.querySelector("s-banner")).toHaveAttribute("tone", tone)
  })

  it("offers a forced collection only after a refresh is declined", () => {
    const quiet = renderSettings()

    expect(quiet.queryByText("Collect anyway")).not.toBeInTheDocument()
    cleanup()

    const declined = renderSettings({
      actionResult: { ok: true, intent: "importKeywords", keywordImportOutcome: "current" }
    })

    expect(declined.getByText("Collect anyway")).toBeInTheDocument()
    expect(declined.container.querySelector('input[name="force"]')).toHaveValue("on")
  })

  it("withdraws the forced collection once it has been used", () => {
    const { queryByText } = renderSettings({
      actionResult: { ok: true, intent: "importKeywords", keywordImportOutcome: "current", keywordImportForced: true }
    })

    expect(queryByText("Collect anyway")).not.toBeInTheDocument()
  })

  function renderWithPendingAction() {
    let finishAction: (() => void) | undefined
    const actionPending = new Promise<void>((resolve) => {
      finishAction = resolve
    })
    const element = (
      <SettingsPage
        syncStatus="ready"
        activeResourceCount={42}
        activeResourceCounts={resourceCounts}
        embeddedResourceCount={42}
        contentDrift="current"
        lastSynchronizedAt={null}
        brandBrief=""
        supportedMarkets={supportedMarkets}
        competitorDomains={[]}
        subscribedBlogs={[]}
        keywordImport={keywordImport}
        actionResult={null}
      />
    )
    const router = createMemoryRouter([
      {
        path: "/",
        action: async () => {
          await actionPending
          return null
        },
        element
      }
    ])
    return { ...render(<RouterProvider router={router} />), router, finish: () => finishAction?.() }
  }

  function submit(router: ReturnType<typeof createMemoryRouter>, intent: string) {
    const formData = new FormData()
    formData.set("intent", intent)
    return router.navigate("/", { formMethod: "post", formData })
  }

  it("disables synchronization while the action is pending", async () => {
    const { container, router, finish } = renderWithPendingAction()

    const navigation = submit(router, "sync")
    await waitFor(() => expect(screen.getByText("Syncing")).toBeInTheDocument())
    expect(container.querySelector("form fieldset")).toBeDisabled()
    finish()
    await navigation
  })

  it("reports progress only on the control that was pressed", async () => {
    const { container, router, finish } = renderWithPendingAction()

    const navigation = submit(router, "setKeywordMarket")
    await waitFor(() => expect(container.querySelector("form fieldset")).toBeDisabled())
    expect(screen.getByText("Up to date")).toBeInTheDocument()
    expect(screen.queryByText("Syncing")).not.toBeInTheDocument()
    finish()
    await navigation
  })
})
