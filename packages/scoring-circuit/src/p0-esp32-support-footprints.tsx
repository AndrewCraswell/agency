import { cloneElement, isValidElement, type ReactElement } from "react"
import {
  benchPrototypeBp032TiResetWatchdogFootprintGeometry,
  BenchPrototypeBp032TiTps3431sdrbrFootprint,
  BenchPrototypeBp032TiTps389033dserFootprint
} from "./bench-prototype-bp032-ti-reset-watchdog-footprints.js"

/**
 * P0-06 uses the exact TI package candidates already reconciled for the
 * reset/watchdog contract. The candidate renderers contain the published
 * DRB0008A/DSE0006A land patterns and pin-one orientation; these wrappers only
 * give the parts their P0 reference names and electrical labels.
 */
export const p0Esp32SupportFootprintGeometry = benchPrototypeBp032TiResetWatchdogFootprintGeometry

export const p0Esp32SupportFootprintMetadata = Object.freeze({
  artifactKind: "p0-06-esp32-support-footprints",
  workUnit: "P0-06",
  placementAuthority: "approved",
  placementReviewer: "root-final-reviewer",
  components: {
    supervisor: {
      reference: "U_APP_SUPERVISOR",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPS389033DSER",
      package: "WSON-6 / DSE0006A",
      pinOne: "upper-left in TI top view",
      fabricationAuthority: "deny"
    },
    watchdog: {
      reference: "U_APP_WATCHDOG",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPS3431SDRBR",
      package: "VSON-8 / DRB0008A",
      pinOne: "upper-left in TI top view",
      fabricationAuthority: "deny"
    }
  },
  recoveryTestPoints: {
    classification: "non-BOM board feature",
    footprint: "1 mm circular surface pad",
    references: ["TP_UART0_RX", "TP_UART0_TX", "TP_BOOT_N", "TP_EN_RESET", "TP_RECOVERY_APP_3V3", "TP_APP_GND"],
    placement: "placeable exposed copper test pads; no purchased component or DNP placeholder"
  }
} as const)

const supervisorPinLabels = {
  pin1: "SENSE",
  pin2: "APP_GND",
  pin3: "MANUAL_RESET_N",
  pin4: "APP_3V3",
  pin5: "CT",
  pin6: "APP_RESET_N"
} as const

const watchdogPinLabels = {
  pin1: "APP_3V3",
  pin2: "CWD",
  pin3: "APP_3V3",
  pin4: "APP_GND",
  pin5: "APP_3V3",
  pin6: "APP_WD_KICK",
  pin7: "APP_RESET_N",
  pin8: "APP_RESET_N"
} as const

export type P0Esp32SupportFootprintProps = {
  readonly pcbX?: number
  readonly pcbY?: number
}

function withP0Identity(element: ReactElement, props: Readonly<Record<string, unknown>>): ReactElement {
  if (!isValidElement<Record<string, unknown>>(element)) {
    throw new RangeError("P0 ESP32 support footprint renderer returned an invalid element")
  }
  return cloneElement(element, props)
}

export function P0Esp32SupervisorFootprint({ pcbX, pcbY }: P0Esp32SupportFootprintProps = {}): ReactElement {
  return withP0Identity(BenchPrototypeBp032TiTps389033dserFootprint({ pcbX, pcbY }), {
    name: "U_APP_SUPERVISOR",
    pinLabels: supervisorPinLabels
  })
}

export function P0Esp32WatchdogFootprint({ pcbX, pcbY }: P0Esp32SupportFootprintProps = {}): ReactElement {
  return withP0Identity(BenchPrototypeBp032TiTps3431sdrbrFootprint({ pcbX, pcbY }), {
    name: "U_APP_WATCHDOG",
    pinLabels: watchdogPinLabels
  })
}
