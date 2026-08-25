/**
 * BP-033: fail-closed footprint-closure ledger for the application carrier.
 *
 * This ledger is a reconciliation aid, not a PCB library.  In particular, a
 * package name is not copper geometry: every populated reference remains
 * DNP-unresolved until its exact manufacturer drawing, CAD, generated
 * artwork, and independently reviewed orientation are archived.
 */

import {
  benchPrototypeApplicationRail,
  validateBenchPrototypeApplicationRail
} from "./bench-prototype-application-rail.js"
import { benchPrototypeEthernetMdi, validateBenchPrototypeEthernetMdi } from "./bench-prototype-ethernet-mdi.js"
import { benchPrototypeEthernet, validateBenchPrototypeEthernet } from "./bench-prototype-ethernet.js"
import {
  benchPrototypeFootprintReviewTemplate,
  validateBenchPrototypeFootprintReview
} from "./bench-prototype-footprint-review.js"
import {
  benchPrototypeHub75Connector,
  validateBenchPrototypeHub75Connector
} from "./bench-prototype-hub75-connector.js"
import { benchPrototypeHub75Safing, validateBenchPrototypeHub75Safing } from "./bench-prototype-hub75-safing.js"
import {
  benchPrototypeIrReceiverSelection,
  validateBenchPrototypeIrReceiverSelection
} from "./bench-prototype-ir-receiver-selection.js"
import {
  benchPrototypeOptionalPeripherals,
  validateBenchPrototypeOptionalPeripherals
} from "./bench-prototype-optional-peripherals.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { validateBp033B340aProjectFootprintGeometry } from "./bp033-b340a-project-footprint.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-033 ledger cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("BP-033 accepts data only")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (
      !Array.isArray(expected) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype ||
      actual.length !== expected.length
    )
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  )
    return false
  return expectedKeys.every((key) => {
    const left = Object.getOwnPropertyDescriptor(actual, key)
    const right = Object.getOwnPropertyDescriptor(expected, key)
    return (
      left !== undefined &&
      right !== undefined &&
      "value" in left &&
      "value" in right &&
      left.enumerable === right.enumerable &&
      sameDataGraph(left.value, right.value, seen)
    )
  })
}

const noEvidence = () => ({
  manufacturerDrawing: { state: "not-acquired", artifactPath: null, url: null, revision: null, sha256: null },
  manufacturerCad: { state: "not-acquired", url: null, revision: null, sha256: null },
  artwork: { state: "not-generated", artifactPath: null, generator: null, sha256: null },
  orientation: { state: "unreviewed", assemblyRotationDeg: null, datum: null, notes: null }
})

type SourceEvidence = {
  readonly state: "not-acquired" | "acquired"
  readonly artifactPath: string | null
  readonly url: string | null
  readonly revision: string | null
  readonly sha256: string | null
}

type ProjectFootprintCandidate = {
  readonly state: "source-controlled-review-only"
  readonly artifactPath: string
  readonly testArtifactPath: string
  readonly renderedGeometrySha256: string
  readonly orderableBinding: {
    readonly orderableMpn: string
    readonly deviceMpn: string
    readonly packageDrawing: string
    readonly perimeterPins?: number
    readonly exposedPads?: readonly string[]
    readonly electricalPinCount?: number
    readonly pinMap?: readonly {
      readonly pad: string
      readonly signal: string
      readonly function: string
    }[]
  }
  readonly source: { readonly artifactPath: string; readonly sha256: string; readonly reviewedPages: string }
  readonly review: {
    readonly state: "root-reviewed-review-input" | "source-controlled-pending-review"
    readonly reviewer: "root-final-reviewer" | null
    readonly reviewedAt: "2026-08-25" | null
    readonly scope: string
  }
  readonly authority: {
    readonly manufacturerCadImported: false
    readonly boardImported: false
    readonly orientationAccepted: false
    readonly courtyardAccepted: false
    readonly drcAccepted: false
    readonly fabricationAuthorized: false
    readonly releaseState: "deny"
  }
}

type Seed = {
  readonly reference: string
  readonly section: string
  readonly manufacturer: string
  readonly mpn: string
  readonly package: string | null
  readonly sourceContract: string
  readonly sourceUrl: string | null
  readonly manufacturerDrawing?: SourceEvidence
  readonly pinMapOrientationOverlay?: {
    readonly state: "source-controlled-pending-review"
    readonly artifactPath: string
    readonly sha256: string
    readonly officialSources: {
      readonly seriesPrint: { readonly artifactPath: string; readonly url: string; readonly sha256: string }
      readonly footprintPrint: { readonly artifactPath: string; readonly url: string; readonly sha256: string }
      readonly cad: { readonly state: "not-acquired-access-gated"; readonly url: string; readonly reason: string }
    }
    readonly pinMap: {
      readonly rows: 2
      readonly positions: 16
      readonly pitchMm: 2.54
      readonly pinOneAtKeyedEnd: true
    }
    readonly bp143Reconciliation: {
      readonly signalCablePinOneMarker: "white stripe"
      readonly panelConnector: "INPUT"
      readonly sampleFitVerified: false
      readonly orientationVerified: false
      readonly continuityVerified: false
      readonly currentVerified: false
    }
  }
  readonly projectFootprintCandidate?: ProjectFootprintCandidate
}

const retainedPrimarySourceBatch = [
  {
    reference: "J_USB_C",
    mpn: "10177070-00011LF",
    package: "USB Type-C 16-position right-angle SMT receptacle, 0.80 mm PCB",
    path: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
    url: "https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf",
    sha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF"
  },
  {
    reference: "U_USB_PD",
    mpn: "TPS25730ADREFR",
    package: "WQFN (REF), 38-pin",
    path: "docs/evidence/bp-033/ti-tps25730a-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tps25730a.pdf",
    sha256: "B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28"
  },
  {
    reference: "U_USB_PORT_PROTECT",
    mpn: "TPD4S201TRGRRQ1",
    package: "VQFN (RGR), 20-pin",
    path: "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf",
    sha256: "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5"
  },
  {
    reference: "U_USB_DATA_PROTECT",
    mpn: "TPD2EUSB30DRTR",
    package: "SOT-9X3 (DRT), 3-pin",
    path: "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf",
    sha256: "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136"
  },
  {
    reference: "D_VBUS_TVS",
    mpn: "TVS2200DRVR",
    package: "WSON (DRV), 6-pin",
    path: "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tvs2200.pdf",
    sha256: "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801"
  },
  {
    reference: "D_SOURCE_SELECTOR",
    mpn: "B340A-13-F",
    package: "SMA (DO-214AC)",
    path: "docs/evidence/bp-033/diodes-b340a-datasheet.pdf",
    url: "https://www.diodes.com/datasheet/download/B340A.pdf",
    sha256: "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917"
  },
  {
    reference: "U_VBUS_EFUSE",
    mpn: "TPS259474ARPWR",
    package: "VQFN-HR (RPW), 10-pin",
    path: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
    sha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC"
  },
  {
    reference: "U_DISPLAY_LIMITER",
    mpn: "TPS259474ARPWR",
    package: "VQFN-HR (RPW), 10-pin",
    path: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tps25947.pdf",
    sha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC"
  },
  {
    reference: "L_APP_REGULATOR",
    mpn: "XGL4030-222MEC",
    package: "XGL4030, 4 mm x 4 mm x 3 mm molded power inductor",
    path: "docs/evidence/bp-033/coilcraft-xgl4030-datasheet.pdf",
    url: "https://www.coilcraft.com/getmedia/032d9c73-4222-482f-b6bc-7808590e27c9/xgl4030.pdf",
    sha256: "34BB1C739914FC2114653D5B3D5893E90501129D5C2AF8A152E546B8068B72E5"
  },
  {
    reference: "TP_W5500_RESET_N",
    mpn: "5001",
    package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
    path: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
    url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C"
  },
  {
    reference: "TP_W5500_INT_N",
    mpn: "5001",
    package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
    path: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
    url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C"
  },
  {
    reference: "R_W5500_INT_BIAS",
    mpn: "RC0603FR-07100KL",
    package: "0603",
    path: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
    url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
    sha256: "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
  }
] as const

function retainedSourceFor(reference: string): SourceEvidence | undefined {
  const source = retainedPrimarySourceBatch.find((candidate) => candidate.reference === reference)
  return source === undefined
    ? undefined
    : {
        state: "acquired",
        artifactPath: source.path,
        url: source.url,
        revision: `Primary source retained at ${source.path}`,
        sha256: source.sha256
      }
}

function hasPinMapOrientationOverlay(record: {
  readonly pinMapOrientationOverlay?: Seed["pinMapOrientationOverlay"]
}): record is { readonly pinMapOrientationOverlay: NonNullable<Seed["pinMapOrientationOverlay"]> } {
  return record.pinMapOrientationOverlay !== undefined
}

function hasProjectFootprintCandidate(record: {
  readonly projectFootprintCandidate?: Seed["projectFootprintCandidate"]
}): record is { readonly projectFootprintCandidate: NonNullable<Seed["projectFootprintCandidate"]> } {
  return record.projectFootprintCandidate !== undefined
}

const tps25730aRefProjectFootprintCandidate = {
  state: "source-controlled-review-only",
  artifactPath: "src/bp033-tps25730a-ref-project-footprint.tsx",
  testArtifactPath: "src/bp033-tps25730a-ref-project-footprint.test.tsx",
  renderedGeometrySha256: "b35cde8711ffe20c9c1f38804c2e885bc7caa610db4f9bb5243f760a00e3e7e0",
  orderableBinding: {
    orderableMpn: "TPS25730ADREFR",
    deviceMpn: "TPS25730AD",
    packageDrawing: "REF0038A",
    perimeterPins: 38,
    exposedPads: ["39 GND", "40 DRAIN"]
  },
  source: {
    artifactPath: "docs/evidence/bp-033/ti-tps25730a-datasheet.pdf",
    sha256: "B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28",
    reviewedPages: "1, 4-6, 61-63"
  },
  review: {
    state: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    scope:
      "Exact orderable/device/package binding, TI top-view pin order, published copper, exposed-pad identities, reference mapping, rendered-review hash, and deny-state integrity; mask, paste segmentation, courtyard, board fit, DRC, and fabrication remain unapproved."
  },
  authority: {
    manufacturerCadImported: false,
    boardImported: false,
    orientationAccepted: false,
    courtyardAccepted: false,
    drcAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const tpd4s201RgrProjectFootprintCandidate = {
  state: "source-controlled-review-only",
  artifactPath: "src/bp033-tpd4s201-rgr-project-footprint.tsx",
  testArtifactPath: "src/bp033-tpd4s201-rgr-project-footprint.test.tsx",
  renderedGeometrySha256: "6fa9a9c5018a1e1d9498032c2691e7aff50c0e0c9b2daa3acd4982cb21db4ac7",
  orderableBinding: {
    orderableMpn: "TPD4S201TRGRRQ1",
    deviceMpn: "TPD4S201-Q1",
    packageDrawing: "RGR0020C",
    perimeterPins: 20,
    exposedPads: ["21 GND"]
  },
  source: {
    artifactPath: "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf",
    sha256: "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5",
    reviewedPages: "1, 3-4, 21, 26-28"
  },
  review: {
    state: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    scope:
      "Exact orderable, RGR package, TI pin map, copper, rendered stencil dimensions, explicit circuit-port aliases, and deny-state integrity; CAD, board fit, orientation acceptance, DRC, release, and fabrication remain unapproved."
  },
  authority: {
    manufacturerCadImported: false,
    boardImported: false,
    orientationAccepted: false,
    courtyardAccepted: false,
    drcAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const tpd2eusb30DrtProjectFootprintCandidate = {
  state: "source-controlled-review-only",
  artifactPath: "src/bp033-tpd2eusb30drtr-drt-project-footprint.tsx",
  testArtifactPath: "src/bp033-tpd2eusb30drtr-drt-project-footprint.test.tsx",
  renderedGeometrySha256: "f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e",
  orderableBinding: {
    orderableMpn: "TPD2EUSB30DRTR",
    deviceMpn: "TPD2EUSB30",
    packageDrawing: "DRT0003A",
    electricalPinCount: 3,
    pinMap: [
      { pad: "1", signal: "D+", function: "D1+" },
      { pad: "2", signal: "D-", function: "D1-" },
      { pad: "3", signal: "GND", function: "GND" }
    ]
  },
  source: {
    artifactPath: "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf",
    sha256: "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136",
    reviewedPages: "1, 3, 12, 15-17"
  },
  review: {
    state: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    scope:
      "Exact TPD2EUSB30DRTR orderable, DRT package, three-pin map, retained TI sources, rendered review hash, and deny-state integrity; CAD, independent orientation, board fit, DRC, and fabrication remain unapproved."
  },
  authority: {
    manufacturerCadImported: false,
    boardImported: false,
    orientationAccepted: false,
    courtyardAccepted: false,
    drcAccepted: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

function selected(seed: Seed) {
  return {
    ...seed,
    packageStatus: seed.package === null ? "upstream-package-not-specified" : "exact-package-identified",
    population: "DNP-unresolved",
    manufacturerDrawing: seed.manufacturerDrawing ?? noEvidence().manufacturerDrawing,
    manufacturerCad: noEvidence().manufacturerCad,
    artwork: noEvidence().artwork,
    orientation: noEvidence().orientation
  } as const
}

function dnp(reference: string, retainedCandidateMpn: string | null, reason: string) {
  return {
    reference,
    retainedCandidateMpn,
    population: "DNP",
    reason,
    footprintLandPattern: "prohibited-until-a-scoped-selection-contract"
  } as const
}

const powerSeeds = [
  [
    "J_USB_C",
    "Amphenol ICC",
    "10177070-00011LF",
    "USB Type-C 16-position right-angle SMT receptacle, 0.80 mm PCB",
    "USB-C receptacle"
  ],
  ["U_USB_PD", "Texas Instruments", "TPS25730ADREFR", "WQFN (REF), 38-pin", "USB-C PD sink controller"],
  ["U_USB_PORT_PROTECT", "Texas Instruments", "TPD4S201TRGRRQ1", "VQFN (RGR), 20-pin", "CC/SBU protector"],
  ["U_USB_DATA_PROTECT", "Texas Instruments", "TPD2EUSB30DRTR", "SOT-9X3 (DRT), 3-pin", "USB data protector"],
  ["D_VBUS_TVS", "Texas Instruments", "TVS2200DRVR", "WSON (DRV), 6-pin", "VBUS TVS"],
  ["D_SOURCE_SELECTOR", "Diodes Incorporated", "B340A-13-F", "SMA (DO-214AC)", "source-selector surge diode"],
  ["U_VBUS_EFUSE", "Texas Instruments", "TPS259474ARPWR", "VQFN-HR (RPW), 10-pin", "VBUS eFuse"],
  ["U_DISPLAY_LIMITER", "Texas Instruments", "TPS259474ARPWR", "VQFN-HR (RPW), 10-pin", "display branch limiter"],
  ["S_SOURCE_SELECTOR", "C&K", "7101SYZQE", null, "de-energized source selector"],
  ["F_APPLICATION", "Littelfuse", "0451002.MRL", null, "application branch fuse"],
  ["F_DISPLAY", "Littelfuse", "045106.3MRL", null, "display branch fuse"],
  ["F_SCORING", "Littelfuse", "0451.500MRL", null, "isolated scoring branch fuse"],
  ["J_LAB_INJECTION", "Molex", "43045-0400", null, "laboratory injection header"],
  ["J_LINK_INPUT", "Molex", "39-28-1023", null, "input removable measurement link"],
  ["J_LINK_APPLICATION", "Molex", "39-28-1023", null, "application removable measurement link"],
  ["J_LINK_DISPLAY", "Molex", "39-28-1023", null, "display removable measurement link"],
  ["J_LINK_SCORING", "Molex", "39-28-1023", null, "scoring removable measurement link"],
  ["R_DISPLAY_ILM", "Yageo", "RC0402FR-07698RL", "0402", "display limiter ILM resistor"],
  ["C_DISPLAY_BYPASS", "KEMET", "C0402C104K3RACTU", "0402", "display limiter local bypass"],
  ["C_DISPLAY_DVDT", "KEMET", "C0402C222K3RACTU", "0402", "display limiter dV/dt capacitor"],
  ["C_DISPLAY_ITIMER", "KEMET", "C0402C222K3RACTU", "0402", "display limiter retry capacitor"],
  ["C_DISPLAY_IN", "TDK", "C2012X7S1A226M125AC", "0805", "display limiter input capacitor"],
  ["C_DISPLAY_OUT", "TDK", "C2012X7S1A226M125AC", "0805", "display limiter output capacitor"],
  ["R_DISPLAY_PG_PULLUP", "Yageo", "RC0402FR-0710KL", "0402", "display limiter PG pull-up"],
  ["R_DISPLAY_PG_LOWER", "Yageo", "RC0402FR-0749K9L", "0402", "display limiter threshold lower resistor"],
  ["R_DISPLAY_PG_UPPER", "Yageo", "RC0402FR-07137KL", "0402", "display limiter threshold upper resistor"]
] as const

const applicationSeeds = [
  ["U_APP_REGULATOR", "Texas Instruments", "LMR43620MSC3RPERQ1", "VQFN-HR RPE, 2 mm x 2 mm", "application regulator"],
  [
    "L_APP_REGULATOR",
    "Coilcraft",
    "XGL4030-222MEC",
    "XGL4030, 4 mm x 4 mm x 3 mm molded power inductor",
    "application regulator inductor"
  ],
  ["C_APP_REG_IN", "TDK", "C2012X7R1E475K125AB", "0805", "application regulator input capacitor"],
  ["C_APP_REG_IN_HF", "KEMET", "C0603C104K3RACTU", "0603", "application regulator bypass"],
  ["C_APP_REG_BOOT", "KEMET", "C0603C104K3RACTU", "0603", "application regulator bootstrap capacitor"],
  ["C_APP_REG_VCC", "Wurth Elektronik", "885012206052", "0603", "application regulator VCC bypass"],
  ["C_APP_REG_OUT_A", "TDK", "C2012X7S1A226M125AC", "0805", "application rail output capacitor"],
  ["C_APP_REG_OUT_B", "TDK", "C2012X7S1A226M125AC", "0805", "application rail output capacitor"],
  ["C_APP_REG_OUT_C", "TDK", "C2012X7S1A226M125AC", "0805", "application rail output capacitor"],
  ["R_APP_REG_DISCHARGE", "Yageo", "RC0603FR-071KL", "0603", "application rail discharge resistor"],
  ["R_APP_REG_PGOOD", "Yageo", "RC0603FR-0710KL", "0603", "application regulator PGOOD pull-up"]
] as const

const ethernetSeeds = [
  {
    reference: "U_W5500",
    section: "ethernet",
    manufacturer: "WIZnet",
    mpn: "W5500",
    package: "LQFP-48, 7 mm x 7 mm, 0.5 mm pitch",
    sourceContract: "BP-140/BP-141",
    sourceUrl: "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf"
  },
  {
    reference: "J_ETH",
    section: "ethernet",
    manufacturer: "Würth Elektronik",
    mpn: "7499011121A",
    package: null,
    sourceContract: "BP-141",
    sourceUrl: "https://www.we-online.com/components/products/datasheet/7499011121A.pdf"
  },
  ...ethernetSupportNetwork.supportNetworkComponents.map((part) => ({
    reference: part.reference,
    section: "ethernet",
    manufacturer: part.manufacturer,
    mpn: part.mpn,
    package: part.package,
    sourceContract: "BP-140",
    sourceUrl: part.sourceUrls[0] ?? null
  })),
  {
    reference: "TP_W5500_RESET_N",
    section: "ethernet",
    manufacturer: benchPrototypeEthernet.nets.reset.testPoint.manufacturer,
    mpn: benchPrototypeEthernet.nets.reset.testPoint.mpn,
    package: benchPrototypeEthernet.nets.reset.testPoint.package,
    sourceContract: "BP-140/BP-033",
    sourceUrl: benchPrototypeEthernet.nets.reset.testPoint.sourceEvidence.url
  },
  {
    reference: "TP_W5500_INT_N",
    section: "ethernet",
    manufacturer: benchPrototypeEthernet.nets.interrupt.testPoint.manufacturer,
    mpn: benchPrototypeEthernet.nets.interrupt.testPoint.mpn,
    package: benchPrototypeEthernet.nets.interrupt.testPoint.package,
    sourceContract: "BP-140/BP-033",
    sourceUrl: benchPrototypeEthernet.nets.interrupt.testPoint.sourceEvidence.url
  },
  {
    reference: "R_W5500_INT_BIAS",
    section: "ethernet",
    manufacturer: benchPrototypeEthernet.nets.interrupt.bias.manufacturer,
    mpn: benchPrototypeEthernet.nets.interrupt.bias.mpn,
    package: benchPrototypeEthernet.nets.interrupt.bias.package,
    sourceContract: "BP-140/BP-033",
    sourceUrl: benchPrototypeEthernet.nets.interrupt.bias.biasEvidence.url
  },
  {
    reference: "R_W5500_RESET_PULLUP",
    section: "ethernet",
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    package: "0603",
    sourceContract: "BP-123/BP-140",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  {
    reference: "U_APP_RESET_FANOUT",
    section: "ethernet",
    manufacturer: "Texas Instruments",
    mpn: "SN74LVC2G07DCKR",
    package: "SC70-6",
    sourceContract: "BP-123/BP-140",
    sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74lvc2g07.pdf"
  }
] as const

const bp140SelectionBlockedReferences: readonly { readonly reference: string }[] = []

const bp140DnpReferences: readonly { readonly reference: string }[] = []

function currentBp140ReferenceSet(): string[] {
  return [
    benchPrototypeEthernet.controller.reference,
    ...benchPrototypeEthernet.supportParts.map((part) => part.reference),
    benchPrototypeEthernet.nets.reset.pullup.reference,
    benchPrototypeEthernet.nets.reset.driver.reference,
    benchPrototypeEthernet.nets.reset.observationEndpoint,
    benchPrototypeEthernet.nets.interrupt.bias.reference,
    benchPrototypeEthernet.nets.interrupt.observationEndpoint
  ].sort()
}

const hub75Seeds = [
  {
    reference: "J_HUB75",
    section: "HUB75",
    manufacturer: "Samtec",
    mpn: "TST-108-04-G-D-RA",
    package: "2 x 8 right-angle through-hole header",
    sourceContract: "BP-143",
    sourceUrl: "https://www.samtec.com/products/tst-108-04-g-d-ra",
    pinMapOrientationOverlay: {
      state: "source-controlled-pending-review",
      artifactPath: "docs/evidence/bp-033/samtec-tst-108-04-g-d-ra-pin-map-orientation-overlay.svg",
      sha256: "08FD50CDF71A209D936B6B74FD7DBBDAEDEF0404EA105A168623707FFA9D02F7",
      officialSources: {
        seriesPrint: {
          artifactPath: "docs/evidence/bp-143/samtec-tst-series-print.pdf",
          url: "https://suddendocs.samtec.com/prints/tst-1xx-xx-x-x-xx-xx-mkt.pdf",
          sha256: "56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059"
        },
        footprintPrint: {
          artifactPath: "docs/evidence/bp-143/samtec-tst-footprint.pdf",
          url: "https://suddendocs.samtec.com/prints/tss-tstd.pdf",
          sha256: "ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC"
        },
        cad: {
          state: "not-acquired-access-gated",
          url: "https://www.samtec.com/products/tst-108-04-g-d-ra",
          reason: "Samtec requires a valid email address before instant model download."
        }
      },
      pinMap: { rows: 2, positions: 16, pitchMm: 2.54, pinOneAtKeyedEnd: true },
      bp143Reconciliation: {
        signalCablePinOneMarker: "white stripe",
        panelConnector: "INPUT",
        sampleFitVerified: false,
        orientationVerified: false,
        continuityVerified: false,
        currentVerified: false
      }
    }
  },
  ...benchPrototypeHub75Safing.partIdentityEvidence.map((part) => ({
    reference: part.reference,
    section: "HUB75",
    manufacturer: part.manufacturer,
    mpn: part.mpn,
    package: part.package,
    sourceContract: "BP-144",
    sourceUrl: part.sourceUrl
  }))
] as const

const irSeeds = [
  {
    reference: "U_IR",
    section: "encrypted-IR",
    manufacturer: benchPrototypeIrReceiverSelection.receiver.manufacturer,
    mpn: benchPrototypeIrReceiverSelection.receiver.mpn,
    package: benchPrototypeIrReceiverSelection.receiver.package,
    sourceContract: "BP-146",
    sourceUrl: "https://www.vishay.com/docs/82491/tsop382.pdf"
  },
  ...benchPrototypeIrReceiverSelection.supportNetwork.map((part) => ({
    reference: part.reference,
    section: "encrypted-IR",
    manufacturer: part.manufacturer,
    mpn: part.mpn,
    package: part.package,
    sourceContract: "BP-146",
    sourceUrl: null
  })),
  {
    reference: "TP_IR_RX",
    section: "encrypted-IR",
    manufacturer: "Keystone Electronics",
    mpn: "5001",
    package: "miniature through-hole test point, 1.02 mm hole",
    sourceContract: "BP-146",
    sourceUrl: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf"
  },
  {
    reference: "U_FRAM",
    section: "application peripheral",
    manufacturer: "Infineon",
    mpn: "CY15B104Q-LHXIT",
    package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579",
    sourceContract: "BP-145",
    sourceUrl:
      "https://www.infineon.com/dgdl/Infineon-CY15B104Q-4-Mbit_(512_K_x_8)_Serial_(SPI)_F-RAM-DataSheet-v15_00-EN.pdf"
  },
  {
    reference: "R_FRAM_WP_PULLUP",
    section: "application peripheral",
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    package: "0603",
    sourceContract: "BP-145",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  {
    reference: "R_FRAM_HOLD_PULLUP",
    section: "application peripheral",
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    package: "0603",
    sourceContract: "BP-145",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  {
    reference: "C_FRAM_BYPASS",
    section: "application peripheral",
    manufacturer: "KEMET",
    mpn: "C0603C104K3RACTU",
    package: "0603",
    sourceContract: "BP-145",
    sourceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU"
  }
] as const

const records = [
  ...powerSeeds.map(([reference, manufacturer, mpn, packageName, role]) =>
    selected({
      reference,
      section: "power",
      manufacturer,
      mpn,
      package: packageName,
      sourceContract: "BP-050",
      sourceUrl: retainedSourceFor(reference)?.url ?? null,
      manufacturerDrawing: retainedSourceFor(reference),
      projectFootprintCandidate:
        reference === "U_USB_PD"
          ? tps25730aRefProjectFootprintCandidate
          : reference === "U_USB_PORT_PROTECT"
            ? tpd4s201RgrProjectFootprintCandidate
            : reference === "U_USB_DATA_PROTECT"
              ? tpd2eusb30DrtProjectFootprintCandidate
              : undefined,
      role
    } as Seed & { readonly role: string })
  ),
  ...applicationSeeds.map(([reference, manufacturer, mpn, packageName, role]) =>
    selected({
      reference,
      section: "application-3v3",
      manufacturer,
      mpn,
      package: packageName,
      sourceContract: "BP-142",
      sourceUrl: retainedSourceFor(reference)?.url ?? null,
      manufacturerDrawing: retainedSourceFor(reference),
      role
    } as Seed & { readonly role: string })
  ),
  ...ethernetSeeds.map((seed) =>
    selected({
      ...seed,
      sourceUrl: retainedSourceFor(seed.reference)?.url ?? seed.sourceUrl,
      manufacturerDrawing: retainedSourceFor(seed.reference)
    })
  ),
  ...hub75Seeds.map(selected),
  ...irSeeds.map(selected)
]

const bp140ReferenceReconciliation = [
  ...records
    .filter((record) => record.sourceContract.includes("BP-140"))
    .map((record) => ({
      reference: record.reference,
      reconciliation: "selected-awaiting-footprint-evidence" as const
    })),
  ...bp140DnpReferences.map((record) => ({
    reference: record.reference,
    reconciliation: "DNP-reviewed" as const
  }))
].sort((left, right) => left.reference.localeCompare(right.reference))

const w5500BypassReferences = [
  "C_ETH_AVDD_FERRITE_INPUT",
  "C_W5500_VDD",
  "C_W5500_AVDD_1",
  "C_W5500_AVDD_2",
  "C_W5500_AVDD_3",
  "C_W5500_AVDD_4",
  "C_W5500_AVDD_5",
  "C_W5500_AVDD_6"
] as const

const molexLinkReferences = ["J_LINK_INPUT", "J_LINK_APPLICATION", "J_LINK_DISPLAY", "J_LINK_SCORING"] as const

const projectFootprintMappings = [
  {
    reference: "J_USB_C",
    artifactKind: "bp033-usb-c-project-footprint",
    artworkModule: "src/bp033-usb-c-project-footprint.tsx",
    reviewDocument: "docs/bp-033-usb-c-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
    sourceSha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "D_SOURCE_SELECTOR",
    artifactKind: "bp033-b340a-project-footprint",
    artworkModule: "src/bp033-b340a-project-footprint.tsx",
    reviewDocument: "docs/bp-033-b340a-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/diodes-b340a-datasheet.pdf",
    sourceSha256: "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "S_SOURCE_SELECTOR",
    artifactKind: "bp033-7101syzqe-project-footprint",
    artworkModule: "src/bp033-7101syzqe-project-footprint.tsx",
    reviewDocument: "docs/bp-033-7101syzqe-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/ck-7000toggle-7101syzqe-datasheet.pdf",
    sourceSha256: "81C507AE655CBF893635F3E0ED421734A28AF08C975A8279E02070FFDCD353CB",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "D_VBUS_TVS",
    artifactKind: "bp033-tvs2200-project-footprint",
    artworkModule: "src/bp033-tvs2200-project-footprint.tsx",
    reviewDocument: "docs/bp-033-tvs2200-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf",
    sourceSha256: "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "F_APPLICATION",
    artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
    artworkModule: "src/bp033-littelfuse-0451-fuses.tsx",
    reviewDocument: "docs/bp-033-littelfuse-0451-fuses.md",
    sourceArtifactPath: "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf",
    sourceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "F_DISPLAY",
    artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
    artworkModule: "src/bp033-littelfuse-0451-fuses.tsx",
    reviewDocument: "docs/bp-033-littelfuse-0451-fuses.md",
    sourceArtifactPath: "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf",
    sourceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "F_SCORING",
    artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
    artworkModule: "src/bp033-littelfuse-0451-fuses.tsx",
    reviewDocument: "docs/bp-033-littelfuse-0451-fuses.md",
    sourceArtifactPath: "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf",
    sourceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "U_VBUS_EFUSE",
    artifactKind: "bp033-tps25947-project-footprint",
    artworkModule: "src/bp033-tps25947-project-footprint.tsx",
    reviewDocument: "docs/bp-033-tps25947-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
    sourceSha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  {
    reference: "U_DISPLAY_LIMITER",
    artifactKind: "bp033-tps25947-project-footprint",
    artworkModule: "src/bp033-tps25947-project-footprint.tsx",
    reviewDocument: "docs/bp-033-tps25947-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
    sourceSha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC",
    reviewState: "root-reviewed-review-input",
    reviewer: "root-final-reviewer",
    reviewedAt: "2026-08-25",
    fabricationRelease: "deny"
  },
  ...w5500BypassReferences.map((reference) => ({
    reference,
    artifactKind: "bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint",
    artworkModule: "src/bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint.tsx",
    reviewDocument: "docs/bp-033-w5500-100nf-bypass-footprint-evidence.md",
    sourceArtifactPath: "docs/evidence/bp-033/murata-grm188r71c104ka01d-reference-sheet.pdf",
    sourceSha256: "A8D9E8E5A06AA235221C7E957837509E64A9F75E42230EE142F51F984B4CFA09",
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25" as const,
    fabricationRelease: "deny" as const
  })),
  ...molexLinkReferences.map((reference) => ({
    reference,
    artifactKind: "bp033-molex-links-project-footprint",
    artworkModule: "src/bp033-molex-links-project-footprint.tsx",
    reviewDocument: "docs/bp-033-molex-links-project-footprint.md",
    sourceArtifactPath: "docs/evidence/bp-033/molex-39281023-product-page.pdf",
    sourceSha256: "BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691",
    reviewState: "root-reviewed-review-input" as const,
    reviewer: "root-final-reviewer" as const,
    reviewedAt: "2026-08-25" as const,
    fabricationRelease: "deny" as const
  }))
] as const

const definition = {
  artifactKind: "bench-prototype-application-footprint-closure-ledger",
  workUnit: "BP-033",
  targetAssembly: "one-board bench prototype",
  referenceAliases: [
    {
      canonical: "U_USB_PORT_PROTECT",
      ledgerAlias: "U_USB_CC_SBU_PROTECT",
      manufacturerPartNumber: "TPD4S201TRGRRQ1",
      disposition: "ledger-alias-only"
    }
  ],
  releaseState: "deny",
  fabricationAuthorized: false,
  upstream: {
    method: "BP-030",
    power: "BP-050",
    ethernet: ["BP-140", "BP-141"],
    applicationRail: "BP-142",
    hub75: ["BP-143", "BP-144"],
    optionalPeripherals: "BP-145",
    encryptedIrReceiver: "BP-146"
  },
  records,
  projectFootprintMappings,
  bp140ReferenceReconciliation,
  bp140SelectionBlockedReferences,
  bp140DnpReferences,
  omittedPeripherals: [
    dnp("U_RTC", "RV-3028-C7", "Not required for first physical validation."),
    dnp("U_SECURE_ELEMENT", "STSAFE-A110", "Exact provisioned orderable and package variant are not selected."),
    dnp("U_AUDIO", "TAS2505TRGERQ1", "Audio is not required; GPIO35 is dedicated to IR_RX."),
    dnp("J_SPEAKER", null, "No speaker, connector, or load evidence exists."),
    dnp("ANT_EXTERNAL", null, "No exact antenna/cable assembly is selected; Ethernet is the bench network path.")
  ],
  closureRules: [
    "A package identity never grants pad, drill, copper, mask, paste, courtyard, or assembly geometry.",
    "Each DNP-unresolved record requires an exact manufacturer drawing revision and SHA-256, exact CAD or an explicit no-CAD record, generated artwork hash, and independent orientation review.",
    "U_USB_PD has one source-controlled TPS25730ADREFR REF0038A artwork candidate with a rendered-geometry hash. It is review-only: no TI native CAD, board import, orientation, courtyard, DRC, release, or fabrication authority is granted.",
    "U_USB_PORT_PROTECT has one source-controlled TPD4S201TRGRRQ1 RGR review candidate with a rendered-geometry hash and explicit TI-to-circuit port aliases. It is review-only: no TI native CAD, board import, orientation, courtyard, DRC, release, or fabrication authority is granted.",
    "U_USB_DATA_PROTECT has one source-controlled TPD2EUSB30DRTR DRT review candidate with a rendered-geometry hash. It is review-only: no TI native CAD, board import, independent orientation, courtyard, DRC, release, or fabrication authority is granted.",
    "J_HUB75 has a source-controlled pin-map and orientation overlay bound to the canonical BP-143 Samtec prints. It is not a project footprint, CAD import, board artwork, sample fit, continuity, current, orientation, or fabrication approval.",
    "BP-300 may not instantiate a record whose packageStatus is upstream-package-not-specified; obtain the exact package from the manufacturer before assigning geometry.",
    "TP_W5500_RESET_N and TP_W5500_INT_N select Keystone Electronics 5001 miniature through-hole black test points with a 0.040 inch (catalog 1.0 mm) mounting hole; exact source evidence is retained, while drawings, CAD, artwork, orientation, and probe-clearance review remain open before population.",
    "R_W5500_INT_BIAS selects Yageo RC0603FR-07100KL, 100 kOhm, 1%, 0603, to provide the locally pulled-inactive INTn state required by the canonical ESP32 polling policy without allocating an ESP32 GPIO.",
    "Keep U_AUDIO and every omitted peripheral DNP. Do not create a land pattern, route, or bodge connection for an omitted peripheral.",
    "The TSOP38438 optical aperture, front-panel coupon, receiver timing/range/flood tests, and GPIO35 isolation remain BP-146 gates; they are not closed by this ledger."
  ],
  authority: {
    exactMpnAndManufacturerReconciled: true,
    fullBp140ReferenceSetReconciled: true,
    bp140BlockedReferenceIdentitiesReconciled: true,
    everyPackageIdentityReconciled: false,
    manufacturerDrawingsReviewed: false,
    manufacturerCadReviewed: false,
    artworkReviewed: false,
    orientationsReviewed: false,
    schematicIntegrationAuthorized: false,
    layoutAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

export const benchPrototypeApplicationFootprints = deepFreeze(definition)

function assertUpstream(): void {
  validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)
  calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)
  validateBenchPrototypeEthernet(benchPrototypeEthernet)
  validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)
  validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)
  validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)
  validateBenchPrototypeHub75Safing(benchPrototypeHub75Safing)
  validateBenchPrototypeOptionalPeripherals(benchPrototypeOptionalPeripherals)
  validateBenchPrototypeIrReceiverSelection(benchPrototypeIrReceiverSelection)
  if (validateBp033B340aProjectFootprintGeometry().length !== 0) {
    throw new RangeError("BP-033 B340A project-review candidate drifted")
  }
}

/** Rejects package inference, geometry credit, populated omitted peripherals, and release relaxation. */
export function validateBenchPrototypeApplicationFootprints(value: unknown): true {
  assertUpstream()
  if (!sameDataGraph(value, benchPrototypeApplicationFootprints))
    throw new RangeError("BP-033 must exactly match the reviewed fail-closed ledger")
  const contract = benchPrototypeApplicationFootprints
  const currentBp140References = currentBp140ReferenceSet()
  const reconciledBp140References = contract.bp140ReferenceReconciliation.map((record) => record.reference)
  const retainedSourceReferences = contract.records.filter((record) => record.manufacturerDrawing.state === "acquired")
  const retainedSourceReferenceIds = retainedSourceReferences.map((record) => record.reference)
  if (
    contract.workUnit !== "BP-033" ||
    contract.releaseState !== "deny" ||
    contract.referenceAliases.length !== 1 ||
    contract.referenceAliases[0]?.canonical !== "U_USB_PORT_PROTECT" ||
    contract.referenceAliases[0]?.ledgerAlias !== "U_USB_CC_SBU_PROTECT" ||
    contract.referenceAliases[0]?.manufacturerPartNumber !== "TPD4S201TRGRRQ1" ||
    contract.referenceAliases[0]?.disposition !== "ledger-alias-only" ||
    contract.fabricationAuthorized ||
    contract.authority.exactMpnAndManufacturerReconciled !== true ||
    contract.authority.fullBp140ReferenceSetReconciled !== true ||
    contract.authority.bp140BlockedReferenceIdentitiesReconciled !== true ||
    contract.authority.everyPackageIdentityReconciled ||
    contract.authority.manufacturerDrawingsReviewed ||
    contract.authority.manufacturerCadReviewed ||
    contract.authority.artworkReviewed ||
    contract.authority.orientationsReviewed ||
    contract.records.length === 0 ||
    contract.records.some(
      (record) => !record.reference || !record.manufacturer || !record.mpn || record.population !== "DNP-unresolved"
    ) ||
    contract.records.some(
      (record) =>
        (record.manufacturerDrawing.state !== "not-acquired" &&
          !retainedPrimarySourceBatch.some((source) => source.reference === record.reference)) ||
        record.manufacturerCad.state !== "not-acquired" ||
        record.artwork.state !== "not-generated" ||
        record.orientation.state !== "unreviewed"
    ) ||
    new Set(retainedPrimarySourceBatch.map((source) => source.reference)).size !== retainedPrimarySourceBatch.length ||
    retainedSourceReferences.length !== retainedPrimarySourceBatch.length ||
    new Set(retainedSourceReferenceIds).size !== retainedSourceReferenceIds.length ||
    retainedPrimarySourceBatch.some((source) => {
      const record = retainedSourceReferences.find((candidate) => candidate.reference === source.reference)
      return (
        record === undefined ||
        record.mpn !== source.mpn ||
        record.package !== source.package ||
        record.sourceUrl !== source.url ||
        record.manufacturerDrawing.artifactPath !== source.path ||
        record.manufacturerDrawing.url !== source.url ||
        record.manufacturerDrawing.sha256 !== source.sha256 ||
        record.manufacturerDrawing.revision !== `Primary source retained at ${source.path}`
      )
    }) ||
    contract.projectFootprintMappings.length !== 21 ||
    contract.projectFootprintMappings[0]?.reference !== "J_USB_C" ||
    contract.projectFootprintMappings[0]?.artifactKind !== "bp033-usb-c-project-footprint" ||
    contract.projectFootprintMappings[0]?.artworkModule !== "src/bp033-usb-c-project-footprint.tsx" ||
    contract.projectFootprintMappings[0]?.reviewDocument !== "docs/bp-033-usb-c-project-footprint.md" ||
    contract.projectFootprintMappings[0]?.sourceArtifactPath !==
      "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf" ||
    contract.projectFootprintMappings[0]?.sourceSha256 !==
      "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF" ||
    contract.projectFootprintMappings[0]?.reviewState !== "root-reviewed-review-input" ||
    contract.projectFootprintMappings[0]?.reviewer !== "root-final-reviewer" ||
    contract.projectFootprintMappings[0]?.fabricationRelease !== "deny" ||
    contract.projectFootprintMappings[1]?.reference !== "D_SOURCE_SELECTOR" ||
    contract.projectFootprintMappings[1]?.artifactKind !== "bp033-b340a-project-footprint" ||
    contract.projectFootprintMappings[1]?.artworkModule !== "src/bp033-b340a-project-footprint.tsx" ||
    contract.projectFootprintMappings[1]?.reviewDocument !== "docs/bp-033-b340a-project-footprint.md" ||
    contract.projectFootprintMappings[1]?.sourceArtifactPath !== "docs/evidence/bp-033/diodes-b340a-datasheet.pdf" ||
    contract.projectFootprintMappings[1]?.sourceSha256 !==
      "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917" ||
    contract.projectFootprintMappings[1]?.reviewState !== "root-reviewed-review-input" ||
    contract.projectFootprintMappings[1]?.reviewer !== "root-final-reviewer" ||
    contract.projectFootprintMappings[1]?.fabricationRelease !== "deny" ||
    contract.projectFootprintMappings[2]?.reference !== "S_SOURCE_SELECTOR" ||
    contract.projectFootprintMappings[2]?.artifactKind !== "bp033-7101syzqe-project-footprint" ||
    contract.projectFootprintMappings[2]?.artworkModule !== "src/bp033-7101syzqe-project-footprint.tsx" ||
    contract.projectFootprintMappings[2]?.reviewDocument !== "docs/bp-033-7101syzqe-project-footprint.md" ||
    contract.projectFootprintMappings[2]?.sourceArtifactPath !==
      "docs/evidence/bp-033/ck-7000toggle-7101syzqe-datasheet.pdf" ||
    contract.projectFootprintMappings[2]?.sourceSha256 !==
      "81C507AE655CBF893635F3E0ED421734A28AF08C975A8279E02070FFDCD353CB" ||
    contract.projectFootprintMappings[2]?.reviewState !== "root-reviewed-review-input" ||
    contract.projectFootprintMappings[2]?.reviewer !== "root-final-reviewer" ||
    contract.projectFootprintMappings[2]?.fabricationRelease !== "deny" ||
    contract.projectFootprintMappings[3]?.reference !== "D_VBUS_TVS" ||
    contract.projectFootprintMappings[3]?.artifactKind !== "bp033-tvs2200-project-footprint" ||
    contract.projectFootprintMappings[3]?.artworkModule !== "src/bp033-tvs2200-project-footprint.tsx" ||
    contract.projectFootprintMappings[3]?.reviewDocument !== "docs/bp-033-tvs2200-project-footprint.md" ||
    contract.projectFootprintMappings[3]?.sourceArtifactPath !== "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf" ||
    contract.projectFootprintMappings[3]?.sourceSha256 !==
      "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801" ||
    contract.projectFootprintMappings[3]?.reviewState !== "root-reviewed-review-input" ||
    contract.projectFootprintMappings[3]?.reviewer !== "root-final-reviewer" ||
    contract.projectFootprintMappings[3]?.fabricationRelease !== "deny" ||
    !(["F_APPLICATION", "F_DISPLAY", "F_SCORING"] as const).every((reference, offset) => {
      const mapping = contract.projectFootprintMappings[4 + offset]
      return (
        mapping?.reference === reference &&
        mapping.artifactKind === "bp033-littelfuse-0451-fuses-footprint-evidence" &&
        mapping.artworkModule === "src/bp033-littelfuse-0451-fuses.tsx" &&
        mapping.reviewDocument === "docs/bp-033-littelfuse-0451-fuses.md" &&
        mapping.sourceArtifactPath === "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf" &&
        mapping.sourceSha256 === "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2" &&
        mapping.reviewState === "root-reviewed-review-input" &&
        mapping.reviewer === "root-final-reviewer" &&
        mapping.fabricationRelease === "deny"
      )
    }) ||
    !(["U_VBUS_EFUSE", "U_DISPLAY_LIMITER"] as const).every((reference, offset) => {
      const mapping = contract.projectFootprintMappings[7 + offset]
      return (
        mapping?.reference === reference &&
        mapping.artifactKind === "bp033-tps25947-project-footprint" &&
        mapping.artworkModule === "src/bp033-tps25947-project-footprint.tsx" &&
        mapping.reviewDocument === "docs/bp-033-tps25947-project-footprint.md" &&
        mapping.sourceArtifactPath === "docs/evidence/bp-033/ti-tps25947-datasheet.pdf" &&
        mapping.sourceSha256 === "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC" &&
        mapping.reviewState === "root-reviewed-review-input" &&
        mapping.reviewer === "root-final-reviewer" &&
        mapping.reviewedAt === "2026-08-25" &&
        mapping.fabricationRelease === "deny"
      )
    }) ||
    !w5500BypassReferences.every((reference, offset) => {
      const mapping = contract.projectFootprintMappings[9 + offset]
      return (
        mapping?.reference === reference &&
        mapping.artifactKind === "bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint" &&
        mapping.artworkModule === "src/bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint.tsx" &&
        mapping.reviewDocument === "docs/bp-033-w5500-100nf-bypass-footprint-evidence.md" &&
        mapping.sourceArtifactPath === "docs/evidence/bp-033/murata-grm188r71c104ka01d-reference-sheet.pdf" &&
        mapping.sourceSha256 === "A8D9E8E5A06AA235221C7E957837509E64A9F75E42230EE142F51F984B4CFA09" &&
        mapping.reviewState === "root-reviewed-review-input" &&
        mapping.reviewer === "root-final-reviewer" &&
        mapping.reviewedAt === "2026-08-25" &&
        mapping.fabricationRelease === "deny"
      )
    }) ||
    !molexLinkReferences.every((reference, offset) => {
      const mapping = contract.projectFootprintMappings[17 + offset]
      return (
        mapping?.reference === reference &&
        mapping.artifactKind === "bp033-molex-links-project-footprint" &&
        mapping.artworkModule === "src/bp033-molex-links-project-footprint.tsx" &&
        mapping.reviewDocument === "docs/bp-033-molex-links-project-footprint.md" &&
        mapping.sourceArtifactPath === "docs/evidence/bp-033/molex-39281023-product-page.pdf" &&
        mapping.sourceSha256 === "BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691" &&
        mapping.reviewState === "root-reviewed-review-input" &&
        mapping.reviewer === "root-final-reviewer" &&
        mapping.reviewedAt === "2026-08-25" &&
        mapping.fabricationRelease === "deny"
      )
    }) ||
    !contract.records.some(
      (record) =>
        record.reference === "U_USB_PD" &&
        record.mpn === "TPS25730ADREFR" &&
        hasProjectFootprintCandidate(record) &&
        record.projectFootprintCandidate.state === "source-controlled-review-only" &&
        record.projectFootprintCandidate.artifactPath === "src/bp033-tps25730a-ref-project-footprint.tsx" &&
        record.projectFootprintCandidate.testArtifactPath === "src/bp033-tps25730a-ref-project-footprint.test.tsx" &&
        record.projectFootprintCandidate.renderedGeometrySha256 ===
          "b35cde8711ffe20c9c1f38804c2e885bc7caa610db4f9bb5243f760a00e3e7e0" &&
        record.projectFootprintCandidate.orderableBinding.deviceMpn === "TPS25730AD" &&
        record.projectFootprintCandidate.orderableBinding.packageDrawing === "REF0038A" &&
        record.projectFootprintCandidate.orderableBinding.perimeterPins === 38 &&
        record.projectFootprintCandidate.orderableBinding.exposedPads?.[0] === "39 GND" &&
        record.projectFootprintCandidate.orderableBinding.exposedPads?.[1] === "40 DRAIN" &&
        record.projectFootprintCandidate.source.artifactPath === "docs/evidence/bp-033/ti-tps25730a-datasheet.pdf" &&
        record.projectFootprintCandidate.source.sha256 ===
          "B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28" &&
        record.projectFootprintCandidate.source.reviewedPages === "1, 4-6, 61-63" &&
        record.projectFootprintCandidate.review.state === "root-reviewed-review-input" &&
        record.projectFootprintCandidate.review.reviewer === "root-final-reviewer" &&
        record.projectFootprintCandidate.authority.manufacturerCadImported === false &&
        record.projectFootprintCandidate.authority.boardImported === false &&
        record.projectFootprintCandidate.authority.orientationAccepted === false &&
        record.projectFootprintCandidate.authority.courtyardAccepted === false &&
        record.projectFootprintCandidate.authority.drcAccepted === false &&
        record.projectFootprintCandidate.authority.fabricationAuthorized === false &&
        record.projectFootprintCandidate.authority.releaseState === "deny"
    ) ||
    !contract.records.some(
      (record) =>
        record.reference === "U_USB_PORT_PROTECT" &&
        record.mpn === "TPD4S201TRGRRQ1" &&
        record.package === "VQFN (RGR), 20-pin" &&
        hasProjectFootprintCandidate(record) &&
        record.projectFootprintCandidate.state === "source-controlled-review-only" &&
        record.projectFootprintCandidate.artifactPath === "src/bp033-tpd4s201-rgr-project-footprint.tsx" &&
        record.projectFootprintCandidate.testArtifactPath === "src/bp033-tpd4s201-rgr-project-footprint.test.tsx" &&
        record.projectFootprintCandidate.renderedGeometrySha256 ===
          "6fa9a9c5018a1e1d9498032c2691e7aff50c0e0c9b2daa3acd4982cb21db4ac7" &&
        record.projectFootprintCandidate.orderableBinding.orderableMpn === "TPD4S201TRGRRQ1" &&
        record.projectFootprintCandidate.orderableBinding.deviceMpn === "TPD4S201-Q1" &&
        record.projectFootprintCandidate.orderableBinding.packageDrawing === "RGR0020C" &&
        record.projectFootprintCandidate.orderableBinding.perimeterPins === 20 &&
        record.projectFootprintCandidate.orderableBinding.exposedPads?.length === 1 &&
        record.projectFootprintCandidate.orderableBinding.exposedPads?.[0] === "21 GND" &&
        record.projectFootprintCandidate.source.artifactPath === "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf" &&
        record.projectFootprintCandidate.source.sha256 ===
          "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5" &&
        record.projectFootprintCandidate.source.reviewedPages === "1, 3-4, 21, 26-28" &&
        record.projectFootprintCandidate.review.state === "root-reviewed-review-input" &&
        record.projectFootprintCandidate.review.reviewer === "root-final-reviewer" &&
        record.projectFootprintCandidate.review.reviewedAt === "2026-08-25" &&
        record.projectFootprintCandidate.authority.manufacturerCadImported === false &&
        record.projectFootprintCandidate.authority.boardImported === false &&
        record.projectFootprintCandidate.authority.orientationAccepted === false &&
        record.projectFootprintCandidate.authority.courtyardAccepted === false &&
        record.projectFootprintCandidate.authority.drcAccepted === false &&
        record.projectFootprintCandidate.authority.fabricationAuthorized === false &&
        record.projectFootprintCandidate.authority.releaseState === "deny"
    ) ||
    !contract.records.some(
      (record) =>
        record.reference === "U_USB_DATA_PROTECT" &&
        record.manufacturer === "Texas Instruments" &&
        record.mpn === "TPD2EUSB30DRTR" &&
        record.package === "SOT-9X3 (DRT), 3-pin" &&
        hasProjectFootprintCandidate(record) &&
        record.projectFootprintCandidate.state === "source-controlled-review-only" &&
        record.projectFootprintCandidate.artifactPath === "src/bp033-tpd2eusb30drtr-drt-project-footprint.tsx" &&
        record.projectFootprintCandidate.testArtifactPath ===
          "src/bp033-tpd2eusb30drtr-drt-project-footprint.test.tsx" &&
        record.projectFootprintCandidate.renderedGeometrySha256 ===
          "f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e" &&
        record.projectFootprintCandidate.orderableBinding.orderableMpn === "TPD2EUSB30DRTR" &&
        record.projectFootprintCandidate.orderableBinding.deviceMpn === "TPD2EUSB30" &&
        record.projectFootprintCandidate.orderableBinding.packageDrawing === "DRT0003A" &&
        record.projectFootprintCandidate.orderableBinding.electricalPinCount === 3 &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.length === 3 &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[0]?.pad === "1" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[0]?.signal === "D+" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[0]?.function === "D1+" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[1]?.pad === "2" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[1]?.signal === "D-" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[1]?.function === "D1-" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[2]?.pad === "3" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[2]?.signal === "GND" &&
        record.projectFootprintCandidate.orderableBinding.pinMap?.[2]?.function === "GND" &&
        record.projectFootprintCandidate.source.artifactPath === "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf" &&
        record.projectFootprintCandidate.source.sha256 ===
          "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136" &&
        record.projectFootprintCandidate.source.reviewedPages === "1, 3, 12, 15-17" &&
        record.projectFootprintCandidate.review.state === "root-reviewed-review-input" &&
        record.projectFootprintCandidate.review.reviewer === "root-final-reviewer" &&
        record.projectFootprintCandidate.review.reviewedAt === "2026-08-25" &&
        record.projectFootprintCandidate.authority.manufacturerCadImported === false &&
        record.projectFootprintCandidate.authority.boardImported === false &&
        record.projectFootprintCandidate.authority.orientationAccepted === false &&
        record.projectFootprintCandidate.authority.courtyardAccepted === false &&
        record.projectFootprintCandidate.authority.drcAccepted === false &&
        record.projectFootprintCandidate.authority.fabricationAuthorized === false &&
        record.projectFootprintCandidate.authority.releaseState === "deny"
    ) ||
    contract.records.filter(hasProjectFootprintCandidate).length !== 3 ||
    !contract.records.some(
      (record) =>
        record.reference === "J_HUB75" &&
        record.mpn === "TST-108-04-G-D-RA" &&
        hasPinMapOrientationOverlay(record) &&
        record.pinMapOrientationOverlay.state === "source-controlled-pending-review" &&
        record.pinMapOrientationOverlay.artifactPath ===
          "docs/evidence/bp-033/samtec-tst-108-04-g-d-ra-pin-map-orientation-overlay.svg" &&
        record.pinMapOrientationOverlay.officialSources.seriesPrint.artifactPath ===
          "docs/evidence/bp-143/samtec-tst-series-print.pdf" &&
        record.pinMapOrientationOverlay.officialSources.seriesPrint.sha256 ===
          "56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059" &&
        record.pinMapOrientationOverlay.officialSources.footprintPrint.artifactPath ===
          "docs/evidence/bp-143/samtec-tst-footprint.pdf" &&
        record.pinMapOrientationOverlay.officialSources.footprintPrint.sha256 ===
          "ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC" &&
        record.pinMapOrientationOverlay.officialSources.cad.state === "not-acquired-access-gated" &&
        record.pinMapOrientationOverlay.bp143Reconciliation.sampleFitVerified === false &&
        record.pinMapOrientationOverlay.bp143Reconciliation.orientationVerified === false &&
        record.pinMapOrientationOverlay.bp143Reconciliation.continuityVerified === false &&
        record.pinMapOrientationOverlay.bp143Reconciliation.currentVerified === false
    ) ||
    contract.records.filter(hasPinMapOrientationOverlay).length !== 1 ||
    !contract.records.some((record) => record.packageStatus === "upstream-package-not-specified") ||
    !contract.records.some(
      (record) =>
        record.reference === "R_W5500_INT_BIAS" &&
        record.manufacturer === "Yageo" &&
        record.mpn === "RC0603FR-07100KL" &&
        record.package === "0603" &&
        record.population === "DNP-unresolved" &&
        record.packageStatus === "exact-package-identified"
    ) ||
    currentBp140References.length !== reconciledBp140References.length ||
    currentBp140References.some((reference, index) => reference !== reconciledBp140References[index]) ||
    contract.bp140SelectionBlockedReferences.length !== 0 ||
    contract.bp140DnpReferences.length !== 0 ||
    contract.omittedPeripherals.length !== 5 ||
    contract.omittedPeripherals.some((record) => record.population !== "DNP") ||
    !contract.omittedPeripherals.some((record) => record.reference === "U_AUDIO")
  )
    throw new RangeError("BP-033 must remain complete, fail-closed, and fabrication denied")
  return true
}

validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)
