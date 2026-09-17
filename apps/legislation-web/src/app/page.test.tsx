// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { StagedReference } from "../modules/conversations/chatRequest"
import { ChatProviders } from "../modules/conversations/components/ChatProviders"
import type { ResearchSuggestion } from "../modules/conversations/suggestions"
import { HomepageLanding } from "../modules/homepage/components/HomepageLanding"
import * as composerStyles from "../modules/conversations/components/ChatComposer.css"

const navigation = vi.hoisted(() => ({ push: vi.fn<(url: string) => void>() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))

const suggestions: ResearchSuggestion[] = [
  { text: "Who sponsors insurance bills?", description: "Explore sponsors", kind: "sponsors" },
  { text: "What actions are recorded on energy bills?", description: "Review actions", kind: "actions" },
  { text: "How do states define high-risk AI?", description: "Compare definitions", kind: "comparison" },
  { text: "Which committees held housing hearings?", description: "Find hearings", kind: "hearings" },
  { text: "How do bills address repair access?", description: "Compare proposals", kind: "comparison" },
  { text: "What votes are recorded on school bills?", description: "Review votes", kind: "actions" }
]

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ references: [] }))
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it("shows six skeleton bubbles while pending, then fills the glowing composer without sending", async () => {
  const pending = Promise.withResolvers<ResearchSuggestion[]>()
  const user = userEvent.setup()
  const view = await act(async () =>
    render(<HomepageLanding isAvailable suggestions={pending.promise} />, { wrapper: ChatProviders })
  )
  const loading = screen.getByRole("status", { name: "Loading research questions" })
  expect(loading.getAttribute("aria-busy")).toBe("true")
  expect(loading.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6)
  expect(Array.from(loading.children, (row) => row.children.length)).toEqual([1, 2, 2, 1])
  const input = await screen.findByRole("textbox", { name: "Your question" })
  expect(view.container.querySelector(`.${composerStyles.homepageGlow}`)).not.toBeNull()
  await act(async () => pending.resolve(suggestions))
  await waitFor(() => expect(screen.queryByRole("status", { name: "Loading research questions" })).toBeNull())
  const ideas = screen.getByLabelText("Suggested research questions")
  expect(within(ideas).getAllByRole("button")).toHaveLength(6)
  expect(Array.from(ideas.children, (row) => row.children.length)).toEqual([1, 2, 2, 1])
  await user.click(within(ideas).getByRole("button", { name: suggestions[0]?.text }))
  await waitFor(() => expect(input.textContent).toBe(suggestions[0]?.text))
  expect(navigation.push).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Send question" }).hasAttribute("disabled")).toBe(false)
})

it.each([false, true])("scrolls to the answer and moves focus with reduced motion=%s", async (isReducedMotion) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" && isReducedMotion,
      media: query,
      addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
      removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>()
    }))
  )
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => undefined)
  render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
  await userEvent.setup().click(screen.getByRole("link", { name: "See what an answer looks like" }))
  expect(scroll).toHaveBeenCalledWith({ behavior: isReducedMotion ? "instant" : "smooth", block: "start" })
  expect(document.activeElement?.id).toBe("example-answer")
})

it("marks only FEC documents and funding as planned circles", () => {
  render(<HomepageLanding />, { wrapper: ChatProviders })
  const table = screen.getByRole("region", { name: "Source coverage" })
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent)
  const row = within(table).getByRole("row", { name: /FEC.gov/ })
  const cells = within(row).getAllByRole("cell")
  for (const category of ["Documents", "Funding"]) {
    const cell = cells[headers.indexOf(category)]
    expect(cell?.textContent).toBe("Planned")
    expect(cell?.querySelector("svg.lucide-circle")).not.toBeNull()
  }
  expect(row.querySelectorAll("svg.lucide-circle")).toHaveLength(2)
  expect(row.querySelectorAll("svg.lucide-check")).toHaveLength(0)
})

it("starts the real mention popover at Oca and selects without sending", async () => {
  const person: StagedReference = {
    resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
    recordId: "person:ocasio-cortez",
    record: {
      id: "person:ocasio-cortez",
      kind: "person",
      title: "Alexandria Ocasio-Cortez",
      subtitle: "New York, U.S. House",
      sourceUrl: null,
      fields: [],
      tallies: []
    }
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ references: [person] }))
  vi.stubGlobal("fetch", fetcher)
  const user = userEvent.setup()
  render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
  const search = screen.getByRole("textbox", { name: "Find people and committees" })
  expect(search.getAttribute("value")).toBe("Oca")
  const option = await screen.findByRole("option", { name: /Alexandria Ocasio-Cortez/ })
  expect(fetcher).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ body: expect.stringContaining('"query":"Oca"') })
  )
  await user.click(option)
  const input = screen.getByRole("textbox", { name: "Your question" })
  await waitFor(() => expect(input.querySelector('[data-id="person:ocasio-cortez"]')).not.toBeNull())
  expect(navigation.push).not.toHaveBeenCalled()
})
