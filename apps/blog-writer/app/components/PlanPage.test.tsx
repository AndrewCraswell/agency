import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlanPage } from "./PlanPage"

afterEach(cleanup)

describe("PlanPage", () => {
  const today = new Date()
  // Only days after today can be planned, so hold the clock at the start of the month the fixtures sit in.
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(today.getFullYear(), today.getMonth(), 1, 12), toFake: ["Date"] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const dayCount = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const cellCount =
    ((new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7) +
    dayCount +
    (6 - ((new Date(today.getFullYear(), today.getMonth() + 1, 0).getDay() + 6) % 7))
  const scheduledDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-08`
  const scheduledDayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(today.getFullYear(), today.getMonth(), 8))
  const scheduledBrief = "A selected angle."
  const scheduledModalId = "idea-22222222-2222-4222-8222-222222222222"

  const scheduledIdea = {
    ideaId: "22222222-2222-4222-8222-222222222222",
    title: "Selected guide",
    angle: scheduledBrief,
    targetKeyword: "selected",
    rationale: "A selected rationale.",
    status: "selected" as const,
    scheduledFor: scheduledDate,
    articleId: null
  }
  const backlogIdea = { ...scheduledIdea, scheduledFor: null }

  function renderPlan(props: Partial<React.ComponentProps<typeof PlanPage>> = {}) {
    const router = createMemoryRouter([
      { path: "/", element: <PlanPage ideas={[]} actionResult={null} {...props} />, action: () => null }
    ])
    return render(<RouterProvider router={router} />)
  }

  it("shows idea generation above the editorial calendar", () => {
    const { container } = renderPlan()

    expect(container.querySelector("s-page")).toHaveAttribute("heading", "Plan")
    const generateSection = container.querySelector('s-section[heading="Generate ideas"]')!
    const calendarSection = container.querySelector<HTMLElement>('s-section[heading="Editorial calendar"]')!
    expect(generateSection.compareDocumentPosition(calendarSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(container.querySelector('s-section[heading="Generated ideas"]')).not.toBeInTheDocument()
    expect(within(calendarSection).getByText("Idea backlog")).toBeInTheDocument()
    expect(screen.getByText("No ideas in the backlog.")).toBeInTheDocument()
  })

  it("offers idea formats to generate against", () => {
    const { container } = renderPlan()
    const select = container.querySelector('s-select[label="Idea format"]')!

    expect(select).toHaveAttribute("name", "ideaType")
    expect(select.querySelector('s-option[value="any"]')).toHaveTextContent("Any format")
    expect(select.querySelector('s-option[value="buying-guide"]')).toHaveTextContent("Buying guide")
    expect(select.querySelectorAll("s-option").length).toBeGreaterThan(5)
  })

  it("shows the current month with adjacent days and only idea titles", () => {
    const { container } = renderPlan({ ideas: [scheduledIdea] })
    const calendar = screen.getByLabelText(monthLabel)

    expect(within(calendar).getAllByRole("region")).toHaveLength(cellCount)
    expect(container.querySelector(`s-clickable[commandfor="${scheduledModalId}"]`)).toHaveTextContent("Selected guide")
    expect(within(calendar).queryByText(scheduledBrief)).not.toBeInTheDocument()
  })

  it("opens an idea modal describing the brief and keywords", () => {
    const { container } = renderPlan({ ideas: [scheduledIdea] })

    const opener = container.querySelector(`s-clickable[commandfor="${scheduledModalId}"]`)!
    expect(opener).toHaveAttribute("command", "--show")

    const modal = container.querySelector<HTMLElement>(`s-modal[id="${scheduledModalId}"]`)!
    expect(modal).toHaveAttribute("heading", "Selected guide")
    expect(within(modal).getByText(scheduledBrief)).toBeInTheDocument()
    expect(Array.from(modal.querySelectorAll("s-chip")).map((chip) => chip.textContent)).toEqual(["Selected"])
    expect(within(modal).getByText("Storefront links are suggested once the post is written.")).toBeInTheDocument()
    expect(within(modal).getByText("Further reading is suggested once the post is written.")).toBeInTheDocument()
  })

  it("edits an idea brief, keywords, and date from the modal", () => {
    const { container } = renderPlan({ ideas: [scheduledIdea] })
    const modal = container.querySelector<HTMLElement>(`s-modal[id="${scheduledModalId}"]`)!

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Edit Selected guide"]')!)

    expect(within(modal).queryByText(scheduledBrief)).not.toBeInTheDocument()
    expect(modal.querySelector('s-text-area[label="Brief"]')).toHaveAttribute("value", scheduledBrief)
    expect(modal.querySelector('s-date-field[label="Scheduled date"]')).toHaveAttribute("value", scheduledDate)
    expect(Array.from(modal.querySelectorAll("s-clickable-chip[removable]")).map((chip) => chip.textContent)).toEqual([
      "Selected"
    ])
    expect(modal.querySelector('s-text-field[label="Add a keyword"]')).toBeInTheDocument()
    expect(container.querySelector('s-button[accessibilitylabel="Add keyword to Selected guide"]')).toBeInTheDocument()
    expect(container.querySelector('s-button[accessibilitylabel="Save Selected guide"]')).toBeInTheDocument()

    fireEvent.click(within(modal).getByText("Cancel"))

    expect(modal.querySelector('s-text-area[label="Brief"]')).not.toBeInTheDocument()
    expect(within(modal).getByText(scheduledBrief)).toBeInTheDocument()
  })

  it("moves a scheduled idea to the backlog from its modal", () => {
    const { container } = renderPlan({ ideas: [scheduledIdea] })
    const modal = container.querySelector<HTMLElement>(`s-modal[id="${scheduledModalId}"]`)!
    const backlog = screen.getByLabelText("Idea backlog")

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Move Selected guide to the backlog"]')!)

    expect(within(backlog).getByText("Selected guide")).toBeInTheDocument()
    expect(within(screen.getByLabelText(monthLabel)).queryByText("Selected guide")).not.toBeInTheDocument()
    expect(within(modal).getByText("Not scheduled")).toBeInTheDocument()
  })

  it("schedules a backlog idea from its modal date field", () => {
    const { container } = renderPlan({ ideas: [backlogIdea] })
    const modal = container.querySelector<HTMLElement>(`s-modal[id="${scheduledModalId}"]`)!

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Edit Selected guide"]')!)
    // The Polaris date field is a custom element, so set its value property directly.
    const dateField = Object.assign(modal.querySelector('s-date-field[label="Scheduled date"]')!, {
      value: scheduledDate
    })
    fireEvent.change(dateField)
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Save Selected guide"]')!)

    const scheduledDay = within(screen.getByLabelText(monthLabel)).getByLabelText(scheduledDayLabel)
    expect(within(scheduledDay).getByText("Selected guide")).toBeInTheDocument()
    expect(container.querySelector(".plan-backlog__idea")).not.toBeInTheDocument()
    expect(screen.getByText("No ideas in the backlog.")).toBeInTheDocument()
  })

  it("keeps a day to one post", () => {
    const secondIdea = {
      ...scheduledIdea,
      ideaId: "33333333-3333-4333-8333-333333333333",
      title: "Second guide",
      scheduledFor: null
    }
    const { container } = renderPlan({ ideas: [scheduledIdea, secondIdea] })
    const modal = container.querySelector<HTMLElement>('s-modal[id="idea-33333333-3333-4333-8333-333333333333"]')!

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Edit Second guide"]')!)
    fireEvent.change(
      Object.assign(modal.querySelector('s-date-field[label="Scheduled date"]')!, { value: scheduledDate })
    )
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Save Second guide"]')!)

    expect(container.querySelector('s-banner[tone="warning"]')).toHaveAttribute("heading", "That day is taken")
    const scheduledDay = within(screen.getByLabelText(monthLabel)).getByLabelText(scheduledDayLabel)
    expect(within(scheduledDay).queryByText("Second guide")).not.toBeInTheDocument()
    expect(within(screen.getByLabelText("Idea backlog")).getByText("Second guide")).toBeInTheDocument()
  })

  it("closes today and the days behind it to planning", () => {
    const closedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`
    const closedDayLabel = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(new Date(today.getFullYear(), today.getMonth(), 1))
    const { container } = renderPlan({ ideas: [backlogIdea] })
    const modal = container.querySelector<HTMLElement>(`s-modal[id="${scheduledModalId}"]`)!

    // The pinned clock puts today on the first, so the closed day this drop aims at is today itself.
    const closedDay = screen.getByLabelText(`${closedDayLabel}, today, closed for planning`)
    const badges = container.querySelectorAll(".editorial-calendar__day-number--today")
    expect(badges).toHaveLength(1)
    expect(closedDay).toContainElement(badges[0] as HTMLElement)

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Edit Selected guide"]')!)
    fireEvent.change(Object.assign(modal.querySelector('s-date-field[label="Scheduled date"]')!, { value: closedDate }))
    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Save Selected guide"]')!)

    expect(container.querySelector('s-banner[tone="warning"]')).toHaveAttribute("heading", "Pick a later day")
    expect(within(screen.getByLabelText(monthLabel)).queryByText("Selected guide")).not.toBeInTheDocument()
    expect(within(screen.getByLabelText("Idea backlog")).getByText("Selected guide")).toBeInTheDocument()
  })

  it("shows the written post in place of the idea it grew from", () => {
    const { container } = renderPlan({
      ideas: [{ ...scheduledIdea, status: "drafted", articleId: "55555555-5555-4555-8555-555555555555" }]
    })

    const scheduledDay = within(screen.getByLabelText(monthLabel)).getByLabelText(scheduledDayLabel)
    expect(within(scheduledDay).getByText("Selected guide")).toBeInTheDocument()
    expect(
      container.querySelector('s-clickable[href="/app/articles/55555555-5555-4555-8555-555555555555"]')
    ).toBeInTheDocument()
    expect(container.querySelector(`s-clickable[commandfor="${scheduledModalId}"]`)).not.toBeInTheDocument()
  })

  it("offers edit and removal actions on every backlog card", () => {
    const { container } = renderPlan({ ideas: [backlogIdea] })
    const card = container.querySelector<HTMLElement>(".plan-backlog__idea")!

    expect(within(card).getByText("A selected angle.")).toBeInTheDocument()
    expect(card.querySelector('s-button[accessibilitylabel="Edit Selected guide"]')).toHaveAttribute(
      "commandfor",
      "idea-22222222-2222-4222-8222-222222222222"
    )
    expect(
      card.querySelector('s-button[accessibilitylabel="Remove Selected guide from the backlog"]')
    ).toBeInTheDocument()
    expect(card.querySelector('s-button[accessibilitylabel="Generate draft for Selected guide"]')).toBeInTheDocument()
  })

  it("navigates between months", () => {
    const { container } = renderPlan({ ideas: [scheduledIdea] })
    const nextMonthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
      new Date(today.getFullYear(), today.getMonth() + 1, 1)
    )

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Show the next month"]')!)

    expect(screen.getByLabelText(nextMonthLabel)).toBeInTheDocument()
    expect(container.querySelector(`s-clickable[commandfor="${scheduledModalId}"]`)).not.toBeInTheDocument()

    fireEvent.click(container.querySelector('s-button[accessibilitylabel="Show the previous month"]')!)

    expect(screen.getByLabelText(monthLabel)).toBeInTheDocument()
    expect(container.querySelector(`s-clickable[commandfor="${scheduledModalId}"]`)).toBeInTheDocument()
  })

  it("shows backlog ideas and hides the ones that never reached it", () => {
    const { container } = renderPlan({
      ideas: [
        {
          ideaId: "11111111-1111-4111-8111-111111111111",
          title: "Proposed guide",
          angle: "A proposed angle.",
          targetKeyword: "proposed",
          rationale: "A proposed rationale.",
          status: "proposed",
          scheduledFor: null,
          articleId: null
        },
        {
          ideaId: "22222222-2222-4222-8222-222222222222",
          title: "Selected guide",
          angle: "A selected angle.",
          targetKeyword: "selected",
          rationale: "A selected rationale.",
          status: "selected",
          scheduledFor: null,
          articleId: null
        },
        {
          ideaId: "33333333-3333-4333-8333-333333333333",
          title: "Dismissed guide",
          angle: "A dismissed angle.",
          targetKeyword: "dismissed",
          rationale: "A dismissed rationale.",
          status: "dismissed",
          scheduledFor: null,
          articleId: null
        },
        {
          ideaId: "44444444-4444-4444-8444-444444444444",
          title: "Drafted guide",
          angle: "A drafted angle.",
          targetKeyword: "drafted",
          rationale: "A drafted rationale.",
          status: "drafted",
          scheduledFor: null,
          articleId: null
        }
      ]
    })

    expect(screen.queryByText("Proposed guide")).not.toBeInTheDocument()
    expect(screen.getByText("Selected guide")).toBeInTheDocument()
    expect(screen.getByText("A selected rationale.")).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll("s-chip")).map((chip) => chip.textContent)).toContain("Selected")
    expect(
      container.querySelector('s-button[accessibilitylabel="Generate draft for Selected guide"]')
    ).toBeInTheDocument()
    expect(
      container.querySelector('s-button[accessibilitylabel="Remove Selected guide from the backlog"]')
    ).toBeInTheDocument()
    expect(screen.getByText("Drafted guide")).toBeInTheDocument()
    expect(Array.from(container.querySelectorAll(".plan-backlog__status")).map((status) => status.textContent)).toEqual(
      ["Ready to write", "Drafted"]
    )
    expect(
      container.querySelector('s-button[accessibilitylabel="Generate draft for Drafted guide"]')
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Dismissed guide")).not.toBeInTheDocument()
  })

  it.each([
    [{ ok: false, intent: "generateIdeas" }, "That action didn't finish. Try again."],
    [{ ok: true, intent: "generateIdeas" }, "3 ideas added to your backlog."],
    [{ ok: true, intent: "selectIdea" }, "Idea added to the backlog."],
    [{ ok: true, intent: "dismissIdea" }, "Idea removed."],
    [{ ok: true, intent: "other" }, "Action completed."]
  ] as const)("shows the action result", (actionResult, message) => {
    renderPlan({ actionResult })
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("links to Articles after draft generation", () => {
    const { container } = renderPlan({ actionResult: { ok: true, intent: "generateDraft" } })

    expect(screen.getByText("Draft is ready for review.")).toBeInTheDocument()
    expect(container.querySelector('s-link[href="/app/articles"]')).toHaveTextContent("Review article")
  })
})
