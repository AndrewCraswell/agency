import { describe, expect, it } from "vitest"
import {
  communicationsPowerBoundary,
  controlHarnessSpecification,
  controlHarnessPins,
  interboardArchitectureVerdict,
  interboardContract,
  interboardConnectors,
  interboardReleaseGates,
  powerHarnessPins,
  powerHarnessSpecification,
  serviceAndSequencingContract,
  shieldAndGroundContract,
  usb2HarnessSpecification,
  validateInterboardContract
} from "./interboard-interface.js"

describe("inter-board interface contract", () => {
  it("selects exact power, USB 2.0, and control interconnect parts", () => {
    expect(() => validateInterboardContract(interboardContract)).not.toThrow()
    expect(interboardConnectors.map((connector) => connector.function)).toEqual(["power", "usb2", "control"])
    expect(interboardConnectors[1].exactOrderableParts).toEqual([
      "Samtec ECDP-08-07.87-L1-L2-1-3",
      "Samtec HSEC8-113-01-L-DV-A-L2 (quantity 2)"
    ])
  })

  it("records the Samtec length field in inches and the actual metric envelope", () => {
    expect(usb2HarnessSpecification.nominalWireLengthIn).toBe(7.87)
    expect(usb2HarnessSpecification.nominalWireLengthMm).toBeCloseTo(199.9, 1)
    expect(usb2HarnessSpecification.nominalOverallLengthMm).toBeCloseTo(217.4, 1)
    expect(usb2HarnessSpecification.differentialImpedanceOhm).toBe(100)
    expect(usb2HarnessSpecification.usbHighSpeedMbps).toBe(480)
    expect(usb2HarnessSpecification.signalGroundConductor).toBe("none")
    expect(usb2HarnessSpecification.differentialPairAssignment).toContain("USB_DN")
    expect(usb2HarnessSpecification.differentialPairAssignment).toContain("USB_DP")
    expect(usb2HarnessSpecification.shieldAssignment).toContain("CHASSIS only")
  })

  it("defines complete unique pins, parallel power contacts, and return allocation", () => {
    expect(powerHarnessPins.map((pin) => pin.contact)).toEqual([1, 2, 3, 4])
    expect(controlHarnessPins.map((pin) => pin.contact)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(powerHarnessPins.filter((pin) => pin.assignment === "V20_EFUSE_OUT")).toHaveLength(2)
    expect(powerHarnessPins.filter((pin) => pin.assignment === "GND")).toHaveLength(2)
    expect(controlHarnessPins.filter((pin) => pin.assignment === "GND")).toHaveLength(5)
    expect(powerHarnessSpecification.wireGaugeAwg).toBe(20)
    expect(powerHarnessSpecification.maximumPlannedCurrentPerContactA).toBe(1.5)
    expect(controlHarnessSpecification).toMatchObject({
      maximumLengthMm: 150,
      maximumSpiClockMHz: 10,
      sourceSeriesOhm: 33,
      wireGaugeAwg: 24
    })
  })

  it("uses an electrical presence loop only as sequencing status", () => {
    expect(controlHarnessPins.find((pin) => pin.assignment === "COMM_PRESENT_N")?.rule).toContain("1 kOhm")
    expect(serviceAndSequencingContract.commPresentAuthority).toBe("status-only")
    expect(serviceAndSequencingContract.presenceMechanism).toContain("does not detect latch")
  })

  it("combines local rail supervision with reset and power-off-safe signal gates", () => {
    expect(communicationsPowerBoundary.resetCombiner.supervisorMpn).toBe("TPS389033DSER")
    expect(communicationsPowerBoundary.resetCombiner.externalRequest).toContain("BSS138AKA")
    expect(communicationsPowerBoundary.moduleInputGates).toMatchObject([
      { ioOffProtection: true, mpn: "SN74LVC2G126DCUR", signals: ["W5500_SCK", "W5500_MOSI"] },
      { ioOffProtection: true, mpn: "SN74LVC1G126DCKR", signals: ["W5500_CS_N"] }
    ])
    expect(communicationsPowerBoundary.moduleOutputGate).toMatchObject({
      ioOffProtection: true,
      mpn: "SN74LVC2G126DCUR"
    })
    expect(controlHarnessPins.find((pin) => pin.contact === 10)?.assignment).toBe("COMM_RESET_ASSERT")
    expect(communicationsPowerBoundary.moduleIoEnable.rampDefault).toContain("100 kOhm")
    expect(communicationsPowerBoundary.moduleInputStates.W5500_MISO).toContain("prevents")
    expect(communicationsPowerBoundary.moduleInputStates.W5500_INT_N).toContain("push-pull")
    expect(communicationsPowerBoundary.carrierDefaults.INT_N).toContain("disconnected state only")
  })

  it("separates chassis shield from application ground and prohibits internal hot-plug", () => {
    expect(shieldAndGroundContract.applicationGroundBond).toContain("must not connect")
    expect(shieldAndGroundContract.applicationTermination).toContain("not APP_GND")
    expect(serviceAndSequencingContract.energizedInternalMating).toBe("prohibited")
    expect(serviceAndSequencingContract.externalHotPlugBoundary).toContain("external USB-C")
    expect(interboardReleaseGates.join(" ")).toContain("de-energized internal service")
  })

  it("keeps the integrated isolated module fail-closed for fabrication", () => {
    expect(interboardArchitectureVerdict.canonicalCircuitStatus).toBe("carrier-boundary-integrated")
    expect(interboardArchitectureVerdict.integrationStatus).toBe("integrated")
    expect(interboardArchitectureVerdict.releaseState).toBe("deny")
    expect(interboardArchitectureVerdict.proposedPlacement).toContain("COMM_3V3")
    expect(interboardReleaseGates.join(" ")).toContain("MDI must not traverse")
  })

  it("fails closed for malformed and forged runtime contracts", () => {
    for (const malformed of [null, undefined, 4, "contract", [], {}]) {
      expect(() => validateInterboardContract(malformed)).toThrow(RangeError)
    }

    const forgedCases: readonly unknown[] = [
      { ...interboardContract, connectors: interboardContract.connectors.slice(0, 2) },
      {
        ...interboardContract,
        connectors: interboardContract.connectors.map((connector, index) =>
          index === 1 ? { ...connector, exactOrderableParts: ["Samtec WRONG"] } : connector
        )
      },
      {
        ...interboardContract,
        controlPins: interboardContract.controlPins.map((pin) =>
          pin.contact === 10 ? { ...pin, assignment: "W5500_RST_N" } : pin
        )
      },
      {
        ...interboardContract,
        controlPins: interboardContract.controlPins.map((pin) =>
          pin.contact === 6 ? { ...pin, direction: "application-to-communications" } : pin
        )
      },
      {
        ...interboardContract,
        powerSpecification: { ...interboardContract.powerSpecification, wireGaugeAwg: 24 }
      },
      {
        ...interboardContract,
        powerSpecification: { ...interboardContract.powerSpecification, maximumRoundTripDropMvAt3A: 200 }
      },
      {
        ...interboardContract,
        controlSpecification: { ...interboardContract.controlSpecification, maximumSpiClockMHz: 30 }
      },
      {
        ...interboardContract,
        usb2Specification: { ...interboardContract.usb2Specification, differentialImpedanceOhm: 90 }
      },
      {
        ...interboardContract,
        usb2Specification: { ...interboardContract.usb2Specification, nominalWireLengthIn: 21.5 }
      },
      {
        ...interboardContract,
        architecture: { ...interboardContract.architecture, releaseState: "allow" }
      },
      {
        ...interboardContract,
        communicationsPowerBoundary: {
          ...interboardContract.communicationsPowerBoundary,
          moduleInputGates: interboardContract.communicationsPowerBoundary.moduleInputGates.map((gate, index) =>
            index === 0 ? { ...gate, ioOffProtection: false } : gate
          )
        }
      },
      {
        ...interboardContract,
        communicationsPowerBoundary: {
          ...interboardContract.communicationsPowerBoundary,
          moduleInputStates: {
            ...interboardContract.communicationsPowerBoundary.moduleInputStates,
            W5500_MISO: "floating"
          }
        }
      },
      {
        ...interboardContract,
        communicationsPowerBoundary: {
          ...interboardContract.communicationsPowerBoundary,
          moduleIoEnable: {
            ...interboardContract.communicationsPowerBoundary.moduleIoEnable,
            rampDefault: "undefined"
          }
        }
      }
    ]
    for (const forged of forgedCases) expect(() => validateInterboardContract(forged)).toThrow(RangeError)
  })
})
