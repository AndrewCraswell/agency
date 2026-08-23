import { describe, expect, it } from "vitest"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

describe("prototype USB-C PD power contract", () => {
  const result = calculateBenchPrototypePowerContract()

  it("keeps the exact sink-only 20 V / 3 A USB-C PD path", () => {
    expect(defaultBenchPrototypePowerInputs.normalInput.ccAndSbuProtectionTopology).toBe("series-cc1-cc2-sbu1-sbu2")
    expect(defaultBenchPrototypePowerInputs.normalInput.usbDataProtectionTopology).toBe(
      "shunt-dminus-dplus-to-app-ground"
    )
    expect(defaultBenchPrototypePowerInputs.normalInput.parts).toEqual({
      ccAndSbuProtectorMpn: "TPD4S201TRGRRQ1",
      disconnectSurgeDiodeMpn: "B340A-13-F",
      efuseMpn: "TPS259474ARPWR",
      pdControllerMpn: "TPS25730ADREFR",
      receptacleMpn: "10177070-00011LF",
      usbDataShuntProtectorMpn: "TPD2EUSB30DRTR",
      vbusTvsMpn: "TVS2200DRVR"
    })
    expect(result.normalPdContractW).toBe(60)
    expect(result.normalEfuseMinimumPowerW).toBeCloseTo(47.9, 1)
  })

  it("uses physical source selection for mutually exclusive post-eFuse lab injection", () => {
    expect(defaultBenchPrototypePowerInputs.sourceSelector).toMatchObject({
      changeOnlyDeenergized: true,
      mpn: "7101SYZQE",
      simultaneousSourcesProhibited: true
    })
    expect(defaultBenchPrototypePowerInputs.labInjection).toMatchObject({
      connectorMpn: "43045-0400",
      contactProjectScreenA: 3,
      equalLengthPairsRequired: true,
      injectionNode: "LAB_POST_EFUSE_20V",
      maximumCurrentA: 2.3,
      matingHousingMpn: "43025-0400",
      normalProductInterface: false,
      pin1Net: "LAB_20V",
      pin2Net: "LAB_20V",
      pin3Net: "LAB_RETURN",
      pin4Net: "LAB_RETURN",
      terminalMpn: "43030-0007",
      voltageV: 20,
      wireGaugeAwg: 20
    })
    expect(result.labInjectionMaximumPowerW).toBe(46)
    expect(result.sourceSelection).toBe("physical-spdt-mutual-exclusion")
  })

  it("applies 25 percent fuse derating and a coordinated display limiter", () => {
    expect(defaultBenchPrototypePowerInputs.branches.display.fuse).toMatchObject({
      continuousDeratingFraction: 0.25,
      mpn: "045106.3MRL",
      nominalCurrentA: 6.3
    })
    expect(result.displayLimiter.minimumCurrentLimitA).toBeGreaterThan(4.25)
    expect(result.displayLimiter.maximumCurrentLimitA).toBeLessThan(5.31)
    expect(result.displayLimiter.maximumCurrentLimitA).toBeLessThan(6)
    expect(defaultBenchPrototypePowerInputs.branches.display.limiter).toMatchObject({
      autoRetryDelayMs: 110,
      bypassCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND",
      bypassCapacitorMpn: "C0402C104K3RACTU",
      bypassCapacitanceUf: 0.1,
      currentLimitResistorConnection: "ILM_TO_APP_GND",
      currentLimitResistorMpn: "RC0402FR-07698RL",
      dvdTCapacitorConnection: "DVDT_TO_APP_GND",
      dvdTCapacitorMpn: "C0402C222K3RACTU",
      dvdTCapacitanceNf: 2.2,
      enUvloConnection: "V5_DISPLAY_IN",
      inputCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND",
      inputCapacitorMpn: "C2012X7S1A226M125AC",
      inputCapacitanceUf: 22,
      iTimerCapacitorConnection: "ITIMER_TO_APP_GND",
      iTimerCapacitorMpn: "C0402C222K3RACTU",
      iTimerCapacitanceNf: 2.2,
      outputCapacitorConnection: "V5_DISPLAY_LIMITED_TO_APP_GND",
      outputCapacitorMpn: "C2012X7S1A226M125AC",
      outputCapacitanceUf: 22,
      ovloConnection: "APP_GND",
      pgPullupConnection: "V3_3_TO_PG",
      pgPullupMpn: "RC0402FR-0710KL",
      pgPullupOhms: 10000,
      pgThresholdLowerMpn: "RC0402FR-0749K9L",
      pgThresholdLowerOhms: 49900,
      pgThresholdUpperMpn: "RC0402FR-07137KL",
      pgThresholdUpperOhms: 137000,
      pgThresholdDividerConnection: "V5_DISPLAY_LIMITED_TO_PGTH_TO_APP_GND",
      retryMode: "circuit-breaker-auto-retry"
    })
  })

  it("pins the canonical selected-system load allocations", () => {
    expect(result.v5ContinuousCurrentA).toBeCloseTo(5.392, 3)
    expect(result.v5PeakCurrentA).toBeCloseTo(6.093, 3)
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        branches: {
          ...defaultBenchPrototypePowerInputs.branches,
          display: {
            ...defaultBenchPrototypePowerInputs.branches.display,
            expectedContinuousA: 0.01,
            expectedPeakA: 0.01
          }
        }
      })
    ).toThrow("must be at least the canonical 4")
  })

  it("requires all four exact 6 A removable measurement links", () => {
    for (const link of Object.values(defaultBenchPrototypePowerInputs.measurementLinks)) {
      expect(link).toMatchObject({
        boardHeaderMpn: "39-28-1023",
        contactProjectScreenA: 6,
        deenergizedRemovalOnly: true,
        loopbackRequired: true,
        matingHousingMpn: "39-01-2020",
        terminalMpn: "39-00-0039"
      })
    }
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        measurementLinks: {
          ...defaultBenchPrototypePowerInputs.measurementLinks,
          input: { ...defaultBenchPrototypePowerInputs.measurementLinks.input, contactProjectScreenA: 100 }
        }
      })
    ).toThrow("measurementLinks.input.contactProjectScreenA must be 6")
  })

  it("rejects PD-part substitution or weakened eFuse limits", () => {
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        normalInput: {
          ...defaultBenchPrototypePowerInputs.normalInput,
          parts: { ...defaultBenchPrototypePowerInputs.normalInput.parts, pdControllerMpn: "generic-pd" }
        }
      })
    ).toThrow("normalInput.parts.pdControllerMpn must be TPS25730ADREFR")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        normalInput: {
          ...defaultBenchPrototypePowerInputs.normalInput,
          efuseCurrentLimit: { ...defaultBenchPrototypePowerInputs.normalInput.efuseCurrentLimit, minimumA: 1 }
        }
      })
    ).toThrow("normalInput.efuseCurrentLimit.minimumA must be 2.395")
  })

  it("rejects omitted USB data protection, lab mate/pin substitutions, and display-support changes", () => {
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        normalInput: {
          ...defaultBenchPrototypePowerInputs.normalInput,
          parts: { ...defaultBenchPrototypePowerInputs.normalInput.parts, usbDataShuntProtectorMpn: "omitted" }
        }
      })
    ).toThrow("normalInput.parts.usbDataShuntProtectorMpn must be TPD2EUSB30DRTR")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        normalInput: {
          ...defaultBenchPrototypePowerInputs.normalInput,
          usbDataProtectionTopology: "series-through-tpd4"
        }
      })
    ).toThrow("inputs must include every USB-C PD power declaration")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        labInjection: { ...defaultBenchPrototypePowerInputs.labInjection, matingHousingMpn: "wrong-mate" }
      })
    ).toThrow("labInjection.matingHousingMpn must be 43025-0400")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        labInjection: { ...defaultBenchPrototypePowerInputs.labInjection, pin4Net: "LAB_20V" }
      })
    ).toThrow("USB-C PD power declaration")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        branches: {
          ...defaultBenchPrototypePowerInputs.branches,
          display: {
            ...defaultBenchPrototypePowerInputs.branches.display,
            limiter: { ...defaultBenchPrototypePowerInputs.branches.display.limiter, iTimerCapacitanceNf: 0 }
          }
        }
      })
    ).toThrow("branches.display.limiter.iTimerCapacitanceNf must be 2.2")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        branches: {
          ...defaultBenchPrototypePowerInputs.branches,
          display: {
            ...defaultBenchPrototypePowerInputs.branches.display,
            limiter: { ...defaultBenchPrototypePowerInputs.branches.display.limiter, pgPullupMpn: "generic-10k" }
          }
        }
      })
    ).toThrow("branches.display.limiter.pgPullupMpn must be RC0402FR-0710KL")
  })

  it("rejects simultaneous-source permission and excessive lab current", () => {
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        sourceSelector: {
          ...defaultBenchPrototypePowerInputs.sourceSelector,
          simultaneousSourcesProhibited: false
        }
      })
    ).toThrow("must prohibit simultaneous sources")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        labInjection: { ...defaultBenchPrototypePowerInputs.labInjection, maximumCurrentA: 2.5 }
      })
    ).toThrow("lab injection must be greater than 0 A and remain at or below 2.3 A")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        labInjection: { ...defaultBenchPrototypePowerInputs.labInjection, contactProjectScreenA: 10 }
      })
    ).toThrow("labInjection.contactProjectScreenA must be 3")
    for (const maximumCurrentA of [0, -1]) {
      expect(() =>
        calculateBenchPrototypePowerContract({
          ...defaultBenchPrototypePowerInputs,
          labInjection: { ...defaultBenchPrototypePowerInputs.labInjection, maximumCurrentA }
        })
      ).toThrow("lab injection must be greater than 0 A and remain at or below 2.3 A")
    }
  })

  it("rejects peak declarations below their continuous declarations", () => {
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        branches: {
          ...defaultBenchPrototypePowerInputs.branches,
          display: {
            ...defaultBenchPrototypePowerInputs.branches.display,
            expectedContinuousA: 4.1,
            expectedPeakA: 4
          }
        }
      })
    ).toThrow("branches.display.expectedPeakA must be at least expectedContinuousA")
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        selectedSystemInputDemand: {
          ...defaultBenchPrototypePowerInputs.selectedSystemInputDemand,
          continuousA: 1.9
        }
      })
    ).toThrow("selectedSystemInputDemand.peakA must be at least continuousA")
  })

  it("keeps physical and display release denied", () => {
    expect(result).toMatchObject({
      declarationsValid: true,
      displayConnectedPermit: "deny-until-inrush-measured",
      physicalPresenceVerified: false,
      releaseState: "deny"
    })
    expect(() =>
      calculateBenchPrototypePowerContract({
        ...defaultBenchPrototypePowerInputs,
        displayDisconnectReference: undefined
      })
    ).toThrow("inputs must include every USB-C PD power declaration")
  })
})
