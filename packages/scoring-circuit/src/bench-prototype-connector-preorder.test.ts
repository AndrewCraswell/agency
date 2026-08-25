import { describe, expect, it } from "vitest"
import {
  benchPrototypeConnectorPreorder,
  benchPrototypeWeaponPanelHarness,
  validateBenchPrototypeConnectorPreorder,
  validateBenchPrototypeWeaponPanelHarness
} from "./bench-prototype-connector-preorder.js"

describe("BP-034 minimal connector preorder", () => {
  it("retains only USB-C, weapon sockets, Ethernet, and HUB75 interfaces", () => {
    expect(validateBenchPrototypeConnectorPreorder(benchPrototypeConnectorPreorder)).toBe(true)
    expect(benchPrototypeConnectorPreorder.samples.map((sample) => sample.id)).toEqual([
      "usb-c-input",
      "weapon-sockets",
      "ethernet-magjack",
      "hub75-signal",
      "hub75-panel-power"
    ])
    expect(benchPrototypeConnectorPreorder.removedInterfaces).toEqual(["J_LAB_INJECTION", "J_STM_SWD", "J_ESP_SERVICE"])
  })

  it("keeps the owner-approved cable separate from the unresolved socket assembly", () => {
    expect(validateBenchPrototypeWeaponPanelHarness(benchPrototypeWeaponPanelHarness)).toBe(true)
    expect(benchPrototypeWeaponPanelHarness.cableCompatibility).toMatchObject({
      supplier: "OK Fencing",
      status: "owner-validated-not-a-blocker"
    })
    expect(benchPrototypeConnectorPreorder.samples[1].selectionState).toBe("blocked")
  })

  it("rejects non-canonical objects", () => {
    expect(() => validateBenchPrototypeConnectorPreorder(structuredClone(benchPrototypeConnectorPreorder))).toThrow()
    expect(() => validateBenchPrototypeWeaponPanelHarness(structuredClone(benchPrototypeWeaponPanelHarness))).toThrow()
  })
})
