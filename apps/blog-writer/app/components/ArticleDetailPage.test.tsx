import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ArticleDetailPage } from "./ArticleDetailPage"

afterEach(cleanup)

// jsdom answers no media queries at all, so the title bar breakpoint needs a stand-in it can read.
function matchMedia(matches: boolean) {
  window.matchMedia = (media: string) =>
    Object.assign(new EventTarget(), { matches, media }) as unknown as MediaQueryList
}

beforeEach(() => {
  matchMedia(false)
})

describe("ArticleDetailPage", () => {
  const currentRevisionId = "55555555-5555-4555-8555-555555555555"
  const previousRevisionId = "66666666-6666-4666-8666-666666666666"

  const article = {
    articleId: "22222222-2222-4222-8222-222222222222",
    title: "Wet-weather camping",
    excerpt: "<p>Prepare a campsite for rain.</p>",
    content: "<p>Choose raised ground.</p>",
    tags: ["camping", "rain"],
    author: "Dana Reed",
    handle: "wet-weather-camping",
    seoTitle: "",
    seoDescription: "",
    imageUrl: null,
    imageAltText: "",
    status: "needs_review" as const,
    updatedAt: "2026-07-23T12:00:00.000Z",
    currentRevisionId,
    publishedRevisionId: null,
    destinationBlogGid: "gid://shopify/Blog/1",
    shopifyArticleGid: null,
    shopifyArticleUrl: null,
    recommendations: [
      {
        recommendationId: "33333333-3333-4333-8333-333333333333",
        objective: "commercial_crosslink" as const,
        sectionLocator: "Shelter",
        anchorText: "family tent",
        rationale: "Relevant to shelter selection.",
        status: "proposed" as const,
        destinationTitle: "Trail Family Tent",
        destinationUrl: "https://example.com/products/trail-family-tent",
        destinationType: "product" as const
      },
      {
        recommendationId: "44444444-4444-4444-8444-444444444444",
        objective: "further_reading" as const,
        sectionLocator: "Campsite",
        anchorText: "setting up camp",
        rationale: "Provides a useful next step.",
        status: "accepted" as const,
        destinationTitle: "Rainy campsite guide",
        destinationUrl: "https://example.com/blogs/guides/rainy-campsite",
        destinationType: "article" as const
      }
    ]
  }

  const versions = [
    {
      revisionId: currentRevisionId,
      revisionNumber: 2,
      origin: "edited" as const,
      title: "Wet-weather camping",
      excerpt: "Prepare a campsite for rain.",
      tags: ["camping", "rain"],
      bodyText: "Choose raised ground.",
      author: "Dana Reed",
      handle: "wet-weather-camping",
      seoTitle: "",
      seoDescription: "",
      createdAt: "2026-07-23T12:00:00.000Z",
      isCurrent: true,
      isPublished: false,
      hasPublicationHistory: false
    },
    {
      revisionId: previousRevisionId,
      revisionNumber: 1,
      origin: "generated" as const,
      title: "Wet-weather camping",
      excerpt: "Prepare a campsite for rain.",
      tags: ["camping"],
      bodyText: "Choose flat ground.",
      author: "Dana Reed",
      handle: "wet-weather-camping",
      seoTitle: "",
      seoDescription: "",
      createdAt: "2026-07-22T12:00:00.000Z",
      isCurrent: false,
      isPublished: false,
      hasPublicationHistory: false
    }
  ]

  const workingCopy = {
    title: "Wet-weather camping",
    excerpt: "Prepare a campsite for rain.",
    tags: ["camping", "rain"],
    bodyText: "Choose raised ground.",
    author: "Dana Reed",
    handle: "wet-weather-camping",
    seoTitle: "",
    seoDescription: ""
  }

  const destinationBlogs = [{ blogGid: "gid://shopify/Blog/1", title: "Field notes", handle: "field-notes" }]

  const store = { name: "Contoso Camp", domain: "contosocamp.myshopify.com" }

  const authorSuggestions = ["Contoso Camp", "Dana Reed", "Priya Sharma"]

  const linkableDestinations = { commercial: 12, reading: 4 }

  type Props = React.ComponentProps<typeof ArticleDetailPage>

  function renderArticle(overrides: Partial<Props> = {}) {
    const props: Props = {
      article,
      versions,
      workingCopy,
      totalVersionCount: versions.length,
      destinationBlogs,
      store,
      authorSuggestions,
      linkableDestinations,
      actionResult: null,
      ...overrides
    }
    const router = createMemoryRouter([{ path: "/", element: <ArticleDetailPage {...props} /> }])
    return render(<RouterProvider router={router} />)
  }

  it("puts the editable article fields in one save form", () => {
    const { container } = renderArticle()

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Wet-weather camping")
    expect(container.querySelector('s-text-field[label="Title"]')).toHaveAttribute("value", "Wet-weather camping")
    expect(container.querySelector('input[name="body"]')).toHaveAttribute("value", "<p>Choose raised ground.</p>")
    expect(container.querySelector('input[name="excerpt"]')).toHaveAttribute(
      "value",
      "<p>Prepare a campsite for rain.</p>"
    )
    expect(container.querySelector('input[name="tags"]')).toHaveAttribute("value", "camping,rain")
    expect(container.querySelector('input[name="expectedRevisionId"]')).toHaveAttribute("value", currentRevisionId)
  })

  it("collects the organization settings beside the editor", () => {
    const { container } = renderArticle()

    expect(container.querySelector('s-clickable[accessibilitylabel="Collapse Organization"]')).toBeInTheDocument()
    expect(container.querySelector('s-text-field[label="Author"]')).toHaveAttribute("value", "Dana Reed")
    expect(container.querySelector('s-select[name="destinationBlogGid"]')).toHaveAttribute(
      "value",
      "gid://shopify/Blog/1"
    )
    expect(
      Array.from(container.querySelectorAll("s-clickable-chip[removable]")).map((chip) => chip.textContent)
    ).toEqual(["Camping", "Rain"])
  })

  it("offers the same formatting toolbar for the article and the excerpt", () => {
    const { container } = renderArticle()

    expect(screen.getByRole("toolbar", { name: "Article content formatting" })).toBeInTheDocument()
    expect(screen.getByRole("toolbar", { name: "Excerpt formatting" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Bold" })).toHaveLength(2)
    expect(container.querySelectorAll(".article-editor--compact")).toHaveLength(1)
  })

  it("offers a view control on older versions only", () => {
    const { container } = renderArticle()

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)

    const viewButtons = document.querySelectorAll('s-button[accessibilitylabel^="View version"]')
    expect(viewButtons).toHaveLength(1)
    expect(viewButtons[0]).toHaveAttribute("accessibilitylabel", "View version 1")
    expect(viewButtons[0]).toHaveAttribute("commandfor", "version-diff")
    expect(screen.getByText("Working copy")).toBeInTheDocument()
  })

  it("shows the fields a restore would change", () => {
    const { container } = renderArticle()

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="View version 1"]')!)

    const modal = container.querySelector<HTMLElement>('s-modal[id="version-diff"]')!
    expect(modal).toHaveAttribute("heading", "Version 1")
    expect(modal).toHaveTextContent("Tags")
    expect(modal).toHaveTextContent("Content")
    expect(Array.from(modal.querySelectorAll("del")).map((node) => node.textContent)).toContain("raised")
    expect(Array.from(modal.querySelectorAll("ins")).map((node) => node.textContent)).toContain("flat")
    expect(modal.querySelector('s-button[slot="primary-action"]')).toHaveTextContent("Restore this version")
    expect(modal.querySelector('s-button[slot="secondary-actions"]')).toHaveTextContent("Close")
  })

  it("reports when an older version matches the working copy", () => {
    const { container } = renderArticle({
      versions: versions.map((version) => ({ ...version, tags: workingCopy.tags, bodyText: workingCopy.bodyText }))
    })

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="View version 1"]')!)

    expect(screen.getByText("This version matches your working copy.")).toBeInTheDocument()
  })

  it("keeps versions that went to Shopify out of reach of the delete control", () => {
    const { container } = renderArticle()

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="View version 1"]')!)

    const modal = container.querySelector<HTMLElement>('s-modal[id="version-diff"]')!
    const remove = Array.from(modal.querySelectorAll('s-button[slot="secondary-actions"]')).find(
      (button) => button.textContent === "Delete version"
    )!
    expect(remove).not.toHaveAttribute("disabled")

    cleanup()
    const published = renderArticle({
      versions: versions.map((version) => ({ ...version, hasPublicationHistory: true }))
    })
    fireEvent.click(published.container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)
    fireEvent.click(published.container.querySelector('s-button[accessibilitylabel="View version 1"]')!)

    expect(screen.getByText("This version went to Shopify, so it stays in history.")).toBeInTheDocument()
    expect(
      Array.from(published.container.querySelectorAll('s-button[slot="secondary-actions"]')).find(
        (button) => button.textContent === "Delete version"
      )
    ).toHaveAttribute("disabled")
  })

  it("links to the rest of the history when versions are held back", () => {
    const { container } = renderArticle({ totalVersionCount: 7 })

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Version history"]')!)

    expect(container.querySelector('s-link[href="?versions=all"]')).toHaveTextContent("Show all 7 versions")
  })

  it("separates storefront links from further reading", () => {
    const { container } = renderArticle()

    expect(container.querySelector('s-section[accessibilitylabel="Storefront links"]')).toBeInTheDocument()
    expect(container.querySelector('s-section[accessibilitylabel="Further reading"]')).toBeInTheDocument()

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Storefront links"]')!)
    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Further reading"]')!)

    expect(container.querySelector('s-clickable-chip[accessibilitylabel="Add Trail Family Tent"]')).toBeInTheDocument()
    expect(
      container.querySelector('s-clickable-chip[accessibilitylabel="Open Rainy campsite guide"][removable]')
    ).toBeInTheDocument()
    expect(screen.getByText(/^Product linked from Shelter\./)).toBeInTheDocument()
  })

  it("starts each suggestion section collapsed and expands on request", () => {
    const { container } = renderArticle()

    expect(
      container.querySelector('s-clickable-chip[accessibilitylabel="Add Trail Family Tent"]')
    ).not.toBeInTheDocument()

    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Storefront links"]')!)

    expect(container.querySelector('s-clickable[accessibilitylabel="Collapse Storefront links"]')).toBeInTheDocument()
    expect(container.querySelector('s-clickable-chip[accessibilitylabel="Add Trail Family Tent"]')).toBeInTheDocument()
  })

  it("offers a refresh control for each suggestion section", () => {
    const { container } = renderArticle()

    expect(container.querySelector('s-button[accessibilitylabel="Suggest storefront links"]')).toHaveAttribute(
      "icon",
      "wand"
    )
    expect(container.querySelector('s-button[accessibilitylabel="Suggest further reading"]')).toHaveAttribute(
      "icon",
      "wand"
    )
  })

  it("holds the preview back until the post reaches the online store", () => {
    const { container } = renderArticle()

    const preview = container.querySelector('s-button[slot="secondary-actions"][disabled]')
    expect(preview).toHaveTextContent("Preview")
  })

  it("previews a published post on the online store", () => {
    const url = "https://contosocamp.myshopify.com/blogs/field-notes/wet-weather-camping"
    const { container } = renderArticle({
      article: { ...article, publishedRevisionId: currentRevisionId, shopifyArticleUrl: url }
    })

    const preview = container.querySelector(`s-button[href="${url}"]`)
    expect(preview).toHaveTextContent("Preview")
    expect(preview).toHaveAttribute("target", "_blank")
  })

  it("holds the preview back when a draft already exists on Shopify", () => {
    const url = "https://contosocamp.myshopify.com/blogs/field-notes/wet-weather-camping"
    const { container } = renderArticle({ article: { ...article, shopifyArticleUrl: url } })

    expect(container.querySelector(`s-button[href="${url}"]`)).toBeNull()
  })

  it("keeps the status in the title bar when there is room for it", () => {
    matchMedia(false)
    const { container } = renderArticle()

    expect(container.querySelector('s-badge[slot="accessory"]')).toHaveTextContent("Needs review")
    expect(container.querySelector("s-section s-badge")).toBeNull()
    expect(container.querySelector("s-grid[gap='base']")).toHaveAttribute("gridtemplatecolumns", "minmax(0, 1fr) 20rem")
  })

  it("moves the status into the page on a narrow screen", () => {
    matchMedia(true)
    const { container } = renderArticle()

    expect(container.querySelector('s-badge[slot="accessory"]')).toBeNull()
    expect(container.querySelector("s-section s-badge")).toHaveTextContent("Needs review")
    expect(container.querySelector("s-grid[gap='base']")).toHaveAttribute("gridtemplatecolumns", "minmax(0, 1fr)")
  })

  it("offers an assisted rewrite of the title", () => {
    const { container } = renderArticle()

    const rewrite = container.querySelector('s-button[accessibilitylabel="Rewrite the title with AI"]')
    expect(rewrite).toHaveAttribute("icon", "wand")
    expect(rewrite).toHaveAttribute("commandfor", "rewrite-title")
    expect(container.querySelector('s-modal[id="rewrite-title"]')).toHaveAttribute("heading", "Rewrite title")
    expect(container.querySelector('s-text-field[label="Describe the changes"]')).toBeInTheDocument()
  })

  it("shows the search engine listing and reveals its fields on request", () => {
    const { container } = renderArticle()

    expect(
      screen.getByText("https://contosocamp.myshopify.com \u203a blogs \u203a field-notes \u203a wet-weather-camping")
    ).toBeInTheDocument()
    expect(container.querySelector('s-text-field[label="Page title"]')).not.toBeInTheDocument()

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Edit search engine listing"]') as Element)

    expect(container.querySelector('s-text-field[label="Page title"]')).toHaveAttribute(
      "details",
      "19 of 70 characters used"
    )
    expect(container.querySelector('s-text-area[label="Meta description"]')).toHaveAttribute(
      "details",
      "0 of 160 characters used"
    )
    const handleField = container.querySelector('s-text-field[label="URL handle"]')
    expect(handleField).toHaveAttribute("placeholder", "wet-weather-camping")
    expect(handleField).toHaveAttribute("prefix", "blogs/field-notes/")
    expect(handleField).toHaveAttribute(
      "details",
      "https://contosocamp.myshopify.com/blogs/field-notes/wet-weather-camping"
    )
  })

  it("asks for a featured image until the article has one", () => {
    const { container } = renderArticle()

    expect(screen.getByText("Add image")).toBeInTheDocument()
    expect(container.querySelector("s-thumbnail")).not.toBeInTheDocument()

    cleanup()
    const withImage = renderArticle({
      article: { ...article, imageUrl: "https://cdn.shopify.com/tent.jpg", imageAltText: "A tent in the rain" }
    })

    expect(withImage.container.querySelector("s-thumbnail")).toHaveAttribute("src", "https://cdn.shopify.com/tent.jpg")
    expect(withImage.container.querySelector('s-text-field[label="Alt text"]')).toHaveAttribute(
      "value",
      "A tent in the rain"
    )
  })

  it("keeps the author freeform and suggests the names the store already uses", () => {
    const { container } = renderArticle()

    const field = container.querySelector('s-text-field[label="Author"]')!
    expect(field).toHaveAttribute("value", "Dana Reed")
    expect(field).toHaveAttribute("name", "author")
    expect(screen.queryByRole("group", { name: "Author suggestions" })).not.toBeInTheDocument()

    fireEvent.focusIn(field)

    // "Dana Reed" is what the field already holds, so only the names it does not have are worth offering.
    expect(
      screen.getAllByRole("button").filter((button) => button.className === "article-author__suggestion")
    ).toHaveLength(2)

    // The field is a custom element, so its value is a plain property rather than one jsdom knows how to set.
    Object.assign(field, { value: "pri" })
    fireEvent.input(field)
    const remaining = screen
      .getByRole("group", { name: "Author suggestions" })
      .querySelectorAll(".article-author__suggestion")
    expect(Array.from(remaining).map((option) => option.textContent)).toEqual(["Priya Sharma"])
  })

  it("offers an assisted image beside the image card", () => {
    const { container } = renderArticle()

    const generate = container.querySelector('s-button[accessibilitylabel="Generate an image for this article"]')
    expect(generate).toHaveAttribute("icon", "image-magic")
    expect(generate?.closest("s-section")).toHaveAttribute("accessibilitylabel", "Image")
    expect(generate).toHaveAttribute("commandfor", "generate-image")
    expect(container.querySelector('s-modal[id="generate-image"]')).toHaveAttribute("heading", "Generate image")
    expect(container.querySelector('s-text-field[label="Describe the image"]')).toBeInTheDocument()
  })

  it("keeps deleting the article behind the more actions menu and a confirmation", () => {
    const { container } = renderArticle()

    const menuButton = container.querySelector('s-button[commandfor="article-actions"]')
    expect(menuButton).toHaveTextContent("More actions")
    const deleteAction = container.querySelector('s-menu[id="article-actions"] s-button[tone="critical"]')
    expect(deleteAction).toHaveTextContent("Delete blog post")
    expect(deleteAction).toHaveAttribute("commandfor", "delete-article")
    expect(container.querySelector('s-modal[id="delete-article"]')).toHaveAttribute("heading", "Delete blog post?")
  })

  it("summarizes the publication state as labelled facts", () => {
    const { container } = renderArticle({
      article: {
        ...article,
        status: "published",
        publishedRevisionId: currentRevisionId,
        shopifyArticleUrl: "https://contosocamp.myshopify.com/blogs/field-notes/wet-weather-camping"
      }
    })

    expect(screen.getByText("Readers see your latest saved version.")).toBeInTheDocument()
    expect(screen.getByText("Last saved")).toBeInTheDocument()
    expect(screen.getByText("Online store")).toBeInTheDocument()
    expect(
      container.querySelector('s-link[href="https://contosocamp.myshopify.com/blogs/field-notes/wet-weather-camping"]')
    ).toHaveTextContent("View article")
  })

  it("flags a published article that has newer saved changes", () => {
    renderArticle({
      article: { ...article, status: "published", publishedRevisionId: previousRevisionId },
      versions: versions.map((version) => ({
        ...version,
        isPublished: version.revisionId === previousRevisionId
      }))
    })

    expect(screen.getByText("Unpublished changes")).toBeInTheDocument()
    expect(screen.getByText("Readers still see the version you published last.")).toBeInTheDocument()
    expect(screen.getByText("Publish latest changes")).toBeInTheDocument()
    expect(screen.getByText("Hide from online store")).toBeInTheDocument()
  })

  it("publishes to the blog chosen in the sidebar", () => {
    const { container } = renderArticle()

    expect(container.querySelector('s-select[name="destinationBlogGid"]')).toHaveAttribute(
      "value",
      "gid://shopify/Blog/1"
    )
    expect(screen.getByText("Publish to blog")).toBeInTheDocument()
  })

  it("lists every blog the store has", () => {
    const { container } = renderArticle({
      destinationBlogs: [
        ...destinationBlogs,
        { blogGid: "gid://shopify/Blog/2", title: "Trail journal", handle: "trail-journal" }
      ]
    })

    expect(Array.from(container.querySelectorAll("s-option")).map((option) => option.textContent)).toEqual([
      "Field notes",
      "Trail journal"
    ])
  })

  it("blocks Shopify writes until the store has a blog", () => {
    const { container } = renderArticle({
      article: { ...article, destinationBlogGid: null },
      destinationBlogs: []
    })

    expect(
      screen.getByText("Synchronize your store from Settings so this article has a blog to publish to.")
    ).toBeInTheDocument()
    expect(container.querySelector("s-button[disabled]")).toBeInTheDocument()
  })

  it.each([
    [
      { ok: false, intent: "saveArticle", error: "Add article content before saving" },
      "Add article content before saving"
    ],
    [{ ok: true, intent: "saveArticle" }, "Your changes are saved as a new version."],
    [{ ok: true, intent: "restoreRevision" }, "That version is now the working copy."],
    [{ ok: true, intent: "publishArticle" }, "Published to your online store."],
    [{ ok: true, intent: "unpublishArticle" }, "Hidden from your online store."],
    [{ ok: true, intent: "refreshCrosslinks" }, "Storefront link suggestions are ready."]
  ] as const)("shows the action result", (actionResult, message) => {
    renderArticle({ actionResult })
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("says a suggestion run found nothing rather than reporting success", () => {
    const { container } = renderArticle({
      article: { ...article, recommendations: [] },
      actionResult: { ok: true, intent: "refreshCrosslinks" }
    })
    expect(screen.getByText("No storefront links matched this article.")).toBeInTheDocument()
    expect(screen.queryByText("Storefront link suggestions are ready.")).not.toBeInTheDocument()
    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Storefront links"]')!)
    expect(screen.getByText("No published products or collections matched this article.")).toBeInTheDocument()
  })

  it("points at publishing when the store has nothing live to link", () => {
    const { container } = renderArticle({
      article: { ...article, recommendations: [] },
      linkableDestinations: { commercial: 0, reading: 0 }
    })
    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Storefront links"]')!)
    fireEvent.click(container.querySelector('s-clickable[accessibilitylabel="Expand Further reading"]')!)
    expect(
      screen.getByText(
        "Publish a product or collection to your online store, then ask for suggestions. Only live pages can be linked."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Publish another blog post to your online store, then ask for suggestions. Only live pages can be linked."
      )
    ).toBeInTheDocument()
  })
})
