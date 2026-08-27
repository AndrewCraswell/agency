import { readFileSync } from "node:fs"

const kicadModelRevision = "b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a"
const kicadModelRoot = `https://github.com/KiCad/kicad-packages3D/raw/${kicadModelRevision}`

function checkedInStepUrl(fileName: string): string {
  return `data:model/step;base64,${readFileSync(new URL(`../assets/cad/${fileName}`, import.meta.url)).toString("base64")}`
}

export const cadModels = {
  capacitor0603: {
    stepUrl: `${kicadModelRoot}/Capacitor_SMD.3dshapes/C_0603_1608Metric.step`
  },
  capacitor0805: {
    stepUrl: `${kicadModelRoot}/Capacitor_SMD.3dshapes/C_0805_2012Metric.step`
  },
  controllerDevKit: {
    stepUrl: checkedInStepUrl("esp32-s3-devkitc-1-n8r2.step"),
    modelBoardNormalDirection: "y+",
    zOffsetFromSurface: "3mm"
  },
  ethernetModule: {
    stepUrl: "https://github.com/dubpixel/dpx_kicad/raw/11ce143404062a50f7df05892e87c65cfedf8b94/zusr_3D/WIZ850IO.step",
    modelBoardNormalDirection: "y+"
  },
  dip6: {
    stepUrl: `${kicadModelRoot}/Package_DIP.3dshapes/DIP-6_W7.62mm.step`
  },
  diodeDo41: {
    stepUrl: `${kicadModelRoot}/Diode_THT.3dshapes/D_DO-41_SOD81_P10.16mm_Horizontal.step`
  },
  irReceiver: {
    stepUrl:
      "https://github.com/StefanHamminga/kicad-packages3D/raw/395108dcab363619c3c82ad00e060acd423aeeb7/Sensor_Optical.3dshapes/TSOP384xx.step",
    modelBoardNormalDirection: "y+",
    positionOffset: { x: 0, y: -1.45, z: 0 }
  },
  led5mmGreen: {
    stepUrl: checkedInStepUrl("kingbright-wp7113.step"),
    modelBoardNormalDirection: "x-",
    modelOriginPosition: { x: 446.187838274769, y: 127.91233816873, z: -0.25 }
  },
  led5mmRed: {
    stepUrl: checkedInStepUrl("kingbright-wp7113-red.step"),
    modelBoardNormalDirection: "x-",
    modelOriginPosition: { x: 446.187838274769, y: 127.91233816873, z: -0.25 }
  },
  led5mmWhite: {
    stepUrl: checkedInStepUrl("kingbright-wp7113-white.step"),
    modelBoardNormalDirection: "x-",
    modelOriginPosition: { x: 446.187838274769, y: 127.91233816873, z: -0.25 }
  },
  pinHeader1x01: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x01_P2.54mm_Vertical.step`,
    pcbRotationOffset: -90
  },
  pinHeader1x02: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x02_P2.54mm_Vertical.step`,
    pcbRotationOffset: -90
  },
  pinHeader1x03: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x03_P2.54mm_Vertical.step`,
    pcbRotationOffset: -90
  },
  pinSocket1x22: {
    stepUrl: `${kicadModelRoot}/Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x22_P2.54mm_Vertical.step`,
    pcbRotationOffset: -90
  },
  resistor0603: {
    stepUrl: `${kicadModelRoot}/Resistor_SMD.3dshapes/R_0603_1608Metric.step`
  },
  resistor0805: {
    stepUrl: `${kicadModelRoot}/Resistor_SMD.3dshapes/R_0805_2012Metric.step`
  },
  repeaterConnectorRj14: {
    stepUrl: checkedInStepUrl("te-5520250-2-rj14.step"),
    modelBoardNormalDirection: "y+",
    pcbRotationOffset: 180,
    // TE drawing 5520250 D3: the housing top is 16.13 mm above the PCB seating plane.
    zOffsetFromSurface: "8.637mm"
  },
  scoringSounder: {
    stepUrl: `${kicadModelRoot}/Buzzer_Beeper.3dshapes/Buzzer_TDK_PS1240P02BT_D12.2mm_H6.5mm.step`
  },
  sot23: {
    stepUrl: `${kicadModelRoot}/Package_TO_SOT_SMD.3dshapes/SOT-23.step`
  },
  usbCPdModule: {
    stepUrl: checkedInStepUrl("adafruit-5807-husb238.step"),
    modelOriginPosition: { x: 10.16, y: 11.7475, z: 0 },
    positionOffset: { x: 0.127, y: -0.175, z: 0 }
  },
  v5RegulatorModule: {
    stepUrl: "https://www.pololu.com/file/0J1733/d36v50fx-step-down-voltage-regulator.step",
    modelOriginPosition: { x: 12.7, y: 12.7, z: 0 },
    positionOffset: { x: -0.05, y: -0.05, z: 0 },
    zOffsetFromSurface: "6mm"
  }
} as const
