/**
 * Harness selection is intentionally an integrated-DNP contract. It names the
 * production connector families and wire construction on the scoring I/O
 * model without turning any connector into a fabrication artifact.
 */

export type HarnessPin = {
  readonly function: string
  readonly pin: number
  readonly terminalInstalled: boolean
  readonly wire: string
}

export type ProductionHarness = {
  readonly boardIntegrationState: "integrated-dnp"
  readonly boardReference: "J_WEAPON_HARNESS_L" | "J_WEAPON_HARNESS_R" | "J_PISTE_HARNESS" | "J_PRIMARY_OUTPUTS_HARNESS"
  readonly cable: {
    readonly conductorCount: number
    readonly construction: string
    readonly manufacturer: "Alpha Wire"
    readonly mpn: string
    readonly operatingTemperatureMaximumC: number
    readonly unusedCorePolicy: string
    readonly voltageMaximumV: number
    readonly wireGaugeAwg: number
  }
  readonly connector: {
    readonly circuitCount: number
    readonly configuredDrawingState: "acquisition-gate"
    readonly crimpValidationState: "open"
    readonly deratingState: "open"
    readonly durabilityMatingCyclesMaximum: number
    readonly headerGender: "male"
    readonly headerMpn: string
    readonly headerOrientation: "right-angle"
    readonly housingGender: "female-receptacle"
    readonly locking: true
    readonly mateHousingMpn: string
    readonly mateTerminalMpn: string
    readonly manufacturer: "Molex"
    readonly maximumCurrentPerContactA: number
    readonly maximumVoltageV: number
    readonly operatingTemperatureMaximumC: number
    readonly pitchMm: number
    readonly polarized: true
    readonly retentionBasis: string
    readonly retentionEvidenceState: "open"
    readonly series: "Micro-Fit 3.0" | "Mini-Fit Jr."
    readonly shrouded: true
    readonly terminalWireGaugeAwg: {
      readonly maximum: number
      readonly minimum: number
      readonly selected: number
    }
  }
  readonly function: "left-weapon" | "right-weapon" | "piste" | "primary-lamp-buzzer"
  readonly harnessBuildState: "unbuilt"
  readonly id: string
  readonly keyingStrategy: string
  readonly pins: readonly HarnessPin[]
  readonly primarySourceUrls: readonly string[]
  readonly releaseGates: readonly string[]
  readonly returnShieldEsdPolicy: string
  readonly serviceLoadPath: string
}

const commonReleaseGates = [
  "configured 2, 3, and 4-circuit Micro-Fit drawings and the configured 6-circuit Mini-Fit drawing remain acquisition gates for header orientation, pin one, land pattern, mask, paste, courtyard, and board edge clearance",
  "manufacturer CAD and footprint are independently reviewed against the released scoring I/O board",
  "harness drawing, crimp tooling, pull test, continuity test, and 100 percent pinout inspection are released",
  "enclosure tie-down transfers cable and plug loads to chassis hardware rather than PCB solder joints",
  "bench tests cover contact temperature, vibration, retention, de-energized service, and all expected weapon and output loads",
  "ESD, EFT, cable coupling, and emissions tests close the analog and primary-output EMC paths"
] as const

const microFitSources = [
  "https://www.molex.com/en-us/products/series-chart/43650",
  "https://www.molex.com/en-us/products/series-chart/43645",
  "https://www.molex.com/en-us/products/part-detail/430300007",
  "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43650/436500200_sd.pdf",
  "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/436/43645/436450600_sd.pdf"
] as const

export const productionHarnessSelection = [
  {
    boardIntegrationState: "integrated-dnp",
    boardReference: "J_WEAPON_HARNESS_L",
    cable: {
      conductorCount: 3,
      construction: "three conductor, 22 AWG stranded tinned copper, unshielded TPE control cable",
      manufacturer: "Alpha Wire",
      mpn: "45003",
      operatingTemperatureMaximumC: 125,
      unusedCorePolicy: "none",
      voltageMaximumV: 300,
      wireGaugeAwg: 22
    },
    connector: {
      circuitCount: 3,
      configuredDrawingState: "acquisition-gate",
      crimpValidationState: "open",
      deratingState: "open",
      durabilityMatingCyclesMaximum: 30,
      headerGender: "male",
      headerMpn: "43650-0300",
      headerOrientation: "right-angle",
      housingGender: "female-receptacle",
      locking: true,
      mateHousingMpn: "43645-0300",
      mateTerminalMpn: "43030-0007",
      manufacturer: "Molex",
      maximumCurrentPerContactA: 7,
      maximumVoltageV: 600,
      operatingTemperatureMaximumC: 105,
      pitchMm: 3,
      polarized: true,
      retentionBasis: "integral positive latch; separate chassis cable clamp required for service loads",
      retentionEvidenceState: "open",
      series: "Micro-Fit 3.0",
      shrouded: true,
      terminalWireGaugeAwg: { maximum: 24, minimum: 20, selected: 22 }
    },
    function: "left-weapon",
    harnessBuildState: "unbuilt",
    id: "left-weapon-micro-fit-3",
    keyingStrategy:
      "A three-circuit shrouded Micro-Fit 3.0 header is mechanically distinct from the four-circuit right weapon header. The enclosure label and harness label both read LEFT WEAPON.",
    pins: [
      { function: "weapon A", pin: 1, terminalInstalled: true, wire: "Alpha Wire 45003 black core" },
      { function: "weapon B", pin: 2, terminalInstalled: true, wire: "Alpha Wire 45003 brown core" },
      { function: "weapon C", pin: 3, terminalInstalled: true, wire: "Alpha Wire 45003 red core" }
    ],
    primarySourceUrls: [
      ...microFitSources,
      "https://www.molex.com/en-us/products/part-detail/436500300",
      "https://www.molex.com/en-us/products/part-detail/436450300",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45003"
    ],
    releaseGates: commonReleaseGates,
    returnShieldEsdPolicy:
      "There is no cable shield or chassis bond. A, B, and C enter the connector-side ESD clamp and analog fault path. No cable conductor is an ESD or logic-ground return.",
    serviceLoadPath:
      "A chassis-mounted cable clamp within 25 mm of the board connector is required. The Micro-Fit latch and through-hole solder joints are electrical interconnects, not the load path."
  },
  {
    boardIntegrationState: "integrated-dnp",
    boardReference: "J_WEAPON_HARNESS_R",
    cable: {
      conductorCount: 4,
      construction: "four conductor, 22 AWG stranded tinned copper, unshielded TPE control cable",
      manufacturer: "Alpha Wire",
      mpn: "45004",
      operatingTemperatureMaximumC: 125,
      unusedCorePolicy:
        "orange fourth core is trimmed, individually insulated, and floating at both ends; it does not enter connector cavity four",
      voltageMaximumV: 300,
      wireGaugeAwg: 22
    },
    connector: {
      circuitCount: 4,
      configuredDrawingState: "acquisition-gate",
      crimpValidationState: "open",
      deratingState: "open",
      durabilityMatingCyclesMaximum: 30,
      headerGender: "male",
      headerMpn: "43650-0400",
      headerOrientation: "right-angle",
      housingGender: "female-receptacle",
      locking: true,
      mateHousingMpn: "43645-0400",
      mateTerminalMpn: "43030-0007",
      manufacturer: "Molex",
      maximumCurrentPerContactA: 7,
      maximumVoltageV: 600,
      operatingTemperatureMaximumC: 105,
      pitchMm: 3,
      polarized: true,
      retentionBasis: "integral positive latch; separate chassis cable clamp required for service loads",
      retentionEvidenceState: "open",
      series: "Micro-Fit 3.0",
      shrouded: true,
      terminalWireGaugeAwg: { maximum: 24, minimum: 20, selected: 22 }
    },
    function: "right-weapon",
    harnessBuildState: "unbuilt",
    id: "right-weapon-micro-fit-4",
    keyingStrategy:
      "The three-circuit versus four-circuit connector size is the mechanical noninterchange feature. Cavity four is intentionally empty with no terminal and no conductor entering it; the empty cavity is not the key.",
    pins: [
      { function: "weapon A", pin: 1, terminalInstalled: true, wire: "Alpha Wire 45004 black core" },
      { function: "weapon B", pin: 2, terminalInstalled: true, wire: "Alpha Wire 45004 brown core" },
      { function: "weapon C", pin: 3, terminalInstalled: true, wire: "Alpha Wire 45004 red core" },
      {
        function: "intentional empty cavity",
        pin: 4,
        terminalInstalled: false,
        wire: "no terminal and no conductor enters cavity four"
      }
    ],
    primarySourceUrls: [
      ...microFitSources,
      "https://www.molex.com/en-us/products/part-detail/436500400",
      "https://www.molex.com/en-us/products/part-detail/436450400",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45004"
    ],
    releaseGates: commonReleaseGates,
    returnShieldEsdPolicy:
      "There is no cable shield or chassis bond. A, B, and C enter the connector-side ESD clamp and analog fault path. The orange fourth cable core is trimmed, individually insulated, and floating at both ends and does not enter cavity four.",
    serviceLoadPath:
      "A chassis-mounted cable clamp within 25 mm of the board connector is required. The Micro-Fit latch and through-hole solder joints are electrical interconnects, not the load path."
  },
  {
    boardIntegrationState: "integrated-dnp",
    boardReference: "J_PISTE_HARNESS",
    cable: {
      conductorCount: 2,
      construction: "two conductor, 22 AWG stranded tinned copper, unshielded TPE control cable",
      manufacturer: "Alpha Wire",
      mpn: "45002",
      operatingTemperatureMaximumC: 125,
      unusedCorePolicy: "none",
      voltageMaximumV: 300,
      wireGaugeAwg: 22
    },
    connector: {
      circuitCount: 2,
      configuredDrawingState: "acquisition-gate",
      crimpValidationState: "open",
      deratingState: "open",
      durabilityMatingCyclesMaximum: 30,
      headerGender: "male",
      headerMpn: "43650-0200",
      headerOrientation: "right-angle",
      housingGender: "female-receptacle",
      locking: true,
      mateHousingMpn: "43645-0200",
      mateTerminalMpn: "43030-0007",
      manufacturer: "Molex",
      maximumCurrentPerContactA: 7,
      maximumVoltageV: 600,
      operatingTemperatureMaximumC: 105,
      pitchMm: 3,
      polarized: true,
      retentionBasis: "integral positive latch; separate chassis cable clamp required for service loads",
      retentionEvidenceState: "open",
      series: "Micro-Fit 3.0",
      shrouded: true,
      terminalWireGaugeAwg: { maximum: 24, minimum: 20, selected: 22 }
    },
    function: "piste",
    harnessBuildState: "unbuilt",
    id: "piste-micro-fit-2",
    keyingStrategy:
      "A two-circuit shrouded Micro-Fit 3.0 header is mechanically distinct from both weapon interfaces. The enclosure label and harness label both read PISTE.",
    pins: [
      { function: "piste signal", pin: 1, terminalInstalled: true, wire: "Alpha Wire 45002 black core" },
      {
        function: "piste return to connector-side ESD return",
        pin: 2,
        terminalInstalled: true,
        wire: "Alpha Wire 45002 brown core"
      }
    ],
    primarySourceUrls: [
      ...microFitSources,
      "https://www.molex.com/en-us/products/part-detail/436500200",
      "https://www.molex.com/en-us/products/part-detail/436450200",
      "https://www.alphawire.com/products/cable/xtra-guard-performance-cable/xtra-guard-4/45002"
    ],
    releaseGates: commonReleaseGates,
    returnShieldEsdPolicy:
      "The temporary scoring-board pin label SHIELD is assigned to the second insulated conductor as PISTE_RETURN and routes only to connector-side ESD_RETURN. This selected cable has no shield, no drain, and no chassis bond. It makes no shielding or EMC-performance claim.",
    serviceLoadPath:
      "A chassis-mounted cable clamp within 25 mm of the board connector is required. The Micro-Fit latch and through-hole solder joints are electrical interconnects, not the load path."
  },
  {
    boardIntegrationState: "integrated-dnp",
    boardReference: "J_PRIMARY_OUTPUTS_HARNESS",
    cable: {
      conductorCount: 6,
      construction: "six conductor, 18 AWG stranded tinned copper, unshielded TPE control cable",
      manufacturer: "Alpha Wire",
      mpn: "45066",
      operatingTemperatureMaximumC: 125,
      unusedCorePolicy: "none",
      voltageMaximumV: 300,
      wireGaugeAwg: 18
    },
    connector: {
      circuitCount: 6,
      configuredDrawingState: "acquisition-gate",
      crimpValidationState: "open",
      deratingState: "open",
      durabilityMatingCyclesMaximum: 30,
      headerGender: "male",
      headerMpn: "39-29-1067",
      headerOrientation: "right-angle",
      housingGender: "female-receptacle",
      locking: true,
      mateHousingMpn: "39-01-2060",
      mateTerminalMpn: "39-00-0039",
      manufacturer: "Molex",
      maximumCurrentPerContactA: 9,
      maximumVoltageV: 600,
      operatingTemperatureMaximumC: 105,
      pitchMm: 4.2,
      polarized: true,
      retentionBasis:
        "integral positive latch plus PCB mounting flange; separate chassis cable clamp required for service loads",
      retentionEvidenceState: "open",
      series: "Mini-Fit Jr.",
      shrouded: true,
      terminalWireGaugeAwg: { maximum: 24, minimum: 18, selected: 18 }
    },
    function: "primary-lamp-buzzer",
    harnessBuildState: "unbuilt",
    id: "primary-output-mini-fit-6",
    keyingStrategy:
      "The dual-row six-circuit Mini-Fit Jr. interface is a different series, pitch, and latch from all body-cord and piste harnesses. The enclosure label and harness label both read PRIMARY OUTPUTS.",
    pins: [
      { function: "red lamp output", pin: 1, terminalInstalled: true, wire: "Alpha Wire 45066 black core" },
      { function: "green lamp output", pin: 2, terminalInstalled: true, wire: "Alpha Wire 45066 red core" },
      { function: "left white lamp output", pin: 3, terminalInstalled: true, wire: "Alpha Wire 45066 white core" },
      { function: "right white lamp output", pin: 4, terminalInstalled: true, wire: "Alpha Wire 45066 green core" },
      { function: "buzzer output", pin: 5, terminalInstalled: true, wire: "Alpha Wire 45066 orange core" },
      { function: "primary output return", pin: 6, terminalInstalled: true, wire: "Alpha Wire 45066 blue core" }
    ],
    primarySourceUrls: [
      "https://www.molex.com/en-us/products/part-detail/39291067",
      "https://www.molex.com/en-us/products/part-detail/39012060",
      "https://www.molex.com/en-us/products/part-detail/39000039",
      "https://www.molex.com/en-us/products/series-chart/5569",
      "https://www.alphawire.com/disteAPI/SpecPDF/DownloadProductSpecPdf?productPartNumber=45066"
    ],
    releaseGates: [
      ...commonReleaseGates,
      "the selected primary lamp and buzzer loads, output-driver voltage, fault behavior, and continuous and peak current are reconciled to every contact and the common return",
      "no channel receives a connector current or thermal pass until the exact driver, cable length, enclosure, and ambient test are complete"
    ],
    returnShieldEsdPolicy:
      "Pin six is the dedicated primary-output return to the scoring-domain return at the driver. This selected cable has no shield, no drain, and no chassis bond. It makes no shielding or output-EMC-performance claim.",
    serviceLoadPath:
      "A chassis-mounted cable clamp within 25 mm of the board connector is required. The Mini-Fit latch, mounting flange, and through-hole solder joints are electrical interconnects, not the load path for service or cable force."
  }
] as const satisfies readonly ProductionHarness[]

function ownDataValue(owner: object, key: PropertyKey, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key)
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new RangeError(`${path} must not contain accessors`)
  }
  return descriptor.value
}

function ownStringKeys(owner: object, path: string): string[] {
  const keys = Reflect.ownKeys(owner)
  if (keys.some((key) => typeof key === "symbol")) {
    throw new RangeError(`${path} must not contain symbol keys`)
  }
  return keys.filter((key): key is string => typeof key === "string")
}

function serializeCanonicalValue(value: unknown, path: string, seen: WeakSet<object>): string {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError(`${path} must contain only finite numbers`)
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new RangeError(`${path} must not contain cycles`)
    const ownKeys = ownStringKeys(value, path)
    const expectedIndexKeys = Array.from({ length: value.length }, (_, index) => String(index))
    const expectedKeys = [...expectedIndexKeys, "length"]
    if (
      ownKeys.length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.hasOwn(value, key)) ||
      ownKeys.some((key) => !expectedKeys.includes(key))
    ) {
      throw new RangeError(`${path} must be a dense array with no extra own keys`)
    }
    seen.add(value)
    const serialized = `[${expectedIndexKeys
      .map((key, index) =>
        serializeCanonicalValue(ownDataValue(value, key, `${path}[${index}]`), `${path}[${index}]`, seen)
      )
      .join(",")}]`
    seen.delete(value)
    return serialized
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RangeError(`${path} must contain only plain objects`)
    }
    if (seen.has(value)) throw new RangeError(`${path} must not contain cycles`)
    const ownKeys = ownStringKeys(value, path)
    seen.add(value)
    const serializedEntries = [...ownKeys]
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeCanonicalValue(ownDataValue(value, key, `${path}.${key}`), `${path}.${key}`, seen)}`
      )
    seen.delete(value)
    return `{${serializedEntries.join(",")}}`
  }
  throw new RangeError(`${path} contains an unsupported value`)
}

const canonicalProductionHarnessSerialization = serializeCanonicalValue(
  productionHarnessSelection,
  "production harness selection",
  new WeakSet()
)

/**
 * Fail-closed runtime boundary. Every nested field, exact value, array order,
 * URL, gate, policy, and pin assignment must match the reviewed canonical
 * selection. Object property order is intentionally irrelevant.
 */
export function validateProductionHarnessSelection(harnesses: unknown = productionHarnessSelection): void {
  if (!Array.isArray(harnesses)) throw new RangeError("production harness selection must be an array")
  const serialized = serializeCanonicalValue(harnesses, "production harness selection", new WeakSet())
  if (serialized !== canonicalProductionHarnessSerialization) {
    throw new RangeError("production harness selection must exactly match the reviewed canonical contract")
  }
}

export const productionHarnessFabricationState = {
  fabricationAuthorized: false,
  state: "deny" as const,
  reason:
    "The selected connector and cable families are integrated DNP only. Configured drawings, CAD, footprints, harness build, strain relief, EMC, and bench evidence remain mandatory."
} as const

validateProductionHarnessSelection()
