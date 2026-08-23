/**
 * Primary-source selection and calculation boundary for the W5500 support
 * network.  This file deliberately does not alter the communications-module
 * circuit: it records the parts and constraints that must be reviewed before
 * those parts are integrated into a released PCB.
 */

export type EthernetSupportComponent = {
  readonly component: "capacitor" | "crystal" | "ferrite-bead" | "resistor"
  readonly dielectricOrTechnology: string
  readonly manufacturer: string
  readonly mpn: string
  readonly package: string
  readonly reference: string
  readonly sourceUrls: readonly string[]
  readonly temperatureRangeC: readonly [number, number]
  readonly tolerance: string
  readonly value: string
  readonly voltageOrCurrentRating: string
}

export type EthernetSupportSource = {
  readonly claims: readonly string[]
  readonly manufacturer: string
  readonly revisionOrAccessDate: string
  readonly url: string
}

export type CrystalLoadInput = {
  readonly capacitorPf: number
  readonly capacitorTolerancePercent: number
  readonly strayCapacitancePf: number
  readonly crystalDriveMaximumUw: number
  readonly crystalEsrMaximumOhm: number
}

export type CrystalLoadEnvelope = {
  readonly candidateDriveMaximumUw: number
  readonly candidateEsrMaximumOhm: number
  readonly driveHeadroomUw: number
  readonly driveMarginFactor: number
  readonly effectiveLoadMaximumPf: number
  readonly effectiveLoadMinimumPf: number
  readonly esrCheck: "requires-measured-negative-resistance"
  readonly minimumMeasuredNegativeResistanceOhm: number
  readonly negativeResistanceMarginFactor: number
  readonly negativeResistanceVerificationCorners: readonly NegativeResistanceVerificationCorner[]
  readonly targetLoadPf: number
  readonly targetLoadWindowPass: boolean
}

export type NegativeResistanceVerificationCorner =
  | "component-tolerance"
  | "released-layout"
  | "supply-voltage"
  | "temperature"

export type CrystalQualificationInput = {
  readonly agingMaximumPpmPerYear: number
  readonly driveLevelMaximumUw: number
  readonly esrMaximumOhm: number
  readonly frequencyMHz: number
  readonly frequencyTolerancePpm: number
  readonly loadCapacitancePf: number
  readonly shuntCapacitancePf: number
}

export type CrystalQualification = {
  readonly agingPass: boolean
  readonly drivePass: boolean
  readonly esrPublishedPass: boolean
  readonly frequencyPass: boolean
  readonly loadPass: boolean
  readonly negativeResistanceProductionMinimumOhm: number
  readonly overallPass: false
  readonly publishedSpecificationPass: boolean
  readonly releasePass: false
  readonly shuntPass: boolean
  readonly tolerancePass: boolean
}

const W5500_DATASHEET = "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf"
const W5500_EVB_SCHEMATIC = "https://docs.wiznet.io/img/products/w5500/w5500_evb/w5500_evb_v1.0_140527.pdf"
const ECS_CRYSTAL_DATASHEET = "https://www.ecsxtal.com/store/pdf/ECS-33B2.pdf"
const ECS_CRYSTAL_PRODUCT = "https://ecsxtal.com/products/crystals/surface-mount-crystals/ecs-250-18-33b-jgn-tr/"
const MURATA_MLCC_LIST =
  "https://www.murata.com/-/media/webrenewal/tool/library/common-pdf/dynamic-model/component-list-d-mlcc-2504.ashx?cvid=20250523010405000000&la=en"
const MURATA_FERRITE_DATASHEET =
  "https://www.murata.com/en-eu/api/pdfdownloadapi?cate=cgsubChipFerriBead&partno=BLM21PG221SN1D"
const MURATA_FERRITE_PRODUCT = "https://www.murata.com/en-global/products/productdetail?partno=BLM21PG221SN1%23"
const TDK_CRYSTAL_PRODUCT = "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=CGA3E2C0G1H180J080AA"
const PANASONIC_RESISTOR_PRODUCT =
  "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1242V"
const PANASONIC_FEEDBACK_RESISTOR_PRODUCT =
  "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3EKF1004V"
const PANASONIC_CRYSTAL_LINK_PRODUCT =
  "https://industrial.panasonic.com/ww/products/pt/general-purpose-chip-resistors/models/ERJ3GEY0R00V"
const PANASONIC_THICK_FILM_DATASHEET = "https://industrial.panasonic.com/cdbs/www-data/pdf/RDA0000/AOA0000C301.pdf"

const w5500SupplyCap = (reference: string, sourceUrls: readonly string[]): EthernetSupportComponent => ({
  component: "capacitor",
  dielectricOrTechnology: "X7R (EIA) multilayer ceramic",
  manufacturer: "Murata",
  mpn: "GRM188R71C104KA01D",
  package: "0603 (1608 metric), paper tape suffix D",
  reference,
  sourceUrls,
  temperatureRangeC: [-55, 125],
  tolerance: "±10%",
  value: "100nF",
  voltageOrCurrentRating: "16Vdc rated voltage"
})

const supportNetworkComponents: readonly EthernetSupportComponent[] = [
  {
    component: "crystal",
    dielectricOrTechnology: "fundamental-mode quartz crystal",
    manufacturer: "ECS Inc.",
    mpn: "ECS-250-18-33B-JGN-TR",
    package: "ECS-33B2, 3.20mm x 2.50mm x 0.80mm, 4-pad SMD, 1K reel",
    reference: "Y_W5500",
    sourceUrls: [ECS_CRYSTAL_PRODUCT, ECS_CRYSTAL_DATASHEET],
    temperatureRangeC: [-40, 85],
    tolerance: "±20ppm tolerance, ±30ppm stability",
    value: "25.000MHz, 18pF load, 2pF shunt, 40Ohm maximum ESR, ±2ppm first-year aging",
    voltageOrCurrentRating: "200uW maximum drive level"
  },
  {
    component: "capacitor",
    dielectricOrTechnology: "C0G (EIA) multilayer ceramic, AEC-Q200",
    manufacturer: "TDK",
    mpn: "CGA3E2C0G1H180J080AA",
    package: "CGA3 (1608 metric), 0603, paper tape suffix AA",
    reference: "C_W5500_XI",
    sourceUrls: [TDK_CRYSTAL_PRODUCT],
    temperatureRangeC: [-55, 125],
    tolerance: "±5%",
    value: "18pF",
    voltageOrCurrentRating: "50Vdc rated voltage"
  },
  {
    component: "resistor",
    dielectricOrTechnology: "precision thick-film, AEC-Q200",
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3EKF1004V",
    package: "ERJ-3EK, 0603 (1608 metric), punched paper tape",
    reference: "R_W5500_XTAL",
    sourceUrls: [PANASONIC_FEEDBACK_RESISTOR_PRODUCT],
    temperatureRangeC: [-55, 155],
    tolerance: "±1%, ±100ppm/°C TCR",
    value: "1MOhm",
    voltageOrCurrentRating: "100mW, 75V maximum working voltage"
  },
  {
    component: "resistor",
    dielectricOrTechnology: "thick-film chip jumper",
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3GEY0R00V",
    package: "ERJ-3GEY, 0603 (1608 metric), punched paper tape",
    reference: "R_W5500_XO",
    sourceUrls: [PANASONIC_CRYSTAL_LINK_PRODUCT, PANASONIC_THICK_FILM_DATASHEET],
    temperatureRangeC: [-55, 155],
    tolerance: "jumper (manufacturer page does not specify tolerance)",
    value: "0Ohm jumper",
    voltageOrCurrentRating: "manufacturer page does not specify; validate jumper current and derating in approval sheet"
  },
  {
    component: "capacitor",
    dielectricOrTechnology: "C0G (EIA) multilayer ceramic, AEC-Q200",
    manufacturer: "TDK",
    mpn: "CGA3E2C0G1H180J080AA",
    package: "CGA3 (1608 metric), 0603, paper tape suffix AA",
    reference: "C_W5500_XO",
    sourceUrls: [TDK_CRYSTAL_PRODUCT],
    temperatureRangeC: [-55, 125],
    tolerance: "±5%",
    value: "18pF",
    voltageOrCurrentRating: "50Vdc rated voltage"
  },
  {
    component: "resistor",
    dielectricOrTechnology: "precision thick-film, AEC-Q200",
    manufacturer: "Panasonic Industry",
    mpn: "ERJ3EKF1242V",
    package: "ERJ-3EK, 0603 (1608 metric), punched paper tape",
    reference: "R_W5500_EXRES",
    sourceUrls: [PANASONIC_RESISTOR_PRODUCT],
    temperatureRangeC: [-55, 155],
    tolerance: "±1%, ±100ppm/°C TCR",
    value: "12.4kOhm",
    voltageOrCurrentRating: "100mW, 75V maximum working voltage"
  },
  {
    component: "capacitor",
    dielectricOrTechnology: "X7R (EIA) multilayer ceramic",
    manufacturer: "Murata",
    mpn: "GRM21BR71C475KA73L",
    package: "0805 (2012 metric), embossed tape suffix L",
    reference: "C_W5500_TOCAP",
    sourceUrls: [MURATA_MLCC_LIST],
    temperatureRangeC: [-55, 125],
    tolerance: "±10%",
    value: "4.7uF",
    voltageOrCurrentRating: "16Vdc rated voltage"
  },
  {
    component: "capacitor",
    dielectricOrTechnology: "X7R (EIA) multilayer ceramic",
    manufacturer: "Murata",
    mpn: "GRM188R71H103KA01D",
    package: "0603 (1608 metric), paper tape suffix D",
    reference: "C_W5500_1V2O",
    sourceUrls: [MURATA_MLCC_LIST],
    temperatureRangeC: [-55, 125],
    tolerance: "±10%",
    value: "10nF",
    voltageOrCurrentRating: "50Vdc rated voltage"
  },
  w5500SupplyCap("C_ETH_AVDD_FERRITE_INPUT", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_VDD", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_1", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_2", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_3", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_4", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_5", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  w5500SupplyCap("C_W5500_AVDD_6", [W5500_EVB_SCHEMATIC, MURATA_MLCC_LIST]),
  {
    component: "ferrite-bead",
    dielectricOrTechnology: "high-current chip ferrite bead, general purpose",
    manufacturer: "Murata",
    mpn: "BLM21PG221SN1D",
    package: "0805 (2012 metric), paper tape suffix D",
    reference: "FB_W5500_AVDD",
    sourceUrls: [MURATA_FERRITE_PRODUCT, MURATA_FERRITE_DATASHEET],
    temperatureRangeC: [-55, 125],
    tolerance: "±25% impedance tolerance at 100MHz",
    value: "220Ohm impedance at 100MHz, 0.045Ohm maximum DCR",
    voltageOrCurrentRating: "2.0A rated current at 85°C, 1.25A at 125°C"
  }
] as const

export const ethernetSupportSources: readonly EthernetSupportSource[] = [
  {
    claims: [
      "W5500 requires 12.4kOhm ±1% from EXRES1 pin 10 to AGND",
      "W5500 TOCAP pin 20 requires 4.7uF with a short trace",
      "W5500 1V2O pin 22 requires 10nF",
      "W5500 crystal requirement is 25MHz, 18pF load capacitance, 59.12uW drive level, and 7pF maximum shunt capacitance",
      "W5500 crystal aging requirement is ±3ppm per year maximum at 25°C",
      "W5500 reference circuit uses 18pF crystal capacitors, 1MOhm feedback, and a 0Ohm series link",
      "W5500 supply range is 2.97V to 3.63V and normal-operation current is 132mA at 3.3V"
    ],
    manufacturer: "WIZnet",
    revisionOrAccessDate: "W5500 Datasheet v1.1.0, accessed 2026-08-23",
    url: W5500_DATASHEET
  },
  {
    claims: [
      "WIZnet EVB shows five local 0.1uF capacitors around the W5500 supply section",
      "WIZnet EVB uses 12.4kOhm EXRES, 4.7uF TOCAP, 10nF 1V2O, 18pF crystal capacitors, and an analog-supply ferrite"
    ],
    manufacturer: "WIZnet",
    revisionOrAccessDate: "W5500 EVB v1.0 schematic, accessed 2026-08-23",
    url: W5500_EVB_SCHEMATIC
  },
  {
    claims: [
      "ECS-250-18-33B-JGN-TR is a 25MHz, 18pF, 3.2mm x 2.5mm crystal with ±20ppm tolerance, ±30ppm stability, 40Ohm maximum ESR, and -40°C to 85°C operation",
      "The ECS-33B2 series specifies 2pF shunt capacitance, 200uW maximum drive, and ±2ppm first-year aging"
    ],
    manufacturer: "ECS Inc.",
    revisionOrAccessDate: "ECS-33B2 Rev. 2024 datasheet and product page, accessed 2026-08-23",
    url: ECS_CRYSTAL_PRODUCT
  },
  {
    claims: ["CGA3E2C0G1H180J080AA is 18pF ±5%, 50V, C0G, 0603, -55°C to 125°C, and AEC-Q200"],
    manufacturer: "TDK",
    revisionOrAccessDate: "Product Center record, accessed 2026-08-23",
    url: TDK_CRYSTAL_PRODUCT
  },
  {
    claims: ["ERJ3EKF1242V is 12.4kOhm ±1%, 100mW, 0603, ±100ppm/°C, and -55°C to 155°C"],
    manufacturer: "Panasonic Industry",
    revisionOrAccessDate: "Product record, accessed 2026-08-23",
    url: PANASONIC_RESISTOR_PRODUCT
  },
  {
    claims: ["ERJ3EKF1004V is 1MOhm ±1%, 100mW, 0603, ±100ppm/°C, and -55°C to 155°C"],
    manufacturer: "Panasonic Industry",
    revisionOrAccessDate: "Product record, accessed 2026-08-23",
    url: PANASONIC_FEEDBACK_RESISTOR_PRODUCT
  },
  {
    claims: [
      "ERJ3GEY0R00V is a 0Ohm, 0603, punched-tape chip jumper; the manufacturer page does not specify jumper tolerance or power",
      "Panasonic's ERJ3G thick-film datasheet gives the 0603 jumper family a -55°C to 155°C category range and requires the delivery specification for final ratings"
    ],
    manufacturer: "Panasonic Industry",
    revisionOrAccessDate: "Product record, accessed 2026-08-23",
    url: PANASONIC_THICK_FILM_DATASHEET
  },
  {
    claims: ["BLM21PG221SN1D is 220Ohm at 100MHz, 0.045Ohm maximum DCR, 0805, and 2A rated at 85°C"],
    manufacturer: "Murata",
    revisionOrAccessDate: "Product record and specification sheet, accessed 2026-08-23",
    url: MURATA_FERRITE_PRODUCT
  }
]

export const ethernetSupportNetwork = {
  avddPinCount: 6,
  fabricationRelease: false,
  integrationRelease: false,
  releaseState: "deny",
  requiredLocalSupplyCapacitors: 7,
  supportNetworkComponents,
  sources: ethernetSupportSources,
  w5500: {
    normalOperationCurrentMa: 132,
    supplyMaximumV: 3.63,
    supplyMinimumV: 2.97,
    targetCrystalAgingMaximumPpmPerYear: 3,
    targetCrystalFrequencyMHz: 25,
    targetCrystalFrequencyToleranceMaximumPpm: 30,
    targetCrystalLoadPf: 18,
    targetCrystalNegativeResistanceMarginFactor: 5,
    targetCrystalNegativeResistanceVerificationCorners: [
      "supply-voltage",
      "temperature",
      "component-tolerance",
      "released-layout"
    ] satisfies readonly NegativeResistanceVerificationCorner[],
    targetCrystalShuntMaximumPf: 7,
    targetCrystalDriveLevelUw: 59.12
  }
} as const

function assertFinitePositive(name: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number`)
  }
}

function assertFiniteNonnegative(name: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite nonnegative number`)
  }
}

function readExactPlainDataRecord(
  name: string,
  value: unknown,
  expectedKeys: readonly string[]
): Record<string, unknown> {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new RangeError(`${name} must be a plain object`)
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new RangeError(`${name} must use Object.prototype`)
    }

    const ownKeys = Reflect.ownKeys(value)
    if (ownKeys.some((key) => typeof key === "symbol")) {
      throw new RangeError(`${name} must not contain symbol keys`)
    }
    const actualKeys = ownKeys.filter((key): key is string => typeof key === "string").sort()
    const canonicalKeys = [...expectedKeys].sort()
    if (actualKeys.length !== canonicalKeys.length || actualKeys.some((key, index) => key !== canonicalKeys[index])) {
      throw new RangeError(`${name} must contain exactly the canonical keys`)
    }

    const record: Record<string, unknown> = {}
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new RangeError(`${name}.${key} must be an enumerable data property`)
      }
      record[key] = descriptor.value
    }
    return record
  } catch (error) {
    if (error instanceof RangeError) {
      throw error
    }
    throw new RangeError(`${name} could not be validated safely`)
  }
}

function readCrystalLoadInput(input: unknown): CrystalLoadInput {
  const record = readExactPlainDataRecord("crystal load input", input, [
    "capacitorPf",
    "capacitorTolerancePercent",
    "strayCapacitancePf",
    "crystalDriveMaximumUw",
    "crystalEsrMaximumOhm"
  ])
  assertFinitePositive("crystal capacitor", record.capacitorPf)
  assertFiniteNonnegative("crystal capacitor tolerance", record.capacitorTolerancePercent)
  assertFiniteNonnegative("crystal stray capacitance", record.strayCapacitancePf)
  assertFinitePositive("crystal drive maximum", record.crystalDriveMaximumUw)
  assertFinitePositive("crystal ESR maximum", record.crystalEsrMaximumOhm)
  if (record.capacitorTolerancePercent >= 100) {
    throw new RangeError("crystal capacitor tolerance must be less than 100 percent")
  }
  return {
    capacitorPf: record.capacitorPf,
    capacitorTolerancePercent: record.capacitorTolerancePercent,
    crystalDriveMaximumUw: record.crystalDriveMaximumUw,
    crystalEsrMaximumOhm: record.crystalEsrMaximumOhm,
    strayCapacitancePf: record.strayCapacitancePf
  }
}

function readCrystalQualificationInput(input: unknown): CrystalQualificationInput {
  const record = readExactPlainDataRecord("crystal qualification input", input, [
    "agingMaximumPpmPerYear",
    "driveLevelMaximumUw",
    "esrMaximumOhm",
    "frequencyMHz",
    "frequencyTolerancePpm",
    "loadCapacitancePf",
    "shuntCapacitancePf"
  ])
  assertFiniteNonnegative("crystal aging maximum", record.agingMaximumPpmPerYear)
  assertFinitePositive("crystal drive maximum", record.driveLevelMaximumUw)
  assertFinitePositive("crystal ESR maximum", record.esrMaximumOhm)
  assertFinitePositive("crystal frequency", record.frequencyMHz)
  assertFiniteNonnegative("crystal frequency tolerance", record.frequencyTolerancePpm)
  assertFinitePositive("crystal load capacitance", record.loadCapacitancePf)
  assertFiniteNonnegative("crystal shunt capacitance", record.shuntCapacitancePf)
  return {
    agingMaximumPpmPerYear: record.agingMaximumPpmPerYear,
    driveLevelMaximumUw: record.driveLevelMaximumUw,
    esrMaximumOhm: record.esrMaximumOhm,
    frequencyMHz: record.frequencyMHz,
    frequencyTolerancePpm: record.frequencyTolerancePpm,
    loadCapacitancePf: record.loadCapacitancePf,
    shuntCapacitancePf: record.shuntCapacitancePf
  }
}

export function calculateCrystalLoadEnvelope(input: unknown): CrystalLoadEnvelope {
  const checked = readCrystalLoadInput(input)
  const capacitorMinimumPf = checked.capacitorPf * (1 - checked.capacitorTolerancePercent / 100)
  const capacitorMaximumPf = checked.capacitorPf * (1 + checked.capacitorTolerancePercent / 100)
  const effectiveLoadMinimumPf = capacitorMinimumPf / 2 + checked.strayCapacitancePf
  const effectiveLoadMaximumPf = capacitorMaximumPf / 2 + checked.strayCapacitancePf
  const targetLoadPf = ethernetSupportNetwork.w5500.targetCrystalLoadPf
  const negativeResistanceMarginFactor = ethernetSupportNetwork.w5500.targetCrystalNegativeResistanceMarginFactor

  return {
    candidateDriveMaximumUw: checked.crystalDriveMaximumUw,
    candidateEsrMaximumOhm: checked.crystalEsrMaximumOhm,
    driveHeadroomUw: checked.crystalDriveMaximumUw - ethernetSupportNetwork.w5500.targetCrystalDriveLevelUw,
    driveMarginFactor: checked.crystalDriveMaximumUw / ethernetSupportNetwork.w5500.targetCrystalDriveLevelUw,
    effectiveLoadMaximumPf,
    effectiveLoadMinimumPf,
    esrCheck: "requires-measured-negative-resistance",
    minimumMeasuredNegativeResistanceOhm: checked.crystalEsrMaximumOhm * negativeResistanceMarginFactor,
    negativeResistanceMarginFactor,
    negativeResistanceVerificationCorners:
      ethernetSupportNetwork.w5500.targetCrystalNegativeResistanceVerificationCorners,
    targetLoadPf,
    targetLoadWindowPass: effectiveLoadMinimumPf <= targetLoadPf && targetLoadPf <= effectiveLoadMaximumPf
  }
}

export function qualifyW5500Crystal(input: unknown): CrystalQualification {
  const checked = readCrystalQualificationInput(input)
  const requirement = ethernetSupportNetwork.w5500
  const agingPass = checked.agingMaximumPpmPerYear <= requirement.targetCrystalAgingMaximumPpmPerYear
  const drivePass = checked.driveLevelMaximumUw >= requirement.targetCrystalDriveLevelUw
  const esrPublishedPass = checked.esrMaximumOhm > 0
  const frequencyPass = checked.frequencyMHz === requirement.targetCrystalFrequencyMHz
  const loadPass = checked.loadCapacitancePf === requirement.targetCrystalLoadPf
  const shuntPass = checked.shuntCapacitancePf <= requirement.targetCrystalShuntMaximumPf
  const tolerancePass = checked.frequencyTolerancePpm <= requirement.targetCrystalFrequencyToleranceMaximumPpm
  const publishedSpecificationPass =
    agingPass && drivePass && esrPublishedPass && frequencyPass && loadPass && shuntPass && tolerancePass
  return {
    agingPass,
    drivePass,
    esrPublishedPass,
    frequencyPass,
    loadPass,
    negativeResistanceProductionMinimumOhm:
      checked.esrMaximumOhm * requirement.targetCrystalNegativeResistanceMarginFactor,
    overallPass: false,
    publishedSpecificationPass,
    releasePass: false,
    shuntPass,
    tolerancePass
  }
}

function assertCanonicalValue(value: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(value, expected)) {
      throw new RangeError(`${path} does not match the canonical value`)
    }
    return
  }
  if (typeof value !== "object" || value === null) {
    throw new RangeError(`${path} must match the canonical object topology`)
  }
  if (seen.has(value)) {
    throw new RangeError(`${path} must not contain cycles or aliases`)
  }
  seen.add(value)

  if (Array.isArray(expected)) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      throw new RangeError(`${path} must match the canonical array topology`)
    }
    const expectedKeys = [...expected.keys()].map(String).concat("length").sort()
    const actualKeys = Reflect.ownKeys(value)
    if (actualKeys.some((key) => typeof key === "symbol")) {
      throw new RangeError(`${path} must not contain symbol keys`)
    }
    const actualStringKeys = actualKeys.filter((key): key is string => typeof key === "string").sort()
    if (
      actualStringKeys.length !== expectedKeys.length ||
      actualStringKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new RangeError(`${path} must contain exactly the canonical array keys`)
    }
    if (value.length !== expected.length) {
      throw new RangeError(`${path}.length does not match the canonical value`)
    }
    for (const [index, expectedEntry] of expected.entries()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new RangeError(`${path}[${index}] must be an enumerable data property`)
      }
      assertCanonicalValue(descriptor.value, expectedEntry, `${path}[${index}]`, seen)
    }
    return
  }

  const expectedKeys = Object.keys(expected)
  const record = readExactPlainDataRecord(path, value, expectedKeys)
  for (const key of expectedKeys) {
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (expectedDescriptor === undefined || !("value" in expectedDescriptor)) {
      throw new RangeError(`${path}.${key} has an invalid canonical descriptor`)
    }
    assertCanonicalValue(record[key], expectedDescriptor.value, `${path}.${key}`, seen)
  }
}

export function validateEthernetSupportNetwork(value: unknown): true {
  try {
    assertCanonicalValue(value, ethernetSupportNetwork, "ethernetSupportNetwork", new WeakSet<object>())
    return true
  } catch (error) {
    if (error instanceof RangeError) {
      throw error
    }
    throw new RangeError("ethernetSupportNetwork could not be validated safely")
  }
}

export const ethernetCrystalQualification = qualifyW5500Crystal({
  agingMaximumPpmPerYear: 2,
  driveLevelMaximumUw: 200,
  esrMaximumOhm: 40,
  frequencyMHz: 25,
  frequencyTolerancePpm: 20,
  loadCapacitancePf: 18,
  shuntCapacitancePf: 2
})

export const ethernetCrystalLoadEnvelope = calculateCrystalLoadEnvelope({
  capacitorPf: 18,
  capacitorTolerancePercent: 5,
  crystalDriveMaximumUw: 200,
  crystalEsrMaximumOhm: 40,
  strayCapacitancePf: 9
})
