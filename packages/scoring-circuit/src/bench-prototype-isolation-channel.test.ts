import { describe, expect, it } from "vitest"
import {
  benchPrototypeIsolationChannel,
  validateBenchPrototypeIsolationChannel
} from "./bench-prototype-isolation-channel.js"

describe("BP-122 pin-level isolation channel contract", () => {
  it("freezes the exact ISO7762 and ISO7721 pin map with denied release gates", () => {
    expect(validateBenchPrototypeIsolationChannel(benchPrototypeIsolationChannel)).toBe(true)
    expect(benchPrototypeIsolationChannel.releaseGates).toEqual({
      schematic: "deny",
      footprint: "deny",
      bench: "deny",
      fabrication: "deny"
    })
    expect(benchPrototypeIsolationChannel.isolators.main.channels).toEqual([
      expect.objectContaining({
        channel: 1,
        direction: "scoring-to-application",
        signal: "SCORE_SCK",
        scoring: expect.objectContaining({ pin: 2, net: "SCORE_SCK" }),
        application: expect.objectContaining({ pin: 15, net: "SCORE_SCK" })
      }),
      expect.objectContaining({
        channel: 2,
        signal: "SCORE_MOSI",
        scoring: { pin: 3, net: "SCORE_MOSI", endpoint: expect.any(String) },
        application: { pin: 14, net: "SCORE_MOSI", endpoint: expect.any(String) }
      }),
      expect.objectContaining({
        channel: 3,
        signal: "SCORE_CS_N",
        scoring: { pin: 4, net: "SCORE_CS_N", endpoint: expect.any(String) },
        application: { pin: 13, net: "SCORE_CS_N", endpoint: expect.any(String) }
      }),
      expect.objectContaining({
        channel: 4,
        signal: "RESET_REQUEST",
        scoring: { pin: 5, net: "ESP32_RESET_ASSERT", endpoint: expect.any(String) },
        application: { pin: 12, net: "RESET_REQUEST", endpoint: expect.any(String) }
      }),
      expect.objectContaining({
        channel: 5,
        signal: "SCORE_MISO",
        scoring: { pin: 6, net: "SCORE_MISO", endpoint: expect.any(String) },
        application: { pin: 11, net: "SCORE_MISO", endpoint: expect.any(String) }
      }),
      expect.objectContaining({
        channel: 6,
        signal: "ESP32_HEARTBEAT",
        scoring: { pin: 7, net: "ESP32_HEARTBEAT", endpoint: expect.any(String) },
        application: { pin: 10, net: "ESP32_HEARTBEAT", endpoint: expect.any(String) }
      })
    ])
    expect(benchPrototypeIsolationChannel.isolators.auxiliary.channels).toEqual([
      expect.objectContaining({
        channel: 1,
        direction: "scoring-to-application",
        signal: "STM32_HEARTBEAT",
        scoring: { pin: 3, net: "STM32_HEARTBEAT", endpoint: expect.any(String) },
        application: { pin: 6, net: "STM32_HEARTBEAT", endpoint: expect.any(String) }
      }),
      expect.objectContaining({
        channel: 2,
        direction: "application-to-scoring",
        signal: "SERVICE_ONLY_REVERSE_CHANNEL",
        scoring: { pin: 2, net: "SERVICE_ONLY_REVERSE_CHANNEL", endpoint: expect.stringContaining("no STM32 GPIO") },
        application: {
          pin: 7,
          net: "SERVICE_ONLY_REVERSE_CHANNEL",
          endpoint: expect.stringContaining("no ESP32 product GPIO")
        }
      })
    ])
    expect(Object.isFrozen(benchPrototypeIsolationChannel)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIsolationChannel.isolators.main.channels)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIsolationChannel.isolators.main.channels[0])).toBe(true)
  })

  it("binds both supply and ground domains without a direct ground crossing", () => {
    expect(benchPrototypeIsolationChannel.domains).toMatchObject({
      scoring: { owner: "STM32G474RET3TR", supply: "SCORING_3V3", ground: "SCORING_SGND" },
      application: { owner: "ESP32-S3-WROOM-1U-N16R2", supply: "APP_3V3", ground: "APP_GND" },
      digitalIsolation: {
        mainPart: "ISO7762FDWR",
        auxiliaryPart: "ISO7721FDR",
        powerPart: "NXE1S0505MC",
        groundTiePermitted: false
      },
      isolatedPower: {
        part: "NXE1S0505MC",
        source: { domain: "application", supply: "V5", ground: "APP_GND" },
        destination: { domain: "scoring", supply: "SCORING_5V_ISOLATED", ground: "SCORING_SGND" },
        groundCrossing: false
      }
    })
  })

  it("makes heartbeat loss observational and preserves one-way reset authority", () => {
    expect(benchPrototypeIsolationChannel.heartbeat.stm32ToEsp32).toMatchObject({
      signal: "STM32_HEARTBEAT",
      isolator: "ISO7721FDR channel B (pin 3 INB to pin 6 OUTB)",
      defaultLevel: "low"
    })
    expect(benchPrototypeIsolationChannel.heartbeat.esp32ToStm32).toMatchObject({
      signal: "ESP32_HEARTBEAT",
      isolator: "ISO7762FDWR channel 6",
      defaultLevel: "low"
    })
    expect(benchPrototypeIsolationChannel.heartbeat.esp32ToStm32.missingPolicy).toContain("cannot reset STM32 NRST")
    expect(benchPrototypeIsolationChannel.reset.stm32HardwareReset).toMatchObject({
      signal: "SCORING_NRST_N",
      prohibitedSources: expect.arrayContaining(["ESP32 GPIO", "ESP32_HEARTBEAT", "SERVICE_ONLY_REVERSE_CHANNEL"])
    })
    expect(benchPrototypeIsolationChannel.reset.stm32HardwareReset.rule).toContain(
      "cannot automatically reset STM32 NRST"
    )
    expect(benchPrototypeIsolationChannel.reset.esp32HardwareReset.sources).toEqual([
      "U_APP_RESET_FANOUT.Y1",
      "U_ESP_WATCHDOG.WDO+ENOUT",
      "Q_ESP_RESET_STM BSS138AKA",
      "Q_ESP_DEBUG_RESET BSS138AKA"
    ])
    expect(benchPrototypeIsolationChannel.reset.request).toMatchObject({
      signal: "ESP32_RESET_ASSERT",
      isolatedSignal: "RESET_REQUEST",
      activeLevel: "high",
      defaultLevel: "low",
      isolator: "ISO7762FDWR channel 4"
    })
  })

  it("covers powered, independently unpowered, and absent-domain defaults", () => {
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable.map((row) => row.condition)).toEqual([
      "both domains powered",
      "scoring powered, application unpowered",
      "application powered, scoring unpowered",
      "neither domain powered"
    ])
    for (const row of benchPrototypeIsolationChannel.poweredUnpoweredTruthTable) {
      expect(row.failSafeOutputs.toLowerCase()).toMatch(/low|undetermined|unpowered/)
      expect(row.resetOutcome.length).toBeGreaterThan(20)
      expect(row.authorityOutcome.length).toBeGreaterThan(20)
    }
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[1]?.failSafeOutputs).toContain("undetermined")
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[1]?.resetOutcome).toContain(
      "RESET_REQUEST is undetermined or unpowered"
    )
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[1]?.resetOutcome).toContain(
      "Q_ESP_RESET_STM must not release EN_RESET"
    )
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[2]?.failSafeOutputs).toContain("undetermined")
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[2]?.resetOutcome).toContain(
      "RESET_REQUEST remains low"
    )
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[1]).toMatchObject({
      scoringSupply: "present",
      applicationSupply: "absent"
    })
    expect(benchPrototypeIsolationChannel.poweredUnpoweredTruthTable[2]).toMatchObject({
      scoringSupply: "absent",
      applicationSupply: "present"
    })
  })

  it("fails closed on provenance, pin, direction, default, reset, and release mutations", () => {
    const mutations = [
      (candidate: any) => (candidate.provenance.upstream[0].requiredCrossingParts[0] = "UNVERIFIED"),
      (candidate: any) => (candidate.isolators.main.channels[0].application.pin = 14),
      (candidate: any) => (candidate.isolators.main.channels[4].direction = "scoring-to-application"),
      (candidate: any) => (candidate.isolators.main.channels[3].defaultLevel = "high"),
      (candidate: any) => (candidate.domains.scoring.ground = "APP_GND"),
      (candidate: any) => (candidate.domains.isolatedPower.groundCrossing = true),
      (candidate: any) => (candidate.reset.stm32HardwareReset.prohibitedSources = []),
      (candidate: any) => (candidate.releaseGates.fabrication = "allow"),
      (candidate: any) => (candidate.poweredUnpoweredTruthTable[2].failSafeOutputs = "unsafe floating output")
    ]

    for (const mutate of mutations) {
      const candidate = structuredClone(benchPrototypeIsolationChannel)
      mutate(candidate)
      expect(() => validateBenchPrototypeIsolationChannel(candidate)).toThrow(RangeError)
    }

    for (const candidate of [null, [], {}, { ...benchPrototypeIsolationChannel, extra: true }]) {
      expect(() => validateBenchPrototypeIsolationChannel(candidate)).toThrow(RangeError)
    }
  })

  it("rejects accessors, aliases, cycles, holes, and symbol keys before reading them", () => {
    const accessor = structuredClone(benchPrototypeIsolationChannel)
    let getterRead = false
    Object.defineProperty(accessor.releaseGates, "bench", {
      enumerable: true,
      get: () => {
        getterRead = true
        return "deny"
      }
    })
    expect(() => validateBenchPrototypeIsolationChannel(accessor)).toThrow(RangeError)
    expect(getterRead).toBe(false)

    const alias = structuredClone(benchPrototypeIsolationChannel)
    Reflect.set(alias.isolators.main.channels, "1", alias.isolators.main.channels[0])
    expect(() => validateBenchPrototypeIsolationChannel(alias)).toThrow(RangeError)

    const cycle = structuredClone(benchPrototypeIsolationChannel)
    Reflect.set(cycle, "domains", cycle)
    expect(() => validateBenchPrototypeIsolationChannel(cycle)).toThrow(RangeError)

    const hole = structuredClone(benchPrototypeIsolationChannel)
    Reflect.deleteProperty(hole.poweredUnpoweredTruthTable, "1")
    expect(() => validateBenchPrototypeIsolationChannel(hole)).toThrow(RangeError)

    const symbol = structuredClone(benchPrototypeIsolationChannel)
    Reflect.set(symbol, Symbol("forged"), true)
    expect(() => validateBenchPrototypeIsolationChannel(symbol)).toThrow(RangeError)
  })
})
