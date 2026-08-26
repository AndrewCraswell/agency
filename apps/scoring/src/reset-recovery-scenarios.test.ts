import { describe, expect, it } from "vitest"
import { DECISION_RECORD_SCHEMA_VERSION, type DecisionRecord } from "./decision-record.js"
import { VirtualJournalPowerLoss, createVirtualEventJournalStorage } from "./event-journal.js"
import { createResetRecoveryScenario } from "./reset-recovery-scenarios.js"
import { createVirtualProcessorLink } from "./virtual-processor-link.js"

function record(recordId: string, decisionAtUs: number): DecisionRecord {
  return {
    captureWindow: {
      firstSequence: decisionAtUs,
      fromUs: decisionAtUs,
      lastSequence: decisionAtUs,
      throughUs: decisionAtUs
    },
    decisionAtUs,
    outcome: {
      disposition: "qualified-hit",
      hitStartedAtUs: decisionAtUs,
      qualifiedAtUs: decisionAtUs,
      side: "left",
      signal: { audible: "requested", latched: true, visual: "valid-hit" },
      weapon: "epee"
    },
    provenance: {
      calibrationProfileRevision: "calibration-1",
      firmware: {
        buildDigest: `sha256:${"c3".repeat(32)}`,
        identity: "stm32-scoring",
        scoringBootId: "stm32-boot-a"
      },
      hardwareRevision: "evt-a",
      lineContractRevision: "lines-1",
      ruleSetRevision: "rules-1",
      timingTableRevision: "timing-1"
    },
    rawCaptureRefs: [],
    recordId,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

function scenario() {
  const storage = createVirtualEventJournalStorage()
  const link = createVirtualProcessorLink()
  return {
    link,
    model: createResetRecoveryScenario({
      applicationBootId: "esp32-boot-a",
      journalStorage: storage,
      processorLink: link,
      scoringBootId: "stm32-boot-a"
    }),
    storage
  }
}

const passingGates = {
  acquisitionAndLineSafety: true,
  clockAndConfiguration: true,
  railAndResetSupervision: true,
  safeOutputControls: true,
  watchdogArmed: true
} as const

describe("reset recovery scenarios", () => {
  it.each(["watchdog", "brownout", "operator", "firmware-update"] as const)(
    "makes STM32 %s reset unavailable until reviewed recovery",
    (cause) => {
      const { model } = scenario()
      model.observeStm32PrimaryOutput("latched")
      const beforeBoot = model.scoringBootId

      model.resetStm32(cause)

      expect(model.scoringAvailability).toBe("unavailable")
      expect(model.primaryOutput).toBe("safe-inactive")
      expect(model.scoringBootId).not.toBe(beforeBoot)
      expect(model.diagnostics.at(-1)).toMatchObject({
        cause,
        detail: "warm-reset-latch-unresolved",
        primaryOutput: "safe-inactive",
        scoringAvailability: "unavailable",
        subject: "scoring"
      })
      expect(model.completeStm32TechnicalRecovery(passingGates)).toBe(true)
      expect(model.scoringAvailability).toBe("awaiting-supervisor-disposition")
      expect(() => model.observeStm32PrimaryOutput("latched")).toThrow("unavailable")
      model.supervisorAuthorizeNewScoringState()
      expect(model.scoringAvailability).toBe("available")
    }
  )

  it("keeps the STM32 authority and latched primary output unchanged across ESP32 resets", () => {
    const { model } = scenario()
    model.observeStm32PrimaryOutput("latched")
    const scoringBootId = model.scoringBootId

    model.resetApplication("watchdog")

    expect(model.applicationAvailability).toBe("unavailable")
    expect(model.scoringAvailability).toBe("available")
    expect(model.scoringBootId).toBe(scoringBootId)
    expect(model.primaryOutput).toBe("latched")
    expect(model.diagnostics.at(-1)).toMatchObject({
      cause: "watchdog",
      detail: "journal-recovery",
      subject: "application"
    })
    model.completeApplicationRecovery()
    expect(model.applicationAvailability).toBe("awaiting-record-reception")
    model.confirmApplicationRecordReception()
    expect(model.applicationAvailability).toBe("available")
  })

  it("refuses automatic ESP32-to-STM32 reset without changing scoring authority", () => {
    const { model } = scenario()
    model.observeStm32PrimaryOutput("latched")
    const bootId = model.scoringBootId

    expect(model.requestForbiddenEsp32ToStm32Reset()).toBe(false)

    expect(model.scoringAvailability).toBe("available")
    expect(model.primaryOutput).toBe("latched")
    expect(model.scoringBootId).toBe(bootId)
    expect(model.diagnostics.at(-1)).toMatchObject({
      detail: "automatic-esp32-to-stm32-reset-forbidden",
      subject: "application"
    })
  })

  it("treats link loss and recovery as diagnostics without a scoring reset", () => {
    const { link, model } = scenario()
    model.observeStm32PrimaryOutput("latched")
    const scoringBootId = model.scoringBootId

    model.disconnectLink()
    expect(link.connected).toBe(false)
    expect(model.diagnostics.at(-1)).toMatchObject({ cause: "link-loss", detail: "link-lost" })
    expect(model.scoringAvailability).toBe("available")
    expect(model.primaryOutput).toBe("latched")
    model.reconnectLink()

    expect(link.connected).toBe(true)
    expect(model.scoringBootId).toBe(scoringBootId)
    expect(model.diagnostics.at(-1)).toMatchObject({
      cause: "link-reconnect",
      detail: "link-restored-awaits-validation",
      subject: "processor-link"
    })
    const diagnosticCount = model.diagnostics.length
    model.reconnectLink()
    expect(model.diagnostics).toHaveLength(diagnosticCount)
  })

  it("makes whole-device loss a new independent-boot lifecycle", () => {
    const { link, model } = scenario()
    model.observeStm32PrimaryOutput("latched")
    const oldApplicationBootId = model.applicationBootId
    const oldScoringBootId = model.scoringBootId

    model.wholeDevicePowerLoss()

    expect(link.connected).toBe(false)
    expect(model.applicationAvailability).toBe("unavailable")
    expect(model.scoringAvailability).toBe("unavailable")
    expect(model.primaryOutput).toBe("safe-inactive")
    model.restoreWholeDevicePower()
    expect(model.applicationBootId).not.toBe(oldApplicationBootId)
    expect(model.scoringBootId).not.toBe(oldScoringBootId)
    expect(model.diagnostics.at(-1)).toMatchObject({
      cause: "power-on",
      detail: "journal-recovery",
      subject: "journal"
    })
  })

  it("recovers only the old or complete new journal checkpoint after a power interruption", () => {
    for (const boundary of ["prepared-header", "prepared-records", "prepared-integrity", "commit-marker"] as const) {
      const { model, storage } = scenario()
      model.appendDurableRecord(record("old", 100))
      storage.armPowerLoss(boundary)

      expect(() => model.appendDurableRecord(record("new", 200))).toThrow(VirtualJournalPowerLoss)
      model.wholeDevicePowerLoss()
      model.restoreWholeDevicePower()

      expect(model.journal.records.map((entry) => entry.recordId)).toEqual(
        boundary === "commit-marker" ? ["old", "new"] : ["old"]
      )
      expect(model.journal.recovery).toEqual({ reason: null, status: "recovered" })
    }
  })

  it("does not enable scoring after failed technical gates and bounds diagnostics", () => {
    const { model } = scenario()
    model.resetStm32("brownout")

    expect(model.completeStm32TechnicalRecovery({ ...passingGates, safeOutputControls: false })).toBe(false)
    expect(model.scoringAvailability).toBe("unavailable")
    expect(model.diagnostics.at(-1)).toMatchObject({ detail: "stm32-technical-recovery-failed" })
    expect(Object.isFrozen(model.diagnostics)).toBe(true)
    expect(Object.isFrozen(model.diagnostics[0])).toBe(true)
  })

  it("preflights diagnostic capacity so lifecycle transitions cannot partially apply", () => {
    const storage = createVirtualEventJournalStorage()
    const link = createVirtualProcessorLink()
    const model = createResetRecoveryScenario({
      applicationBootId: "esp32-boot-a",
      journalStorage: storage,
      maxDiagnostics: 1,
      processorLink: link,
      scoringBootId: "stm32-boot-a"
    })
    const scoringBootId = model.scoringBootId

    expect(() => model.wholeDevicePowerLoss()).toThrow("diagnostic capacity")

    expect(link.connected).toBe(true)
    expect(model.applicationAvailability).toBe("available")
    expect(model.scoringAvailability).toBe("available")
    expect(model.scoringBootId).toBe(scoringBootId)
    expect(model.primaryOutput).toBe("safe-inactive")
    expect(model.diagnostics).toEqual([])
  })

  it("leaves reset state unchanged when a boot ID is exhausted", () => {
    const storage = createVirtualEventJournalStorage()
    const model = createResetRecoveryScenario({
      applicationBootId: "esp32-boot-a",
      journalStorage: storage,
      scoringBootId: "s".repeat(128)
    })
    const exhaustedBootId = model.scoringBootId

    expect(() => model.resetStm32("watchdog")).toThrow("boot ID capacity")

    expect(model.scoringBootId).toBe(exhaustedBootId)
    expect(model.scoringAvailability).toBe("available")
    expect(model.primaryOutput).toBe("safe-inactive")
    expect(model.diagnostics).toEqual([])
    model.resetApplication("operator")
    expect(model.applicationBootId).toBe("esp32-boot-a-recovery-1")
  })

  it("derives every reset boot ID from the original base identity", () => {
    const { model } = scenario()

    model.resetApplication("operator")
    expect(model.applicationBootId).toBe("esp32-boot-a-recovery-1")
    model.resetApplication("watchdog")

    expect(model.applicationBootId).toBe("esp32-boot-a-recovery-2")
  })

  it("rejects durable writes while the application controller is unavailable or power is absent", () => {
    const { model } = scenario()
    model.resetApplication("operator")
    expect(() => model.appendDurableRecord(record("unavailable", 100))).toThrow("available powered")
    model.wholeDevicePowerLoss()
    expect(() => model.appendDurableRecord(record("power-lost", 200))).toThrow("available powered")
  })

  it("rejects accessor and symbol recovery-gate input without invoking it", () => {
    const { model } = scenario()
    model.resetStm32("watchdog")
    let read = false
    const accessorGates = {
      acquisitionAndLineSafety: true,
      clockAndConfiguration: true,
      railAndResetSupervision: true,
      safeOutputControls: true,
      watchdogArmed: true
    }
    Object.defineProperty(accessorGates, "watchdogArmed", {
      enumerable: true,
      get() {
        read = true
        return true
      }
    })
    expect(() => model.completeStm32TechnicalRecovery(accessorGates)).toThrow("enumerable boolean data")
    expect(read).toBe(false)
    expect(() => model.completeStm32TechnicalRecovery({ ...passingGates, [Symbol("extra")]: true })).toThrow(
      "canonical fields"
    )
  })

  it("fails closed for corrupt journal recovery and invalid lifecycle transitions", () => {
    const { model, storage } = scenario()
    model.appendDurableRecord(record("accepted", 100))
    storage.corruptCommitted("crc")
    model.resetApplication("brownout")
    model.completeApplicationRecovery()

    expect(model.applicationAvailability).toBe("unavailable")
    expect(model.diagnostics.at(-1)).toMatchObject({ subject: "journal", detail: "journal-recovery" })
    expect(() => model.confirmApplicationRecordReception()).toThrow("connected recovering")
    expect(() => model.supervisorAuthorizeNewScoringState()).toThrow("requires completed")
    expect(() => model.observeStm32PrimaryOutput("invalid" as never)).toThrow("not recognized")
    model.disconnectLink()
    const diagnosticCount = model.diagnostics.length
    model.disconnectLink()
    expect(model.diagnostics).toHaveLength(diagnosticCount)
    model.wholeDevicePowerLoss()
    const powerLossDiagnosticCount = model.diagnostics.length
    model.wholeDevicePowerLoss()
    expect(model.diagnostics).toHaveLength(powerLossDiagnosticCount)
    expect(() => model.completeStm32TechnicalRecovery(passingGates)).toThrow("power is absent")
    expect(() => model.resetStm32("watchdog")).toThrow("power is absent")
  })

  it("rejects malformed options and impossible recovery transitions", () => {
    const storage = createVirtualEventJournalStorage()
    expect(() => createResetRecoveryScenario(null as never)).toThrow("options")
    expect(() => createResetRecoveryScenario(JSON.parse('{"journalStorage":{},"scoringBootId":"stm32"}'))).toThrow(
      "require applicationBootId"
    )
    expect(() =>
      createResetRecoveryScenario({ applicationBootId: "", journalStorage: storage, scoringBootId: "stm32" })
    ).toThrow("bounded identifier")
    expect(() =>
      createResetRecoveryScenario({ applicationBootId: "esp32", journalStorage: null as never, scoringBootId: "stm32" })
    ).toThrow("requires journal storage")
    expect(() =>
      createResetRecoveryScenario({
        applicationBootId: "esp32",
        journalStorage: storage,
        maxDiagnostics: 257,
        scoringBootId: "stm32"
      })
    ).toThrow("capacity")
    expect(() =>
      createResetRecoveryScenario({
        applicationBootId: "esp32",
        journalStorage: storage,
        maxJournalRecords: 33,
        scoringBootId: "stm32"
      })
    ).toThrow("capacity")
    expect(() =>
      createResetRecoveryScenario({
        applicationBootId: "esp32",
        journalStorage: storage,
        processorLink: null as never,
        scoringBootId: "stm32"
      })
    ).toThrow("processor link")
    expect(() =>
      createResetRecoveryScenario({
        applicationBootId: "esp32",
        journalStorage: storage,
        processorLink: {} as never,
        scoringBootId: "stm32"
      })
    ).toThrow("processor link")
    expect(() =>
      createResetRecoveryScenario(
        JSON.parse('{"applicationBootId":"esp32","journalStorage":{},"scoringBootId":"stm32","unexpected":true}')
      )
    ).toThrow("unrecognized")
    expect(() =>
      createResetRecoveryScenario({
        applicationBootId: "esp32",
        journalStorage: storage,
        maxDiagnostics: 0,
        scoringBootId: "stm32"
      })
    ).toThrow("capacity")

    let applicationBootIdRead = false
    const accessorOptions = {
      applicationBootId: "esp32",
      journalStorage: storage,
      scoringBootId: "stm32"
    }
    Object.defineProperty(accessorOptions, "applicationBootId", {
      enumerable: true,
      get() {
        applicationBootIdRead = true
        return "esp32"
      }
    })
    expect(() => createResetRecoveryScenario(accessorOptions)).toThrow("enumerable data")
    expect(applicationBootIdRead).toBe(false)

    const { model } = scenario()
    expect(() => model.resetStm32("invalid" as never)).toThrow("not recognized")
    expect(() => model.completeStm32TechnicalRecovery(null as never)).toThrow("gates")
    expect(() => model.completeStm32TechnicalRecovery(passingGates)).toThrow("requires an unavailable")
    expect(() => model.completeApplicationRecovery()).toThrow("requires an unavailable")
    expect(() => model.restoreWholeDevicePower()).toThrow("requires an active")
    model.wholeDevicePowerLoss()
    expect(() => model.resetApplication("watchdog")).toThrow("power is absent")
  })
})
