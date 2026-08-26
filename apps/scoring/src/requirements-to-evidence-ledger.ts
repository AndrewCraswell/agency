/** M0-12 canonical requirements-to-evidence ledger guard. */

export type EvidenceStage = "unit" | "simulator" | "nativeC" | "wasm" | "hil" | "physical"

export type EvidenceOwner = {
  readonly owner: string
  readonly plannedWorkUnits: readonly string[]
  readonly state: "planned" | "blocked"
}

export type RequirementEvidenceRow = {
  readonly stableId: string
  readonly requirementIds: readonly string[]
  readonly kind: "normative" | "hardware" | "security" | "product"
  readonly evidenceOwners: Readonly<Record<EvidenceStage, EvidenceOwner>>
  readonly openGates: readonly string[]
}

export type RequirementSourceBinding = {
  readonly sourceId: "fie" | "device-plan" | "c17-migration" | "bench-plan" | "encrypted-ir"
  readonly path: string
  readonly requirementProjectionSha256: `sha256:${string}`
  readonly routes: readonly {
    readonly destinationStableId: string
    readonly ids: readonly string[]
  }[]
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M0-12 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M0-12 data can contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
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
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
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
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const planned = (owner: string, ...plannedWorkUnits: string[]): EvidenceOwner => ({
  owner,
  plannedWorkUnits,
  state: "planned"
})

const blocked = (owner: string, ...plannedWorkUnits: string[]): EvidenceOwner => ({
  owner,
  plannedWorkUnits,
  state: "blocked"
})

const definition = {
  workUnit: "M0-12",
  releaseState: "deny",
  evidencePolicy:
    "Requirements are complete only after every declared evidence owner records reviewed evidence and every row gate is closed",
  sourceBindings: [
    {
      sourceId: "fie",
      path: "apps/scoring/docs/specifications/fie-traceability-matrix.md",
      requirementProjectionSha256: "sha256:aa85fe07c5d6a24a600296fd3aa7b216b0ccb8f90111f47888dc8a9be5afb4a5",
      routes: [
        {
          destinationStableId: "REQ-NORM-GENERAL",
          ids: ["GEN-01", "GEN-02", "GEN-03", "GEN-04", "GEN-05", "GEN-06", "GEN-07", "INT-01"]
        },
        {
          destinationStableId: "REQ-NORM-THREE-WEAPON",
          ids: [
            "FOIL-01",
            "FOIL-02",
            "FOIL-03",
            "FOIL-04",
            "FOIL-05",
            "EPEE-01",
            "EPEE-02",
            "EPEE-03",
            "EPEE-04",
            "EPEE-05",
            "SABRE-01",
            "SABRE-02",
            "SABRE-03",
            "SABRE-04",
            "SABRE-05",
            "SABRE-06",
            "SABRE-07",
            "INT-02",
            "INT-03",
            "INT-04",
            "INT-05",
            "INT-06"
          ]
        },
        {
          destinationStableId: "REQ-NORM-OUTPUTS",
          ids: ["OUT-01", "OUT-02", "OUT-03", "OUT-04", "OUT-05", "CLOCK-01", "INT-07", "INT-08"]
        },
        { destinationStableId: "REQ-NORM-POWER", ids: ["PWR-01", "PWR-02", "PWR-03", "INT-09"] }
      ]
    },
    {
      sourceId: "device-plan",
      path: "apps/scoring/docs/device-delivery-plan.md",
      requirementProjectionSha256: "sha256:6ea9b2fd0d569a8397e4823b3de71ab9442d51dbe20245e6aef727a75b4442d3",
      routes: [
        { destinationStableId: "REQ-NORM-GENERAL", ids: ["M0-01"] },
        { destinationStableId: "REQ-HW-SIGNAL-ALLOCATION", ids: ["M0-03", "M0-08", "M0-09"] },
        { destinationStableId: "REQ-HW-SCORING-AUTHORITY", ids: ["M0-04", "M2-07", "M2-10", "M3-04", "M3-11"] },
        {
          destinationStableId: "REQ-PRODUCT-DECISION-RECORDS",
          ids: ["M0-02", "M0-05", "M2-04", "M2-08", "M2-09", "M2-11", "M3-09"]
        },
        { destinationStableId: "REQ-PRODUCT-TRANSPORT", ids: ["M0-06", "M2-05", "M2-06", "M2-13", "M3-05"] },
        { destinationStableId: "REQ-NORM-POWER", ids: ["M0-10"] },
        { destinationStableId: "REQ-SECURITY-TRUST", ids: ["M0-11", "M3-10"] },
        {
          destinationStableId: "REQ-NORM-THREE-WEAPON",
          ids: [
            "M0-07",
            "M1-01",
            "M1-02",
            "M1-03",
            "M1-04",
            "M1-05",
            "M1-06",
            "M1-07",
            "M1-08",
            "M1-09",
            "M1-10",
            "M1-11",
            "M2-01",
            "M2-02",
            "M2-03",
            "M2-12",
            "M2-14"
          ]
        },
        {
          destinationStableId: "REQ-PRODUCT-VALIDATION",
          ids: [
            "M0-12",
            "M3-01",
            "M3-02",
            "M3-03",
            "M3-06",
            "M3-07",
            "M3-08",
            "M3-12",
            "M3-13",
            "M3-14",
            "M3-15",
            "M3-16",
            "M3-17",
            "M3-18"
          ]
        },
        { destinationStableId: "REQ-HW-ANALOG-PROTECTION", ids: ["M4-01", "M4-02", "M4-03"] },
        {
          destinationStableId: "REQ-HW-FIXTURE-CALIBRATION",
          ids: [
            "M4-04",
            "M4-05",
            "M4-06",
            "M4-07",
            "M4-08",
            "M4-09",
            "BT-01",
            "BT-02",
            "BT-03",
            "BT-04",
            "BT-05",
            "BT-06",
            "BT-07",
            "BT-08",
            "BT-09"
          ]
        },
        { destinationStableId: "REQ-HW-INTERFACES", ids: ["M4-10", "M4-11", "M4-12", "M4-13", "M4-14"] },
        {
          destinationStableId: "REQ-HW-SCHEMATIC-RELEASE",
          ids: ["M5-01", "M5-02", "M5-03", "M5-04", "M5-05", "M5-06", "M5-07", "M5-08", "M5-09"]
        },
        {
          destinationStableId: "REQ-HW-LAYOUT-RELEASE",
          ids: ["M5-10", "M5-11", "M5-12", "M5-13", "M5-14", "M5-15", "M5-16", "M5-17"]
        },
        { destinationStableId: "REQ-PRODUCT-MANUFACTURING", ids: ["M5-18", "M5-19", "M5-20", "M5-21"] },
        {
          destinationStableId: "REQ-PRODUCT-VALIDATION",
          ids: [
            "M6-01",
            "M6-02",
            "M6-03",
            "M6-04",
            "M6-05",
            "M6-06",
            "M6-07",
            "M6-08",
            "M6-09",
            "M6-10",
            "M6-11",
            "M6-12",
            "BT-10"
          ]
        },
        {
          destinationStableId: "REQ-PRODUCT-QUALIFICATION",
          ids: [
            "M7-01",
            "M7-02",
            "M7-03",
            "M7-04",
            "M7-05",
            "M7-06",
            "M7-07",
            "M7-08",
            "M7-09",
            "M7-10",
            "M7-11",
            "M7-12",
            "BT-11"
          ]
        },
        {
          destinationStableId: "REQ-PRODUCT-PRODUCTION",
          ids: ["M8-01", "M8-02", "M8-03", "M8-04", "M8-05", "M8-06", "M8-07", "M8-08", "M8-09", "BT-12"]
        }
      ]
    },
    {
      sourceId: "c17-migration",
      path: "apps/scoring/docs/c17-wasm-simulator-migration.md",
      requirementProjectionSha256: "sha256:1357c9630f308ab9abcc8b3597701e8a90bf0a56571805eab20b0a82e95cabbc",
      routes: [
        {
          destinationStableId: "REQ-NORM-THREE-WEAPON",
          ids: ["CW-05", "CW-06E", "CW-06F", "CW-06S", "CW-07", "CW-08", "CW-09", "CW-14", "CW-21", "CW-22"]
        },
        {
          destinationStableId: "REQ-PRODUCT-VALIDATION",
          ids: [
            "CW-00",
            "CW-01",
            "CW-02",
            "CW-03",
            "CW-04",
            "CW-10",
            "CW-11",
            "CW-12",
            "CW-13",
            "CW-15",
            "CW-16",
            "CW-17",
            "CW-18",
            "CW-19A",
            "CW-19B",
            "CW-20"
          ]
        }
      ]
    },
    {
      sourceId: "bench-plan",
      path: "packages/scoring-circuit/docs/bench-prototype-plan.md",
      requirementProjectionSha256: "sha256:6b87fe59a0d4e9d7146aaab16db2906a5e4378bab5294272fa19c6c936bfe204",
      routes: [
        {
          destinationStableId: "REQ-HW-INTERFACES",
          ids: [
            "BP-000",
            "BP-010",
            "BP-030",
            "BP-031",
            "BP-032",
            "BP-033",
            "BP-034",
            "BP-035",
            "BP-140",
            "BP-141",
            "BP-143",
            "BP-145"
          ]
        },
        { destinationStableId: "REQ-PRODUCT-MANUFACTURING", ids: ["BP-020"] },
        { destinationStableId: "REQ-HW-LAYOUT-RELEASE", ids: ["BP-040", "BP-400", "BP-401", "BP-402", "BP-403"] },
        { destinationStableId: "REQ-NORM-POWER", ids: ["BP-050", "BP-142"] },
        {
          destinationStableId: "REQ-HW-ANALOG-PROTECTION",
          ids: ["BP-100", "BP-101", "BP-102", "BP-103", "BP-104", "BP-105", "BP-106"]
        },
        {
          destinationStableId: "REQ-HW-SIGNAL-ALLOCATION",
          ids: ["BP-120", "BP-121", "BP-122", "BP-123", "BP-124", "BP-125", "BP-126"]
        },
        { destinationStableId: "REQ-NORM-OUTPUTS", ids: ["BP-144"] },
        { destinationStableId: "REQ-PRODUCT-ENCRYPTED-IR", ids: ["BP-146", "BP-506", "BP-509", "BP-510"] },
        { destinationStableId: "REQ-HW-SCHEMATIC-RELEASE", ids: ["BP-300", "BP-301", "BP-302", "BP-303"] },
        {
          destinationStableId: "REQ-PRODUCT-VALIDATION",
          ids: ["BP-500", "BP-501", "BP-502", "BP-503", "BP-504", "BP-505", "BP-507", "BP-508", "BP-511"]
        }
      ]
    },
    {
      sourceId: "encrypted-ir",
      path: "apps/scoring/docs/encrypted-ir-remote-control-contract.md",
      requirementProjectionSha256: "sha256:9d55406a39c88a082a7d2afeb233e0130a85805a2c5111ff290c005c4f709b7c",
      routes: [
        {
          destinationStableId: "REQ-PRODUCT-ENCRYPTED-IR",
          ids: [
            "RC-01",
            "RC-02",
            "RC-03",
            "RC-04",
            "RC-05",
            "RC-06",
            "RC-07",
            "RC-08",
            "RC-09",
            "RC-10",
            "RC-11",
            "RC-12",
            "RC-13",
            "RC-14",
            "RC-15",
            "RC-16",
            "RC-17",
            "RC-18"
          ]
        }
      ]
    }
  ],
  rows: [
    {
      stableId: "REQ-NORM-GENERAL",
      requirementIds: ["GEN-01", "GEN-02", "GEN-03", "GEN-04", "GEN-05", "GEN-06", "GEN-07"],
      kind: "normative",
      evidenceOwners: {
        unit: planned("rules", "M1-08"),
        simulator: planned("simulation", "CW-17"),
        nativeC: blocked("firmware", "CW-06E", "CW-06F", "CW-06S"),
        wasm: blocked("simulation", "CW-12", "CW-16"),
        hil: blocked("validation", "BT-10"),
        physical: blocked("compliance", "M7-03", "M8-03")
      },
      openGates: ["seven-conductor topology", "piste and cable measurements", "official-competition claim disposition"]
    },
    {
      stableId: "REQ-NORM-THREE-WEAPON",
      requirementIds: [
        "FOIL-01",
        "FOIL-02",
        "FOIL-03",
        "FOIL-04",
        "FOIL-05",
        "EPEE-01",
        "EPEE-02",
        "EPEE-03",
        "EPEE-04",
        "EPEE-05",
        "SABRE-01",
        "SABRE-02",
        "SABRE-03",
        "SABRE-04",
        "SABRE-05",
        "SABRE-06",
        "SABRE-07"
      ],
      kind: "normative",
      evidenceOwners: {
        unit: planned("rules", "M1-08", "M1-09"),
        simulator: planned("simulation", "CW-17", "CW-21"),
        nativeC: blocked("firmware", "CW-06E", "CW-06F", "CW-06S", "CW-14"),
        wasm: blocked("simulation", "CW-12", "CW-14", "CW-16"),
        hil: blocked("validation", "BT-10"),
        physical: blocked("analog and compliance", "M4-08", "M6-05", "M7-03")
      },
      openGates: ["independent corpus", "analog correlation", "physical outputs", "all target parity"]
    },
    {
      stableId: "REQ-NORM-OUTPUTS",
      requirementIds: ["OUT-01", "OUT-02", "OUT-03", "OUT-04", "OUT-05", "CLOCK-01"],
      kind: "normative",
      evidenceOwners: {
        unit: planned("firmware", "M6-07"),
        simulator: planned("simulation", "CW-17"),
        nativeC: blocked("firmware", "CW-07", "CW-10"),
        wasm: blocked("simulation", "CW-12", "CW-16"),
        hil: blocked("validation", "BT-09"),
        physical: blocked("electrical and compliance", "M5-04", "M6-08", "M7-10")
      },
      openGates: ["output drivers", "lamp photometry", "audio measurement", "clock and extension isolation"]
    },
    {
      stableId: "REQ-NORM-POWER",
      requirementIds: ["PWR-01", "PWR-02", "PWR-03"],
      kind: "normative",
      evidenceOwners: {
        unit: planned("firmware", "M2-08"),
        simulator: planned("simulation", "M2-10"),
        nativeC: blocked("firmware", "CW-07", "CW-10"),
        wasm: blocked("simulation", "CW-12", "CW-16"),
        hil: blocked("validation", "BT-10"),
        physical: blocked("power and compliance", "M5-02", "M6-09", "M7-05")
      },
      openGates: ["source-range disposition", "brownout and reset captures", "backup and safe-output proof"]
    },
    {
      stableId: "REQ-HW-SCORING-AUTHORITY",
      requirementIds: ["M0-04"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("systems", "M2-07"),
        simulator: planned("simulation", "M3-11"),
        nativeC: blocked("firmware", "CW-07", "CW-10"),
        wasm: blocked("simulation", "CW-13", "CW-14"),
        hil: blocked("validation", "M6-07"),
        physical: blocked("electrical", "BP-122", "BP-123")
      },
      openGates: ["isolated link", "independent reset paths", "ESP32 fault containment", "STM32 output ownership"]
    },
    {
      stableId: "REQ-HW-SIGNAL-ALLOCATION",
      requirementIds: ["M0-03", "M0-08", "M0-09"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("firmware", "M2-01"),
        simulator: planned("simulation", "M2-01"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "M6-02"),
        physical: blocked("electrical", "BP-120", "BP-121", "M5-04", "M5-06")
      },
      openGates: ["CubeMX proof", "ESP-IDF proof", "boot-safe controls", "schematic and board bring-up"]
    },
    {
      stableId: "REQ-PRODUCT-DECISION-RECORDS",
      requirementIds: ["M0-05"],
      kind: "product",
      evidenceOwners: {
        unit: planned("data", "M2-04", "M2-09"),
        simulator: planned("simulation", "CW-17"),
        nativeC: blocked("firmware", "CW-07", "CW-14"),
        wasm: blocked("simulation", "CW-12", "CW-14"),
        hil: blocked("validation", "M6-06"),
        physical: blocked("quality", "M8-03")
      },
      openGates: ["atomic persistence", "record provenance on target", "replay without re-decision"]
    },
    {
      stableId: "REQ-PRODUCT-TRANSPORT",
      requirementIds: ["M0-06"],
      kind: "product",
      evidenceOwners: {
        unit: planned("protocol", "M2-05", "M2-06"),
        simulator: planned("simulation", "M2-13"),
        nativeC: blocked("firmware", "CW-09", "CW-10"),
        wasm: blocked("simulation", "CW-13", "CW-14"),
        hil: blocked("validation", "M6-07"),
        physical: blocked("security", "M7-08")
      },
      openGates: ["target parser", "resource bounds", "sender authenticity", "link fault injection"]
    },
    {
      stableId: "REQ-SECURITY-TRUST",
      requirementIds: ["M0-11"],
      kind: "security",
      evidenceOwners: {
        unit: planned("security", "M3-10"),
        simulator: planned("simulation", "M3-11"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-13"),
        hil: blocked("validation", "M6-07"),
        physical: blocked("security and manufacturing", "M8-02", "M8-07")
      },
      openGates: [
        "signed target updates",
        "identity and key custody",
        "production debug policy",
        "independent security review"
      ]
    },
    {
      stableId: "REQ-HW-ANALOG-PROTECTION",
      requirementIds: ["M4-01", "M4-02", "M4-03"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("analog", "M4-03"),
        simulator: planned("simulation", "M4-01"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "M6-04"),
        physical: blocked("analog and compliance", "M4-08", "M4-09", "M7-04")
      },
      openGates: ["vendor corner models", "coupon measurements", "extracted parasitics", "surge and thermal evidence"]
    },
    {
      stableId: "REQ-HW-FIXTURE-CALIBRATION",
      requirementIds: ["M4-05", "M4-07", "M4-08", "M4-09"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("test engineering", "BT-01"),
        simulator: planned("simulation", "BT-05"),
        nativeC: blocked("firmware", "CW-14"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "BT-10"),
        physical: blocked("test engineering", "BT-06", "BT-07", "BT-08")
      },
      openGates: ["calibrated fixture", "instrument uncertainty", "fault containment", "board correlation"]
    },
    {
      stableId: "REQ-HW-INTERFACES",
      requirementIds: ["M4-10", "M4-11", "M4-12", "M4-13", "M4-14"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("mechanical", "M4-14"),
        simulator: planned("simulation", "M4-12"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "M6-11"),
        physical: blocked("mechanical and electrical", "M5-07", "M7-06", "M7-07")
      },
      openGates: ["manufacturer CAD", "verified footprints", "harness keying", "panel fit and service loads"]
    },
    {
      stableId: "REQ-HW-SCHEMATIC-RELEASE",
      requirementIds: ["M5-01", "M5-02", "M5-03", "M5-04", "M5-05", "M5-06", "M5-07"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("electrical", "M5-01"),
        simulator: planned("simulation", "M5-03"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "M6-02"),
        physical: blocked("electrical", "M5-08", "M5-09")
      },
      openGates: ["schematics", "ERC", "independent electrical review", "safe-state component proof"]
    },
    {
      stableId: "REQ-HW-LAYOUT-RELEASE",
      requirementIds: ["M5-10", "M5-11", "M5-12", "M5-13", "M5-14", "M5-15", "M5-16", "M5-17"],
      kind: "hardware",
      evidenceOwners: {
        unit: planned("layout", "M5-10"),
        simulator: planned("simulation", "M5-16"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "M6-04"),
        physical: blocked("layout and compliance", "M5-17", "M7-04")
      },
      openGates: ["stack-up", "routing and planes", "SI PI thermal EMC", "DFM and DFT"]
    },
    {
      stableId: "REQ-PRODUCT-MANUFACTURING",
      requirementIds: ["M5-18", "M5-19", "M5-20", "M5-21"],
      kind: "product",
      evidenceOwners: {
        unit: planned("manufacturing", "M5-18"),
        simulator: planned("simulation", "M5-19"),
        nativeC: blocked("firmware", "CW-20"),
        wasm: blocked("simulation", "CW-20"),
        hil: blocked("validation", "M6-12"),
        physical: blocked("manufacturing and quality", "M7-01", "M7-02", "M8-01")
      },
      openGates: [
        "one-revision fabrication package",
        "independent viewer review",
        "EVT order sign-off",
        "controlled release"
      ]
    },
    {
      stableId: "REQ-PRODUCT-VALIDATION",
      requirementIds: [
        "M6-01",
        "M6-02",
        "M6-03",
        "M6-04",
        "M6-05",
        "M6-06",
        "M6-07",
        "M6-08",
        "M6-09",
        "M6-10",
        "M6-11",
        "M6-12"
      ],
      kind: "product",
      evidenceOwners: {
        unit: planned("validation", "M6-05"),
        simulator: planned("simulation", "CW-21"),
        nativeC: blocked("firmware", "CW-14"),
        wasm: blocked("simulation", "CW-14"),
        hil: blocked("validation", "BT-10"),
        physical: blocked("validation", "M6-12", "M7-03")
      },
      openGates: [
        "EVT build",
        "hardware-in-loop correlation",
        "power reset replay output evidence",
        "validation review"
      ]
    },
    {
      stableId: "REQ-PRODUCT-QUALIFICATION",
      requirementIds: [
        "M7-01",
        "M7-02",
        "M7-03",
        "M7-04",
        "M7-05",
        "M7-06",
        "M7-07",
        "M7-08",
        "M7-09",
        "M7-10",
        "M7-11",
        "M7-12"
      ],
      kind: "product",
      evidenceOwners: {
        unit: planned("compliance", "M7-03"),
        simulator: planned("simulation", "CW-18"),
        nativeC: blocked("firmware", "CW-18"),
        wasm: blocked("simulation", "CW-18"),
        hil: blocked("validation", "BT-11"),
        physical: blocked("compliance", "M7-12", "M8-06")
      },
      openGates: ["DVT qualification", "EMC and safety", "venue and FIE claim", "reliability evidence"]
    },
    {
      stableId: "REQ-PRODUCT-PRODUCTION",
      requirementIds: ["M8-01", "M8-02", "M8-03", "M8-04", "M8-05", "M8-06", "M8-07", "M8-08", "M8-09"],
      kind: "product",
      evidenceOwners: {
        unit: planned("manufacturing and quality", "M8-03"),
        simulator: planned("simulation", "CW-20"),
        nativeC: blocked("firmware", "CW-20"),
        wasm: blocked("simulation", "CW-20"),
        hil: blocked("validation", "BT-12"),
        physical: blocked("manufacturing and quality", "M8-09")
      },
      openGates: ["production fixture", "provisioning and service", "pilot yield", "release archive"]
    },
    {
      stableId: "REQ-PRODUCT-ENCRYPTED-IR",
      requirementIds: [
        "RC-01",
        "RC-02",
        "RC-03",
        "RC-04",
        "RC-05",
        "RC-06",
        "RC-07",
        "RC-08",
        "RC-09",
        "RC-10",
        "RC-11",
        "RC-12",
        "RC-13",
        "RC-14",
        "RC-15",
        "RC-16",
        "RC-17",
        "RC-18"
      ],
      kind: "security",
      evidenceOwners: {
        unit: planned("application and security", "RC-01", "RC-18"),
        simulator: planned("simulation", "RC-18"),
        nativeC: blocked("firmware", "CW-10"),
        wasm: blocked("simulation", "CW-16"),
        hil: blocked("validation", "BP-500"),
        physical: blocked("electrical and compliance", "BP-146", "BP-506", "BP-509", "BP-510")
      },
      openGates: [
        "authenticated encryption and anti-replay",
        "receiver interface",
        "range angle venue-light and latency",
        "pairing and counter recovery"
      ]
    }
  ]
} as const

export const requirementsToEvidenceLedger = deepFreeze(definition)

/** Returns the only permitted present-tense state: no evidence row is releasable at this planning baseline. */
export function deriveRequirementEvidenceState(row: RequirementEvidenceRow): "blocked" {
  if (
    row.openGates.length === 0 ||
    Object.values(row.evidenceOwners).some((evidence) => evidence.state !== "blocked" && evidence.state !== "planned")
  ) {
    throw new RangeError("M0-12 row must keep explicit open gates and a non-approved evidence state")
  }
  return "blocked"
}

/** Rejects omissions, inferred coverage, approval claims, aliases, and shape drift from the reviewed canonical ledger. */
export function validateRequirementsToEvidenceLedger(value: unknown): true {
  if (!sameDataGraph(value, requirementsToEvidenceLedger)) {
    throw new RangeError("M0-12 must exactly match the reviewed requirements-to-evidence ledger")
  }
  const ledger = requirementsToEvidenceLedger
  const rows: readonly RequirementEvidenceRow[] = ledger.rows
  const sources: readonly RequirementSourceBinding[] = ledger.sourceBindings
  const expectedIds = [
    "REQ-NORM-GENERAL",
    "REQ-NORM-THREE-WEAPON",
    "REQ-NORM-OUTPUTS",
    "REQ-NORM-POWER",
    "REQ-HW-SCORING-AUTHORITY",
    "REQ-HW-SIGNAL-ALLOCATION",
    "REQ-PRODUCT-DECISION-RECORDS",
    "REQ-PRODUCT-TRANSPORT",
    "REQ-SECURITY-TRUST",
    "REQ-HW-ANALOG-PROTECTION",
    "REQ-HW-FIXTURE-CALIBRATION",
    "REQ-HW-INTERFACES",
    "REQ-HW-SCHEMATIC-RELEASE",
    "REQ-HW-LAYOUT-RELEASE",
    "REQ-PRODUCT-MANUFACTURING",
    "REQ-PRODUCT-VALIDATION",
    "REQ-PRODUCT-QUALIFICATION",
    "REQ-PRODUCT-PRODUCTION",
    "REQ-PRODUCT-ENCRYPTED-IR"
  ]
  if (ledger.workUnit !== "M0-12" || ledger.releaseState !== "deny" || rows.length !== expectedIds.length) {
    throw new RangeError("M0-12 must retain its denied release state and canonical requirement set")
  }
  const stableIds = rows.map((row) => row.stableId)
  if (new Set(stableIds).size !== stableIds.length || stableIds.some((id, index) => id !== expectedIds[index])) {
    throw new RangeError("M0-12 stable requirement IDs must be complete and ordered")
  }
  const expectedSources = ["fie", "device-plan", "c17-migration", "bench-plan", "encrypted-ir"]
  if (
    sources.length !== expectedSources.length ||
    sources.some((source, index) => source.sourceId !== expectedSources[index])
  ) {
    throw new RangeError("M0-12 authoritative requirement sources must be complete and ordered")
  }
  const routedIds = new Set<string>()
  for (const source of sources) {
    if (
      source.path.length === 0 ||
      !/^sha256:[0-9a-f]{64}$/.test(source.requirementProjectionSha256) ||
      source.routes.length === 0
    ) {
      throw new RangeError("M0-12 source identity and requirement projection digest must be explicit")
    }
    for (const route of source.routes) {
      if (!stableIds.includes(route.destinationStableId) || route.ids.length === 0) {
        throw new RangeError("M0-12 source routes must name a stable ledger destination")
      }
      for (const id of route.ids) {
        const routedId = `${source.sourceId}:${id}`
        if (id.length === 0 || routedIds.has(routedId)) {
          throw new RangeError("M0-12 authoritative requirement IDs must map exactly once per source")
        }
        routedIds.add(routedId)
      }
    }
  }
  for (const row of rows) {
    if (
      row.requirementIds.length === 0 ||
      new Set(row.requirementIds).size !== row.requirementIds.length ||
      row.openGates.length === 0 ||
      new Set(row.openGates).size !== row.openGates.length
    ) {
      throw new RangeError("M0-12 cannot infer requirement coverage from implementation counts")
    }
    for (const stage of ["unit", "simulator", "nativeC", "wasm", "hil", "physical"] as const) {
      const evidence = row.evidenceOwners[stage]
      if (
        evidence.owner.length === 0 ||
        evidence.plannedWorkUnits.length === 0 ||
        (evidence.state === "blocked" && stage === "unit")
      ) {
        throw new RangeError("M0-12 evidence ownership must be explicit and non-approved")
      }
    }
    deriveRequirementEvidenceState(row)
  }
  return true
}
