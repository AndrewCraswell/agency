import type { ReactElement } from "react"
import { Bp033Tpd2eusb30drtrDrtProjectFootprint } from "./bp033-tpd2eusb30drtr-drt-project-footprint.js"
import { Bp033Tpd4s201RgrProjectFootprint } from "./bp033-tpd4s201-rgr-project-footprint.js"
import { Bp033Tps25730aRefProjectFootprint } from "./bp033-tps25730a-ref-project-footprint.js"
import { Bp033Tps25947ProjectFootprint } from "./bp033-tps25947-project-footprint.js"
import { Bp033Tvs2200ProjectFootprint } from "./bp033-tvs2200-project-footprint.js"
import { Bp033UsbCProjectFootprint } from "./bp033-usb-c-project-footprint.js"
import { manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"

const dnpFootprint = [] as []

/**
 * P0's USB-C-only, sink-only power input. This is a connectivity and
 * review-footprint block, not a fabrication release. All reviewed
 * manufacturer footprints remain explicitly non-placeable through their
 * existing project components or the footprint adapter.
 */
export function P0UsbPower(): ReactElement {
  return (
    <group name="P0_USB_POWER">
      <Bp033UsbCProjectFootprint pcbX={-62} pcbY={0} />
      <Bp033Tpd4s201RgrProjectFootprint pcbX={-47} pcbY={0} />
      <Bp033Tpd2eusb30drtrDrtProjectFootprint pcbX={-47} pcbY={-12} />
      <Bp033Tvs2200ProjectFootprint pcbX={-52} pcbY={-20} />
      <Bp033Tps25730aRefProjectFootprint pcbX={-28} pcbY={0} />
      <Bp033Tps25947ProjectFootprint pcbX={-5} pcbY={0} />

      <chip
        name="D_USB_PD_VBUS_DISCONNECT"
        manufacturerPartNumber="B340A-13-F"
        {...manufacturerFootprintProps("B340A-13-F")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "ANODE_GND", pin2: "CATHODE_VBUS" }}
      />
      <chip
        name="U_V5_BUCK"
        manufacturerPartNumber="TPS56A37RPAR"
        {...manufacturerFootprintProps("TPS56A37RPAR")}
        footprint={dnpFootprint}
        pinLabels={{
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
        }}
      />
      <chip
        name="L_V5_BUCK"
        manufacturerPartNumber="744325330"
        {...manufacturerFootprintProps("744325330")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "SW", pin2: "V5" }}
      />
      <chip
        name="U_APP_REGULATOR"
        manufacturerPartNumber="LMR43620MSC3RPERQ1"
        {...manufacturerFootprintProps("LMR43620MSC3RPERQ1")}
        footprint={dnpFootprint}
        pinLabels={{
          pin1: "MODE_SYNC",
          pin2: "PGOOD",
          pin3: "EN_UVLO",
          pin4: "VIN",
          pin5: "SW",
          pin6: "BOOT",
          pin7: "VCC",
          pin8: "VOUT_FB",
          pin9: "APP_GND"
        }}
      />
      <chip
        name="L_APP_REGULATOR"
        manufacturerPartNumber="XGL4030-222MEC"
        {...manufacturerFootprintProps("XGL4030-222MEC")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "SW", pin2: "APP_3V3" }}
      />

      <chip
        name="J_LINK_INPUT"
        manufacturerPartNumber="39-28-1023"
        doNotPlace
        footprint={dnpFootprint}
        pinLabels={{ pin1: "V20_TO_V5_BUCK", pin2: "V20_BUCK_INPUT" }}
      />
      <chip
        name="J_LINK_APPLICATION"
        manufacturerPartNumber="39-28-1023"
        doNotPlace
        footprint={dnpFootprint}
        pinLabels={{ pin1: "V5", pin2: "V5_APPLICATION" }}
      />
      <chip
        name="J_LINK_SCORING"
        manufacturerPartNumber="39-28-1023"
        doNotPlace
        footprint={dnpFootprint}
        pinLabels={{ pin1: "V5", pin2: "V5_ANALOG" }}
      />

      <chip
        name="J_USB2_SERVICE"
        manufacturerPartNumber="HSEC8-113-01-L-DV-A-L2"
        doNotPlace
        footprint={dnpFootprint}
        pinLabels={{ pin1: "USB_DN", pin2: "USB_DP", pin3: "CHASSIS" }}
      />

      <capacitor
        name="C_USB_PORT_PROTECT_BIAS"
        manufacturerPartNumber="GCM188R71H104KA57D"
        capacitance="100nF"
        footprint="0603"
      />
      <capacitor
        name="C_USB_PORT_PROTECT_VPWR"
        manufacturerPartNumber="GCM188R71H105KA64D"
        capacitance="1uF"
        footprint="0603"
      />
      <capacitor
        name="C_USB_PD_LDO_1V5"
        manufacturerPartNumber="GRM21BR71A106KA73K"
        capacitance="10uF"
        footprint="0805"
      />
      <capacitor
        name="C_USB_PD_VIN_3V3"
        manufacturerPartNumber="GRM21BR71A106KA73K"
        capacitance="10uF"
        footprint="0805"
      />
      <capacitor
        name="C_USB_PD_VBUS"
        manufacturerPartNumber="GRM21BR71H475KA73L"
        capacitance="4.7uF"
        footprint="0805"
      />
      <chip
        name="C_USB_PD_LDO"
        manufacturerPartNumber="T55A106M010C0200"
        {...manufacturerFootprintProps("T55A106M010C0200")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "LDO_3V3", pin2: "GND" }}
      />
      <chip
        name="C_USB_PD_PPHV"
        manufacturerPartNumber="T523H107M035APE070"
        {...manufacturerFootprintProps("T523H107M035APE070")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "PD_PPHV_20V", pin2: "GND" }}
      />
      <capacitor name="C_USB_PD_CC1" manufacturerPartNumber="GCM1555C1H331JA16D" capacitance="330pF" footprint="0402" />
      <capacitor name="C_USB_PD_CC2" manufacturerPartNumber="GCM1555C1H331JA16D" capacitance="330pF" footprint="0402" />
      <capacitor name="C_EFUSE_IN" manufacturerPartNumber="GCM188R71H104KA57D" capacitance="100nF" footprint="0603" />
      <capacitor name="C_EFUSE_ITIMER" manufacturerPartNumber="C0603C222K5RACTU" capacitance="2.2nF" footprint="0603" />
      <capacitor name="C_EFUSE_DVDT" manufacturerPartNumber="C0603C222K5RACTU" capacitance="2.2nF" footprint="0603" />
      <chip
        name="C_EFUSE_OUT"
        manufacturerPartNumber="T523H107M035APE070"
        {...manufacturerFootprintProps("T523H107M035APE070")}
        footprint={dnpFootprint}
        pinLabels={{ pin1: "V20_TO_V5_BUCK", pin2: "GND" }}
      />

      {(
        [
          ["R_USB_PD_ADCIN1_UP", "RC0402FR-0724K9L", 24_900],
          ["R_USB_PD_ADCIN1_DOWN", "RC0402FR-0710KL", 10_000],
          ["R_USB_PD_ADCIN2_UP", "RC0402FR-0710KL", 10_000],
          ["R_USB_PD_ADCIN2_DOWN", "RC0402FR-0768K1L", 68_100],
          ["R_USB_PD_ADCIN3_UP", "RC0402FR-07162KL", 162_000],
          ["R_USB_PD_ADCIN3_DOWN", "RC0402FR-0738K3L", 38_300],
          ["R_USB_PD_ADCIN4_UP", "RC0402FR-07191KL", 191_000],
          ["R_USB_PD_ADCIN4_DOWN", "RC0402FR-079K53L", 9_530]
        ] as const
      ).map(([name, manufacturerPartNumber, resistance]) => (
        <resistor
          key={name}
          name={name}
          manufacturerPartNumber={manufacturerPartNumber}
          resistance={resistance}
          tolerance="1%"
          footprint="0402"
        />
      ))}
      <resistor
        name="R_USB_PD_PD5VMAX"
        manufacturerPartNumber="RC0402FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_USB_PD_RESERVED_26"
        manufacturerPartNumber="RC0402FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_USB_PD_RESERVED_36"
        manufacturerPartNumber="RC0402FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_USB_PORT_PROTECT_FLT_PULLUP"
        manufacturerPartNumber="RC0402FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_USB_DN_SERIES"
        manufacturerPartNumber="RC0402FR-0722RL"
        resistance="22"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_USB_DP_SERIES"
        manufacturerPartNumber="RC0402FR-0722RL"
        resistance="22"
        tolerance="1%"
        footprint="0402"
      />
      <resistor
        name="R_EFUSE_UVLO_UP"
        manufacturerPartNumber="RC0603FR-07475KL"
        resistance="475k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_EFUSE_UVLO_DOWN"
        manufacturerPartNumber="RC0603FR-0738K3L"
        resistance="38.3k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_EFUSE_OVLO_UP"
        manufacturerPartNumber="RC0603FR-07499KL"
        resistance="499k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_EFUSE_OVLO_DOWN"
        manufacturerPartNumber="RC0603FR-0728K7L"
        resistance="28.7k"
        tolerance="1%"
        footprint="0603"
      />
      <resistor
        name="R_EFUSE_ILM"
        manufacturerPartNumber="RC0603FR-071K24L"
        resistance="1.24k"
        tolerance="1%"
        footprint="0603"
      />

      <capacitor
        name="C_V5_BUCK_IN_A"
        manufacturerPartNumber="GRM32ER7YA106KA12L"
        capacitance="10uF"
        footprint="1210"
      />
      <capacitor
        name="C_V5_BUCK_IN_B"
        manufacturerPartNumber="GRM32ER7YA106KA12L"
        capacitance="10uF"
        footprint="1210"
      />
      <capacitor name="C_V5_BUCK_IN_HF" manufacturerPartNumber="885012206095" capacitance="100nF" footprint="0603" />
      <capacitor name="C_V5_BUCK_BOOT" manufacturerPartNumber="885012206095" capacitance="100nF" footprint="0603" />
      <capacitor
        name="C_V5_BUCK_OUT_A"
        manufacturerPartNumber="GRM32ER71E226KE15L"
        capacitance="22uF"
        footprint="1210"
      />
      <capacitor
        name="C_V5_BUCK_OUT_B"
        manufacturerPartNumber="GRM32ER71E226KE15L"
        capacitance="22uF"
        footprint="1210"
      />
      <capacitor name="C_V5_BUCK_FF" manufacturerPartNumber="GRM1885C1H151JA01D" capacitance="150pF" footprint="0603" />
      <resistor
        name="R_V5_BUCK_MODE"
        manufacturerPartNumber="RT0603DRE0752K3L"
        resistance="52.3k"
        tolerance="0.5%"
        footprint="0603"
      />
      <resistor
        name="R_V5_BUCK_FB_TOP"
        manufacturerPartNumber="RT0603DRE0773K2L"
        resistance="73.2k"
        tolerance="0.5%"
        footprint="0603"
      />
      <resistor
        name="R_V5_BUCK_FB_BOTTOM"
        manufacturerPartNumber="RT0603DRE0710KL"
        resistance="10k"
        tolerance="0.5%"
        footprint="0603"
      />
      <resistor
        name="R_V5_BUCK_FF"
        manufacturerPartNumber="RT0603DRE0749R9L"
        resistance="49.9"
        tolerance="0.5%"
        footprint="0603"
      />

      <capacitor
        name="C_APP_REG_IN"
        manufacturerPartNumber="C2012X7R1E475K125AB"
        capacitance="4.7uF"
        footprint="0805"
      />
      <capacitor
        name="C_APP_REG_IN_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <capacitor name="C_APP_REG_BOOT" manufacturerPartNumber="C0603C104K3RACTU" capacitance="100nF" footprint="0603" />
      <capacitor name="C_APP_REG_VCC" manufacturerPartNumber="885012206052" capacitance="1uF" footprint="0603" />
      <capacitor
        name="C_APP_REG_OUT_A"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        capacitance="22uF"
        footprint="0805"
      />
      <capacitor
        name="C_APP_REG_OUT_B"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        capacitance="22uF"
        footprint="0805"
      />
      <capacitor
        name="C_APP_REG_OUT_C"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        capacitance="22uF"
        footprint="0805"
      />
      <resistor
        name="R_APP_REG_DISCHARGE"
        manufacturerPartNumber="RC0603FR-071KL"
        resistance="1k"
        tolerance="1%"
        footprint="0603"
      />

      <pinheader name="TP_USB_VBUS_PORT" pinCount={1} pinLabels={["VBUS_PORT"]} />
      <pinheader name="TP_PD_PPHV" pinCount={1} pinLabels={["PD_PPHV_20V"]} />
      <pinheader name="TP_PD_EFUSE_OUT" pinCount={1} pinLabels={["V20_TO_V5_BUCK"]} />
      <pinheader name="TP_V5" pinCount={1} pinLabels={["V5"]} />
      <pinheader name="TP_APP_3V3" pinCount={1} pinLabels={["APP_3V3"]} />
      <pinheader name="TP_SCORING_REFERENCE" pinCount={1} pinLabels={["V5_ANALOG"]} />

      <trace from="J_BP033_USB_C.CC1" to="U_BP033_TPD4S201TRGRRQ1.C_CC1" />
      <trace from="J_BP033_USB_C.CC2" to="U_BP033_TPD4S201TRGRRQ1.C_CC2" />
      <trace from="J_BP033_USB_C.SBU1" to="U_BP033_TPD4S201TRGRRQ1.C_SBU1" />
      <trace from="J_BP033_USB_C.SBU2" to="U_BP033_TPD4S201TRGRRQ1.C_SBU2" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.CC1" to="U_BP033_USB_PD.28" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.CC2" to="U_BP033_USB_PD.29" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.RPD_G1" to="J_BP033_USB_C.CC1" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.RPD_G2" to="J_BP033_USB_C.CC2" />
      <trace from="J_BP033_USB_C.Dp1" to="U_BP033_TPD2EUSB30DRTR.pin1" />
      <trace from="J_BP033_USB_C.Dp2" to="U_BP033_TPD2EUSB30DRTR.pin1" />
      <trace from="J_BP033_USB_C.Dn1" to="U_BP033_TPD2EUSB30DRTR.pin2" />
      <trace from="J_BP033_USB_C.Dn2" to="U_BP033_TPD2EUSB30DRTR.pin2" />
      <trace from="J_BP033_USB_C.Dp1" to="R_USB_DP_SERIES.pin1" />
      <trace from="R_USB_DP_SERIES.pin2" to="J_USB2_SERVICE.USB_DP" />
      <trace from="J_BP033_USB_C.Dn1" to="R_USB_DN_SERIES.pin1" />
      <trace from="R_USB_DN_SERIES.pin2" to="J_USB2_SERVICE.USB_DN" />
      <trace from="U_BP033_TPD2EUSB30DRTR.GND" to="net.GND" />
      <trace from="J_USB2_SERVICE.CHASSIS" to="net.CHASSIS" />
      <trace from="J_BP033_USB_C.GND" to="net.GND" />
      {(["32", "33", "23", "24", "25"] as const).map((pin) => (
        <trace key={pin} from="J_BP033_USB_C.VBUS" to={`U_BP033_USB_PD.${pin}`} />
      ))}
      <trace from="J_BP033_USB_C.VBUS" to="D_BP033_VBUS_TVS.4" />
      <trace from="J_BP033_USB_C.VBUS" to="D_BP033_VBUS_TVS.5" />
      <trace from="J_BP033_USB_C.VBUS" to="D_BP033_VBUS_TVS.6" />
      {(["1", "2", "3", "7"] as const).map((pin) => (
        <trace key={pin} from={`D_BP033_VBUS_TVS.${pin}`} to="net.GND" />
      ))}
      <trace from="D_USB_PD_VBUS_DISCONNECT.CATHODE_VBUS" to="J_BP033_USB_C.VBUS" />
      <trace from="D_USB_PD_VBUS_DISCONNECT.ANODE_GND" to="net.GND" />
      <trace from="J_BP033_USB_C.VBUS" to="TP_USB_VBUS_PORT.VBUS_PORT" />

      <trace from="U_BP033_TPD4S201TRGRRQ1.VBIAS" to="C_USB_PORT_PROTECT_BIAS.pin1" />
      <trace from="C_USB_PORT_PROTECT_BIAS.pin2" to="net.GND" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.VPWR" to="U_BP033_USB_PD.1" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.VPWR" to="C_USB_PORT_PROTECT_VPWR.pin1" />
      <trace from="C_USB_PORT_PROTECT_VPWR.pin2" to="net.GND" />
      {(["GND_8", "GND_13", "GND_18", "THERMAL_GND"] as const).map((pin) => (
        <trace key={pin} from={`U_BP033_TPD4S201TRGRRQ1.${pin}`} to="net.GND" />
      ))}
      <trace from="U_BP033_TPD4S201TRGRRQ1.FLT_N" to="U_BP033_USB_PD.18" />
      <trace from="U_BP033_TPD4S201TRGRRQ1.FLT_N" to="R_USB_PORT_PROTECT_FLT_PULLUP.pin1" />
      <trace from="R_USB_PORT_PROTECT_FLT_PULLUP.pin2" to="U_BP033_USB_PD.1" />
      <trace from="U_BP033_USB_PD.1" to="U_BP033_USB_PD.38" />
      <trace from="U_BP033_USB_PD.1" to="C_USB_PD_LDO.LDO_3V3" />
      <trace from="C_USB_PD_LDO.GND" to="net.GND" />
      <trace from="U_BP033_USB_PD.38" to="C_USB_PD_VIN_3V3.pin1" />
      <trace from="C_USB_PD_VIN_3V3.pin2" to="net.GND" />
      <trace from="U_BP033_USB_PD.4" to="C_USB_PD_LDO_1V5.pin1" />
      <trace from="C_USB_PD_LDO_1V5.pin2" to="net.GND" />
      <trace from="J_BP033_USB_C.VBUS" to="C_USB_PD_VBUS.pin1" />
      <trace from="C_USB_PD_VBUS.pin2" to="net.GND" />
      <trace from="U_BP033_USB_PD.28" to="C_USB_PD_CC1.pin1" />
      <trace from="U_BP033_USB_PD.29" to="C_USB_PD_CC2.pin1" />
      <trace from="C_USB_PD_CC1.pin2" to="net.GND" />
      <trace from="C_USB_PD_CC2.pin2" to="net.GND" />
      {(["20", "21", "22"] as const).map((pin) => (
        <trace key={pin} from={`U_BP033_USB_PD.${pin}`} to="net.PD_PPHV_20V" />
      ))}
      <trace from="C_USB_PD_PPHV.PD_PPHV_20V" to="net.PD_PPHV_20V" />
      <trace from="C_USB_PD_PPHV.GND" to="net.GND" />
      <trace from="net.PD_PPHV_20V" to="TP_PD_PPHV.PD_PPHV_20V" />
      {(["10", "11", "12", "14", "16", "17", "31", "34", "35", "39"] as const).map((pin) => (
        <trace key={pin} from={`U_BP033_USB_PD.${pin}`} to="net.GND" />
      ))}
      {(["15", "30", "40"] as const).map((pin) => (
        <trace key={pin} from={`U_BP033_USB_PD.${pin}`} to="net.PD_DRAIN" />
      ))}
      {([1, 2, 3, 4] as const).map((channel) => (
        <group key={channel}>
          <trace from={`U_BP033_USB_PD.${channel + 1}`} to={`R_USB_PD_ADCIN${channel}_UP.pin2`} />
          <trace from={`U_BP033_USB_PD.${channel + 1}`} to={`R_USB_PD_ADCIN${channel}_DOWN.pin1`} />
          <trace from={`R_USB_PD_ADCIN${channel}_UP.pin1`} to="U_BP033_USB_PD.1" />
          <trace from={`R_USB_PD_ADCIN${channel}_DOWN.pin2`} to="net.GND" />
        </group>
      ))}
      <trace from="U_BP033_USB_PD.27" to="R_USB_PD_PD5VMAX.pin1" />
      <trace from="R_USB_PD_PD5VMAX.pin2" to="net.GND" />
      <trace from="U_BP033_USB_PD.26" to="R_USB_PD_RESERVED_26.pin1" />
      <trace from="R_USB_PD_RESERVED_26.pin2" to="net.GND" />
      <trace from="U_BP033_USB_PD.36" to="R_USB_PD_RESERVED_36.pin1" />
      <trace from="R_USB_PD_RESERVED_36.pin2" to="net.GND" />

      <trace from="net.PD_PPHV_20V" to="BP033_TPS25947_REVIEW_ONLY.IN" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.IN" to="C_EFUSE_IN.pin1" />
      <trace from="C_EFUSE_IN.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.pin1" to="R_EFUSE_UVLO_UP.pin2" />
      <trace from="R_EFUSE_UVLO_UP.pin1" to="net.PD_PPHV_20V" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.pin1" to="R_EFUSE_UVLO_DOWN.pin1" />
      <trace from="R_EFUSE_UVLO_DOWN.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.OVLO" to="R_EFUSE_OVLO_UP.pin2" />
      <trace from="R_EFUSE_OVLO_UP.pin1" to="net.PD_PPHV_20V" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.OVLO" to="R_EFUSE_OVLO_DOWN.pin1" />
      <trace from="R_EFUSE_OVLO_DOWN.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.ILM" to="R_EFUSE_ILM.pin1" />
      <trace from="R_EFUSE_ILM.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.ITIMER" to="C_EFUSE_ITIMER.pin1" />
      <trace from="C_EFUSE_ITIMER.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.DVDT" to="C_EFUSE_DVDT.pin1" />
      <trace from="C_EFUSE_DVDT.pin2" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.GND" to="net.GND" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.OUT" to="C_EFUSE_OUT.V20_TO_V5_BUCK" />
      <trace from="BP033_TPS25947_REVIEW_ONLY.OUT" to="J_LINK_INPUT.V20_TO_V5_BUCK" />
      <trace from="J_LINK_INPUT.V20_TO_V5_BUCK" to="TP_PD_EFUSE_OUT.V20_TO_V5_BUCK" />

      <trace from="J_LINK_INPUT.V20_BUCK_INPUT" to="U_V5_BUCK.VIN" />
      <trace from="U_V5_BUCK.VIN" to="U_V5_BUCK.EN" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_A.pin1" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_B.pin1" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_HF.pin1" />
      {(["C_V5_BUCK_IN_A", "C_V5_BUCK_IN_B", "C_V5_BUCK_IN_HF"] as const).map((name) => (
        <trace key={name} from={`${name}.pin2`} to="net.GND" />
      ))}
      <trace from="U_V5_BUCK.MODE" to="R_V5_BUCK_MODE.pin1" />
      <trace from="R_V5_BUCK_MODE.pin2" to="net.GND" />
      <trace from="U_V5_BUCK.BOOT" to="C_V5_BUCK_BOOT.pin1" />
      <trace from="C_V5_BUCK_BOOT.pin2" to="U_V5_BUCK.SW" />
      <trace from="U_V5_BUCK.SW" to="L_V5_BUCK.SW" />
      <trace from="L_V5_BUCK.V5" to="net.V5" />
      <trace from="U_V5_BUCK.AGND" to="net.GND" />
      <trace from="U_V5_BUCK.PGND" to="net.GND" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_TOP.pin2" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_BOTTOM.pin1" />
      <trace from="R_V5_BUCK_FB_TOP.pin1" to="net.V5" />
      <trace from="R_V5_BUCK_FB_BOTTOM.pin2" to="net.GND" />
      <trace from="net.V5" to="R_V5_BUCK_FF.pin1" />
      <trace from="R_V5_BUCK_FF.pin2" to="C_V5_BUCK_FF.pin1" />
      <trace from="C_V5_BUCK_FF.pin2" to="U_V5_BUCK.FB" />
      {(["C_V5_BUCK_OUT_A", "C_V5_BUCK_OUT_B"] as const).map((name) => (
        <group key={name}>
          <trace from={`net.V5`} to={`${name}.pin1`} />
          <trace from={`${name}.pin2`} to="net.GND" />
        </group>
      ))}
      <trace from="net.V5" to="TP_V5.V5" />
      <trace from="net.V5" to="J_LINK_APPLICATION.V5" />
      <trace from="net.V5" to="J_LINK_SCORING.V5" />

      <trace from="J_LINK_APPLICATION.V5_APPLICATION" to="U_APP_REGULATOR.VIN" />
      <trace from="U_APP_REGULATOR.VIN" to="U_APP_REGULATOR.EN_UVLO" />
      <trace from="U_APP_REGULATOR.VIN" to="C_APP_REG_IN.pin1" />
      <trace from="U_APP_REGULATOR.VIN" to="C_APP_REG_IN_HF.pin1" />
      <trace from="C_APP_REG_IN.pin2" to="net.GND" />
      <trace from="C_APP_REG_IN_HF.pin2" to="net.GND" />
      <trace from="U_APP_REGULATOR.MODE_SYNC" to="U_APP_REGULATOR.VCC" />
      <trace from="U_APP_REGULATOR.VCC" to="C_APP_REG_VCC.pin1" />
      <trace from="C_APP_REG_VCC.pin2" to="net.GND" />
      <trace from="U_APP_REGULATOR.BOOT" to="C_APP_REG_BOOT.pin1" />
      <trace from="C_APP_REG_BOOT.pin2" to="U_APP_REGULATOR.SW" />
      <trace from="U_APP_REGULATOR.SW" to="L_APP_REGULATOR.SW" />
      <trace from="L_APP_REGULATOR.APP_3V3" to="net.APP_3V3" />
      <trace from="U_APP_REGULATOR.VOUT_FB" to="net.APP_3V3" />
      <trace from="U_APP_REGULATOR.APP_GND" to="net.GND" />
      {(["A", "B", "C"] as const).map((suffix) => (
        <group key={suffix}>
          <trace from="net.APP_3V3" to={`C_APP_REG_OUT_${suffix}.pin1`} />
          <trace from={`C_APP_REG_OUT_${suffix}.pin2`} to="net.GND" />
        </group>
      ))}
      <trace from="net.APP_3V3" to="R_APP_REG_DISCHARGE.pin1" />
      <trace from="R_APP_REG_DISCHARGE.pin2" to="net.GND" />
      <trace from="net.APP_3V3" to="TP_APP_3V3.APP_3V3" />
      <trace from="J_LINK_SCORING.V5_ANALOG" to="net.V5_ANALOG" />
      <trace from="J_LINK_SCORING.V5_ANALOG" to="TP_SCORING_REFERENCE.V5_ANALOG" />
    </group>
  )
}

export default P0UsbPower
