import {
  bp032ResetSupportFootprintEvidence,
  validateBp032ResetSupportFootprintEvidence
} from "./bp032-reset-support-footprints.js"

const expectedReferences = ["Q_DISPLAY_BUFFER_A_ENABLE", "Q_DISPLAY_BUFFER_B_ENABLE"] as const
const expectedManufacturer = "Nexperia"
const expectedManufacturerPartNumber = "BSS138AKA"
const expectedPackageCode = "SOT23"

const canonicalCircuitSource = {
  artifactPath: "packages/scoring-circuit/src/index.circuit.tsx",
  sha256: "AFF3BD13C2E5A22B63BD5E423B61F8266C53A11717D16E94A5183C1E1525A7F2",
  authority: "canonical-display-circuit",
  role: "exact display-enable references, BSS138AKA MPN, sot23 footprint, and G/S/D labels"
} as const

const canonicalSupportSource = {
  artifactPath: "packages/scoring-circuit/src/application-display-carrier-support.ts",
  sha256: "CCF41BBF1DBB02A234007AB120652EE47A8F9DF5D531AAEFF2558F3F331A523D",
  authority: "canonical-display-support-inventory",
  role: "exact two-reference support inventory, Nexperia manufacturer, MPN, and SOT-23 package"
} as const

const bp032SourceRecords = bp032ResetSupportFootprintEvidence.parts.filter(
  (part) => part.manufacturerPartNumber === expectedManufacturerPartNumber
)
const bp032SourceRecord = bp032SourceRecords[0]

if (
  validateBp032ResetSupportFootprintEvidence().length > 0 ||
  bp032SourceRecords.length !== 1 ||
  bp032SourceRecord === undefined
) {
  throw new RangeError("BP-033 requires the retained BP-032 BSS138AKA manufacturer record")
}

const expectedSourceArtifact = {
  authority: "manufacturer-primary",
  document: "BSS138AKA 60 V, single N-channel Trench MOSFET",
  documentNumber: "BSS138AKA",
  revision: "2 February 2024",
  url: "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf",
  artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf",
  sha256: "39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9",
  reviewedPdfPages: [2, 11, 12],
  drawingApplicability:
    "Table 2 and Table 3 exact identity and SOT23 package; Figure 18 package outline; Figure 19 reflow land-pattern guidance."
} as const

const expectedReferenceBindings = expectedReferences.map((reference) => ({
  reference,
  manufacturer: expectedManufacturer,
  manufacturerPartNumber: expectedManufacturerPartNumber,
  package: "SOT-23",
  packageCode: expectedPackageCode,
  footprint: "sot23",
  pinLabels: { pin1: "G", pin2: "S", pin3: "D" },
  canonicalCircuit: canonicalCircuitSource.artifactPath,
  canonicalSupportInventory: canonicalSupportSource.artifactPath,
  topology: {
    gate: `gate of ${reference === "Q_DISPLAY_BUFFER_A_ENABLE" ? "U_DISPLAY_BUFFER_A" : "U_DISPLAY_BUFFER_B"}.BUFFER_ENABLE_N path`,
    source: "net.GND",
    drain: `${reference === "Q_DISPLAY_BUFFER_A_ENABLE" ? "U_DISPLAY_BUFFER_A" : "U_DISPLAY_BUFFER_B"}.BUFFER_ENABLE_N`
  }
}))

const candidateDefinition = {
  artifactKind: "bp033-display-buffer-bss138aka-reference-binding",
  workUnit: "BP-033",
  scope: "prototype-first exact reference binding; isolated review input",
  exactReferenceSet: expectedReferences,
  exactOrderable: {
    manufacturer: expectedManufacturer,
    manufacturerPartNumber: expectedManufacturerPartNumber,
    package: "SOT-23",
    packageCode: expectedPackageCode,
    pinCount: 3,
    bodyMm: { length: 2.9, width: 1.3, height: 1 },
    leadPitchMm: 1.9,
    padCenterSpanMm: 1.4
  },
  referenceBindings: expectedReferenceBindings,
  sources: [
    canonicalCircuitSource,
    canonicalSupportSource,
    {
      artifactPath: "packages/scoring-circuit/src/bp032-reset-support-footprints.ts",
      sha256: "5357138FC9E2BF25B6C96272453754C28A700D265183590F078B7684E655BC2C",
      authority: "BP-032-retained-facts",
      role: "reused manufacturer facts and review geometry; no BP-033 evidence copy"
    },
    expectedSourceArtifact
  ],
  retainedManufacturerFacts: {
    sourceOwner: "BP-032",
    sourceRecord: "bp032ResetSupportFootprintEvidence.parts[1]",
    sourceArtifact: expectedSourceArtifact.artifactPath,
    sourceSha256: expectedSourceArtifact.sha256,
    package: structuredClone(bp032SourceRecord.package),
    pinMap: structuredClone(bp032SourceRecord.pinMap),
    manufacturerLandPattern: structuredClone(bp032SourceRecord.manufacturerLandPattern),
    projectFootprint: structuredClone(bp032SourceRecord.projectFootprint),
    manufacturerCad: structuredClone(bp032SourceRecord.manufacturerCad),
    artwork: structuredClone(bp032SourceRecord.artwork),
    duplicateEvidenceAdded: false
  },
  geometry: {
    state: "source-controlled-review-only",
    sourceOwner: "BP-032",
    sourceRecord: "bp032ResetSupportFootprintEvidence.parts[1].projectFootprint",
    manufacturerLandPatternPage: 12,
    projectFootprint: structuredClone(bp032SourceRecord.projectFootprint),
    orientation: structuredClone(bp032SourceRecord.projectFootprint.orientation),
    sourceAccurate: true,
    releaseReady: false
  },
  authority: {
    manufacturerCadImported: false,
    boardPlacementIntegrated: false,
    boardFitAccepted: false,
    orientationAccepted: false,
    courtyardAccepted: false,
    drcAccepted: false,
    fabricationAuthorized: false,
    acceptance: false,
    fabrication: "deny",
    release: "deny"
  },
  artwork: {
    state: "not-generated",
    artifactPath: null,
    sha256: null,
    authority: "deny"
  }
} as const

function deepFreezeStrict<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 display-buffer graph cannot contain aliases or cycles")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new RangeError("BP-033 display-buffer arrays must use Array.prototype")
  } else if (prototype !== Object.prototype) {
    throw new RangeError("BP-033 display-buffer records must use Object.prototype")
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-033 display-buffer graph accepts data properties only")
    }
    deepFreezeStrict(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const privateFrozenBaseline = deepFreezeStrict(structuredClone(candidateDefinition))

/** Public review graph. It is frozen independently from the private validator baseline. */
export const bp033DisplayBufferBss138akaReferenceBinding = deepFreezeStrict(structuredClone(privateFrozenBaseline))

type GraphState = {
  readonly actualSeen: WeakSet<object>
  readonly expectedSeen: WeakSet<object>
}

function assertExactDataGraph(actual: unknown, expected: unknown, state: GraphState, path: string): void {
  if (expected === null || typeof expected !== "object") {
    if (!Object.is(actual, expected)) throw new RangeError(`BP-033 display-buffer graph drift at ${path}`)
    return
  }
  if (actual === null || typeof actual !== "object")
    throw new RangeError(`BP-033 display-buffer graph drift at ${path}`)
  if (state.expectedSeen.has(expected)) throw new RangeError(`BP-033 display-buffer baseline alias at ${path}`)
  if (state.actualSeen.has(actual)) throw new RangeError(`BP-033 display-buffer candidate cycle or alias at ${path}`)
  state.expectedSeen.add(expected)
  state.actualSeen.add(actual)
  let expectedPrototype: object | null
  let actualPrototype: object | null
  let expectedKeys: readonly (string | symbol)[]
  let actualKeys: readonly (string | symbol)[]
  try {
    expectedPrototype = Object.getPrototypeOf(expected)
    actualPrototype = Object.getPrototypeOf(actual)
    expectedKeys = Reflect.ownKeys(expected)
    actualKeys = Reflect.ownKeys(actual)
    if (expectedPrototype !== actualPrototype || !Object.isFrozen(actual) || !Object.isFrozen(expected)) {
      throw new RangeError(`BP-033 display-buffer descriptor state drift at ${path}`)
    }
    if (
      expectedKeys.length !== actualKeys.length ||
      expectedKeys.some((key) => typeof key === "symbol" || !actualKeys.includes(key)) ||
      actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
    ) {
      throw new RangeError(`BP-033 display-buffer key drift at ${path}`)
    }
    for (const key of expectedKeys) {
      if (typeof key !== "string") throw new RangeError(`BP-033 display-buffer symbol key at ${path}`)
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
      if (
        expectedDescriptor === undefined ||
        actualDescriptor === undefined ||
        !("value" in expectedDescriptor) ||
        !("value" in actualDescriptor) ||
        expectedDescriptor.get !== undefined ||
        expectedDescriptor.set !== undefined ||
        actualDescriptor.get !== undefined ||
        actualDescriptor.set !== undefined ||
        expectedDescriptor.enumerable !== actualDescriptor.enumerable ||
        expectedDescriptor.configurable !== actualDescriptor.configurable ||
        expectedDescriptor.writable !== actualDescriptor.writable
      ) {
        throw new RangeError(`BP-033 display-buffer accessor or descriptor drift at ${path}.${key}`)
      }
      assertExactDataGraph(actualDescriptor.value, expectedDescriptor.value, state, `${path}.${key}`)
    }
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError(`BP-033 display-buffer graph inspection failed at ${path}`)
  }
}

export function validateBp033DisplayBufferBss138akaReferenceBinding(
  value: unknown = bp033DisplayBufferBss138akaReferenceBinding
): true {
  const currentBp032SourceRecords = bp032ResetSupportFootprintEvidence.parts.filter(
    (part) => part.manufacturerPartNumber === expectedManufacturerPartNumber
  )
  if (
    validateBp032ResetSupportFootprintEvidence().length > 0 ||
    currentBp032SourceRecords.length !== 1 ||
    currentBp032SourceRecords[0]?.source.artifactPath !== expectedSourceArtifact.artifactPath ||
    currentBp032SourceRecords[0]?.source.sha256 !== expectedSourceArtifact.sha256
  ) {
    throw new RangeError("BP-033 retained BP-032 BSS138AKA facts are no longer valid")
  }
  try {
    assertExactDataGraph(
      value,
      privateFrozenBaseline,
      { actualSeen: new WeakSet<object>(), expectedSeen: new WeakSet<object>() },
      "root"
    )
  } catch {
    throw new RangeError("BP-033 display-buffer exact graph or deny state drifted")
  }
  const evidence = privateFrozenBaseline
  if (
    evidence.workUnit !== "BP-033" ||
    evidence.exactReferenceSet.length !== 2 ||
    evidence.exactReferenceSet[0] !== expectedReferences[0] ||
    evidence.exactReferenceSet[1] !== expectedReferences[1] ||
    evidence.referenceBindings.length !== 2 ||
    evidence.referenceBindings.some(
      (binding, index) =>
        binding.reference !== expectedReferences[index] ||
        binding.manufacturer !== expectedManufacturer ||
        binding.manufacturerPartNumber !== expectedManufacturerPartNumber ||
        binding.packageCode !== expectedPackageCode ||
        binding.footprint !== "sot23"
    ) ||
    evidence.exactOrderable.manufacturerPartNumber !== expectedManufacturerPartNumber ||
    evidence.exactOrderable.packageCode !== expectedPackageCode ||
    evidence.sources.length !== 4 ||
    evidence.sources[3]?.artifactPath !== expectedSourceArtifact.artifactPath ||
    evidence.sources[3]?.sha256 !== expectedSourceArtifact.sha256 ||
    evidence.retainedManufacturerFacts.sourceOwner !== "BP-032" ||
    evidence.retainedManufacturerFacts.duplicateEvidenceAdded !== false ||
    evidence.authority.manufacturerCadImported ||
    evidence.authority.boardPlacementIntegrated ||
    evidence.authority.boardFitAccepted ||
    evidence.authority.orientationAccepted ||
    evidence.authority.courtyardAccepted ||
    evidence.authority.drcAccepted ||
    evidence.authority.fabricationAuthorized ||
    evidence.authority.acceptance ||
    evidence.authority.fabrication !== "deny" ||
    evidence.authority.release !== "deny" ||
    evidence.artwork.authority !== "deny"
  ) {
    throw new RangeError("BP-033 display-buffer exact references, source, geometry, or deny gates drifted")
  }
  return true
}

validateBp033DisplayBufferBss138akaReferenceBinding()
