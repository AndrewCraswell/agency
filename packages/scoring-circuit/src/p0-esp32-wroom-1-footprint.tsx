import { Fragment, type ReactElement } from "react"

const moduleMpn = "ESP32-S3-WROOM-1-N16R2"

type PadPosition = {
  readonly number: number
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
}

const sidePadYs = Array.from({ length: 14 }, (_, index) => Number((8.255 - index * 1.27).toFixed(3)))
const bottomPadXs = Array.from({ length: 12 }, (_, index) => Number((-6.985 + index * 1.27).toFixed(3)))

// The footprint origin is the nominal centre of the 18 mm x 19.2 mm terminal
// field. The WROOM-1 antenna extends 6 mm beyond that field, so it is not the
// centre of the complete 18 mm x 25.5 mm module body.
const perimeterPads: readonly PadPosition[] = [
  ...sidePadYs.map((yMm, index) => ({
    number: index + 1,
    xMm: -8.75,
    yMm,
    widthMm: 1.5,
    heightMm: 0.9
  })),
  ...bottomPadXs.map((xMm, index) => ({
    number: index + 15,
    xMm,
    yMm: -9.5,
    widthMm: 0.9,
    heightMm: 1.5
  })),
  ...sidePadYs.map((_, index) => ({
    number: index + 27,
    xMm: 8.75,
    yMm: Number((-8.255 + index * 1.27).toFixed(3)),
    widthMm: 1.5,
    heightMm: 0.9
  }))
]

const thermalVias = [
  [-2.9, -0.9],
  [-1.5, -0.9],
  [-0.1, -0.9],
  [-2.9, 0.5],
  [-1.5, 0.5],
  [-0.1, 0.5],
  [-2.9, 1.9],
  [-1.5, 1.9],
  [-0.1, 1.9]
] as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("P0 ESP32 footprint cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("P0 ESP32 footprint must contain data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const p0Esp32Wroom1FootprintMetadata = deepFreeze({
  artifactKind: "p0-06-esp32-wroom-1-footprint",
  workUnit: "P0-06",
  canonicalReference: "U_APP",
  manufacturer: "Espressif Systems",
  manufacturerPartNumber: moduleMpn,
  exactSelection: {
    flash: "16 MB Quad SPI",
    psram: "2 MB Quad SPI",
    antenna: "integrated on-module PCB antenna",
    supplyRangeV: { minimum: 3, maximum: 3.6 }
  },
  officialSources: {
    datasheet: {
      url: "https://documentation.espressif.com/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
      artifactPath:
        "packages/scoring-circuit/docs/evidence/p0-06/espressif-esp32-s3-wroom-1-wroom-1u-datasheet-official.pdf",
      sha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435",
      reviewedPrintedPages: [42, 45, 46]
    },
    footprintDxf: {
      url: "https://www.espressif.com/sites/default/files/modules-dxf/ESP32-S3-WROOM-1%20PCB%20Footprint.dxf",
      artifactPath:
        "packages/scoring-circuit/docs/evidence/p0-06/espressif-esp32-s3-wroom-1-pcb-footprint-official.dxf",
      sha256: "565CB080DC99EB49E6E5CCFA97DA0295AE1F1DC8113FF83AE10575A1E64F77E4",
      reviewedLayers: ["PART_TOP_COPPER_01", "SOLDERMASKTOP_P", "PADS_TOP"]
    },
    mechanicalStep: {
      url: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1%203D%20Model.STEP",
      artifactPath: "packages/scoring-circuit/docs/evidence/p0-06/espressif-esp32-s3-wroom-1-3d-model-official.step",
      sha256: "02E192087A1A2268CCBE7BF667EF04884370FC76C994484BF85654DFA7407EF6"
    }
  },
  package: {
    bodyMm: { width: 18, length: 25.5, height: 3.1 },
    perimeterPadCount: perimeterPads.length,
    exposedGroundPad: 41,
    perimeterPitchMm: 1.27,
    perimeterPadSizeMm: { side: { width: 1.5, height: 0.9 }, bottom: { width: 0.9, height: 1.5 } }
  },
  landPattern: {
    coordinateOrigin: "nominal centre of the terminal field; pin 1 is upper-left in the datasheet top view",
    overallMm: { width: 18, length: 25.5 },
    antennaBoundaryYmm: 9.5,
    sideRow: { xMm: { left: -8.75, right: 8.75 }, pitchMm: 1.27, centreSpanMm: 16.51 },
    bottomRow: { yMm: -9.5, pitchMm: 1.27, centreSpanMm: 13.97 },
    perimeterPads,
    exposedGroundPad: {
      pad: 41,
      net: "APP_GND",
      copperEnvelopeMm: { width: 3.7, length: 3.7 },
      viaCount: thermalVias.length,
      viaPitchMm: 1.4,
      viaCopperSquareMm: 0.9,
      finishedDrillDiameterMm: 0.5,
      vias: thermalVias
    },
    solderMask: {
      sourceLayer: "SOLDERMASKTOP_P",
      perimeterOpening: { widthMm: 1.5, heightMm: 0.9, count: perimeterPads.length },
      exposedGroundPadViaOpening: { widthMm: 0.9, heightMm: 0.9, count: thermalVias.length },
      source: "retained Espressif DXF; no stencil expansion is inferred"
    },
    paste: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-stencil-apertures-from-copper-or-mask"
    },
    courtyard: {
      status: "not-published",
      geometry: null,
      disposition: "do-not-infer-assembly-courtyard-from-body-envelope"
    }
  },
  antenna: {
    areaMm: { width: 18, length: 6 },
    areaPosition: { edge: "terminal-field upper edge", centerYmm: 12.5 },
    preferredPlacement: "antenna area projects past the base-board edge",
    fallbackHostBoardClearanceMm: 15,
    fallbackHostBoardKeepoutMm: { width: 48, length: 36, centerYmm: 12.5 },
    fallbackProhibited: ["copper", "routing", "components"],
    enclosure: "keep metal away and verify finished-product throughput and range",
    source: "Espressif datasheet v1.8 Figure 11-1 and ESP32-S3 hardware design guidelines"
  },
  orientation: {
    pinOne: { pad: 1, xMm: -8.75, yMm: 8.255 },
    nominalBoardRotationDegrees: 0,
    source: "Espressif datasheet v1.8 Figure 10-1 and Figure 11-1"
  },
  projectGeometry: {
    status: "official-cad-overlaid-placement-approved",
    sourceCad: "retained Espressif WROOM-1 DXF and STEP",
    copperAndMask: "measured from the retained official DXF",
    pasteAndCourtyard: "not published by Espressif",
    placementAuthorized: true,
    placementReviewer: "root-final-reviewer",
    fabricationAuthorized: false,
    blocker:
      "Independent PCB-library overlay, stencil decision, courtyard, antenna edge placement, and assembled-board RF evidence remain required before fabrication authority."
  }
} as const)

const footprint = (
  <footprint name="P0_ESP32_S3_WROOM_1_N16R2_OFFICIAL_CAD" originalLayer="top">
    {perimeterPads.map((pad) => (
      <Fragment key={pad.number}>
        <smtpad
          name={String(pad.number)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          solderMaskMargin="0mm"
          solderPasteMargin="-1mm"
          portHints={[String(pad.number), `pin${pad.number}`]}
        />
      </Fragment>
    ))}
    {thermalVias.map(([xMm, yMm], index) => (
      <Fragment key={`thermal-${index + 1}`}>
        <platedhole
          name={`EP_VIA_${index + 1}`}
          pcbX={xMm}
          pcbY={yMm}
          shape="circular_hole_with_rect_pad"
          holeDiameter="0.5mm"
          rectPadWidth="0.9mm"
          rectPadHeight="0.9mm"
          rectBorderRadius="0mm"
          solderMaskMargin="0mm"
          portHints={["41", "GND_EP", "thermal-via"]}
        />
      </Fragment>
    ))}
    <keepout shape="rect" pcbX={0} pcbY={12.5} width="48mm" height="36mm" layers={["top", "bottom"]} />
  </footprint>
)

export type P0Esp32Wroom1FootprintProps = {
  readonly pcbX?: number
  readonly pcbY?: number
}

/** Review-only WROOM-1 renderer with the official land pattern and antenna keepout. */
function P0Esp32Wroom1Footprint({ pcbX, pcbY }: P0Esp32Wroom1FootprintProps): ReactElement {
  return (
    <chip
      name="U_APP"
      manufacturerPartNumber={moduleMpn}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbPositionMode="relative_to_board_anchor"
      pinLabels={{
        pin1: "APP_GND",
        pin2: "APP_3V3",
        pin3: "EN_RESET",
        pin4: "SAR_SCLK",
        pin5: "SAR_DOUT",
        pin6: "SAR_CONVST",
        pin7: "LAMP_RED",
        pin8: "LAMP_GREEN",
        pin9: "HUB75_R2",
        pin10: "LAMP_WHITE_LEFT",
        pin11: "APP_SPI_SCK",
        pin12: "APP_SPI_MOSI",
        pin13: "USB_DN",
        pin14: "USB_DP",
        pin15: "NC_STRAP_QUIET",
        pin16: "HUB75_CLK",
        pin17: "APP_SPI_MISO",
        pin18: "LAMP_WHITE_RIGHT",
        pin19: "BUZZER",
        pin20: "APP_WD_KICK",
        pin21: "HUB75_R1",
        pin22: "HUB75_G1",
        pin23: "HUB75_B1",
        pin24: "SOURCE_LATCH",
        pin25: "HUB75_LAT",
        pin26: "HUB75_D",
        pin27: "BOOT_N",
        pin28: "IR_RX",
        pin29: "SOURCE_OE_N",
        pin30: "P0_SPARE_GPIO37",
        pin31: "HUB75_G2",
        pin32: "HUB75_B2",
        pin33: "HUB75_A",
        pin34: "HUB75_B",
        pin35: "HUB75_C",
        pin36: "UART0_RX",
        pin37: "UART0_TX",
        pin38: "ETH_CS_N",
        pin39: "HUB75_OE_N",
        pin40: "APP_GND",
        pin41: "APP_GND"
      }}
      footprint={footprint}
    />
  )
}

export default P0Esp32Wroom1Footprint
