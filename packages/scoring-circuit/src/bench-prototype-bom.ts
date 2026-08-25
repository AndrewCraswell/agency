import { benchPrototypeApplicationRail } from "./bench-prototype-application-rail.js"
import { benchPrototypeIrReceiverSelection } from "./bench-prototype-ir-receiver-selection.js"
import { benchPrototypeP0Power } from "./bench-prototype-p0-power.js"
import { findCommunicationsFootprintEvidence } from "./communications-footprint-evidence.js"
import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"
import { usbPdFootprints } from "./usb-pd-footprints.js"

export type PrototypeBomDisposition = "selected" | "TBD" | "DNP"

export type PrototypeBomSource = {
  readonly kind:
    | "bench-prototype-power"
    | "application-rail"
    | "component-decision"
    | "ethernet-support-network"
    | "hub75-connector"
    | "ir-receiver-selection"
    | "processor-support"
    | "usb-pd-footprint"
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
  TPS56A37RPAR: "VQFN-HR-21 (RPA), 3.0mm x 3.0mm",
  "10177070-00011LF": "Right-angle SMT USB-C receptacle, 0.80mm PCB",
  TPD4S201TRGRRQ1: "VQFN-20 (RGR), 3.5mm x 3.5mm nominal body",
  TPD2EUSB30DRTR: "SOT-9X3 (DRT), 3-pin",
  TVS2200DRVR: "WSON-6 (DRV), 2mm x 2mm",
  TPS25730ADREFR: "VQFN-38 (REF), 6mm x 4mm",
  TPS259474ARPWR: "VQFN-HR-10 (RPW), 2mm x 2mm"
} as const

function selectedSupportRow(
  reference: string,
  functionName: string,
  manufacturer: string,
  mpn: string,
  packageName: string,
  sourceUrl: string,
  notes: string,
  quantity = 1,
  sourceKind: PrototypeBomSource["kind"] = "processor-support"
): BenchPrototypeBomRow {
  return {
    reference,
    function: functionName,
    disposition: "selected",
    quantity,
    manufacturer,
    mpn,
    lifecycle: "active-preferred",
    package: packageName,
    source: { kind: sourceKind, url: sourceUrl },
    notes
  }
}

function dnpRow(reference: string, functionName: string, notes: string): BenchPrototypeBomRow {
  return {
    reference,
    function: functionName,
    disposition: "DNP",
    quantity: 0,
    notes
  }
}

function selectedIrRow(
  reference: string,
  functionName: string,
  manufacturer: string,
  mpn: string,
  packageName: string,
  sourceUrl: string,
  notes: string
): BenchPrototypeBomRow {
  return {
    reference,
    function: functionName,
    disposition: "selected",
    quantity: 1,
    manufacturer,
    mpn,
    lifecycle: "active",
    package: packageName,
    source: { kind: "ir-receiver-selection", url: sourceUrl },
    notes
  }
}

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

const selectedUsbSupportRows: readonly BenchPrototypeBomRow[] = [
  ...benchPrototypeP0Power.upstreamSupport.pdStraps.map((part) =>
    selectedSupportRow(
      part.reference,
      `USB-PD controller strap, ${part.valueOhms} Ohm ${part.tolerancePct}%`,
      part.manufacturer,
      part.mpn,
      part.package,
      part.sourceUrl,
      "Required by the selected TPS25730A 20 V/3 A sink configuration; this is not an optional feature.",
      part.quantity,
      "bench-prototype-power"
    )
  ),
  ...benchPrototypeP0Power.upstreamSupport.pdSupportCapacitors.map((part) =>
    selectedSupportRow(
      part.reference,
      `USB-C/PD local support, ${part.value} ${part.rating}`,
      part.manufacturer,
      part.mpn,
      part.package,
      part.sourceUrl,
      "Required local bypass or protected-CC support for the selected USB-C/PD chain; placement and effective capacitance remain layout gates.",
      part.quantity,
      "bench-prototype-power"
    )
  ),
  ...benchPrototypeP0Power.upstreamSupport.usbSeriesPair.map((part) =>
    selectedSupportRow(
      part.reference,
      `Native ESP32-S3 USB series damping, ${part.valueOhms} Ohm ${part.tolerancePct}%`,
      part.manufacturer,
      part.mpn,
      part.package,
      part.sourceUrl,
      "Required matched USB D-minus/D-plus series part; place at the ESP32 and retain controlled-impedance routing.",
      part.quantity,
      "bench-prototype-power"
    )
  )
]

const selectedEfuseSupportRows: readonly BenchPrototypeBomRow[] =
  benchPrototypeP0Power.upstreamSupport.efuseSupport.map((part) =>
    selectedSupportRow(
      part.reference,
      `${part.function}, ${part.value}`,
      part.manufacturer,
      part.mpn,
      part.package,
      part.sourceUrl,
      "Required by the selected TPS259474A protection configuration; PG and PGTH remain unused and unpopulated.",
      1,
      "bench-prototype-power"
    )
  )

const selectedV5SupportRows: readonly BenchPrototypeBomRow[] = benchPrototypeP0Power.v5Stage.supportParts.map((part) =>
  selectedSupportRow(
    part.reference,
    `${part.function}, ${part.value}`,
    part.manufacturer,
    part.mpn,
    part.package,
    part.sourceUrl,
    "Required by the selected TPS56A37 5 V implementation; exact placement, effective capacitance, thermal, and load-step evidence remain open.",
    1,
    "bench-prototype-power"
  )
)

const applicationRailMetadata = {
  LMR43620MSC3RPERQ1: {
    package: "VQFN-HR RPE, 2 mm x 2 mm",
    sourceUrl: "https://www.ti.com/product/LMR43620-Q1/part-details/LMR43620MSC3RPERQ1"
  },
  "XGL4030-222MEC": {
    package: "XGL4030, 4 mm x 4 mm x 3 mm molded power inductor",
    sourceUrl: "https://www.coilcraft.com/en-us/products/power/shielded-inductors/molded-inductor/xgl/xgl4030/"
  },
  C2012X7R1E475K125AB: {
    package: "0805 (2012 metric)",
    sourceUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7R1E475K125AB"
  },
  C0603C104K3RACTU: {
    package: "0603 (1608 metric)",
    sourceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU"
  },
  "885012206052": {
    package: "0603 (1608 metric)",
    sourceUrl: "https://www.we-online.com/components/products/datasheet/885012206052.pdf"
  },
  C2012X7S1A226M125AC: {
    package: "0805 (2012 metric)",
    sourceUrl: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7S1A226M125AC"
  },
  "RC0603FR-071KL": {
    package: "0603 (1608 metric)",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-071KL"
  }
} as const

const selectedApplicationRailRows: readonly BenchPrototypeBomRow[] =
  benchPrototypeApplicationRail.topology.supportParts.flatMap((part) =>
    part.references.map((reference) => {
      const metadata = applicationRailMetadata[part.mpn]
      return selectedSupportRow(
        reference,
        `Application 3.3 V rail: ${part.value}`,
        part.manufacturer,
        part.mpn,
        metadata.package,
        metadata.sourceUrl,
        `Required by the sole APP_3V3 implementation. ${part.connection}`,
        1,
        "application-rail"
      )
    })
  )

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
  dnpRow(
    "U_SCORING_REG",
    "Superseded isolated scoring-domain regulator",
    "Removed with the STM32 and isolated scoring-power domain."
  ),
  dnpRow("U_SCORING_WDOG", "Superseded STM32 watchdog", "Removed with the STM32 processor domain."),
  dnpRow("U_SCORING_SUPERVISOR", "Superseded STM32 brownout supervisor", "Removed with the STM32 processor domain."),
  dnpRow("U_RTC", "Wall-clock RTC", "Removed from P0; monotonic scoring time does not require wall-clock hardware."),
  dnpRow(
    "U_SECURE_ELEMENT",
    "Per-device secure element",
    "Removed from P0; encrypted-remote identity uses ESP32 eFuses and encrypted NVS."
  ),
  dnpRow("U_AUDIO", "Diagnostic audio amplifier", "Removed from P0; the primary buzzer path supplies audible output."),
  dnpRow(
    "J_WEAPON_HARNESS",
    "Prototype weapon harness connector",
    "No orderable connector is populated on P0; the owner-approved OK Fencing socket pigtails solder into six labeled plated-through landing holes with separate strain relief."
  ),
  dnpRow("J_STM32_SWD", "Superseded STM32 SWD header", "Removed with the STM32; native USB and ESP32 recovery remain."),
  {
    reference: "J_ESP32_SERVICE",
    function: "Superseded populated ESP32 service header",
    disposition: "DNP",
    quantity: 0,
    notes: "Use native USB plus labeled UART0, BOOT_N, EN_RESET, APP_3V3, and APP_GND test pads for P0 recovery."
  },
  dnpRow("J_SPEAKER", "External diagnostic speaker connector", "Removed with the P0 audio amplifier."),
  {
    reference: "U_PRIMARY_OUTPUT_DRIVER",
    function: "Primary lamp and buzzer load driver",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Exact MPN remains TBD until the lamp/buzzer voltage, steady and inrush current, fault, common-return, cable, thermal, and EMC envelope is defined. Hardware permit must default every channel non-energizing; firmware-only safing is prohibited."
  },
  {
    reference: "J_PRIMARY_OUTPUTS",
    function: "Primary scoring lamps and buzzer output harness",
    disposition: "TBD",
    quantity: 1,
    notes:
      "Existing Molex 39-29-1067 evidence is a six-position candidate with circuits 1 to 5 for primary outputs and circuit 6 for return. It remains TBD because lamp/buzzer voltage, current, fault, common-return, cable, thermal, and EMC requirements are unbounded."
  },
  ...selectedUsbSupportRows,
  {
    reference: "U_BATTERY",
    function: "Battery or UPS subsystem",
    disposition: "DNP",
    quantity: 0,
    notes: "Explicitly deferred from the bench prototype."
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
    dnpRow(
      "U_SCORING",
      "Superseded STM32 scoring controller",
      "Removed from P0; the portable C17 core runs behind an ESP32 target adapter."
    ),
    selectedSupportRow(
      "U_APP",
      "Sole P0 scoring and application controller",
      "Espressif Systems",
      "ESP32-S3-WROOM-1-N16R2",
      "ESP32-S3-WROOM-1 module, 18mm x 25.5mm x 3.1mm, 40 perimeter terminals plus EPAD",
      "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
      "Runs the target adapter and portable C17 core plus Ethernet, IR, display, USB, persistence, and recovery services. The integrated PCB antenna requires the BP-120 placement clearance and final-product RF verification."
    ),
    selectedSupportRow(
      "R_ESP_BOOT_PULLUP",
      "ESP32 GPIO0 boot-mode pull-up",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Required to keep GPIO0 out of the ROM download mode unless the recovery fixture deliberately pulls it low."
    ),
    selectedSupportRow(
      "R_ESP_EN_PULLUP",
      "ESP32 enable/reset pull-up",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Required open-drain reset bias; supervisor, watchdog, manual reset, and recovery fixture may only pull EN low."
    ),
    selectedSupportRow(
      "C_ESP_EN_DELAY",
      "ESP32 enable/reset delay capacitor",
      "TDK",
      "C1608X5R1A105K080AC",
      "0603 (1608 metric)",
      "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/0000?part_no=C1608X5R1A105K080AC",
      "Required 1 uF EN capacitor; release timing must be verified with the final supervisor and 3.3 V rail."
    ),
    selectedSupportRow(
      "C_ESP_3V3_HF",
      "ESP32 local high-frequency bypass",
      "Murata",
      "GCM188R71H104KA57D",
      "0603 (1608 metric)",
      "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D",
      "Required 100 nF local module bypass; place at the ESP32 3.3 V entry with a direct APP_GND return."
    ),
    selectedSupportRow(
      "C_ESP_3V3_BULK",
      "ESP32 local bulk decoupling",
      "Murata",
      "GCM32EC71A476KE02L",
      "1210 (3225 metric)",
      "https://www.murata.com/en-us/products/productdetail?partno=GCM32EC71A476KE02L",
      "Required 47 uF nominal local reservoir; effective capacitance and rail transient behavior remain BP-125 evidence gates."
    ),
    selectedDecisionRow(
      "U_APP_SUPERVISOR",
      "TPS389033DSER",
      "Single 3.3 V brownout and delayed-reset supervisor",
      "Required independent rail-fault reset source for the sole ESP32 domain; its open-drain output joins APP_RESET_N."
    ),
    selectedDecisionRow(
      "U_APP_WDOG",
      "TPS3431SDRBR",
      "Single external ESP32 health watchdog",
      "Required to reset the sole controller when acquisition, queues, reference, outputs, rails, or the scoring loop stop producing a valid health token."
    ),
    selectedSupportRow(
      "C_APP_SUPERVISOR_CT_AND_BYPASS",
      "Supervisor delay and local bypass capacitors",
      "KEMET",
      "C0603C104K3RACTU",
      "0603 (1608 metric)",
      "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU",
      "Two required 100 nF parts: one sets the supervisor delay and one bypasses its 3.3 V supply.",
      2
    ),
    selectedSupportRow(
      "C_APP_WDOG_BYPASS",
      "External-watchdog local bypass",
      "KEMET",
      "C0603C104K3RACTU",
      "0603 (1608 metric)",
      "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU",
      "Required 100 nF local bypass at the watchdog supply."
    ),
    selectedSupportRow(
      "R_APP_WDOG_TIMEOUT",
      "External-watchdog timeout selection",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Required exact 10 kOhm timeout-selection resistor for the reviewed watchdog interval."
    ),
    selectedSupportRow(
      "R_APP_WDI_PULLUP",
      "External-watchdog input default",
      "Yageo",
      "RC0603FR-07100KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
      "Required 100 kOhm WDI bias so reset and absent-firmware states cannot generate valid watchdog edges."
    ),
    dnpRow("U_ISO_MAIN", "Superseded main processor isolator", "Removed because P0 has one processor domain."),
    dnpRow("U_ISO_AUX", "Superseded auxiliary processor isolator", "Removed because P0 has one processor domain."),
    dnpRow("U_ISO_POWER", "Superseded isolated processor-link power", "Removed because P0 has one processor domain."),
    dnpRow(
      "U_ANALOG_ISO_POWER",
      "Superseded isolated analog-domain converter",
      "Removed because the retained ADA4177 path uses common-ground V5_ANALOG plus a TPS60400 negative rail."
    ),
    dnpRow(
      "U_POWER_MONITOR",
      "On-board V5 current and power monitor",
      "Removed because the P0 removable current links and external instruments provide bring-up measurements without a permanent telemetry IC."
    ),
    dnpRow(
      "R_V5_SENSE",
      "Full-rail V5 telemetry shunt",
      "Removed with the on-board power monitor; P0 does not spend voltage headroom, routing, calibration, or footprint work on permanent rail telemetry."
    ),
    dnpRow(
      "C_EFUSE_OUT",
      "Dedicated eFuse-output bulk capacitor",
      "Removed as a duplicate reservoir; the two exact TPS56A37 input capacitors are directly on the eFuse output."
    ),
    dnpRow(
      "R_EFUSE_PGTH_UP",
      "eFuse power-good threshold upper divider",
      "Removed because no P0 control or safety decision consumes eFuse PG; the TPS259474A permits PGTH to remain open."
    ),
    dnpRow(
      "R_EFUSE_PGTH_DOWN",
      "eFuse power-good threshold lower divider",
      "Removed with the unused eFuse PG indication path."
    ),
    dnpRow(
      "R_EFUSE_PG_PULLUP",
      "eFuse power-good pull-up",
      "Removed because the open-drain PG output is unused on P0."
    ),
    dnpRow(
      "R_V5_BUCK_PG_PULLUP",
      "5 V buck power-good pull-up",
      "Removed because BP-123 owns independent APP_3V3 supervision and no control decision consumes the TPS56A37 PG output."
    ),
    dnpRow(
      "R_V5_BUCK_EN_UP",
      "5 V buck enable upper divider",
      "Removed because the upstream eFuse owns the input voltage window and controlled ramp; TPS56A37 EN uses its internal pull-up."
    ),
    dnpRow(
      "R_V5_BUCK_EN_DOWN",
      "5 V buck enable lower divider",
      "Removed with the redundant TPS56A37 external enable threshold."
    ),
    dnpRow(
      "C_V5_BUCK_SS",
      "5 V buck external soft-start capacitor",
      "Removed because the eFuse DVDT network controls apparatus inrush and TPS56A37 provides a default internal 1.8 ms soft start."
    ),
    dnpRow(
      "TP_V5_BUCK_PG",
      "Dedicated 5 V buck power-good test point",
      "Removed with the unused PG pull-up; bring-up observes V5 directly at the reviewed rail test point."
    ),
    selectedDecisionRow(
      "U_REF",
      "REF5025AQDRQ1",
      "Scoring-domain 2.5 V reference",
      "Exact production-intent reference; input/output network and dynamic-load evidence remain analog gates."
    ),
    ...selectedApplicationRailRows,
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
    dnpRow(
      "J_LAB_INJECTION",
      "Alternate laboratory power connector",
      "Removed from populated P0; reviewed rail test pads and removable links provide diagnostic access."
    ),
    dnpRow(
      "S_POWER_SOURCE_SELECTOR",
      "Alternate power source selector",
      "Removed with the alternate laboratory input; USB-C PD is the sole populated power input."
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
      "Required 20 V power-path protection; exact UVLO/OVLO, current, ramp, timer, transient, and thermal evidence remain gates."
    ),
    ...selectedEfuseSupportRows,
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
    selectedSupportRow(
      "R_HUB75_SIGNAL_DEFAULTS",
      "HUB75 reset-safe signal defaults",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Sixteen required 10 kOhm defaults cover twelve black-data/address/clock/latch pulldowns, the OE input pull-up, and three unused AHCT inputs.",
      16
    ),
    selectedSupportRow(
      "J_HUB75",
      "External 13-signal HUB75 panel header",
      "Samtec",
      "TST-108-04-G-D-RA",
      "2x8, 2.54 mm pitch, right-angle through-hole, four-wall shrouded",
      "https://www.samtec.com/products/tst-108-04-g-d-ra",
      "Required keyed 16-position signal header selected by BP-143 for the Adafruit 4170 cable; panel power remains on its separate cable.",
      1,
      "hub75-connector"
    ),
    selectedSupportRow(
      "R_HUB75_PANEL_OE_PULLUP",
      "HUB75 panel-side blanking default",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Required pull-up holds panel OE inactive when the level shifter is disabled or unpowered."
    ),
    selectedSupportRow(
      "C_HUB75_BUFFER_BYPASS",
      "HUB75 level-shifter local bypass",
      "KEMET",
      "C0603C104K3RACTU",
      "0603 (1608 metric)",
      "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU",
      "Two required 100 nF local bypass capacitors, one at each SN74AHCT245 supply.",
      2
    ),
    selectedSupportRow(
      "Q_DISPLAY_ENABLE",
      "Shared hardware display-enable sink",
      "Nexperia",
      "BSS138AKA",
      "SOT23 (TO-236AB)",
      "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf",
      "One required low-side sink ties both AHCT output-enable inputs together so reset blanks all 13 HUB75 signals without firmware authority."
    ),
    selectedSupportRow(
      "R_DISPLAY_ENABLE_PULLUP_AND_GATE",
      "Shared display-enable bias and gate network",
      "Yageo",
      "RC0603FR-0710KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
      "Two required 10 kOhm parts provide the common OE pull-up and reset-to-gate series path.",
      2
    ),
    selectedSupportRow(
      "R_DISPLAY_ENABLE_GATE_PD",
      "Shared display-enable gate default",
      "Yageo",
      "RC0603FR-07100KL",
      "0603 (1608 metric)",
      "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
      "Required 100 kOhm gate pulldown prevents a floating BSS138 gate during reset or power sequencing."
    ),
    dnpRow(
      "U_FRAM",
      "External event-journal F-RAM",
      "Removed from P0; bounded persistence uses encrypted NVS and no flash writes occur while scoring."
    ),
    selectedDecisionRow(
      "U_V5_BUCK",
      "TPS56A37RPAR",
      "USB-C PD 20 V to protected 5 V conversion",
      "Required by the ESP32/AFE and HUB75 branches; thermal, inrush, and exact support-network gates remain open."
    ),
    ...selectedV5SupportRows,
    selectedIrRow(
      "U_IR_RX",
      "Encrypted-remote 38 kHz receiver",
      benchPrototypeIrReceiverSelection.receiver.manufacturer,
      benchPrototypeIrReceiverSelection.receiver.mpn,
      benchPrototypeIrReceiverSelection.receiver.package,
      benchPrototypeIrReceiverSelection.sources[0],
      "Required TSOP38438 receive path; optical range, flood, latency, reset, and power-off evidence remain open."
    ),
    ...benchPrototypeIrReceiverSelection.supportNetwork.map((part, index) =>
      selectedIrRow(
        part.reference,
        `Encrypted-remote support: ${part.purpose}`,
        part.manufacturer,
        part.mpn,
        part.package,
        benchPrototypeIrReceiverSelection.sources[index === 0 || index === 2 ? 5 : index === 1 ? 7 : 6],
        `Required exact ${part.value} part for the TSOP38438 path.`
      )
    ),
    selectedIrRow(
      benchPrototypeIrReceiverSelection.observation.testPoint.reference,
      "Encrypted-remote receiver test point",
      benchPrototypeIrReceiverSelection.observation.testPoint.manufacturer,
      benchPrototypeIrReceiverSelection.observation.testPoint.mpn,
      benchPrototypeIrReceiverSelection.observation.testPoint.package,
      benchPrototypeIrReceiverSelection.sources[8],
      "Required optical-receiver observation point; it grants no command or scoring authority."
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
    sourceKind !== "application-rail" &&
    sourceKind !== "bench-prototype-power" &&
    sourceKind !== "component-decision" &&
    sourceKind !== "ethernet-support-network" &&
    sourceKind !== "hub75-connector" &&
    sourceKind !== "ir-receiver-selection" &&
    sourceKind !== "processor-support" &&
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
