import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AppHome } from "./AppHome"

afterEach(cleanup)

describe("AppHome", () => {
  it("renders the app home", () => {
    const { container } = render(<AppHome />)

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "__DISPLAY_NAME__")
    expect(container.querySelector('s-section[heading="Get started"]')).toBeInTheDocument()
  })
})
