/**
 * BP-125: processor support-component and schematic-capture contract.
 *
 * This document captures only requirements justified by the frozen pin maps
 * and the processor/module primary-source checklists. It deliberately leaves
 * PCB land patterns, capacitor PCB geometry, oscillator selection, and
 * layout release denied until BP-032/BP-300 supply their independent evidence.
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
    processorRequirements: {
      stm32: {
        sourceUrl: "https://www.st.com/resource/en/datasheet/stm32g474re.pdf",
        sourceDocument: "ST DS12288 Rev 6 STM32G474xB/xC/xE datasheet",
        retainedManufacturerPrimaryBytes: {
          archivePath: "docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf",
          archiveSha256: "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD"
        },
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        requirement:
          "VDD, VDDA, VREF+, and VBAT remain within the STM32's 1.71 V to 3.6 V supply domain; the existing pin and rail contracts require local VDD, VDDA, VREF+, and no-backup VBAT decoupling."
      },
      esp32: {
        sourceUrl: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
        sourceDocument: "Espressif ESP32-S3-WROOM-1/WROOM-1U Datasheet v1.8",
        retainedManufacturerPrimaryBytes: {
          archivePath: "docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf",
          archiveSha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435"
        },
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        requirement:
          "The WROOM-1U 3V3 input remains a 3.0 V to 3.6 V module supply; the frozen rail contract retains one local high-frequency bypass and at least 22 uF effective ceramic bulk at the module supply entry."
      }
    },
    capacitorSelections: [
      {
        references: ["C_STM_3V3_BULK"],
        mpn: "GCM32ER71E106KA57L",
        manufacturer: "Murata",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM32ER71E106KA57L",
        primarySourceMapping: "source-unverified-primary-url-only",
        nominal: "10 uF ±10%",
        effectiveRequirement: "4.7 uF minimum at 3.3 V",
        dielectric: "X7R",
        voltageRating: "25 VDC",
        package: "1210 (3225M)",
        temperatureScope: "-55 to 125 C",
        reliability: "GCM automotive powertrain/safety, AEC-Q200",
        dcBias: {
          sourcePartNumber: "GCM32ER71E106KA57",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 1,
          sampleBiasV: 3.5,
          sampleCapacitanceUf: 10.251225363421954,
          temperature: "25 C typical only",
          archivePath: "docs/evidence/bp-125/murata-gcm32er71e106ka57-dcbias-tc25.json",
          archiveSha256: "8DECC721E40C71BB41FAEDE8037A5A50A1AB7A95E7403A3C0E6AD9D2DBBB53EC"
        }
      },
      {
        references: ["C_STM_VDDA_HF"],
        mpn: "GCM188R71H103KA37D",
        manufacturer: "Murata",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H103KA37D",
        primarySourceMapping: "source-unverified-primary-url-only",
        nominal: "10 nF ±10%",
        effectiveRequirement: "10 nF nominal local VDDA high-frequency bypass",
        dielectric: "X7R",
        voltageRating: "50 VDC",
        package: "0603 (1608M)",
        temperatureScope: "-55 to 125 C",
        reliability: "GCM automotive powertrain/safety, AEC-Q200",
        dcBias: {
          sourcePartNumber: "GCM188R71H103KA37",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 125,
          sampleAcVrms: 1,
          sampleBiasV: 3.5,
          sampleCapacitanceUf: 0.009245470648208033,
          temperature: "125 C typical only",
          archivePath: "docs/evidence/bp-125/murata-gcm188r71h103ka37-dcbias-tc125.json",
          archiveSha256: "541BB5E1738D24528E43A654464F20365E90163A385C0B0E44ACA451B1319879"
        }
      },
      {
        references: ["C_STM_VDDA_BULK", "C_STM_VREF_BULK"],
        mpn: "GCM21BR71E225KA73L",
        manufacturer: "Murata",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM21BR71E225KA73L",
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        archivePath: "docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
        archiveSourceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GCM21BR71E225KA73-01.pdf",
        archiveSha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19",
        packageBodyGeometry: {
          lengthMm: { nominal: 2, tolerance: "±0.15" },
          widthMm: { nominal: 1.25, tolerance: "±0.15" },
          thicknessMm: { nominal: 1.25, tolerance: "±0.15" },
          terminalWidthMm: { minimum: 0.2, maximum: 0.7 },
          terminalGapMinimumMm: 0.7,
          source: "Murata GCM21BR71E225KA73-01 retained reference sheet",
          claimBoundary:
            "Package-body and terminal dimensions only; no PCB land pattern, pad, mask, paste, courtyard, or manufacturer CAD is claimed."
        },
        nominal: "2.2 uF ±10%",
        effectiveRequirement: "1 uF minimum at 3.3 V VDDA and 2.5 V VREF+",
        dielectric: "X7R",
        voltageRating: "25 VDC",
        package: "0805 (2012M)",
        temperatureScope: "-55 to 125 C",
        reliability: "GCM automotive powertrain/safety, AEC-Q200",
        dcBias: {
          sourcePartNumber: "GCM21BR71E225KA73",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 1,
          sampleBiasV: 3.5,
          sampleCapacitanceUf: 2.210545489803181,
          temperature: "25 C typical only",
          archivePath: "docs/evidence/bp-125/murata-gcm21br71e225ka73-dcbias-tc25.json",
          archiveSha256: "068FBE2AACEBB05D10C2C5446A64BB23B6273D19CB05E63B2D4FBF5FBEE1B3AC"
        }
      },
      {
        references: ["C_STM_VREF_HF", "C_STM_VBAT", "C_ESP_3V3_HF"],
        mpn: "GCM188R71H104KA57D",
        manufacturer: "Murata",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D",
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        nominal: "100 nF ±10%",
        effectiveRequirement: "100 nF nominal local high-frequency bypass",
        dielectric: "X7R",
        voltageRating: "50 VDC",
        package: "0603 (1608M)",
        temperatureScope: "-55 to 125 C",
        reliability: "GCM automotive powertrain/safety, AEC-Q200",
        dcBias: {
          sourcePartNumber: "GCM188R71H104KA57",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 125,
          sampleAcVrms: 1,
          sampleBiasV: 3.5,
          sampleCapacitanceUf: 0.09229961572997243,
          temperature: "125 C typical only; existing retained characteristic response",
          archivePath: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc125.json",
          archiveSha256: "F7A096FD71D88535F4AD23B10BCD456498C8468C43E203AEDA0547D3AD0101FD"
        }
      },
      {
        references: ["C_ESP_3V3_BULK"],
        mpn: "GCM32EC71A476KE02L",
        manufacturer: "Murata",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM32EC71A476KE02L",
        primarySourceMapping: "source-unverified-primary-url-only",
        nominal: "47 uF ±10%",
        effectiveRequirement: "22 uF minimum at 3.3 V",
        dielectric: "X7S",
        voltageRating: "10 VDC",
        package: "1210 (3225M)",
        temperatureScope: "-55 to 125 C",
        reliability: "GCM automotive powertrain/safety, AEC-Q200",
        dcBias: {
          sourcePartNumber: "GCM32EC71A476KE02",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 0.5,
          sampleBiasV: 3.5,
          sampleCapacitanceUf: 40.2527944398026,
          temperature: "25 C typical only",
          archivePath: "docs/evidence/bp-125/murata-gcm32ec71a476ke02-dcbias-tc25.json",
          archiveSha256: "6FB8BB5B26B094D92156968AF9DC9E56DD68F4E93D86817F7DBEF19D264F906D"
        }
      }
    ],
    stm32DigitalBypass: {
      references: ["C_STM_VDD16", "C_STM_VDD32", "C_STM_VDD48", "C_STM_VDD64"],
      mpn: "GCM188R71H104KA57D",
      manufacturer: "Murata",
      sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D",
      sourceDocument: "Murata GCM188R71H104KA57D manufacturer reference sheet",
      generatedOn: "2026-08-24",
      value: "100 nF",
      tolerance: "±10%",
      dielectric: "X7R",
      voltageRating: "50 VDC",
      package: "0603 (1608M)",
      temperatureScope: "-55 to 125 C",
      archivePath: "docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf",
      archiveSha256: "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A",
      requestContextPath: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-request.txt",
      requestContextSha256: "B46660B122DCEF2DF94D30DCD2C4C1E4602D36350006B14E94B4F97F31004D58",
      characteristicRecords: [
        {
          temperature: "-40 C",
          requestIdentity:
            "GET https://ds.murata.com/simserve/characteristics?callback=nothing&ReqType=Characteristics&CallBack=&WorkInfo=bp125; ReqChara partnumber=GCM188R71H104KA57D, chara_type=c_dcbias_capacitance, temperature=-40, ac_vrms=1",
          path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tcneg40.json",
          sha256: "81EE2E884FB23E3590B73BB43784A697E4FF7620E77C4F2C1DB44ACB543B54E0"
        },
        {
          temperature: "25 C",
          requestIdentity:
            "GET https://ds.murata.com/simserve/characteristics?callback=nothing&ReqType=Characteristics&CallBack=&WorkInfo=bp125; ReqChara partnumber=GCM188R71H104KA57D, chara_type=c_dcbias_capacitance, temperature=25, ac_vrms=1",
          path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc25.json",
          sha256: "D4B4A03EEDA87CFD812511927DAE323120A2B5F2DFFF1828F8B9DEF090829B7A"
        },
        {
          temperature: "85 C",
          requestIdentity:
            "GET https://ds.murata.com/simserve/characteristics?callback=nothing&ReqType=Characteristics&CallBack=&WorkInfo=bp125; ReqChara partnumber=GCM188R71H104KA57D, chara_type=c_dcbias_capacitance, temperature=85, ac_vrms=1",
          path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc85.json",
          sha256: "0E624A2E28283EB1DABCA2E25B4C7B30F50243348D6E6D47A385AC3E43E51101"
        },
        {
          temperature: "125 C",
          requestIdentity:
            "GET https://ds.murata.com/simserve/characteristics?callback=nothing&ReqType=Characteristics&CallBack=&WorkInfo=bp125; ReqChara partnumber=GCM188R71H104KA57D, chara_type=c_dcbias_capacitance, temperature=125, ac_vrms=1",
          path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc125.json",
          sha256: "F7A096FD71D88535F4AD23B10BCD456498C8468C43E203AEDA0547D3AD0101FD"
        }
      ],
      temperatureLimit:
        "-55 to 125 C source operating range; typical characteristic only, no lot or assembled-board guarantee",
      dcBiasClaim:
        "No numeric DC-bias claim is made by this contract; retained raw responses are evidence for later review only."
    },
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
      capacitorMpn: "GCM188R71H104KA57D",
      population: "required",
      value: "100 nF X7R",
      references: ["C_STM_VDD16", "C_STM_VDD32", "C_STM_VDD48", "C_STM_VDD64"],
      topology:
        "One local capacitor from each LQFP64 VDD pin (16, 32, 48, 64) to its nearest SCORING_DGND return; no shared long trace.",
      bulk: {
        capacitorMpn: "GCM32ER71E106KA57L",
        value: "4.7 uF minimum ceramic",
        reference: "C_STM_3V3_BULK",
        topology: "SCORING_3V3 to SCORING_DGND in the MCU power region."
      }
    },
    stm32Analog: {
      population: "required",
      vdDa: {
        references: ["C_STM_VDDA_HF", "C_STM_VDDA_BULK"],
        values: ["10 nF X7R", "1 uF minimum effective X7R"],
        capacitorMpns: ["GCM188R71H103KA37D", "GCM21BR71E225KA73L"],
        topology: "VDDA pin 29 to VSSA pin 27 at the analog supply entry."
      },
      vref: {
        references: ["C_STM_VREF_HF", "C_STM_VREF_BULK"],
        values: ["100 nF X7R", "1 uF minimum effective X7R"],
        capacitorMpns: ["GCM188R71H104KA57D", "GCM21BR71E225KA73L"],
        topology:
          "VREF+ pin 28 to VSSA pin 27; it must remain on SCORING_VREF_2V5 and cannot be substituted with SCORING_3V3."
      }
    },
    stm32Vbat: {
      population: "required",
      connection: "VBAT pin 1 ties explicitly to SCORING_3V3_NO_BACKUP_TIE",
      capacitorMpn: "GCM188R71H104KA57D",
      reference: "C_STM_VBAT",
      value: "100 nF X7R",
      return: "SCORING_DGND",
      rule: "No backup cell, supercapacitor, or alternate supply is authorized."
    },
    esp32: {
      population: "required",
      references: ["C_ESP_3V3_HF", "C_ESP_3V3_BULK"],
      values: ["100 nF X7R", "22 uF minimum effective ceramic"],
      capacitorMpns: ["GCM188R71H104KA57D", "GCM32EC71A476KE02L"],
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
    contract.bypassAndBulk.stm32Analog.vdDa.values[1] !== "1 uF minimum effective X7R" ||
    contract.bypassAndBulk.stm32Analog.vref.values[1] !== "1 uF minimum effective X7R" ||
    contract.bypassAndBulk.esp32.values[1] !== "22 uF minimum effective ceramic" ||
    contract.bypassAndBulk.stm32Digital.capacitorMpn !== "GCM188R71H104KA57D" ||
    contract.bypassAndBulk.stm32Digital.bulk.capacitorMpn !== "GCM32ER71E106KA57L" ||
    !sameDataGraph(contract.bypassAndBulk.stm32Analog.vdDa.capacitorMpns, [
      "GCM188R71H103KA37D",
      "GCM21BR71E225KA73L"
    ]) ||
    !sameDataGraph(contract.bypassAndBulk.stm32Analog.vref.capacitorMpns, [
      "GCM188R71H104KA57D",
      "GCM21BR71E225KA73L"
    ]) ||
    contract.bypassAndBulk.stm32Vbat.capacitorMpn !== "GCM188R71H104KA57D" ||
    !sameDataGraph(contract.bypassAndBulk.esp32.capacitorMpns, ["GCM188R71H104KA57D", "GCM32EC71A476KE02L"]) ||
    contract.supportSelectionEvidence.processorRequirements.stm32.primarySourceMapping !==
      "verified-by-retained-manufacturer-primary-bytes" ||
    contract.supportSelectionEvidence.processorRequirements.stm32.retainedManufacturerPrimaryBytes.archivePath !==
      "docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf" ||
    contract.supportSelectionEvidence.processorRequirements.stm32.retainedManufacturerPrimaryBytes.archiveSha256 !==
      "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD" ||
    contract.supportSelectionEvidence.processorRequirements.esp32.primarySourceMapping !==
      "verified-by-retained-manufacturer-primary-bytes" ||
    contract.supportSelectionEvidence.processorRequirements.esp32.retainedManufacturerPrimaryBytes.archivePath !==
      "docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf" ||
    contract.supportSelectionEvidence.processorRequirements.esp32.retainedManufacturerPrimaryBytes.archiveSha256 !==
      "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435" ||
    contract.supportSelectionEvidence.capacitorSelections.length !== 5 ||
    contract.supportSelectionEvidence.capacitorSelections[2].mpn !== "GCM21BR71E225KA73L" ||
    contract.supportSelectionEvidence.capacitorSelections[2].primarySourceMapping !==
      "verified-by-retained-manufacturer-primary-bytes" ||
    contract.supportSelectionEvidence.capacitorSelections[2].archivePath !==
      "docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf" ||
    contract.supportSelectionEvidence.capacitorSelections[2].archiveSourceUrl !==
      "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GCM21BR71E225KA73-01.pdf" ||
    contract.supportSelectionEvidence.capacitorSelections[2].archiveSha256 !==
      "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19" ||
    !sameDataGraph(
      contract.supportSelectionEvidence.capacitorSelections.map((selection) => ({
        mpn: selection.mpn,
        sourcePartNumber: selection.dcBias.sourcePartNumber,
        characteristic: selection.dcBias.characteristic,
        sampleTemperatureC: selection.dcBias.sampleTemperatureC,
        sampleAcVrms: selection.dcBias.sampleAcVrms
      })),
      [
        {
          mpn: "GCM32ER71E106KA57L",
          sourcePartNumber: "GCM32ER71E106KA57",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 1
        },
        {
          mpn: "GCM188R71H103KA37D",
          sourcePartNumber: "GCM188R71H103KA37",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 125,
          sampleAcVrms: 1
        },
        {
          mpn: "GCM21BR71E225KA73L",
          sourcePartNumber: "GCM21BR71E225KA73",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 1
        },
        {
          mpn: "GCM188R71H104KA57D",
          sourcePartNumber: "GCM188R71H104KA57",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 125,
          sampleAcVrms: 1
        },
        {
          mpn: "GCM32EC71A476KE02L",
          sourcePartNumber: "GCM32EC71A476KE02",
          characteristic: "c_dcbias_capacitance",
          sampleTemperatureC: 25,
          sampleAcVrms: 0.5
        }
      ]
    ) ||
    !sameDataGraph(contract.supportSelectionEvidence.capacitorSelections[2].packageBodyGeometry, {
      lengthMm: { nominal: 2, tolerance: "±0.15" },
      widthMm: { nominal: 1.25, tolerance: "±0.15" },
      thicknessMm: { nominal: 1.25, tolerance: "±0.15" },
      terminalWidthMm: { minimum: 0.2, maximum: 0.7 },
      terminalGapMinimumMm: 0.7,
      source: "Murata GCM21BR71E225KA73-01 retained reference sheet",
      claimBoundary:
        "Package-body and terminal dimensions only; no PCB land pattern, pad, mask, paste, courtyard, or manufacturer CAD is claimed."
    }) ||
    !sameDataGraph(
      contract.supportSelectionEvidence.capacitorSelections.flatMap((selection) => selection.references),
      [
        "C_STM_3V3_BULK",
        "C_STM_VDDA_HF",
        "C_STM_VDDA_BULK",
        "C_STM_VREF_BULK",
        "C_STM_VREF_HF",
        "C_STM_VBAT",
        "C_ESP_3V3_HF",
        "C_ESP_3V3_BULK"
      ]
    ) ||
    contract.supportSelectionEvidence.capacitorSelections.some(
      (selection) =>
        !selection.sourceUrl.startsWith("https://www.murata.com/") ||
        !/^(?:source-unverified-primary-url-only|verified-by-retained-manufacturer-primary-bytes)$/u.test(
          selection.primarySourceMapping
        ) ||
        selection.reliability !== "GCM automotive powertrain/safety, AEC-Q200" ||
        selection.dcBias.sampleBiasV < 3.3 ||
        !/^[0-9A-F]{64}$/u.test(selection.dcBias.archiveSha256)
    ) ||
    !sameDataGraph(contract.supportSelectionEvidence.stm32DigitalBypass.references, [
      "C_STM_VDD16",
      "C_STM_VDD32",
      "C_STM_VDD48",
      "C_STM_VDD64"
    ]) ||
    contract.supportSelectionEvidence.stm32DigitalBypass.mpn !== "GCM188R71H104KA57D" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.manufacturer !== "Murata" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.sourceUrl !==
      "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.sourceDocument !==
      "Murata GCM188R71H104KA57D manufacturer reference sheet" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.generatedOn !== "2026-08-24" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.value !== "100 nF" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.tolerance !== "±10%" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.dielectric !== "X7R" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.voltageRating !== "50 VDC" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.package !== "0603 (1608M)" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.temperatureScope !== "-55 to 125 C" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.archivePath !==
      "docs/evidence/bp-125/murata-gcm188r71h104ka57-01a.pdf" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.archiveSha256 !==
      "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.requestContextPath !==
      "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-request.txt" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.requestContextSha256 !==
      "B46660B122DCEF2DF94D30DCD2C4C1E4602D36350006B14E94B4F97F31004D58" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.characteristicRecords.length !== 4 ||
    !sameDataGraph(
      contract.supportSelectionEvidence.stm32DigitalBypass.characteristicRecords.map((record) => record.temperature),
      ["-40 C", "25 C", "85 C", "125 C"]
    ) ||
    !sameDataGraph(
      contract.supportSelectionEvidence.stm32DigitalBypass.characteristicRecords.map((record) => record.path),
      [
        "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tcneg40.json",
        "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc25.json",
        "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc85.json",
        "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc125.json"
      ]
    ) ||
    !sameDataGraph(
      contract.supportSelectionEvidence.stm32DigitalBypass.characteristicRecords.map((record) => record.sha256),
      [
        "81EE2E884FB23E3590B73BB43784A697E4FF7620E77C4F2C1DB44ACB543B54E0",
        "D4B4A03EEDA87CFD812511927DAE323120A2B5F2DFFF1828F8B9DEF090829B7A",
        "0E624A2E28283EB1DABCA2E25B4C7B30F50243348D6E6D47A385AC3E43E51101",
        "F7A096FD71D88535F4AD23B10BCD456498C8468C43E203AEDA0547D3AD0101FD"
      ]
    ) ||
    contract.supportSelectionEvidence.stm32DigitalBypass.temperatureLimit !==
      "-55 to 125 C source operating range; typical characteristic only, no lot or assembled-board guarantee" ||
    contract.supportSelectionEvidence.stm32DigitalBypass.dcBiasClaim !==
      "No numeric DC-bias claim is made by this contract; retained raw responses are evidence for later review only." ||
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
