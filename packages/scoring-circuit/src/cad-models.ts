const kicadModelRevision = "b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a"
const kicadModelRoot = `https://github.com/KiCad/kicad-packages3D/raw/${kicadModelRevision}`

export const cadModels = {
  capacitor0603: {
    stepUrl: `${kicadModelRoot}/Capacitor_SMD.3dshapes/C_0603_1608Metric.step`
  },
  capacitor0805: {
    stepUrl: `${kicadModelRoot}/Capacitor_SMD.3dshapes/C_0805_2012Metric.step`
  },
  controllerModule: {
    stepUrl: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1%203D%20Model.STEP",
    modelOriginPosition: { x: 9, y: 12.75, z: 0 },
    positionOffset: { x: 0, y: 18.62, z: 0 },
    zOffsetFromSurface: "8mm"
  },
  ethernetModule: {
    stepUrl: "https://github.com/dubpixel/dpx_kicad/raw/11ce143404062a50f7df05892e87c65cfedf8b94/zusr_3D/WIZ850IO.step",
    modelBoardNormalDirection: "y+"
  },
  irReceiver: {
    stepUrl:
      "https://github.com/StefanHamminga/kicad-packages3D/raw/395108dcab363619c3c82ad00e060acd423aeeb7/Sensor_Optical.3dshapes/TSOP384xx.step",
    modelBoardNormalDirection: "y+",
    positionOffset: { x: 0, y: -1.45, z: 0 }
  },
  led5mm: {
    stepUrl: "https://www.kingbrightusa.com/images/catalog/3D/STEP/WP7113.STEP",
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
  scoringSounder: {
    stepUrl: `${kicadModelRoot}/Buzzer_Beeper.3dshapes/Buzzer_TDK_PS1240P02BT_D12.2mm_H6.5mm.step`
  },
  sot23: {
    stepUrl: `${kicadModelRoot}/Package_TO_SOT_SMD.3dshapes/SOT-23.step`
  },
  usbCPdModule: {
    stepUrl:
      "https://raw.githubusercontent.com/adafruit/Adafruit_CAD_Parts/84d8e0fc41930bddfa46281b9e6186341f58655b/5991%20HUSB238%20USBC/5991%20HUSB238%20USBC.step",
    modelOriginPosition: { x: 10.16, y: 13.9065, z: 0 },
    positionOffset: { x: 0.0635, y: 2.94175, z: 0 },
    zOffsetFromSurface: "6mm"
  },
  v5RegulatorModule: {
    stepUrl: "https://www.pololu.com/file/0J1733/d36v50fx-step-down-voltage-regulator.step",
    modelOriginPosition: { x: 12.7, y: 12.7, z: 0 },
    positionOffset: { x: -0.05, y: -0.05, z: 0 },
    zOffsetFromSurface: "6mm"
  }
} as const
