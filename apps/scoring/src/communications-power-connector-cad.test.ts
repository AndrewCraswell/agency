import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  communicationsPowerConnectorCad,
  evaluateCommunicationsPowerConnectorCad
} from "./communications-power-connector-cad.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

function sourceText(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
}

describe("M4-11 communications and power connector CAD verification", () => {
  it("keeps USB-C PD as the sole normal apparatus-power input", () => {
    const result = evaluateCommunicationsPowerConnectorCad()

    expect(communicationsPowerConnectorCad.normalApparatusPowerInput).toBe("USB-C PD")
    expect(communicationsPowerConnectorCad.lockedPowerPolicy).toContain("internal locking harness")
    expect(communicationsPowerConnectorCad.lockedPowerPolicy).toContain("not an external apparatus inlet")
    expect(communicationsPowerConnectorCad.connectors.lockingPower).toMatchObject({
      mate: { mpn: "43025-0400", terminalMpn: "43030-0007" },
      mpn: "43045-0400",
      reference: "J_PWR_CARRIER"
    })
    expect(result).toMatchObject({ fabricationApproved: false, status: "deny" })
  })

  it("checks the acquired manufacturer files against their immutable primary-source identity", () => {
    const rj45 = communicationsPowerConnectorCad.connectors.rj45
    const acquired = rj45.primarySources.filter((source) => source.state === "acquired")

    expect(acquired).toHaveLength(2)
    for (const source of acquired) {
      if (source.artifactPath === null || source.sha256 === null) throw new Error("Acquired source is incomplete")
      const bytes = readFileSync(new URL(`../${source.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
    expect(rj45.primarySources.map((source) => source.kind)).toEqual(["datasheet", "step-model"])
  })

  it("records exact manufacturer-source blockers without inventing USB-C or harness geometry", () => {
    const usbC = communicationsPowerConnectorCad.connectors.usbC
    const lockingPower = communicationsPowerConnectorCad.connectors.lockingPower

    expect(usbC.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "product-drawing", sha256: null, state: "access-blocked" }),
        expect.objectContaining({ kind: "step-model", sha256: null, state: "access-blocked" })
      ])
    )
    expect(lockingPower.primarySources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ revision: expect.stringContaining("43045-0400"), state: "checked-no-local-copy" }),
        expect.objectContaining({ revision: expect.stringContaining("43025-0400"), state: "checked-no-local-copy" }),
        expect.objectContaining({ revision: expect.stringContaining("43030-0007"), state: "checked-no-local-copy" })
      ])
    )
    expect(usbC.evidence.landPattern).toBe("unknown")
    expect(lockingPower.evidence.landPattern).toBe("unverified")
  })

  it("reconciles source constraints to the tscircuit declarations without treating them as physical overlays", () => {
    const physicalBoard = sourceText("../../../packages/scoring-circuit/src/physical-board-contract.ts")
    const communicationsModule = sourceText("../../../packages/scoring-circuit/src/communications-module.circuit.tsx")
    const carrier = sourceText("../../../packages/scoring-circuit/src/application-display-carrier.circuit.tsx")
    const result = evaluateCommunicationsPowerConnectorCad()

    expect(physicalBoard).toContain("widthMm: 110")
    expect(physicalBoard).toContain("heightMm: 55")
    expect(physicalBoard).toContain("finishedThicknessMm: 0.8")
    expect(physicalBoard).toContain("finishedThicknessMm: 1.6")
    expect(communicationsModule).toMatch(
      /name="J_USB_C"[\s\S]*manufacturerPartNumber="10177070-00011LF"[\s\S]*unreleasedFootprintProps\("10177070-00011LF"\)/u
    )
    expect(communicationsModule).toMatch(
      /name="J_ETHERNET_MAGJACK"[\s\S]*manufacturerPartNumber="7499011121A"[\s\S]*footprint=\{\[\]\}/u
    )
    expect(carrier).toMatch(
      /name="J_PWR_CARRIER"[\s\S]*manufacturerPartNumber="Molex 43045-0400"[\s\S]*footprint=\{\[\]\}/u
    )
    expect(result.staticChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "usb-c-stackup-only", result: "compatible-planning-constraint-only" }),
        expect.objectContaining({ id: "locking-power-stackup-only", result: "compatible-planning-constraint-only" }),
        expect.objectContaining({
          id: "rj45-footprint-and-assembly-overlay",
          result: "no-released-geometry-to-overlay"
        })
      ])
    )
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
