import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { ScenarioDisplayProjection } from "../../../src/scenario-display-projection"
import { DeveloperDisplay } from "./DeveloperDisplay"

const projection: ScenarioDisplayProjection = {
  accessibleLabel: "Epee authoritative result available",
  authoritativeResult: "available",
  audibleRequested: true,
  bladeContact: true,
  cursorAtUs: 5,
  event: null,
  eventCount: 0,
  eventNumber: 0,
  leftContact: true,
  leftFault: false,
  leftLamp: "valid-hit",
  leftWhiteDiagnostic: "on",
  leftYellowDiagnostic: "on",
  latestDecision: null,
  rightContact: true,
  rightFault: false,
  rightLamp: "off-target",
  rightWhiteDiagnostic: "on",
  rightYellowDiagnostic: "on",
  weapon: "epee"
}

afterEach(cleanup)

describe("Developer display", () => {
  it("renders the Pencil lamps, ground indicators, and whip-over status", () => {
    const { container } = render(<DeveloperDisplay projection={projection} />)

    expect(screen.getByRole("img", { name: /authoritative result available/i })).toBeTruthy()
    expect(container.querySelector(".score-lamp-left.is-active")).toBeTruthy()
    expect(container.querySelector(".score-lamp-off-target.is-active")).toBeTruthy()
    expect(container.querySelectorAll(".status-indicator")).toHaveLength(3)
    expect(container.querySelectorAll(".status-indicator.is-warning")).toHaveLength(2)
    expect(screen.getByText("WHIP-OVER")).toBeTruthy()
    expect(screen.queryByText("AUTHORITATIVE")).toBeNull()
    expect(screen.queryByText("AUDIO")).toBeNull()
  })

  it("renders unavailable and inactive states without illumination", () => {
    const inactive: ScenarioDisplayProjection = {
      ...projection,
      accessibleLabel: "Sabre authoritative result unavailable",
      authoritativeResult: "unavailable",
      audibleRequested: false,
      bladeContact: false,
      event: null,
      eventCount: 0,
      eventNumber: 0,
      leftLamp: "off",
      leftWhiteDiagnostic: "off",
      leftYellowDiagnostic: "off",
      rightLamp: "valid-hit",
      rightWhiteDiagnostic: "off",
      rightYellowDiagnostic: "off",
      weapon: "sabre"
    }
    const { container } = render(<DeveloperDisplay projection={inactive} />)

    expect(screen.getByRole("img", { name: /authoritative result unavailable/i })).toBeTruthy()
    expect(container.querySelector(".score-lamp-right.is-active")).toBeTruthy()
    expect(container.querySelectorAll(".status-indicator.is-warning")).toHaveLength(0)
  })
})
