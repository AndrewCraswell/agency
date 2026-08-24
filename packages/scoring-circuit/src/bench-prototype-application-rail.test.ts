import { describe, expect, it } from "vitest"
import {
  benchPrototypeApplicationRail,
  benchPrototypeApplicationRailUpstreamProvenance,
  validateBenchPrototypeApplicationRail
} from "./bench-prototype-application-rail.js"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { componentDecisions } from "./component-decisions.js"

describe("BP-142 application 3.3 V implementation", () => {
  it("uses the committed BP-050 application branch and the exact LMR43620 support BOM", () => {
    expect(validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)).toBe(true)
    expect(benchPrototypeApplicationRail.input).toMatchObject({
      source: "BP-050 J_LINK_APPLICATION V5 branch with its loopback installed",
      ground: "APP_GND",
      nominalVoltageV: 5,
      calculatorVoltageScreenV: { minimum: 4.75, maximum: 5.25 }
    })
    expect(benchPrototypeApplicationRail.topology.supportParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ references: ["U_APP_REGULATOR"], mpn: "LMR43620MSC3RPERQ1" }),
        expect.objectContaining({ references: ["L_APP_REGULATOR"], mpn: "XGL4030-222MEC" }),
        expect.objectContaining({ references: ["C_APP_REG_IN"], mpn: "C2012X7R1E475K125AB" }),
        expect.objectContaining({
          references: ["C_APP_REG_VCC"],
          mpn: "885012206052",
          value: "1 uF, 16 V, +/-10%, X7R, 0603"
        }),
        expect.objectContaining({ references: ["C_APP_REG_OUT_A", "C_APP_REG_OUT_B", "C_APP_REG_OUT_C"], quantity: 3 }),
        expect.objectContaining({ references: ["R_APP_REG_DISCHARGE"], mpn: "RC0603FR-071KL" }),
        expect.objectContaining({ references: ["R_APP_REG_PGOOD"], mpn: "RC0603FR-0710KL" })
      ])
    )
    expect(benchPrototypeApplicationRailUpstreamProvenance.bp050ApplicationBranch.measurementLink.label).toBe(
      "J_LINK_APPLICATION"
    )
    expect(benchPrototypeApplicationRail.topology.connections).toEqual(
      expect.arrayContaining([
        {
          from: "U_APP_REGULATOR.VOUT/FB",
          to: "V3_3",
          rule: "The fixed-output VOUT/FB pin senses V3_3 directly; no feedback divider is populated."
        },
        {
          from: "C_APP_REG_OUT_A.V3_3",
          to: "V3_3",
          return: "C_APP_REG_OUT_A.GND to APP_GND"
        },
        {
          from: "C_APP_REG_OUT_B.V3_3",
          to: "V3_3",
          return: "C_APP_REG_OUT_B.GND to APP_GND"
        },
        {
          from: "C_APP_REG_OUT_C.V3_3",
          to: "V3_3",
          return: "C_APP_REG_OUT_C.GND to APP_GND"
        }
      ])
    )
  })

  it("keeps startup, transient, current, and thermal calculations conservative", () => {
    const { screens } = benchPrototypeApplicationRail
    expect(screens.startup.regulatorInputStartupMarginV).toBeCloseTo(1.15, 4)
    expect(screens.startup.regulatorSoftStartMaximumMs).toBeCloseTo(4.6, 2)
    expect(screens.startup.outputCapacitorChargingCurrentA).toBeCloseTo(0.029, 3)
    expect(screens.transient).toMatchObject({
      continuousToPeakDurationMs: 100,
      effectiveOutputCapacitanceMinimumUf: 40,
      permittedOutputTransientV: 0.05
    })
    expect(screens.transient.capacitorOnlyHoldUpUs).toBeGreaterThan(10)
    expect(screens.transient.capacitorOnlyHoldUpUs).toBeLessThan(20)
    expect(screens.current.bp050ContinuousBranchHeadroomA).toBeGreaterThan(0)
    expect(screens.current.bp050PeakBranchHeadroomA).toBeGreaterThan(0)
    expect(screens.current.regulatorPeakCurrentLimitMarginA).toBeGreaterThan(1.7)
    expect(screens.current.inductorPeakCurrentWithMarginA).toBeLessThan(screens.current.inductor20PercentSaturationA)
    expect(screens.thermal.peakJunctionScreenC).toBeLessThan(screens.thermal.junctionTargetC)
  })

  it("does not turn a calculation pass into schematic, footprint, layout, measurement, or fabrication approval", () => {
    expect(benchPrototypeApplicationRail).toMatchObject({
      prototypeOnly: true,
      integrationRelease: false,
      fabricationRelease: false,
      releaseState: "deny",
      deniedEvidence: {
        exactFootprintsApproved: false,
        layoutApproved: false,
        effectiveCapacitanceMeasured: false,
        startupAndBrownoutMeasured: false,
        loadStepMeasured: false,
        thermalMeasured: false,
        fabricationApproved: false
      }
    })
    expect(benchPrototypeApplicationRail.openGates).toHaveLength(6)
    expect(benchPrototypeApplicationRail.screens.startup.resetDependency).toContain("BP-123")
    expect(benchPrototypeApplicationRail.screens.transient.conclusion).toContain("DENY")
    expect(benchPrototypeApplicationRail.screens.thermal.conclusion).toContain("DENY")
  })

  it("is immutable and fails closed for forged contracts or source-record drift", () => {
    expect(Object.isFrozen(benchPrototypeApplicationRail)).toBe(true)
    expect(Object.isFrozen(benchPrototypeApplicationRail.topology.supportParts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeApplicationRailUpstreamProvenance)).toBe(true)
    expect(Object.isFrozen(benchPrototypeApplicationRailUpstreamProvenance.sourceIdentity)).toBe(true)

    const forged = structuredClone(benchPrototypeApplicationRail)
    Reflect.set(forged.deniedEvidence, "fabricationApproved", true)
    expect(() => validateBenchPrototypeApplicationRail(forged)).toThrow(RangeError)

    const originalCurrent = defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.expectedPeakA
    try {
      Reflect.set(defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping, "expectedPeakA", 0.1)
      expect(() => validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)).toThrow(RangeError)
    } finally {
      Reflect.set(
        defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping,
        "expectedPeakA",
        originalCurrent
      )
    }

    const regulator = componentDecisions.find((candidate) => candidate.mpn === "LMR43620MSC3RPERQ1")
    expect(regulator).toBeDefined()
    const originalManufacturer = regulator!.manufacturer
    try {
      Reflect.set(regulator!, "manufacturer", "FORGED")
      expect(() => validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)).toThrow(RangeError)
    } finally {
      Reflect.set(regulator!, "manufacturer", originalManufacturer)
    }

    const originalQualification = regulator!.qualification
    try {
      Reflect.set(regulator!, "qualification", "FORGED QUALIFICATION")
      expect(() => validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)).toThrow(RangeError)
    } finally {
      Reflect.set(regulator!, "qualification", originalQualification)
    }
    expect(validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)).toBe(true)
  })
})
