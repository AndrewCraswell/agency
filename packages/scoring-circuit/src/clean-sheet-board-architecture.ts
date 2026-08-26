export const prototypeCarrierArchitecture = {
  title: "ESP32 fencing scoring firmware carrier",
  entryPoint: "packages/scoring-circuit/src/index.circuit.tsx",
  board: {
    widthMm: 250,
    heightMm: 180,
    layerCount: 4
  },
  purchasedModules: ["WIZ850io Ethernet", "DEV-15801 USB-C PD sink", "D36V50F5 5 V regulator"],
  customSections: [
    "ESP32-S3 and USB recovery",
    "seven-conductor scoring acquisition",
    "weapon and piste landings",
    "HUB75 buffers and connector",
    "IR receiver",
    "lamp and buzzer outputs"
  ],
  excludedFromPrototype: [
    "STM32 scoring processor",
    "external ESP32 supervisor or watchdog",
    "discrete Ethernet PHY and connector circuitry",
    "discrete USB-C PD and 20 V to 5 V conversion",
    "production telemetry and optional peripherals",
    "production certification and cost optimization"
  ]
} as const
