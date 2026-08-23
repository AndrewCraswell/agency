/**
 * Manufacturer drawing traceability for the power chain.
 *
 * This is deliberately a data-only library. It is not a PCB export library,
 * and importing a row from it must never clear the DNP / fabrication gates.
 * Each drawing's coordinate convention is preserved in its `orientation`
 * field. Dimensions are millimetres unless stated otherwise.
 */

export type FabricationState = "deny"

type PadGeometry = {
  readonly count: number
  readonly description: string
  readonly gapMm?: number
  readonly padLengthMm?: number
  readonly padWidthMm?: number
  readonly pitchMm?: number
}

type PadMapping = {
  readonly pad: string
  readonly terminal: string
  readonly role: string
}

type FootprintDefinition = {
  readonly body: { readonly lengthMm: number; readonly maximumHeightMm?: number; readonly widthMm: number }
  readonly courtyard: { readonly description: string; readonly status: "specified" | "unspecified" }
  readonly denyReasons: readonly string[]
  readonly drawing: { readonly id: string; readonly pages: readonly number[]; readonly url: string }
  readonly manufacturer: string
  readonly mpn: string
  readonly orientation: string
  readonly pads: {
    readonly geometry: readonly PadGeometry[]
    readonly mapping: readonly PadMapping[]
  }
  readonly paste: { readonly description: string; readonly status: "specified" | "unspecified" }
  readonly releaseState: FabricationState
  readonly sources?: readonly {
    readonly id: string
    readonly pages: readonly number[]
    readonly role: string
    readonly url: string
  }[]
  readonly solderMask: { readonly description: string; readonly status: "specified" | "unspecified" }
  readonly thermal: { readonly description: string; readonly status: "required" | "not-applicable" }
}

const genericMlccDeny = [
  "The manufacturer part-specific recommended land pattern, paste aperture, and courtyard have not been imported from a primary drawing.",
  "Do not substitute a generic 0603, 0805, or 1210 footprint into fabrication output."
] as const

/**
 * Every row is held at DENY. `specified` means the associated manufacturing
 * datum was present in the cited primary source; it does not constitute board
 * release. A `drawing` source must be rechecked at CAD import time.
 */
export const powerStageFootprints = [
  {
    body: { lengthMm: 2, maximumHeightMm: 1, widthMm: 2 },
    courtyard: {
      description: "TI RPE0009A gives the land pattern but no component courtyard construction.",
      status: "unspecified"
    },
    denyReasons: [
      "Create and independently review the assembly courtyard from the released board density policy.",
      "Import TI RPE0009A's complete compound-copper pattern, solder-mask openings, stencil pattern, and optional-via policy as one locked CAD object.",
      "Validate the HotRod thermal copper, switching loop, and blocked-vent thermal performance on the released board."
    ],
    drawing: {
      id: "TI RPE0009A, drawing 4224447/C",
      pages: [54, 55, 56],
      url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf"
    },
    manufacturer: "Texas Instruments",
    mpn: "LMR43620MSC3RPERQ1",
    orientation:
      "Top view; pin 1 is the package-index corner. Pins 1 through 4 are the left-side sequence and pins 5 through 8 are the right-side sequence in the TI land-pattern drawing. Pin 9 is the central exposed ground terminal.",
    pads: {
      geometry: [
        {
          count: 8,
          description:
            "Eight outer terminal lands: 0.60 by 0.25. The drawing uses 0.50 pitch and compound copper at the power-side corners; do not reduce it to a generic QFN grid.",
          padLengthMm: 0.6,
          padWidthMm: 0.25,
          pitchMm: 0.5
        },
        {
          count: 1,
          description:
            "Central HotRod ground land, 1.30 tall with the TI-drawn 0.35-wide central feature and four compound copper extensions.",
          padLengthMm: 1.3,
          padWidthMm: 0.35
        }
      ],
      mapping: [
        { pad: "1", role: "MODE/SYNC for this fixed-frequency ordering", terminal: "1" },
        { pad: "2", role: "power-good open drain", terminal: "2" },
        { pad: "3", role: "enable and UVLO", terminal: "3" },
        { pad: "4", role: "VIN", terminal: "4" },
        { pad: "5", role: "switch node", terminal: "5" },
        { pad: "6", role: "bootstrap", terminal: "6" },
        { pad: "7", role: "internal VCC", terminal: "7" },
        { pad: "8", role: "VOUT and feedback", terminal: "8" },
        { pad: "9", role: "power ground and HotRod thermal terminal", terminal: "9" }
      ]
    },
    paste: {
      description:
        "TI RPE0009A stencil: 0.125 mm stencil, pads 1 and 8 at 90% printed coverage, pad 9 at 85% printed coverage; laser-cut trapezoidal walls and rounded corners are recommended.",
      status: "specified"
    },
    releaseState: "deny",
    solderMask: { description: "Non-solder-mask-defined is preferred; 0.05 maximum all around.", status: "specified" },
    thermal: {
      description:
        "Pin 9 is the HotRod ground terminal. Vias are optional only as shown by TI and, if used under paste, must be filled, plugged, or tented.",
      status: "required"
    }
  },
  {
    body: { lengthMm: 4, maximumHeightMm: 3.1, widthMm: 4 },
    courtyard: {
      description: "Coilcraft document 1575-4 does not specify a courtyard envelope.",
      status: "unspecified"
    },
    denyReasons: [
      "Add a board-density courtyard and paste-aperture policy before fabrication release.",
      "Keep the high dV/dt switch connection at the terminal called out by Coilcraft and validate the released switching loop."
    ],
    drawing: {
      id: "Coilcraft document 1575-4, revised 2026-02-19",
      pages: [4],
      url: "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf"
    },
    manufacturer: "Coilcraft",
    mpn: "XGL4030-222MEC",
    orientation:
      "Terminal mapping is electrically symmetric. Orient the marked short-lead side at the high dV/dt switch node as Coilcraft directs for lowest EMI.",
    pads: {
      geometry: [
        {
          count: 2,
          description: "Recommended land pattern: two 0.98 by 3.40 pads, separated by a 2.37 gap.",
          gapMm: 2.37,
          padLengthMm: 3.4,
          padWidthMm: 0.98
        }
      ],
      mapping: [
        { pad: "1", role: "switch-node side when oriented for EMI", terminal: "terminal A" },
        { pad: "2", role: "output side", terminal: "terminal B" }
      ]
    },
    paste: { description: "No paste aperture design is specified in document 1575-4.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "No solder-mask expansion is specified in document 1575-4.", status: "unspecified" },
    thermal: {
      description: "No exposed thermal pad; terminal copper carries both current and heat.",
      status: "not-applicable"
    }
  },
  {
    body: { lengthMm: 3, maximumHeightMm: 1, widthMm: 3 },
    courtyard: {
      description: "TI RPA0010A shows the land pattern but does not prescribe a component courtyard construction.",
      status: "unspecified"
    },
    denyReasons: [
      "Create and independently review the assembly courtyard from the released board density policy.",
      "Import TI RPA0010A's heterogeneous copper, mask, stencil, and two-PGND-via policy as one locked CAD object.",
      "Verify high-current switching-loop copper, startup, load transient, and thermal behavior on the released board."
    ],
    drawing: {
      id: "TI RPA0010A, drawing 4224047/A",
      pages: [26, 27, 28],
      url: "https://www.ti.com/lit/ds/symlink/tps56a37.pdf"
    },
    manufacturer: "Texas Instruments",
    mpn: "TPS56A37RPAR",
    orientation:
      "Top view with the pin-1 index at the lower-left package corner in TI Figure 4-1. Use the published drawing rather than mirroring the nonuniform HotRod lands.",
    pads: {
      geometry: [
        {
          count: 8,
          description:
            "Eight small lands called out at 0.25 width, with TI-specific 0.50 and 0.65 centre spacings; pins 6, 8, and 9 use enlarged compound power/ground copper.",
          padWidthMm: 0.25
        },
        {
          count: 2,
          description:
            "TI drawing's exposed high-current lands use 0.40 and 0.95 callouts with 0.37 internal separation; preserve the drawing geometry.",
          gapMm: 0.37,
          padLengthMm: 0.95,
          padWidthMm: 0.4
        }
      ],
      mapping: [
        { pad: "1", role: "enable", terminal: "EN" },
        { pad: "2", role: "feedback", terminal: "FB" },
        { pad: "3", role: "analog ground", terminal: "AGND" },
        { pad: "4", role: "power-good open drain", terminal: "PG" },
        { pad: "5", role: "soft start", terminal: "SS" },
        { pad: "6", role: "switch node", terminal: "SW" },
        { pad: "7", role: "bootstrap", terminal: "BOOT" },
        { pad: "8", role: "input supply", terminal: "VIN" },
        { pad: "9", role: "power ground", terminal: "PGND" },
        { pad: "10", role: "mode control", terminal: "MODE" }
      ]
    },
    paste: {
      description: "TI RPA0010A stencil: 0.10 mm stencil and pads 6 and 9 at 89% printed coverage by area.",
      status: "specified"
    },
    releaseState: "deny",
    solderMask: { description: "Non-solder-mask-defined with 0.07 minimum all around.", status: "specified" },
    thermal: {
      description:
        "PGND requires at least two vias for thermal performance; preserve the TI separation between AGND and PGND.",
      status: "required"
    }
  },
  {
    body: { lengthMm: 10.1, maximumHeightMm: 5, widthMm: 10.1 },
    courtyard: { description: "The Würth dashed outline is shown but not dimensioned.", status: "unspecified" },
    denyReasons: [
      "Create a dimensioned assembly courtyard and paste aperture policy before fabrication release.",
      "Validate the high-current terminal copper and temperature rise with the released board stackup."
    ],
    drawing: {
      id: "Würth 744325330 drawing, revision 004.001",
      pages: [1],
      url: "https://www.we-online.com/components/products/datasheet/744325330.pdf"
    },
    manufacturer: "Würth Elektronik",
    mpn: "744325330",
    orientation:
      "Electrically symmetric two-terminal inductor. Use the drawing's vertical pad axis; no pin-1 convention applies.",
    pads: {
      geometry: [
        {
          count: 2,
          description: "Recommended land pattern: two 4.00 by 3.85 pads with a 3.80 gap between inner pad edges.",
          gapMm: 3.8,
          padLengthMm: 3.85,
          padWidthMm: 4
        }
      ],
      mapping: [
        { pad: "1", role: "input or output, electrically symmetric", terminal: "terminal A" },
        { pad: "2", role: "input or output, electrically symmetric", terminal: "terminal B" }
      ]
    },
    paste: { description: "No paste-aperture design is specified in the Würth drawing.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "No solder-mask expansion is specified in the Würth drawing.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad; the large terminals are the heat path.", status: "not-applicable" }
  },
  {
    body: { lengthMm: 6.4, maximumHeightMm: 1.1, widthMm: 3.2 },
    courtyard: { description: "Bourns CRE data sheet gives no courtyard rule.", status: "unspecified" },
    denyReasons: [
      "Add a board-density courtyard and paste-aperture policy before fabrication release.",
      "Keep each Kelvin-sense escape at the terminal inner edge shown by Bourns and validate shunt temperature plus calibration."
    ],
    drawing: {
      id: "Bourns CRE2512 data sheet, Recommended Solder Pad Layout",
      pages: [1],
      url: "https://www.bourns.com/docs/product-datasheets/cre.pdf"
    },
    manufacturer: "Bourns",
    mpn: "CRE2512-FZ-R002E-3",
    orientation:
      "Electrically symmetric resistor; the CAD orientation shall retain the inner-edge Kelvin-sense escape on each pad.",
    pads: {
      geometry: [
        {
          count: 2,
          description:
            "R001 through R004 land group, which includes R002: two 3.10 by 4.00 pads with a 1.30 inner gap.",
          gapMm: 1.3,
          padLengthMm: 3.1,
          padWidthMm: 4
        }
      ],
      mapping: [
        { pad: "1", role: "high-current terminal with Kelvin escape", terminal: "terminal A" },
        { pad: "2", role: "high-current terminal with Kelvin escape", terminal: "terminal B" }
      ]
    },
    paste: { description: "No paste-aperture design is specified in the Bourns data sheet.", status: "unspecified" },
    releaseState: "deny",
    solderMask: {
      description: "No solder-mask expansion is specified in the Bourns data sheet.",
      status: "unspecified"
    },
    thermal: {
      description: "No exposed thermal pad; copper and both terminations must be thermally qualified.",
      status: "not-applicable"
    }
  },
  {
    body: { lengthMm: 3.2, maximumHeightMm: 1.8, widthMm: 1.6 },
    courtyard: { description: "Vishay document 40174 has no courtyard construction.", status: "unspecified" },
    denyReasons: [
      "Add a board-density courtyard and paste-aperture policy before fabrication release.",
      "Lock placement polarity to the Vishay anode bar and verify reflow orientation in assembly data."
    ],
    drawing: {
      id: "Vishay Polymer Guide 40076, revised 2026-05-20",
      pages: [12],
      url: "https://www.vishay.com/docs/40076/polymerguide.pdf"
    },
    manufacturer: "Vishay Polytech",
    mpn: "T55A106M010C0200",
    orientation: "Case A 3216-18. Pad 1 is the anode under the component's anode polarity bar; pad 2 is cathode.",
    pads: {
      geometry: [
        {
          count: 2,
          description:
            "Vishay Case A pattern: two 1.35 by 1.50 pads, 1.10 maximum inner gap, and 3.80 minimum total pattern length.",
          gapMm: 1.1,
          padLengthMm: 1.35,
          padWidthMm: 1.5
        }
      ],
      mapping: [
        { pad: "1", role: "positive", terminal: "anode" },
        { pad: "2", role: "negative", terminal: "cathode" }
      ]
    },
    paste: { description: "No paste-aperture design is specified in document 40174 or 40076.", status: "unspecified" },
    releaseState: "deny",
    solderMask: {
      description: "No solder-mask expansion is specified in document 40174 or 40076.",
      status: "unspecified"
    },
    sources: [
      {
        id: "Vishay Polymer Guide 40076, revised 2026-05-20",
        pages: [12],
        role: "Case-A recommended pad geometry",
        url: "https://www.vishay.com/docs/40076/polymerguide.pdf"
      },
      {
        id: "Vishay T55 data sheet 40174, revised 2026-03-30",
        pages: [2],
        role: "Case-A 1.6 plus or minus 0.2 mm height, package dimensions, and anode polarity marking",
        url: "https://www.vishay.com/docs/40174/t55.pdf"
      }
    ],
    thermal: {
      description: "No exposed thermal pad; verify ripple-current temperature with released copper.",
      status: "not-applicable"
    }
  },
  {
    body: { lengthMm: 7.3, maximumHeightMm: 2, widthMm: 6 },
    courtyard: {
      description:
        "KEMET T523 density-B pattern: 9.12 by 6.80 courtyard, selected because it is the documented robust reflow land option.",
      status: "specified"
    },
    denyReasons: [
      "Specify the stencil apertures and verify deposition experimentally; the primary land-pattern table does not prescribe them.",
      "Lock placement polarity to the KEMET plus stripe and verify PD/eFuse ripple-current, surge, and temperature in the released board."
    ],
    drawing: {
      id: "KEMET T2079_SSD, T523/T548 Table 2",
      pages: [13],
      url: "https://content.kemet.com/datasheets/KEM_T2079_SSD.pdf"
    },
    manufacturer: "Yageo KEMET",
    mpn: "T523H107M035APE070",
    orientation:
      "H case 7360-20 face-down terminals. Pad 1 is the anode under the KEMET plus stripe; pad 2 is cathode.",
    pads: {
      geometry: [
        {
          count: 2,
          description:
            "T523 H case density-B median land: two 4.48 by 2.67 pads, 3.27 inner gap, 9.12 grid-placement length, and 6.80 courtyard width.",
          gapMm: 3.27,
          padLengthMm: 2.67,
          padWidthMm: 4.48
        }
      ],
      mapping: [
        { pad: "1", role: "positive", terminal: "anode" },
        { pad: "2", role: "negative", terminal: "cathode" }
      ]
    },
    paste: {
      description: "No stencil aperture geometry is specified in the KEMET land-pattern table.",
      status: "unspecified"
    },
    releaseState: "deny",
    solderMask: {
      description: "KEMET specifies copper and courtyard dimensions, not a mask-expansion rule.",
      status: "unspecified"
    },
    thermal: {
      description: "No exposed thermal pad; terminals and board copper carry ripple heating.",
      status: "not-applicable"
    }
  },
  {
    body: { lengthMm: 3.2, widthMm: 2.5 },
    courtyard: {
      description: "Not encoded without a primary part-specific land-pattern drawing.",
      status: "unspecified"
    },
    denyReasons: genericMlccDeny,
    drawing: {
      id: "Murata GRM32ER7YA106KA12L product specification required",
      pages: [],
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM32ER7YA106KA12-01.pdf"
    },
    manufacturer: "Murata",
    mpn: "GRM32ER7YA106KA12L",
    orientation: "Unpolarized 1210 MLCC; terminal mapping is electrically symmetric.",
    pads: { geometry: [], mapping: [] },
    paste: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad.", status: "not-applicable" }
  },
  {
    body: { lengthMm: 3.2, widthMm: 2.5 },
    courtyard: {
      description: "Not encoded without a primary part-specific land-pattern drawing.",
      status: "unspecified"
    },
    denyReasons: genericMlccDeny,
    drawing: {
      id: "Murata GRM32ER71E226KE15L product specification required",
      pages: [],
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM32ER71E226KE15-01.pdf"
    },
    manufacturer: "Murata",
    mpn: "GRM32ER71E226KE15L",
    orientation: "Unpolarized 1210 MLCC; terminal mapping is electrically symmetric.",
    pads: { geometry: [], mapping: [] },
    paste: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad.", status: "not-applicable" }
  },
  {
    body: { lengthMm: 2, widthMm: 1.25 },
    courtyard: {
      description: "Not encoded without a primary part-specific land-pattern drawing.",
      status: "unspecified"
    },
    denyReasons: genericMlccDeny,
    drawing: {
      id: "TDK C2012X7S1A226M125AC product specification required",
      pages: [],
      url: "https://product.tdk.com/en/search/capacitor/ceramic/mlcc/info?part_no=C2012X7S1A226M125AC"
    },
    manufacturer: "TDK",
    mpn: "C2012X7S1A226M125AC",
    orientation: "Unpolarized 0805 MLCC; terminal mapping is electrically symmetric.",
    pads: { geometry: [], mapping: [] },
    paste: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad.", status: "not-applicable" }
  },
  {
    body: { lengthMm: 1.6, widthMm: 0.8 },
    courtyard: {
      description: "Not encoded without a primary part-specific land-pattern drawing.",
      status: "unspecified"
    },
    denyReasons: genericMlccDeny,
    drawing: {
      id: "Yageo KEMET C0603C104K3RACTU product specification required",
      pages: [],
      url: "https://yageogroup.com/component-documentation/download/specsheet/C0603C104K3RACTU?lang=en"
    },
    manufacturer: "Yageo KEMET",
    mpn: "C0603C104K3RACTU",
    orientation: "Unpolarized 0603 MLCC; terminal mapping is electrically symmetric.",
    pads: { geometry: [], mapping: [] },
    paste: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad.", status: "not-applicable" }
  },
  {
    body: { lengthMm: 1.6, widthMm: 0.8 },
    courtyard: {
      description: "Not encoded without a primary part-specific land-pattern drawing.",
      status: "unspecified"
    },
    denyReasons: genericMlccDeny,
    drawing: {
      id: "Murata GRM188R71A105KA61 product specification required",
      pages: [],
      url: "https://search.murata.co.jp/Ceramy/image/img/A01X/EN/GRM188R71A105KA61-01.pdf"
    },
    manufacturer: "Murata",
    mpn: "GRM188R71A105KA61",
    orientation: "Unpolarized 0603 MLCC; terminal mapping is electrically symmetric.",
    pads: { geometry: [], mapping: [] },
    paste: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    releaseState: "deny",
    solderMask: { description: "Not encoded pending primary drawing import.", status: "unspecified" },
    thermal: { description: "No exposed thermal pad.", status: "not-applicable" }
  }
] as const satisfies readonly FootprintDefinition[]

export function findPowerStageFootprint(mpn: string): FootprintDefinition | undefined {
  return powerStageFootprints.find((footprint) => footprint.mpn === mpn)
}
