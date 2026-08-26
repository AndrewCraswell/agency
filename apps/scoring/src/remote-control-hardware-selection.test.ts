import { describe, expect, it } from "vitest"
import {
  remoteControlHardwareSelection,
  validateRemoteControlHardwareSelection
} from "./remote-control-hardware-selection.js"

describe("RC-04 handheld hardware selection", () => {
  it("freezes the exact handheld and apparatus interface candidates", () => {
    expect(validateRemoteControlHardwareSelection(remoteControlHardwareSelection)).toBe(true)
    expect(remoteControlHardwareSelection.handheldElectronics).toMatchObject({
      mcuModule: { mpn: "MDBT50Q-1MV2", soc: "Nordic Semiconductor nRF52840 revision 2" },
      irEmitter: { mpn: "VSMY14940UL", wavelengthNm: 940, carrierKHz: 38 },
      emitterDriver: { mpn: "PMV16XN" },
      switch: { mpn: "KMR221G LFS" },
      charger: { mpn: "MCP73831T-2ACI/OT", chargeCurrentMa: 250 },
      regulator: { mpn: "TPS62743YFPR", outputV: 3.3 },
      remoteUsbCSink: { receptacle: { mpn: "USB4105-GF-A" } },
      cellProtection: { protector: { mpn: "BQ29700DSER" }, backToBackFets: { mpn: "CSD85301Q2" } }
    })
    expect(remoteControlHardwareSelection.handheldElectronics.mcuModule).toMatchObject({
      antennaAndRf: { topology: expect.stringContaining("integrated chip antenna") },
      clocks: { lowFrequency: expect.stringContaining("internal 32.768 kHz RC oscillator") },
      power: {
        mode: "LDO mode",
        hostDecoupling: expect.arrayContaining([expect.objectContaining({ value: "4.7 uF, 10 V, X5R" })])
      },
      resetAndDebug: { resetPullup: { mpn: "RC0603FR-0710KL" }, swdioSeries: { mpn: "RC0603FR-0722RL" } }
    })
    expect(remoteControlHardwareSelection.handheldElectronics.debugAndTest.debugCableMpn).toBe("TC2050-IDC-NL-050-ALL")
    expect(remoteControlHardwareSelection.handheldElectronics.debugAndTest.targetInterface).toMatchObject({
      populatedHeader: false,
      manufacturerFootprintId: "TC2050-IDC-NL-FP",
      conductivePads: { count: 10, diameterMm: 0.787, solderPaste: false },
      nonPlatedAlignmentHoles: { count: 3, diameterMm: 0.991 },
      contactPadSignalClearanceMinimumMm: 0.508
    })
    expect(remoteControlHardwareSelection.handheldElectronics.debugAndTest.retention.mpn).toBe("TC2050-CLIP-3PACK")
    expect(remoteControlHardwareSelection.architecture.apparatus).toContain("BP-126 and BP-146")
    expect(remoteControlHardwareSelection.architecture.apparatusPowerInput).toContain("USB-C PD")
    expect(Object.isFrozen(remoteControlHardwareSelection)).toBe(true)
    expect(Object.isFrozen(remoteControlHardwareSelection.handheldElectronics)).toBe(true)
  })

  it("sets a complete 32-key matrix and numeric calculated targets", () => {
    const { buttonMatrix } = remoteControlHardwareSelection.handheldElectronics
    expect(buttonMatrix.rows).toHaveLength(4)
    expect(buttonMatrix.columns).toHaveLength(8)
    expect(buttonMatrix.rows.length * buttonMatrix.columns.length).toBe(buttonMatrix.keys)
    expect(remoteControlHardwareSelection.calculatedTargets).toMatchObject({
      operatingRange: { frontalM: 20, evidence: "not measured" },
      batteryLife: {
        targetHours: 300,
        manufacturerMinimumCapacityMah: 3250,
        availableCapacityMah: 2600,
        maximumAverageCurrentMa: 8.667
      },
      latency: { endToEndMsMaximum: 70 },
      resetAndFault: { invalidOrFloodedInputAcceptedCommands: 0, recoveryAfterQuietIntervalMsMaximum: 1000 },
      service: { chargeCurrentMa: 250, debugSupplyVoltageV: 3.3 }
    })
  })

  it("freezes exact support identities and fail-closed topologies", () => {
    const electronics = remoteControlHardwareSelection.handheldElectronics
    expect(electronics.emitterDriver.supportNetwork).toEqual([
      expect.objectContaining({ reference: "R_IR_GATE", mpn: "RC0603FR-07100RL" }),
      expect.objectContaining({ reference: "R_IR_GATE_PD", mpn: "RC0603FR-07100KL" }),
      expect.objectContaining({ reference: "R_IR_LED", mpn: "RC1206FR-0727RL" })
    ])
    expect(electronics.buttonMatrix.antiGhostDiode).toMatchObject({
      quantity: 32,
      mpn: "1N4148W-E3-08",
      topology: expect.stringContaining("one diode per key")
    })
    expect(electronics.remoteUsbCSink).toMatchObject({
      receptacle: { mpn: "USB4105-GF-A" },
      ccPulldowns: { quantity: 2, mpn: "RC0603FR-075K1L", value: "5.1 kohm, 1%" },
      inputProtection: {
        mpn: "BQ24314DSGR",
        connectorEsd: {
          vbus: { mpn: "TPD1E10B06DPYR", workingVoltageV: 5.5 },
          cc: { mpn: "TPD4S012DRYR", protectedChannels: 2 }
        },
        currentLimit: { resistor: { mpn: "RC0603FR-0750KL", valueOhm: 50000 }, nominalLimitMa: 500 },
        batterySenseResistor: { mpn: "RC0603FR-07100KL", valueOhm: 100000 },
        faultOutput: { pullup: { mpn: "RC0603FR-0710KL" } }
      }
    })
    expect(electronics.chargeTemperatureInhibit).toMatchObject({
      sensor: { mpn: "TMP390A2DRLR" },
      thresholds: {
        hot: { nominalTripC: 42, setResistor: { mpn: "RC0603FR-072K49L", valueOhm: 2490 } },
        cold: { nominalTripC: 15, hysteresisC: 5, setResistor: { mpn: "RC0603FR-0714KL", valueOhm: 14000 } }
      },
      usbPoweredRail: { regulator: { mpn: "TPS70933DBVR", inputMaximumV: 30 } },
      support: {
        bypass: { quantity: 2, mpn: "GRM188R71A104KA01D" },
        validWindowNand: { mpn: "SN74LVC1G38DCKR", output: "open drain" },
        chargeEnableBias: {
          upper: { mpn: "RC0603FR-0710KL", valueOhm: 10000 },
          lower: { mpn: "RC0603FR-0710KL", valueOhm: 10000 },
          normalUsbCalculation: expect.stringContaining("2.375 V to 2.625 V")
        },
        chargeEnableClamp: { mpn: "BZT52-C3V3", nominalVoltageV: 3.3 }
      },
      failClosedTopology: expect.stringContaining("hold CE high")
    })
    expect(electronics.charger).toMatchObject({
      progResistor: { mpn: "RC0603FR-074KL", valueOhm: 4000, tolerancePercent: 1 },
      inputCapacitor: { mpn: "GRM188R61C475KE11D", valueUf: 4.7 },
      outputCapacitor: { mpn: "GRM188R61C475KE11D", valueUf: 4.7 },
      thermalAssumptions: { allowedCellTemperatureC: { minimum: 10, maximum: 45 }, sot23ThetaJaCPerW: 230 }
    })
    expect(electronics.regulator).toMatchObject({
      inductor: { mpn: "LQH2MCN2R2M52L", valueUh: 2.2 },
      inputCapacitor: { mpn: "GRM188R61A106KE69D", valueUf: 10 },
      outputCapacitor: { mpn: "GRM188R61A106KE69D", valueUf: 10 }
    })
    expect(electronics.cellProtection.topology).toContain("back-to-back FETs")
  })

  it("keeps all unmeasured physical and industrial evidence denied", () => {
    expect(remoteControlHardwareSelection.releaseState).toBe("deny")
    expect(remoteControlHardwareSelection.physicalEvidence).toMatchObject({
      range20mMeasured: false,
      moduleRfLayoutApproved: false,
      moduleClockAndPowerMeasured: false,
      temperatureInhibitMeasured: false,
      usbInputProtectionMeasured: false,
      batteryProfileMeasured: false,
      latencyMeasured: false,
      resetAndFloodMeasured: false,
      buttonErgonomicsApproved: false,
      enclosureFitApproved: false,
      industrialDesignApproved: false,
      footprintReleased: false,
      fabricationAuthorized: false
    })
    expect(remoteControlHardwareSelection.requiredEvidenceBeforeRelease).toHaveLength(5)
  })

  it("rejects substitution, target relaxation, and release escalation", () => {
    for (const mutate of [
      (candidate: { handheldElectronics: { mcuModule: { mpn: string } } }) =>
        (candidate.handheldElectronics.mcuModule.mpn = "other"),
      (candidate: { calculatedTargets: { operatingRange: { frontalM: number } } }) =>
        (candidate.calculatedTargets.operatingRange.frontalM = 19),
      (candidate: { physicalEvidence: { range20mMeasured: boolean } }) =>
        (candidate.physicalEvidence.range20mMeasured = true),
      (candidate: { architecture: { apparatusPowerInput: string } }) =>
        (candidate.architecture.apparatusPowerInput = "USB-C removed"),
      (candidate: { handheldElectronics: { emitterDriver: { supportNetwork: readonly { mpn: string }[] } } }) =>
        (candidate.handheldElectronics.emitterDriver.supportNetwork[2]!.mpn = "substitute"),
      (candidate: { handheldElectronics: { buttonMatrix: { antiGhostDiode: { quantity: number } } } }) =>
        (candidate.handheldElectronics.buttonMatrix.antiGhostDiode.quantity = 31),
      (candidate: { handheldElectronics: { charger: { progResistor: { valueOhm: number } } } }) =>
        (candidate.handheldElectronics.charger.progResistor.valueOhm = 5000),
      (candidate: { handheldElectronics: { remoteUsbCSink: { ccPulldowns: { quantity: number } } } }) =>
        (candidate.handheldElectronics.remoteUsbCSink.ccPulldowns.quantity = 1),
      (candidate: {
        handheldElectronics: { chargeTemperatureInhibit: { thresholds: { hot: { nominalTripC: number } } } }
      }) => (candidate.handheldElectronics.chargeTemperatureInhibit.thresholds.hot.nominalTripC = 50),
      (candidate: { handheldElectronics: { remoteUsbCSink: { inputProtection: { mpn: string } } } }) =>
        (candidate.handheldElectronics.remoteUsbCSink.inputProtection.mpn = "unprotected"),
      (candidate: {
        handheldElectronics: { chargeTemperatureInhibit: { usbPoweredRail: { regulator: { mpn: string } } } }
      }) => (candidate.handheldElectronics.chargeTemperatureInhibit.usbPoweredRail.regulator.mpn = "battery-powered"),
      (candidate: { handheldElectronics: { debugAndTest: { targetInterface: { populatedHeader: boolean } } } }) =>
        (candidate.handheldElectronics.debugAndTest.targetInterface.populatedHeader = true),
      (candidate: { sources: readonly string[] }) => Object.assign(candidate, { sources: [] })
    ]) {
      const candidate = structuredClone(remoteControlHardwareSelection)
      mutate(candidate)
      expect(() => validateRemoteControlHardwareSelection(candidate)).toThrow(RangeError)
    }
  })
})
