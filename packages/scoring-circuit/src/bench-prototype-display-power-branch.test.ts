import { describe, expect, it } from "vitest"
import {
  benchPrototypeDisplayPowerBranch,
  benchPrototypeDisplayPowerBranchUpstreamProvenance,
  validateBenchPrototypeDisplayPowerBranch
} from "./bench-prototype-display-power-branch.js"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

describe("BP-055 protected HUB75 display-power branch", () => {
  it("freezes the exact limiter, fuse, disconnect, link, and panel-power connector", () => {
    expect(validateBenchPrototypeDisplayPowerBranch(benchPrototypeDisplayPowerBranch)).toBe(true)
    expect(benchPrototypeDisplayPowerBranch.limiter).toMatchObject({
      reference: "U_DISPLAY_LIMITER",
      mpn: "TPS259474ARPWR",
      outputNet: "V5_DISPLAY_LIMITED",
      autoRetryDelayMs: 110,
      currentLimitResistor: {
        reference: "R_DISPLAY_ILM",
        mpn: "RC0402FR-07698RL",
        resistanceOhms: 698,
        resistanceToleranceFraction: 0.01,
        currentLimitToleranceFraction: 0.1
      }
    })
    expect(benchPrototypeDisplayPowerBranch.limiter.minimumCurrentLimitA).toBeCloseTo(4.2563, 4)
    expect(benchPrototypeDisplayPowerBranch.limiter.maximumCurrentLimitA).toBeCloseTo(5.3072, 4)
    expect(benchPrototypeDisplayPowerBranch.fuse).toMatchObject({
      reference: "F_DISPLAY",
      manufacturer: "Littelfuse",
      mpn: "045106.3MRL",
      nominalCurrentA: 6.3,
      deratedContinuousCurrentA: 4.725
    })
    expect(benchPrototypeDisplayPowerBranch.disconnect).toMatchObject({
      reference: "J_DISPLAY_DISCONNECT",
      manufacturer: "Molex",
      mpn: "43650-0200",
      mateMpn: "43645-0200",
      terminalMpn: "43030-0007",
      positions: 2,
      contactRatingA: 7
    })
    expect(benchPrototypeDisplayPowerBranch.measurementLink).toMatchObject({
      reference: "J_LINK_DISPLAY",
      boardHeaderMpn: "39-28-1023",
      matingHousingMpn: "39-01-2020",
      terminalMpn: "39-00-0039",
      pin1Net: "V5_DISPLAY_LIMITED",
      pin2Net: "V5_DISPLAY_LOAD",
      contactProjectScreenA: 6,
      loopbackRequired: true,
      removable: true,
      removalOnlyWhileDeenergized: true
    })
    expect(benchPrototypeDisplayPowerBranch.connector).toMatchObject({
      reference: "J_DISPLAY_POWER_PIGTAIL",
      productId: "4767",
      branchCount: 2,
      panelSide: { housingMpn: "SMR-04V-N", contactMpn: "SYM-001T-P0.6" },
      cableSide: { housingMpn: "SMP-04V-NC", contactMpn: "SHF-001T-0.8BS" },
      parallelV5ContactsPerBranch: 2,
      parallelReturnContactsPerBranch: 2
    })
  })

  it("binds the selected Adafruit 2277 current envelope without granting startup credit", () => {
    expect(benchPrototypeDisplayPowerBranch.selectedPanelCurrentEnvelope).toMatchObject({
      productId: "2277",
      supplyVoltageV: 5,
      continuousCurrentA: 4,
      peakCurrentA: 4,
      continuousPowerW: 20,
      peakPowerW: 20,
      peakDurationMs: 100,
      panelCurrentScreenPass: true,
      connectorContactScreenPass: false
    })
    expect(benchPrototypeDisplayPowerBranch.powerScreen).toMatchObject({
      continuous: {
        panelCurrentA: 4,
        panelPowerW: 20,
        arithmeticFit: true
      },
      peak: {
        panelCurrentA: 4,
        panelPowerW: 20,
        arithmeticFit: true
      },
      startupInrush: { measured: false, releasePass: false, status: "unmeasured-gate" }
    })
    expect(benchPrototypeDisplayPowerBranch.authority).toMatchObject({
      panelPowerConnectedPermit: "deny-until-inrush-current-sharing-cable-drop-and-thermal-evidence",
      releaseState: "deny",
      fabricationAuthorized: false
    })
  })

  it("defines a de-energized panel-power safe-off state", () => {
    expect(benchPrototypeDisplayPowerBranch.safeOff).toMatchObject({
      state: "safe-off",
      status: "unvalidated-deny",
      disconnectState: "J_DISPLAY_DISCONNECT open",
      measurementLinkState: "J_LINK_DISPLAY removed or open; never a power-injection point",
      panelPowerConnectorState: "J_DISPLAY_POWER_PIGTAIL disconnected from the panel",
      signalState: "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high"
    })
    expect(benchPrototypeDisplayPowerBranch.safeOff.requiredConditions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("disconnect USB-C"),
        expect.stringContaining("remove the source"),
        expect.stringContaining("startup, inrush")
      ])
    )
    expect(benchPrototypeDisplayPowerBranch.evidence).toMatchObject({
      panelReceiptVerified: false,
      branchContinuityVerified: false,
      startupInrushMeasured: false,
      connectorTemperatureMeasured: false,
      fabricationAuthorized: false
    })
  })

  it("rejects forged contracts and upstream power drift", () => {
    const forged = structuredClone(benchPrototypeDisplayPowerBranch)
    Reflect.set(forged.fuse, "nominalCurrentA", 10)
    expect(() => validateBenchPrototypeDisplayPowerBranch(forged)).toThrow(RangeError)

    const originalMpn = defaultBenchPrototypePowerInputs.branches.display.fuse.mpn
    try {
      Reflect.set(defaultBenchPrototypePowerInputs.branches.display.fuse, "mpn", "FORGED-FUSE")
      expect(() => validateBenchPrototypeDisplayPowerBranch(benchPrototypeDisplayPowerBranch)).toThrow(RangeError)
    } finally {
      Reflect.set(defaultBenchPrototypePowerInputs.branches.display.fuse, "mpn", originalMpn)
    }
    expect(validateBenchPrototypeDisplayPowerBranch(benchPrototypeDisplayPowerBranch)).toBe(true)
  })

  it("keeps the canonical object graphs immutable and provenance-specific", () => {
    expect(Object.isFrozen(benchPrototypeDisplayPowerBranch)).toBe(true)
    expect(Object.isFrozen(benchPrototypeDisplayPowerBranch.limiter)).toBe(true)
    expect(Object.isFrozen(benchPrototypeDisplayPowerBranch.connector.pinMap)).toBe(true)
    expect(Object.isFrozen(benchPrototypeDisplayPowerBranch.safeOff.requiredConditions)).toBe(true)
    expect(Object.isFrozen(benchPrototypeDisplayPowerBranchUpstreamProvenance)).toBe(true)
    expect(benchPrototypeDisplayPowerBranchUpstreamProvenance.bp050.measurementLink).toMatchObject({
      boardHeaderMpn: "39-28-1023",
      pin1Net: "V5_DISPLAY_LIMITED",
      pin2Net: "V5_DISPLAY_LOAD"
    })
  })
})
