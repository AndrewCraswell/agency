import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { BlogWriterWorkspace } from "./BlogWriterWorkspace"

afterEach(cleanup)

describe("BlogWriterWorkspace", () => {
  it("shows the article brief and draft review workflow", () => {
    const { container } = render(<BlogWriterWorkspace />)

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "SEO blog writer")
    expect(container.querySelector('s-section[heading="Article brief"]')).toBeInTheDocument()
    expect(container.querySelector('s-section[heading="Draft"]')).toBeInTheDocument()
    expect(screen.getByText(/review before it is saved to Shopify/i)).toBeInTheDocument()
  })

  it("marks the generate action as loading", () => {
    const { container } = render(<BlogWriterWorkspace isGenerating />)

    expect(container.querySelector("s-button")).toHaveAttribute("loading")
  })
})
