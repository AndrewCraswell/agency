import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { createVirtualEventJournalStorage } from "./event-journal.js"
import { createResetRecoveryScenario } from "./reset-recovery-scenarios.js"
import { runScenario } from "./scenario-runner.js"

const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const audioVisualScenarioPath = resolve(
  applicationDirectory,
  "docs/golden-scenarios/epee-audio-visual-correlation.json"
)
describe("EPEE-05 audio, visual, and reset evidence", () => {
  it("requires one host-projection qualified hit to request both audio and the matching visual signal", () => {
    const run = runScenario(audioVisualScenarioPath)

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]).toMatchObject({
      scenarioId: "epee.audio-visual-correlation",
      status: "passed",
      decisions: [
        {
          decisionAtUs: 2_000,
          disposition: "qualified-hit",
          side: "right",
          signal: { audible: "requested", latched: true, visual: "valid-hit" },
          sourceInputIds: ["right-start", "right-qualified"]
        }
      ],
      nonEvents: [{ id: "left-short-contact-no-hit", satisfied: true }]
    })
  })

  it("fails closed when a latched primary output is followed by an STM32 reset", () => {
    const model = createResetRecoveryScenario({
      applicationBootId: "esp32-epee-05",
      journalStorage: createVirtualEventJournalStorage(),
      scoringBootId: "stm32-epee-05"
    })

    model.observeStm32PrimaryOutput("latched")
    model.resetStm32("watchdog")

    expect(model.primaryOutput).toBe("safe-inactive")
    expect(model.scoringAvailability).toBe("unavailable")
    expect(model.diagnostics.at(-1)).toMatchObject({
      detail: "warm-reset-latch-unresolved",
      primaryOutput: "safe-inactive",
      scoringAvailability: "unavailable",
      subject: "scoring"
    })
  })
})
