import { describe, expect, it } from "vitest"
import { weaponInputTopology } from "./weapon-input-topology.js"

const expectedEsd = {
  name: "U_ESD_L",
  manufacturerPartNumber: "TPD4E05U06DQAR",
  pinLabels: { pin1: "CH_A", pin2: "CH_B", pin3: "CH_C", pin4: "SPARE", pin5: "ESD_RETURN" }
} as const

const expectedFrontend = {
  name: "U_FRONTEND_L",
  manufacturerPartNumber: "ANALOG-FRONT-END-TBD",
  pinLabels: {
    pin1: "RAW_A",
    pin2: "RAW_B",
    pin3: "RAW_C",
    pin4: "SGND",
    pin5: "S3_3",
    pin6: "SENSE_A",
    pin7: "SENSE_B",
    pin8: "SENSE_C"
  }
} as const

describe("weapon-input topology helper", () => {
  it.each([
    ["logical connector labels", "J_L", { a: "A", b: "B", c: "C" }],
    ["physical harness labels", "J_WEAPON_HARNESS_R", { a: "WEAPON_A", b: "WEAPON_B", c: "WEAPON_C" }]
  ] as const)("keeps the exact shared graph for %s", (_label, connectorReference, connectorEndpointLabels) => {
    const side = connectorReference.endsWith("_L") ? "L" : "R"
    const expectedSideEsd = { ...expectedEsd, name: `U_ESD_${side}` }
    const expectedSideFrontend = { ...expectedFrontend, name: `U_FRONTEND_${side}` }
    const topology = weaponInputTopology({ connectorReference, connectorEndpointLabels })

    expect(topology.esd).toEqual(expectedSideEsd)
    expect(topology.frontend).toEqual(expectedSideFrontend)
    expect(topology.traces).toEqual([
      { from: `${connectorReference}.${connectorEndpointLabels.a}`, to: `U_ESD_${side}.CH_A` },
      { from: `${connectorReference}.${connectorEndpointLabels.b}`, to: `U_ESD_${side}.CH_B` },
      { from: `${connectorReference}.${connectorEndpointLabels.c}`, to: `U_ESD_${side}.CH_C` },
      { from: `U_ESD_${side}.CH_A`, to: `U_FRONTEND_${side}.RAW_A` },
      { from: `U_ESD_${side}.CH_B`, to: `U_FRONTEND_${side}.RAW_B` },
      { from: `U_ESD_${side}.CH_C`, to: `U_FRONTEND_${side}.RAW_C` },
      { from: `U_ESD_${side}.ESD_RETURN`, to: "net.ESD_RETURN" },
      { from: `U_FRONTEND_${side}.SGND`, to: "net.SGND" },
      { from: `U_FRONTEND_${side}.S3_3`, to: "net.S3_3" }
    ])
  })

  it("rejects connector references without a left or right suffix", () => {
    expect(() =>
      weaponInputTopology({
        connectorReference: "J_WEAPON_HARNESS_CENTER",
        connectorEndpointLabels: { a: "WEAPON_A", b: "WEAPON_B", c: "WEAPON_C" }
      })
    ).toThrowError("Weapon connector reference must end in _L or _R")
  })
})
