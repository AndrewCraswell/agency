export type PrimaryOutputChannel = "LAMP_RED" | "LAMP_GREEN" | "LAMP_WHITE_LEFT" | "LAMP_WHITE_RIGHT" | "BUZZER"

const channels = [
  { channel: "LAMP_RED", connectorCircuit: 1, controllerNet: "ESP32_GPIO7_PRIMARY_LAMP_RED", gpio: 7 },
  { channel: "LAMP_GREEN", connectorCircuit: 2, controllerNet: "ESP32_GPIO15_PRIMARY_LAMP_GREEN", gpio: 15 },
  { channel: "LAMP_WHITE_LEFT", connectorCircuit: 3, controllerNet: "ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT", gpio: 17 },
  {
    channel: "LAMP_WHITE_RIGHT",
    connectorCircuit: 4,
    controllerNet: "ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
    gpio: 10
  },
  { channel: "BUZZER", connectorCircuit: 5, controllerNet: "ESP32_GPIO11_PRIMARY_BUZZER", gpio: 11 }
] as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("primary-output contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("primary-output contract permits data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/**
 * P0 bench selection for the physical scoring indications. The selected parts
 * are deliberately low-voltage bench loads, not the FIE extension-lamp or
 * disconnected-audible apparatus required for an approved competition system.
 */
export const benchPrototypePrimaryOutputs = deepFreeze({
  artifactKind: "bench-prototype-primary-output-selection",
  targetAssembly: "ESP32-S3 P0 physical-indication bench",
  releaseState: "bring-up-only",
  channels,
  authority: {
    scoringOwner: "ESP32-S3-WROOM-1-N16R2",
    allocatedSignals: "GPIO7 red, GPIO15 green, GPIO17 left white, GPIO10 right white, GPIO11 buzzer",
    source: "packages/scoring-circuit/docs/bench-prototype-processor-support.md"
  },
  loadEnvelope: {
    supplyMaximumV: 5.25,
    supplyMinimumV: 4.75,
    nominalSupplyV: 5,
    normalAggregateCurrentMaximumA: 0.11,
    protectedAggregateCurrentMaximumA: 0.15,
    addedHarnessCapacitanceMaximumNf: 100,
    measuredAggregateInrushAcceptanceA: 0.15,
    rule: "The 0.15 A aggregate limit is a P0 bring-up acceptance measurement. Do not add unmeasured capacitive, lamp, or acoustic loads."
  },
  loads: {
    red: {
      reference: "D_P0_RED",
      manufacturer: "Kingbright",
      mpn: "WP7113ID",
      nominalCurrentMa: 10,
      seriesResistanceOhm: 180,
      sourceUrl: "https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf"
    },
    green: {
      reference: "D_P0_GREEN",
      manufacturer: "Kingbright",
      mpn: "WP7113SGD",
      nominalCurrentMa: 20,
      seriesResistanceOhm: 180,
      sourceUrl: "https://www.kingbrightusa.com/images/catalog/spec/wp7113sgd.pdf"
    },
    white: {
      count: 2,
      reference: "D_P0_WHITE_LEFT, D_P0_WHITE_RIGHT",
      manufacturer: "Kingbright",
      mpn: "WP7113QWC/D",
      nominalCurrentMa: 20,
      seriesResistanceOhm: 180,
      sourceUrl: "https://www.kingbrightusa.com/images/catalog/SPEC/WP7113QWC-D.pdf"
    },
    buzzer: {
      reference: "BZ_P0",
      manufacturer: "Same Sky",
      mpn: "CMI-9605-0580T",
      nominalCurrentMa: 30,
      operatingVoltageRangeV: [3, 7],
      sourceUrl: "https://www.sameskydevices.com/product/audio/buzzers/audio-indicators/cmi-9605-0580t"
    },
    lampChannelFaultCurrentMaximumMa: 30,
    outputLoadRule:
      "Each LED has its own 180 ohm quarter-watt ballast. The selected buzzer is an internally driven 5 V magnetic indicator."
  },
  outputDriver: {
    array: {
      count: 1,
      manufacturer: "Toshiba",
      mpn: "TBD62783AFWG",
      reference: "U_P0_OUTPUT_DRIVER",
      usedChannels: 5,
      unusedChannels: 3,
      inputHighMinimumV: 2,
      sourceUrl:
        "https://toshiba.semicon-storage.com/info/TBD62783AFWG_datasheet_en_20160511.pdf?did=30523&prodName=TBD62783AFWG",
      behavior:
        "One eight-channel source driver feeds the five connector circuits from the protected V5 output branch. Three outputs and their inputs remain unconnected."
    },
    branchFuse: {
      manufacturer: "Littelfuse",
      mpn: "1206L020YR",
      reference: "F_P0_OUTPUTS",
      holdCurrentA: 0.2,
      sourceUrl:
        "https://www.littelfuse.com/media?resourcetype=datasheets&itemid=8d9c671a-cb91-4a33-a164-24650ba22171&filename=littelfuse-polyfuse-pptc-1206l-datasheet"
    },
    resetDefault:
      "Each of the five ESP32 inputs has a 100 kilohm pull-down to APP_GND. Reset or watchdog assertion makes the GPIO high-impedance, so the external pull-downs turn every source-driver channel off without five extra logic gates.",
    esd: {
      manufacturer: "Texas Instruments",
      mpn: "TPD6E05U06RVZR",
      sourceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
      protectedCircuits: [1, 2, 3, 4, 5],
      rule: "Place the five used channels at J_PRIMARY_OUTPUTS with their clamp return directly to APP_GND."
    }
  },
  connectorAndCable: {
    connector: {
      reference: "J_PRIMARY_OUTPUTS",
      manufacturer: "Molex",
      headerMpn: "39-29-1067",
      matingHousingMpn: "39-01-2060",
      terminalMpn: "39-00-0039",
      sourceUrl: "https://www.molex.com/en-us/products/part-detail/39291067"
    },
    cable: {
      manufacturer: "Alpha Wire",
      mpn: "1176C SL005",
      maximumLengthM: 3,
      sourceUrl: "https://www.alphawire.com/en/products/cable/alpha-essentials/communication-and-control-cable/1176c",
      conductors: [
        { circuit: 1, color: "red", function: "red lamp anode feed" },
        { circuit: 2, color: "green", function: "green lamp anode feed" },
        { circuit: 3, color: "white", function: "left white lamp anode feed" },
        { circuit: 4, color: "orange", function: "right white lamp anode feed" },
        { circuit: 5, color: "blue", function: "buzzer positive feed" },
        { circuit: 6, color: "black", function: "shared APP_GND return" }
      ]
    }
  },
  resetAndFaultBehavior: {
    resetDefault:
      "All TBD62783A inputs are low while the ESP32 is unpowered, held in reset, or has not configured its GPIO. The reset supervisor and GPIO12 watchdog both reset the ESP32; the external input pull-downs leave every connector circuit de-energized.",
    openLoad:
      "No load-monitoring claim is made. An open lamp or buzzer stays non-energizing and must be found by the P0 lamp-test observation.",
    shortCircuit:
      "The shared 0.2 A PPTC bounds a sustained branch fault, but the source-driver array is not credited with per-channel short protection. Remove power after any short; the fault must not create a scoring indication on another channel.",
    reverseConnection:
      "The keyed Mini-Fit Jr. mate prevents reversed connector insertion. A remote lamp or buzzer wired with reversed polarity is a de-energized pre-power inspection failure, not a supported operating state. Do not apply an external voltage to an output because reverse-current blocking is not claimed.",
    thermal:
      "No automatic thermal recovery is credited. After excess temperature or a tripped branch fuse, remove power, remove the fault, allow cooling, and repeat continuity plus lamp test before use."
  },
  fieDisposition: {
    physicalQualification: "required during bring-up",
    notClaimed: [
      "FIE m.59 lamp geometry, omnidirectional visibility, or minimum lumens",
      "FIE m.51 disconnected-audible 80 to 100 dB measurement",
      "FIE extension-lamp, finals-clock, EMC, temperature, vibration, or homologation approval"
    ],
    requiredBringUp: [
      "measure V5 at the remote harness at 4.75 V and 5.25 V source limits",
      "measure aggregate turn-on inrush against the 0.15 A acceptance limit",
      "observe every lamp and buzzer during lamp test, reset, watchdog loss, open, short, reverse-wiring inspection, and thermal recovery",
      "keep the physical FIE output qualification as a separate product-release gate"
    ]
  }
})

export function validateBenchPrototypePrimaryOutputs(value: unknown): true {
  if (value !== benchPrototypePrimaryOutputs) {
    throw new RangeError("primary-output selection must use the canonical P0 contract")
  }
  const contract = benchPrototypePrimaryOutputs
  if (
    contract.targetAssembly !== "ESP32-S3 P0 physical-indication bench" ||
    contract.releaseState !== "bring-up-only" ||
    contract.authority.scoringOwner !== "ESP32-S3-WROOM-1-N16R2" ||
    contract.channels.map((channel) => channel.connectorCircuit).join(",") !== "1,2,3,4,5" ||
    contract.channels.map((channel) => channel.gpio).join(",") !== "7,15,17,10,11" ||
    contract.loadEnvelope.supplyMinimumV !== 4.75 ||
    contract.loadEnvelope.supplyMaximumV !== 5.25 ||
    contract.loadEnvelope.measuredAggregateInrushAcceptanceA !== 0.15 ||
    contract.loads.red.mpn !== "WP7113ID" ||
    contract.loads.green.mpn !== "WP7113SGD" ||
    contract.loads.white.mpn !== "WP7113QWC/D" ||
    contract.loads.buzzer.mpn !== "CMI-9605-0580T" ||
    contract.outputDriver.array.mpn !== "TBD62783AFWG" ||
    contract.outputDriver.array.count !== 1 ||
    contract.outputDriver.array.usedChannels !== 5 ||
    contract.outputDriver.branchFuse.mpn !== "1206L020YR" ||
    contract.outputDriver.esd.mpn !== "TPD6E05U06RVZR" ||
    contract.connectorAndCable.cable.mpn !== "1176C SL005" ||
    contract.connectorAndCable.cable.maximumLengthM !== 3 ||
    contract.connectorAndCable.cable.conductors.map((wire) => wire.color).join(",") !==
      "red,green,white,orange,blue,black" ||
    !contract.resetAndFaultBehavior.resetDefault.includes("de-energized") ||
    !contract.resetAndFaultBehavior.shortCircuit.includes("0.2 A PPTC") ||
    !contract.resetAndFaultBehavior.reverseConnection.includes("not claimed") ||
    contract.fieDisposition.physicalQualification !== "required during bring-up"
  ) {
    throw new RangeError("P0 outputs must remain a bounded, reset-safe physical-indication selection")
  }
  return true
}
