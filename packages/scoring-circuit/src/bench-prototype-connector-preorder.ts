type Component = { readonly manufacturer: string; readonly mpn: string; readonly quantity: number }
type Measurement = { readonly id: string; readonly from: string; readonly to: string }

const component = (manufacturer: string, mpn: string, quantity: number): Component => ({ manufacturer, mpn, quantity })
const measurement = (id: string, from: string, to: string): Measurement => ({ id, from, to })

export type BenchPrototypeConnectorSampleId =
  | "usb-c-input"
  | "weapon-sockets"
  | "ethernet-magjack"
  | "hub75-signal"
  | "hub75-panel-power"

const samples = [
  {
    id: "usb-c-input",
    interfaceReferences: ["J_USB_C"],
    requiredComponents: [
      component("Amphenol Communications Solutions", "10177070-00011LF", 1),
      component("StarTech.com", "USB2CC1M", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      "A1",
      "A4",
      "A5",
      "A6",
      "A7",
      "A8",
      "A9",
      "A12",
      "B1",
      "B4",
      "B5",
      "B6",
      "B7",
      "B8",
      "B9",
      "B12"
    ].map((pin) => measurement(pin, `J_USB_C.${pin}`, `SELECTED_USB_C_CABLE.${pin}`))
  },
  {
    id: "weapon-sockets",
    interfaceReferences: ["P_WEAPON_L_A/B/C", "P_WEAPON_R_A/B/C"],
    requiredComponents: [],
    selectionState: "blocked",
    selectionBlocker:
      "Owner-validated OK Fencing sockets may be wired to labeled board landings for P0; record the exact socket identity, dimensions, and strain-relief assembly after receipt.",
    continuityMeasurements: []
  },
  {
    id: "ethernet-magjack",
    interfaceReferences: ["J_ETH"],
    requiredComponents: [
      component("Würth Elektronik", "7499011121A", 1),
      component("Eaton, Tripp Lite series", "N201-003-BL", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      ...Array.from({ length: 8 }, (_, index) =>
        measurement(`8p8c-contact-${index + 1}`, `J_ETH.8P8C-${index + 1}`, `TEST_MATE.8P8C-${index + 1}`)
      ),
      measurement("shield-shell", "J_ETH.SHIELD_SHELL[CHASSIS_ETHERNET]", "CHASSIS_ETHERNET")
    ]
  },
  {
    id: "hub75-signal",
    interfaceReferences: ["J_HUB75"],
    requiredComponents: [
      component("Samtec", "TST-108-04-G-D-RA", 1),
      component("Adafruit Industries", "4170", 1),
      component("Adafruit Industries", "2277", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: [
      "R1",
      "G1",
      "B1",
      "GND1",
      "R2",
      "G2",
      "B2",
      "GND2",
      "A",
      "B",
      "C",
      "D",
      "CLK",
      "LAT",
      "OE",
      "GND3"
    ].map((net, index) =>
      measurement(`pin-${index + 1}`, `J_HUB75.${index + 1}[${net}]`, `Adafruit-4170.${index + 1}[${net}]`)
    )
  },
  {
    id: "hub75-panel-power",
    interfaceReferences: ["J_DISPLAY_POWER_PIGTAIL"],
    requiredComponents: [
      component("Adafruit Industries", "4767", 1),
      component("JST", "SMR-04V-N", 2),
      component("JST", "SYM-001T-P0.6", 8),
      component("JST", "SMP-04V-NC", 2),
      component("JST", "SHF-001T-0.8BS", 8),
      component("Adafruit Industries", "2277", 1)
    ],
    selectionState: "exact",
    selectionBlocker: null,
    continuityMeasurements: Array.from({ length: 2 }, (_, branch) =>
      ["V5_DISPLAY_LIMITED", "V5_DISPLAY_LIMITED", "APP_GND", "APP_GND"].map((net, pin) =>
        measurement(
          `branch-${branch + 1}-pin-${pin + 1}`,
          `J_DISPLAY_POWER_PIGTAIL.branch-${branch + 1}.${pin + 1}[${net}]`,
          `Adafruit-4767.branch-${branch + 1}.${pin + 1}[${net}]`
        )
      )
    ).flat()
  }
] as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-034 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("BP-034 allows data only")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const benchPrototypeConnectorPreorder = deepFreeze({
  artifactKind: "bench-prototype-connector-preorder-contract",
  workUnit: "BP-034",
  targetAssembly: "minimal ESP32-only P0",
  samples,
  removedInterfaces: ["J_LAB_INJECTION", "J_STM_SWD", "J_ESP_SERVICE"],
  fabricationDisposition: "DENY",
  releaseState: "deny"
})

export const benchPrototypeWeaponPanelHarness = deepFreeze({
  artifactKind: "bench-prototype-custom-weapon-panel-harness-contract",
  workUnit: "BP-034",
  targetAssembly: "per-side custom three-socket prototype weapon interface",
  prototypeOnly: true,
  cableCompatibility: {
    supplier: "OK Fencing",
    status: "owner-validated-not-a-blocker",
    scope: "Existing market-compatible three-pin weapon cable; board landing and socket assembly remain P0 work."
  },
  ownerReferencePhotos: [
    "docs/evidence/bp-034/owner-weapon-socket-reference-1.jpg",
    "docs/evidence/bp-034/owner-weapon-socket-reference-2.jpg"
  ],
  perPanelCircuitOrder: ["A", "B", "C"],
  prototypeImplementation: "wire three individual insulated sockets to labeled plated through-holes and test pads",
  requiredEvidence: [
    "exact received socket identity and dimensions",
    "independent strain relief so solder joints do not carry insertion load",
    "de-energized continuity, isolation, open, swap, and reversal results"
  ],
  fabricationDisposition: "DENY",
  releaseState: "deny"
})

export function validateBenchPrototypeWeaponPanelHarness(value: unknown): true {
  if (value !== benchPrototypeWeaponPanelHarness) {
    throw new RangeError("BP-034 weapon panel harness must use the canonical owner-approved P0 contract")
  }
  const contract = benchPrototypeWeaponPanelHarness
  if (
    contract.cableCompatibility.status !== "owner-validated-not-a-blocker" ||
    contract.perPanelCircuitOrder.join(",") !== "A,B,C" ||
    contract.fabricationDisposition !== "DENY" ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-034 weapon interface must retain its accepted cable and denied fabrication gates")
  }
  return true
}

export function validateBenchPrototypeConnectorPreorder(value: unknown): true {
  if (value !== benchPrototypeConnectorPreorder) {
    throw new RangeError("BP-034 connector preorder must use its canonical object")
  }
  const contract = benchPrototypeConnectorPreorder
  if (
    contract.samples.length !== 5 ||
    contract.samples.some((sample) => ["lab-injection", "stm32-service", "esp32-service"].includes(sample.id)) ||
    contract.samples[0]?.requiredComponents[0]?.mpn !== "10177070-00011LF" ||
    contract.samples[2]?.requiredComponents[0]?.mpn !== "7499011121A" ||
    contract.samples[1]?.selectionState !== "blocked" ||
    contract.fabricationDisposition !== "DENY" ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-034 must retain only the five minimal P0 connector families")
  }
  return true
}
