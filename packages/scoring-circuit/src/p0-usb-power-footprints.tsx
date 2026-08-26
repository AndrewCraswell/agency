import { Fragment, type ReactElement } from "react"
import { findPowerStageFootprint } from "./power-stage-footprints.js"
import { usbPdFootprints, type UsbPdFootprint } from "./usb-pd-footprints.js"

type PlacementProps = {
  readonly name?: string
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

type TwoTerminalProps = {
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
  readonly name: string
  readonly mpn: string
  readonly pinLabels: { readonly pin1: string; readonly pin2: string }
}

type InductorProps = Omit<TwoTerminalProps, "pinLabels">

type RegulatorPad = {
  readonly heightMm?: number
  readonly name: string
  readonly pin: string
  readonly points?: readonly { readonly x: number; readonly y: number }[]
  readonly portHints: readonly string[]
  readonly widthMm?: number
  readonly xMm?: number
  readonly yMm?: number
}

type RegulatorProps = PlacementProps

function selectedUsbPdFootprint(mpn: string): UsbPdFootprint {
  const footprint = usbPdFootprints.find((candidate) => candidate.mpn === mpn)
  if (footprint === undefined) throw new RangeError(`Missing retained USB-PD footprint evidence for ${mpn}`)
  if (footprint.pads.length !== 2 || footprint.thermalPads.length !== 0) {
    throw new RangeError(`P0 two-terminal footprint requires exactly two source-backed pads for ${mpn}`)
  }
  return footprint
}

function usbPdTwoTerminalFootprint(
  footprint: UsbPdFootprint,
  pinLabels: { readonly pin1: string; readonly pin2: string }
): ReactElement {
  const [firstPad, secondPad] = footprint.pads
  if (firstPad === undefined || secondPad === undefined) {
    throw new RangeError(`P0 two-terminal footprint is missing a pad for ${footprint.mpn}`)
  }
  const courtyardWidth = footprint.courtyard.widthMm
  const courtyardHeight = footprint.courtyard.heightMm
  return (
    <footprint name={`P0_${footprint.mpn.replaceAll("-", "_")}_SOURCE_GEOMETRY`} originalLayer="top">
      {[firstPad, secondPad].map((pad, index) => (
        <Fragment key={pad.id}>
          <smtpad
            name={String(index + 1)}
            pcbX={pad.xMm}
            pcbY={pad.yMm}
            shape="rect"
            width={`${pad.widthMm}mm`}
            height={`${pad.heightMm}mm`}
            portHints={[String(index + 1), pad.id, pad.role, index === 0 ? pinLabels.pin1 : pinLabels.pin2]}
          />
        </Fragment>
      ))}
      {courtyardWidth !== undefined && courtyardHeight !== undefined ? (
        <courtyardrect
          pcbX={0}
          pcbY={0}
          width={`${courtyardWidth}mm`}
          height={`${courtyardHeight}mm`}
          strokeWidth="0.05mm"
        />
      ) : null}
    </footprint>
  )
}

function usbPdTwoTerminalComponent(props: TwoTerminalProps, footprint: UsbPdFootprint): ReactElement {
  return (
    <chip
      name={props.name}
      manufacturerPartNumber={props.mpn}
      pinLabels={props.pinLabels}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
      footprint={usbPdTwoTerminalFootprint(footprint, props.pinLabels)}
    />
  )
}

const b340aFootprint = selectedUsbPdFootprint("B340A-13-F")
const t523Footprint = selectedUsbPdFootprint("T523H107M035APE070")
const t55Footprint = selectedUsbPdFootprint("T55A106M010C0200")

export const p0UsbPowerSourceBackedFootprints = {
  b340a: {
    manufacturerPartNumber: b340aFootprint.mpn,
    orientation: b340aFootprint.orientation,
    source: b340aFootprint.drawing
  },
  t523: {
    manufacturerPartNumber: t523Footprint.mpn,
    orientation: t523Footprint.orientation,
    source: t523Footprint.drawing
  },
  t55: {
    manufacturerPartNumber: t55Footprint.mpn,
    orientation: t55Footprint.orientation,
    source: t55Footprint.drawing
  }
} as const

export function P0B340aFootprint(props: PlacementProps = {}): ReactElement {
  return usbPdTwoTerminalComponent(
    {
      ...props,
      name: props.name ?? "D_USB_PD_VBUS_DISCONNECT",
      mpn: b340aFootprint.mpn,
      pinLabels: { pin1: "ANODE_GND", pin2: "CATHODE_VBUS" }
    },
    b340aFootprint
  )
}

export function P0T523H107Footprint(props: PlacementProps = {}): ReactElement {
  return usbPdTwoTerminalComponent(
    {
      ...props,
      name: props.name ?? "C_USB_PD_PPHV",
      mpn: t523Footprint.mpn,
      pinLabels: { pin1: "PD_PPHV_20V", pin2: "GND" }
    },
    t523Footprint
  )
}

export function P0T523H107EfuseOutputFootprint(props: PlacementProps = {}): ReactElement {
  return usbPdTwoTerminalComponent(
    {
      ...props,
      name: props.name ?? "C_EFUSE_OUT",
      mpn: t523Footprint.mpn,
      pinLabels: { pin1: "V20_TO_V5_BUCK", pin2: "GND" }
    },
    t523Footprint
  )
}

export function P0T55A106Footprint(props: PlacementProps = {}): ReactElement {
  return usbPdTwoTerminalComponent(
    {
      ...props,
      name: props.name ?? "C_USB_PD_LDO",
      mpn: t55Footprint.mpn,
      pinLabels: { pin1: "LDO_3V3", pin2: "GND" }
    },
    t55Footprint
  )
}

const tps56a37Pads: readonly RegulatorPad[] = [
  { heightMm: 0.25, name: "1", pin: "1", portHints: ["1", "EN", "pin1"], widthMm: 0.6, xMm: -1.4, yMm: 0.75 },
  { heightMm: 0.25, name: "2", pin: "2", portHints: ["2", "FB", "pin2"], widthMm: 0.6, xMm: -1.4, yMm: 0.25 },
  { heightMm: 0.25, name: "3", pin: "3", portHints: ["3", "AGND", "pin3"], widthMm: 0.6, xMm: -1.4, yMm: -0.25 },
  { heightMm: 0.25, name: "4", pin: "4", portHints: ["4", "PG", "pin4"], widthMm: 0.6, xMm: -1.4, yMm: -0.75 },
  { heightMm: 0.6, name: "10", pin: "10", portHints: ["10", "MODE", "pin10"], widthMm: 0.25, xMm: -0.925, yMm: 1.4 },
  {
    heightMm: 0.6,
    name: "5",
    pin: "5",
    portHints: ["5", "SS", "pin5"],
    widthMm: 0.25,
    xMm: -0.925,
    yMm: -1.4
  },
  {
    heightMm: 0.6,
    name: "7",
    pin: "7",
    portHints: ["7", "BOOT", "pin7"],
    widthMm: 0.25,
    xMm: 0.875,
    yMm: -1.4
  },
  {
    name: "8",
    pin: "8",
    points: [
      { x: 0.75, y: 1.7 },
      { x: 1.15, y: 1.7 },
      { x: 1.15, y: 0.875 },
      { x: 1.7, y: 0.875 },
      { x: 1.7, y: 0.325 },
      { x: 0.75, y: 0.325 }
    ],
    portHints: ["8", "VIN", "pin8"]
  },
  {
    heightMm: 0.95,
    name: "9A",
    pin: "9",
    portHints: ["9", "PGND", "pin9"],
    widthMm: 0.4,
    xMm: -0.2,
    yMm: 1.225
  },
  {
    heightMm: 0.95,
    name: "9B",
    pin: "9",
    portHints: ["9", "PGND", "pin9"],
    widthMm: 0.4,
    xMm: -0.2,
    yMm: 0.075
  },
  {
    heightMm: 0.75,
    name: "6A",
    pin: "6",
    portHints: ["6", "SW", "pin6"],
    widthMm: 0.25,
    xMm: 0.375,
    yMm: -0.375
  },
  {
    heightMm: 0.75,
    name: "6B",
    pin: "6",
    portHints: ["6", "SW", "pin6"],
    widthMm: 0.25,
    xMm: 0.375,
    yMm: -1.3
  }
] as const

const lmr43620Pads: readonly RegulatorPad[] = [
  {
    name: "1",
    pin: "1",
    points: [
      { x: -1.2, y: 0.875 },
      { x: -0.85, y: 0.875 },
      { x: -0.85, y: 1.2 },
      { x: -0.45, y: 1.2 },
      { x: -0.45, y: 0.625 },
      { x: -1.2, y: 0.625 }
    ],
    portHints: ["1", "MODE_SYNC", "pin1"]
  },
  {
    heightMm: 0.25,
    name: "2",
    pin: "2",
    portHints: ["2", "PGOOD", "pin2"],
    widthMm: 0.6,
    xMm: -0.9,
    yMm: 0.25
  },
  {
    heightMm: 0.25,
    name: "3",
    pin: "3",
    portHints: ["3", "EN_UVLO", "pin3"],
    widthMm: 0.6,
    xMm: -0.9,
    yMm: -0.25
  },
  {
    name: "4",
    pin: "4",
    points: [
      { x: -1.2, y: -0.625 },
      { x: -0.45, y: -0.625 },
      { x: -0.45, y: -1.2 },
      { x: -0.85, y: -1.2 },
      { x: -0.85, y: -0.875 },
      { x: -1.2, y: -0.875 }
    ],
    portHints: ["4", "VIN", "pin4"]
  },
  {
    name: "5",
    pin: "5",
    points: [
      { x: 0.45, y: -0.625 },
      { x: 1.2, y: -0.625 },
      { x: 1.2, y: -0.875 },
      { x: 0.85, y: -0.875 },
      { x: 0.85, y: -1.2 },
      { x: 0.45, y: -1.2 }
    ],
    portHints: ["5", "SW", "pin5"]
  },
  {
    heightMm: 0.25,
    name: "6",
    pin: "6",
    portHints: ["6", "BOOT", "pin6"],
    widthMm: 0.6,
    xMm: 0.9,
    yMm: -0.25
  },
  {
    heightMm: 0.25,
    name: "7",
    pin: "7",
    portHints: ["7", "VCC", "pin7"],
    widthMm: 0.6,
    xMm: 0.9,
    yMm: 0.25
  },
  {
    name: "8",
    pin: "8",
    points: [
      { x: 0.45, y: 0.625 },
      { x: 1.2, y: 0.625 },
      { x: 1.2, y: 0.875 },
      { x: 0.85, y: 0.875 },
      { x: 0.85, y: 1.2 },
      { x: 0.45, y: 1.2 }
    ],
    portHints: ["8", "VOUT_FB", "pin8"]
  },
  {
    heightMm: 1.3,
    name: "9",
    pin: "9",
    portHints: ["9", "APP_GND", "pin9"],
    widthMm: 0.35,
    xMm: 0,
    yMm: 0
  }
] as const

const tps56a37PinLabels = {
  pin1: "EN",
  pin2: "FB",
  pin3: "AGND",
  pin4: "PG",
  pin5: "SS",
  pin6: "SW",
  pin7: "BOOT",
  pin8: "VIN",
  pin9: "PGND",
  pin10: "MODE"
} as const

const lmr43620PinLabels = {
  pin1: "MODE_SYNC",
  pin2: "PGOOD",
  pin3: "EN_UVLO",
  pin4: "VIN",
  pin5: "SW",
  pin6: "BOOT",
  pin7: "VCC",
  pin8: "VOUT_FB",
  pin9: "APP_GND"
} as const

function regulatorFootprint(pads: readonly RegulatorPad[], sourcePackage: "RPA0010A" | "RPE0009A"): ReactElement {
  return (
    <footprint name={`P0_${sourcePackage}_SOURCE_GEOMETRY`} originalLayer="top">
      {pads.map((pad) => (
        <Fragment key={pad.name}>
          {pad.points !== undefined ? (
            <smtpad name={pad.name} shape="polygon" points={[...pad.points]} portHints={[...pad.portHints]} />
          ) : (
            <smtpad
              name={pad.name}
              pcbX={pad.xMm}
              pcbY={pad.yMm}
              shape="rect"
              width={`${pad.widthMm}mm`}
              height={`${pad.heightMm}mm`}
              portHints={[...pad.portHints]}
            />
          )}
        </Fragment>
      ))}
    </footprint>
  )
}

export const p0UsbPowerRegulatorSourceBackedFootprints = {
  v5: {
    manufacturerPartNumber: "TPS56A37RPAR",
    package: "RPA0010A",
    orientation: "TI top view; pin 1 is the lower-left datum. Preserve the asymmetric compound lands.",
    source: {
      artifactPath: "docs/evidence/p0-06/ti-tps56a37-datasheet.pdf",
      pages: [3, 26, 27, 28],
      sha256: "3156F7239CBB61F9104B8767BA9D236E8C954D5FE94ACD9382A3314E44B670F1",
      url: "https://www.ti.com/lit/ds/symlink/tps56a37.pdf"
    }
  },
  application: {
    manufacturerPartNumber: "LMR43620MSC3RPERQ1",
    package: "RPE0009A",
    orientation:
      "TI top view; pin 1 is the upper-left datum. Preserve the compound corner lands and central exposed pad.",
    source: {
      artifactPath: "docs/evidence/bp-033/ti-lmr43620-q1-datasheet.pdf",
      pages: [50, 54, 55, 56],
      sha256: "DB767B9234F756C358C8254E682B917F16381EB0DB649A2936833E15EB8037FD",
      url: "https://www.ti.com/lit/ds/symlink/lmr43620-q1.pdf"
    }
  }
} as const

export function P0Tps56a37Footprint(props: RegulatorProps = {}): ReactElement {
  return (
    <chip
      name={props.name ?? "U_V5_BUCK"}
      manufacturerPartNumber="TPS56A37RPAR"
      pinLabels={tps56a37PinLabels}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
      footprint={regulatorFootprint(tps56a37Pads, "RPA0010A")}
    />
  )
}

export function P0Lmr43620Footprint(props: RegulatorProps = {}): ReactElement {
  return (
    <chip
      name={props.name ?? "U_APP_REGULATOR"}
      manufacturerPartNumber="LMR43620MSC3RPERQ1"
      pinLabels={lmr43620PinLabels}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
      footprint={regulatorFootprint(lmr43620Pads, "RPE0009A")}
    />
  )
}

type PowerStageFootprint = ReturnType<typeof findPowerStageFootprint>

function selectedInductorFootprint(mpn: string): NonNullable<PowerStageFootprint> {
  const footprint = findPowerStageFootprint(mpn)
  if (footprint === undefined) throw new RangeError(`Missing retained power-stage footprint evidence for ${mpn}`)
  const geometry = footprint.pads.geometry.find((candidate) => candidate.count === 2)
  if (
    geometry === undefined ||
    geometry.gapMm === undefined ||
    geometry.padLengthMm === undefined ||
    geometry.padWidthMm === undefined
  ) {
    throw new RangeError(`Power-stage footprint lacks complete two-pad coordinates for ${mpn}`)
  }
  return footprint
}

function inductorFootprint(footprint: NonNullable<PowerStageFootprint>): ReactElement {
  const geometry = footprint.pads.geometry.find((candidate) => candidate.count === 2)
  if (
    geometry === undefined ||
    geometry.gapMm === undefined ||
    geometry.padLengthMm === undefined ||
    geometry.padWidthMm === undefined
  ) {
    throw new RangeError(`Power-stage footprint lacks complete two-pad coordinates for ${footprint.mpn}`)
  }
  const padCenterOffset = (geometry.gapMm + geometry.padLengthMm) / 2
  const verticalPadAxis = footprint.mpn === "744325330"
  return (
    <footprint name={`P0_${footprint.mpn.replaceAll("-", "_")}_SOURCE_GEOMETRY`} originalLayer="top">
      <smtpad
        name="1"
        pcbX={verticalPadAxis ? 0 : -padCenterOffset}
        pcbY={verticalPadAxis ? -padCenterOffset : 0}
        shape="rect"
        width={`${geometry.padWidthMm}mm`}
        height={`${geometry.padLengthMm}mm`}
        portHints={["1", "terminal A", "SW", "pin1"]}
      />
      <smtpad
        name="2"
        pcbX={verticalPadAxis ? 0 : padCenterOffset}
        pcbY={verticalPadAxis ? padCenterOffset : 0}
        shape="rect"
        width={`${geometry.padWidthMm}mm`}
        height={`${geometry.padLengthMm}mm`}
        portHints={["2", "terminal B", "V5", "pin2"]}
      />
    </footprint>
  )
}

function inductorComponent(props: InductorProps, footprint: NonNullable<PowerStageFootprint>): ReactElement {
  return (
    <chip
      name={props.name}
      manufacturerPartNumber={props.mpn}
      pinLabels={{ pin1: "SW", pin2: props.name === "L_V5_BUCK" ? "V5" : "APP_3V3" }}
      pcbRotation={props.pcbRotation}
      pcbX={props.pcbX}
      pcbY={props.pcbY}
      footprint={inductorFootprint(footprint)}
    />
  )
}

const v5InductorFootprint = selectedInductorFootprint("744325330")
const appInductorFootprint = selectedInductorFootprint("XGL4030-222MEC")

export const p0UsbPowerInductorSourceBackedFootprints = {
  v5: {
    manufacturerPartNumber: v5InductorFootprint.mpn,
    orientation: v5InductorFootprint.orientation,
    source: v5InductorFootprint.drawing
  },
  application: {
    manufacturerPartNumber: appInductorFootprint.mpn,
    orientation: appInductorFootprint.orientation,
    source: appInductorFootprint.drawing
  }
} as const

export function P0V5InductorFootprint(props: PlacementProps = {}): ReactElement {
  return inductorComponent(
    { ...props, name: props.name ?? "L_V5_BUCK", mpn: v5InductorFootprint.mpn },
    v5InductorFootprint
  )
}

export function P0ApplicationInductorFootprint(props: PlacementProps = {}): ReactElement {
  return inductorComponent(
    { ...props, name: props.name ?? "L_APP_REGULATOR", mpn: appInductorFootprint.mpn },
    appInductorFootprint
  )
}
