import { Fragment, type ReactElement } from "react"

const manufacturer = "Espressif Systems"
const manufacturerPartNumber = "ESP32-S3-WROOM-1U-N16R2"
const canonicalReference = "U_APP"
const bp121SourcePath = "packages/scoring-circuit/src/bench-prototype-esp32-allocation.ts"
const bp121SourceSha256 = "F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B"
const bp125SourcePath = "packages/scoring-circuit/src/bench-prototype-bp125-processor-footprint-reconciliation.ts"
const bp125SourceSha256 = "3FF36883B336525E50503DF8F45E70F6E6CD453A9FE57070470C597FDD5130C1"
const integrationCommit = "8f0739b9d4ff3a8d19bc211c07490c94c7cdca12"

type Point = { readonly xMm: number; readonly yMm: number }
type PerimeterPad = Point & {
  readonly pad: number
  readonly role: "module-terminal"
  readonly widthMm: number
  readonly heightMm: number
}
type ThermalVia = Point & {
  readonly role: "exposed-ground-pad-via"
  readonly copperWidthMm: number
  readonly copperHeightMm: number
  readonly drillDiameterMm: number
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-032 exact baseline cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 exact baseline accepts data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

const officialSources = [
  {
    id: "espressif-esp32-s3-wroom-1u-datasheet-v1-8",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1 & WROOM-1U Datasheet v1.8",
    url: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
    reviewedPages: {
      exactVariant: [3],
      pinsAndSupply: [10, 11, 12],
      resetAndExposedPad: [41],
      moduleDimensionsAndConnector: [42, 43],
      recommendedLandPattern: [45, 46]
    },
    artifactPath:
      "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf",
    sha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435",
    role: "Exact WROOM-1U-N16R2 selection, module dimensions, pin-one orientation, external antenna connector, EPAD, and recommended land pattern."
  },
  {
    id: "espressif-esp32-s3-wroom-1u-pcb-footprint-dxf",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1U PCB Footprint.dxf",
    url: "https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1U%20PCB%20Footprint.dxf",
    reviewedLayers: ["PART_TOP_COPPER_01", "SOLDERMASKTOP_P", "PADS_TOP"],
    artifactPath:
      "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf",
    sha256: "986C1AB9B0956A0B824BE1E51AA10C006F2A1554438DC9DC2459F14AF3AED0D0",
    role: "Retained official CAD source for 40 perimeter lands, nine EPAD via lands, and top solder-mask openings."
  },
  {
    id: "espressif-esp32-s3-wroom-1u-step",
    authority: "manufacturer-primary",
    documentNumber: "ESP32-S3-WROOM-1U 3D Model.STEP",
    url: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1U%203D%20Model.STEP",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-3d-model-official.step",
    sha256: "7BE82BDAFECE2891B297546EB0643FF254E3D8161074EBDC972E0D78E79A4BDB",
    role: "Retained official mechanical reference for the WROOM-1U body and connector envelope; not a released board footprint."
  }
] as const

const bp121PadMap = [
  { pad: 1, pin: "GND", signal: "APP_GND", group: "power", disposition: "ground" },
  { pad: 2, pin: "3V3", signal: "APP_3V3", group: "power", disposition: "power" },
  { pad: 3, pin: "EN", signal: "EN_RESET", group: "recovery", disposition: "reset" },
  { pad: 4, gpio: 4, pin: "GPIO4", signal: "SCORE_SCK", group: "isolated-spi", disposition: "assigned" },
  { pad: 5, gpio: 5, pin: "GPIO5", signal: "SCORE_MOSI", group: "isolated-spi", disposition: "assigned" },
  { pad: 6, gpio: 6, pin: "GPIO6", signal: "SCORE_MISO", group: "isolated-spi", disposition: "assigned" },
  { pad: 7, gpio: 7, pin: "GPIO7", signal: "SCORE_CS_N", group: "isolated-spi", disposition: "assigned" },
  { pad: 8, gpio: 15, pin: "GPIO15", signal: "ESP32_HEARTBEAT", group: "watchdog-heartbeat", disposition: "assigned" },
  { pad: 9, gpio: 16, pin: "GPIO16", signal: "HUB75_R2", group: "hub75", disposition: "assigned" },
  { pad: 10, gpio: 17, pin: "GPIO17", signal: "STM32_HEARTBEAT", group: "watchdog-heartbeat", disposition: "assigned" },
  { pad: 11, gpio: 18, pin: "GPIO18", signal: "APP_SPI_SCK", group: "app-spi", disposition: "assigned" },
  { pad: 12, gpio: 8, pin: "GPIO8", signal: "APP_SPI_MOSI", group: "app-spi", disposition: "assigned" },
  { pad: 13, gpio: 19, pin: "GPIO19", signal: "USB_DN", group: "usb-service", disposition: "assigned" },
  { pad: 14, gpio: 20, pin: "GPIO20", signal: "USB_DP", group: "usb-service", disposition: "assigned" },
  { pad: 15, gpio: 3, pin: "GPIO3", signal: "NC_STRAP_QUIET", group: "reserved", disposition: "reserved-nc" },
  { pad: 16, gpio: 46, pin: "GPIO46", signal: "HUB75_CLK", group: "hub75", disposition: "assigned" },
  { pad: 17, gpio: 9, pin: "GPIO9", signal: "APP_SPI_MISO", group: "app-spi", disposition: "assigned" },
  { pad: 18, gpio: 10, pin: "GPIO10", signal: "I2C_SDA", group: "i2c", disposition: "assigned" },
  { pad: 19, gpio: 11, pin: "GPIO11", signal: "I2C_SCL", group: "i2c", disposition: "assigned" },
  { pad: 20, gpio: 12, pin: "GPIO12", signal: "APP_WD_KICK", group: "watchdog-heartbeat", disposition: "assigned" },
  { pad: 21, gpio: 13, pin: "GPIO13", signal: "HUB75_R1", group: "hub75", disposition: "assigned" },
  { pad: 22, gpio: 14, pin: "GPIO14", signal: "HUB75_G1", group: "hub75", disposition: "assigned" },
  { pad: 23, gpio: 21, pin: "GPIO21", signal: "HUB75_B1", group: "hub75", disposition: "assigned" },
  { pad: 24, gpio: 47, pin: "GPIO47", signal: "FRAM_CS_N", group: "app-spi", disposition: "assigned" },
  { pad: 25, gpio: 48, pin: "GPIO48", signal: "HUB75_LAT", group: "hub75", disposition: "assigned" },
  { pad: 26, gpio: 45, pin: "GPIO45", signal: "HUB75_D", group: "hub75", disposition: "assigned" },
  { pad: 27, gpio: 0, pin: "GPIO0", signal: "BOOT_N", group: "recovery", disposition: "assigned" },
  { pad: 28, gpio: 35, pin: "GPIO35", signal: "IR_RX", group: "ir-receiver", disposition: "assigned" },
  { pad: 29, gpio: 36, pin: "GPIO36", signal: "NC_AUDIO_DNP_WS", group: "reserved", disposition: "reserved-nc" },
  { pad: 30, gpio: 37, pin: "GPIO37", signal: "NC_AUDIO_DNP_DOUT", group: "reserved", disposition: "reserved-nc" },
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

const perimeterPads: readonly PerimeterPad[] = [
  { pad: 1, role: "module-terminal", xMm: -8.75, yMm: 8.255, widthMm: 1.5, heightMm: 0.9 },
  { pad: 2, role: "module-terminal", xMm: -8.75, yMm: 6.985, widthMm: 1.5, heightMm: 0.9 },
  { pad: 3, role: "module-terminal", xMm: -8.75, yMm: 5.715, widthMm: 1.5, heightMm: 0.9 },
  { pad: 4, role: "module-terminal", xMm: -8.75, yMm: 4.445, widthMm: 1.5, heightMm: 0.9 },
  { pad: 5, role: "module-terminal", xMm: -8.75, yMm: 3.175, widthMm: 1.5, heightMm: 0.9 },
  { pad: 6, role: "module-terminal", xMm: -8.75, yMm: 1.905, widthMm: 1.5, heightMm: 0.9 },
  { pad: 7, role: "module-terminal", xMm: -8.75, yMm: 0.635, widthMm: 1.5, heightMm: 0.9 },
  { pad: 8, role: "module-terminal", xMm: -8.75, yMm: -0.635, widthMm: 1.5, heightMm: 0.9 },
  { pad: 9, role: "module-terminal", xMm: -8.75, yMm: -1.905, widthMm: 1.5, heightMm: 0.9 },
  { pad: 10, role: "module-terminal", xMm: -8.75, yMm: -3.175, widthMm: 1.5, heightMm: 0.9 },
  { pad: 11, role: "module-terminal", xMm: -8.75, yMm: -4.445, widthMm: 1.5, heightMm: 0.9 },
  { pad: 12, role: "module-terminal", xMm: -8.75, yMm: -5.715, widthMm: 1.5, heightMm: 0.9 },
  { pad: 13, role: "module-terminal", xMm: -8.75, yMm: -6.985, widthMm: 1.5, heightMm: 0.9 },
  { pad: 14, role: "module-terminal", xMm: -8.75, yMm: -8.255, widthMm: 1.5, heightMm: 0.9 },
  { pad: 15, role: "module-terminal", xMm: -6.985, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 16, role: "module-terminal", xMm: -5.715, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 17, role: "module-terminal", xMm: -4.445, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 18, role: "module-terminal", xMm: -3.175, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 19, role: "module-terminal", xMm: -1.905, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 20, role: "module-terminal", xMm: -0.635, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 21, role: "module-terminal", xMm: 0.635, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 22, role: "module-terminal", xMm: 1.905, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 23, role: "module-terminal", xMm: 3.175, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 24, role: "module-terminal", xMm: 4.445, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 25, role: "module-terminal", xMm: 5.715, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 26, role: "module-terminal", xMm: 6.985, yMm: -9.5, widthMm: 0.9, heightMm: 1.5 },
  { pad: 27, role: "module-terminal", xMm: 8.75, yMm: -8.255, widthMm: 1.5, heightMm: 0.9 },
  { pad: 28, role: "module-terminal", xMm: 8.75, yMm: -6.985, widthMm: 1.5, heightMm: 0.9 },
  { pad: 29, role: "module-terminal", xMm: 8.75, yMm: -5.715, widthMm: 1.5, heightMm: 0.9 },
  { pad: 30, role: "module-terminal", xMm: 8.75, yMm: -4.445, widthMm: 1.5, heightMm: 0.9 },
  { pad: 31, role: "module-terminal", xMm: 8.75, yMm: -3.175, widthMm: 1.5, heightMm: 0.9 },
  { pad: 32, role: "module-terminal", xMm: 8.75, yMm: -1.905, widthMm: 1.5, heightMm: 0.9 },
  { pad: 33, role: "module-terminal", xMm: 8.75, yMm: -0.635, widthMm: 1.5, heightMm: 0.9 },
  { pad: 34, role: "module-terminal", xMm: 8.75, yMm: 0.635, widthMm: 1.5, heightMm: 0.9 },
  { pad: 35, role: "module-terminal", xMm: 8.75, yMm: 1.905, widthMm: 1.5, heightMm: 0.9 },
  { pad: 36, role: "module-terminal", xMm: 8.75, yMm: 3.175, widthMm: 1.5, heightMm: 0.9 },
  { pad: 37, role: "module-terminal", xMm: 8.75, yMm: 4.445, widthMm: 1.5, heightMm: 0.9 },
  { pad: 38, role: "module-terminal", xMm: 8.75, yMm: 5.715, widthMm: 1.5, heightMm: 0.9 },
  { pad: 39, role: "module-terminal", xMm: 8.75, yMm: 6.985, widthMm: 1.5, heightMm: 0.9 },
  { pad: 40, role: "module-terminal", xMm: 8.75, yMm: 8.255, widthMm: 1.5, heightMm: 0.9 }
]

const thermalVias: readonly ThermalVia[] = [
  {
    role: "exposed-ground-pad-via",
    xMm: -2.9,
    yMm: -0.9,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -1.5,
    yMm: -0.9,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -0.1,
    yMm: -0.9,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -2.9,
    yMm: 0.5,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -1.5,
    yMm: 0.5,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -0.1,
    yMm: 0.5,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -2.9,
    yMm: 1.9,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  {
    role: "exposed-ground-pad-via",
    xMm: -1.5,
    yMm: 1.9,
    copperWidthMm: 0.9,
    copperHeightMm: 0.9,
    drillDiameterMm: 0.5
  },
  { role: "exposed-ground-pad-via", xMm: -0.1, yMm: 1.9, copperWidthMm: 0.9, copperHeightMm: 0.9, drillDiameterMm: 0.5 }
]

const privateReviewedBaseline = deepFreeze({
  schemaVersion: "BP-032.exact-esp32-module-footprint.v1",
  artifactKind: "bp032-esp32-s3-wroom-1u-exact-project-footprint-candidate",
  workUnit: "BP-032",
  canonicalReference,
  manufacturer,
  manufacturerPartNumber,
  exactOrderable: {
    manufacturer,
    manufacturerPartNumber,
    package: "ESP32-S3-WROOM-1U module",
    family: "ESP32-S3-WROOM-1U",
    flash: "16 MB Quad SPI",
    psram: "2 MB Quad SPI",
    antennaVariant: "external-antenna-connector"
  },
  sourceBinding: {
    canonicalReference,
    candidatePath: "packages/scoring-circuit/src/bp032-esp32-s3-wroom-1u-exact-footprint.tsx",
    bp121SourcePath,
    bp121SourceSha256,
    bp121ModuleMpn: manufacturerPartNumber,
    bp125SourcePath,
    bp125SourceSha256,
    bp125CandidatePath: "packages/scoring-circuit/src/bench-prototype-bp032-esp32-s3-wroom-1u-footprint.tsx",
    bp125ProcessorReference: canonicalReference,
    integrationCommit,
    selectionState: "frozen-source-input-only"
  },
  officialSources,
  manufacturerFacts: {
    bodyEnvelopeMm: { widthMm: 18, lengthMm: 19.2, heightMm: 3.2 },
    bodyToleranceMm: { widthPlusMinusMm: 0.2, lengthPlusMinusMm: 0.2, heightPlusMinusMm: 0.15 },
    perimeterTerminalCount: 40,
    exposedGroundPad: { pad: 41, net: "APP_GND", electricalRole: "GND_EP" },
    sourceLandPattern: {
      perimeterPadSizeMm: { widthMm: 1.5, heightMm: 0.9 },
      bottomPadSizeMm: { widthMm: 0.9, heightMm: 1.5 },
      perimeterPitchMm: 1.27,
      exposedGroundViaCount: 9,
      exposedGroundViaCopperMm: 0.9,
      exposedGroundViaFinishedDrillMm: 0.5,
      exposedGroundViaPitchMm: 1.4,
      exposedGroundCopperEnvelopeMm: { widthMm: 3.7, lengthMm: 3.7 }
    },
    externalAntennaConnector: {
      generation: "first-generation",
      compatibleMates: ["U.FL series", "MHF I", "AMC"],
      shellTopViewMm: { widthMm: 2.6, lengthMm: 2.6, toleranceMm: 0.15 },
      moduleEnvelopeMm: { widthMm: 3.1, lengthMm: 3.0 },
      hostBoardAntennaKeepout: "not-published"
    }
  },
  bp121AllocationSnapshot: {
    moduleMpn: manufacturerPartNumber,
    padMap: bp121PadMap,
    modulePadCount: 41,
    modulePerimeterPadCount: 40,
    moduleUnexposedGpios: [33, 34],
    unavailableResources: [26, 27, 28, 29, 30, 31, 32]
  },
  projectGeometry: {
    coordinateSystem: {
      origin: "nominal module body center",
      view: "datasheet top view",
      units: "mm",
      nominalRotationDegrees: 0
    },
    bodyEnvelopeMm: { widthMm: 18, lengthMm: 19.2, heightMm: 3.2 },
    perimeterCopper: {
      pads: perimeterPads,
      padCount: 40,
      padOne: { pad: 1, xMm: -8.75, yMm: 8.255 },
      source: "Espressif v1.8 Figure 10-2, Figure 11-2, and retained DXF PART_TOP_COPPER_01"
    },
    exposedGroundPad: {
      pad: 41,
      net: "APP_GND",
      copperEnvelopeMm: { widthMm: 3.7, lengthMm: 3.7 },
      arrayCenterMm: { xMm: -1.5, yMm: 0.5 },
      viaPitchMm: 1.4,
      vias: thermalVias,
      viaCount: 9,
      source: "Espressif v1.8 Figure 10-2, Figure 11-2, and retained DXF PART_TOP_COPPER_01"
    },
    solderMask: {
      sourceLayer: "SOLDERMASKTOP_P",
      perimeterOpenings: { count: 40, widthMm: 1.5, heightMm: 0.9 },
      exposedGroundViaOpenings: { count: 9, widthMm: 0.9, heightMm: 0.9 },
      status: "retained-manufacturer-CAD-measurement-only"
    },
    paste: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-stencil-apertures-from-copper-or-mask"
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-assembly-courtyard-from-body-envelope"
    },
    orientation: {
      pinOne: { pad: 1, xMm: -8.75, yMm: 8.255 },
      nominalBoardRotationDegrees: 0,
      topView: "pin 1 upper-left; external connector upper-right",
      source: "Espressif v1.8 Figure 9-1, Figure 10-2, and Figure 11-2",
      independentOverlay: "pending",
      placementApproval: "deny"
    },
    antennaBoundary: {
      mode: "external-antenna-connector-integrated",
      pcbAntennaKeepout: "not-applicable-to-WROOM-1U",
      connectorEnvelopeMm: { widthMm: 3.1, lengthMm: 3.0 },
      shellTopViewMm: { widthMm: 2.6, lengthMm: 2.6, toleranceMm: 0.15 },
      compatibleMates: ["U.FL series", "MHF I", "AMC"],
      hostBoardRfTrace: "none; connector and cable boundary remains external",
      hostBoardClearance: "not-published; do not infer",
      cableExitAndEnclosureReview: "pending",
      rfMeasurement: "deny",
      source: "Espressif v1.8 Figure 10-3"
    },
    keepout: {
      moduleBody: "body-envelope-only; host courtyard not published",
      pcbAntenna: "not-applicable-to-WROOM-1U",
      connectorAndCable: "clearance required but dimensions and enclosure datum are not published",
      status: "candidate-input-only",
      approval: "deny"
    }
  },
  artworkProvenance: {
    sourceArtifactPath:
      "packages/scoring-circuit/docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-pcb-footprint-official.dxf",
    sourceArtifactSha256: "986C1AB9B0956A0B824BE1E51AA10C006F2A1554438DC9DC2459F14AF3AED0D0",
    sourceLayers: ["PART_TOP_COPPER_01", "SOLDERMASKTOP_P", "PADS_TOP"],
    generatedEntities: {
      footprint: "BP032_ESP32_S3_WROOM_1U_N16R2_EXACT_CANDIDATE",
      topCopperPerimeter: 40,
      exposedGroundPlatedHoles: 9,
      pasteApertures: 0,
      courtyardOutlines: 0
    },
    pinOnePortHint: "1/pin1",
    rendererState: "review-candidate-only",
    fabricationRelease: "deny"
  },
  fabricationAuthority: "deny",
  releaseState: "deny",
  accepted: false,
  authority: {
    identity: "retained-and-hash-bound",
    manufacturerEvidence: "retained-primary",
    independentCadOverlay: "deny",
    cadApproval: "deny",
    placementApproval: "deny",
    rfMeasurementApproval: "deny",
    schematicIntegration: "deny",
    fabrication: "deny",
    release: "deny",
    acceptance: false
  }
} as const)

export const benchPrototypeBp032Esp32S3Wroom1uExactFootprint = deepFreeze(structuredClone(privateReviewedBaseline))

export type BenchPrototypeBp032Esp32S3Wroom1uExactFootprint = typeof benchPrototypeBp032Esp32S3Wroom1uExactFootprint

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
  try {
    if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((key) => expectedKeys.includes(key)))
      return false
    for (const key of actualKeys) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      if (
        actualDescriptor === undefined ||
        expectedDescriptor === undefined ||
        !("value" in actualDescriptor) ||
        !("value" in expectedDescriptor) ||
        actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
        actualDescriptor.configurable !== expectedDescriptor.configurable ||
        actualDescriptor.writable !== expectedDescriptor.writable ||
        !sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seenActual, seenExpected)
      ) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

export function validateBenchPrototypeBp032Esp32S3Wroom1uExactFootprint(value: unknown): true {
  if (!sameDataGraph(value, privateReviewedBaseline, new WeakSet<object>(), new WeakSet<object>())) {
    throw new RangeError("BP-032 exact ESP32 module footprint drifted from the private reviewed baseline")
  }
  if (typeof value !== "object" || value === null) {
    throw new RangeError("BP-032 exact candidate must be an object")
  }
  const exactValue = value as typeof privateReviewedBaseline
  if (
    exactValue.canonicalReference !== canonicalReference ||
    exactValue.manufacturerPartNumber !== manufacturerPartNumber ||
    exactValue.sourceBinding.bp121ModuleMpn !== manufacturerPartNumber ||
    exactValue.sourceBinding.bp121SourceSha256.length !== 64 ||
    exactValue.sourceBinding.bp125SourceSha256.length !== 64 ||
    exactValue.bp121AllocationSnapshot.padMap.length !== 41 ||
    exactValue.projectGeometry.perimeterCopper.pads.length !== 40 ||
    exactValue.projectGeometry.exposedGroundPad.vias.length !== 9 ||
    exactValue.projectGeometry.orientation.pinOne.pad !== 1 ||
    exactValue.projectGeometry.antennaBoundary.pcbAntennaKeepout !== "not-applicable-to-WROOM-1U" ||
    exactValue.projectGeometry.paste.status !== "not-published" ||
    exactValue.projectGeometry.courtyard.status !== "not-published" ||
    exactValue.authority.cadApproval !== "deny" ||
    exactValue.authority.placementApproval !== "deny" ||
    exactValue.authority.rfMeasurementApproval !== "deny" ||
    exactValue.authority.schematicIntegration !== "deny" ||
    exactValue.authority.fabrication !== "deny" ||
    exactValue.authority.release !== "deny" ||
    exactValue.authority.acceptance ||
    exactValue.fabricationAuthority !== "deny" ||
    exactValue.releaseState !== "deny" ||
    exactValue.accepted
  ) {
    throw new RangeError("BP-032 exact candidate must remain source-bound and all release gates denied")
  }
  return true
}

const candidateFootprint = (
  <footprint name="BP032_ESP32_S3_WROOM_1U_N16R2_EXACT_CANDIDATE" originalLayer="top">
    {perimeterPads.map((pad) => (
      <Fragment key={`pad-${pad.pad}`}>
        <smtpad
          name={String(pad.pad)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          solderMaskMargin="0mm"
          solderPasteMargin="-1mm"
          portHints={[String(pad.pad), pad.pad === 1 ? "pin1" : "module-pad"]}
        />
      </Fragment>
    ))}
    {thermalVias.map((via, index) => (
      <Fragment key={`ep-via-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={via.xMm}
          pcbY={via.yMm}
          holeDiameter={`${via.drillDiameterMm}mm`}
          rectPadWidth={`${via.copperWidthMm}mm`}
          rectPadHeight={`${via.copperHeightMm}mm`}
          rectBorderRadius="0mm"
          solderMaskMargin="0mm"
          portHints={["41", "GND_EP", "thermal-via"]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface BenchPrototypeBp032Esp32S3Wroom1uExactFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated BP-032 exact candidate renderer; no board or fabrication authority is granted. */
export function BenchPrototypeBp032Esp32S3Wroom1uExactFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: BenchPrototypeBp032Esp32S3Wroom1uExactFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_ESP32_S3_WROOM_1U_N16R2_EXACT_CANDIDATE"
      manufacturerPartNumber={manufacturerPartNumber}
      footprint={candidateFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default BenchPrototypeBp032Esp32S3Wroom1uExactFootprint
