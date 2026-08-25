const retainedKeystoneCatalogSha256 = "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("BP-033 Keystone baseline may contain data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/** Rejects changed data without reading getters or accepting hidden descriptor drift. */
function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  const priorExpected = seen.get(actual)
  if (priorExpected !== undefined) return priorExpected === expected
  seen.set(actual, expected)

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) return false

  return actualKeys.every((key) => {
    if (typeof key === "symbol") return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      actualDescriptor.configurable !== expectedDescriptor.configurable ||
      actualDescriptor.writable !== expectedDescriptor.writable
    ) {
      return false
    }
    return hasExactDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
  })
}

const frozenBaseline = deepFreeze({
  artifactKind: "bp033-keystone-5001-test-point-evidence-candidate",
  workUnit: "BP-033",
  basisCommit: "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c",
  scope: "exact evidence only for three canonical Keystone test-point references",
  sourceBinding: {
    canonicalLedgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
    exactReferences: ["TP_W5500_RESET_N", "TP_W5500_INT_N", "TP_IR_RX"],
    integrationStatus: "root-integration-handoff",
    enforcement: "The canonical BP-033 ledger must retain exactly these three references at Keystone 5001."
  },
  selection: {
    manufacturer: "Keystone Electronics",
    manufacturerPartNumber: "5001",
    family: "THM thru-hole mount test points, color keyed, miniature",
    color: "black",
    referencePackageDescriptions: [
      "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
      "miniature through-hole test point, 1.02 mm hole"
    ]
  },
  source: {
    authority: "manufacturer-primary-catalog",
    catalog: "Keystone terminals and test points catalog",
    catalogPage: "PDF page 4, printed page 62",
    url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/keystone-terminal-test-points.pdf",
    sha256: retainedKeystoneCatalogSha256
  },
  exactManufacturerEvidence: {
    terminal: "0.010 inch x 0.020 inch phosphor bronze, silver or tin plate",
    base: "Nylon 46, UL rated 94V-0",
    mountingHole: "0.040 inch (1.0 mm) diameter",
    illustratedBody: {
      nominalHeightMm: 7.6,
      baseDiameterMm: 3.0,
      loopOuterDiameterMm: 2.5,
      loopInnerDiameterMm: 1.25
    }
  },
  evidenceBoundary: {
    catalogDrawing: "exact product identity and manufacturer illustration only",
    projectDrill: "not-derived",
    projectLand: "not-derived",
    projectArtwork: "not-generated",
    boardCoordinates: "not-assigned",
    assemblyOrientation: "not-assigned"
  },
  deniedGates: {
    projectGeometry: "deny",
    placement: "deny",
    mechanicalSampleFit: "deny",
    probeClearance: "deny",
    manufacturerCad: "deny-not-acquired",
    fabrication: "deny",
    acceptance: "deny",
    release: "deny"
  },
  accepted: false
} as const)

/** Exported review record is a separately cloned frozen object; the baseline stays private. */
export const bp033Keystone5001TestPointEvidenceCandidate = deepFreeze(structuredClone(frozenBaseline))

/** Fail closed against all values and descriptors of the independent frozen baseline. */
export function validateBp033Keystone5001TestPointEvidenceCandidate(
  value: unknown = bp033Keystone5001TestPointEvidenceCandidate
): readonly string[] {
  if (!hasExactDataGraph(value, frozenBaseline)) {
    return ["BP-033 Keystone 5001 evidence candidate must exactly match its private frozen baseline"]
  }
  return []
}

export function isBp033Keystone5001TestPointEvidenceCandidate(
  value: unknown
): value is typeof bp033Keystone5001TestPointEvidenceCandidate {
  return validateBp033Keystone5001TestPointEvidenceCandidate(value).length === 0
}
