import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { App } from "./App"
import { fetchSimulatorReport } from "./simulator-api"

const report = {
  cases: [
    {
      expected: {
        decisions: [],
        nonEvents: [],
        status: "accepted",
        uncertainty: []
      },
      result: {
        actualStatus: "accepted",
        decisions: [
          {
            decisionAtUs: 1000,
            disposition: "qualified-hit",
            side: "left",
            signal: { audible: "requested", latched: true, visual: "valid-hit" }
          }
        ],
        diagnostics: [],
        mismatches: [],
        uncertainty: []
      },
      scenario: {
        description: "A deterministic Epee scoring scenario.",
        inputs: [{ atUs: 0, id: "IN-1", lines: [] }],
        ruleRevision: "fie-test",
        scenarioId: "SC-EPE-001",
        title: "Epee valid touch",
        weapon: "epee"
      },
      status: "passed",
      timing: {
        contactMinimumUs: 2000,
        lockoutUs: 45_000,
        status: "available"
      }
    }
  ],
  reportId: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  summary: { executable: { failed: 0, passed: 1, total: 1 }, plannedRequirements: 0 }
}

const edgeReport = {
  ...report,
  cases: [
    {
      ...report.cases[0],
      result: {
        actualStatus: "rejected",
        decisions: [],
        diagnostics: [],
        error: { atInputId: "IN-1", code: "invalid-input" },
        mismatches: [{}],
        uncertainty: []
      },
      scenario: {
        ...report.cases[0]?.scenario,
        description: "A rejected authoritative scenario.",
        scenarioId: "SC-EPE-REJECTED",
        title: "Rejected scenario"
      },
      status: "failed"
    },
    {
      evidence: { reason: "evidence-incomplete", status: "incomplete" },
      expected: null,
      result: null,
      scenario: {
        description: "A planned requirement with partial executable evidence.",
        scenarioIds: ["foil.break-boundaries", "foil.target-context"],
        traceabilityId: "FOIL-PLANNED",
        weapon: "foil"
      },
      status: "planned-requirement"
    }
  ],
  summary: { executable: { failed: 1, passed: 0, total: 1 }, plannedRequirements: 1 }
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute("data-theme")
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderApp() {
  return render(
    <TooltipProvider delayDuration={0}>
      <App />
    </TooltipProvider>
  )
}

describe("Scoring simulator", () => {
  it("loads, filters, replays, and reruns the executable corpus", async () => {
    const runRequest = Promise.withResolvers<Response>()
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input
      if (init?.method === "POST") return runRequest.promise
      return Promise.resolve(Response.json(report))
    })
    vi.stubGlobal("fetch", fetchMock)
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:scoring-trace")
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    const user = userEvent.setup()

    renderApp()

    expect(await screen.findByRole("heading", { name: "Epee valid touch" })).toBeTruthy()
    expect(screen.getByRole("img", { name: /authoritative result available/i })).toBeTruthy()
    expect(screen.queryByText("ARMED")).toBeNull()
    expect(screen.queryByRole("columnheader", { name: "Actual result" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Next left output" })).toBeNull()
    expect(screen.getAllByRole("row")).toHaveLength(2)

    await user.hover(screen.getByRole("button", { name: "Epee valid touch" }))
    expect((await screen.findByRole("tooltip")).textContent).toBe("Epee valid touch")
    await user.unhover(screen.getByRole("button", { name: "Epee valid touch" }))

    await user.click(screen.getByRole("button", { name: "More actions" }))
    const darkTheme = screen.getByRole("menuitem", { name: "Dark theme" })
    expect(darkTheme.querySelector(".lucide-moon")).toBeTruthy()
    await user.click(darkTheme)
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    await user.click(screen.getByRole("button", { name: "More actions" }))
    expect(screen.getByRole("menuitem", { name: "Light theme" }).querySelector(".lucide-sun")).toBeTruthy()
    await user.keyboard("{Escape}")

    const playback = within(screen.getByRole("region", { name: "Playback controls" }))
    await user.click(playback.getByRole("button", { name: "Next event" }))
    expect(screen.getByRole("heading", { name: "Event 1 of 2" })).toBeTruthy()

    await user.click(playback.getByRole("button", { name: "Restart replay" }))
    await user.click(playback.getByRole("button", { name: "Next event" }))
    await user.click(playback.getByRole("button", { name: "Next event" }))
    expect(screen.getByRole("heading", { name: "Event 2 of 2" })).toBeTruthy()
    await user.click(playback.getByRole("button", { name: "Restart replay" }))
    await user.click(playback.getByRole("button", { name: "Play replay" }))
    await user.click(playback.getByRole("button", { name: "Pause replay" }))

    await user.click(screen.getByRole("button", { name: "Export report" }))
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:scoring-trace")

    await user.type(screen.getByRole("textbox", { name: "Search scenarios" }), "no match")
    expect(screen.getAllByRole("row")).toHaveLength(1)
    await user.clear(screen.getByRole("textbox", { name: "Search scenarios" }))
    expect(screen.getAllByRole("row")).toHaveLength(2)

    expect(screen.getByRole("button", { name: "Replay sound" }).hasAttribute("disabled")).toBe(true)

    await user.click(screen.getByRole("button", { name: "Run suite" }))
    expect(screen.getByRole("button", { name: "Running suite" })).toBeTruthy()
    expect(screen.getByText("Not run", { selector: "span" })).toBeTruthy()
    runRequest.resolve(Response.json(report))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ method: "POST" })
    expect(await screen.findByRole("button", { name: "Stop replay" })).toBeTruthy()
    expect(screen.getAllByText("Replaying", { selector: "span" })).toHaveLength(2)
    await user.click(screen.getByRole("button", { name: "Stop replay" }))
    expect(screen.getByRole("button", { name: "Run suite" })).toBeTruthy()
  })

  it("shows planned requirements and a rejected scenario", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      void input
      void init
      return Promise.resolve(Response.json(edgeReport))
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    renderApp()

    await user.click(
      await screen.findByRole("button", { name: /planned requirement with partial executable evidence/i })
    )
    expect(screen.getByText("Full requirement evidence is pending.")).toBeTruthy()
    expect(screen.getByText(/Partial executable scenarios: foil\.break-boundaries, foil\.target-context/)).toBeTruthy()
    expect(screen.getByText("Evidence pending", { selector: "span" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: /rejected scenario/i }))
    expect(screen.getByText("Failed", { selector: "span" })).toBeTruthy()
    expect(screen.getByRole("img", { name: /authoritative result unavailable/i })).toBeTruthy()

    expect(screen.getByRole("button", { name: "Next mismatch" }).hasAttribute("disabled")).toBe(true)
    await user.click(screen.getByRole("button", { name: /Rejection: Authoritative result unavailable/ }))
    expect(screen.getByRole("heading", { name: "Event 2 of 2" })).toBeTruthy()

    expect(screen.queryByRole("button", { name: "Run selected scenario" })).toBeNull()
    expect(screen.getByRole("button", { name: "Rerun failed" }).hasAttribute("disabled")).toBe(true)
    await user.click(screen.getByRole("button", { name: "Run suite" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock.mock.calls[1]?.[1]).toEqual({ method: "POST" })
  })

  it("reports an unavailable runner", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("runner offline")))
    )

    renderApp()

    expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t load scenarios.")
  })

  it.each([
    [
      "an empty planned mapping",
      {
        ...edgeReport,
        cases: [
          edgeReport.cases[0],
          {
            ...edgeReport.cases[1],
            scenario: { ...edgeReport.cases[1]?.scenario, scenarioIds: [] }
          }
        ]
      }
    ],
    [
      "duplicate mapped scenario IDs",
      {
        ...edgeReport,
        cases: [
          edgeReport.cases[0],
          {
            ...edgeReport.cases[1],
            scenario: {
              ...edgeReport.cases[1]?.scenario,
              scenarioIds: ["foil.break-boundaries", "foil.break-boundaries"]
            }
          }
        ]
      }
    ],
    [
      "summary counts that disagree with cases",
      { ...edgeReport, summary: { executable: { failed: 0, passed: 2, total: 2 }, plannedRequirements: 0 } }
    ]
  ])("rejects %s", async (_name, malformedReport) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(malformedReport)))
    )
    await expect(fetchSimulatorReport("/api/run")).rejects.toThrow()
  })
})
