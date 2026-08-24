/**
 * BP-125: processor support-component and schematic-capture contract.
 *
 * This document captures only requirements justified by the frozen pin maps
 * and the processor/module primary-source checklists. It deliberately leaves
 * land patterns, capacitor MPNs, oscillator selection, and layout release
 * denied until BP-032/BP-300 supply their independent evidence.
 */

import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-125 contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-125 contract may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object")
    return Object.is(actual, expected)
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  )
    return false
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

const upstreamProvenance = deepFreeze({
  stm32: {
    part: stm32PinAllocation.part,
    package: stm32PinAllocation.package,
    pads: structuredClone(stm32PinAllocation.pads),
    clocks: structuredClone(stm32PinAllocation.clocks),
    safeStates: structuredClone(stm32PinAllocation.safeStates),
    backupDomain: stm32PinAllocation.backupDomain
  },
  esp32: {
    moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
    pads: structuredClone(benchPrototypeEsp32Allocation.pads),
    recovery: structuredClone(benchPrototypeEsp32Allocation.recovery),
    resetSafety: structuredClone(benchPrototypeEsp32Allocation.resetSafety),
    unavailableResources: structuredClone(benchPrototypeEsp32Allocation.unavailableResources),
    irReceiver: structuredClone(benchPrototypeEsp32Allocation.irReceiver)
  }
})

function currentUpstreamProvenance() {
  return {
    stm32: {
      part: stm32PinAllocation.part,
      package: stm32PinAllocation.package,
      pads: structuredClone(stm32PinAllocation.pads),
      clocks: structuredClone(stm32PinAllocation.clocks),
      safeStates: structuredClone(stm32PinAllocation.safeStates),
      backupDomain: stm32PinAllocation.backupDomain
    },
    esp32: {
      moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
      pads: structuredClone(benchPrototypeEsp32Allocation.pads),
      recovery: structuredClone(benchPrototypeEsp32Allocation.recovery),
      resetSafety: structuredClone(benchPrototypeEsp32Allocation.resetSafety),
      unavailableResources: structuredClone(benchPrototypeEsp32Allocation.unavailableResources),
      irReceiver: structuredClone(benchPrototypeEsp32Allocation.irReceiver)
    }
  }
}

const processorSupportDefinition = {
  artifactKind: "bench-prototype-processor-support-contract",
  workUnit: "BP-125",
  targetAssembly: "one-board bench prototype",
  releaseState: "deny",
  sources: {
    stm32: ["ST DS12288 STM32G474xD/E datasheet", "ST AN5093 STM32G4 hardware development"],
    esp32: [
      "ESP32-S3-WROOM-1/WROOM-1U Datasheet v1.8",
      "Espressif ESP32-S3 Hardware Design Guidelines: schematic checklist and PCB layout"
    ]
  },
  supportSelectionEvidence: {
    stm32Boot0Pulldown: {
      reference: "R_STM_BOOT0",
      mpn: "RC0603FR-0710KL",
      manufacturer: "Yageo",
      sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      sourceDocument: "Yageo RC0603FR-0710KL manufacturer product specification",
      generatedOn: "2026-08-24",
      archivePath: "docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf",
      archiveSha256: "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497",
      observedSpecification: "10 kOhm, 1%, 0.1 W at 70 C, 0603 / 1608, 75 V maximum continuous voltage"
    },
    esp32BootPullup: {
      reference: "R_ESP_BOOT_PULLUP",
      mpn: "RC0603FR-0710KL",
      manufacturer: "Yageo",
      sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      sourceDocument: "Yageo RC0603FR-0710KL manufacturer product specification",
      generatedOn: "2026-08-24",
      archivePath: "docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf",
      archiveSha256: "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497",
      observedSpecification: "10 kOhm, 1%, 0.1 W at 70 C, 0603 / 1608, 75 V maximum continuous voltage"
    },
    esp32EnPullup: {
      reference: "R_ESP_EN_PULLUP",
      mpn: "RC0603FR-0710KL",
      manufacturer: "Yageo",
      sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      sourceDocument: "Yageo RC0603FR-0710KL manufacturer product specification",
      generatedOn: "2026-08-24",
      archivePath: "docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf",
      archiveSha256: "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497",
      observedSpecification: "10 kOhm, 1%, 0.1 W at 70 C, 0603 / 1608, 75 V maximum continuous voltage"
    }
  },
  processors: {
    stm32: {
      part: "STM32G474RET3TR",
      package: "LQFP64",
      supply: "SCORING_3V3",
      digitalGround: "SCORING_DGND",
      analogSupply: "SCORING_3V3_ANALOG",
      analogGround: "SCORING_AGND",
      reference: "SCORING_VREF_2V5"
    },
    esp32: { part: "ESP32-S3-WROOM-1U-N16R2", supply: "V3_3", ground: "APP_GND", reset: "EN_RESET", boot: "BOOT_N" }
  },
  oscillators: {
    stm32Hse: {
      pads: ["PF0-OSC_IN", "PF1-OSC_OUT"],
      population: "DNP",
      exactOscillatorMpn: "TBD",
      decision:
        "No external HSE crystal, oscillator, load capacitors, or bias network is selected. The pads remain reserved and must not receive unrelated loads.",
      closure:
        "Before BP-300 select an exact source and complete ST drive-level, startup, load-capacitance, tolerance, footprint, and measured scoring/transport-timing review, or prove HSI tolerance for every timing consumer."
    },
    stm32Lse: {
      pads: ["PC14-OSC32_IN", "PC15-OSC32_OUT"],
      population: "DNP",
      exactOscillatorMpn: "TBD",
      decision: "No LSE or backup-time source is allocated; both pads remain unconnected.",
      closure:
        "A real-time-clock, wake-from-standby, or backup-time requirement is an allocation change and cannot be silently populated."
    },
    esp32: {
      population: "module-integrated",
      exactOscillatorMpn: "inside ESP32-S3-WROOM-1U-N16R2",
      decision:
        "Do not add an external 40 MHz source or crystal to the module. The module oscillator and flash/PSRAM interconnect remain module-owned.",
      closure: "Preserve the module RF, ground, power, and antenna-connector layout rules before release."
    }
  },
  bypassAndBulk: {
    stm32Digital: {
      capacitorMpn: "TBD",
      population: "required",
      value: "100 nF X7R",
      references: ["C_STM_VDD16", "C_STM_VDD32", "C_STM_VDD48", "C_STM_VDD64"],
      topology:
        "One local capacitor from each LQFP64 VDD pin (16, 32, 48, 64) to its nearest SCORING_DGND return; no shared long trace.",
      bulk: {
        capacitorMpn: "TBD",
        value: "4.7 uF minimum ceramic",
        reference: "C_STM_3V3_BULK",
        topology: "SCORING_3V3 to SCORING_DGND in the MCU power region."
      }
    },
    stm32Analog: {
      capacitorMpn: "TBD",
      population: "required",
      vdDa: {
        references: ["C_STM_VDDA_HF", "C_STM_VDDA_BULK"],
        values: ["10 nF X7R", "1 uF X7R"],
        topology: "VDDA pin 29 to VSSA pin 27 at the analog supply entry."
      },
      vref: {
        references: ["C_STM_VREF_HF", "C_STM_VREF_BULK"],
        values: ["100 nF X7R", "1 uF X7R"],
        topology:
          "VREF+ pin 28 to VSSA pin 27; it must remain on SCORING_VREF_2V5 and cannot be substituted with SCORING_3V3."
      }
    },
    stm32Vbat: {
      population: "required",
      connection: "VBAT pin 1 ties explicitly to SCORING_3V3_NO_BACKUP_TIE",
      capacitorMpn: "TBD",
      reference: "C_STM_VBAT",
      value: "100 nF X7R",
      return: "SCORING_DGND",
      rule: "No backup cell, supercapacitor, or alternate supply is authorized."
    },
    esp32: {
      capacitorMpn: "TBD",
      population: "required",
      references: ["C_ESP_3V3_HF", "C_ESP_3V3_BULK"],
      values: ["100 nF X7R", "22 uF minimum ceramic"],
      topology:
        "Each capacitor connects directly from module pad 2 3V3 to module ground pads 1, 40, and exposed pad 41 through the shortest low-inductance return."
    }
  },
  bootAndReset: {
    stm32: {
      boot0: {
        pad: "PB8-BOOT0",
        reference: "R_STM_BOOT0",
        mpn: "RC0603FR-0710KL",
        value: "10 kOhm pulldown",
        disposition: "required"
      },
      nrst: {
        net: "SCORING_NRST_N",
        rule: "BP-123 owns all reset sources. No push-pull source, functional load, or cross-domain reset input may be added."
      },
      unusedPads: [
        "PC13",
        "PC14-OSC32_IN",
        "PC15-OSC32_OUT",
        "PA0",
        "PA1",
        "PA2",
        "PA3",
        "PA7",
        "PC4",
        "PC5",
        "PC7",
        "PC8",
        "PD2",
        "PB6",
        "PB7",
        "PB9"
      ],
      firmwareRule:
        "Configure unused GPIO after reset to the ST-recommended low-leakage analog state without overriding external safety pulls."
    },
    esp32: {
      en: {
        reference: "R_ESP_EN_PULLUP",
        mpn: "RC0603FR-0710KL",
        value: "10 kOhm pullup",
        capacitorReference: "C_ESP_EN_DELAY",
        capacitorMpn: "TBD",
        capacitorValue: "1 uF",
        topology:
          "EN_RESET to V3_3 through R and EN_RESET to APP_GND through C; BP-123 supervisor/watchdog and the service/reset sinks remain open-drain only."
      },
      gpio0: {
        net: "BOOT_N",
        reference: "R_ESP_BOOT_PULLUP",
        mpn: "RC0603FR-0710KL",
        value: "10 kOhm pullup",
        rule: "Service fixture may pull low only while EN_RESET is asserted; it may not carry a product function."
      },
      straps: [
        { gpio: 3, disposition: "unconnected and quiet" },
        { gpio: 45, disposition: "weak external pulldown and high-impedance AHCT input during reset" },
        { gpio: 46, disposition: "weak external pulldown and high-impedance AHCT input during reset" }
      ],
      unusedPads: [
        "GPIO3",
        "GPIO26 through GPIO32 internal flash/PSRAM and not exposed",
        "GPIO33 and GPIO34 not exposed by N16R2",
        "GPIO36 and GPIO37 reserved NC for DNP audio"
      ],
      irReceiver: {
        modulePad: 28,
        gpio: 35,
        signal: "IR_RX",
        peripheral: "RMT_RX",
        direction: "input",
        receiverHardware: "BP-146 not selected",
        resetRule:
          "Receiver front end must be electrically inactive through ESP32 reset and boot; GPIO35 remains an input until the application enables RMT_RX."
      },
      firmwareRule:
        "Do not reconfigure USB GPIO19/GPIO20, boot straps, IR_RX GPIO35, reserved NC GPIO36/GPIO37, or flash/PSRAM resources as generic GPIO. GPIO3 remains unconnected; GPIO33/GPIO34 are not exposed."
    }
  },
  layoutAndSequencing: {
    required: [
      "Place each bypass capacitor at its named supply pin with a direct return and no shared long return trace.",
      "Keep STM32 VREF+ and VDDA loops in the analog region and prevent digital return current from crossing their return path.",
      "Keep HSE/LSE footprints DNP until the selected clock evidence is independently reviewed.",
      "Follow Espressif's exact WROOM-1U module land pattern, exposed-pad ground-via pattern, paste, and copper-clearance policy; these require independent footprint evidence.",
      "The WROOM-1U contains its RF connector, so do not add a host-board U.FL route. Review the exact external antenna, cable, connector clearance and retention, antenna keepout, and separation from USB2, W5500, HUB75 clocks, switching loops, and high-current display paths.",
      "Application V3_3 must be valid before EN_RESET releases; scoring SCORING_3V3 must be valid before SCORING_NRST_N releases; BP-123 owns measured thresholds and delays.",
      "No processor release, clock-valid, decoupling-effective, RF, or power-sequence measurement has passed yet."
    ],
    evidence: {
      layoutReviewed: false,
      capacitanceDeratedAndMeasured: false,
      clockValidated: false,
      powerSequenceMeasured: false,
      rfPathReviewed: false,
      schematicSignoff: false,
      fabricationAuthorized: false
    }
  },
  authority: {
    schematicIntegrationAuthorized: false,
    schematicSignoff: "deny",
    footprintApproval: false,
    layoutApproval: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeProcessorSupport = deepFreeze(processorSupportDefinition)
export const benchPrototypeProcessorSupportUpstreamProvenance = upstreamProvenance

/** Rejects every substitution, omission, upstream allocation drift, and premature release. */
export function validateBenchPrototypeProcessorSupport(value: unknown): true {
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  if (!sameDataGraph(value, benchPrototypeProcessorSupport))
    throw new RangeError("BP-125 processor-support contract must exactly match the reviewed canonical contract")
  if (!sameDataGraph(currentUpstreamProvenance(), benchPrototypeProcessorSupportUpstreamProvenance))
    throw new RangeError("BP-125 source pin-allocation provenance drifted")
  const contract = benchPrototypeProcessorSupport
  if (
    contract.processors.stm32.part !== "STM32G474RET3TR" ||
    contract.processors.esp32.part !== "ESP32-S3-WROOM-1U-N16R2" ||
    contract.oscillators.stm32Hse.population !== "DNP" ||
    contract.oscillators.stm32Lse.population !== "DNP" ||
    contract.bypassAndBulk.stm32Digital.references.length !== 4 ||
    contract.bypassAndBulk.stm32Analog.vref.values[0] !== "100 nF X7R" ||
    contract.bypassAndBulk.stm32Analog.vref.values[1] !== "1 uF X7R" ||
    contract.bypassAndBulk.esp32.values[1] !== "22 uF minimum ceramic" ||
    contract.bootAndReset.stm32.boot0.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.stm32Boot0Pulldown.reference !== "R_STM_BOOT0" ||
    contract.supportSelectionEvidence.stm32Boot0Pulldown.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.stm32Boot0Pulldown.manufacturer !== "Yageo" ||
    !contract.supportSelectionEvidence.stm32Boot0Pulldown.sourceUrl.startsWith("https://www.yageogroup.com/") ||
    !/^docs\/evidence\/bp-125\/[^/]+\.pdf$/u.test(contract.supportSelectionEvidence.stm32Boot0Pulldown.archivePath) ||
    !/^[0-9A-F]{64}$/u.test(contract.supportSelectionEvidence.stm32Boot0Pulldown.archiveSha256) ||
    contract.bootAndReset.esp32.gpio0.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.esp32BootPullup.reference !== "R_ESP_BOOT_PULLUP" ||
    contract.supportSelectionEvidence.esp32BootPullup.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.esp32BootPullup.manufacturer !== "Yageo" ||
    !contract.supportSelectionEvidence.esp32BootPullup.sourceUrl.startsWith("https://www.yageogroup.com/") ||
    !/^docs\/evidence\/bp-125\/[^/]+\.pdf$/u.test(contract.supportSelectionEvidence.esp32BootPullup.archivePath) ||
    !/^[0-9A-F]{64}$/u.test(contract.supportSelectionEvidence.esp32BootPullup.archiveSha256) ||
    contract.bootAndReset.esp32.en.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.esp32EnPullup.reference !== "R_ESP_EN_PULLUP" ||
    contract.supportSelectionEvidence.esp32EnPullup.mpn !== "RC0603FR-0710KL" ||
    contract.supportSelectionEvidence.esp32EnPullup.manufacturer !== "Yageo" ||
    !contract.supportSelectionEvidence.esp32EnPullup.sourceUrl.startsWith("https://www.yageogroup.com/") ||
    !/^docs\/evidence\/bp-125\/[^/]+\.pdf$/u.test(contract.supportSelectionEvidence.esp32EnPullup.archivePath) ||
    !/^[0-9A-F]{64}$/u.test(contract.supportSelectionEvidence.esp32EnPullup.archiveSha256) ||
    contract.bootAndReset.esp32.irReceiver.modulePad !== 28 ||
    contract.bootAndReset.esp32.irReceiver.gpio !== 35 ||
    contract.bootAndReset.esp32.irReceiver.signal !== "IR_RX" ||
    contract.bootAndReset.esp32.irReceiver.peripheral !== "RMT_RX" ||
    contract.bootAndReset.esp32.irReceiver.receiverHardware !== "BP-146 not selected" ||
    !contract.bootAndReset.esp32.unusedPads.includes("GPIO33 and GPIO34 not exposed by N16R2") ||
    !contract.bootAndReset.esp32.unusedPads.includes("GPIO36 and GPIO37 reserved NC for DNP audio") ||
    contract.authority.schematicSignoff !== "deny" ||
    contract.layoutAndSequencing.evidence.fabricationAuthorized
  ) {
    throw new RangeError(
      "BP-125 must retain exact processor identities, mandatory bypass coverage, DNP clock gates, and denied release"
    )
  }
  return true
}
