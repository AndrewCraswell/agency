import { Fragment, type ReactElement } from "react"

type PinDefinition = {
  readonly pin: number
  readonly net: string
  readonly direction: string
  readonly electrical: string
  readonly xMm: number
  readonly yMm: number
  readonly holeDiameterMm: number
}

type OfficialSource = {
  readonly id: string
  readonly authority: "manufacturer-primary" | "project-canonical"
  readonly url: string
  readonly artifactPath: string | null
  readonly sha256: string | null
  readonly scope: "exact-product-page" | "series-print" | "series-footprint" | "canonical-source"
  readonly reviewedEvidence: string
  readonly role: string
}

const bp124SourcePath = "packages/scoring-circuit/src/bench-prototype-service-headers.ts"
const bp124SourceSha256 = "CD1967756EFDF98DBF31B1AB820D54B9306C8C8D7CA00541DAFD69E6435588EE"
const bp121SourcePath = "packages/scoring-circuit/src/bench-prototype-esp32-allocation.ts"
const bp121SourceSha256 = "F3F6FFB90FB00CCBAD00BD296D2E4169CED47CCFEE54B09F75D45614318F9F1B"
const bp010SourcePath = "packages/scoring-circuit/src/bench-prototype-contract.ts"
const bp010SourceSha256 = "87CBC75B3CE07D615C6959BE32434585F7B9ED9E4BA13EF98BA80803AC92DBF7"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-032 service-header evidence cannot contain cycles or aliases")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new RangeError("BP-032 service-header evidence may contain only plain records and arrays")
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "symbol") throw new RangeError("BP-032 service-header evidence cannot contain symbol keys")
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 service-header evidence may contain only data properties")
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
    for (let index = 0; index < actual.length; index += 1) {
      if (
        !Object.prototype.hasOwnProperty.call(actual, index) ||
        !Object.prototype.hasOwnProperty.call(expected, index)
      ) {
        return false
      }
    }
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
  if (seen.has(value)) throw new RangeError("BP-032 service-header evidence contains a cycle or alias")
  seen.add(value)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
    throw new RangeError("BP-032 service-header evidence contains a non-plain record")
  }
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) {
    throw new RangeError("BP-032 service-header evidence contains a symbol key")
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) {
        throw new RangeError("BP-032 service-header evidence contains a sparse array")
      }
    }
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-032 service-header evidence contains an accessor")
    }
    inspectPlainDataGraph(descriptor.value, seen)
  }
}

function makeSource(source: OfficialSource): OfficialSource {
  return { ...source }
}

function makeTswProductSource(): OfficialSource {
  return makeSource({
    id: "samtec-tsw-106-07-g-s-product",
    authority: "manufacturer-primary",
    url: "https://www.samtec.com/products/tsw-106-07-g-s",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-106-07-g-s-product.html",
    sha256: "63FBFCD4D6A549AC290422C5521D506DC19E6459B8DAC5F1B4CCF95385E60F55",
    scope: "exact-product-page",
    reviewedEvidence:
      "Product title identifies TSW-106-07-G-S as a six-pin, single-row, 0.100 in through-hole header with 10 microinch gold/flash, 0.230 in post, and 0.430 in overall length. The page states .025 in square post, 2.54 mm pitch, and through-hole termination.",
    role: "Exact Samtec product identity and configured dimensions; product-page evidence does not release a board footprint."
  })
}

function makeSswProductSource(): OfficialSource {
  return makeSource({
    id: "samtec-ssw-106-01-g-s-product",
    authority: "manufacturer-primary",
    url: "https://www.samtec.com/products/ssw-106-01-g-s",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-ssw-106-01-g-s-product.html",
    sha256: "58C262615BD231FD19EBD7BD33845CDB61563A71F8BE4CCD63B91CACF38F1855",
    scope: "exact-product-page",
    reviewedEvidence:
      "Product title identifies SSW-106-01-G-S as a six-pin, single-row, 0.100 in socket strip with solder tails and 20 microinch gold/flash. The page states 2.54 mm pitch, Tiger Buy contact, and through-hole or surface-mount termination options.",
    role: "Exact BP-124 mating-socket candidate identity; mating fit, insertion, retention, and continuity remain unverified."
  })
}

function makeTswPrintSource(): OfficialSource {
  return makeSource({
    id: "samtec-tsw-series-print-revision-ds",
    authority: "manufacturer-primary",
    url: "https://suddendocs.samtec.com/prints/tsw-xxx-xx-xxx-x-xx-xxx-mkt.pdf",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-series-print.pdf",
    sha256: "047ECEDCC921FB0AED7127F08B9BA0FC1200D92D33FB7DED1B311D0ED8F42063",
    scope: "series-print",
    reviewedEvidence:
      "Revision DS series print pages 1 to 6. TSW-106-07-G-S decodes as six positions, lead style -07, -G plating, and single row -S. Figures 1 and 3 identify the straight single-row pin-1 end; Table 4 gives -07 L reference 0.430 in; Table 8 gives -S body length A +0.015/-0.015 in.",
    role: "Series mechanical and identity decoding source; dimensions are applied to the exact product configuration but are not manufacturer CAD."
  })
}

function makeTswFootprintSource(): OfficialSource {
  return makeSource({
    id: "samtec-tsw-through-hole-footprint-revision-a",
    authority: "manufacturer-primary",
    url: "https://suddendocs.samtec.com/prints/tsw-xxx-xx-x-x-xx-xxx-footprint.pdf",
    artifactPath: "packages/scoring-circuit/docs/evidence/bp-032/samtec-tsw-through-hole-footprint.pdf",
    sha256: "264658121FF2DAD25EBD6259E726B123BF1EA31F9145BC695607999181AF028F",
    scope: "series-footprint",
    reviewedEvidence:
      "Revision A recommended through-hole layout: single-row positions are on 0.100 in (2.54 mm) pitch and the typical finished hole callout is 0.040 in (1.02 mm) diameter. The drawing does not publish a copper annulus diameter, mask expansion, paste, courtyard, or exact CAD library geometry.",
    role: "Manufacturer recommended hole and pitch evidence only; copper, mask, paste, courtyard, and release geometry remain unproven."
  })
}

function makeCanonicalSource(path: string, sha256: string, role: string): OfficialSource {
  return makeSource({
    id: `canonical-${path.split("/").at(-1) ?? "source"}`,
    authority: "project-canonical",
    url: path,
    artifactPath: path,
    sha256,
    scope: "canonical-source",
    reviewedEvidence:
      "The byte hash binds this candidate to the BP-124, BP-121, or BP-010 contract present in the integration worktree.",
    role
  })
}

const esp32ServicePins: readonly PinDefinition[] = [
  { pin: 1, net: "APP_GND", direction: "reference", electrical: "ground", xMm: -6.35, yMm: 0, holeDiameterMm: 1.02 },
  {
    pin: 2,
    net: "APP_3V3_SENSE",
    direction: "adapter-sense",
    electrical: "sense-only",
    xMm: -3.81,
    yMm: 0,
    holeDiameterMm: 1.02
  },
  {
    pin: 3,
    net: "UART0_TX",
    direction: "board-to-adapter",
    electrical: "3V3_CMOS",
    xMm: -1.27,
    yMm: 0,
    holeDiameterMm: 1.02
  },
  {
    pin: 4,
    net: "UART0_RX",
    direction: "adapter-to-board",
    electrical: "3V3_CMOS",
    xMm: 1.27,
    yMm: 0,
    holeDiameterMm: 1.02
  },
  {
    pin: 5,
    net: "BOOT_N",
    direction: "adapter-open-drain-sink",
    electrical: "3V3_STRAP",
    xMm: 3.81,
    yMm: 0,
    holeDiameterMm: 1.02
  },
  {
    pin: 6,
    net: "MANUAL_RESET_ASSERT",
    direction: "adapter-3V3-assert",
    electrical: "3V3_CONTROL",
    xMm: 6.35,
    yMm: 0,
    holeDiameterMm: 1.02
  }
] as const

function createPrivateBaseline() {
  return {
    artifactKind: "bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence",
    workUnit: "BP-032",
    reviewState: "prototype-first-review-only",
    boundary: {
      reference: "J_ESP_SERVICE",
      bomReference: "J_ESP32_SERVICE",
      exactMpn: "TSW-106-07-G-S",
      matingMpn: "SSW-106-01-G-S",
      boardImport: "not-imported-by-a-board-circuit",
      geometryMeaning: "manufacturer recommended hole and pitch transcription plus exact product mechanical metadata",
      releaseMeaning: "no copper annulus, mask, paste, courtyard, placement, or CAD release is claimed"
    },
    canonicalSelection: {
      sources: [
        makeCanonicalSource(
          bp124SourcePath,
          bp124SourceSha256,
          "BP-124 exact J_ESP_SERVICE identity, TSW MPN, SSW mating candidate, pin order, and orientation gate"
        ),
        makeCanonicalSource(
          bp121SourcePath,
          bp121SourceSha256,
          "BP-121 ESP32 GPIO and recovery-signal allocation for UART0, BOOT_N, and application service signals"
        ),
        makeCanonicalSource(
          bp010SourcePath,
          bp010SourceSha256,
          "BP-010 fixed interface identity and no-5-V-TTL boundary for the ESP32 service header"
        )
      ],
      exactReferences: ["J_ESP_SERVICE"],
      exactMpn: "TSW-106-07-G-S",
      exactMatingMpn: "SSW-106-01-G-S"
    },
    manufacturerSources: [
      makeTswProductSource(),
      makeSswProductSource(),
      makeTswPrintSource(),
      makeTswFootprintSource()
    ],
    component: {
      reference: "J_ESP_SERVICE",
      manufacturer: "Samtec",
      manufacturerPartNumber: "TSW-106-07-G-S",
      family: ".100 in TSW square-post terminal strip",
      positions: 6,
      rows: 1,
      pitchMm: 2.54,
      postCrossSectionMm: { widthMm: 0.635, heightMm: 0.635 },
      leadStyle: "-07 straight",
      plating: "-G 10 microinch gold in contact area, 3 microinch gold on tail",
      termination: "through-hole",
      productMechanical: {
        postLengthMm: 5.84,
        overallLengthNominalMm: 10.92,
        bodyLengthNominalMm: 13.08,
        bodyLengthToleranceMm: { minimum: 12.7, maximum: 13.46 },
        bodyLengthRule: "six positions x 2.54 mm minus one pitch gives A = 12.70 mm; -S Table 8 adds +0.38/-0.38 mm",
        source: "Samtec TSW series print Revision DS, Tables 4 and 8, and exact product page"
      },
      mating: {
        manufacturer: "Samtec",
        manufacturerPartNumber: "SSW-106-01-G-S",
        family: ".100 in single-row Tiger Buy socket strip with solder tails",
        positions: 6,
        rows: 1,
        pitchMm: 2.54,
        termination: "through-hole or surface-mount series options",
        selectionStatus: "BP-124 candidate-orderable-not-mating-verified"
      }
    },
    pinout: esp32ServicePins.map((pin) => ({ ...pin })),
    orientation: {
      coordinateOrigin: "nominal center of the six-hole row, top-side board view",
      pinOne: {
        pin: 1,
        xMm: -6.35,
        yMm: 0,
        marker: "first position at the pin-1 end shown by Samtec TSW series Figure 3"
      },
      pinSix: { pin: 6, xMm: 6.35, yMm: 0 },
      rowSpanMm: 12.7,
      keying: "none",
      reversible: true,
      fixtureEnforced: false,
      boardMarking: "required project pin-1 mark is not supplied by the manufacturer footprint",
      state: "orientation-candidate-pending-independent-overlay"
    },
    landPattern: {
      source: "Samtec TSW through-hole footprint Revision A",
      holes: {
        count: 6,
        finishedDiameterMm: 1.02,
        pitchMm: 2.54,
        rowSpanMm: 12.7,
        coordinates: esp32ServicePins.map((pin) => ({ pin: pin.pin, xMm: pin.xMm, yMm: pin.yMm })),
        definition: "manufacturer typical finished-hole callout"
      },
      copperAnnulus: {
        diameterMm: null,
        status: "not-published-by-Samtec-series-footprint",
        disposition: "do-not-infer-pad-diameter-or-annulus"
      },
      solderMask: {
        expansionMm: null,
        status: "not-published-by-Samtec-series-footprint",
        disposition: "fabricator-rule-review-required"
      },
      paste: { status: "not-applicable-to-through-hole-lead-candidate", geometry: null },
      courtyard: { status: "not-published", geometry: null, disposition: "do-not-infer-courtyard" },
      keepout: { status: "not-published", geometry: null, disposition: "placement-and-mating-review-required" }
    },
    prototypeHandoff: {
      allowed: [
        "Use an isolated coupon or adapter for a temporary six-conductor harness; do not populate the board from this candidate.",
        "Use a user-attached SSW socket or individually labeled temporary wires only after de-energized pin-one and continuity checks.",
        "Connect normal USB-C power only after the harness is seated and APP_3V3_SENSE is confirmed sense-only."
      ],
      strainRelief: [
        "Anchor the harness to the fixture or coupon body; no cable load may pass through the TSW solder tails or board holes.",
        "Keep temporary wires insulated and short enough to prevent adjacent-pin contact during handling.",
        "Power off and discharge the board before every mate, unmate, or continuity change."
      ],
      miswireGates: [
        "Verify Samtec MPN, six-pin order, pin-one mark, and row direction against the retained product and series-print evidence.",
        "With power removed, continuity-check all six pins against the BP-124 net order and reject swapped UART, BOOT_N, reset, ground, or sense conductors.",
        "Measure VDD-to-GND and sense-pin isolation before applying the adapter; reject any adapter that can source APP_3V3_SENSE.",
        "Use only a 3.3 V-compatible adapter; 5 V TTL and RS-232 levels are prohibited."
      ],
      status: "prototype-handoff-guidance-only"
    },
    gates: {
      cadRelease: "deny",
      placementAcceptance: "deny",
      matingAcceptance: "deny",
      continuityAcceptance: "deny",
      fabricationRelease: "deny",
      assemblyRelease: "deny",
      electricalIntegrationAuthority: "deny",
      accepted: false,
      dnp: true,
      requiredBeforeAnyRelease: [
        "independent exact-MPN overlay against current Samtec product and series documents",
        "pad annulus, solder-mask, hole-fabrication, courtyard, and placement review",
        "physical TSW to SSW fit, insertion, retention, pin-one, and reversal-prevention verification",
        "de-energized six-pin continuity and no-back-power evidence",
        "adapter voltage proof and complete BP-124 recovery sequence capture",
        "fabricator and assembly acceptance"
      ]
    }
  } as const
}

const privateFrozenBaseline = deepFreeze(createPrivateBaseline())

/** Public candidate is a separately cloned and frozen graph; the validator uses the private baseline. */
export const bp032Esp32ServiceHeaderTsw10607gsFootprintEvidence = deepFreeze(structuredClone(privateFrozenBaseline))

export function validateBp032Esp32ServiceHeaderTsw10607gsFootprintEvidence(value: unknown): true {
  try {
    inspectPlainDataGraph(value)
    if (!sameDataGraph(value, privateFrozenBaseline, new WeakSet<object>(), new WeakSet<object>())) {
      throw new RangeError("BP-032 ESP32 service-header evidence drifted from its private reviewed baseline")
    }
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError("BP-032 ESP32 service-header evidence is not a valid plain data graph")
  }

  const contract = privateFrozenBaseline
  const component = contract.component
  const pinout = contract.pinout
  if (
    contract.canonicalSelection.exactReferences.length !== 1 ||
    contract.canonicalSelection.exactReferences[0] !== "J_ESP_SERVICE" ||
    component.reference !== "J_ESP_SERVICE" ||
    component.manufacturerPartNumber !== "TSW-106-07-G-S" ||
    component.mating.manufacturerPartNumber !== "SSW-106-01-G-S" ||
    component.positions !== 6 ||
    component.rows !== 1 ||
    component.pitchMm !== 2.54 ||
    component.termination !== "through-hole" ||
    pinout.length !== 6 ||
    pinout[0]?.net !== "APP_GND" ||
    pinout[1]?.net !== "APP_3V3_SENSE" ||
    pinout[2]?.net !== "UART0_TX" ||
    pinout[3]?.net !== "UART0_RX" ||
    pinout[4]?.net !== "BOOT_N" ||
    pinout[5]?.net !== "MANUAL_RESET_ASSERT" ||
    contract.orientation.pinOne.pin !== 1 ||
    contract.orientation.keying !== "none" ||
    !contract.orientation.reversible ||
    contract.orientation.fixtureEnforced ||
    contract.landPattern.holes.count !== 6 ||
    contract.landPattern.holes.finishedDiameterMm !== 1.02 ||
    contract.landPattern.holes.pitchMm !== 2.54 ||
    contract.landPattern.copperAnnulus.diameterMm !== null ||
    contract.landPattern.solderMask.expansionMm !== null ||
    contract.landPattern.courtyard.status !== "not-published" ||
    contract.gates.cadRelease !== "deny" ||
    contract.gates.placementAcceptance !== "deny" ||
    contract.gates.matingAcceptance !== "deny" ||
    contract.gates.continuityAcceptance !== "deny" ||
    contract.gates.fabricationRelease !== "deny" ||
    contract.gates.accepted ||
    !contract.gates.dnp
  ) {
    throw new RangeError("BP-032 ESP32 service-header evidence must remain exact, bounded, and release-denied")
  }
  return true
}

const serviceHeaderFootprint = (
  <footprint name="BP032_SAMTEC_TSW_106_07_G_S_REVIEW_CANDIDATE" originalLayer="top">
    {esp32ServicePins.map((pin) => (
      <Fragment key={`tsw-pin-${pin.pin}`}>
        {/* The equal-diameter rounded pad is a hole-center visualization only; Samtec did not publish an annulus. */}
        <platedhole
          name={String(pin.pin)}
          shape="circular_hole_with_rect_pad"
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter={`${pin.holeDiameterMm}mm`}
          rectPadWidth={`${pin.holeDiameterMm}mm`}
          rectPadHeight={`${pin.holeDiameterMm}mm`}
          rectBorderRadius={`${pin.holeDiameterMm / 2}mm`}
          portHints={[String(pin.pin), pin.net, `pin${pin.pin}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

export interface Bp032Esp32ServiceHeaderTsw10607gsFootprintProps {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Isolated review renderer; it is intentionally not imported by a board circuit. */
export function Bp032Esp32ServiceHeaderTsw10607gsFootprint({
  pcbRotation,
  pcbX,
  pcbY
}: Bp032Esp32ServiceHeaderTsw10607gsFootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_ESP_SERVICE_BP032_TSW_106_07_G_S"
      manufacturerPartNumber="TSW-106-07-G-S"
      footprint={serviceHeaderFootprint}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}
