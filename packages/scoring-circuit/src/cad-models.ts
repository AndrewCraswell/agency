import { readFileSync } from "node:fs"

function checkedInStepUrl(fileName: string): string {
  return `data:model/step;base64,${readFileSync(new URL(`../assets/cad/${fileName}`, import.meta.url)).toString("base64")}`
}

export const cadModels = {
  capacitor0603: {
    stepUrl: checkedInStepUrl("capacitor-0603.step")
  },
  capacitor0805: {
    stepUrl: checkedInStepUrl("capacitor-0805.step")
  },
  controllerDevKit: {
    stepUrl: checkedInStepUrl("esp32-s3-devkitc-1-n8r2.step"),
    modelBoardNormalDirection: "y+",
    // Seat the DevKitC PCB on top of the 7 mm female socket bodies. The model's
    // male pins then enter the sockets without the carrier PCB intersecting them.
    zOffsetFromSurface: "7mm"
  },
  ethernetModule: {
    stepUrl: checkedInStepUrl("wiz850io.step"),
    modelBoardNormalDirection: "y+",
    // The WIZ850io STEP uses the first pin pair as its longitudinal origin.
    // Its two six-pin rows run 12.7 mm, so their carrier center is 6.35 mm.
    modelOriginPosition: { x: 0, y: 0, z: 6.35 }
  },
  hub75DataHeader: {
    stepUrl: checkedInStepUrl("idc-header-2x08-p2.54mm-vertical.step"),
    // The KiCad STEP is authored from pin 1. Anchor the midpoint of its 2x8
    // pin grid to the centered footprint datum.
    modelOriginPosition: { x: 1.27, y: -8.89, z: 0 }
  },
  hub75PowerHeader: {
    stepUrl: checkedInStepUrl("wurth-645004114822.step")
  },
  dip6: {
    stepUrl: checkedInStepUrl("dip-6-w7.62mm.step"),
    // Pin 1 is the STEP origin; this is the midpoint of the six-pin grid.
    modelOriginPosition: { x: 3.81, y: -2.54, z: 0 }
  },
  diodeDo41: {
    stepUrl: checkedInStepUrl("do-41-p10.16mm.step"),
    // The axial model begins at pad 1 and spans 10.16 mm to pad 2.
    modelOriginPosition: { x: 5.08, y: 0, z: 0 }
  },
  irReceiver: {
    stepUrl: checkedInStepUrl("tsop384xx.step"),
    modelBoardNormalDirection: "y+",
    // With the model's Y axis normal to the board, its three lead centers lie
    // at model Z=-1.45 mm. Anchor that lead row to the footprint holes.
    modelOriginPosition: { x: 0, y: 0, z: -1.45 }
  },
  pinHeader1x01: {
    stepUrl: checkedInStepUrl("pin-header-1x01-2.54mm.step"),
    pcbRotationOffset: -90
  },
  pinHeader1x02: {
    stepUrl: checkedInStepUrl("pin-header-1x02-2.54mm.step"),
    pcbRotationOffset: -90,
    modelOriginPosition: { x: 0, y: -1.27, z: 0 }
  },
  pinHeader1x03: {
    stepUrl: checkedInStepUrl("pin-header-1x03-2.54mm.step"),
    pcbRotationOffset: -90,
    modelOriginPosition: { x: 0, y: -2.54, z: 0 }
  },
  pinSocket1x22: {
    stepUrl: checkedInStepUrl("pin-socket-1x22-2.54mm.step"),
    pcbRotationOffset: -90,
    // The KiCad socket model runs from Y=1.27 to Y=-54.61. Its pin-grid
    // midpoint is -26.67 mm and must coincide with the centered 22-hole row.
    modelOriginPosition: { x: 0, y: -26.67, z: 0 }
  },
  resistor0603: {
    stepUrl: checkedInStepUrl("resistor-0603.step")
  },
  resistor0805: {
    stepUrl: checkedInStepUrl("resistor-0805.step")
  },
  repeaterConnectorRj14: {
    stepUrl: checkedInStepUrl("te-5520250-2-rj14.step"),
    modelBoardNormalDirection: "y+",
    pcbRotationOffset: 180,
    // The asymmetric footprint bounds are centered 3.955 mm behind its
    // authored origin. Return the manufacturer model to the actual hole datum.
    positionOffset: { x: 0, y: 3.955, z: 0 },
    // TE drawing 5520250 D3: the housing top is 16.13 mm above the PCB seating plane.
    zOffsetFromSurface: "8.637mm"
  },
  scoringSounder: {
    stepUrl: checkedInStepUrl("tdk-ps1240p02bt.step"),
    // The two pins are 5 mm apart and the STEP origin is at pin 1. Do not
    // change the board-normal orientation: the viewer already converts STEP.
    modelOriginPosition: { x: 2.5, y: 0, z: 0 }
  },
  sot23: {
    stepUrl: checkedInStepUrl("sot-23.step")
  },
  usbCPdModule: {
    stepUrl: checkedInStepUrl("adafruit-5807-husb238.step"),
    // The retained STEP places VOUT/GND at (7.62, 2.54) and (12.7, 2.54)
    // and the two mounting holes at (2.413, 20.955) and (17.653, 20.955).
    // Their shared board center is therefore the exact carrier datum below.
    modelOriginPosition: { x: 10.16, y: 11.7475, z: 0 },
    // tscircuit reports this asymmetric footprint's bounds center 0.127 mm
    // left and 0.175 mm above its authored anchor. Cancel only that recentering.
    positionOffset: { x: 0.127, y: -0.175, z: 0 }
  },
  v5RegulatorModule: {
    stepUrl: checkedInStepUrl("pololu-d36v50f5.step"),
    // The retained STEP's pin grid runs along model X at Y=1.27/3.81.
    // Rotate that grid onto the carrier's vertical two-column footprint and
    // anchor the selected eight pins at their exact plated-hole coordinates.
    pcbRotationOffset: -90,
    modelOriginPosition: { x: 12.7, y: 11.43, z: 0 },
    // Cancel the 0.05 mm bounds-center shift so the model uses the authored
    // module anchor rather than the derived footprint-bounds center.
    positionOffset: { x: -0.05, y: -0.05, z: 0 },
    zOffsetFromSurface: "6mm"
  }
} as const
