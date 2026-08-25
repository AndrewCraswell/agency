import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { findCommunicationsFootprintEvidence } from "./communications-footprint-evidence.js"
import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

export type PrototypeBomDisposition = "selected" | "TBD" | "DNP"

export type PrototypeBomSource = {
  readonly kind: "bench-prototype-power" | "component-decision" | "ethernet-support-network" | "usb-pd-footprint"
  readonly url: string
}

export type BenchPrototypeBomRow = {
  readonly reference: string
  readonly function: string
  readonly disposition: PrototypeBomDisposition
  readonly quantity: number
  readonly manufacturer?: string
  readonly mpn?: string
  readonly lifecycle?: "active" | "active-preferred" | "unresolved"
  readonly package?: string
  readonly source?: PrototypeBomSource
  readonly notes: string
}

export type BenchPrototypeExternalItem = {
  readonly itemId: "DISPLAY_PANEL"
  readonly function: string
  readonly selection: "selected-external"
  readonly quantity: 1
  readonly manufacturer: "Adafruit Industries"
  readonly productId: "2277"
  readonly productName: "64x32 RGB LED Matrix - 5mm pitch"
  readonly interface: "HUB75, 64x32, 1/16 scan"
  readonly sourceUrl: "https://www.adafruit.com/product/2277"
  readonly notes: string
}

export type BenchPrototypeBom = {
  readonly artifactKind: "bench-prototype-baseline-bom"
  readonly isOrderBom: false
  readonly fabricationRelease: false
  readonly releaseState: "deny"
  readonly rows: readonly BenchPrototypeBomRow[]
  readonly externalItems: readonly BenchPrototypeExternalItem[]
}

const packageByMpn = {
  STM32G474RET3TR: "LQFP-64, 10mm x 10mm, 0.5mm pitch",
  "ESP32-S3-WROOM-1U-N16R2": "ESP32-S3-WROOM-1U module, 18mm x 25.5mm",
  ISO7762FDWR: "SOIC-16, 10.3mm body",
  ISO7721FDR: "SOIC-8, 5.0mm body",
  NXE1S0505MC:
    "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect",
  REF5025AQDRQ1: "D SOIC-8, 5.0mm x 3.9mm body, 1.27mm pitch",
  W5500: "LQFP-48, 7mm x 7mm body, 0.5mm pitch",
  "7499011121A": "Shielded through-hole RJ45 with integrated magnetics and LEDs",
  SN74AHCT245PWR: "TSSOP-20",
  TPS3431SDRBR: "VSON-8, 2mm x 2mm",
  TPS389033DSER: "WSON-6, 1.5mm x 1.5mm",
  LMR43620MSC3RPERQ1: "VQFN-HR, 2mm x 2mm",
  "CY15B104Q-LHXIT": "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579",
  "RV-3028-C7": "SON-8, 3.0mm x 3.0mm",
  "STSAFE-A110": "SO8N, 150mil",
  TAS2505TRGERQ1: "VQFN-24, 4mm x 4mm",
  "10177070-00011LF": "Right-angle SMT USB-C receptacle, 0.80mm PCB",
  TPD4S201TRGRRQ1: "VQFN-20 (RGR), 3.5mm x 3.5mm nominal body",
  TPD2EUSB30DRTR: "SOT-9X3 (DRT), 3-pin",
  TVS2200DRVR: "WSON-6 (DRV), 2mm x 2mm",
  TPS25730ADREFR: "VQFN-38 (REF), 6mm x 4mm",
  TPS259474ARPWR: "VQFN-HR-10 (RPW), 2mm x 2mm"
} as const

const w5500FootprintEvidence = findCommunicationsFootprintEvidence("W5500")
if (
  w5500FootprintEvidence?.package !== "LQFP-48" ||
  !w5500FootprintEvidence.body.includes("7 mm x 7 mm") ||
  !w5500FootprintEvidence.body.includes("0.5 mm pitch")
) {
  throw new Error("W5500 BP-020 package must remain bound to the manufacturer footprint evidence")
}

const usbPdPackageByMpn = {
  "B340A-13-F": "SMA (DO-214AC)",
  T523H107M035APE070: "KEMET H case tantalum-polymer",
  T55A106M010C0200: "1206 (3216 metric) tantalum-polymer"
} as const

const usbPdManufacturerByMpn = {
  "B340A-13-F": "Diodes Incorporated",
  T523H107M035APE070: "KEMET",
  T55A106M010C0200: "Vishay"
} as const

const benchPowerProvenance = {
  "43045-0400": {
    manufacturer: "Molex",
    package: "Micro-Fit 3.0 right-angle 4-circuit through-hole header",
    sourceUrl: "https://www.molex.com/en-us/products/part-detail/430450400"
  },
  "7101SYZQE": {
    manufacturer: "C&K",
    package: "7000-series SPDT toggle switch",
    sourceUrl: "https://www.littelfuse.com/products/switches/toggle-switches/7000-series"
  }
} as const

type DecisionMpn = keyof typeof packageByMpn

function selectedDecisionRow(
  reference: string,
  mpn: DecisionMpn,
  functionName: string,
  notes: string,
  quantity = 1
): BenchPrototypeBomRow {
  const decision = componentDecisions.find((candidate) => candidate.mpn === mpn)
  if (decision === undefined) {
    throw new Error(`No component decision exists for ${mpn}`)
  }

  return {
    reference,
    function: functionName,
    disposition: "selected",
    quantity,
    manufacturer: decision.manufacturer,
    mpn: decision.mpn,
    lifecycle: decision.lifecycle,
    package: packageByMpn[mpn],
    source: { kind: "component-decision", url: decision.manufacturerUrl },
    notes
  }
}

type UsbPdFootprintMpn = keyof typeof usbPdPackageByMpn

function selectedUsbPdFootprintRow(
  reference: string,
  mpn: UsbPdFootprintMpn,
  functionName: string,
  notes: string
): BenchPrototypeBomRow {
  const footprint = usbPdFootprints.find((candidate) => candidate.mpn === mpn)
  if (footprint === undefined) throw new Error(`No USB-PD footprint provenance exists for ${mpn}`)
  return {
    reference,
    function: functionName,
    disposition: "selected",
    quantity: 1,
    manufacturer: usbPdManufacturerByMpn[mpn],
    mpn,
    lifecycle: "unresolved",
    package: usbPdPackageByMpn[mpn],
    source: { kind: "usb-pd-footprint", url: footprint.drawing.url },
    notes
  }
}

type BenchPowerMpn = keyof typeof benchPowerProvenance

function selectedBenchPowerRow(
  reference: string,
  mpn: BenchPowerMpn,
  functionName: string,
  notes: string
): BenchPrototypeBomRow {
  const provenance = benchPowerProvenance[mpn]
  const expectedMpn =
    mpn === "7101SYZQE"
      ? defaultBenchPrototypePowerInputs.sourceSelector.mpn
      : defaultBenchPrototypePowerInputs.labInjection.connectorMpn
  if (mpn !== expectedMpn) throw new Error(`${mpn} does not match the BP-050 power contract`)
  return {
    reference,
    function: functionName,
    disposition: "selected",
    quantity: 1,
    manufacturer: provenance.manufacturer,
    mpn,
    lifecycle: "unresolved",
    package: provenance.package,
    source: { kind: "bench-prototype-power", url: provenance.sourceUrl },
    notes
  }
}

const selectedEthernetSupportRows: readonly BenchPrototypeBomRow[] =
  ethernetSupportNetwork.supportNetworkComponents.map((component) => ({
    reference: component.reference,
    function: `W5500 support: ${component.component} ${component.value}`,
    disposition: "selected",
    quantity: 1,
    manufacturer: component.manufacturer,
    mpn: component.mpn,
    lifecycle: "active-preferred",
    package: component.package,
    source: { kind: "ethernet-support-network", url: component.sourceUrls[0] },
    notes: "Exact support-network candidate; crystal, analog supply, layout, and Ethernet bench gates remain open."
  }))

const unresolvedRows: readonly BenchPrototypeBomRow[] = [
  {
    reference: "U_ANALOG_CELL_1",
    function: "One-channel weapon acquisition and protection cell",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Populate only after the one-channel analog experiment closes topology, thresholds, clamps, and fault energy."
  },
  {
    reference: "U_ANALOG_CELL_2_TO_7",
    function: "Six replicated weapon acquisition and protection cells",
    disposition: "TBD",
    quantity: 1,
    notes: "Replication remains gated by the named seven-conductor schematic and channel-by-channel review."
  },
  {
    reference: "U_SCORING_REG",
    function: "Scoring-domain 3.3 V regulator after isolated power",
    disposition: "TBD",
    quantity: 1,
    notes: "Select after NXE1S0505MC output load, ripple, startup, and thermal measurements."
  },
  {
    reference: "U_APP_REG",
    function: "Application-domain 3.3 V regulator",
    disposition: "TBD",
    quantity: 1,
    notes:
      "The production rail candidate is not a bench-order selection until its support network and thermal envelope close."
  },
  {
    reference: "U_SCORING_WDOG",
    function: "Independent STM32 watchdog",
    disposition: "TBD",
    quantity: 1,
    notes: "Exact watchdog support is retained as a selectable prototype position pending reset-sequence review."
  },
  {
    reference: "U_APP_WDOG",
    function: "Independent ESP32 watchdog",
    disposition: "TBD",
    quantity: 1,
    notes: "Exact watchdog support is retained as a selectable prototype position pending reset-sequence review."
  },
  {
    reference: "U_SCORING_SUPERVISOR",
    function: "Scoring-domain brownout and delayed-reset supervisor",
    disposition: "TBD",
    quantity: 1,
    notes: "Select with the scoring regulator and reset timing evidence."
  },
  {
    reference: "U_APP_SUPERVISOR",
    function: "Application-domain brownout and delayed-reset supervisor",
    disposition: "TBD",
    quantity: 1,
    notes: "Select with the application regulator and reset timing evidence."
  },
  {
    reference: "U_RTC",
    function: "Wall-clock RTC",
    disposition: "TBD",
    quantity: 1,
    notes: "Storage and timestamp support remain explicit prototype positions, not selected order lines."
  },
  {
    reference: "U_SECURE_ELEMENT",
    function: "Per-device secure element",
    disposition: "TBD",
    quantity: 1,
    notes: "Provisioning is not required to validate weapon sensing, connectors, or authoritative scoring."
  },
  {
    reference: "U_AUDIO",
    function: "Diagnostic audio amplifier",
    disposition: "TBD",
    quantity: 1,
    notes: "Speaker, SPL, and enclosure are deferred; retain a position for later firmware-compatible bring-up."
  },
  {
    reference: "J_WEAPON_HARNESS",
    function: "Seven-conductor weapon and piste fixture input",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Molex 43045-1200 remains the interface candidate; connector and fixture evidence is separate from this baseline."
  },
  {
    reference: "J_HUB75",
    function: "External 13-signal HUB75 panel header",
    disposition: "TBD",
    quantity: 1,
    notes: "The panel product is selected separately; exact mating header, keying, and cable remain open."
  },
  {
    reference: "J_STM32_SWD",
    function: "STM32 Cortex-style SWD debug header",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Samtec FTSH-105-01-L-DV-007-K is a candidate with pin 7 omitted; exact footprint, pinout, keying, and mating cable remain open."
  },
  {
    reference: "J_ESP32_SERVICE",
    function: "ESP32 isolated service UART and reset header",
    disposition: "TBD",
    quantity: 1,
    notes: "Samtec TSW-106-07-G-S is a candidate; external adapter and isolation boundary remain open."
  },
  {
    reference: "J_SPEAKER",
    function: "External diagnostic speaker connector",
    disposition: "TBD",
    quantity: 1,
    notes: "Speaker and connector are not needed for the first weapon and Ethernet functional test."
  },
  {
    reference: "J_PRIMARY_OUTPUTS",
    function: "Primary scoring lamps and buzzer output harness",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Exact connector, mate, pinout, load ratings, and harness remain open until the primary-output interface task closes."
  },
  {
    reference: "R_USB_PD_STRAPS",
    function: "USB-PD capability, current, UVLO, OVLO, and timing strap network",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Required support; freeze exact orderable resistor identities and tolerance analysis before the order-candidate BOM."
  },
  {
    reference: "C_USB_PD_SUPPORT",
    function: "USB-PD VIN, raw-VBUS, CC, VBIAS, timing, and local bypass capacitors",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Required support; exact remaining capacitance, voltage, dielectric, bias derating, package, and placement must close."
  },
  {
    reference: "R_USB2_SERIES",
    function: "Native ESP32-S3 USB 2.0 D-minus and D-plus series pair",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Required service-data support; select the exact matched 22 ohm parts and retain controlled-impedance routing."
  },
  {
    reference: "U_BATTERY",
    function: "Battery or UPS subsystem",
    disposition: "DNP",
    quantity: 0,
    notes: "Explicitly deferred from the bench prototype."
  },
  {
    reference: "ANT_EXTERNAL",
    function: "ESP32 external test antenna and coax",
    disposition: "TBD",
    quantity: 1,
    notes: "Radio acceptance is deferred; Ethernet is the required wired connectivity path for this baseline."
  }
]

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

const benchPrototypeBomDefinition: BenchPrototypeBom = {
  artifactKind: "bench-prototype-baseline-bom",
  isOrderBom: false,
  fabricationRelease: false,
  releaseState: "deny",
  rows: [
    selectedDecisionRow(
      "U_SCORING",
      "STM32G474RET3TR",
      "Authoritative scoring controller",
      "Exact production-intent MCU; owns acquisition, qualification, timing, lamps, and buzzer."
    ),
    selectedDecisionRow(
      "U_APP",
      "ESP32-S3-WROOM-1U-N16R2",
      "Application and network controller",
      "Exact production-intent module; owns application services, display, Ethernet, and recovery."
    ),
    selectedDecisionRow(
      "U_ISO_MAIN",
      "ISO7762FDWR",
      "Main reinforced digital isolation",
      "Exact production-intent isolator; preserves the committed scoring/application boundary."
    ),
    selectedDecisionRow(
      "U_ISO_AUX",
      "ISO7721FDR",
      "Auxiliary reinforced digital isolation",
      "Exact production-intent isolator for the STM32 heartbeat and service-only reverse channel."
    ),
    selectedDecisionRow(
      "U_ISO_POWER",
      "NXE1S0505MC",
      "Isolated scoring-domain power",
      "Exact production-intent isolated converter; output load and local regulation remain measurement gates."
    ),
    selectedDecisionRow(
      "U_REF",
      "REF5025AQDRQ1",
      "Scoring-domain 2.5 V reference",
      "Exact production-intent reference; input/output network and dynamic-load evidence remain analog gates."
    ),
    selectedDecisionRow(
      "U_W5500",
      "W5500",
      "Dedicated 10/100 Ethernet controller",
      "Exact wired Ethernet controller on the ESP32 SPI host; MDI pairs stay on this board."
    ),
    selectedDecisionRow(
      "J_ETH",
      "7499011121A",
      "Integrated-magnetics Ethernet jack",
      "Exact board-edge Ethernet jack candidate; shield, ESD return, and EMC remain open bench gates."
    ),
    selectedDecisionRow(
      "J_USB_C",
      "10177070-00011LF",
      "USB-C PD power and native USB 2.0 service receptacle",
      "Required prototype input; exact footprint acquisition, chassis support, PD power, and USB 2.0 routing remain gates."
    ),
    selectedDecisionRow(
      "U_USB_PD",
      "TPS25730ADREFR",
      "Standalone 20 V, 3 A USB-PD sink controller",
      "Required sink-only PD path; strap decoding, PPHV copper, surge, and thermal evidence remain open."
    ),
    selectedDecisionRow(
      "U_USB_PORT_PROTECT",
      "TPD4S201TRGRRQ1",
      "USB-C CC1, CC2, SBU1, and SBU2 short-to-VBUS protection",
      "Required connector-side low-speed protection; it does not carry or protect USB D-minus or D-plus."
    ),
    selectedDecisionRow(
      "U_USB_DATA_PROTECT",
      "TPD2EUSB30DRTR",
      "Native USB 2.0 low-capacitance ESD protection",
      "Required service-data protection; the ESP32-S3 remains the native USB device."
    ),
    selectedBenchPowerRow(
      "J_LAB_INJECTION",
      "43045-0400",
      "Test-only 20 V, 2.3 A post-eFuse diagnostic injection connector",
      "Bench-only BP-050 source; not a product input and usable only with normal USB-C power de-energized and isolated by the selector."
    ),
    selectedBenchPowerRow(
      "S_POWER_SOURCE_SELECTOR",
      "7101SYZQE",
      "Hard USB-C PD versus diagnostic-injection source selector",
      "Exact SPDT mutual-exclusion selector; change only while both sources are de-energized and never connect both sources simultaneously."
    ),
    selectedDecisionRow(
      "D_USB_PD_VBUS_TVS",
      "TVS2200DRVR",
      "Connector-side 22 V VBUS transient clamp",
      "Required nominal VBUS clamp; it is not credited alone for TPS25730A chip-pin surge survival."
    ),
    selectedUsbPdFootprintRow(
      "D_USB_PD_VBUS_DISCONNECT",
      "B340A-13-F",
      "VBUS-to-ground disconnect-surge Schottky",
      "Required TPS25730A disconnect-surge path; verify cathode-band orientation against the received reel."
    ),
    selectedDecisionRow(
      "U_EFUSE",
      "TPS259474ARPWR",
      "Post-contract reverse-blocking eFuse",
      "Required 20 V power-path protection; exact current, ramp, timer, PG threshold, and thermal evidence remain gates."
    ),
    selectedUsbPdFootprintRow(
      "C_USB_PD_PPHV",
      "T523H107M035APE070",
      "TPS25730A PPHV bulk capacitor",
      "Required exact 100 uF, 35 V tantalum-polymer selection; tolerance, surge, layout, and assembly remain gates."
    ),
    selectedUsbPdFootprintRow(
      "C_USB_PD_LDO",
      "T55A106M010C0200",
      "TPS25730A 3.3 V LDO capacitor",
      "Required exact 10 uF, 10 V tantalum-polymer selection; layout and assembly remain gates."
    ),
    selectedDecisionRow(
      "U_DISPLAY_BUFFER_A",
      "SN74AHCT245PWR",
      "HUB75 signal buffer A",
      "Exact buffer identity is retained for safe blanking; panel header and current remain prototype gates."
    ),
    selectedDecisionRow(
      "U_DISPLAY_BUFFER_B",
      "SN74AHCT245PWR",
      "HUB75 signal buffer B",
      "Exact buffer identity is retained for safe blanking; panel header and current remain prototype gates."
    ),
    selectedDecisionRow(
      "U_FRAM",
      "CY15B104Q-LHXIT",
      "Event journal F-RAM",
      "Exact Infineon 8-pin TDFN orderable is selected; project footprint, orientation, placement, fabrication, and release remain denied."
    ),
    ...selectedEthernetSupportRows,
    ...unresolvedRows
  ],
  externalItems: [
    {
      itemId: "DISPLAY_PANEL",
      function: "External buffered scoring display",
      selection: "selected-external",
      quantity: 1,
      manufacturer: "Adafruit Industries",
      productId: "2277",
      productName: "64x32 RGB LED Matrix - 5mm pitch",
      interface: "HUB75, 64x32, 1/16 scan",
      sourceUrl: "https://www.adafruit.com/product/2277",
      notes:
        "External test article; purchased-panel revision, current, cable, logic thresholds, and thermal behavior remain bench gates."
    }
  ]
}

export const benchPrototypeBom = deepFreeze(benchPrototypeBomDefinition)

type ParsedBomRow = {
  reference: string
  function: string
  disposition: PrototypeBomDisposition
  quantity: number
  notes: string
  manufacturer?: string
  mpn?: string
  lifecycle?: "active" | "active-preferred" | "unresolved"
  package?: string
  sourceKind?: PrototypeBomSource["kind"]
  sourceUrl?: string
}

function assertFreshObject(value: object, path: string, seen: WeakSet<object>): void {
  if (seen.has(value)) throw new RangeError(`${path} must not contain cycles or aliases`)
  seen.add(value)
}

function assertPlainObject(value: unknown, path: string): asserts value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RangeError(`${path} must be a plain object`)
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new RangeError(`${path} must use Object.prototype`)
  }
}

function readEnumerableDataProperty(value: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
    throw new RangeError(`${path}.${key} must be an enumerable data property`)
  }
  return descriptor.value
}

function readExactPlainDataRecord(
  path: string,
  value: unknown,
  expectedKeys: readonly string[],
  seen: WeakSet<object>
): Record<string, unknown> {
  assertPlainObject(value, path)
  assertFreshObject(value, path, seen)
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
  const actualKeys = keys.filter((key): key is string => typeof key === "string").sort()
  const canonicalKeys = [...expectedKeys].sort()
  if (actualKeys.length !== canonicalKeys.length || actualKeys.some((key, index) => key !== canonicalKeys[index])) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }

  const record: Record<string, unknown> = {}
  for (const key of expectedKeys) record[key] = readEnumerableDataProperty(value, key, path)
  return record
}

function readDenseArray(
  path: string,
  value: unknown,
  expectedLength: number,
  seen: WeakSet<object>
): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new RangeError(`${path} must be a plain array`)
  }
  assertFreshObject(value, path, seen)
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value)
  ) {
    throw new RangeError(`${path}.length must be a safe integer data property`)
  }
  const length = lengthDescriptor.value
  if (length !== expectedLength) throw new RangeError(`${path}.length must be exactly ${expectedLength}`)
  const expectedKeys = Array.from({ length }, (_, index) => String(index))
    .concat("length")
    .sort()
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
  const actualKeys = keys.filter((key): key is string => typeof key === "string").sort()
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${path} must be dense and contain no extra keys`)
  }
  return Array.from({ length }, (_, index) => readEnumerableDataProperty(value, String(index), path))
}

function requiredString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${path}.${key} must be a nonblank string`)
  }
  return value
}

function readDisposition(value: unknown, path: string): PrototypeBomDisposition {
  assertPlainObject(value, path)
  const disposition = readEnumerableDataProperty(value, "disposition", path)
  if (disposition !== "selected" && disposition !== "TBD" && disposition !== "DNP") {
    throw new RangeError(`${path}.disposition must be selected, TBD, or DNP`)
  }
  return disposition
}

function assertEqual(path: string, actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match its selected provenance`)
}

function validateSelectedProvenance(row: ParsedBomRow, path: string): void {
  if (
    row.manufacturer === undefined ||
    row.mpn === undefined ||
    row.lifecycle === undefined ||
    row.package === undefined ||
    row.sourceKind === undefined ||
    row.sourceUrl === undefined
  ) {
    throw new RangeError(`${path} is missing selected provenance`)
  }
  const expected = benchPrototypeBom.rows.find((candidate) => candidate.reference === row.reference)
  if (expected === undefined || expected.disposition !== "selected" || expected.source === undefined) {
    throw new RangeError(`${path}.reference has no immutable selected provenance`)
  }
  assertEqual(`${path}.mpn`, row.mpn, expected.mpn)
  assertEqual(`${path}.manufacturer`, row.manufacturer, expected.manufacturer)
  assertEqual(`${path}.lifecycle`, row.lifecycle, expected.lifecycle)
  assertEqual(`${path}.package`, row.package, expected.package)
  assertEqual(`${path}.source.kind`, row.sourceKind, expected.source.kind)
  assertEqual(`${path}.source.url`, row.sourceUrl, expected.source.url)
}

function parseRow(value: unknown, index: number, seen: WeakSet<object>): ParsedBomRow {
  const path = `bom.rows[${index}]`
  const disposition = readDisposition(value, path)
  const baseKeys = ["reference", "function", "disposition", "quantity", "notes"] as const
  const selectedKeys = [...baseKeys, "manufacturer", "mpn", "lifecycle", "package", "source"] as const
  const record = readExactPlainDataRecord(path, value, disposition === "selected" ? selectedKeys : baseKeys, seen)
  const reference = requiredString(record, "reference", path)
  const functionName = requiredString(record, "function", path)
  const notes = requiredString(record, "notes", path)
  const quantity = record.quantity
  if (typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`${path}.quantity must be a finite non-negative safe integer`)
  }
  if (disposition === "selected" && quantity === 0) {
    throw new RangeError(`${path}.quantity must be greater than zero for a selected row`)
  }
  if (disposition === "DNP" && quantity !== 0) throw new RangeError(`${path}.quantity must be zero for a DNP row`)
  if (disposition !== "selected") return { reference, function: functionName, disposition, quantity, notes }

  const manufacturer = requiredString(record, "manufacturer", path)
  const mpn = requiredString(record, "mpn", path)
  const packageName = requiredString(record, "package", path)
  const lifecycle = record.lifecycle
  if (lifecycle !== "active" && lifecycle !== "active-preferred" && lifecycle !== "unresolved") {
    throw new RangeError(`${path}.lifecycle must be active, active-preferred, or unresolved`)
  }
  if (/\b(?:TBD|DNP)\b/i.test(mpn)) throw new RangeError(`${path}.mpn cannot be a placeholder`)
  const source = readExactPlainDataRecord(`${path}.source`, record.source, ["kind", "url"], seen)
  const sourceKind = source.kind
  if (
    sourceKind !== "bench-prototype-power" &&
    sourceKind !== "component-decision" &&
    sourceKind !== "ethernet-support-network" &&
    sourceKind !== "usb-pd-footprint"
  ) {
    throw new RangeError(`${path}.source.kind is not recognized`)
  }
  const sourceUrl = requiredString(source, "url", `${path}.source`)
  if (!sourceUrl.startsWith("https://")) throw new RangeError(`${path}.source.url must use HTTPS`)
  const parsed = {
    reference,
    function: functionName,
    disposition,
    quantity,
    notes,
    manufacturer,
    mpn,
    lifecycle,
    package: packageName,
    sourceKind,
    sourceUrl
  } satisfies ParsedBomRow
  validateSelectedProvenance(parsed, path)
  return parsed
}

function validateExternalItems(value: unknown, seen: WeakSet<object>): void {
  const items = readDenseArray("bom.externalItems", value, 1, seen)
  const path = "bom.externalItems[0]"
  const item = readExactPlainDataRecord(
    path,
    items[0],
    [
      "itemId",
      "function",
      "selection",
      "quantity",
      "manufacturer",
      "productId",
      "productName",
      "interface",
      "sourceUrl",
      "notes"
    ],
    seen
  )
  const expected = benchPrototypeBom.externalItems[0]
  if (expected === undefined) throw new RangeError("canonical external display is missing")
  for (const key of [
    "itemId",
    "function",
    "selection",
    "quantity",
    "manufacturer",
    "productId",
    "productName",
    "interface",
    "sourceUrl",
    "notes"
  ] as const) {
    assertEqual(`${path}.${key}`, item[key], expected[key])
  }
}

export function validateBenchPrototypeBom(value: unknown): true {
  try {
    const seen = new WeakSet<object>()
    const bom = readExactPlainDataRecord(
      "bom",
      value,
      ["artifactKind", "isOrderBom", "fabricationRelease", "releaseState", "rows", "externalItems"],
      seen
    )
    assertEqual("bom.artifactKind", bom.artifactKind, "bench-prototype-baseline-bom")
    assertEqual("bom.isOrderBom", bom.isOrderBom, false)
    assertEqual("bom.fabricationRelease", bom.fabricationRelease, false)
    assertEqual("bom.releaseState", bom.releaseState, "deny")
    const rows = readDenseArray("bom.rows", bom.rows, benchPrototypeBom.rows.length, seen)

    const references = new Set<string>()
    const parsedRows = rows.map((row, index) => {
      const parsed = parseRow(row, index, seen)
      if (references.has(parsed.reference)) throw new RangeError(`${parsed.reference} is assigned more than once`)
      references.add(parsed.reference)
      return parsed
    })
    for (const expected of benchPrototypeBom.rows) {
      const parsed = parsedRows.find((candidate) => candidate.reference === expected.reference)
      if (
        parsed === undefined ||
        parsed.function !== expected.function ||
        parsed.disposition !== expected.disposition ||
        parsed.quantity !== expected.quantity ||
        parsed.notes !== expected.notes ||
        parsed.mpn !== expected.mpn
      ) {
        throw new RangeError(`${expected.reference} does not match the canonical baseline row`)
      }
    }
    validateExternalItems(bom.externalItems, seen)
    return true
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError("bench prototype BOM could not be validated safely")
  }
}

validateBenchPrototypeBom(benchPrototypeBom)
