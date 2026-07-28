import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { ArticleEditor } from "./ArticleEditor"

afterEach(cleanup)

/** Marks apply to whatever text is selected, so these are exercised against a full selection. */
const MARK_LABELS = ["Bold", "Italic", "Underline", "Strike", "Superscript", "Subscript"]

/** Block level controls act on the block holding the cursor, so a selection would get in the way. */
const BLOCK_LABELS = ["Code Block"]

function renderEditor(isDisabled = false) {
  return render(
    <ArticleEditor
      accessibilityLabel="Article content"
      defaultValue="<p>Choose raised ground.</p>"
      isDisabled={isDisabled}
      name="body"
    />
  )
}

/** The editor mounts after hydration, so every test waits for a control to come alive before acting. */
async function findReadyToolbar() {
  const bold = await screen.findByRole("button", { name: "Bold" })
  await waitFor(() => {
    expect(bold).toBeEnabled()
  })
  return bold
}

function getSubmittedBody(container: HTMLElement) {
  return container.querySelector('input[name="body"]')?.getAttribute("value") ?? ""
}

async function selectAllContent() {
  await userEvent.click(screen.getByRole("textbox", { name: "Article content" }))
  await userEvent.keyboard("{Control>}a{/Control}")
}

describe("ArticleEditor", () => {
  it("carries the starting content in the submitted field", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()

    expect(screen.getByRole("textbox", { name: "Article content" })).toHaveTextContent("Choose raised ground.")
    expect(getSubmittedBody(container)).toBe("<p>Choose raised ground.</p>")
  })

  it.each(MARK_LABELS)("reports %s as applied once it is used", async (label) => {
    renderEditor()
    await findReadyToolbar()
    await selectAllContent()
    const control = screen.getByRole("button", { name: label })

    await userEvent.click(control)

    await waitFor(() => {
      expect(control).toHaveAttribute("aria-pressed", "true")
    })
  })

  it.each(BLOCK_LABELS)("reports %s as applied once it is used", async (label) => {
    renderEditor()
    await findReadyToolbar()
    await userEvent.click(screen.getByRole("textbox", { name: "Article content" }))
    const control = screen.getByRole("button", { name: label })

    await userEvent.click(control)

    await waitFor(() => {
      expect(control).toHaveAttribute("aria-pressed", "true")
    })
  })

  it("submits the formatting the merchant applied", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await selectAllContent()

    await userEvent.click(screen.getByRole("button", { name: "Bold" }))

    await waitFor(() => {
      expect(getSubmittedBody(container)).toContain("<strong>Choose raised ground.</strong>")
    })
  })

  it("restores the previous content when the merchant undoes a change", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await selectAllContent()
    await userEvent.click(screen.getByRole("button", { name: "Bold" }))
    await waitFor(() => {
      expect(getSubmittedBody(container)).toContain("<strong>")
    })

    await userEvent.click(screen.getByRole("textbox", { name: "Article content" }))
    await userEvent.keyboard("{Control>}z{/Control}")

    await waitFor(() => {
      expect(getSubmittedBody(container)).toBe("<p>Choose raised ground.</p>")
    })
  })

  it("turns a paragraph into a heading from the text style menu", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await selectAllContent()

    await userEvent.click(screen.getByRole("button", { name: "Formatting: Paragraph" }))
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Heading 2" }))

    await waitFor(() => {
      expect(getSubmittedBody(container)).toContain("<h2>Choose raised ground.</h2>")
    })
  })

  it("turns a paragraph into a list from the list menu", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await selectAllContent()

    await userEvent.click(screen.getByRole("button", { name: "List options" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Bullet List" }))

    await waitFor(() => {
      expect(getSubmittedBody(container)).toContain("<ul><li><p>Choose raised ground.</p></li></ul>")
    })
  })

  it("records the alignment the merchant chose", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await userEvent.click(screen.getByRole("textbox", { name: "Article content" }))

    await userEvent.click(screen.getByRole("button", { name: "Alignment: Left" }))
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "Center" }))

    await waitFor(() => {
      expect(getSubmittedBody(container)).toContain('style="text-align: center;"')
    })
  })

  it("counts the words and characters in the article", async () => {
    renderEditor()
    await findReadyToolbar()

    await waitFor(() => {
      expect(screen.getByText("3 words, 21 characters")).toBeInTheDocument()
    })
  })

  it("stops accepting edits while a save is in flight", async () => {
    renderEditor(true)

    const surface = await screen.findByRole("textbox", { name: "Article content" })

    await waitFor(() => {
      expect(surface).toHaveAttribute("contenteditable", "false")
    })
  })

  it("opens the HTML view on the markup the document holds", async () => {
    renderEditor()
    await findReadyToolbar()

    await userEvent.click(screen.getByRole("button", { name: "View HTML" }))

    expect(screen.getByRole("textbox", { name: "Article content HTML" })).toHaveValue("<p>Choose raised ground.</p>")
  })

  it("writes an edit made in the HTML view back into the document", async () => {
    const { container } = renderEditor()
    await findReadyToolbar()
    await userEvent.click(screen.getByRole("button", { name: "View HTML" }))
    const source = screen.getByRole("textbox", { name: "Article content HTML" })

    await userEvent.clear(source)
    await userEvent.type(source, "<h2>Higher ground</h2>")

    await waitFor(() => {
      // The document keeps a trailing paragraph after a heading, so the submitted markup carries one too.
      expect(getSubmittedBody(container)).toContain("<h2>Higher ground</h2>")
    })
  })
})
