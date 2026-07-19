import { describe, expect, it } from "vitest"
import { runtimeSelectionFromEnvironment } from "./runtimeSelection"

describe("runtimeSelectionFromEnvironment", () => {
  it("selects the pinned legacy runtime set", () => {
    expect(runtimeSelectionFromEnvironment({})).toMatchObject({
      agentRuntime: { provider: "openhands" },
      orchestrator: { provider: "langgraph", version: "1.4.7" },
      selectionVersion: 1,
      workspace: { provider: "daytona", version: "0.196.0" }
    })
  })

  it.each([
    ["ORCHESTRATOR_PROVIDER", "microsoft", "no-approved-microsoft-candidate-or-parity-evidence"],
    ["AGENT_RUNTIME_PROVIDER", "microsoft", "no-approved-microsoft-candidate-or-parity-evidence"],
    ["WORKSPACE_PROVIDER", "azure", "no-qualifying-azure-workspace-entry-driver"]
  ])("rejects unsupported %s selections", (name, value, reason) => {
    expect(() => runtimeSelectionFromEnvironment({ [name]: value })).toThrow(reason)
  })
})
