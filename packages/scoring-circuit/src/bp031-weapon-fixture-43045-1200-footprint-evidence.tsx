import { Fragment, type ReactElement } from "react"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/** Keep the review candidate and its private baseline immutable and data-only. */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-031 fixture review cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-031 fixture review allows data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

/** Compare exact plain data, rejecting accessors, hidden properties, symbols, aliases, and cycles. */
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
  const actualIsArray = Array.isArray(actual)
  if (actualIsArray !== Array.isArray(expected)) return false
  if (actualIsArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      return false
    }
    return expected.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      return (
        descriptor !== undefined &&
        "value" in descriptor &&
        descriptor.enumerable &&
        sameDataGraph(descriptor.value, entry, actualSeen, expectedSeen)
      )
    })
  }
  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (typeof key === "symbol") return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const circuitPitchMm = 3
const circuitRowSpacingMm = 3
const contactHoleDiameterMm = 1.02
const retentionHoleDiameterMm = 3
const projectCopperPadDiameterMm = 2.2
const projectSolderMaskMarginMm = 0.05

const contactPins = Array.from({ length: 12 }, (_, index) => {
  const pin = index + 1
  const column = (pin - 1) % 6
  return {
    pin,
    xMm: column === 0 ? 0 : -column * circuitPitchMm,
    yMm: pin <= 6 ? 0 : -circuitRowSpacingMm
  }
})

const retentionHoles = [
  { name: "retention-a", xMm: -2.15, yMm: 4.32 },
  { name: "retention-b", xMm: -12.85, yMm: 4.32 }
] as const

/**
 * Review-only BP-031 artwork for the exact BP-104 internal fixture header.
 *
 * Molex SD-43045-001 supplies the contact and retention-hole layout. The
 * rendered copper, mask, and any future courtyard are deliberately project
 * review inputs; neither the series drawing nor the retained exact-MPN CAD
 * preview authorizes this artwork for fabrication. This header is not the
 * external three-banana weapon interface.
 */
const privateFrozenBaseline = deepFreeze({
  artifactKind: "bp031-weapon-fixture-43045-1200-footprint-evidence",
  workUnit: "BP-031",
  canonicalIdentity: {
    sourceContract: "BP-104",
    boardReference: "J_WEAPON_FIXTURE",
    manufacturer: "Molex",
    manufacturerPartNumber: "43045-1200",
    family: "Micro-Fit 3.0 dual-row right-angle through-hole header",
    positions: 12,
    rows: 2,
    scope: "internal-bp104-fixture-harness-only"
  },
  interfaceBoundary: {
    internalFixtureHarness: {
      role: "board-mounted internal bench fixture harness connector",
      boardReference: "J_WEAPON_FIXTURE",
      bomReference: "J_WEAPON_HARNESS",
      headerMpn: "43045-1200",
      internalMateMpn: "43025-1200",
      testPlugMpn: "44242-0005",
      populatedFixturePins: [1, 2, 3, 4, 5, 6, 7],
      unpopulatedFixturePins: [8, 9, 10, 11, 12],
      pisteFixturePin: 7,
      externalThreeBananaInterface: false,
      purpose:
        "Seven-channel de-energized bench continuity and miswire harness only; it is not a product-facing weapon socket, panel, or three-banana cable mate."
    },
    externalWeaponMating: {
      role: "per-side three-banana external weapon mating interface",
      supplier: "OK Fencing",
      conductorCount: 3,
      conductorOrder: ["A", "B", "C"],
      cableCompatibility: "owner-validated-compatible-with-existing-boxes",
      representedBy430451200: false,
      socketIdentity: null,
      boardEndConnectorIdentity: null,
      productionRequirement: "custom mechanically supported mating interface",
      productionStatus: "open",
      prototypeAllowedHandoffs: ["user-attached-sockets", "soldered-wires-or-pigtails"]
    },
    explicitNonEquivalence: [
      "Molex 43045-1200 is only the internal BP-104 J_WEAPON_FIXTURE board header.",
      "Molex 43025-1200 is only its internal fixture-harness receptacle mate.",
      "Neither Molex part is a three-banana external weapon socket, cable, or production mating interface.",
      "The validated OK Fencing cable does not select a board connector, socket MPN, footprint, or mechanical carrier."
    ]
  },
  sources: {
    manufacturerDrawing: {
      authority: "manufacturer-primary",
      documentNumber: "SD-43045-001",
      revision: "H1",
      url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450600_sd.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-drawing.pdf",
      sha256: "571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A",
      reviewedPages: "1-2",
      exactMpnBinding: "12-circuit finish-A material-table row 43045-1200"
    },
    manufacturerCadPreview: {
      authority: "manufacturer-primary",
      materialNumber: "430451200",
      circuitSize: 12,
      url: "https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/430/43045/430451200.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf",
      sha256: "7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA",
      disposition: "exact-retained-cad-preview-not-footprint-approval"
    },
    bp104Identity: {
      artifactPath: "packages/scoring-circuit/src/bench-prototype-fixture-harness.ts",
      sha256: "281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160",
      binding: "BP-104 J_WEAPON_FIXTURE exact 43045-1200 header, 12 positions, and pin map"
    },
    bp031Identity: {
      artifactPath: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
      sha256: "341F58EB8506E127C71F71BC135A49F7AC0B7973C0671D01074A91EAFFB4D8CD",
      binding: "BP-031 imports J_WEAPON_FIXTURE from BP-104 as the exact 43045-1200 internal fixture connector record"
    },
    externalBoundary: {
      authority: "owner-approved-boundary",
      artifactPath: "packages/scoring-circuit/src/bench-prototype-connector-preorder.ts",
      sha256: "9743537C4A33A4208623B5F4CC80DF0469473C2710A960D7482AA0065AA59515",
      binding:
        "BP-034 records OK Fencing three-pin cable compatibility only and explicitly leaves socket, panel, harness, and board-end identity open"
    },
    prototypeHandoffBoundary: {
      authority: "prototype-only-project-contract",
      artifactPath: "packages/scoring-circuit/src/bench-prototype-direct-wire-weapon-landing.ts",
      sha256: "BEF1FF45CEC4887226D9F3D4B8591B6F5266FD1C28D5AD1C923CB9B29A5B5276",
      binding: "Named per-side A/B/C landing and test points are prototype handoff references, not this 43045 footprint"
    }
  },
  manufacturerGeometry: {
    coordinateConvention:
      "Component-side PCB layout transformed to a review datum: circuit 1 is at (0, 0); circuit numbers increase leftward along the lower row, then leftward along the upper row.",
    contactLayout: {
      contactHoleDiameterMm: { nominal: contactHoleDiameterMm, tolerance: 0.05 },
      circuitPitchMm: { nominal: circuitPitchMm, tolerance: 0.1, nonAccumulated: true },
      rowSpacingMm: { nominal: circuitRowSpacingMm, tolerance: 0.1 },
      pins: contactPins,
      circuitOneDatum: { pin: 1, xMm: 0, yMm: 0, drawingMark: "CIRCUIT 1" },
      numbering: "lower row circuit 1 through 6 right-to-left; upper row circuit 7 through 12 right-to-left"
    },
    retention: {
      holeDiameterMm: { nominal: retentionHoleDiameterMm, tolerance: 0.05 },
      contactToRetentionRowMm: { nominal: 4.32, tolerance: 0.08 },
      endInsetMm: { nominal: 2.15, tolerance: 0.05 },
      retentionHoleSpanMm: { nominal: 10.7, tolerance: 0.08 },
      holes: retentionHoles,
      disposition: "manufacturer-recommended-physical-hole-layout"
    },
    bodyAndMating: {
      headerOverallSpanMm: { nominal: 21.65 },
      headerSideProfileDepthMm: { nominal: 12.24 },
      matingFaceToRearMm: { nominal: 9.91 },
      boardEdgeRule: {
        maximumDistanceMm: 10.16,
        source: "SD-43045-001 note 7",
        rule: "Place the header within 10.16 mm maximum from the PCB edge to avoid interference between the receptacle and PCB."
      },
      mate: {
        manufacturerPartNumber: "43025-1200",
        relation: "Mates with Micro-Fit 3.0 receptacle series 43025",
        status: "BP-104 physical sample-fit remains required"
      },
      exactCadPreview:
        "430451200 retained preview visually confirms the 12-circuit right-angle housing but is not an artwork overlay."
    }
  },
  prototypeHandoff: {
    state: "prototype-only-review-input",
    powerState: "off-and-discharged",
    scope:
      "Per-side external three-banana sockets or soldered wires/pigtails hand off to named A/B/C prototype points.",
    notThisFootprint:
      "The handoff points are not additional 43045 pads and do not authorize board integration or fabrication.",
    perSide: [
      {
        side: "left",
        externalInterface: "LEFT_THREE_BANANA",
        boardHarnessReference: "J_WEAPON_HARNESS_L",
        fixturePins: [1, 2, 3],
        conductors: [
          { external: "A", boardNet: "LEFT_WEAPON_A", landingPoint: "P_WEAPON_L_A", testPoint: "TP_WEAPON_L_A" },
          { external: "B", boardNet: "LEFT_WEAPON_B", landingPoint: "P_WEAPON_L_B", testPoint: "TP_WEAPON_L_B" },
          { external: "C", boardNet: "LEFT_WEAPON_C", landingPoint: "P_WEAPON_L_C", testPoint: "TP_WEAPON_L_C" }
        ]
      },
      {
        side: "right",
        externalInterface: "RIGHT_THREE_BANANA",
        boardHarnessReference: "J_WEAPON_HARNESS_R",
        fixturePins: [4, 5, 6],
        conductors: [
          { external: "A", boardNet: "RIGHT_WEAPON_A", landingPoint: "P_WEAPON_R_A", testPoint: "TP_WEAPON_R_A" },
          { external: "B", boardNet: "RIGHT_WEAPON_B", landingPoint: "P_WEAPON_R_B", testPoint: "TP_WEAPON_R_B" },
          { external: "C", boardNet: "RIGHT_WEAPON_C", landingPoint: "P_WEAPON_R_C", testPoint: "TP_WEAPON_R_C" }
        ]
      }
    ],
    solderRule:
      "Solder only the named per-side A/B/C prototype landing points during complete de-energized board rework; solder joints and plated holes must never carry pull or bend loads.",
    forbidden: [
      "Do not solder an external banana socket or weapon cable to the 43045-1200 footprint as if it were a three-pin interface.",
      "Do not land a return, ground, shield, piste, or fourth conductor on an A/B/C prototype point.",
      "Do not use a temporary pigtail as a field-service or production connector."
    ]
  },
  strainReliefAndMiswireGates: {
    strainRelief: {
      required: true,
      internalFixtureRule:
        "A fixture clamp or approved harness relief must bypass the 43030-0007 crimp terminals and PCB solder joints.",
      externalPrototypeRule:
        "A socket carrier, panel bracket, or separate pigtail clamp must carry external cable pull and bend loads; solder is electrical only.",
      status: "open",
      acceptance: "deny-until-photographed-and-physically-verified"
    },
    miswire: {
      requiredPowerState: "off-and-discharged",
      testPlugMpn: "44242-0005",
      forbiddenTestPlugUse: "Never use 43045-1200 as a continuity test plug or powered mate.",
      requiredNegativeCases: ["BP104-NEG-SWAP", "BP104-NEG-OPEN", "BP104-NEG-RETURN-BOND", "BP104-NEG-REVERSED-MATE"],
      requiredScreens: [
        "Seven named end-to-end readings from fixture pins 1-7.",
        "All 66 unique pin-pair isolation readings at 5 V with at least 10 Mohm acceptance.",
        "Five intentional-open readings for pins 8-12.",
        "Each swap, open, return-bond, reversed, offset, or half-seated mutation is rejected before energization."
      ],
      status: "open"
    }
  },
  projectReviewInputs: {
    copperForRenderedContacts: {
      padDiameterMm: projectCopperPadDiameterMm,
      representation: "rounded-rectangle-equivalent-to-circle",
      status: "project-input-not-published-by-molex"
    },
    solderMaskForRenderedContacts: {
      marginMm: projectSolderMaskMarginMm,
      status: "project-input-not-published-by-molex"
    },
    drill: {
      contactNominalMm: contactHoleDiameterMm,
      retentionNominalMm: retentionHoleDiameterMm,
      status: "rendered-at-manufacturer-layout-nominal-no-fabricator-tolerance-or-stackup-approval"
    },
    courtyard: {
      state: "not-selected",
      status: "no-project-courtyard-is-asserted-by-this-review"
    },
    boardPlacement: {
      state: "not-integrated",
      status: "no-board-edge-or-mating-envelope-overlay-is-approved"
    }
  },
  orientation: {
    boardRotationDegrees: 0,
    componentSideView: true,
    pinOne: { pin: 1, xMm: 0, yMm: 0 },
    polarizedToMate: true,
    latchLock: true,
    independentPhysicalReview: "pending",
    status: "review-only"
  },
  renderedArtwork: {
    digestAlgorithm: "SHA-256",
    digest: "2f778ec25537ad72eb5263285f2272c79ed1e0d451ee197ac0e1681fd5188205",
    scope: "ordered plated contact holes, non-plated retention holes, and their review coordinates only"
  },
  acceptance: {
    accepted: false,
    fabricationAuthority: "deny",
    physicalAuthority: "deny",
    mechanicalAuthority: "deny",
    externalMatingAuthority: "deny",
    remainingGates: [
      "Root review of source-to-artwork overlay and board placement.",
      "Received 43045-1200 and 43025-1200 non-forced fit, circuit-1 mark, latch/lock, edge interference, and retention-peg evidence.",
      "Physical BP-104 fixture evidence acceptance and fabricator drill, mask, courtyard, stackup, and assembly review.",
      "Exact per-side three-banana socket identity, custom mechanical carrier, external cable fit, and mechanically independent strain relief.",
      "Prototype A/B/C handoff continuity, isolation, intentional opens, swaps, reversal, and de-energized rework evidence."
    ]
  }
} as const)

/** Private frozen baseline used by the validator; no review field may drift silently. */
export const bp031WeaponFixture430451200FootprintEvidence = deepFreeze(structuredClone(privateFrozenBaseline))

function hasExpectedEvidenceShape(value: unknown): value is typeof bp031WeaponFixture430451200FootprintEvidence {
  return sameDataGraph(value, privateFrozenBaseline)
}

/** Fail closed unless this exact bounded review record is intact and still denied. */
export function validateBp031WeaponFixture430451200FootprintEvidence(
  value: unknown = bp031WeaponFixture430451200FootprintEvidence
): true {
  if (!hasExpectedEvidenceShape(value)) {
    throw new RangeError("BP-031 43045-1200 review record must be the exact immutable candidate")
  }
  const evidence = value
  const { canonicalIdentity, manufacturerGeometry, orientation, projectReviewInputs, sources } = evidence
  const pins = manufacturerGeometry.contactLayout.pins
  const expectedPins = Array.from({ length: 12 }, (_, index) => ({
    pin: index + 1,
    xMm: index % 6 === 0 ? 0 : -(index % 6) * circuitPitchMm,
    yMm: index < 6 ? 0 : -circuitRowSpacingMm
  }))
  if (
    canonicalIdentity.sourceContract !== "BP-104" ||
    canonicalIdentity.boardReference !== "J_WEAPON_FIXTURE" ||
    canonicalIdentity.manufacturerPartNumber !== "43045-1200" ||
    canonicalIdentity.scope !== "internal-bp104-fixture-harness-only" ||
    canonicalIdentity.positions !== 12 ||
    canonicalIdentity.rows !== 2 ||
    sources.manufacturerDrawing.documentNumber !== "SD-43045-001" ||
    sources.manufacturerDrawing.sha256 !== "571C8A381BE263CF8F92B064FE18DBC6CE6161E8CB2E931D186E8280B9F8338A" ||
    sources.manufacturerCadPreview.sha256 !== "7EC4BED5FA8DE35DBCF15486EEA86062F9BAAF8CDD2BFC0F4D2126A5D68F65FA" ||
    sources.bp104Identity.sha256 !== "281E698509CE08CE820436620610182C36DB02529F1A1DD0F510D6E47A369160" ||
    sources.bp031Identity.sha256 !== "341F58EB8506E127C71F71BC135A49F7AC0B7973C0671D01074A91EAFFB4D8CD" ||
    sources.externalBoundary.sha256 !== "9743537C4A33A4208623B5F4CC80DF0469473C2710A960D7482AA0065AA59515" ||
    sources.prototypeHandoffBoundary.sha256 !== "BEF1FF45CEC4887226D9F3D4B8591B6F5266FD1C28D5AD1C923CB9B29A5B5276" ||
    pins.length !== expectedPins.length ||
    pins.some((pin, index) => JSON.stringify(pin) !== JSON.stringify(expectedPins[index])) ||
    manufacturerGeometry.contactLayout.contactHoleDiameterMm.nominal !== contactHoleDiameterMm ||
    manufacturerGeometry.retention.holeDiameterMm.nominal !== retentionHoleDiameterMm ||
    manufacturerGeometry.retention.holes[0].xMm !== -2.15 ||
    manufacturerGeometry.retention.holes[1].xMm !== -12.85 ||
    manufacturerGeometry.retention.holes[0].yMm !== 4.32 ||
    manufacturerGeometry.retention.holes[1].yMm !== 4.32 ||
    manufacturerGeometry.bodyAndMating.boardEdgeRule.maximumDistanceMm !== 10.16 ||
    orientation.boardRotationDegrees !== 0 ||
    orientation.pinOne.pin !== 1 ||
    orientation.pinOne.xMm !== 0 ||
    orientation.pinOne.yMm !== 0 ||
    !orientation.polarizedToMate ||
    !orientation.latchLock ||
    orientation.independentPhysicalReview !== "pending" ||
    projectReviewInputs.courtyard.state !== "not-selected" ||
    evidence.interfaceBoundary.internalFixtureHarness.headerMpn !== "43045-1200" ||
    evidence.interfaceBoundary.internalFixtureHarness.externalThreeBananaInterface ||
    evidence.interfaceBoundary.externalWeaponMating.representedBy430451200 ||
    evidence.interfaceBoundary.externalWeaponMating.socketIdentity !== null ||
    evidence.interfaceBoundary.externalWeaponMating.boardEndConnectorIdentity !== null ||
    evidence.interfaceBoundary.externalWeaponMating.prototypeAllowedHandoffs.length !== 2 ||
    evidence.prototypeHandoff.powerState !== "off-and-discharged" ||
    evidence.prototypeHandoff.perSide.length !== 2 ||
    evidence.prototypeHandoff.perSide.some((side) => side.conductors.length !== 3) ||
    evidence.strainReliefAndMiswireGates.strainRelief.status !== "open" ||
    evidence.strainReliefAndMiswireGates.miswire.status !== "open" ||
    evidence.acceptance.accepted ||
    evidence.acceptance.fabricationAuthority !== "deny" ||
    evidence.acceptance.physicalAuthority !== "deny" ||
    evidence.acceptance.mechanicalAuthority !== "deny" ||
    evidence.acceptance.externalMatingAuthority !== "deny"
  ) {
    throw new RangeError("BP-031 43045-1200 identity, source, pin, orientation, geometry, or deny gate drifted")
  }
  return true
}

const projectFootprint = (
  <footprint name="BP031_MOLEX_43045_1200_REVIEW_ONLY" originalLayer="top">
    {contactPins.map((pin) => (
      <Fragment key={pin.pin}>
        <platedhole
          name={`${pin.pin}`}
          shape="circular_hole_with_rect_pad"
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter={`${contactHoleDiameterMm}mm`}
          rectPadWidth={`${projectCopperPadDiameterMm}mm`}
          rectPadHeight={`${projectCopperPadDiameterMm}mm`}
          rectBorderRadius={`${projectCopperPadDiameterMm / 2}mm`}
          solderMaskMargin={`${projectSolderMaskMarginMm}mm`}
          portHints={[`${pin.pin}`, `pin${pin.pin}`, ...(pin.pin === 1 ? ["circuit-1", "pin1"] : [])]}
        />
      </Fragment>
    ))}
    {retentionHoles.map((hole) => (
      <Fragment key={hole.name}>
        <hole name={hole.name} diameter={`${retentionHoleDiameterMm}mm`} pcbX={hole.xMm} pcbY={hole.yMm} />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp031WeaponFixture430451200FootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated component used only to render and hash this deny-by-default review candidate. */
export function Bp031WeaponFixture430451200Footprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp031WeaponFixture430451200FootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_BP031_WEAPON_FIXTURE_43045_1200"
      manufacturerPartNumber="43045-1200"
      pinLabels={Object.fromEntries(contactPins.map((pin) => [`pin${pin.pin}`, `${pin.pin}`]))}
      footprint={projectFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export default Bp031WeaponFixture430451200Footprint
