/** BP-121 exact sole-processor pad allocation for the simplified P0. */

export type Esp32PadDisposition = "assigned" | "ground" | "power" | "reserved" | "reserved-nc" | "reset"

const pads = [
  { pad: 1, pin: "GND", signal: "APP_GND", group: "power", disposition: "ground" },
  { pad: 2, pin: "3V3", signal: "APP_3V3", group: "power", disposition: "power" },
  { pad: 3, pin: "EN", signal: "EN_RESET", group: "recovery", disposition: "reset" },
  { pad: 4, gpio: 4, pin: "GPIO4", signal: "SAR_SCLK", group: "scoring-adc", disposition: "assigned" },
  { pad: 5, gpio: 5, pin: "GPIO5", signal: "SAR_DOUT", group: "scoring-adc", disposition: "assigned" },
  { pad: 6, gpio: 6, pin: "GPIO6", signal: "SAR_CONVST", group: "scoring-adc", disposition: "assigned" },
  { pad: 7, gpio: 7, pin: "GPIO7", signal: "LAMP_RED", group: "primary-output", disposition: "assigned" },
  { pad: 8, gpio: 15, pin: "GPIO15", signal: "LAMP_GREEN", group: "primary-output", disposition: "assigned" },
  { pad: 9, gpio: 16, pin: "GPIO16", signal: "HUB75_R2", group: "hub75", disposition: "assigned" },
  { pad: 10, gpio: 17, pin: "GPIO17", signal: "LAMP_WHITE_LEFT", group: "primary-output", disposition: "assigned" },
  { pad: 11, gpio: 18, pin: "GPIO18", signal: "APP_SPI_SCK", group: "app-spi", disposition: "assigned" },
  { pad: 12, gpio: 8, pin: "GPIO8", signal: "APP_SPI_MOSI", group: "app-spi", disposition: "assigned" },
  { pad: 13, gpio: 19, pin: "GPIO19", signal: "USB_DN", group: "usb-service", disposition: "assigned" },
  { pad: 14, gpio: 20, pin: "GPIO20", signal: "USB_DP", group: "usb-service", disposition: "assigned" },
  { pad: 15, gpio: 3, pin: "GPIO3", signal: "NC_STRAP_QUIET", group: "reserved", disposition: "reserved-nc" },
  { pad: 16, gpio: 46, pin: "GPIO46", signal: "HUB75_CLK", group: "hub75", disposition: "assigned" },
  { pad: 17, gpio: 9, pin: "GPIO9", signal: "APP_SPI_MISO", group: "app-spi", disposition: "assigned" },
  { pad: 18, gpio: 10, pin: "GPIO10", signal: "LAMP_WHITE_RIGHT", group: "primary-output", disposition: "assigned" },
  { pad: 19, gpio: 11, pin: "GPIO11", signal: "BUZZER", group: "primary-output", disposition: "assigned" },
  { pad: 20, gpio: 12, pin: "GPIO12", signal: "APP_WD_KICK", group: "watchdog", disposition: "assigned" },
  { pad: 21, gpio: 13, pin: "GPIO13", signal: "HUB75_R1", group: "hub75", disposition: "assigned" },
  { pad: 22, gpio: 14, pin: "GPIO14", signal: "HUB75_G1", group: "hub75", disposition: "assigned" },
  { pad: 23, gpio: 21, pin: "GPIO21", signal: "HUB75_B1", group: "hub75", disposition: "assigned" },
  { pad: 24, gpio: 47, pin: "GPIO47", signal: "SOURCE_LATCH", group: "source-control", disposition: "assigned" },
  { pad: 25, gpio: 48, pin: "GPIO48", signal: "HUB75_LAT", group: "hub75", disposition: "assigned" },
  { pad: 26, gpio: 45, pin: "GPIO45", signal: "HUB75_D", group: "hub75", disposition: "assigned" },
  { pad: 27, gpio: 0, pin: "GPIO0", signal: "BOOT_N", group: "recovery", disposition: "assigned" },
  { pad: 28, gpio: 35, pin: "GPIO35", signal: "IR_RX", group: "ir-receiver", disposition: "assigned" },
  { pad: 29, gpio: 36, pin: "GPIO36", signal: "SOURCE_OE_N", group: "source-control", disposition: "assigned" },
  { pad: 30, gpio: 37, pin: "GPIO37", signal: "P0_SPARE_GPIO37", group: "reserved", disposition: "reserved" },
  { pad: 31, gpio: 38, pin: "GPIO38", signal: "HUB75_G2", group: "hub75", disposition: "assigned" },
  { pad: 32, gpio: 39, pin: "GPIO39", signal: "HUB75_B2", group: "hub75", disposition: "assigned" },
  { pad: 33, gpio: 40, pin: "GPIO40", signal: "HUB75_A", group: "hub75", disposition: "assigned" },
  { pad: 34, gpio: 41, pin: "GPIO41", signal: "HUB75_B", group: "hub75", disposition: "assigned" },
  { pad: 35, gpio: 42, pin: "GPIO42", signal: "HUB75_C", group: "hub75", disposition: "assigned" },
  { pad: 36, gpio: 44, pin: "GPIO44", signal: "UART0_RX", group: "recovery", disposition: "assigned" },
  { pad: 37, gpio: 43, pin: "GPIO43", signal: "UART0_TX", group: "recovery", disposition: "assigned" },
  { pad: 38, gpio: 2, pin: "GPIO2", signal: "ETH_CS_N", group: "app-spi", disposition: "assigned" },
  { pad: 39, gpio: 1, pin: "GPIO1", signal: "HUB75_OE_N", group: "hub75", disposition: "assigned" },
  { pad: 40, pin: "GND", signal: "APP_GND", group: "power", disposition: "ground" },
  { pad: 41, pin: "GND_EP", signal: "APP_GND", group: "power", disposition: "ground" }
] as const

const allocationDefinition = {
  task: "BP-121",
  moduleMpn: "ESP32-S3-WROOM-1-N16R2",
  architecture: "sole P0 processor running the ESP-IDF adapter and portable C17 scoring core",
  releaseState: "schematic-input-only",
  pads,
  peripheralInstances: {
    scoringAdc: "SPI3_HOST plus GDMA for one shared ADS8881",
    scoringConvst: "GPTimer0 hardware schedule; final GPIO event path is a BP-127 bench gate",
    applicationBus: "SPI2_HOST shared by W5500 and two cascaded write-only phase-control registers",
    ir: "RMT RX on GPIO35",
    usb: "native USB Serial/JTAG on GPIO19/GPIO20",
    watchdog: "GPTimer1 health epoch plus external APP_WD_KICK on GPIO12"
  },
  scoringAdc: {
    converter: "one ADS8881 behind five protected sense buffers and one TMUX1208 sense selector",
    peripheral: "dedicated SPI host plus GDMA",
    signals: ["SAR_SCLK", "SAR_DOUT", "SAR_CONVST"],
    gpio: [4, 5, 6],
    comparatorInputs: 0,
    feasibilityGate: "BP-127"
  },
  sourceControl: {
    register: "two cascaded SN74HCS595PWR phase-control registers",
    signals: ["APP_SPI_SCK", "APP_SPI_MOSI", "SOURCE_LATCH", "SOURCE_OE_N", "APP_RESET_N"],
    gpio: [18, 8, 47, 36],
    outputs: [
      "SOURCE_A0",
      "SOURCE_A1",
      "SOURCE_A2",
      "SOURCE_EN",
      "SINK_A0",
      "SINK_A1",
      "SINK_A2",
      "SINK_EN",
      "SENSE_A0",
      "SENSE_A1",
      "SENSE_A2",
      "SENSE_EN"
    ],
    safeRule:
      "APP_RESET_N clears both registers and all three active-high TMUX1208 enables, while SOURCE_OE_N is pulled high to disable every output through reset. Firmware latches one complete source/sink/sense phase before enabling it."
  },
  primaryOutputs: {
    signals: ["LAMP_RED", "LAMP_GREEN", "LAMP_WHITE_LEFT", "LAMP_WHITE_RIGHT", "BUZZER"],
    gpio: [7, 15, 17, 10, 11],
    hardwareSafeRule:
      "The protected output driver has one hardware enable held inactive by reset/watchdog circuitry; each direct GPIO input must also default inactive."
  },
  usbService: {
    receptacle: "10177070-00011LF",
    protector: "TPD2EUSB30DRTR",
    seriesResistanceOhmPerLine: 22,
    seriesResistorCount: 2,
    differentialImpedanceOhm: 90,
    matchedPairRequired: true,
    serialJtagFixedFunction: true
  },
  recovery: {
    populatedHeader: false,
    testPads: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"],
    bootRule: "Hold BOOT_N low across EN_RESET release, then release BOOT_N for ROM download mode.",
    resetRule: "Fixtures may sink EN_RESET open-drain and must never drive it high or power APP_3V3.",
    externalJtag: "not allocated; native USB and UART0 are the P0 recovery paths"
  },
  resetSafety: {
    inactivePullUpSignals: ["ETH_CS_N", "HUB75_OE_N", "BOOT_N"],
    inactivePullDownSignals: [
      "SAR_SCLK",
      "SAR_CONVST",
      "LAMP_RED",
      "LAMP_GREEN",
      "LAMP_WHITE_LEFT",
      "LAMP_WHITE_RIGHT",
      "BUZZER",
      "HUB75_R1",
      "HUB75_G1",
      "HUB75_B1",
      "HUB75_R2",
      "HUB75_G2",
      "HUB75_B2",
      "HUB75_A",
      "HUB75_B",
      "HUB75_C",
      "HUB75_D",
      "HUB75_CLK",
      "HUB75_LAT"
    ],
    strapRules: [
      "GPIO0 is pulled high and used only as BOOT_N",
      "GPIO3 remains electrically quiet and unconnected",
      "GPIO45 and GPIO46 retain reviewed reset bias for the HUB75 buffer inputs"
    ]
  },
  unavailableResources: {
    internalFlashPsramGpios: [26, 27, 28, 29, 30, 31, 32],
    rawExpansionGpios: [37],
    w5500Interrupt: "not connected; pulled inactive locally, exposed at a test point, and polled",
    isolatedResetRequest: "removed from P0",
    iso7721ReverseChannel: "removed from P0",
    moduleUnexposedGpios: [33, 34]
  },
  irReceiver: {
    signal: "IR_RX",
    modulePad: 28,
    gpio: 35,
    peripheral: "RMT_RX",
    direction: "input",
    receiverHardware: "TSOP38438",
    resetRule: "GPIO35 remains input-only through reset and boot until the IR adapter enables RMT_RX.",
    authorityRule: "Authenticated remote intent cannot fabricate, qualify, clear, or reclassify an electrical hit."
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-121 allocation cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-121 allocation may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
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
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
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

export const benchPrototypeEsp32Allocation = deepFreeze(allocationDefinition)

export function validateBenchPrototypeEsp32Allocation(input: unknown): true {
  if (!sameDataGraph(input, benchPrototypeEsp32Allocation)) {
    throw new RangeError("ESP32 allocation must exactly match the reviewed BP-121 contract")
  }
  const gpioPads = benchPrototypeEsp32Allocation.pads.filter(
    (pad): pad is Extract<(typeof pads)[number], { gpio: number }> => "gpio" in pad
  )
  const gpios = gpioPads.map((pad) => pad.gpio)
  const signals = gpioPads.map((pad) => pad.signal)
  if (
    benchPrototypeEsp32Allocation.pads.length !== 41 ||
    new Set(gpios).size !== gpios.length ||
    new Set(signals).size !== signals.length ||
    benchPrototypeEsp32Allocation.scoringAdc.gpio.join(",") !== "4,5,6" ||
    benchPrototypeEsp32Allocation.peripheralInstances.scoringAdc !== "SPI3_HOST plus GDMA for one shared ADS8881" ||
    benchPrototypeEsp32Allocation.peripheralInstances.applicationBus !==
      "SPI2_HOST shared by W5500 and two cascaded write-only phase-control registers" ||
    benchPrototypeEsp32Allocation.scoringAdc.comparatorInputs !== 0 ||
    benchPrototypeEsp32Allocation.primaryOutputs.gpio.join(",") !== "7,15,17,10,11" ||
    benchPrototypeEsp32Allocation.sourceControl.gpio.join(",") !== "18,8,47,36" ||
    benchPrototypeEsp32Allocation.sourceControl.outputs.length !== 12 ||
    benchPrototypeEsp32Allocation.unavailableResources.rawExpansionGpios.join(",") !== "37" ||
    benchPrototypeEsp32Allocation.irReceiver.gpio !== 35 ||
    benchPrototypeEsp32Allocation.irReceiver.receiverHardware !== "TSOP38438" ||
    benchPrototypeEsp32Allocation.recovery.populatedHeader ||
    benchPrototypeEsp32Allocation.releaseState !== "schematic-input-only"
  ) {
    throw new RangeError("BP-121 must retain the sole-ESP32 ADC, IR, output, recovery, and spare-pin allocation")
  }
  return true
}
