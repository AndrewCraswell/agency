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
    positionOffset: { x: 0, y: 18.4, z: 0 },
    zOffsetFromSurface: "2.5mm"
  },
  ethernetModule: {
    stepUrl: "https://github.com/dubpixel/dpx_kicad/raw/11ce143404062a50f7df05892e87c65cfedf8b94/zusr_3D/WIZ850IO.step",
    zOffsetFromSurface: "2.5mm"
  },
  irReceiver: {
    stepUrl:
      "https://github.com/StefanHamminga/kicad-packages3D/raw/395108dcab363619c3c82ad00e060acd423aeeb7/Sensor_Optical.3dshapes/TSOP384xx.step"
  },
  pinHeader1x01: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x01_P2.54mm_Vertical.step`
  },
  pinHeader1x02: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x02_P2.54mm_Vertical.step`
  },
  pinHeader1x03: {
    stepUrl: `${kicadModelRoot}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x03_P2.54mm_Vertical.step`
  },
  pinSocket1x22: {
    stepUrl: `${kicadModelRoot}/Connector_PinSocket_2.54mm.3dshapes/PinSocket_1x22_P2.54mm_Vertical.step`
  },
  resistor0603: {
    stepUrl: `${kicadModelRoot}/Resistor_SMD.3dshapes/R_0603_1608Metric.step`
  },
  resistor0805: {
    stepUrl: `${kicadModelRoot}/Resistor_SMD.3dshapes/R_0805_2012Metric.step`
  },
  sot23: {
    stepUrl: `${kicadModelRoot}/Package_TO_SOT_SMD.3dshapes/SOT-23.step`
  }
} as const
