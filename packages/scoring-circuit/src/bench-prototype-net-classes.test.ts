import { describe, expect, it } from "vitest"
import { benchPrototypeNetClasses, validateBenchPrototypeNetClasses } from "./bench-prototype-net-classes.js"

describe("BP-040 one-board bench prototype net classes", () => {
  it("freezes the named ground, shield, analog, high-current, and pair classes", () => {
    expect(validateBenchPrototypeNetClasses(benchPrototypeNetClasses)).toBe(true)
    expect(benchPrototypeNetClasses.board).toMatchObject({
      boardCount: 1,
      fabricationRelease: false,
      releaseState: "deny"
    })
    expect(benchPrototypeNetClasses.netClasses.map((netClass) => netClass.id)).toEqual([
      "APP_GND",
      "SCORING_SGND",
      "ESD_RETURN",
      "CHASSIS",
      "ANALOG_QUIET",
      "HIGH_CURRENT",
      "USB2_DIFF",
      "ETHERNET_DIFF"
    ])
    expect(benchPrototypeNetClasses.netNames).toEqual({
      applicationGround: "APP_GND",
      scoringGround: "SCORING_SGND",
      esdReturn: "ESD_RETURN",
      chassis: "CHASSIS",
      analogQuiet: "ANALOG_QUIET",
      highCurrent: "HIGH_CURRENT",
      usb2Differential: "USB2_DIFF",
      ethernetDifferential: "ETHERNET_DIFF"
    })
    expect(Object.isFrozen(benchPrototypeNetClasses)).toBe(true)
    expect(Object.isFrozen(benchPrototypeNetClasses.netClasses)).toBe(true)
    expect(Object.isFrozen(benchPrototypeNetClasses.isolationRules.corridor)).toBe(true)
  })

  it("binds USB and Ethernet pairs to the application reference and chassis-only shields", () => {
    expect(benchPrototypeNetClasses.differentialPairs).toEqual([
      expect.objectContaining({
        id: "USB2_DIFF",
        targetImpedanceOhms: 90,
        tolerancePercent: 10,
        referenceNet: "APP_GND",
        protectionMpn: "TPD2EUSB30DRTR",
        seriesResistanceOhms: 22,
        seriesResistorCount: 2,
        shieldNet: "CHASSIS",
        separateSignalReturn: false
      }),
      expect.objectContaining({
        id: "ETHERNET_DIFF",
        targetImpedanceOhms: 100,
        tolerancePercent: 10,
        referenceNet: "APP_GND",
        shieldNet: "CHASSIS_ETHERNET",
        separateSignalReturn: false
      })
    ])
  })

  it("retains the isolated power and signal crossing set from the BP-010 contract", () => {
    expect(benchPrototypeNetClasses.isolationRules).toMatchObject({
      applicationGround: "APP_GND",
      scoringGround: "SCORING_SGND",
      groundsSeparateOnEveryLayer: true,
      directGroundTiePermitted: false,
      crossingParts: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"]
    })
    expect(benchPrototypeNetClasses.isolationRules.signalCrossings).toHaveLength(2)
    expect(benchPrototypeNetClasses.isolationRules.powerCrossing).toMatchObject({
      part: "NXE1S0505MC",
      direction: "application-to-scoring",
      sourceNet: "V5",
      destinationNet: "SCORING_5V_ISOLATED"
    })
    expect(benchPrototypeNetClasses.isolationRules.signalCrossings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ part: "ISO7762FDWR" }),
        expect.objectContaining({ part: "ISO7721FDR" })
      ])
    )
    expect(benchPrototypeNetClasses.highCurrentRules).toMatchObject({
      normalContract: { voltageV: 20, currentA: 3, sinkOnly: true },
      diagnosticInjection: {
        node: "LAB_POST_EFUSE_20V",
        maximumCurrentA: 2.3,
        normalProductInterface: false
      },
      sourceSelector: {
        mpn: "7101SYZQE",
        changeOnlyDeenergized: true,
        simultaneousSourcesProhibited: true
      }
    })
    expect(benchPrototypeNetClasses.highCurrentRules.returnReferences).toEqual(["APP_GND", "SCORING_SGND"])
    expect(benchPrototypeNetClasses.esdChassisPolicy).toMatchObject({
      chassisParent: "CHASSIS",
      ethernetChassisChild: "CHASSIS_ETHERNET",
      reviewedSinglePointBondOnly: true,
      directEsdReturnToChassisPermitted: false
    })
  })

  it("fails closed on malformed, accessor-bearing, aliased, or release-relaxing graphs", () => {
    for (const candidate of [null, [], {}, { ...benchPrototypeNetClasses, unexpected: true }]) {
      expect(() => validateBenchPrototypeNetClasses(candidate)).toThrow(RangeError)
    }

    const accessor = structuredClone(benchPrototypeNetClasses)
    let getterRead = false
    Object.defineProperty(accessor.board, "releaseState", {
      enumerable: true,
      get: () => {
        getterRead = true
        return "deny"
      }
    })
    expect(() => validateBenchPrototypeNetClasses(accessor)).toThrow(RangeError)
    expect(getterRead).toBe(false)

    const alias = structuredClone(benchPrototypeNetClasses)
    Reflect.set(alias.netClasses, "1", alias.netClasses[0])
    expect(() => validateBenchPrototypeNetClasses(alias)).toThrow(RangeError)

    const cycle = structuredClone(benchPrototypeNetClasses)
    Reflect.set(cycle, "board", cycle)
    expect(() => validateBenchPrototypeNetClasses(cycle)).toThrow(RangeError)

    const weakened = structuredClone(benchPrototypeNetClasses)
    Reflect.set(weakened.isolationRules, "directGroundTiePermitted", true)
    expect(() => validateBenchPrototypeNetClasses(weakened)).toThrow(RangeError)
  })

  it("rejects unsafe high-current values, branch returns, pair endpoints, shields, and directions", () => {
    const mutations = [
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.highCurrentRules.normalContract, "currentA", 5),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.highCurrentRules.diagnosticInjection, "maximumCurrentA", 3),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.highCurrentRules.branchReturns.display, "returnNet", "SCORING_SGND"),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.highCurrentRules.branchReturns.isolatedScoring, "returnNet", "APP_GND"),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.netClasses[0], "routingRule", "APP_GND may tie directly to SCORING_SGND"),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.differentialPairs[0], "endpoints", { source: "wrong", destination: "wrong" }),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.differentialPairs[1], "shieldNet", "CHASSIS"),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.esdChassisPolicy, "directEsdReturnToChassisPermitted", true),
      (candidate: typeof benchPrototypeNetClasses) =>
        Reflect.set(candidate.isolationRules.powerCrossing, "direction", "scoring-to-application")
    ]

    for (const mutate of mutations) {
      const candidate = structuredClone(benchPrototypeNetClasses)
      mutate(candidate)
      expect(() => validateBenchPrototypeNetClasses(candidate)).toThrow(RangeError)
    }
  })

  it("rejects a routing-rule mutation in every frozen net class", () => {
    for (const index of benchPrototypeNetClasses.netClasses.keys()) {
      const candidate = structuredClone(benchPrototypeNetClasses)
      Reflect.set(candidate.netClasses[index], "routingRule", "unsafe unrestricted routing")
      expect(() => validateBenchPrototypeNetClasses(candidate)).toThrow(RangeError)
    }
  })

  it("rejects array holes, symbol keys, and changes to the deny gate", () => {
    const hole = structuredClone(benchPrototypeNetClasses)
    Reflect.deleteProperty(hole.differentialPairs, "1")
    expect(() => validateBenchPrototypeNetClasses(hole)).toThrow(RangeError)

    const symbol = structuredClone(benchPrototypeNetClasses)
    Reflect.set(symbol, Symbol("forged"), true)
    expect(() => validateBenchPrototypeNetClasses(symbol)).toThrow(RangeError)

    const release = structuredClone(benchPrototypeNetClasses)
    Reflect.set(release, "releaseState", "allow")
    expect(() => validateBenchPrototypeNetClasses(release)).toThrow(RangeError)
  })
})
