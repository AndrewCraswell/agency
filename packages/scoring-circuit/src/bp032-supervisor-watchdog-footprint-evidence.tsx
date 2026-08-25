import { Fragment, type ReactElement } from "react"

type PinDefinition = {
  readonly number: number
  readonly name: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

type ThermalVia = {
  readonly xMm: number
  readonly yMm: number
  readonly drillDiameterMm: number
}

type OfficialSource = {
  readonly id: string
  readonly authority: "manufacturer-primary"
  readonly documentNumber: string
  readonly url: string
  readonly artifactPath: string
  readonly sha256: string
  readonly reviewedPages: readonly number[]
  readonly documentScope: "series-datasheet"
  readonly exactOrderableEvidence: {
    readonly exactMpn: string
    readonly page: number
    readonly packageRow: string
    readonly status: "exact-orderable-row"
  }
  readonly packageGeometryEvidence: {
    readonly packageDrawing: string
    readonly pages: readonly number[]
    readonly status: "package-level-example-not-exact-cad"
  }
  readonly role: string
}

const bp123SourcePath = "packages/scoring-circuit/src/bench-prototype-reset-watchdog.ts"
const bp123SourceSha256 = "0F10F1E308C0B3760C38A5A30405D727F1115BFFAC1C3F141D8EAF8789DD7E23"
const bp123FragmentPath = "packages/scoring-circuit/src/bp-123-reset-watchdog-fragment.circuit.tsx"
const bp123FragmentSha256 = "4E5B3A84F6B1F22F233665B94AED9CAFF3151446D4272250D25E090619AF822C"
const bp123GeometryNetDigest = "fb93b8246349389cb25c7ff69aba7d0ec0257dc5681c2ccd0161f345cbf21958"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-032 evidence graph cannot contain cycles or aliases")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new RangeError("BP-032 evidence graph may contain only plain records and arrays")
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") throw new RangeError("BP-032 evidence graph cannot contain symbol keys")
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 evidence graph may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  if (typeof actual !== "object" || actual === null || typeof expected !== "object" || expected === null) {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol") ||
    actualKeys.length !== expectedKeys.length ||
    !actualKeys.every((key) => expectedKeys.includes(key))
  ) {
    return false
  }
  if (Array.isArray(actual)) {
    if (!Array.isArray(expected) || actual.length !== expected.length) return false
  } else if (Array.isArray(expected)) {
    return false
  }

  return actualKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.writable !== expectedDescriptor.writable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable
    ) {
      return false
    }
    return sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
  })
}

function inspectPlainDataGraph(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return
  if (seen.has(value)) throw new RangeError("BP-032 evidence graph contains a cycle or alias")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new RangeError("BP-032 evidence graph contains a non-plain record")
  }
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) throw new RangeError("BP-032 evidence graph contains a symbol key")
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new RangeError("BP-032 evidence graph contains a sparse array")
      }
    }
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 evidence graph contains an accessor")
    }
    inspectPlainDataGraph(descriptor.value, seen)
  }
}

const tps3431Pins: readonly PinDefinition[] = [
  { number: 1, name: "VDD", xMm: -1.1, yMm: 0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 2, name: "CWD", xMm: -1.1, yMm: 0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 3, name: "EN", xMm: -1.1, yMm: -0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 4, name: "GND", xMm: -1.1, yMm: -0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 5, name: "SET1", xMm: 1.1, yMm: -0.975, widthMm: 0.6, heightMm: 0.31 },
  { number: 6, name: "WDI", xMm: 1.1, yMm: -0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 7, name: "WDO", xMm: 1.1, yMm: 0.325, widthMm: 0.6, heightMm: 0.31 },
  { number: 8, name: "ENOUT", xMm: 1.1, yMm: 0.975, widthMm: 0.6, heightMm: 0.31 }
] as const

const tps3431ThermalVias: readonly ThermalVia[] = [
  { xMm: 0, yMm: 0.625, drillDiameterMm: 0.2 },
  { xMm: -0.625, yMm: 0, drillDiameterMm: 0.2 },
  { xMm: 0.625, yMm: 0, drillDiameterMm: 0.2 },
  { xMm: 0, yMm: -0.625, drillDiameterMm: 0.2 }
] as const

const tps3890Pins: readonly PinDefinition[] = [
  { number: 1, name: "SENSE", xMm: -0.6, yMm: 0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 2, name: "GND", xMm: -0.6, yMm: 0, widthMm: 0.7, heightMm: 0.25 },
  { number: 3, name: "MR", xMm: -0.6, yMm: -0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 4, name: "VDD", xMm: 0.6, yMm: -0.5, widthMm: 0.7, heightMm: 0.25 },
  { number: 5, name: "CT", xMm: 0.6, yMm: 0, widthMm: 0.7, heightMm: 0.25 },
  { number: 6, name: "RESET", xMm: 0.6, yMm: 0.5, widthMm: 0.7, heightMm: 0.25 }
] as const

function makeTps3431Source(): OfficialSource {
  return {
    id: "ti-tps3431-snvSB66a-bp032",
    authority: "manufacturer-primary",
    documentNumber: "TPS3431 Standard Programmable Watchdog Timer with Enable datasheet, Rev. A",
    url: "https://www.ti.com/lit/ds/symlink/tps3431.pdf",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/ti-tps3431.pdf",
    sha256: "99BF5DBFFFE06E8F85D9A86CFB777A0151E85B4A103033BC025F4897A0BDC6F3",
    reviewedPages: [3, 23, 28, 29, 30],
    documentScope: "series-datasheet",
    exactOrderableEvidence: {
      exactMpn: "TPS3431SDRBR",
      page: 23,
      packageRow: "TPS3431SDRBR; SON (DRB) | 8",
      status: "exact-orderable-row"
    },
    packageGeometryEvidence: {
      packageDrawing: "DRB0008A",
      pages: [28, 29, 30],
      status: "package-level-example-not-exact-cad"
    },
    role: "Series datasheet with exact TPS3431SDRBR orderable-row identity; DRB0008A package outline, pin map, land pattern, mask options, and stencil example. The package pages do not constitute an exact released CAD footprint."
  }
}

function makeTps3890Source(): OfficialSource {
  return {
    id: "ti-tps3890-slvSD65a-bp032",
    authority: "manufacturer-primary",
    documentNumber: "TPS3890 Low Quiescent Current, 1% Accurate Supervisor with Programmable Delay datasheet, Rev. A",
    url: "https://www.ti.com/lit/ds/symlink/tps3890.pdf",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/ti-tps3890.pdf",
    sha256: "EE79599730E7606BA9718D9820B411020E3DCD9FF7D44572F8EE63FEAD15B9D0",
    reviewedPages: [3, 19, 24, 25, 26],
    documentScope: "series-datasheet",
    exactOrderableEvidence: {
      exactMpn: "TPS389033DSER",
      page: 19,
      packageRow: "TPS389033DSER; WSON (DSE) | 6",
      status: "exact-orderable-row"
    },
    packageGeometryEvidence: {
      packageDrawing: "DSE0006A",
      pages: [24, 25, 26],
      status: "package-level-example-not-exact-cad"
    },
    role: "Series datasheet with exact TPS389033DSER orderable-row identity; DSE0006A package outline, pin map, land pattern, mask options, and stencil example. The package pages do not constitute an exact released CAD footprint."
  }
}

function manufacturerCadNotRetained() {
  return {
    state: "not-retained-official-cad",
    officialCadArtifact: null,
    disposition: "datasheet-only-candidate-no-fabrication-release",
    copper: "manufacturer-datasheet-land-pattern",
    solderMask: "manufacturer-datasheet-example-options",
    paste: "manufacturer-datasheet-stencil-example",
    courtyard: "not-published-by-TI",
    note: "Only retained TI datasheet PDFs are used. No TI CAD archive, library footprint, courtyard, mask file, or paste file is substituted."
  } as const
}

function makeTps3431Geometry(source: OfficialSource) {
  return {
    artifactKind: "bp032-ti-tps3431sdrbr-review-candidate",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPS3431SDRBR",
    package: {
      family: "VSON-8",
      packageDrawing: "DRB0008A",
      bodyNominalMm: { widthMm: 3, lengthMm: 3, heightMaxMm: 1 },
      bodyLimitsMm: { widthMm: { min: 2.9, max: 3.1 }, lengthMm: { min: 2.9, max: 3.1 } },
      pinCount: 8,
      exposedThermalPad: true,
      thermalPadNet: "GND"
    },
    pinMap: tps3431Pins.map((pin) => ({ ...pin })),
    officialSources: [source],
    manufacturerCad: manufacturerCadNotRetained(),
    landPattern: {
      coordinateOrigin: "nominal package center; TI top view with pin 1 at upper-left",
      perimeterCopper: {
        padCount: 8,
        padDimensionsMm: { lengthMm: 0.6, widthMm: 0.31 },
        cornerRadiusTypMm: 0.05,
        sideRowPitchMm: 0.65,
        sideRowSpanMm: 1.95,
        sideRowCentersXMm: [-1.1, 1.1],
        pads: tps3431Pins.map((pin) => ({ ...pin })),
        source: "TI TPS3431 PDF page 29, DRB0008A example board layout"
      },
      exposedThermalPad: {
        net: "GND",
        copperEnvelopeMm: { widthMm: 1.5, lengthMm: 1.75 },
        viaCount: 4,
        viaLocations: tps3431ThermalVias.map((via) => ({ ...via })),
        viaNote: "TI marks the four 0.2 mm vias optional depending on application.",
        source: "TI TPS3431 PDF page 29, DRB0008A example board layout"
      },
      solderMask: {
        source: "TI TPS3431 PDF page 29 solder-mask details",
        preferredDefinition: "NSMD",
        nsmdOpeningExpansionMaxMm: 0.07,
        smdOpeningOverlapMinMm: 0.07,
        appliesTo: "manufacturer exposed-metal example; verify pad-by-pad mask rules with fabricator"
      },
      paste: {
        source: "TI TPS3431 PDF page 30, DRB0008A example stencil design",
        perimeterApertureMm: { lengthMm: 0.6, widthMm: 0.31, count: 8 },
        thermalPad: {
          stencilThicknessMm: 0.125,
          printedCoveragePercent: 84,
          drawnEnvelopeMm: { widthMm: 1.34, lengthMm: 1.55 },
          geometryStatus: "coverage-and-envelope-published; aperture segmentation not transcribed"
        },
        disposition: "manufacturer-example-only-review-data-not-stencil-release"
      },
      courtyard: {
        status: "not-published",
        geometry: null,
        disposition: "do-not-infer-courtyard-from-package-outline"
      }
    },
    orientation: {
      pinOne: { number: 1, xMm: -1.1, yMm: 0.975, marker: "TI package pin 1 index area" },
      nominalBoardRotationDegrees: 0,
      state: "pending-independent-overlay"
    },
    placementImplications: {
      keepout:
        "No package-specific keepout is published or implied; preserve local supply, timing, reset, and ground-routing review.",
      thermal:
        "The exposed GND pad is shown in the TI package example and requires a separately reviewed solder and thermal implementation."
    },
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

function makeTps3890Geometry(source: OfficialSource) {
  return {
    artifactKind: "bp032-ti-tps389033dser-review-candidate",
    manufacturer: "Texas Instruments",
    manufacturerPartNumber: "TPS389033DSER",
    package: {
      family: "WSON-6",
      packageDrawing: "DSE0006A",
      bodyNominalMm: { widthMm: 1.5, lengthMm: 1.5, heightMaxMm: 0.8 },
      bodyLimitsMm: { widthMm: { min: 1.45, max: 1.55 }, lengthMm: { min: 1.45, max: 1.55 } },
      pinCount: 6,
      exposedThermalPad: false,
      thermalPadNet: null
    },
    pinMap: tps3890Pins.map((pin) => ({ ...pin })),
    officialSources: [source],
    manufacturerCad: manufacturerCadNotRetained(),
    landPattern: {
      coordinateOrigin: "nominal package center; TI top view with pin 1 at upper-left",
      perimeterCopper: {
        padCount: 6,
        padDimensionsMm: { lengthMm: 0.7, widthMm: 0.25 },
        cornerRadiusTypMm: 0.05,
        sideRowPitchMm: 0.5,
        sideRowSpanMm: 1,
        sideRowCentersXMm: [-0.6, 0.6],
        pads: tps3890Pins.map((pin) => ({ ...pin })),
        source: "TI TPS3890 PDF page 25, DSE0006A example board layout"
      },
      exposedThermalPad: null,
      solderMask: {
        source: "TI TPS3890 PDF page 25 solder-mask details",
        pads1to3: { definition: "SMD", openingOverlapMinMm: 0.05 },
        pads4to6: { definition: "NSMD preferred", openingExpansionMaxMm: 0.05 }
      },
      paste: {
        source: "TI TPS3890 PDF page 26, DSE0006A example stencil design",
        stencilThicknessMm: 0.125,
        apertureMm: { lengthMm: 0.7, widthMm: 0.25, count: 6 },
        cornerRadiusTypMm: 0.05,
        disposition: "manufacturer-example-only-review-data-not-stencil-release"
      },
      courtyard: {
        status: "not-published",
        geometry: null,
        disposition: "do-not-infer-courtyard-from-package-outline"
      }
    },
    orientation: {
      pinOne: { number: 1, xMm: -0.6, yMm: 0.5, marker: "TI package pin 1 index area" },
      nominalBoardRotationDegrees: 0,
      state: "pending-independent-overlay"
    },
    placementImplications: {
      keepout:
        "No package-specific keepout is published or implied; preserve local supply, sense, reset, manual-reset, and timing-routing review.",
      thermal: "No exposed thermal pad is shown in TI DSE0006A."
    },
    fabricationAuthority: "deny",
    accepted: false
  } as const
}

function pinLabels3431(): readonly string[] {
  return ["VDD", "CWD", "EN", "GND", "SET1", "WDI", "WDO", "ENOUT"]
}

function pinLabels3890(): readonly string[] {
  return ["SENSE", "GND", "MR", "VDD", "CT", "RESET"]
}

function createPrivateBaseline() {
  return {
    artifactKind: "bp032-supervisor-watchdog-footprint-evidence",
    workUnit: "BP-032",
    reviewState: "prototype-first-review-only",
    boundary: {
      scope: "isolated supervisor and watchdog footprint evidence for four BP-123 references",
      boardImport: "not-imported-by-a-board-circuit",
      geometryMeaning: "datasheet-transcribed copper and manufacturer example mask/paste values",
      exactVsSeriesRule:
        "the orderable row binds the exact MPN; package geometry pages are series/package-level examples, not exact CAD",
      approval: "review-only-candidate"
    },
    upstreamSelection: {
      sourcePath: bp123SourcePath,
      sourceSha256: bp123SourceSha256,
      sourceContract: "BP-123 exact reset/watchdog part identity; no footprint or fabrication authority",
      fragmentPath: bp123FragmentPath,
      fragmentSha256: bp123FragmentSha256,
      fragmentGeometryNetDigest: bp123GeometryNetDigest,
      expectedReferences: ["U_STM_SUPERVISOR", "U_ESP_SUPERVISOR", "U_STM_WATCHDOG", "U_ESP_WATCHDOG"],
      parts: [
        { reference: "U_STM_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER", packageDrawing: "DSE0006A" },
        { reference: "U_ESP_SUPERVISOR", manufacturerPartNumber: "TPS389033DSER", packageDrawing: "DSE0006A" },
        { reference: "U_STM_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR", packageDrawing: "DRB0008A" },
        { reference: "U_ESP_WATCHDOG", manufacturerPartNumber: "TPS3431SDRBR", packageDrawing: "DRB0008A" }
      ]
    },
    candidates: {
      TPS389033DSER: makeTps3890Geometry(makeTps3890Source()),
      TPS3431SDRBR: makeTps3431Geometry(makeTps3431Source())
    },
    assignments: [
      {
        reference: "U_STM_SUPERVISOR",
        role: "scoring-rail supervisor",
        supplyDomain: "SCORING_3V3",
        manufacturerPartNumber: "TPS389033DSER",
        packageDrawing: "DSE0006A",
        sourceId: "ti-tps3890-slvSD65a-bp032",
        pinLabels: pinLabels3890()
      },
      {
        reference: "U_ESP_SUPERVISOR",
        role: "application-rail supervisor",
        supplyDomain: "V3_3",
        manufacturerPartNumber: "TPS389033DSER",
        packageDrawing: "DSE0006A",
        sourceId: "ti-tps3890-slvSD65a-bp032",
        pinLabels: pinLabels3890()
      },
      {
        reference: "U_STM_WATCHDOG",
        role: "scoring-rail watchdog",
        supplyDomain: "SCORING_3V3",
        manufacturerPartNumber: "TPS3431SDRBR",
        packageDrawing: "DRB0008A",
        sourceId: "ti-tps3431-snvSB66a-bp032",
        pinLabels: pinLabels3431()
      },
      {
        reference: "U_ESP_WATCHDOG",
        role: "application-rail watchdog",
        supplyDomain: "V3_3",
        manufacturerPartNumber: "TPS3431SDRBR",
        packageDrawing: "DRB0008A",
        sourceId: "ti-tps3431-snvSB66a-bp032",
        pinLabels: pinLabels3431()
      }
    ],
    prototypeHandoff: {
      allowed: [
        "Use an isolated coupon or adapter for the prototype; do not place this candidate into the board release.",
        "After independent pin-one inspection, solder short insulated pigtails only to named copper pads for bench probing.",
        "Land a temporary jumper or wire on the coupon test node, never on a package lead or an unverified pad."
      ],
      solderPoints: [
        { packageDrawing: "DSE0006A", points: ["1 SENSE", "2 GND", "3 MR", "4 VDD", "5 CT", "6 RESET"] },
        {
          packageDrawing: "DRB0008A",
          points: ["1 VDD", "2 CWD", "3 EN", "4 GND", "5 SET1", "6 WDI", "7 WDO", "8 ENOUT", "EP GND"]
        }
      ],
      strainRelief: [
        "Anchor every pigtail or probe lead to the coupon or fixture body before energizing.",
        "Do not route tensile load through the package, solder fillet, exposed pad, or via array.",
        "Keep temporary wires short and insulated; remove power before rework or continuity changes."
      ],
      miswireGates: [
        "Verify package, MPN, pin-one index, and pad numbering against the retained TI pages before soldering.",
        "Continuity-check each named pad to its intended net with power removed; reject any short between VDD, GND, reset, or watchdog output.",
        "Current-limit the first power-up and verify VDD-to-GND resistance before inserting the IC.",
        "Do not infer open-drain pullups, reset polarity, or watchdog timing from pad geometry alone."
      ],
      status: "prototype-handoff-guidance-only"
    },
    gates: {
      mechanicalAcceptance: "deny",
      placementAcceptance: "deny",
      cadRelease: "deny",
      fabricationRelease: "deny",
      assemblyRelease: "deny",
      electricalIntegrationAuthority: "deny",
      physicalEvidence: "not-provided",
      requiredBeforeAnyRelease: [
        "independent footprint overlay against the exact package drawing and current fabricator rules",
        "package sample and pin-one/orientation check",
        "board placement, courtyard, keepout, thermal, return-path, and assembly review",
        "official CAD or a separately reviewed library reconstruction if release geometry is required",
        "DRC, stencil, panel, and fabricator acceptance",
        "BP-123 electrical and physical capture gates"
      ]
    }
  } as const
}

const privateFrozenBaseline = deepFreeze(createPrivateBaseline())

/** Public candidate is a frozen clone; validation is anchored to the private baseline above. */
export const bp032SupervisorWatchdogFootprintEvidence = deepFreeze(structuredClone(privateFrozenBaseline))

export function validateBp032SupervisorWatchdogFootprintEvidence(value: unknown): true {
  try {
    inspectPlainDataGraph(value)
    if (!sameDataGraph(value, privateFrozenBaseline, new WeakSet<object>(), new WeakSet<object>())) {
      throw new RangeError("BP-032 supervisor/watchdog footprint evidence drifted from its private reviewed baseline")
    }
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError("BP-032 supervisor/watchdog footprint evidence is not a valid plain data graph")
  }

  const contract = privateFrozenBaseline
  const expectedReferences = new Set(contract.upstreamSelection.expectedReferences)
  const actualReferences = new Set(contract.assignments.map((assignment) => assignment.reference))
  if (
    contract.upstreamSelection.parts.length !== 4 ||
    contract.assignments.length !== 4 ||
    expectedReferences.size !== 4 ||
    actualReferences.size !== 4 ||
    [...expectedReferences].some((reference) => !actualReferences.has(reference)) ||
    contract.assignments.filter((assignment) => assignment.manufacturerPartNumber === "TPS389033DSER").length !== 2 ||
    contract.assignments.filter((assignment) => assignment.manufacturerPartNumber === "TPS3431SDRBR").length !== 2 ||
    contract.candidates.TPS389033DSER.package.pinCount !== 6 ||
    contract.candidates.TPS3431SDRBR.package.pinCount !== 8 ||
    contract.candidates.TPS389033DSER.landPattern.perimeterCopper.padCount !== 6 ||
    contract.candidates.TPS3431SDRBR.landPattern.perimeterCopper.padCount !== 8 ||
    contract.candidates.TPS389033DSER.landPattern.exposedThermalPad !== null ||
    contract.candidates.TPS3431SDRBR.landPattern.exposedThermalPad.viaCount !== 4 ||
    contract.candidates.TPS389033DSER.manufacturerCad.officialCadArtifact !== null ||
    contract.candidates.TPS3431SDRBR.manufacturerCad.officialCadArtifact !== null ||
    contract.candidates.TPS389033DSER.landPattern.courtyard.status !== "not-published" ||
    contract.candidates.TPS3431SDRBR.landPattern.courtyard.status !== "not-published" ||
    contract.candidates.TPS389033DSER.fabricationAuthority !== "deny" ||
    contract.candidates.TPS3431SDRBR.fabricationAuthority !== "deny" ||
    contract.candidates.TPS389033DSER.accepted ||
    contract.candidates.TPS3431SDRBR.accepted ||
    contract.gates.mechanicalAcceptance !== "deny" ||
    contract.gates.placementAcceptance !== "deny" ||
    contract.gates.cadRelease !== "deny" ||
    contract.gates.fabricationRelease !== "deny"
  ) {
    throw new RangeError("BP-032 supervisor/watchdog evidence must remain exact, bounded, and release-denied")
  }
  return true
}

const tps3431Footprint = (
  <footprint name="BP032_TI_TPS3431SDRBR_REVIEW_CANDIDATE" originalLayer="top">
    {tps3431Pins.map((pin) => (
      <Fragment key={`tps3431-pad-${pin.number}`}>
        <smtpad
          name={String(pin.number)}
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          shape="rect"
          width={`${pin.widthMm}mm`}
          height={`${pin.heightMm}mm`}
          portHints={[String(pin.number), pin.name]}
        />
      </Fragment>
    ))}
    <smtpad
      name="EP"
      pcbX={0}
      pcbY={0}
      shape="rect"
      width="1.5mm"
      height="1.75mm"
      solderPasteMargin="-1mm"
      portHints={["EP", "GND", "thermal-pad"]}
    />
    {tps3431ThermalVias.map((via, index) => (
      <Fragment key={`tps3431-via-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          shape="circular_hole_with_rect_pad"
          pcbX={via.xMm}
          pcbY={via.yMm}
          holeDiameter={`${via.drillDiameterMm}mm`}
          rectPadWidth="0.23mm"
          rectPadHeight="0.23mm"
          rectBorderRadius="0mm"
          portHints={["EP", "GND", "thermal-via"]}
        />
      </Fragment>
    ))}
  </footprint>
)

const tps3890Footprint = (
  <footprint name="BP032_TI_TPS389033DSER_REVIEW_CANDIDATE" originalLayer="top">
    {tps3890Pins.map((pin) => (
      <Fragment key={`tps3890-pad-${pin.number}`}>
        <smtpad
          name={String(pin.number)}
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          shape="rect"
          width={`${pin.widthMm}mm`}
          height={`${pin.heightMm}mm`}
          portHints={[String(pin.number), pin.name]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp032SupervisorWatchdogFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review renderers; these are intentionally not imported by a board circuit. */
export function Bp032SupervisorWatchdogTps3431sdrbrFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032SupervisorWatchdogFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_TPS3431SDRBR"
      manufacturerPartNumber="TPS3431SDRBR"
      footprint={tps3431Footprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function Bp032SupervisorWatchdogTps389033dserFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032SupervisorWatchdogFootprintProps = {}): ReactElement {
  return (
    <chip
      name="U_BP032_TPS389033DSER"
      manufacturerPartNumber="TPS389033DSER"
      footprint={tps3890Footprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}
