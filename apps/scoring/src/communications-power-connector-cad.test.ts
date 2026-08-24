import { describe, expect, it } from "vitest"
import {
  communicationsPowerConnectorCad,
  evaluateCommunicationsPowerConnectorCad
} from "./communications-power-connector-cad.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M4-11 communications and power connector CAD verification", () => {
  it("keeps USB-C PD as the sole normal apparatus-power input", () => {
    const result = evaluateCommunicationsPowerConnectorCad()

    expect(communicationsPowerConnectorCad.normalApparatusPowerInput).toBe("USB-C PD")
    expect(communicationsPowerConnectorCad.lockedPowerPolicy).toContain("internal locking harness")
    expect(communicationsPowerConnectorCad.lockedPowerPolicy).toContain("not an external apparatus inlet")
    expect(communicationsPowerConnectorCad.connectors.lockingPower).toMatchObject({
      mpn: "43045-0400",
      reference: "J_PWR_CARRIER"
    })
    expect(result).toMatchObject({ fabricationApproved: false, status: "deny" })
  })

  it("reconciles the selected RJ45 and USB-C parts to their primary drawing records", () => {
    expect(communicationsPowerConnectorCad.connectors.rj45).toMatchObject({
      mpn: "7499011121A",
      reference: "J_ETHERNET_MAGJACK",
      primaryDrawing: { state: "unverified" }
    })
    expect(communicationsPowerConnectorCad.connectors.usbC).toMatchObject({
      mpn: "10177070-00011LF",
      reference: "J_USB_C",
      primaryDrawing: { state: "unknown" }
    })
    expect(communicationsPowerConnectorCad.connectors.usbC.primaryDrawing.note).toContain("HTTP 403")
    expect(communicationsPowerConnectorCad.connectors.rj45.evidence.shieldTabs).toBe("unverified")
    expect(communicationsPowerConnectorCad.connectors.usbC.evidence.shieldTabs).toBe("unknown")
  })

  it("fails closed for unknown and unverified footprint, overlay, service, and strain evidence", () => {
    const result = evaluateCommunicationsPowerConnectorCad()

    expect(result.failedChecks).toEqual(
      expect.arrayContaining([
        "rj45-landPattern",
        "rj45-cadOverlay",
        "usbC-landPattern",
        "usbC-cadOverlay",
        "lockingPower-landPattern",
        "lockingPower-cadOverlay",
        "rj45-serviceAccess",
        "usbC-strainRelief",
        "lockingPower-strainRelief"
      ])
    )
    expect(Object.isFrozen(communicationsPowerConnectorCad)).toBe(true)
    expect(Object.isFrozen(communicationsPowerConnectorCad.connectors.usbC.evidence)).toBe(true)
  })

  it("rejects an approval claim, a substitute normal input, and an accessor", () => {
    const approvedLandPattern = structuredClone(communicationsPowerConnectorCad)
    replaceDataProperty(approvedLandPattern.connectors.usbC.evidence, "landPattern", "verified")
    expect(() => evaluateCommunicationsPowerConnectorCad(approvedLandPattern)).toThrow(RangeError)

    const alternateInput = structuredClone(communicationsPowerConnectorCad)
    replaceDataProperty(alternateInput, "normalApparatusPowerInput", "locking power")
    expect(() => evaluateCommunicationsPowerConnectorCad(alternateInput)).toThrow(RangeError)

    const accessor = structuredClone(communicationsPowerConnectorCad)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "pass" })
    expect(() => evaluateCommunicationsPowerConnectorCad(accessor)).toThrow(RangeError)
  })
})
