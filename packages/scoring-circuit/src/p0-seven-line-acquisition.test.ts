import { describe, expect, it } from "vitest"
import { p0SevenLineAcquisition, validateP0SevenLineAcquisition } from "./p0-seven-line-acquisition.js"

describe("P0 phased seven-conductor acquisition", () => {
  it("corrects seven ADC cells to seven driven and five sensed conductors", () => {
    expect(p0SevenLineAcquisition.conductors.map(({ line }) => line)).toEqual([
      "LEFT_WEAPON_A",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_A",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE"
    ])
    expect(p0SevenLineAcquisition.sensedConductors).toEqual([
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE"
    ])
    expect(p0SevenLineAcquisition.conductors.filter(({ senseBuffer }) => senseBuffer !== null)).toHaveLength(5)
    expect(p0SevenLineAcquisition.priorArtCorrection.notAdopted).toContain("raw internal-ADC thresholds")
  })

  it("uses one protected phased measurement chain", () => {
    expect(p0SevenLineAcquisition.quantities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mpn: "TMUX1208PWR", quantity: 3 }),
        expect.objectContaining({ mpn: "ADA4177-1ARZ", quantity: 5 }),
        expect.objectContaining({ mpn: "ADS8881IDGS", quantity: 1 }),
        expect.objectContaining({ mpn: "REF5025AQDRQ1", quantity: 1 })
      ])
    )
    expect(p0SevenLineAcquisition.phaseHardware.control).toMatchObject({
      registers: ["U_PHASE_CONTROL_1", "U_PHASE_CONTROL_2"],
      latch: "SOURCE_LATCH on GPIO47",
      outputEnable: expect.stringContaining("GPIO36")
    })
    expect(p0SevenLineAcquisition.timing.maximumPhaseUs).toBeLessThan(5)
  })

  it("keeps unmeasured and conformance authority closed", () => {
    expect(p0SevenLineAcquisition.dependencies).toEqual({
      stm32: false,
      isolationHardware: false,
      esp32InternalAdc: false
    })
    expect(p0SevenLineAcquisition.authority).toEqual({
      schematicIntegrated: false,
      calibratedResistanceProven: false,
      overloadRecoveryProven: false,
      fieConformanceProven: false,
      fabricationAuthorized: false
    })
  })

  it("rejects drift", () => {
    expect(validateP0SevenLineAcquisition(p0SevenLineAcquisition)).toBe(true)
    const changed = structuredClone(p0SevenLineAcquisition)
    changed.conductors[0]!.line = "PISTE"
    expect(() => validateP0SevenLineAcquisition(changed)).toThrow(RangeError)
  })
})
