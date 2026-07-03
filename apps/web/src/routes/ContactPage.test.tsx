import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppShell } from "@/components/AppShell/AppShell"
import { ContactPage } from "./ContactPage"

const renderPage = () =>
  render(
    <AppShell>
      <ContactPage />
    </AppShell>
  )

describe("ContactPage", () => {
  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText("Email"), "not-an-email")

    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument()
  })

  it("submits a confirmation when the form is valid", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText("Name"), "Ada")
    await user.type(screen.getByLabelText("Email"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Submit" }))

    expect(await screen.findByText(/Thanks, Ada!/)).toBeInTheDocument()
  })
})
