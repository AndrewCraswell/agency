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
}

const retainedPrimarySourceBatch = [
  {
    reference: "U_USB_PD",
    mpn: "TPS25730ADREFR",
    package: "WQFN (REF), 38-pin",
    path: "docs/evidence/bp-033/ti-tps25730a-datasheet.pdf",
    url: "https://www.ti.com/lit/ds/symlink/tps25730a.pdf",
    sha256: "B7D9836E4C82D28BF400FC1747586F24C26DAF94A629AAB4EE57C49072371D28"
  },
  {
    reference: "U_USB_CC_SBU_PROTECT",
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
  ["J_USB_C", "Amphenol ICC", "10177070-00011LF", null, "USB-C receptacle"],
  ["U_USB_PD", "Texas Instruments", "TPS25730ADREFR", "WQFN (REF), 38-pin", "USB-C PD sink controller"],
  ["U_USB_CC_SBU_PROTECT", "Texas Instruments", "TPD4S201TRGRRQ1", "VQFN (RGR), 20-pin", "CC/SBU protector"],
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

const definition = {
  artifactKind: "bench-prototype-application-footprint-closure-ledger",
  workUnit: "BP-033",
  targetAssembly: "one-board bench prototype",
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
