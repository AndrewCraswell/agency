import { manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"
import { physicalBoardContract } from "./physical-board-contract.js"

const communicationsPhysicalBoard = physicalBoardContract.communicationsModule

function unreleasedFootprintProps(mpn: string) {
  return { ...manufacturerFootprintProps(mpn), footprint: [] as [] }
}

export const communicationsModuleBoardContract = {
  ethernetDecouplingStatus: "incomplete",
  fabricationRelease: "deny",
  heightMm: communicationsPhysicalBoard.heightMm,
  layerCount: communicationsPhysicalBoard.layers,
  nominalThicknessMm: communicationsPhysicalBoard.finishedThicknessMm,
  owner: communicationsPhysicalBoard.owner,
  widthMm: communicationsPhysicalBoard.widthMm
} as const

export const communicationsResetBiasContract = {
  minimumRailV: 3.135,
  maximumRailV: 3.465,
  resetPullupMaximumOhm: 10_100,
  enableInputPulldownMinimumOhm: 990_000,
  minimumReleasedResetV: 3.103,
  maximumW5500InputHighV: 2.426,
  minimumResetHighMarginV: 0.677,
  maximumEnablePulldownLoadA: 0.000_175,
  fabricationRelease: "deny"
} as const

const groundPins = [
  "GND_11",
  "GND_12",
  "GND_14",
  "GND_16",
  "GND_17",
  "GND_31",
  "GND_34",
  "GND_35",
  "THERMAL_GND"
] as const

/** Connectivity-only communications module. Incomplete critical footprints remain DNP. */
export default function CommunicationsModuleCircuit() {
  return (
    <board
      title={communicationsPhysicalBoard.title}
      width={`${communicationsPhysicalBoard.widthMm}mm`}
      height={`${communicationsPhysicalBoard.heightMm}mm`}
      layers={communicationsPhysicalBoard.layers}
    >
      <chip
        name="J_USB_C"
        manufacturerPartNumber="10177070-00011LF"
        {...unreleasedFootprintProps("10177070-00011LF")}
        pinLabels={{
          pin1: "USB_DN_PORT",
          pin2: "USB_DP_PORT",
          pin3: "CC1_PORT",
          pin4: "CC2_PORT",
          pin5: "VBUS_PORT",
          pin6: "GND",
          pin7: "SBU1_PORT",
          pin8: "SBU2_PORT",
          pin9: "SHIELD"
        }}
        pcbX={-44}
        pcbY={0}
      />
      <chip
        name="U_USB_PORT_PROTECT"
        manufacturerPartNumber="TPD4S201TRGRRQ1"
        {...unreleasedFootprintProps("TPD4S201TRGRRQ1")}
        pinLabels={{
          pin1: "C_SBU1",
          pin2: "C_SBU2",
          pin3: "VBIAS",
          pin4: "C_CC1",
          pin5: "C_CC2",
          pin6: "RPD_G2",
          pin7: "RPD_G1",
          pin8: "GND_8",
          pin9: "FLT_N",
          pin10: "VPWR",
          pin11: "CC2",
          pin12: "CC1",
          pin13: "GND_13",
          pin14: "SBU2",
          pin15: "SBU1",
          pin16: "NC_16",
          pin17: "NC_17",
          pin18: "GND_18",
          pin19: "NC_19",
          pin20: "NC_20",
          pin21: "THERMAL_GND"
        }}
        pcbX={-36}
        pcbY={0}
      />
      <chip
        name="U_USB2_ESD"
        manufacturerPartNumber="TPD2EUSB30DRTR"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "IO1_USB_DN", pin2: "GND", pin3: "IO2_USB_DP" }}
      />
      <chip
        name="U_USB_PD"
        manufacturerPartNumber="TPS25730ADREFR"
        {...unreleasedFootprintProps("TPS25730ADREFR")}
        pinLabels={{
          pin1: "LDO_3V3",
          pin2: "ADCIN1",
          pin3: "ADCIN2",
          pin4: "LDO_1V5",
          pin5: "ADCIN3",
          pin6: "CAP_MIS_N",
          pin7: "ADCIN4",
          pin8: "I2CT_SDA",
          pin9: "I2CT_SCL",
          pin10: "DBG_ACC",
          pin11: "GND_11",
          pin12: "GND_12",
          pin13: "PLUG_FLIP",
          pin14: "GND_14",
          pin15: "DRAIN_15",
          pin16: "GND_16",
          pin17: "GND_17",
          pin18: "FAULT_IN_N",
          pin19: "SINK_EN",
          pin20: "PPHV_20",
          pin21: "PPHV_21",
          pin22: "PPHV_22",
          pin23: "VBUS_IN_23",
          pin24: "VBUS_IN_24",
          pin25: "VBUS_IN_25",
          pin26: "RESERVED_26",
          pin27: "PD5VMAX_N",
          pin28: "CC1",
          pin29: "CC2",
          pin30: "DRAIN_30",
          pin31: "GND_31",
          pin32: "VBUS_32",
          pin33: "VBUS_33",
          pin34: "GND_34",
          pin35: "GND_35",
          pin36: "RESERVED_36",
          pin37: "PLUG_EVENT",
          pin38: "VIN_3V3",
          pin39: "THERMAL_GND",
          pin40: "THERMAL_DRAIN"
        }}
        pcbX={-20}
        pcbY={0}
      />
      <chip
        name="D_USB_PD_VBUS_TVS"
        manufacturerPartNumber="TVS2200DRVR"
        {...unreleasedFootprintProps("TVS2200DRVR")}
        pinLabels={{ pin1: "VBUS_PORT", pin2: "CHASSIS" }}
        pcbX={-36}
        pcbY={-10}
      />
      <chip
        name="D_USB_PD_VBUS_DISCONNECT"
        manufacturerPartNumber="B340A-13-F"
        {...unreleasedFootprintProps("B340A-13-F")}
        pinLabels={{ pin1: "ANODE_GND", pin2: "CATHODE_VBUS" }}
        pcbX={-28}
        pcbY={-10}
      />
      <chip
        name="C_USB_PORT_PROTECT_BIAS"
        manufacturerPartNumber="100NF_10PCT_100V_X7R_0603"
        footprint="0603"
        pinLabels={{ pin1: "VBIAS", pin2: "GND" }}
      />
      <chip
        name="C_USB_PORT_PROTECT_VPWR"
        manufacturerPartNumber="1UF_10PCT_35V_X7R_0603"
        footprint="0603"
        pinLabels={{ pin1: "VPWR", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_LDO"
        manufacturerPartNumber="T55A106M010C0200"
        {...unreleasedFootprintProps("T55A106M010C0200")}
        pinLabels={{ pin1: "LDO_3V3", pin2: "GND" }}
        pcbX={-14}
        pcbY={-10}
      />
      <chip
        name="C_USB_PD_LDO_1V5"
        manufacturerPartNumber="GRM21BR71A106KA73K"
        footprint="0805"
        pinLabels={{ pin1: "LDO_1V5", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_VIN_3V3"
        manufacturerPartNumber="10UF_10PCT_10V_X7R_0805"
        footprint="0805"
        pinLabels={{ pin1: "VIN_3V3", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_VBUS"
        manufacturerPartNumber="4U7_10PCT_50V_X7R_0805"
        footprint="0805"
        pinLabels={{ pin1: "VBUS_PORT", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_PPHV"
        manufacturerPartNumber="T523H107M035APE070"
        {...unreleasedFootprintProps("T523H107M035APE070")}
        pinLabels={{ pin1: "PD_PPHV_20V", pin2: "GND" }}
        pcbX={-6}
        pcbY={-10}
      />
      <chip
        name="C_USB_PD_CC1"
        manufacturerPartNumber="330PF_5PCT_50V_C0G_0402"
        footprint="0402"
        pinLabels={{ pin1: "CC1", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_CC2"
        manufacturerPartNumber="330PF_5PCT_50V_C0G_0402"
        footprint="0402"
        pinLabels={{ pin1: "CC2", pin2: "GND" }}
      />
      {([24900, 10000, 10000, 68100, 162000, 38000, 191000, 9500] as const).map((value, index) => (
        <resistor
          key={index}
          name={`R_USB_PD_ADCIN${Math.floor(index / 2) + 1}_${index % 2 === 0 ? "UP" : "DOWN"}`}
          resistance={value}
          footprint="0402"
        />
      ))}
      <resistor name="R_USB_PD_PD5VMAX" resistance={10000} footprint="0402" />
      <resistor name="R_USB_PD_RESERVED_26" resistance={10000} footprint="0402" />
      <resistor name="R_USB_PD_RESERVED_36" resistance={10000} footprint="0402" />
      <resistor name="R_USB_PORT_PROTECT_FLT_PULLUP" resistance={10000} footprint="0402" />
      <chip
        name="U_EFUSE"
        manufacturerPartNumber="TPS259474ARPWR"
        {...unreleasedFootprintProps("TPS259474ARPWR")}
        pinLabels={{
          pin1: "EN_UVLO",
          pin2: "OVLO",
          pin3: "PG",
          pin4: "PGTH",
          pin5: "VIN",
          pin6: "VOUT",
          pin7: "DVDT",
          pin8: "GND",
          pin9: "ILM",
          pin10: "ITIMER"
        }}
        pcbX={0}
        pcbY={0}
      />
      <resistor name="R_EFUSE_UVLO_UP" resistance={475000} footprint="0402" />
      <resistor name="R_EFUSE_UVLO_DOWN" resistance={38300} footprint="0402" />
      <resistor name="R_EFUSE_OVLO_UP" resistance={499000} footprint="0402" />
      <resistor name="R_EFUSE_OVLO_DOWN" resistance={28700} footprint="0402" />
      <resistor name="R_EFUSE_ILM" resistance={1240} tolerance="1%" footprint="0402" />
      <capacitor name="C_EFUSE_ITIMER" capacitance="2.2nF" footprint="0402" />
      <capacitor name="C_EFUSE_DVDT" capacitance="2.2nF" footprint="0402" />
      <resistor name="R_EFUSE_PGTH_UP" resistance={698000} tolerance="1%" footprint="0402" />
      <resistor name="R_EFUSE_PGTH_DOWN" resistance={49900} tolerance="1%" footprint="0402" />
      <resistor name="R_EFUSE_PG_PULLUP" resistance={10000} footprint="0402" />
      <chip
        name="C_EFUSE_OUT"
        manufacturerPartNumber="T523H107M035APE070"
        {...unreleasedFootprintProps("T523H107M035APE070")}
        pinLabels={{ pin1: "VOUT", pin2: "GND" }}
        pcbX={8}
        pcbY={-10}
      />
      <chip
        name="U_COMM_3V3"
        manufacturerPartNumber="LMR43620MSC3RPERQ1"
        {...unreleasedFootprintProps("LMR43620MSC3RPERQ1")}
        pinLabels={{
          pin1: "MODE_SYNC",
          pin2: "PGOOD",
          pin3: "EN_UVLO",
          pin4: "VIN",
          pin5: "SW",
          pin6: "BOOT",
          pin7: "VCC",
          pin8: "VOUT_FB",
          pin9: "GND"
        }}
      />
      <chip
        name="L_COMM_3V3"
        manufacturerPartNumber="XGL4030-222MEC"
        {...unreleasedFootprintProps("XGL4030-222MEC")}
        pinLabels={{ pin1: "SW", pin2: "COMM_3V3" }}
      />
      <chip
        name="C_COMM_REG_IN"
        manufacturerPartNumber="C2012X7R1E475K125AB"
        footprint="0805"
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
      />
      <chip
        name="C_COMM_REG_IN_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        {...unreleasedFootprintProps("C0603C104K3RACTU")}
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
      />
      <chip
        name="C_COMM_REG_BOOT"
        manufacturerPartNumber="C0603C104K3RACTU"
        {...unreleasedFootprintProps("C0603C104K3RACTU")}
        pinLabels={{ pin1: "BOOT", pin2: "SW" }}
      />
      <chip
        name="C_COMM_REG_VCC"
        manufacturerPartNumber="GRM188R71A105KA61"
        {...unreleasedFootprintProps("GRM188R71A105KA61")}
        pinLabels={{ pin1: "VCC", pin2: "GND" }}
      />
      {(["A", "B", "C"] as const).map((suffix) => (
        <chip
          key={suffix}
          name={`C_COMM_REG_OUT_${suffix}`}
          manufacturerPartNumber="C2012X7S1A226M125AC"
          {...unreleasedFootprintProps("C2012X7S1A226M125AC")}
          pinLabels={{ pin1: "COMM_3V3", pin2: "GND" }}
        />
      ))}
      <resistor name="R_COMM_REG_DISCHARGE" resistance="1k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_REG_PGOOD" resistance="10k" tolerance="1%" footprint="0603" />
      <chip
        name="U_COMM_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "MR", pin4: "VDD", pin5: "CT", pin6: "RESET_N" }}
      />
      <capacitor name="C_COMM_SUPERVISOR_CT" capacitance="100nF" footprint="0603" />
      <capacitor name="C_COMM_SUPERVISOR_BYPASS" capacitance="100nF" footprint="0603" />
      <resistor name="R_COMM_RESET_PULLUP" resistance="10k" tolerance="1%" footprint="0603" />
      <chip
        name="U_COMM_OE_ENABLE_BUFFER"
        manufacturerPartNumber="SN74LVC1G34DCKR"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "NC", pin2: "A", pin3: "GND", pin4: "Y", pin5: "VCC" }}
      />
      <resistor name="R_COMM_OE_INPUT_PD" resistance="1M" tolerance="1%" footprint="0603" />
      <chip
        name="Q_COMM_RESET_SINK"
        manufacturerPartNumber="BSS138AKA"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
      />
      <resistor name="R_COMM_RESET_GATE_PD" resistance="100k" tolerance="1%" footprint="0603" />
      <chip
        name="U_COMM_INPUT_GATE_A"
        manufacturerPartNumber="SN74LVC2G126DCUR"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "1OE",
          pin2: "1A_SCK",
          pin3: "2Y_MOSI",
          pin4: "GND",
          pin5: "2A_MOSI",
          pin6: "1Y_SCK",
          pin7: "2OE",
          pin8: "VCC"
        }}
      />
      <chip
        name="U_COMM_INPUT_GATE_B"
        manufacturerPartNumber="SN74LVC1G126DCKR"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "OE", pin2: "A_CS_N", pin3: "GND", pin4: "Y_CS_N", pin5: "VCC" }}
      />
      <chip
        name="U_COMM_OUTPUT_GATE"
        manufacturerPartNumber="SN74LVC2G126DCUR"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "1OE",
          pin2: "1A_MISO",
          pin3: "2Y_INT_N",
          pin4: "GND",
          pin5: "2A_INT_N",
          pin6: "1Y_MISO",
          pin7: "2OE",
          pin8: "VCC"
        }}
      />
      {(["INPUT_A_1", "INPUT_A_2", "INPUT_B", "OUTPUT_1", "OUTPUT_2"] as const).map((suffix) => (
        <resistor key={suffix} name={`R_COMM_OE_PD_${suffix}`} resistance="100k" tolerance="1%" footprint="0603" />
      ))}
      <resistor name="R_W5500_MISO_LOCAL_PD" resistance="100k" tolerance="1%" footprint="0603" />
      <resistor name="R_COMM_PRESENT_TIE" resistance="1k" tolerance="1%" footprint="0603" />
      <chip
        name="U_ETHERNET"
        manufacturerPartNumber="W5500"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "TXN",
          pin2: "TXP",
          pin3: "AGND1",
          pin4: "AVDD1",
          pin5: "RXN",
          pin6: "RXP",
          pin7: "DNC",
          pin8: "AVDD2",
          pin9: "AGND2",
          pin10: "EXRES1",
          pin11: "AVDD3",
          pin12: "NC1",
          pin13: "NC2",
          pin14: "AGND3",
          pin15: "AVDD4",
          pin16: "AGND4",
          pin17: "AVDD5",
          pin18: "VBG_FLOAT",
          pin19: "AGND5",
          pin20: "TOCAP",
          pin21: "AVDD6",
          pin22: "1V2O",
          pin23: "RSVD1",
          pin24: "SPDLED",
          pin25: "LINKLED",
          pin26: "DUPLED",
          pin27: "ACTLED",
          pin28: "VDD",
          pin29: "GND",
          pin30: "XI",
          pin31: "XO",
          pin32: "CS_N",
          pin33: "SCK",
          pin34: "MISO",
          pin35: "MOSI",
          pin36: "INT_N",
          pin37: "RST_N",
          pin38: "NC_38",
          pin39: "NC_39",
          pin40: "NC_40",
          pin41: "NC_41",
          pin42: "NC_42",
          pin43: "PMODE2",
          pin44: "PMODE1",
          pin45: "PMODE0",
          pin46: "NC3",
          pin47: "NC4",
          pin48: "AGND6"
        }}
      />
      <resistor name="R_W5500_EXRES" resistance="12.4k" tolerance="1%" footprint="0603" />
      <capacitor name="C_W5500_TOCAP" capacitance="4.7uF" footprint="0805" />
      <capacitor name="C_W5500_1V2O" capacitance="10nF" footprint="0603" />
      <capacitor name="C_W5500_VDD" capacitance="100nF" footprint="0603" />
      {(["A", "B", "C"] as const).map((suffix) => (
        <capacitor key={suffix} name={`C_W5500_AVDD_${suffix}`} capacitance="100nF" footprint="0603" />
      ))}
      <chip
        name="Y_W5500"
        manufacturerPartNumber="25MHZ_CRYSTAL_TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "XI", pin2: "XO" }}
      />
      <resistor name="R_W5500_XTAL" resistance="1M" footprint="0603" />
      <resistor name="R_W5500_XO" resistance="0" footprint="0603" />
      <capacitor name="C_W5500_XI" capacitance="18pF" footprint="0603" />
      <capacitor name="C_W5500_XO" capacitance="18pF" footprint="0603" />
      <chip
        name="FB_W5500_AVDD"
        manufacturerPartNumber="ETHERNET_FERRITE_TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "COMM_3V3", pin2: "ETH_AVDD" }}
      />
      <chip
        name="J_ETHERNET_MAGJACK"
        manufacturerPartNumber="7499011121A"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "TD_P",
          pin2: "CTD",
          pin3: "TD_N",
          pin4: "RD_P",
          pin5: "CRD",
          pin6: "RD_N",
          pin9: "YELLOW_A",
          pin10: "YELLOW_K",
          pin11: "GREEN_A",
          pin12: "GREEN_K",
          pin13: "SHIELD_A",
          pin14: "SHIELD_B"
        }}
      />
      <resistor name="R_MAGJACK_YELLOW" resistance="330" footprint="0603" />
      <resistor name="R_MAGJACK_GREEN" resistance="330" footprint="0603" />
      <chip
        name="J_PWR"
        manufacturerPartNumber="Molex 43045-0400"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "V20_EFUSE_OUT_A", pin2: "GND_A", pin3: "V20_EFUSE_OUT_B", pin4: "GND_B" }}
      />
      <chip
        name="J_CTRL"
        manufacturerPartNumber="Molex 43045-1200"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "GND_1",
          pin2: "W5500_SCK",
          pin3: "GND_2",
          pin4: "W5500_MOSI",
          pin5: "GND_3",
          pin6: "W5500_MISO",
          pin7: "GND_4",
          pin8: "W5500_CS_N",
          pin9: "W5500_INT_N",
          pin10: "COMM_RESET_ASSERT",
          pin11: "COMM_PRESENT_N",
          pin12: "GND_5"
        }}
      />
      <chip
        name="J_USB2"
        manufacturerPartNumber="HSEC8-113-01-L-DV-A-L2"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "USB_DN", pin2: "USB_DP", pin3: "SHIELD" }}
      />

      <trace from="J_USB_C.CC1_PORT" to="U_USB_PORT_PROTECT.C_CC1" />
      <trace from="J_USB_C.CC2_PORT" to="U_USB_PORT_PROTECT.C_CC2" />
      <trace from="J_USB_C.SBU1_PORT" to="U_USB_PORT_PROTECT.C_SBU1" />
      <trace from="J_USB_C.SBU2_PORT" to="U_USB_PORT_PROTECT.C_SBU2" />
      <trace from="U_USB_PORT_PROTECT.CC1" to="U_USB_PD.CC1" />
      <trace from="U_USB_PORT_PROTECT.CC2" to="U_USB_PD.CC2" />
      <trace from="U_USB_PORT_PROTECT.RPD_G1" to="J_USB_C.CC1_PORT" />
      <trace from="U_USB_PORT_PROTECT.RPD_G2" to="J_USB_C.CC2_PORT" />
      <trace from="J_USB_C.USB_DN_PORT" to="U_USB2_ESD.IO1_USB_DN" />
      <trace from="J_USB_C.USB_DP_PORT" to="U_USB2_ESD.IO2_USB_DP" />
      <trace from="J_USB_C.USB_DN_PORT" to="J_USB2.USB_DN" />
      <trace from="J_USB_C.USB_DP_PORT" to="J_USB2.USB_DP" />
      <trace from="U_USB2_ESD.GND" to="net.GND" />
      <trace from="J_USB2.SHIELD" to="net.CHASSIS" />
      {(["VBUS_32", "VBUS_33", "VBUS_IN_23", "VBUS_IN_24", "VBUS_IN_25"] as const).map((pin) => (
        <trace key={pin} from="J_USB_C.VBUS_PORT" to={`U_USB_PD.${pin}`} />
      ))}
      <trace from="J_USB_C.VBUS_PORT" to="D_USB_PD_VBUS_TVS.VBUS_PORT" />
      <trace from="D_USB_PD_VBUS_TVS.CHASSIS" to="net.CHASSIS" />
      <trace from="D_USB_PD_VBUS_DISCONNECT.CATHODE_VBUS" to="J_USB_C.VBUS_PORT" />
      <trace from="D_USB_PD_VBUS_DISCONNECT.ANODE_GND" to="net.GND" />
      <trace from="J_USB_C.GND" to="net.GND" />
      <trace from="J_USB_C.SHIELD" to="net.CHASSIS" />
      <trace from="U_USB_PORT_PROTECT.VBIAS" to="C_USB_PORT_PROTECT_BIAS.VBIAS" />
      <trace from="C_USB_PORT_PROTECT_BIAS.GND" to="net.GND" />
      <trace from="U_USB_PORT_PROTECT.VPWR" to="U_USB_PD.LDO_3V3" />
      <trace from="U_USB_PORT_PROTECT.VPWR" to="C_USB_PORT_PROTECT_VPWR.VPWR" />
      <trace from="C_USB_PORT_PROTECT_VPWR.GND" to="net.GND" />
      {(["GND_8", "GND_13", "GND_18", "THERMAL_GND"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PORT_PROTECT.${pin}`} to="net.GND" />
      ))}
      <trace from="U_USB_PORT_PROTECT.FLT_N" to="U_USB_PD.FAULT_IN_N" />
      <trace from="U_USB_PORT_PROTECT.FLT_N" to="R_USB_PORT_PROTECT_FLT_PULLUP.pin1" />
      <trace from="R_USB_PORT_PROTECT_FLT_PULLUP.pin2" to="U_USB_PD.LDO_3V3" />
      <trace from="U_USB_PD.LDO_3V3" to="U_USB_PD.VIN_3V3" />
      <trace from="U_USB_PD.LDO_3V3" to="C_USB_PD_LDO.LDO_3V3" />
      <trace from="C_USB_PD_LDO.GND" to="net.GND" />
      <trace from="U_USB_PD.VIN_3V3" to="C_USB_PD_VIN_3V3.VIN_3V3" />
      <trace from="C_USB_PD_VIN_3V3.GND" to="net.GND" />
      <trace from="U_USB_PD.LDO_1V5" to="C_USB_PD_LDO_1V5.LDO_1V5" />
      <trace from="C_USB_PD_LDO_1V5.GND" to="net.GND" />
      <trace from="J_USB_C.VBUS_PORT" to="C_USB_PD_VBUS.VBUS_PORT" />
      <trace from="C_USB_PD_VBUS.GND" to="net.GND" />
      <trace from="U_USB_PD.CC1" to="C_USB_PD_CC1.CC1" />
      <trace from="U_USB_PD.CC2" to="C_USB_PD_CC2.CC2" />
      <trace from="C_USB_PD_CC1.GND" to="net.GND" />
      <trace from="C_USB_PD_CC2.GND" to="net.GND" />
      {(["PPHV_20", "PPHV_21", "PPHV_22"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PD.${pin}`} to="net.PD_PPHV_20V" />
      ))}
      <trace from="C_USB_PD_PPHV.PD_PPHV_20V" to="net.PD_PPHV_20V" />
      <trace from="C_USB_PD_PPHV.GND" to="net.GND" />
      <trace from="net.PD_PPHV_20V" to="U_EFUSE.VIN" />
      {groundPins.map((pin) => (
        <trace key={pin} from={`U_USB_PD.${pin}`} to="net.GND" />
      ))}
      <trace from="U_USB_PD.THERMAL_DRAIN" to="net.PD_DRAIN" />
      <trace from="U_USB_PD.DRAIN_15" to="net.PD_DRAIN" />
      <trace from="U_USB_PD.DRAIN_30" to="net.PD_DRAIN" />
      {([1, 2, 3, 4] as const).map((channel) => (
        <group key={channel}>
          <trace from={`U_USB_PD.ADCIN${channel}`} to={`R_USB_PD_ADCIN${channel}_UP.pin2`} />
          <trace from={`U_USB_PD.ADCIN${channel}`} to={`R_USB_PD_ADCIN${channel}_DOWN.pin1`} />
          <trace from={`R_USB_PD_ADCIN${channel}_UP.pin1`} to="U_USB_PD.LDO_3V3" />
          <trace from={`R_USB_PD_ADCIN${channel}_DOWN.pin2`} to="net.GND" />
        </group>
      ))}
      <trace from="U_USB_PD.PD5VMAX_N" to="R_USB_PD_PD5VMAX.pin1" />
      <trace from="R_USB_PD_PD5VMAX.pin2" to="net.GND" />
      <trace from="U_USB_PD.RESERVED_26" to="R_USB_PD_RESERVED_26.pin1" />
      <trace from="R_USB_PD_RESERVED_26.pin2" to="net.GND" />
      <trace from="U_USB_PD.RESERVED_36" to="R_USB_PD_RESERVED_36.pin1" />
      <trace from="R_USB_PD_RESERVED_36.pin2" to="net.GND" />
      <trace from="U_EFUSE.VIN" to="R_EFUSE_UVLO_UP.pin1" />
      <trace from="R_EFUSE_UVLO_UP.pin2" to="U_EFUSE.EN_UVLO" />
      <trace from="U_EFUSE.EN_UVLO" to="R_EFUSE_UVLO_DOWN.pin1" />
      <trace from="R_EFUSE_UVLO_DOWN.pin2" to="net.GND" />
      <trace from="U_EFUSE.VIN" to="R_EFUSE_OVLO_UP.pin1" />
      <trace from="R_EFUSE_OVLO_UP.pin2" to="U_EFUSE.OVLO" />
      <trace from="U_EFUSE.OVLO" to="R_EFUSE_OVLO_DOWN.pin1" />
      <trace from="R_EFUSE_OVLO_DOWN.pin2" to="net.GND" />
      <trace from="U_EFUSE.ILM" to="R_EFUSE_ILM.pin1" />
      <trace from="R_EFUSE_ILM.pin2" to="net.GND" />
      <trace from="U_EFUSE.ITIMER" to="C_EFUSE_ITIMER.pin1" />
      <trace from="C_EFUSE_ITIMER.pin2" to="net.GND" />
      <trace from="U_EFUSE.DVDT" to="C_EFUSE_DVDT.pin1" />
      <trace from="C_EFUSE_DVDT.pin2" to="net.GND" />
      <trace from="U_EFUSE.VOUT" to="R_EFUSE_PGTH_UP.pin1" />
      <trace from="R_EFUSE_PGTH_UP.pin2" to="U_EFUSE.PGTH" />
      <trace from="U_EFUSE.PGTH" to="R_EFUSE_PGTH_DOWN.pin1" />
      <trace from="R_EFUSE_PGTH_DOWN.pin2" to="net.GND" />
      <trace from="U_EFUSE.PG" to="R_EFUSE_PG_PULLUP.pin1" />
      <trace from="R_EFUSE_PG_PULLUP.pin2" to="net.COMM_3V3" />
      <trace from="U_EFUSE.VOUT" to="C_EFUSE_OUT.VOUT" />
      <trace from="C_EFUSE_OUT.GND" to="net.GND" />
      <trace from="U_EFUSE.GND" to="net.GND" />
      <trace from="U_EFUSE.VOUT" to="J_PWR.V20_EFUSE_OUT_A" />
      <trace from="U_EFUSE.VOUT" to="J_PWR.V20_EFUSE_OUT_B" />
      <trace from="J_PWR.GND_A" to="net.GND" />
      <trace from="J_PWR.GND_B" to="net.GND" />
      <trace from="U_EFUSE.VOUT" to="U_COMM_3V3.VIN" />
      <trace from="U_COMM_3V3.EN_UVLO" to="U_EFUSE.VOUT" />
      <trace from="U_COMM_3V3.MODE_SYNC" to="U_COMM_3V3.VCC" />
      <trace from="U_COMM_3V3.SW" to="L_COMM_3V3.SW" />
      <trace from="L_COMM_3V3.COMM_3V3" to="net.COMM_3V3" />
      <trace from="U_COMM_3V3.VOUT_FB" to="net.COMM_3V3" />
      <trace from="U_COMM_3V3.BOOT" to="C_COMM_REG_BOOT.BOOT" />
      <trace from="C_COMM_REG_BOOT.SW" to="U_COMM_3V3.SW" />
      <trace from="U_COMM_3V3.VCC" to="C_COMM_REG_VCC.VCC" />
      <trace from="U_COMM_3V3.PGOOD" to="R_COMM_REG_PGOOD.pin1" />
      <trace from="R_COMM_REG_PGOOD.pin2" to="net.COMM_3V3" />
      <trace from="C_COMM_REG_IN.VIN" to="U_COMM_3V3.VIN" />
      <trace from="C_COMM_REG_IN_HF.VIN" to="U_COMM_3V3.VIN" />
      <trace from="C_COMM_REG_IN.GND" to="net.GND" />
      <trace from="C_COMM_REG_IN_HF.GND" to="net.GND" />
      <trace from="C_COMM_REG_VCC.GND" to="net.GND" />
      <trace from="U_COMM_3V3.GND" to="net.GND" />
      {(["A", "B", "C"] as const).map((suffix) => (
        <group key={suffix}>
          <trace from={`C_COMM_REG_OUT_${suffix}.COMM_3V3`} to="net.COMM_3V3" />
          <trace from={`C_COMM_REG_OUT_${suffix}.GND`} to="net.GND" />
        </group>
      ))}
      <trace from="R_COMM_REG_DISCHARGE.pin1" to="net.COMM_3V3" />
      <trace from="R_COMM_REG_DISCHARGE.pin2" to="net.GND" />
      <trace from="U_COMM_SUPERVISOR.SENSE" to="net.COMM_3V3" />
      <trace from="U_COMM_SUPERVISOR.MR" to="net.COMM_3V3" />
      <trace from="U_COMM_SUPERVISOR.VDD" to="net.COMM_3V3" />
      <trace from="U_COMM_SUPERVISOR.GND" to="net.GND" />
      <trace from="U_COMM_SUPERVISOR.CT" to="C_COMM_SUPERVISOR_CT.pin1" />
      <trace from="C_COMM_SUPERVISOR_CT.pin2" to="net.GND" />
      <trace from="C_COMM_SUPERVISOR_BYPASS.pin1" to="net.COMM_3V3" />
      <trace from="C_COMM_SUPERVISOR_BYPASS.pin2" to="net.GND" />
      <trace from="U_COMM_SUPERVISOR.RESET_N" to="net.COMM_RESET_RELEASE_N" />
      <trace from="R_COMM_RESET_PULLUP.pin1" to="net.COMM_3V3" />
      <trace from="R_COMM_RESET_PULLUP.pin2" to="net.COMM_RESET_RELEASE_N" />
      <trace from="Q_COMM_RESET_SINK.D" to="net.COMM_RESET_RELEASE_N" />
      <trace from="Q_COMM_RESET_SINK.S" to="net.GND" />
      <trace from="J_CTRL.COMM_RESET_ASSERT" to="Q_COMM_RESET_SINK.G" />
      <trace from="Q_COMM_RESET_SINK.G" to="R_COMM_RESET_GATE_PD.pin1" />
      <trace from="R_COMM_RESET_GATE_PD.pin2" to="net.GND" />
      <trace from="net.COMM_RESET_RELEASE_N" to="U_ETHERNET.RST_N" />
      <trace from="net.COMM_RESET_RELEASE_N" to="U_COMM_OE_ENABLE_BUFFER.A" />
      <trace from="net.COMM_RESET_RELEASE_N" to="R_COMM_OE_INPUT_PD.pin1" />
      <trace from="R_COMM_OE_INPUT_PD.pin2" to="net.GND" />
      <trace from="U_COMM_OE_ENABLE_BUFFER.VCC" to="net.COMM_3V3" />
      <trace from="U_COMM_OE_ENABLE_BUFFER.GND" to="net.GND" />
      <trace from="U_COMM_OE_ENABLE_BUFFER.Y" to="net.COMM_IO_ENABLE" />
      <trace from="net.COMM_IO_ENABLE" to="U_COMM_INPUT_GATE_A.1OE" />
      <trace from="net.COMM_IO_ENABLE" to="U_COMM_INPUT_GATE_A.2OE" />
      <trace from="net.COMM_IO_ENABLE" to="U_COMM_INPUT_GATE_B.OE" />
      <trace from="net.COMM_IO_ENABLE" to="U_COMM_OUTPUT_GATE.1OE" />
      <trace from="net.COMM_IO_ENABLE" to="U_COMM_OUTPUT_GATE.2OE" />
      <trace from="R_COMM_OE_PD_INPUT_A_1.pin1" to="U_COMM_INPUT_GATE_A.1OE" />
      <trace from="R_COMM_OE_PD_INPUT_A_2.pin1" to="U_COMM_INPUT_GATE_A.2OE" />
      <trace from="R_COMM_OE_PD_INPUT_B.pin1" to="U_COMM_INPUT_GATE_B.OE" />
      <trace from="R_COMM_OE_PD_OUTPUT_1.pin1" to="U_COMM_OUTPUT_GATE.1OE" />
      <trace from="R_COMM_OE_PD_OUTPUT_2.pin1" to="U_COMM_OUTPUT_GATE.2OE" />
      {(["INPUT_A_1", "INPUT_A_2", "INPUT_B", "OUTPUT_1", "OUTPUT_2"] as const).map((suffix) => (
        <trace key={suffix} from={`R_COMM_OE_PD_${suffix}.pin2`} to="net.GND" />
      ))}
      <trace from="J_CTRL.W5500_SCK" to="U_COMM_INPUT_GATE_A.1A_SCK" />
      <trace from="U_COMM_INPUT_GATE_A.1Y_SCK" to="U_ETHERNET.SCK" />
      <trace from="J_CTRL.W5500_MOSI" to="U_COMM_INPUT_GATE_A.2A_MOSI" />
      <trace from="U_COMM_INPUT_GATE_A.2Y_MOSI" to="U_ETHERNET.MOSI" />
      <trace from="J_CTRL.W5500_CS_N" to="U_COMM_INPUT_GATE_B.A_CS_N" />
      <trace from="U_COMM_INPUT_GATE_B.Y_CS_N" to="U_ETHERNET.CS_N" />
      <trace from="U_ETHERNET.MISO" to="U_COMM_OUTPUT_GATE.1A_MISO" />
      <trace from="U_COMM_OUTPUT_GATE.1Y_MISO" to="J_CTRL.W5500_MISO" />
      <trace from="U_ETHERNET.INT_N" to="U_COMM_OUTPUT_GATE.2A_INT_N" />
      <trace from="U_COMM_OUTPUT_GATE.2Y_INT_N" to="J_CTRL.W5500_INT_N" />
      <trace from="U_ETHERNET.MISO" to="R_W5500_MISO_LOCAL_PD.pin1" />
      <trace from="R_W5500_MISO_LOCAL_PD.pin2" to="net.GND" />
      {(["GND_1", "GND_2", "GND_3", "GND_4", "GND_5"] as const).map((pin) => (
        <trace key={pin} from={`J_CTRL.${pin}`} to="net.GND" />
      ))}
      <trace from="J_CTRL.COMM_PRESENT_N" to="R_COMM_PRESENT_TIE.pin1" />
      <trace from="R_COMM_PRESENT_TIE.pin2" to="net.GND" />
      <trace from="U_COMM_INPUT_GATE_A.VCC" to="net.COMM_3V3" />
      <trace from="U_COMM_INPUT_GATE_B.VCC" to="net.COMM_3V3" />
      <trace from="U_COMM_OUTPUT_GATE.VCC" to="net.COMM_3V3" />
      <trace from="U_COMM_INPUT_GATE_A.GND" to="net.GND" />
      <trace from="U_COMM_INPUT_GATE_B.GND" to="net.GND" />
      <trace from="U_COMM_OUTPUT_GATE.GND" to="net.GND" />
      <trace from="U_ETHERNET.VDD" to="net.COMM_3V3" />
      <trace from="U_ETHERNET.VDD" to="C_W5500_VDD.pin1" />
      <trace from="C_W5500_VDD.pin2" to="net.GND" />
      <trace from="net.COMM_3V3" to="FB_W5500_AVDD.COMM_3V3" />
      <trace from="FB_W5500_AVDD.ETH_AVDD" to="net.ETH_AVDD" />
      {(["AVDD1", "AVDD2", "AVDD3", "AVDD4", "AVDD5", "AVDD6"] as const).map((pin) => (
        <trace key={pin} from={`U_ETHERNET.${pin}`} to="net.ETH_AVDD" />
      ))}
      {(["AGND1", "AGND2", "AGND3", "AGND4", "AGND5", "AGND6", "GND", "RSVD1"] as const).map((pin) => (
        <trace key={pin} from={`U_ETHERNET.${pin}`} to="net.GND" />
      ))}
      <trace from="U_ETHERNET.PMODE2" to="net.COMM_3V3" />
      <trace from="U_ETHERNET.PMODE1" to="net.COMM_3V3" />
      <trace from="U_ETHERNET.PMODE0" to="net.COMM_3V3" />
      <trace from="net.ETH_AVDD" to="C_W5500_AVDD_A.pin1" />
      <trace from="net.ETH_AVDD" to="C_W5500_AVDD_B.pin1" />
      <trace from="net.ETH_AVDD" to="C_W5500_AVDD_C.pin1" />
      <trace from="C_W5500_AVDD_A.pin2" to="net.GND" />
      <trace from="C_W5500_AVDD_B.pin2" to="net.GND" />
      <trace from="C_W5500_AVDD_C.pin2" to="net.GND" />
      <trace from="U_ETHERNET.EXRES1" to="R_W5500_EXRES.pin1" />
      <trace from="R_W5500_EXRES.pin2" to="net.GND" />
      <trace from="U_ETHERNET.TOCAP" to="C_W5500_TOCAP.pin1" />
      <trace from="C_W5500_TOCAP.pin2" to="net.GND" />
      <trace from="U_ETHERNET.1V2O" to="C_W5500_1V2O.pin1" />
      <trace from="C_W5500_1V2O.pin2" to="net.GND" />
      <trace from="U_ETHERNET.XI" to="Y_W5500.XI" />
      <trace from="Y_W5500.XO" to="R_W5500_XO.pin1" />
      <trace from="R_W5500_XO.pin2" to="U_ETHERNET.XO" />
      <trace from="Y_W5500.XI" to="R_W5500_XTAL.pin1" />
      <trace from="Y_W5500.XO" to="R_W5500_XTAL.pin2" />
      <trace from="Y_W5500.XI" to="C_W5500_XI.pin1" />
      <trace from="C_W5500_XI.pin2" to="net.GND" />
      <trace from="Y_W5500.XO" to="C_W5500_XO.pin1" />
      <trace from="C_W5500_XO.pin2" to="net.GND" />
      <trace from="U_ETHERNET.TXP" to="J_ETHERNET_MAGJACK.TD_P" />
      <trace from="U_ETHERNET.TXN" to="J_ETHERNET_MAGJACK.TD_N" />
      <trace from="U_ETHERNET.RXP" to="J_ETHERNET_MAGJACK.RD_P" />
      <trace from="U_ETHERNET.RXN" to="J_ETHERNET_MAGJACK.RD_N" />
      <trace from="J_ETHERNET_MAGJACK.CTD" to="net.ETH_AVDD" />
      <trace from="J_ETHERNET_MAGJACK.CRD" to="net.ETH_AVDD" />
      <trace from="net.COMM_3V3" to="R_MAGJACK_YELLOW.pin1" />
      <trace from="R_MAGJACK_YELLOW.pin2" to="J_ETHERNET_MAGJACK.YELLOW_A" />
      <trace from="J_ETHERNET_MAGJACK.YELLOW_K" to="U_ETHERNET.SPDLED" />
      <trace from="net.COMM_3V3" to="R_MAGJACK_GREEN.pin1" />
      <trace from="R_MAGJACK_GREEN.pin2" to="J_ETHERNET_MAGJACK.GREEN_A" />
      <trace from="J_ETHERNET_MAGJACK.GREEN_K" to="U_ETHERNET.LINKLED" />
      <trace from="J_ETHERNET_MAGJACK.SHIELD_A" to="net.CHASSIS" />
      <trace from="J_ETHERNET_MAGJACK.SHIELD_B" to="net.CHASSIS" />
    </board>
  )
}
