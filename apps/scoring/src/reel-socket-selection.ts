/**
 * M4-10 reel-socket selection and physical plug-fit study.
 *
 * This is a frozen engineering study, not a procurement authorization or a
 * release. Manufacturer omissions and all physical-fit claims remain gates.
 */
type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M4-10 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M4-10 data can contain only data properties")
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
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
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
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const definition = {
  artifactKind: "fie-reel-socket-selection",
  workUnit: "M4-10",
  releaseState: "deny",
  procurementAuthorized: false,
  decision: {
    status: "unresolved",
    selectedCandidate: null,
    candidates: [
      {
        manufacturer: "Favero",
        mpn: "900-09",
        productName: "Three sockets connector on reel-case",
        role: "reel-case female 3-pin socket candidate; not a central-apparatus selection",
        sourceState: "official manufacturer Millennium Reel manual item identity",
        compatibilityState:
          "not physically proven against the selected mating plugs; current standalone orderability, dimensions, and drawing are unverified"
      },
      {
        manufacturer: "Allstar/Uhlmann",
        mpn: null,
        productName: "Allstar spool 3 pin socket",
        role: "spool/reel female 3-pin socket candidate; not a central-apparatus selection",
        sourceState: "current catalogue listing without an exact manufacturer MPN",
        compatibilityState:
          "not physically proven against the selected mating plugs; exact identity, dimensions, and drawing are unverified"
      },
      {
        manufacturer: "OK FENCING",
        mpn: "17-2017-03",
        productName: "Epee Socket Transparent",
        role: "bodywire/fencer-end socket candidate only",
        sourceState: "current manufacturer product page",
        compatibilityState:
          "rejected for the central-apparatus role because the manufacturer describes it as an epee/bodywire socket",
        sourcePublishedColorOptions: ["Transparent", "Blue", "Red", "Black"]
      }
    ],
    requestedColorOptions: [
      {
        apparatusPosition: "left",
        requestedColor: "Red",
        colorSuffix: null,
        suffixState: "not published for the unresolved candidates; supplier confirmation is required before any order"
      },
      {
        apparatusPosition: "right",
        requestedColor: "Blue",
        colorSuffix: null,
        suffixState: "not published for the unresolved candidates; supplier confirmation is required before any order"
      }
    ],
    colorPolicy:
      "Color is an inspection and service identification only. It does not encode left/right A/B/C, a scoring output, polarity, protective earth, chassis, or processor ground. Green is not selected because the current manufacturer evidence does not establish a required green variant.",
    rejectedBaseline: {
      family: "generic 3-pole XLR",
      reason:
        "A normal triangular XLR pin layout does not meet the FIE straight-line 3-pin geometry. Do not substitute a Neutrik or microphone XLR for the FIE reel socket."
    }
  },
  normativeInterface: {
    source: "FIE Material Rules, m.55.4 and m.55.5, December 2025 English edition",
    plugPins: 3,
    pinDiameterMm: 4,
    arrangement: "straight line",
    outerPinOffsetFromCentreMm: [15, 20],
    fencerEndSocketRequirement:
      "A safety device must prevent use unless the plug is correctly inserted and prevent separation during a bout; the device must be visually verifiable.",
    connectingCable: "3-core rubber-covered cable for humidity and blows",
    maximumSpoolWireResistanceSocketToSocketOhm: 3,
    maximumConnectingCableWireResistanceOhm: 2.5,
    pinOrderPolicy:
      "The outer-near-15 mm, centre, and outer-far-20 mm physical positions are not assigned to logical A/B/C in M4-10. M0-03 and M4-13 own the released pin map and keying record."
  },
  matingPlugStudy: {
    samplesToObtain: [
      {
        manufacturer: "Favero",
        article: "910",
        description: "3-PIN PLUG for floor and body cord",
        sourceState: "current manufacturer catalogue listing",
        fitState: "unverified sample"
      },
      {
        manufacturer: "Favero",
        article: "903",
        description: "14 m cable from piste to signalling apparatus with 3-pin plugs",
        sourceState: "current manufacturer catalogue listing",
        fitState: "unverified sample"
      },
      {
        manufacturer: "Allstar/Uhlmann",
        article: "Allstar spare spool cable (20M)",
        description: "current scoring-equipment catalogue item",
        sourceState: "current retailer/manufacturer-authorized catalogue listing",
        fitState: "unverified comparison sample"
      }
    ],
    requiredFitChecks: [
      "Verify the plug has three 4.00 mm contacts in the FIE straight-line geometry and measure both outer offsets.",
      "Mate each sample with each surviving candidate socket without forcing, rocking, or partial insertion.",
      "Verify the intended insertion depth, visual full-insertion indication, and any safety or retention feature.",
      "Apply the axial retention test with the socket mounted in the proposed panel stack-up; record force, direction, and failure mode.",
      "Repeat the fit check with socket, plug, panel, gasket, strain relief, and harness present. Bare-bench fit is insufficient."
    ],
    fitEvidenceState: "none collected; no release or purchase"
  },
  candidateSocketFacts: {
    manufacturerPublished: {
      contactResistanceMilliOhm: null,
      retentionForceN: null,
      matingCycles: null,
      contactMaterialOrPlating: null,
      panelCutoutMm: null,
      terminalStyle: null,
      ingressOrSaltRating: null,
      cadOrMechanicalDrawing: null
    },
    engineeringTargets: {
      initialPerContactResistanceMaximumMilliOhm: 50,
      postQualificationPerContactResistanceMaximumMilliOhm: 100,
      axialRetentionMinimumN: 30,
      retentionDwellSeconds: 10,
      matingCycles: 5000,
      cycleFailureCriteria: [
        "No uncommanded disconnect or latch failure",
        "No intermittent open or short during a continuity monitor",
        "No contact resistance above the post-qualification maximum",
        "No crack, loosened terminal, unacceptable wear, or loss of full-insertion indication"
      ],
      targetBasis:
        "Commercial engineering targets for a service connector, not claims made by OK Fencing or requirements stated by FIE. They require a witnessed fixture test."
    }
  },
  electricalAndHarness: {
    logicalNets: ["left.A", "left.B", "left.C", "right.A", "right.B", "right.C", "piste"],
    connectorPinCountPerSocket: 3,
    provisionalTermination:
      "Terminate each socket as a three-conductor harness with vendor-approved solder or crimp method after terminal style is confirmed. Provide a local strain relief so insertion force is not carried by the terminals.",
    conductorPolicy:
      "Use the M4-13 released three-core rubber-covered harness and its gauge/current calculation. M4-10 freezes the interface count and inspection labels only; it does not assign physical pin positions to A/B/C.",
    inspectionLabels:
      "Label each branch by apparatus position and logical net. Do not use red, blue, black, or any other connector color as a logical signal name.",
    electricalChecksBeforeRelease: [
      "100% continuity from each socket contact to its harness endpoint",
      "100% open/short test between all three contacts and adjacent sockets",
      "Contact resistance measured at the mated interface separately from wire resistance",
      "Verify no bond to protective earth, chassis, or processor ground unless an approved EMC record later requires it"
    ],
    fencerPisteBoundary:
      "The piste conductor is the conductive piste reference, not protective earth, chassis, or processor ground."
  },
  sweatSaltExposurePlan: {
    status: "planned, not executed",
    purpose: "Screen sweat, salt, and damp handling contamination on the socket, plug, and terminated harness.",
    screeningMethod:
      "Use a bounded aqueous 0.9% sodium-chloride screening solution. This is an engineering screen, not a claim of compliance with a named corrosion standard. Freeze solution pH, wetting volume, fixture, and laboratory record before execution.",
    sequence: [
      "Record baseline visual condition, insertion/retention behavior, continuity, and per-contact resistance.",
      "Apply the controlled solution to the mated and unmated contact area without immersing the electronics assembly.",
      "Run 10 wet/dry cycles with a documented dwell and dry interval, followed by 24 hours of dry recovery.",
      "Repeat full insertion, retention, continuity, and contact-resistance measurements after exposure.",
      "Inspect contacts, terminals, plating, latch, seal, panel interface, and strain relief for corrosion, residue, swelling, cracks, or looseness."
    ],
    passCriteria: [
      "No visible corrosion product, residue that prevents full insertion, crack, swelling, or loss of retention",
      "No intermittent continuity or short during flex and retention checks",
      "Each contact remains at or below the post-qualification resistance maximum",
      "The exposed assembly still meets the full-insertion and service-identification checks"
    ],
    evidenceState: "not run; candidate material, plating, and environmental rating are unknown"
  },
  physicalEvidenceGates: [
    "Identify an exact, current, orderable female socket intended for the reel or central apparatus. A bodywire or fencer-end socket such as OK Fencing 17-2017-03 is not acceptable evidence for this role.",
    "Obtain one lot-controlled sample of each surviving candidate and obtain its exact color suffix or variant code where color is offered. No PO is authorized while the role, identity, or suffix is unresolved.",
    "Obtain the Favero 910 and 903 mating samples, plus the Allstar comparison cable, and retain photographs and lot or article identifiers.",
    "Measure and record the FIE 4 mm, straight-line, 15 mm and 20 mm geometry on the actual plug and socket, including tolerance and orientation.",
    "Complete panel-stack-up fit, insertion, visual full-insertion, and axial-retention testing with the actual harness termination.",
    "Complete the 5,000-cycle and sweat/salt screens, with contact resistance measured before, during, and after qualification.",
    "Freeze the CAD footprint, panel cutout, terminal process, physical pin map, keying, and bonding in the M4-13 release record after this evidence passes."
  ],
  explicitUnknowns: [
    "No current manufacturer evidence in this study identifies an exact central-apparatus female socket that is both orderable and mechanically documented.",
    "Favero 900-09 is identified as a three-socket connector on a reel case, not as a central-apparatus standalone part; its current orderability, terminal style, panel cutout, dimensions, and drawing remain unverified.",
    "Allstar lists an Allstar spool 3 pin socket, but the current listing does not publish an exact MPN, dimensions, panel cutout, terminal style, or drawing.",
    "OK Fencing 17-2017-03 is described by its manufacturer as an epee/bodywire socket and is rejected for the central-apparatus role; its color names do not establish orderable color variants.",
    "Compatibility between any surviving candidate and Favero or Allstar plugs is not established by catalog descriptions; only the physical sample gate can establish it.",
    "The FIE rule specifies plug geometry and overall wire-resistance limits, but does not specify this socket's contact-resistance limit or central-apparatus retention force.",
    "Physical pin positions are deliberately not mapped to left/right A/B/C or piste in M4-10; M0-03 and M4-13 own that released mapping.",
    "The sweat/salt recipe, wet/dry dwell, and corrosion-screen fixture require reliability-owner review before execution.",
    "The 5,000-cycle, 50 mOhm, 100 mOhm, and 30 N values are engineering targets, not manufacturer or FIE claims."
  ],
  sources: [
    {
      title: "FIE Material Rules, December 2025 English edition",
      url: "https://static.fie.org/uploads/38/190667-book%20m%20ang.pdf",
      supports:
        "m.55 three-pin 4 mm straight-line geometry, 15 mm and 20 mm offsets, fencer-end safety device, and wire-resistance limits; m.56 rubber-covered three-core cable"
    },
    {
      title: "Favero Millennium Reel technical information and spare-parts manual",
      url: "https://www.favero.com/get_file.php?id=51&lang=_en",
      supports:
        "official manufacturer item identity Art. 900-09, Three sockets connector on reel-case; Art. 910 three-pin plug and Art. 903 reel-apparatus cable"
    },
    {
      title: "Favero current fencing reel, cables, connectors and accessories catalogue",
      url: "https://favero.com/en1_fencing_winding_cables_reel_spools_accessories_and_equipment-18.html",
      supports:
        "art. 910 3-pin plug, art. 903 14 m piste-to-apparatus cable, art. 906 fencer-end socket, and current product identity for mating samples"
    },
    {
      title: "OK Fencing product 17-2017-03",
      url: "https://www.okfencing.com/product-220.html",
      supports:
        "current product identity and published color options; the manufacturer describes it as an epee/bodywire socket, so it is rejected for the central-apparatus role"
    },
    {
      title: "Allstar/Uhlmann scoring equipment catalogue",
      url: "https://allstaruhlmann.com/product-category/scoring-equipment/",
      supports: "current Allstar 3-pin socket, retaining clip, and 20 m spare spool-cable comparison items"
    }
  ]
} as const

export const reelSocketSelection = deepFreeze(definition)

export type ReelSocketSelection = typeof reelSocketSelection

export function validateReelSocketSelection(value: unknown): value is ReelSocketSelection {
  return sameDataGraph(value, definition)
}
