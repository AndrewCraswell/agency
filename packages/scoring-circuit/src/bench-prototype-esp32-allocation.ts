/**
 * BP-121: exact application-processor module-pad allocation.
 *
 * This contract freezes the ESP32-S3-WROOM-1U-N16R2 allocation for schematic
 * capture. It is not a routed-layout, signal-integrity, RF, or fabrication
 * release.
 */

export type Esp32PadDisposition = "assigned" | "ground" | "power" | "reserved-nc" | "reset"

const allocationDefinition = {
  task: "BP-121",
  moduleMpn: "ESP32-S3-WROOM-1U-N16R2",
  releaseState: "schematic-input-only",
  pads: [
    { pad: 1, pin: "GND", signal: "APP_GND", group: "power", disposition: "ground" },
    { pad: 2, pin: "3V3", signal: "APP_3V3", group: "power", disposition: "power" },
    { pad: 3, pin: "EN", signal: "EN_RESET", group: "recovery", disposition: "reset" },
    { pad: 4, gpio: 4, pin: "GPIO4", signal: "SCORE_SCK", group: "isolated-spi", disposition: "assigned" },
    { pad: 5, gpio: 5, pin: "GPIO5", signal: "SCORE_MOSI", group: "isolated-spi", disposition: "assigned" },
    { pad: 6, gpio: 6, pin: "GPIO6", signal: "SCORE_MISO", group: "isolated-spi", disposition: "assigned" },
    { pad: 7, gpio: 7, pin: "GPIO7", signal: "SCORE_CS_N", group: "isolated-spi", disposition: "assigned" },
    {
      pad: 8,
      gpio: 15,
      pin: "GPIO15",
      signal: "ESP32_HEARTBEAT",
      group: "watchdog-heartbeat",
      disposition: "assigned"
    },
    { pad: 9, gpio: 16, pin: "GPIO16", signal: "HUB75_R2", group: "hub75", disposition: "assigned" },
    {
      pad: 10,
      gpio: 17,
      pin: "GPIO17",
      signal: "STM32_HEARTBEAT",
      group: "watchdog-heartbeat",
      disposition: "assigned"
    },
    { pad: 11, gpio: 18, pin: "GPIO18", signal: "APP_SPI_SCK", group: "app-spi", disposition: "assigned" },
    { pad: 12, gpio: 8, pin: "GPIO8", signal: "APP_SPI_MOSI", group: "app-spi", disposition: "assigned" },
    { pad: 13, gpio: 19, pin: "GPIO19", signal: "USB_DN", group: "usb-service", disposition: "assigned" },
    { pad: 14, gpio: 20, pin: "GPIO20", signal: "USB_DP", group: "usb-service", disposition: "assigned" },
    {
      pad: 15,
      gpio: 3,
      pin: "GPIO3",
      signal: "NC_STRAP_QUIET",
      group: "reserved",
      disposition: "reserved-nc"
    },
    { pad: 16, gpio: 46, pin: "GPIO46", signal: "HUB75_CLK", group: "hub75", disposition: "assigned" },
    { pad: 17, gpio: 9, pin: "GPIO9", signal: "APP_SPI_MISO", group: "app-spi", disposition: "assigned" },
    { pad: 18, gpio: 10, pin: "GPIO10", signal: "I2C_SDA", group: "i2c", disposition: "assigned" },
    { pad: 19, gpio: 11, pin: "GPIO11", signal: "I2C_SCL", group: "i2c", disposition: "assigned" },
    {
      pad: 20,
      gpio: 12,
      pin: "GPIO12",
      signal: "APP_WD_KICK",
      group: "watchdog-heartbeat",
      disposition: "assigned"
    },
    { pad: 21, gpio: 13, pin: "GPIO13", signal: "HUB75_R1", group: "hub75", disposition: "assigned" },
    { pad: 22, gpio: 14, pin: "GPIO14", signal: "HUB75_G1", group: "hub75", disposition: "assigned" },
    { pad: 23, gpio: 21, pin: "GPIO21", signal: "HUB75_B1", group: "hub75", disposition: "assigned" },
    { pad: 24, gpio: 47, pin: "GPIO47", signal: "FRAM_CS_N", group: "app-spi", disposition: "assigned" },
    { pad: 25, gpio: 48, pin: "GPIO48", signal: "HUB75_LAT", group: "hub75", disposition: "assigned" },
    { pad: 26, gpio: 45, pin: "GPIO45", signal: "HUB75_D", group: "hub75", disposition: "assigned" },
    { pad: 27, gpio: 0, pin: "GPIO0", signal: "BOOT_N", group: "recovery", disposition: "assigned" },
    { pad: 28, gpio: 35, pin: "GPIO35", signal: "I2S_BCLK", group: "i2s", disposition: "assigned" },
    { pad: 29, gpio: 36, pin: "GPIO36", signal: "I2S_WS", group: "i2s", disposition: "assigned" },
    { pad: 30, gpio: 37, pin: "GPIO37", signal: "I2S_DOUT", group: "i2s", disposition: "assigned" },
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
  ],
  usbService: {
    receptacle: "10177070-00011LF",
    protector: "TPD2EUSB30DRTR",
    ccSbuProtectorExcludedFromDataPair: "TPD4S201TRGRRQ1",
    seriesResistanceOhmPerLine: 22,
    seriesResistorCount: 2,
    differentialImpedanceOhm: 90,
    matchedPairRequired: true,
    serialJtagFixedFunction: true
  },
  recovery: {
    header: "TSW-106-07-G-S",
    signals: ["UART0_RX", "UART0_TX", "BOOT_N", "MANUAL_RESET_ASSERT", "APP_3V3_SENSE", "APP_GND"],
    bootRule: "BOOT_N may be pulled low only while EN_RESET is asserted",
    resetRule: "MANUAL_RESET_ASSERT drives a BSS138 open-drain sink; the header must not directly drive EN_RESET",
    externalJtag: "not allocated; GPIO39 through GPIO42 remain HUB75 signals; do not burn JTAG-selection eFuses"
  },
  resetSafety: {
    inactivePullUpSignals: ["SCORE_CS_N", "ETH_CS_N", "FRAM_CS_N", "HUB75_OE_N", "BOOT_N"],
    inactivePullDownSignals: [
      "ESP32_HEARTBEAT",
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
      "GPIO45 and GPIO46 retain weak pull-downs and see high-impedance AHCT inputs during reset"
    ]
  },
  unavailableResources: {
    internalFlashPsramGpios: [26, 27, 28, 29, 30, 31, 32],
    rawExpansionGpios: [],
    w5500Interrupt: "not connected; pulled inactive locally, exposed at a test point, and polled",
    isolatedResetRequest: "not a GPIO; RESET_REQUEST crosses ISO7762FDWR and drives a BSS138 sink on EN_RESET",
    iso7721ReverseChannel: "service-only NC; never connected to STM32 NRST"
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("Canonical BP-121 allocation cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-121 allocation may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

function isPlainRecord(value: object): boolean {
  return Object.getPrototypeOf(value) === Object.prototype
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  seenActual: WeakSet<object>,
  seenExpected: WeakSet<object>
): boolean {
  if (typeof actual !== "object" || actual === null || typeof expected !== "object" || expected === null) {
    return Object.is(actual, expected)
  }
  if (seenActual.has(actual) || seenExpected.has(expected)) return false
  seenActual.add(actual)
  seenExpected.add(expected)
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => typeof key === "symbol")) return false
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
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seenActual, seenExpected)
    )
  })
}

export const benchPrototypeEsp32Allocation = deepFreeze(allocationDefinition)

/** Rejects omissions, substitutions, GPIO reuse, or relaxation of BP-121. */
export function validateBenchPrototypeEsp32Allocation(input: unknown): true {
  if (!sameDataGraph(input, benchPrototypeEsp32Allocation, new WeakSet<object>(), new WeakSet<object>())) {
    throw new RangeError("ESP32 allocation must exactly match the reviewed BP-121 contract")
  }

  const contract = benchPrototypeEsp32Allocation
  const pads = contract.pads
  const gpioPads = pads.filter((pad): pad is Extract<(typeof pads)[number], { gpio: number }> => "gpio" in pad)
  const internalFlashPsramGpios: readonly number[] = contract.unavailableResources.internalFlashPsramGpios
  const assignedSignals = gpioPads.filter((pad) => pad.disposition === "assigned").map((pad) => pad.signal)
  const expectedGroups = {
    "isolated-spi": ["SCORE_SCK", "SCORE_MOSI", "SCORE_MISO", "SCORE_CS_N"],
    "app-spi": ["APP_SPI_SCK", "APP_SPI_MOSI", "APP_SPI_MISO", "ETH_CS_N", "FRAM_CS_N"],
    "usb-service": ["USB_DN", "USB_DP"],
    i2c: ["I2C_SDA", "I2C_SCL"],
    i2s: ["I2S_BCLK", "I2S_WS", "I2S_DOUT"],
    recovery: ["BOOT_N", "UART0_RX", "UART0_TX"],
    "watchdog-heartbeat": ["ESP32_HEARTBEAT", "STM32_HEARTBEAT", "APP_WD_KICK"],
    hub75: [
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
      "HUB75_LAT",
      "HUB75_OE_N"
    ]
  } as const

  if (
    contract.moduleMpn !== "ESP32-S3-WROOM-1U-N16R2" ||
    contract.releaseState !== "schematic-input-only" ||
    pads.length !== 41 ||
    !pads.every((pad, index) => pad.pad === index + 1) ||
    new Set(gpioPads.map((pad) => pad.gpio)).size !== gpioPads.length ||
    new Set(assignedSignals).size !== assignedSignals.length
  ) {
    throw new RangeError("BP-121 must retain the exact N16R2 41-pad allocation without GPIO or signal reuse")
  }

  for (const [group, signals] of Object.entries(expectedGroups)) {
    const actual = gpioPads
      .filter((pad) => pad.group === group && pad.disposition === "assigned")
      .map((pad) => pad.signal)
    if (actual.length !== signals.length || !signals.every((signal) => actual.includes(signal))) {
      throw new RangeError(`BP-121 ${group} allocation changed`)
    }
  }

  const usbDn = gpioPads.find((pad) => pad.signal === "USB_DN")
  const usbDp = gpioPads.find((pad) => pad.signal === "USB_DP")
  if (
    usbDn?.gpio !== 19 ||
    usbDp?.gpio !== 20 ||
    contract.usbService.protector !== "TPD2EUSB30DRTR" ||
    contract.usbService.ccSbuProtectorExcludedFromDataPair !== "TPD4S201TRGRRQ1" ||
    contract.usbService.seriesResistanceOhmPerLine !== 22 ||
    contract.usbService.seriesResistorCount !== 2 ||
    !contract.usbService.matchedPairRequired
  ) {
    throw new RangeError("Native USB2 must retain its exact protected, matched GPIO19/GPIO20 service path")
  }

  if (
    gpioPads.find((pad) => pad.gpio === 3)?.disposition !== "reserved-nc" ||
    gpioPads.some((pad) => internalFlashPsramGpios.includes(pad.gpio)) ||
    contract.unavailableResources.rawExpansionGpios.length !== 0 ||
    !contract.recovery.externalJtag.includes("not allocated") ||
    !contract.unavailableResources.isolatedResetRequest.includes("not a GPIO")
  ) {
    throw new RangeError("Reserved, internal, reset-request, and unallocated resources changed")
  }

  return true
}
