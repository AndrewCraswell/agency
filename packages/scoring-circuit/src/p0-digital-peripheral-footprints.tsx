import { Fragment, type ReactElement } from "react"
import { findCommunicationsFootprintEvidence } from "./communications-footprint-evidence.js"

/**
 * Placeable P0 digital footprints.
 *
 * These are project-controlled review geometries, not fabrication authority.
 * The retained sources provide exact identities and, for the MagJack, the
 * complete hole pattern.  The W5500, crystal, AHCT245, BSS138, and TST header
 * still require the normal independent overlay and fabrication checks before
 * a board can be released.
 */

const magJackEvidence = findCommunicationsFootprintEvidence("7499011121A")
if (magJackEvidence === undefined || magJackEvidence.exactPads.length !== 16) {
  throw new RangeError("P0 digital footprint set requires the retained 7499011121A hole pattern")
}

const magJackPadMap = Object.freeze(
  magJackEvidence.exactPads.map((pad) =>
    Object.freeze({
      drillMm: pad.drillMm,
      heightMm: pad.heightMm,
      id: pad.id,
      kind: pad.kind,
      shape: pad.shape,
      widthMm: pad.widthMm,
      xMm: pad.xMm,
      yMm: pad.yMm
    })
  )
)

const magJackPinLabels = {
  pin1: "TD_P",
  pin2: "CTD",
  pin3: "TD_N",
  pin4: "RD_P",
  pin5: "CRD",
  pin6: "RD_N",
  pin8: "CHASSIS_TERMINATION",
  pin9: "YELLOW_A",
  pin10: "YELLOW_K",
  pin11: "GREEN_A",
  pin12: "GREEN_K",
  pin13: "SHIELD_A",
  pin14: "SHIELD_B"
} as const

const magJackPortHints: Record<string, readonly string[]> = {
  "1": ["1", "pin1", "TD_P"],
  "2": ["2", "pin2", "CTD"],
  "3": ["3", "pin3", "TD_N"],
  "4": ["4", "pin4", "RD_P"],
  "5": ["5", "pin5", "CRD"],
  "6": ["6", "pin6", "RD_N"],
  "7": ["7"],
  "8": ["8", "pin8", "CHASSIS_TERMINATION"],
  "9": ["9", "pin9", "YELLOW_A"],
  "10": ["10", "pin10", "YELLOW_K"],
  "11": ["11", "pin11", "GREEN_A"],
  "12": ["12", "pin12", "GREEN_K"],
  S1: ["S1", "pin13", "SHIELD_A"],
  S2: ["S2", "pin14", "SHIELD_B"]
}

const magJackFootprint = (
  <footprint name="P0_WUERTH_7499011121A_REVIEW_FOOTPRINT" originalLayer="top">
    {magJackPadMap.map((pad) => (
      <Fragment key={pad.id}>
        {pad.kind === "plated-hole" ? (
          <platedhole
            name={pad.id}
            shape="circular_hole_with_rect_pad"
            pcbX={pad.xMm}
            pcbY={pad.yMm}
            holeDiameter={`${pad.drillMm}mm`}
            rectPadWidth={`${pad.widthMm}mm`}
            rectPadHeight={`${pad.heightMm}mm`}
            rectBorderRadius={pad.shape === "circle" ? `${pad.widthMm / 2}mm` : "0mm"}
            portHints={Array.from(magJackPortHints[pad.id] ?? [pad.id])}
          />
        ) : (
          <hole name={pad.id} diameter={`${pad.drillMm}mm`} pcbX={pad.xMm} pcbY={pad.yMm} />
        )}
      </Fragment>
    ))}
  </footprint>
)

export const p0EthernetMagJackFootprintEvidence = {
  artifactKind: "p0-ethernet-magjack-placeable-footprint",
  reference: "J_ETH",
  manufacturer: "Würth Elektronik",
  manufacturerPartNumber: "7499011121A",
  source: {
    artifactPath: "docs/evidence/p0-06/wurth-7499011121a-datasheet.pdf",
    sourceUrl: "https://www.we-online.com/components/products/datasheet/7499011121A.pdf",
    sourceSha256: "05B718A55907F45D2388BEA0EBEAADB60C7C93CE2C4C5CA582637936E890E350",
    reviewedPages: [1, 2, 3, 4, 5, 6],
    package: "WE-RJ45LAN 1x1 THT, 16 mm x 21.25 mm x 13.5 mm",
    geometry: "retained exact 14 plated-hole plus 2 non-plated-hole pattern",
    geometryAuthority: "manufacturer-hole-pattern",
    orientationDatum: "rectangular pin 1 at x=0, y=0; S1/S2 are shield returns; NPTH1/NPTH2 are shell tabs"
  },
  padMap: magJackPadMap,
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    pinOne: "rectangular plated pad 1",
    rotationDegrees: 0,
    courtyard: "not emitted because the retained source does not publish a locked courtyard"
  },
  release: {
    manufacturerCad: "not-imported",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export const p0W5500FootprintEvidence = {
  artifactKind: "p0-w5500-placeable-footprint",
  reference: "U_W5500",
  manufacturer: "WIZnet",
  manufacturerPartNumber: "W5500",
  source: {
    artifactPath: "docs/evidence/p0-06/wiznet-w5500-datasheet-v110.pdf",
    sourceUrl: "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf",
    sourceSha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D",
    reviewedPages: [2, 7, 64, 65],
    package: "48-pin LQFP, JEDEC MS-026 BBC, 7 mm body, 0.5 mm pitch",
    packageDrawing: "WIZnet Figures 26 and 27"
  },
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    rotationDegrees: 0,
    pinOne: "top-view upper-left corner at x=-4.35 mm, y=2.75 mm",
    padCount: 48,
    projectGeometry: "BP-033 project land pattern remains separate from manufacturer package evidence"
  },
  release: {
    manufacturerCad: "not-published-in-retained-datasheet",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export interface P0EthernetMagJackFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
  readonly pcbPositionMode?: "relative_to_board_anchor"
}

export function P0EthernetMagJackFootprint({
  pcbX,
  pcbY,
  pcbRotation,
  pcbPositionMode
}: P0EthernetMagJackFootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_ETH"
      manufacturerPartNumber="7499011121A"
      pinLabels={magJackPinLabels}
      footprint={magJackFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
      pcbPositionMode={pcbPositionMode}
    />
  )
}

const crystalPads = [
  { name: "1", pcbX: -1.15, pcbY: 0.95, signal: "XI" },
  { name: "2", pcbX: 1.15, pcbY: 0.95, signal: "GND_2" },
  { name: "3", pcbX: 1.15, pcbY: -0.95, signal: "XO" },
  { name: "4", pcbX: -1.15, pcbY: -0.95, signal: "GND_4" }
] as const

const crystalFootprint = (
  <footprint name="P0_ECS_33B_REVIEW_FOOTPRINT" originalLayer="top">
    <silkscreenrect pcbX={0} pcbY={0} width="3.2mm" height="2.5mm" strokeWidth="0.1mm" filled={false} />
    <silkscreencircle pcbX={-1.3} pcbY={1.1} radius="0.2mm" strokeWidth="0.1mm" />
    {crystalPads.map((pad) => (
      <Fragment key={pad.name}>
        <smtpad
          name={pad.name}
          shape="rect"
          pcbX={pad.pcbX}
          pcbY={pad.pcbY}
          width="1.3mm"
          height="1.1mm"
          portHints={[pad.name, `pin${pad.name}`, pad.signal]}
        />
      </Fragment>
    ))}
    <courtyardrect pcbX={0} pcbY={0} width="4mm" height="3.3mm" strokeWidth="0.05mm" />
  </footprint>
)

export const p0W5500CrystalFootprintEvidence = {
  artifactKind: "p0-w5500-crystal-placeable-footprint",
  reference: "Y_W5500",
  manufacturer: "ECS Inc.",
  manufacturerPartNumber: "ECS-250-18-33B-JGN-TR",
  source: {
    artifactPath: "docs/evidence/p0-06/ecs-33b-datasheet.pdf",
    sourceUrl: "https://ecsxtal.com/store/pdf/ECS-33B.pdf",
    sourceSha256: "CD8DE6F9688A36A2C6F13EE55518C1FAE6399E1B7D741553DDD3B72909C7C3A0",
    reviewedPages: [1],
    package: "ECS-33B, 3.20 mm x 2.50 mm x 0.80 mm, 4-pad SMD",
    landPattern: "ECS-33B datasheet Figure 2: 1.3 mm x 1.1 mm pads, 2.3 mm horizontal and 1.9 mm vertical spans",
    geometryAuthority: "manufacturer-suggested-land-pattern"
  },
  padMap: crystalPads,
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    orientationDatum: "pad 1 XI is upper-left; pad 3 XO is lower-right at rotation 0 degrees",
    rotationDegrees: 0
  },
  release: {
    manufacturerCad: "not-acquired",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export interface P0W5500CrystalFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

export function P0W5500CrystalFootprint({ pcbX, pcbY, pcbRotation }: P0W5500CrystalFootprintProps = {}): ReactElement {
  return (
    <chip
      name="Y_W5500"
      manufacturerPartNumber="ECS-250-18-33B-JGN-TR"
      pinLabels={{ pin1: "XI", pin2: "GND_2", pin3: "XO", pin4: "GND_4" }}
      footprint={crystalFootprint}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

const ahctPinSignals = [
  "DIR",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "APP_GND",
  "B8",
  "B7",
  "B6",
  "B5",
  "B4",
  "B3",
  "B2",
  "B1",
  "OE_N",
  "V5_DISPLAY_LIMITED"
] as const

const ahctPadMap = Object.freeze(
  Array.from({ length: 20 }, (_, index) => {
    const pin = index + 1
    const leftSide = pin <= 10
    const row = leftSide ? pin - 1 : 20 - pin
    return Object.freeze({
      pin,
      pcbX: leftSide ? -3 : 3,
      pcbY: 2.925 - row * 0.65,
      widthMm: 1.5,
      heightMm: 0.45
    })
  })
)

function tssop20Pad(
  pin: number,
  signal: (typeof ahctPinSignals)[number],
  aliases: readonly string[] = []
): ReactElement {
  const pad = ahctPadMap[pin - 1]
  if (pad === undefined) throw new RangeError(`missing SN74AHCT245PWR pad ${pin}`)
  return (
    <smtpad
      name={String(pin)}
      shape="rect"
      pcbX={pad.pcbX}
      pcbY={pad.pcbY}
      width="1.5mm"
      height="0.45mm"
      portHints={[String(pin), `pin${pin}`, signal, ...aliases]}
    />
  )
}

function createAhctFootprint(reference: string): ReactElement {
  const aliases =
    reference === "U_DISPLAY_BUFFER_B" ? ["A6_UNUSED", "A7_UNUSED", "A8_UNUSED", "B8_NC", "B7_NC", "B6_NC"] : []
  return (
    <footprint name={`${reference}_P0_TSSOP20_REVIEW_FOOTPRINT`} originalLayer="top">
      <silkscreenrect pcbX={0} pcbY={0} width="4.4mm" height="6.5mm" strokeWidth="0.1mm" filled={false} />
      <silkscreencircle pcbX={-2.2} pcbY={2.55} radius="0.2mm" strokeWidth="0.1mm" />
      {ahctPinSignals.map((signal, index) => {
        const alias = aliases.find((candidate) => candidate.startsWith(signal))
        return <Fragment key={index + 1}>{tssop20Pad(index + 1, signal, alias === undefined ? [] : [alias])}</Fragment>
      })}
      <courtyardrect pcbX={0} pcbY={0} width="7.2mm" height="9.3mm" strokeWidth="0.05mm" />
    </footprint>
  )
}

export const p0Hub75Ahct245FootprintEvidence = {
  artifactKind: "p0-hub75-ahct245-placeable-footprint",
  references: ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"],
  manufacturer: "Texas Instruments",
  manufacturerPartNumber: "SN74AHCT245PWR",
  package: "PW TSSOP-20",
  source: {
    artifactPath: "docs/evidence/p0-06/ti-sn74ahct245-datasheet.pdf",
    sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf",
    sourceSha256: "9E7C1B200CDEFD3DC72CD0E8B9019059FED2833B1B15AC80E97E099DFCAC93D7",
    reviewedPages: [1, 3, 21, 22],
    packageDrawing: "TI PW0020A package outline",
    orientationDatum: "TI top view pin 1 upper-left and pin 20 upper-right",
    landPattern: "TI PW0020A example board layout: 1.5 mm x 0.45 mm pads, 0.65 mm pitch, 5.8 mm row span",
    geometryAuthority: "manufacturer-example-board-layout"
  },
  padMap: ahctPadMap,
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    rotationDegrees: 0,
    pinOne: "upper-left"
  },
  release: {
    manufacturerCad: "not-acquired",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export interface P0Hub75Ahct245FootprintProps {
  readonly reference: "U_DISPLAY_BUFFER_A" | "U_DISPLAY_BUFFER_B"
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

export function P0Hub75Ahct245Footprint({
  reference,
  pcbX,
  pcbY,
  pcbRotation
}: P0Hub75Ahct245FootprintProps): ReactElement {
  const pinLabels = Object.fromEntries(
    ahctPinSignals.map((signal, index) => {
      const aliases =
        reference === "U_DISPLAY_BUFFER_B" ? ["A6_UNUSED", "A7_UNUSED", "A8_UNUSED", "B8_NC", "B7_NC", "B6_NC"] : []
      const alias = aliases.find((candidate) => candidate.startsWith(signal))
      return [`pin${index + 1}`, alias ?? signal]
    })
  )
  return (
    <chip
      name={reference}
      manufacturerPartNumber="SN74AHCT245PWR"
      pinLabels={pinLabels}
      footprint={createAhctFootprint(reference)}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

const bssPads = [
  { pin: 1, pcbX: -0.95, pcbY: -0.7, signal: "GATE" },
  { pin: 2, pcbX: 0.95, pcbY: -0.7, signal: "SOURCE" },
  { pin: 3, pcbX: 0, pcbY: 0.7, signal: "DRAIN" }
] as const

function createBssFootprint(): ReactElement {
  return (
    <footprint name="Q_DISPLAY_ENABLE_P0_SOT23_REVIEW_FOOTPRINT" originalLayer="top">
      <silkscreenrect pcbX={0} pcbY={0} width="2.9mm" height="2.6mm" strokeWidth="0.1mm" filled={false} />
      <silkscreencircle pcbX={-1.25} pcbY={-1.05} radius="0.18mm" strokeWidth="0.1mm" />
      {bssPads.map((pad) => (
        <Fragment key={pad.pin}>
          <smtpad
            name={String(pad.pin)}
            shape="rect"
            pcbX={pad.pcbX}
            pcbY={pad.pcbY}
            width="0.6mm"
            height="0.7mm"
            portHints={[String(pad.pin), `pin${pad.pin}`, pad.signal]}
          />
        </Fragment>
      ))}
      <courtyardrect pcbX={0} pcbY={0} width="3.8mm" height="3.2mm" strokeWidth="0.05mm" />
    </footprint>
  )
}

export const p0Hub75EnableFetFootprintEvidence = {
  artifactKind: "p0-hub75-enable-fet-placeable-footprint",
  reference: "Q_DISPLAY_ENABLE",
  manufacturer: "Nexperia",
  manufacturerPartNumber: "BSS138AKA",
  package: "SOT23",
  source: {
    artifactPath: "docs/evidence/p0-06/nexperia-bss138aka-datasheet.pdf",
    sourceUrl: "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf",
    sourceSha256: "39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9",
    reviewedPages: [2, 12],
    packageDrawing: "Nexperia BSS138AKA Figure 1 package outline",
    pinOneDatum: "pin 1 gate lower-left, pin 2 source lower-right, pin 3 drain upper-center",
    landPattern: "Nexperia Figure 19 recommended SOT23 land pattern: 0.6 mm x 0.7 mm solder lands"
  },
  padMap: bssPads,
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    rotationDegrees: 0,
    pinOne: "lower-left"
  },
  release: {
    manufacturerCad: "not-acquired",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export interface P0Hub75EnableFetFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
}

export function P0Hub75EnableFetFootprint({
  pcbX,
  pcbY,
  pcbRotation
}: P0Hub75EnableFetFootprintProps = {}): ReactElement {
  return (
    <chip
      name="Q_DISPLAY_ENABLE"
      manufacturerPartNumber="BSS138AKA"
      pinLabels={{ pin1: "GATE", pin2: "SOURCE", pin3: "DRAIN" }}
      footprint={createBssFootprint()}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
    />
  )
}

const hub75PanelPinLabels = [
  "R1",
  "G1",
  "B1",
  "GND1",
  "R2",
  "G2",
  "B2",
  "GND2",
  "A",
  "B",
  "C",
  "D",
  "CLK",
  "LAT",
  "OE",
  "GND3"
] as const

const hub75PadMap = Object.freeze(
  hub75PanelPinLabels.map((signal, index) => {
    const row = Math.floor(index / 2)
    const column = index % 2
    return Object.freeze({
      pin: index + 1,
      signal,
      pcbX: column * 2.54,
      pcbY: row * 2.54,
      holeDiameterMm: 1,
      padWidthMm: 1.4,
      padHeightMm: 1.4
    })
  })
)

function createHub75ConnectorFootprint(): ReactElement {
  return (
    <footprint name="J_HUB75_P0_TST108_REVIEW_FOOTPRINT" originalLayer="top">
      <silkscreenrect pcbX={1.27} pcbY={8.89} width="5.08mm" height="20.32mm" strokeWidth="0.1mm" filled={false} />
      {hub75PadMap.map((pad) => {
        return (
          <Fragment key={pad.signal}>
            <platedhole
              name={String(pad.pin)}
              shape="circular_hole_with_rect_pad"
              pcbX={pad.pcbX}
              pcbY={pad.pcbY}
              holeDiameter={`${pad.holeDiameterMm}mm`}
              rectPadWidth={`${pad.padWidthMm}mm`}
              rectPadHeight={`${pad.padHeightMm}mm`}
              rectBorderRadius={pad.pin === 1 ? "0mm" : "0.7mm"}
              portHints={[String(pad.pin), `pin${pad.pin}`, pad.signal]}
            />
          </Fragment>
        )
      })}
      <courtyardrect pcbX={1.27} pcbY={8.89} width="7.08mm" height="22.32mm" strokeWidth="0.05mm" />
    </footprint>
  )
}

export const p0Hub75ConnectorFootprintEvidence = {
  artifactKind: "p0-hub75-connector-placeable-footprint",
  reference: "J_HUB75",
  manufacturer: "Samtec",
  manufacturerPartNumber: "TST-108-04-G-D-RA",
  package: "2x8, 2.54 mm pitch, right-angle shrouded header",
  source: {
    seriesPrintArtifactPath: "docs/evidence/p0-06/samtec-tst-series-print.pdf",
    seriesPrintSha256: "56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059",
    productPageArtifactPath: "docs/evidence/bp-143/samtec-tst-108-04-g-d-ra.html",
    productPageSha256: "6B3FAD6D5B2E2649DEDFD00EE87C68D692C0CFF9ACFBB81A5D584D5F85A85464",
    footprintPrintArtifactPath: "docs/evidence/bp-143/samtec-tst-footprint.pdf",
    footprintPrintSha256: "ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC",
    orientationOverlayArtifactPath: "docs/evidence/bp-033/samtec-tst-108-04-g-d-ra-pin-map-orientation-overlay.svg",
    orientationOverlaySha256: "08FD50CDF71A209D936B6B74FD7DBBDAEDEF0404EA105A168623707FFA9D02F7",
    sourceUrl: "https://www.samtec.com/products/tst-108-04-g-d-ra",
    reviewedPages: [1, 2, 3],
    orientationDatum: "pin 1 is left column at the keyed end; rows advance at 2.54 mm",
    landPattern:
      "Samtec TST series print establishes 2.54 mm double-row pitch; project prototype uses 1.0 mm finished holes and 1.4 mm copper lands pending exact CAD overlay"
  },
  padMap: hub75PadMap,
  placement: {
    state: "approved",
    reviewer: "root-final-reviewer",
    rotationDegrees: 0,
    pinOne: "rectangular pad at left column, keyed end"
  },
  release: {
    manufacturerCad: "not-acquired",
    boardOverlay: "root-reviewed-for-placement",
    fabrication: "deny",
    accepted: true
  }
} as const

export interface P0Hub75ConnectorFootprintProps {
  readonly pcbX?: number
  readonly pcbY?: number
  readonly pcbRotation?: number
  readonly pcbPositionMode?: "relative_to_board_anchor"
}

export function P0Hub75ConnectorFootprint({
  pcbX,
  pcbY,
  pcbRotation,
  pcbPositionMode
}: P0Hub75ConnectorFootprintProps = {}): ReactElement {
  return (
    <chip
      name="J_HUB75"
      manufacturerPartNumber="TST-108-04-G-D-RA"
      pinLabels={Object.fromEntries(hub75PanelPinLabels.map((signal, index) => [`pin${index + 1}`, signal]))}
      footprint={createHub75ConnectorFootprint()}
      pcbX={pcbX}
      pcbY={pcbY}
      pcbRotation={pcbRotation}
      pcbPositionMode={pcbPositionMode}
    />
  )
}

export const p0DigitalPeripheralFootprintEvidence = {
  artifactKind: "p0-digital-peripheral-placeable-footprint-set",
  workUnit: "P0-06",
  references: [
    "U_W5500",
    "J_ETH",
    "Y_W5500",
    "U_DISPLAY_BUFFER_A",
    "U_DISPLAY_BUFFER_B",
    "Q_DISPLAY_ENABLE",
    "J_HUB75"
  ],
  placeable: ["U_W5500", "J_ETH", "Y_W5500", "U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B", "Q_DISPLAY_ENABLE", "J_HUB75"],
  records: {
    w5500: p0W5500FootprintEvidence,
    magJack: p0EthernetMagJackFootprintEvidence,
    crystal: p0W5500CrystalFootprintEvidence,
    ahct245: p0Hub75Ahct245FootprintEvidence,
    enableFet: p0Hub75EnableFetFootprintEvidence,
    hub75Connector: p0Hub75ConnectorFootprintEvidence
  },
  placementState: "approved",
  placementReviewer: "root-final-reviewer",
  fabricationAuthority: "deny",
  genuineEvidenceGaps: [
    "W5500 official source binds the exact LQFP package drawing, but no locked manufacturer PCB land pattern is retained; BP-033 project copper remains review input until package CAD and the received lot are overlaid.",
    "Würth 7499011121A exact drawing and hole map are retained; manufacturer CAD/body/panel overlay, annular-ring, and chassis-mechanical checks remain before fabrication.",
    "Samtec TST official product, series print, footprint print, and orientation overlay are retained; exact configured CAD/sample, key, right-angle body clearance, and drill/land acceptance remain open."
  ]
} as const

function sameExactGraph(
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
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !Object.hasOwn(actualDescriptor, "value") ||
      !Object.hasOwn(expectedDescriptor, "value")
    ) {
      return false
    }
    return sameExactGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
  })
}

export function validateP0DigitalPeripheralFootprintEvidence(
  value: unknown = p0DigitalPeripheralFootprintEvidence
): true {
  if (!sameExactGraph(value, p0DigitalPeripheralFootprintEvidence)) {
    throw new RangeError("P0 digital footprint evidence drifted: source, package, pad map, or orientation mismatch")
  }
  return true
}

validateP0DigitalPeripheralFootprintEvidence()
