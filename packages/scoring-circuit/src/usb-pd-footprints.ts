/**
 * Source-controlled PCB land-pattern definitions for the USB-C power path.
 *
 * Coordinates are millimetres, in the package's top-view frame. Positive X is
 * right and positive Y is up. `pinOneMarker` identifies the physical package
 * corner, not an arbitrary library rotation. These definitions deliberately
 * do not turn an item into a fabrication release: a primary drawing must also
 * establish the paste process, board stackup, assembly panel, and local layout.
 */

export type FootprintReleaseStatus = "deny"
export type CopperEvidenceStatus = "manufacturer-verified" | "missing-primary-drawing"

export type Rect = {
  readonly heightMm: number
  readonly widthMm: number
  readonly xMm: number
  readonly yMm: number
}

export type LandPad = Rect & {
  readonly id: string
  readonly role: string
}

export type ThermalPad = Rect & {
  readonly id: string
  readonly pasteCoveragePercent?: number
  readonly role: string
  readonly thermalViaPolicy: "not-applicable" | "optional-fill-plug-or-tent" | "requires-layout-review"
}

export type PasteRequirement = {
  readonly coverage: readonly {
    readonly padIds: readonly string[]
    readonly printedAreaPercent: number
  }[]
  readonly sourceStatus: "manufacturer-example" | "not-published-in-primary-drawing"
  readonly stencilThicknessMm?: number
  readonly summary: string
}

export type UsbPdFootprint = {
  readonly assembly: "application-carrier" | "external-panel-module"
  readonly copperEvidence: CopperEvidenceStatus
  readonly courtyard: {
    readonly heightMm?: number
    readonly sourceStatus: "manufacturer-verified" | "not-published-in-primary-drawing"
    readonly widthMm?: number
  }
  readonly drawing: {
    readonly document: string
    readonly pages: readonly number[]
    readonly revision: string
    readonly url: string
  }
  readonly fabricationRelease: FootprintReleaseStatus
  readonly missingReleaseEvidence: readonly string[]
  readonly mpn: string
  readonly orientation: {
    readonly convention: string
    readonly pinOneMarker: string
  }
  readonly pads: readonly LandPad[]
  readonly paste: PasteRequirement
  readonly thermalPads: readonly ThermalPad[]
}

function pad(id: string, role: string, xMm: number, yMm: number, widthMm: number, heightMm: number): LandPad {
  return { heightMm, id, role, widthMm, xMm, yMm }
}

function qfnRing(
  start: number,
  count: number,
  xMm: number,
  yMm: number,
  xStepMm: number,
  yStepMm: number,
  widthMm: number,
  heightMm: number,
  roles: readonly string[]
): readonly LandPad[] {
  return Array.from({ length: count }, (_, index) =>
    pad(
      String(start + index),
      roles[index] ?? "not-connected",
      xMm + index * xStepMm,
      yMm + index * yStepMm,
      widthMm,
      heightMm
    )
  )
}

const tps25730Roles = [
  "LDO_3V3",
  "ADCIN1",
  "ADCIN2",
  "LDO_1V5",
  "ADCIN3",
  "CAP_MIS",
  "I2Ct_SDA",
  "I2Ct_SCL",
  "DBG_ACC",
  "GND",
  "GND",
  "GND",
  "PLUG_FLIP",
  "GND",
  "DRAIN",
  "GND",
  "GND",
  "FAULT_IN",
  "SINK_EN",
  "PPHV",
  "PPHV",
  "PPHV",
  "VBUS_IN",
  "VBUS_IN",
  "VBUS_IN",
  "RESERVED",
  "PD5VMAX",
  "CC1",
  "CC2",
  "DRAIN",
  "GND",
  "VBUS",
  "VBUS",
  "GND",
  "GND",
  "RESERVED",
  "PLUG_EVENT",
  "VIN_3V3"
] as const

const tpd4s201Roles = [
  "C_SBU1",
  "C_SBU2",
  "VBIAS",
  "C_CC1",
  "C_CC2",
  "RPD_G2",
  "RPD_G1",
  "GND",
  "FLT",
  "VPWR",
  "CC2",
  "CC1",
  "GND",
  "SBU2",
  "SBU1",
  "NC",
  "NC",
  "GND",
  "NC",
  "NC"
] as const

const tps259474Roles = ["EN/UVLO", "OVLO", "PG", "PGTH", "IN", "OUT", "DVDT", "GND", "ILM", "ITIMER"] as const

/**
 * Items with copperEvidence "manufacturer-verified" faithfully encode the
 * published copper land pattern. Every item remains fabrication DENY until
 * its incomplete paste, CAD, and layout gates are closed.
 */
export const usbPdFootprints = [
  {
    assembly: "external-panel-module",
    copperEvidence: "missing-primary-drawing",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Amphenol product drawing 10177070",
      pages: [],
      revision: "unavailable to the project on 2026-08-23",
      url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Obtain the official Amphenol product drawing and STEP archive without an access-control failure",
      "Import and overlay every signal pad, shell stake, board-edge feature, paste opening, courtyard, and 0.80 mm board-thickness constraint",
      "Verify the right-angle mating axis and provide chassis support that bypasses the SMT joints"
    ],
    mpn: "10177070-00011LF",
    orientation: {
      convention: "No rotation or pin-to-pad mapping is authorized until the official drawing is acquired.",
      pinOneMarker: "unverified"
    },
    pads: [],
    paste: {
      coverage: [],
      sourceStatus: "not-published-in-primary-drawing",
      summary: "No paste geometry is released because the primary drawing was inaccessible."
    },
    thermalPads: []
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Texas Instruments REF0038A package outline, board layout, and stencil example",
      pages: [61, 62, 63],
      revision: "4226763/C, November 2021",
      url: "https://www.ti.com/lit/ds/symlink/tps25730a.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Independently overlay the imported pattern against REF0038A at the chosen fabricator mask and paste rules",
      "Complete PPHV and VBUS high-current copper, chip-pin surge, and thermal-via review",
      "Qualify the documented 0.1 mm stencil examples in the selected assembly process"
    ],
    mpn: "TPS25730ADREFR",
    orientation: {
      convention: "Top view. Pin 1 begins at the upper left of the left edge and numbering proceeds counter-clockwise.",
      pinOneMarker: "package pin-1 index area"
    },
    pads: [
      ...qfnRing(1, 6, -2.925, 1, 0, -0.4, 0.55, 0.2, tps25730Roles),
      ...qfnRing(7, 13, -2.4, -1.925, 0.4, 0, 0.2, 0.55, tps25730Roles.slice(6)),
      ...qfnRing(20, 6, 2.925, -1, 0, 0.4, 0.55, 0.2, tps25730Roles.slice(19)),
      ...qfnRing(26, 13, 2.4, 1.925, -0.4, 0, 0.2, 0.55, tps25730Roles.slice(25))
    ],
    paste: {
      coverage: [
        { padIds: ["39"], printedAreaPercent: 78 },
        { padIds: ["40"], printedAreaPercent: 80 }
      ],
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.1,
      summary:
        "TI's 0.1 mm stencil example specifies 78% printed coverage for thermal pad 39 and 80% for thermal pad 40."
    },
    thermalPads: [
      {
        heightMm: 2.65,
        id: "39",
        pasteCoveragePercent: 78,
        role: "GND thermal pad",
        thermalViaPolicy: "optional-fill-plug-or-tent",
        widthMm: 2.075,
        xMm: -0.5625,
        yMm: 0
      },
      {
        heightMm: 2.65,
        id: "40",
        pasteCoveragePercent: 80,
        role: "DRAIN thermal pad",
        thermalViaPolicy: "optional-fill-plug-or-tent",
        widthMm: 1.56,
        xMm: 1.4,
        yMm: 0
      }
    ]
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Texas Instruments RGR0020C package outline, board layout, and stencil example",
      pages: [26, 27, 28],
      revision: "4225699/B, May 2020",
      url: "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Qualify the manufacturer 0.125 mm stencil example in the chosen assembly process",
      "Overlay copper, 0.07 mm mask rules, optional vias, and the connector-side CC escape in the released board"
    ],
    mpn: "TPD4S201TRGRRQ1",
    orientation: {
      convention: "Top view. Pin 1 is at the upper left and numbering proceeds counter-clockwise.",
      pinOneMarker: "package pin-1 index area"
    },
    pads: [
      ...qfnRing(1, 5, -1.35, 1, 0, -0.5, 0.6, 0.24, tpd4s201Roles),
      ...qfnRing(6, 5, -1, -1.35, 0.5, 0, 0.24, 0.6, tpd4s201Roles.slice(5)),
      ...qfnRing(11, 5, 1.35, -1, 0, 0.5, 0.6, 0.24, tpd4s201Roles.slice(10)),
      ...qfnRing(16, 5, 1, 1.35, -0.5, 0, 0.24, 0.6, tpd4s201Roles.slice(15))
    ],
    paste: {
      coverage: [{ padIds: ["21"], printedAreaPercent: 81 }],
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.125,
      summary: "TI's 0.125 mm stencil example specifies 81% printed coverage for exposed pad 21."
    },
    thermalPads: [
      {
        heightMm: 2.05,
        id: "21",
        pasteCoveragePercent: 81,
        role: "GND thermal pad",
        thermalViaPolicy: "optional-fill-plug-or-tent",
        widthMm: 2.05,
        xMm: 0,
        yMm: 0
      }
    ]
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Texas Instruments DRV0006A package outline, board layout, and stencil example",
      pages: [18, 19, 20],
      revision: "4222173/C, November 2025",
      url: "https://www.ti.com/lit/ds/symlink/tvs2200.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Qualify the manufacturer 0.125 mm stencil example in the chosen assembly process",
      "Review the optional thermal-via implementation, VBUS surge return, and chip-pin clamp waveform"
    ],
    mpn: "TVS2200DRVR",
    orientation: {
      convention: "Top-land-pattern view. Pins 1 through 3 are on the left, and pins 4 through 6 are on the right.",
      pinOneMarker: "package pin-1 index area"
    },
    pads: [
      ...qfnRing(1, 3, -0.75, 0.65, 0, -0.65, 0.45, 0.3, ["GND", "GND", "GND"]),
      ...qfnRing(4, 3, 0.75, -0.65, 0, 0.65, 0.45, 0.3, ["IN", "IN", "IN"])
    ],
    paste: {
      coverage: [{ padIds: ["7"], printedAreaPercent: 88 }],
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.125,
      summary: "TI's 0.125 mm stencil example specifies 88% printed coverage for exposed pad 7."
    },
    thermalPads: [
      {
        heightMm: 1.6,
        id: "7",
        pasteCoveragePercent: 88,
        role: "GND thermal pad",
        thermalViaPolicy: "optional-fill-plug-or-tent",
        widthMm: 1,
        xMm: 0,
        yMm: 0
      }
    ]
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Texas Instruments RPW0010A package outline, board layout, and stencil example",
      pages: [72, 73, 74],
      revision: "4225183/A, August 2019",
      url: "https://www.ti.com/lit/ds/symlink/tps25947.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Qualify the manufacturer 0.100 mm stencil example for the peripheral and HotRod power pads",
      "Overlay copper, mask, input and output heat spreading, and fault-current thermal paths in the released board"
    ],
    mpn: "TPS259474ARPWR",
    orientation: {
      convention:
        "Top view. Pin 1 is at the upper left, pins 5 and 6 are the central bottom HotRod pads, and numbering proceeds counter-clockwise.",
      pinOneMarker: "package pin-1 identification"
    },
    pads: [
      ...qfnRing(1, 4, -0.9, 0.75, 0, -0.5, 0.6, 0.25, tps259474Roles),
      pad("5", tps259474Roles[4], -0.275, -0.325, 0.3, 1.75),
      pad("6", tps259474Roles[5], 0.275, -0.325, 0.3, 1.75),
      ...qfnRing(7, 4, 0.9, -0.75, 0, 0.5, 0.6, 0.25, tps259474Roles.slice(6))
    ],
    paste: {
      coverage: [
        { padIds: ["1", "4", "7", "10"], printedAreaPercent: 93 },
        { padIds: ["5", "6"], printedAreaPercent: 82 }
      ],
      sourceStatus: "manufacturer-example",
      stencilThicknessMm: 0.1,
      summary:
        "TI's 0.100 mm stencil example specifies 93% printed coverage for pads 1, 4, 7, and 10, and 82% for HotRod pads 5 and 6."
    },
    thermalPads: []
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Diodes Incorporated B320A-B360A SMA package outline and suggested pad layout",
      pages: [6],
      revision: "DS30891 Rev. 19-2, April 2026",
      url: "https://www.diodes.com/datasheet/download/B340A.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Define stencil reduction and courtyard according to the released fabricator and assembly process",
      "Verify the cathode-band physical orientation against the assembled reel before release"
    ],
    mpn: "B340A-13-F",
    orientation: {
      convention: "The cathode band must face pad K. The source drawing does not assign numeric pad designators.",
      pinOneMarker: "cathode band"
    },
    pads: [pad("A", "anode", -2, 0, 2.5, 1.7), pad("K", "cathode", 2, 0, 2.5, 1.7)],
    paste: {
      coverage: [],
      sourceStatus: "not-published-in-primary-drawing",
      summary: "The suggested copper pattern does not specify a stencil-aperture reduction."
    },
    thermalPads: []
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "manufacturer-verified", heightMm: 6.8, widthMm: 9.12 },
    drawing: {
      document: "KEMET T52X/T530 polymer capacitor land dimensions and courtyard",
      pages: [37, 41],
      revision: "T2076_T52X-530, July 2026",
      url: "https://content.kemet.com/datasheets/KEM_T2076_T52X-530.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Choose and qualify solder-paste apertures and the polarized assembly inspection for the selected production process",
      "Complete ripple-current, surge, and temperature validation of the assembled capacitor"
    ],
    mpn: "T523H107M035APE070",
    orientation: {
      convention: "Top view. The polarity stripe marks the positive anode pad.",
      pinOneMarker: "positive polarity stripe"
    },
    pads: [pad("+", "anode", -3.12, 0, 2.37, 4.13), pad("-", "cathode", 3.12, 0, 2.37, 4.13)],
    paste: {
      coverage: [],
      sourceStatus: "not-published-in-primary-drawing",
      summary: "KEMET publishes copper and courtyard dimensions but not a stencil aperture pattern."
    },
    thermalPads: []
  },
  {
    assembly: "external-panel-module",
    copperEvidence: "manufacturer-verified",
    courtyard: { sourceStatus: "not-published-in-primary-drawing" },
    drawing: {
      document: "Vishay T55 case-A dimensions and molded-capacitor pad dimensions",
      pages: [2, 26],
      revision: "40174, March 2026 and 40076, March 2026",
      url: "https://www.vishay.com/docs/40174/t55.pdf"
    },
    fabricationRelease: "deny",
    missingReleaseEvidence: [
      "Define and qualify stencil apertures and the polarized assembly inspection for the selected production process",
      "Verify the anode belt marking and pads against the received exact MPN reel"
    ],
    mpn: "T55A106M010C0200",
    orientation: {
      convention: "Top view. The anode indication belt must face the positive pad.",
      pinOneMarker: "anode indication belt mark"
    },
    pads: [pad("+", "anode", -1.225, 0, 1.35, 1.35), pad("-", "cathode", 1.225, 0, 1.35, 1.35)],
    paste: {
      coverage: [],
      sourceStatus: "not-published-in-primary-drawing",
      summary: "Vishay publishes copper dimensions but not a stencil aperture pattern."
    },
    thermalPads: []
  }
] as const satisfies readonly UsbPdFootprint[]

export function validateUsbPdFootprints(footprints: readonly UsbPdFootprint[]): readonly string[] {
  const errors: string[] = []
  const mpns = new Set<string>()

  for (const footprint of footprints) {
    if (mpns.has(footprint.mpn)) errors.push(`${footprint.mpn}: duplicate MPN`)
    mpns.add(footprint.mpn)
    if (footprint.drawing.document.trim().length === 0) errors.push(`${footprint.mpn}: drawing document is required`)
    if (footprint.drawing.revision.trim().length === 0) errors.push(`${footprint.mpn}: drawing revision is required`)
    if (!footprint.drawing.url.startsWith("https://")) errors.push(`${footprint.mpn}: drawing URL must use HTTPS`)
    const drawingPages = new Set<number>()
    for (const page of footprint.drawing.pages) {
      if (!Number.isFinite(page) || !Number.isInteger(page) || page <= 0) {
        errors.push(`${footprint.mpn}: drawing pages must be positive integers`)
      }
      if (drawingPages.has(page)) errors.push(`${footprint.mpn}: drawing page ${page} is duplicated`)
      drawingPages.add(page)
    }
    if (footprint.copperEvidence === "manufacturer-verified" && footprint.drawing.pages.length === 0) {
      errors.push(`${footprint.mpn}: verified copper requires drawing pages`)
    }
    if (footprint.fabricationRelease !== "deny") errors.push(`${footprint.mpn}: release must fail closed`)
    if (footprint.missingReleaseEvidence.length === 0) errors.push(`${footprint.mpn}: release gates are required`)
    for (const gate of footprint.missingReleaseEvidence) {
      if (gate.trim().length === 0) errors.push(`${footprint.mpn}: release gates must be nonblank`)
    }

    const { heightMm: courtyardHeightMm, widthMm: courtyardWidthMm } = footprint.courtyard
    if ((courtyardHeightMm === undefined) !== (courtyardWidthMm === undefined)) {
      errors.push(`${footprint.mpn}: courtyard width and height must be provided together`)
    }
    for (const [dimension, value] of [
      ["width", courtyardWidthMm],
      ["height", courtyardHeightMm]
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        errors.push(`${footprint.mpn}: courtyard ${dimension} must be finite and positive`)
      }
    }
    if (
      footprint.courtyard.sourceStatus === "manufacturer-verified" &&
      (courtyardWidthMm === undefined || courtyardHeightMm === undefined)
    ) {
      errors.push(`${footprint.mpn}: manufacturer-verified courtyard requires dimensions`)
    }

    const ids = new Set<string>()
    for (const candidate of [...footprint.pads, ...footprint.thermalPads]) {
      if (ids.has(candidate.id)) errors.push(`${footprint.mpn}: duplicated pad ${candidate.id}`)
      ids.add(candidate.id)
      for (const [dimension, value] of [
        ["width", candidate.widthMm],
        ["height", candidate.heightMm]
      ] as const) {
        if (!Number.isFinite(value) || value <= 0)
          errors.push(`${footprint.mpn}: pad ${candidate.id} ${dimension} must be positive`)
      }
      for (const [coordinate, value] of [
        ["x", candidate.xMm],
        ["y", candidate.yMm]
      ] as const) {
        if (!Number.isFinite(value)) errors.push(`${footprint.mpn}: pad ${candidate.id} ${coordinate} must be finite`)
      }
      const pasteCoveragePercent = "pasteCoveragePercent" in candidate ? candidate.pasteCoveragePercent : undefined
      if (
        pasteCoveragePercent !== undefined &&
        (typeof pasteCoveragePercent !== "number" ||
          !Number.isFinite(pasteCoveragePercent) ||
          pasteCoveragePercent <= 0 ||
          pasteCoveragePercent > 100)
      ) {
        errors.push(`${footprint.mpn}: pad ${candidate.id} paste coverage must be in (0, 100]`)
      }
    }

    if (footprint.paste.summary.trim().length === 0) errors.push(`${footprint.mpn}: paste summary is required`)
    if (footprint.paste.sourceStatus === "manufacturer-example") {
      if (
        footprint.paste.stencilThicknessMm === undefined ||
        !Number.isFinite(footprint.paste.stencilThicknessMm) ||
        footprint.paste.stencilThicknessMm <= 0
      ) {
        errors.push(`${footprint.mpn}: manufacturer paste example requires a positive stencil thickness`)
      }
      if (footprint.paste.coverage.length === 0) {
        errors.push(`${footprint.mpn}: manufacturer paste example requires coverage data`)
      }
    } else if (footprint.paste.stencilThicknessMm !== undefined || footprint.paste.coverage.length > 0) {
      errors.push(`${footprint.mpn}: unpublished paste data must not be populated`)
    }

    const coveredPadIds = new Set<string>()
    for (const coverage of footprint.paste.coverage) {
      if (
        !Number.isFinite(coverage.printedAreaPercent) ||
        coverage.printedAreaPercent <= 0 ||
        coverage.printedAreaPercent > 100
      ) {
        errors.push(`${footprint.mpn}: paste coverage must be in (0, 100]`)
      }
      if (coverage.padIds.length === 0) errors.push(`${footprint.mpn}: paste coverage requires pad IDs`)
      for (const padId of coverage.padIds) {
        if (coveredPadIds.has(padId)) errors.push(`${footprint.mpn}: paste coverage duplicates pad ${padId}`)
        coveredPadIds.add(padId)
        if (!ids.has(padId)) errors.push(`${footprint.mpn}: paste coverage references unknown pad ${padId}`)
      }
    }

    if (footprint.copperEvidence === "manufacturer-verified" && footprint.pads.length === 0) {
      errors.push(`${footprint.mpn}: verified copper requires pads`)
    }
    if (footprint.copperEvidence === "missing-primary-drawing" && footprint.pads.length > 0) {
      errors.push(`${footprint.mpn}: unavailable primary drawing must not generate pads`)
    }
  }

  return errors
}
