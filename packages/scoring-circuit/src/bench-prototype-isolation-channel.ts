import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { benchPrototypeNetClasses, validateBenchPrototypeNetClasses } from "./bench-prototype-net-classes.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-122 contract cannot contain cycles or aliases")
  seen.add(value)

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-122 contract may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }

  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  const actualObject = typeof actual === "object" && actual !== null
  const expectedObject = typeof expected === "object" && expected !== null
  if (!(actualObject && expectedObject)) return Object.is(actual, expected)
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }

  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

function isExactDataGraph(actual: unknown, expected: unknown): boolean {
  return sameDataGraph(actual, expected, new WeakSet<object>(), new WeakSet<object>())
}

const definition = {
  workUnit: "BP-122",
  artifactKind: "bench-prototype-pin-level-isolation-channel-contract",
  releaseState: "deny",
  fabricationRelease: false,
  releaseGates: {
    schematic: "deny",
    footprint: "deny",
    bench: "deny",
    fabrication: "deny"
  },
  provenance: {
    rule: "Every channel, pin, domain, default, and gate below is derived from and checked against the committed upstream contracts; an altered, missing, or weakened upstream contract rejects BP-122.",
    upstream: [
      {
        workUnit: "BP-040",
        artifact: "benchPrototypeNetClasses",
        source: "src/bench-prototype-net-classes.ts",
        requiredCrossingParts: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"],
        applicationGround: "APP_GND",
        scoringGround: "SCORING_SGND"
      },
      {
        workUnit: "BP-120",
        artifact: "stm32PinAllocation",
        source: "src/stm32-pin-allocation.ts",
        part: "STM32G474RET3TR",
        package: "LQFP64"
      },
      {
        workUnit: "BP-121",
        artifact: "benchPrototypeEsp32Allocation",
        source: "src/bench-prototype-esp32-allocation.ts",
        moduleMpn: "ESP32-S3-WROOM-1U-N16R2",
        padCount: 41
      }
    ]
  },
  domains: {
    scoring: {
      owner: "STM32G474RET3TR",
      supply: "SCORING_3V3",
      ground: "SCORING_SGND",
      isolatedPowerInput: "SCORING_5V_ISOLATED"
    },
    application: {
      owner: "ESP32-S3-WROOM-1U-N16R2",
      supply: "APP_3V3",
      ground: "APP_GND",
      sourcePower: "V5"
    },
    digitalIsolation: {
      mainPart: "ISO7762FDWR",
      auxiliaryPart: "ISO7721FDR",
      powerPart: "NXE1S0505MC",
      groundTiePermitted: false,
      rule: "SCORING_SGND and APP_GND remain separate on every layer; only the named isolators and isolated supply cross the corridor."
    },
    isolatedPower: {
      part: "NXE1S0505MC",
      source: { domain: "application", supply: "V5", ground: "APP_GND" },
      destination: { domain: "scoring", supply: "SCORING_5V_ISOLATED", ground: "SCORING_SGND" },
      downstreamRegulation: "SCORING_5V_ISOLATED is locally regulated to SCORING_3V3",
      groundCrossing: false
    }
  },
  isolators: {
    main: {
      part: "ISO7762FDWR",
      package: "SOIC-16 wide",
      scoringSupplyPins: [1],
      scoringGroundPins: [8],
      applicationSupplyPins: [16],
      applicationGroundPins: [9],
      channels: [
        {
          channel: 1,
          direction: "scoring-to-application",
          signal: "SCORE_SCK",
          scoring: { pin: 2, net: "SCORE_SCK", endpoint: "STM32G474RET3TR PC10 pad 52" },
          application: { pin: 15, net: "SCORE_SCK", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO4 pad 4" },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "F-low applies when the scoring input side loses power or signal while application VCCO is powered; application-side output is undetermined when its VCCO is absent"
        },
        {
          channel: 2,
          direction: "scoring-to-application",
          signal: "SCORE_MOSI",
          scoring: { pin: 3, net: "SCORE_MOSI", endpoint: "STM32G474RET3TR PC12 pad 54" },
          application: { pin: 14, net: "SCORE_MOSI", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO5 pad 5" },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "F-low applies when the scoring input side loses power or signal while application VCCO is powered; malformed or partial records are rejected by the ESP32, and output is undetermined when application VCCO is absent"
        },
        {
          channel: 3,
          direction: "scoring-to-application",
          signal: "SCORE_CS_N",
          scoring: { pin: 4, net: "SCORE_CS_N", endpoint: "STM32G474RET3TR PA15 pad 51" },
          application: { pin: 13, net: "SCORE_CS_N", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO7 pad 7" },
          activeLevel: "low",
          defaultLevel: "low",
          resetBehavior:
            "the F-option low output applies only with application VCCO powered and is not a valid frame select; output is undetermined when application VCCO is absent"
        },
        {
          channel: 4,
          direction: "scoring-to-application",
          signal: "RESET_REQUEST",
          scoring: {
            pin: 5,
            net: "ESP32_RESET_ASSERT",
            endpoint: "STM32G474RET3TR PB5 pad 58"
          },
          application: {
            pin: 12,
            net: "RESET_REQUEST",
            endpoint: "Q_ESP_RESET_STM BSS138AKA gate through R_STM_RESET_GATE"
          },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "low leaves the application reset sink off and high turns on the BSS138 sink when application VCCO is powered; output is undetermined when application VCCO is absent"
        },
        {
          channel: 5,
          direction: "application-to-scoring",
          signal: "SCORE_MISO",
          scoring: { pin: 6, net: "SCORE_MISO", endpoint: "STM32G474RET3TR PC11 pad 53" },
          application: { pin: 11, net: "SCORE_MISO", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO6 pad 6" },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "the ESP32 output remains inactive until SCORE_CS_N is asserted for an accepted transaction; F-low applies with scoring VCCO powered when the application input side is absent, and output is undetermined when scoring VCCO is absent"
        },
        {
          channel: 6,
          direction: "application-to-scoring",
          signal: "ESP32_HEARTBEAT",
          scoring: { pin: 7, net: "ESP32_HEARTBEAT", endpoint: "STM32G474RET3TR PB4 pad 57" },
          application: { pin: 10, net: "ESP32_HEARTBEAT", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO15 pad 8" },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "an application reset, absent input-side rail, or missing heartbeat is F-low only while scoring VCCO is powered; output is undetermined when scoring VCCO is absent, and it cannot drive STM32 NRST"
        }
      ]
    },
    auxiliary: {
      part: "ISO7721FDR",
      package: "SOIC-8",
      scoringSupplyPins: [1],
      scoringGroundPins: [4],
      applicationSupplyPins: [8],
      applicationGroundPins: [5],
      channels: [
        {
          channel: 1,
          direction: "scoring-to-application",
          signal: "STM32_HEARTBEAT",
          scoring: { pin: 3, net: "STM32_HEARTBEAT", endpoint: "STM32G474RET3TR PB3 pad 56" },
          application: { pin: 6, net: "STM32_HEARTBEAT", endpoint: "ESP32-S3-WROOM-1U-N16R2 GPIO17 pad 10" },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "the ESP32 records a missing STM32 heartbeat but cannot qualify a hit, command scoring outputs, or reset the STM32; output is undetermined when application VCCO is absent"
        },
        {
          channel: 2,
          direction: "application-to-scoring",
          signal: "SERVICE_ONLY_REVERSE_CHANNEL",
          scoring: {
            pin: 2,
            net: "SERVICE_ONLY_REVERSE_CHANNEL",
            endpoint: "service-only observation; no STM32 GPIO or NRST connection"
          },
          application: {
            pin: 7,
            net: "SERVICE_ONLY_REVERSE_CHANNEL",
            endpoint: "service-only observation; no ESP32 product GPIO connection"
          },
          activeLevel: "high",
          defaultLevel: "low",
          resetBehavior:
            "reserved service channel remains non-authoritative and must never be connected to STM32 NRST or any scoring control; output is undetermined when scoring VCCO is absent"
        }
      ]
    }
  },
  heartbeat: {
    stm32ToEsp32: {
      signal: "STM32_HEARTBEAT",
      source: "STM32G474RET3TR PB3 pad 56",
      destination: "ESP32-S3-WROOM-1U-N16R2 GPIO17 pad 10",
      isolator: "ISO7721FDR channel B (pin 3 INB to pin 6 OUTB)",
      defaultLevel: "low",
      missingPolicy:
        "ESP32 records the STM32 link fault and keeps all non-authoritative services safe; with application VCCO absent the output is undetermined, and it must not reset or steer STM32 scoring"
    },
    esp32ToStm32: {
      signal: "ESP32_HEARTBEAT",
      source: "ESP32-S3-WROOM-1U-N16R2 GPIO15 pad 8",
      destination: "STM32G474RET3TR PB4 pad 57",
      isolator: "ISO7762FDWR channel 6",
      defaultLevel: "low",
      pullRequirement:
        "external pull-down holds the failed/inactive state while the ESP32 is reset or input-side unpowered and scoring VCCO is powered; output is undetermined when scoring VCCO is absent",
      missingPolicy:
        "STM32 records an application fault only; F-low applies only while scoring VCCO is powered, output is undetermined when scoring VCCO is absent, and heartbeat loss cannot reset STM32 NRST or alter acquisition, qualification, lamps, or buzzer"
    }
  },
  reset: {
    request: {
      signal: "ESP32_RESET_ASSERT",
      isolatedSignal: "RESET_REQUEST",
      source: "STM32G474RET3TR PB5 pad 58",
      isolator: "ISO7762FDWR channel 4",
      activeLevel: "high",
      defaultLevel: "low",
      sink: "Q_ESP_RESET_STM BSS138AKA drains EN_RESET to APP_GND through an application-domain open-drain path"
    },
    esp32HardwareReset: {
      signal: "EN_RESET",
      activeLevel: "low",
      sources: [
        "U_APP_RESET_FANOUT.Y1",
        "U_ESP_WATCHDOG.WDO+ENOUT",
        "Q_ESP_RESET_STM BSS138AKA",
        "Q_ESP_DEBUG_RESET BSS138AKA"
      ],
      sourceDomain: "application",
      rule: "The isolated push-pull output never connects directly to EN_RESET; it only drives the BSS138 gate through the reviewed resistor network."
    },
    stm32HardwareReset: {
      signal: "SCORING_NRST_N",
      sourceDomain: "scoring",
      allowedSources: ["STM32 local supervisor", "STM32 local watchdog", "STM32 SWD service header"],
      prohibitedSources: ["ESP32_HEARTBEAT", "SERVICE_ONLY_REVERSE_CHANNEL", "ESP32 GPIO", "application supervisor"],
      rule: "There is no ESP32-to-STM32 reset path. The ESP32 cannot automatically reset STM32 NRST."
    }
  },
  poweredUnpoweredTruthTable: [
    {
      condition: "both domains powered",
      scoringSupply: "present",
      applicationSupply: "present",
      failSafeOutputs:
        "With both output-side VCCO rails powered, F-option low applies on input-side power or signal loss; outputs otherwise follow their inputs",
      resetOutcome:
        "ESP32 reset remains controlled by its local supervisor/watchdog and an intentional STM32 RESET_REQUEST; STM32 NRST remains scoring-local",
      authorityOutcome: "STM32 remains the sole scoring authority"
    },
    {
      condition: "scoring powered, application unpowered",
      scoringSupply: "present",
      applicationSupply: "absent",
      failSafeOutputs:
        "Application-side outputs are undetermined or unpowered because application VCCO is absent; application-to-scoring input-side loss can produce F-low only where the scoring output side is powered",
      resetOutcome:
        "RESET_REQUEST is undetermined or unpowered because application VCCO is absent; Q_ESP_RESET_STM must not release EN_RESET, no back-power evidence is claimed, and no signal reaches STM32 NRST",
      authorityOutcome: "STM32 acquisition and primary safe-state control continue without ESP32"
    },
    {
      condition: "application powered, scoring unpowered",
      scoringSupply: "absent",
      applicationSupply: "present",
      failSafeOutputs:
        "Scoring-side outputs are undetermined or unpowered because scoring VCCO is absent; scoring-input loss produces F-low only on application outputs whose VCCO remains powered, and the ESP32 treats SPI and STM32_HEARTBEAT as invalid",
      resetOutcome:
        "RESET_REQUEST remains low; application-local reset sources still control EN_RESET; no reverse channel is connected to STM32 NRST",
      authorityOutcome: "ESP32 provides no scoring decision or scoring-output command"
    },
    {
      condition: "neither domain powered",
      scoringSupply: "absent",
      applicationSupply: "absent",
      failSafeOutputs:
        "All receiver outputs are undetermined or unpowered because both output-side VCCO rails are absent; there is no permitted rail or ground path between domains",
      resetOutcome: "both reset systems are unpowered; no cross-domain reset source is active",
      authorityOutcome: "no scoring action is possible and no domain may be back-powered"
    }
  ],
  safetyInvariants: [
    "The STM32G474RET3TR owns acquisition, qualification, timing, primary lamps, and buzzer.",
    "The isolated link carries bounded records, health, and one-way STM32-to-ESP32 reset control only.",
    "ESP32 heartbeat loss never resets STM32 NRST and never changes the scoring decision or primary outputs.",
    "No ESP32 GPIO, ESP32 supervisor, reverse ISO7762 channel, or ISO7721 reverse service channel connects to STM32 NRST; the ESP32 cannot automatically reset STM32 NRST.",
    "APP_GND and SCORING_SGND never tie directly; NXE1S0505MC carries isolated power only.",
    "Every unpowered-domain claim remains a bench measurement gate; the contract does not claim powered-off leakage, rise time, or back-power compliance."
  ]
} as const

export const benchPrototypeIsolationChannel = deepFreeze(definition)

function validateCommittedEvidence(): void {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeNetClasses(benchPrototypeNetClasses)
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)

  const crossings = benchPrototypeNetClasses.isolationRules
  const main = crossings.signalCrossings[0]
  const auxiliary = crossings.signalCrossings[1]
  if (
    crossings.applicationGround !== "APP_GND" ||
    crossings.scoringGround !== "SCORING_SGND" ||
    crossings.directGroundTiePermitted ||
    crossings.crossingParts.join(",") !== "ISO7762FDWR,ISO7721FDR,NXE1S0505MC" ||
    main?.part !== "ISO7762FDWR" ||
    main.scoringToApplication.join(",") !== "SCK,MOSI,CS,RESET_REQUEST" ||
    main.applicationToScoring.join(",") !== "MISO,ESP32_HEARTBEAT" ||
    auxiliary?.part !== "ISO7721FDR" ||
    auxiliary.scoringToApplication.join(",") !== "STM32_HEARTBEAT" ||
    auxiliary.applicationToScoring.join(",") !== "SERVICE_ONLY_REVERSE_CHANNEL"
  ) {
    throw new RangeError("BP-040 isolation provenance no longer matches the reviewed crossing map")
  }

  const stm32Signals = stm32PinAllocation.isolatedSpi
  if (
    stm32Signals.controller !== "SPI3" ||
    stm32Signals.master !== "STM32" ||
    stm32Signals.nets.map(([signal]) => signal).join(",") !== "SCORE_CS_N,SCORE_SCK,SCORE_MISO,SCORE_MOSI" ||
    stm32Signals.control.map(([signal]) => signal).join(",") !== "STM32_HEARTBEAT,ESP32_HEARTBEAT,ESP32_RESET_ASSERT"
  ) {
    throw new RangeError("BP-120 isolation provenance no longer matches the reviewed pad allocation")
  }

  const esp32Signals = benchPrototypeEsp32Allocation.pads.filter((pad) => "signal" in pad).map((pad) => pad.signal)
  const requiredSignals = [
    "SCORE_SCK",
    "SCORE_MOSI",
    "SCORE_MISO",
    "SCORE_CS_N",
    "ESP32_HEARTBEAT",
    "STM32_HEARTBEAT"
  ] as const
  if (
    benchPrototypeEsp32Allocation.moduleMpn !== "ESP32-S3-WROOM-1U-N16R2" ||
    !requiredSignals.every((signal) => esp32Signals.includes(signal)) ||
    benchPrototypeEsp32Allocation.unavailableResources.isolatedResetRequest !==
      "not a GPIO; RESET_REQUEST crosses ISO7762FDWR and drives a BSS138 sink on EN_RESET"
  ) {
    throw new RangeError("BP-121 isolation provenance no longer matches the reviewed module allocation")
  }
}

/** Rejects altered, incomplete, or release-relaxing BP-122 data. */
export function validateBenchPrototypeIsolationChannel(input: unknown): true {
  if (!isExactDataGraph(input, benchPrototypeIsolationChannel)) {
    throw new RangeError("BP-122 isolation channel contract must exactly match the reviewed fail-closed graph")
  }

  validateCommittedEvidence()

  const contract = benchPrototypeIsolationChannel
  if (
    contract.workUnit !== "BP-122" ||
    contract.artifactKind !== "bench-prototype-pin-level-isolation-channel-contract" ||
    contract.releaseState !== "deny" ||
    contract.fabricationRelease !== false ||
    contract.releaseGates.schematic !== "deny" ||
    contract.releaseGates.footprint !== "deny" ||
    contract.releaseGates.bench !== "deny" ||
    contract.releaseGates.fabrication !== "deny" ||
    contract.domains.digitalIsolation.groundTiePermitted ||
    contract.domains.isolatedPower.groundCrossing ||
    contract.isolators.main.channels.length !== 6 ||
    contract.isolators.auxiliary.channels.length !== 2 ||
    contract.poweredUnpoweredTruthTable.length !== 4
  ) {
    throw new RangeError("BP-122 release, channel count, or domain-separation gate changed")
  }

  const main = contract.isolators.main
  const auxiliary = contract.isolators.auxiliary
  const mainSignals = main.channels.map((channel) => channel.signal)
  const auxiliarySignals = auxiliary.channels.map((channel) => channel.signal)
  if (
    main.part !== "ISO7762FDWR" ||
    main.scoringSupplyPins.join(",") !== "1" ||
    main.scoringGroundPins.join(",") !== "8" ||
    main.applicationSupplyPins.join(",") !== "16" ||
    main.applicationGroundPins.join(",") !== "9" ||
    mainSignals.join(",") !== "SCORE_SCK,SCORE_MOSI,SCORE_CS_N,RESET_REQUEST,SCORE_MISO,ESP32_HEARTBEAT" ||
    auxiliary.part !== "ISO7721FDR" ||
    auxiliary.scoringSupplyPins.join(",") !== "1" ||
    auxiliary.scoringGroundPins.join(",") !== "4" ||
    auxiliary.applicationSupplyPins.join(",") !== "8" ||
    auxiliary.applicationGroundPins.join(",") !== "5" ||
    auxiliarySignals.join(",") !== "STM32_HEARTBEAT,SERVICE_ONLY_REVERSE_CHANNEL"
  ) {
    throw new RangeError("BP-122 isolator identity, supply pins, or signal order changed")
  }

  const expectedDirections = [
    "scoring-to-application",
    "scoring-to-application",
    "scoring-to-application",
    "scoring-to-application",
    "application-to-scoring",
    "application-to-scoring"
  ] as const
  if (!main.channels.every((channel, index) => channel.direction === expectedDirections[index])) {
    throw new RangeError("BP-122 ISO7762 channel directions changed")
  }
  if (
    auxiliary.channels[0]?.direction !== "scoring-to-application" ||
    auxiliary.channels[1]?.direction !== "application-to-scoring" ||
    auxiliary.channels[0]?.scoring.pin !== 3 ||
    auxiliary.channels[0]?.application.pin !== 6 ||
    auxiliary.channels[1]?.scoring.pin !== 2 ||
    auxiliary.channels[1]?.application.pin !== 7
  ) {
    throw new RangeError("BP-122 ISO7721 D-8 channel directions or pins changed")
  }

  const allChannels = [...main.channels, ...auxiliary.channels]
  if (
    allChannels.some((channel) => channel.defaultLevel !== "low") ||
    main.channels[3]?.activeLevel !== "high" ||
    main.channels[3]?.scoring.net !== "ESP32_RESET_ASSERT" ||
    main.channels[3]?.application.net !== "RESET_REQUEST" ||
    auxiliary.channels[1]?.application.endpoint !== "service-only observation; no ESP32 product GPIO connection" ||
    contract.reset.esp32HardwareReset.sources.join(",") !==
      "U_APP_RESET_FANOUT.Y1,U_ESP_WATCHDOG.WDO+ENOUT,Q_ESP_RESET_STM BSS138AKA,Q_ESP_DEBUG_RESET BSS138AKA" ||
    !contract.reset.stm32HardwareReset.prohibitedSources.includes("ESP32 GPIO") ||
    !contract.reset.stm32HardwareReset.prohibitedSources.includes("ESP32_HEARTBEAT") ||
    !contract.reset.stm32HardwareReset.rule.includes("cannot automatically reset STM32 NRST") ||
    !contract.heartbeat.esp32ToStm32.missingPolicy.includes("cannot reset STM32 NRST")
  ) {
    throw new RangeError("BP-122 default polarity, reset containment, or reverse-channel rule changed")
  }

  for (const row of contract.poweredUnpoweredTruthTable) {
    if (
      row.failSafeOutputs.length === 0 ||
      row.resetOutcome.length === 0 ||
      row.authorityOutcome.length === 0 ||
      (!row.failSafeOutputs.toLowerCase().includes("low") &&
        !row.failSafeOutputs.toLowerCase().includes("undetermined") &&
        !row.failSafeOutputs.toLowerCase().includes("unpowered"))
    ) {
      throw new RangeError("BP-122 powered/unpowered truth table must retain explicit low fail-safe outcomes")
    }
  }
  if (
    !contract.poweredUnpoweredTruthTable[1]?.failSafeOutputs.includes("undetermined") ||
    !contract.poweredUnpoweredTruthTable[2]?.failSafeOutputs.includes("undetermined") ||
    !contract.poweredUnpoweredTruthTable[3]?.failSafeOutputs.includes("undetermined") ||
    !contract.poweredUnpoweredTruthTable[1]?.resetOutcome.includes("RESET_REQUEST is undetermined or unpowered") ||
    !contract.poweredUnpoweredTruthTable[1]?.resetOutcome.includes("Q_ESP_RESET_STM must not release EN_RESET") ||
    !contract.poweredUnpoweredTruthTable[1]?.resetOutcome.includes("no back-power evidence is claimed") ||
    !contract.poweredUnpoweredTruthTable[2]?.resetOutcome.includes("RESET_REQUEST remains low")
  ) {
    throw new RangeError("BP-122 must distinguish output-side VCCO absence from F-option low and reset release")
  }

  if (
    contract.safetyInvariants.length !== 6 ||
    !contract.safetyInvariants.some((invariant) => invariant.includes("cannot automatically reset STM32 NRST")) ||
    !contract.safetyInvariants.some((invariant) =>
      invariant.includes("Every unpowered-domain claim remains a bench measurement gate")
    )
  ) {
    throw new RangeError("BP-122 safety invariants or physical-evidence boundary changed")
  }

  return true
}
