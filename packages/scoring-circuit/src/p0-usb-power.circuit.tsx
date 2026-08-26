import type { ReactElement } from "react"
import { Bp033Tpd2eusb30drtrDrtProjectFootprint } from "./bp033-tpd2eusb30drtr-drt-project-footprint.js"
import { Bp033Tpd4s201RgrProjectFootprint } from "./bp033-tpd4s201-rgr-project-footprint.js"
import { Bp033Tps25730aRefProjectFootprint } from "./bp033-tps25730a-ref-project-footprint.js"
import { Bp033Tps25947ProjectFootprint } from "./bp033-tps25947-project-footprint.js"
import { Bp033Tvs2200ProjectFootprint } from "./bp033-tvs2200-project-footprint.js"
import { Bp033UsbCProjectFootprint } from "./bp033-usb-c-project-footprint.js"
import {
  P0ApplicationInductorFootprint,
  P0B340aFootprint,
  P0Lmr43620Footprint,
  P0T523H107EfuseOutputFootprint,
  P0T523H107Footprint,
  P0T55A106Footprint,
  P0Tps56a37Footprint,
  P0V5InductorFootprint
} from "./p0-usb-power-footprints.js"

/**
 * P0's USB-C-only, sink-only power input. This is a connectivity and
 * review-footprint block, not a fabrication release. All reviewed
 * manufacturer footprints remain explicitly non-placeable through their
 * existing project components or the footprint adapter.
 */
export type P0UsbPowerProps = {
  readonly pcbX: number
  readonly pcbY: number
}

type GlobalPcbPoint = readonly [number, number]

/**
 * `pcbPath` point objects are local to the first component in a trace. Keep
 * the reviewed board-space waypoints readable here, then translate them to
 * that component frame for tscircuit.
 */
function localPcbPath(origin: GlobalPcbPoint, points: readonly GlobalPcbPoint[]) {
  return points.map(([x, y]) => ({ x: x - origin[0], y: y - origin[1] }))
}

const adcPcbRoute = {
  1: { corridorX: -132.3, routeY: 21.8, sourceY: 35.6 },
  2: { corridorX: -133, routeY: 28, sourceY: 35.2 },
  3: { corridorX: -133.7, routeY: 41.8, sourceY: 34.8 },
  4: { corridorX: -134.4, routeY: 45.8, sourceY: 34.4 }
} as const

function usbPdAdcPcbPath(channel: 1 | 2 | 3 | 4, targetX: number) {
  const { corridorX, routeY, sourceY } = adcPcbRoute[channel]
  return localPcbPath(
    [-127, 35],
    [
      [corridorX, sourceY],
      [corridorX, routeY],
      [targetX, routeY]
    ]
  )
}

function P0UsbPower({ pcbX, pcbY }: P0UsbPowerProps): ReactElement {
  return (
    <group name="P0_USB_POWER" pcbX={0} pcbY={0} pcbRelative pcbPositionMode="relative_to_board_anchor" pcbPack={false}>
      <Bp033UsbCProjectFootprint
        name="J_USB_C"
        pcbX={pcbX - 62}
        pcbY={pcbY}
        pcbPositionMode="relative_to_board_anchor"
      />
      <group name="POWER_SUPPORT" pcbX={pcbX + 15} pcbY={pcbY} pcbPack={false}>
        {/* The source traces leave this island in the same order as the power path: */}
        {/* USB entry/protection, PD contract, reverse blocking, V5, then APP_3V3. */}
        <Bp033Tpd4s201RgrProjectFootprint name="U_USB_PORT_PROTECT" pcbX={-54} pcbY={0} />
        <Bp033Tpd2eusb30drtrDrtProjectFootprint name="U_USB_DATA_PROTECT" pcbX={-54} pcbY={-8} />
        <Bp033Tvs2200ProjectFootprint name="D_USB_PD_VBUS_TVS" pcbX={-54} pcbY={8} />
        <Bp033Tps25730aRefProjectFootprint name="U_USB_PD" pcbX={-38} pcbY={0} />
        <Bp033Tps25947ProjectFootprint name="U_EFUSE" pcbX={-8} pcbY={0} />

        <P0B340aFootprint pcbX={-54} pcbY={16} />
        <P0Tps56a37Footprint pcbX={24} pcbY={0} />
        <P0V5InductorFootprint pcbX={31} pcbY={0} />
        <P0Lmr43620Footprint pcbX={57} pcbY={0} />
        <P0ApplicationInductorFootprint pcbX={65} pcbY={0} />

        <capacitor
          name="C_USB_PORT_PROTECT_BIAS"
          manufacturerPartNumber="GCM188R71H104KA57D"
          capacitance="100nF"
          footprint="0603"
          pcbX={-47}
          pcbY={-5}
        />
        <capacitor
          name="C_USB_PORT_PROTECT_VPWR"
          manufacturerPartNumber="GCM188R71H105KA64D"
          capacitance="1uF"
          footprint="0603"
          pcbX={-47}
          pcbY={5}
        />
        <capacitor
          name="C_USB_PD_LDO_1V5"
          manufacturerPartNumber="GRM21BR71A106KA73K"
          capacitance="10uF"
          footprint="0805"
          pcbX={-38}
          pcbY={8}
        />
        <capacitor
          name="C_USB_PD_VIN_3V3"
          manufacturerPartNumber="GRM21BR71A106KA73K"
          capacitance="10uF"
          footprint="0805"
          pcbX={-30}
          pcbY={-8}
        />
        <capacitor
          name="C_USB_PD_VBUS"
          manufacturerPartNumber="GRM21BR71H475KA73L"
          capacitance="4.7uF"
          footprint="0805"
          pcbX={-30}
          pcbY={8}
        />
        <P0T55A106Footprint pcbX={-46} pcbY={12} />
        <P0T523H107Footprint pcbX={-29} pcbY={15} />
        <capacitor
          name="C_USB_PD_CC1"
          manufacturerPartNumber="GCM1555C1H331JA16D"
          capacitance="330pF"
          footprint="0402"
          pcbX={-47}
          pcbY={-12}
        />
        <capacitor
          name="C_USB_PD_CC2"
          manufacturerPartNumber="GCM1555C1H331JA16D"
          capacitance="330pF"
          footprint="0402"
          pcbX={-42}
          pcbY={-12}
        />
        <capacitor
          name="C_EFUSE_IN"
          manufacturerPartNumber="GCM188R71H104KA57D"
          capacitance="100nF"
          footprint="0603"
          pcbX={-2}
          pcbY={-5}
        />
        <capacitor
          name="C_EFUSE_ITIMER"
          manufacturerPartNumber="C0603C222K5RACTU"
          capacitance="2.2nF"
          footprint="0603"
          pcbX={-2}
          pcbY={5}
        />
        <capacitor
          name="C_EFUSE_DVDT"
          manufacturerPartNumber="C0603C222K5RACTU"
          capacitance="2.2nF"
          footprint="0603"
          pcbX={5}
          pcbY={5}
        />
        <P0T523H107EfuseOutputFootprint pcbX={5} pcbY={-5} />

        {(
          [
            ["R_USB_PD_ADCIN1_UP", "RC0402FR-0724K9L", 24_900, -22, -12],
            ["R_USB_PD_ADCIN1_DOWN", "RC0402FR-0710KL", 10_000, -16, -12],
            ["R_USB_PD_ADCIN2_UP", "RC0402FR-0710KL", 10_000, -22, -8],
            ["R_USB_PD_ADCIN2_DOWN", "RC0402FR-0768K1L", 68_100, -16, -8],
            ["R_USB_PD_ADCIN3_UP", "RC0402FR-07162KL", 162_000, -22, 8],
            ["R_USB_PD_ADCIN3_DOWN", "RC0402FR-0738K3L", 38_300, -16, 8],
            ["R_USB_PD_ADCIN4_UP", "RC0402FR-07191KL", 191_000, -22, 12],
            ["R_USB_PD_ADCIN4_DOWN", "RC0402FR-079K53L", 9_530, -16, 12]
          ] as const
        ).map(([name, manufacturerPartNumber, resistance, pcbX, pcbY]) => (
          <resistor
            key={name}
            name={name}
            manufacturerPartNumber={manufacturerPartNumber}
            resistance={resistance}
            tolerance="1%"
            footprint="0402"
            pcbX={pcbX}
            pcbY={pcbY}
          />
        ))}
        <resistor
          name="R_USB_PD_PD5VMAX"
          manufacturerPartNumber="RC0402FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0402"
          pcbX={-22}
          pcbY={16}
        />
        <resistor
          name="R_USB_PD_RESERVED_26"
          manufacturerPartNumber="RC0402FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0402"
          pcbX={-16}
          pcbY={16}
        />
        <resistor
          name="R_USB_PD_RESERVED_36"
          manufacturerPartNumber="RC0402FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0402"
          pcbX={-10}
          pcbY={16}
        />
        <resistor
          name="R_USB_PORT_PROTECT_FLT_PULLUP"
          manufacturerPartNumber="RC0402FR-0710KL"
          resistance="10k"
          tolerance="1%"
          footprint="0402"
          pcbX={-47}
          pcbY={-16}
        />
        <resistor
          name="R_USB_DN_SERIES"
          manufacturerPartNumber="RC0402FR-0722RL"
          resistance="22"
          tolerance="1%"
          footprint="0402"
          pcbX={-61}
          pcbY={-8}
        />
        <resistor
          name="R_USB_DP_SERIES"
          manufacturerPartNumber="RC0402FR-0722RL"
          resistance="22"
          tolerance="1%"
          footprint="0402"
          pcbX={-61}
          pcbY={-14}
        />
        <resistor
          name="R_EFUSE_UVLO_UP"
          manufacturerPartNumber="RC0603FR-07475KL"
          resistance="475k"
          tolerance="1%"
          footprint="0603"
          pcbX={-2}
          pcbY={-12}
        />
        <resistor
          name="R_EFUSE_UVLO_DOWN"
          manufacturerPartNumber="RC0603FR-0738K3L"
          resistance="38.3k"
          tolerance="1%"
          footprint="0603"
          pcbX={5}
          pcbY={-12}
        />
        <resistor
          name="R_EFUSE_OVLO_UP"
          manufacturerPartNumber="RC0603FR-07499KL"
          resistance="499k"
          tolerance="1%"
          footprint="0603"
          pcbX={-2}
          pcbY={12}
        />
        <resistor
          name="R_EFUSE_OVLO_DOWN"
          manufacturerPartNumber="RC0603FR-0728K7L"
          resistance="28.7k"
          tolerance="1%"
          footprint="0603"
          pcbX={5}
          pcbY={12}
        />
        <resistor
          name="R_EFUSE_ILM"
          manufacturerPartNumber="RC0603FR-071K24L"
          resistance="1.24k"
          tolerance="1%"
          footprint="0603"
          pcbX={10}
          pcbY={0}
        />

        <capacitor
          name="C_V5_BUCK_IN_A"
          manufacturerPartNumber="GRM32ER7YA106KA12L"
          capacitance="10uF"
          footprint="1210"
          pcbX={13}
          pcbY={-7}
        />
        <capacitor
          name="C_V5_BUCK_IN_B"
          manufacturerPartNumber="GRM32ER7YA106KA12L"
          capacitance="10uF"
          footprint="1210"
          pcbX={19}
          pcbY={-7}
        />
        <capacitor
          name="C_V5_BUCK_IN_HF"
          manufacturerPartNumber="885012206095"
          capacitance="100nF"
          footprint="0603"
          pcbX={25}
          pcbY={-7}
        />
        <capacitor
          name="C_V5_BUCK_BOOT"
          manufacturerPartNumber="885012206095"
          capacitance="100nF"
          footprint="0603"
          pcbX={31}
          pcbY={7}
        />
        <capacitor
          name="C_V5_BUCK_OUT_A"
          manufacturerPartNumber="GRM32ER71E226KE15L"
          capacitance="22uF"
          footprint="1210"
          pcbX={37}
          pcbY={-7}
        />
        <capacitor
          name="C_V5_BUCK_OUT_B"
          manufacturerPartNumber="GRM32ER71E226KE15L"
          capacitance="22uF"
          footprint="1210"
          pcbX={44}
          pcbY={-7}
        />
        <capacitor
          name="C_V5_BUCK_FF"
          manufacturerPartNumber="GRM1885C1H151JA01D"
          capacitance="150pF"
          footprint="0603"
          pcbX={49}
          pcbY={7}
        />
        <resistor
          name="R_V5_BUCK_MODE"
          manufacturerPartNumber="RT0603DRE0752K3L"
          resistance="52.3k"
          tolerance="0.5%"
          footprint="0603"
          pcbX={19}
          pcbY={7}
        />
        <resistor
          name="R_V5_BUCK_FB_TOP"
          manufacturerPartNumber="RT0603DRE0773K2L"
          resistance="73.2k"
          tolerance="0.5%"
          footprint="0603"
          pcbX={37}
          pcbY={7}
        />
        <resistor
          name="R_V5_BUCK_FB_BOTTOM"
          manufacturerPartNumber="RT0603DRE0710KL"
          resistance="10k"
          tolerance="0.5%"
          footprint="0603"
          pcbX={43}
          pcbY={7}
        />
        <resistor
          name="R_V5_BUCK_FF"
          manufacturerPartNumber="RT0603DRE0749R9L"
          resistance="49.9"
          tolerance="0.5%"
          footprint="0603"
          pcbX={55}
          pcbY={7}
        />

        <capacitor
          name="C_APP_REG_IN"
          manufacturerPartNumber="C2012X7R1E475K125AB"
          capacitance="4.7uF"
          footprint="0805"
          pcbX={51}
          pcbY={-7}
        />
        <capacitor
          name="C_APP_REG_IN_HF"
          manufacturerPartNumber="C0603C104K3RACTU"
          capacitance="100nF"
          footprint="0603"
          pcbX={57}
          pcbY={-7}
        />
        <capacitor
          name="C_APP_REG_BOOT"
          manufacturerPartNumber="C0603C104K3RACTU"
          capacitance="100nF"
          footprint="0603"
          pcbX={63}
          pcbY={-7}
        />
        <capacitor
          name="C_APP_REG_VCC"
          manufacturerPartNumber="885012206052"
          capacitance="1uF"
          footprint="0603"
          pcbX={63}
          pcbY={7}
        />
        <capacitor
          name="C_APP_REG_OUT_A"
          manufacturerPartNumber="C2012X7S1A226M125AC"
          capacitance="22uF"
          footprint="0805"
          pcbX={51}
          pcbY={-13}
        />
        <capacitor
          name="C_APP_REG_OUT_B"
          manufacturerPartNumber="C2012X7S1A226M125AC"
          capacitance="22uF"
          footprint="0805"
          pcbX={57}
          pcbY={-13}
        />
        <capacitor
          name="C_APP_REG_OUT_C"
          manufacturerPartNumber="C2012X7S1A226M125AC"
          capacitance="22uF"
          footprint="0805"
          pcbX={63}
          pcbY={-13}
        />
        <resistor
          name="R_APP_REG_DISCHARGE"
          manufacturerPartNumber="RC0603FR-071KL"
          resistance="1k"
          tolerance="1%"
          footprint="0603"
          pcbX={69}
          pcbY={7}
        />

        <pinheader name="TP_USB_VBUS_PORT" pinCount={1} pinLabels={["VBUS_PORT"]} pcbX={-61} pcbY={2} />
        <pinheader name="TP_PD_PPHV" pinCount={1} pinLabels={["PD_PPHV_20V"]} pcbX={-29} pcbY={21} />
      </group>

      <pinheader
        name="TP_PD_EFUSE_OUT"
        pinCount={1}
        pinLabels={["V20_TO_V5_BUCK"]}
        pcbX={pcbX + 14}
        pcbY={pcbY - 58}
        pcbPositionMode="relative_to_board_anchor"
      />
      <pinheader
        name="TP_V5"
        pinCount={1}
        pinLabels={["V5"]}
        pcbX={pcbX + 22}
        pcbY={pcbY - 58}
        pcbPositionMode="relative_to_board_anchor"
      />
      <pinheader
        name="TP_APP_3V3"
        pinCount={1}
        pinLabels={["APP_3V3"]}
        pcbX={pcbX + 30}
        pcbY={pcbY - 58}
        pcbPositionMode="relative_to_board_anchor"
      />
      <pinheader
        name="TP_SCORING_REFERENCE"
        pinCount={1}
        pinLabels={["V5_ANALOG"]}
        pcbX={pcbX + 38}
        pcbY={pcbY - 58}
        pcbPositionMode="relative_to_board_anchor"
      />

      <trace from="J_USB_C.CC1" to="U_USB_PORT_PROTECT.C_CC1" />
      <trace from="J_USB_C.CC2" to="U_USB_PORT_PROTECT.C_CC2" />
      <trace from="J_USB_C.SBU1" to="U_USB_PORT_PROTECT.C_SBU1" />
      <trace from="J_USB_C.SBU2" to="U_USB_PORT_PROTECT.C_SBU2" />
      <trace from="U_USB_PORT_PROTECT.CC1" to="U_USB_PD.28" />
      <trace
        from="U_USB_PORT_PROTECT.CC2"
        to="U_USB_PD.29"
        pcbPath={localPcbPath(
          [-143, 35],
          [
            [-140.8, 34],
            [-140.8, 38],
            [-125.8, 38]
          ]
        )}
      />
      <trace from="U_USB_PORT_PROTECT.RPD_G1" to="J_USB_C.CC1" />
      <trace from="U_USB_PORT_PROTECT.RPD_G2" to="J_USB_C.CC2" />
      <trace from="J_USB_C.Dp1" to="U_USB_DATA_PROTECT.pin1" />
      <trace from="J_USB_C.Dp2" to="U_USB_DATA_PROTECT.pin1" />
      <trace from="J_USB_C.Dn1" to="U_USB_DATA_PROTECT.pin2" />
      <trace from="J_USB_C.Dn2" to="U_USB_DATA_PROTECT.pin2" />
      <trace from="J_USB_C.Dp1" to="R_USB_DP_SERIES.pin1" />
      <trace from="R_USB_DP_SERIES.pin2" to="net.USB_DP" />
      <trace from="J_USB_C.Dn1" to="R_USB_DN_SERIES.pin1" />
      <trace from="R_USB_DN_SERIES.pin2" to="net.USB_DN" />
      <trace from="U_USB_DATA_PROTECT.GND" to="net.APP_GND" />
      <trace from="J_USB_C.GND" to="net.APP_GND" />
      {(["32", "33", "23", "24", "25"] as const).map((pin) => (
        <trace key={pin} from="J_USB_C.VBUS" to={`U_USB_PD.${pin}`} />
      ))}
      <trace from="J_USB_C.VBUS" to="D_USB_PD_VBUS_TVS.4" />
      <trace from="J_USB_C.VBUS" to="D_USB_PD_VBUS_TVS.5" />
      <trace from="J_USB_C.VBUS" to="D_USB_PD_VBUS_TVS.6" />
      {(["1", "2", "3", "7"] as const).map((pin) => (
        <trace key={pin} from={`D_USB_PD_VBUS_TVS.${pin}`} to="net.APP_GND" />
      ))}
      <trace from="D_USB_PD_VBUS_DISCONNECT.CATHODE_VBUS" to="J_USB_C.VBUS" />
      <trace from="D_USB_PD_VBUS_DISCONNECT.ANODE_GND" to="net.APP_GND" />
      <trace from="J_USB_C.VBUS" to="TP_USB_VBUS_PORT.VBUS_PORT" />

      <trace from="U_USB_PORT_PROTECT.VBIAS" to="C_USB_PORT_PROTECT_BIAS.pin1" />
      <trace from="C_USB_PORT_PROTECT_BIAS.pin2" to="net.APP_GND" />
      <trace from="U_USB_PORT_PROTECT.VPWR" to="U_USB_PD.1" />
      <trace from="U_USB_PORT_PROTECT.VPWR" to="C_USB_PORT_PROTECT_VPWR.pin1" />
      <trace from="C_USB_PORT_PROTECT_VPWR.pin2" to="net.APP_GND" />
      {(["GND_8", "GND_13", "GND_18", "THERMAL_GND"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PORT_PROTECT.${pin}`} to="net.APP_GND" />
      ))}
      <trace from="U_USB_PORT_PROTECT.FLT_N" to="U_USB_PD.18" />
      <trace from="U_USB_PORT_PROTECT.FLT_N" to="R_USB_PORT_PROTECT_FLT_PULLUP.pin1" />
      <trace from="R_USB_PORT_PROTECT_FLT_PULLUP.pin2" to="U_USB_PD.1" />
      <trace from="U_USB_PD.1" to="U_USB_PD.38" />
      <trace from="U_USB_PD.1" to="C_USB_PD_LDO.LDO_3V3" />
      <trace from="C_USB_PD_LDO.GND" to="net.APP_GND" />
      <trace from="U_USB_PD.38" to="C_USB_PD_VIN_3V3.pin1" />
      <trace from="C_USB_PD_VIN_3V3.pin2" to="net.APP_GND" />
      <trace
        from="U_USB_PD.4"
        to="C_USB_PD_LDO_1V5.pin1"
        pcbPath={localPcbPath(
          [-127, 35],
          [
            [-131, 34.8],
            [-131, 41.8],
            [-127.9125, 41.8]
          ]
        )}
      />
      <trace from="C_USB_PD_LDO_1V5.pin2" to="net.APP_GND" />
      <trace from="J_USB_C.VBUS" to="C_USB_PD_VBUS.pin1" />
      <trace from="C_USB_PD_VBUS.pin2" to="net.APP_GND" />
      <trace from="U_USB_PD.28" to="C_USB_PD_CC1.pin1" />
      <trace
        from="U_USB_PD.29"
        to="C_USB_PD_CC2.pin1"
        pcbPath={localPcbPath(
          [-127, 35],
          [
            [-125.8, 38],
            [-132.4, 38],
            [-132.4, 21.8],
            [-131.51, 21.8]
          ]
        )}
      />
      <trace from="C_USB_PD_CC1.pin2" to="net.APP_GND" />
      <trace from="C_USB_PD_CC2.pin2" to="net.APP_GND" />
      {(["20", "21", "22"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PD.${pin}`} to="net.PD_PPHV_20V" />
      ))}
      <trace from="C_USB_PD_PPHV.PD_PPHV_20V" to="net.PD_PPHV_20V" />
      <trace from="C_USB_PD_PPHV.GND" to="net.APP_GND" />
      <trace from="net.PD_PPHV_20V" to="TP_PD_PPHV.PD_PPHV_20V" />
      {(["10", "11", "12", "14", "16", "17", "31", "34", "35", "39"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PD.${pin}`} to="net.APP_GND" />
      ))}
      {(["15", "30", "40"] as const).map((pin) => (
        <trace key={pin} from={`U_USB_PD.${pin}`} to="net.PD_DRAIN" />
      ))}
      {([1, 2, 3, 4] as const).map((channel) => (
        <group key={channel}>
          <trace
            from={`U_USB_PD.${channel + 1}`}
            to={`R_USB_PD_ADCIN${channel}_UP.pin2`}
            pcbPath={usbPdAdcPcbPath(channel, -110.49)}
          />
          <trace
            from={`U_USB_PD.${channel + 1}`}
            to={`R_USB_PD_ADCIN${channel}_DOWN.pin1`}
            pcbPath={usbPdAdcPcbPath(channel, -105.51)}
          />
          <trace from={`R_USB_PD_ADCIN${channel}_UP.pin1`} to="U_USB_PD.1" />
          <trace from={`R_USB_PD_ADCIN${channel}_DOWN.pin2`} to="net.APP_GND" />
        </group>
      ))}
      <trace from="U_USB_PD.27" to="R_USB_PD_PD5VMAX.pin1" />
      <trace from="R_USB_PD_PD5VMAX.pin2" to="net.APP_GND" />
      <trace from="U_USB_PD.26" to="R_USB_PD_RESERVED_26.pin1" />
      <trace from="R_USB_PD_RESERVED_26.pin2" to="net.APP_GND" />
      <trace from="U_USB_PD.36" to="R_USB_PD_RESERVED_36.pin1" />
      <trace from="R_USB_PD_RESERVED_36.pin2" to="net.APP_GND" />

      <trace from="net.PD_PPHV_20V" to="U_EFUSE.IN" />
      <trace from="U_EFUSE.IN" to="C_EFUSE_IN.pin1" />
      <trace from="C_EFUSE_IN.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.pin1" to="R_EFUSE_UVLO_UP.pin2" />
      <trace from="R_EFUSE_UVLO_UP.pin1" to="net.PD_PPHV_20V" />
      <trace from="U_EFUSE.pin1" to="R_EFUSE_UVLO_DOWN.pin1" />
      <trace from="R_EFUSE_UVLO_DOWN.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.OVLO" to="R_EFUSE_OVLO_UP.pin2" />
      <trace from="R_EFUSE_OVLO_UP.pin1" to="net.PD_PPHV_20V" />
      <trace from="U_EFUSE.OVLO" to="R_EFUSE_OVLO_DOWN.pin1" />
      <trace from="R_EFUSE_OVLO_DOWN.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.ILM" to="R_EFUSE_ILM.pin1" />
      <trace from="R_EFUSE_ILM.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.ITIMER" to="C_EFUSE_ITIMER.pin1" />
      <trace from="C_EFUSE_ITIMER.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.DVDT" to="C_EFUSE_DVDT.pin1" />
      <trace from="C_EFUSE_DVDT.pin2" to="net.APP_GND" />
      <trace from="U_EFUSE.GND" to="net.APP_GND" />
      <trace from="U_EFUSE.OUT" to="C_EFUSE_OUT.V20_TO_V5_BUCK" />
      <trace from="U_EFUSE.OUT" to="TP_PD_EFUSE_OUT.V20_TO_V5_BUCK" />

      <trace from="U_EFUSE.OUT" to="U_V5_BUCK.VIN" />
      <trace from="U_V5_BUCK.VIN" to="U_V5_BUCK.EN" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_A.pin1" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_B.pin1" />
      <trace from="U_V5_BUCK.VIN" to="C_V5_BUCK_IN_HF.pin1" />
      {(["C_V5_BUCK_IN_A", "C_V5_BUCK_IN_B", "C_V5_BUCK_IN_HF"] as const).map((name) => (
        <trace key={name} from={`${name}.pin2`} to="net.APP_GND" />
      ))}
      <trace from="U_V5_BUCK.MODE" to="R_V5_BUCK_MODE.pin1" />
      <trace from="R_V5_BUCK_MODE.pin2" to="net.APP_GND" />
      <trace from="U_V5_BUCK.BOOT" to="C_V5_BUCK_BOOT.pin1" />
      <trace from="C_V5_BUCK_BOOT.pin2" to="U_V5_BUCK.SW" />
      <trace from="U_V5_BUCK.SW" to="L_V5_BUCK.SW" />
      <trace from="L_V5_BUCK.V5" to="net.V5" />
      <trace from="U_V5_BUCK.AGND" to="net.APP_GND" />
      <trace from="U_V5_BUCK.PGND" to="net.APP_GND" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_TOP.pin2" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_BOTTOM.pin1" />
      <trace from="R_V5_BUCK_FB_TOP.pin1" to="net.V5" />
      <trace from="R_V5_BUCK_FB_BOTTOM.pin2" to="net.APP_GND" />
      <trace from="net.V5" to="R_V5_BUCK_FF.pin1" />
      <trace from="R_V5_BUCK_FF.pin2" to="C_V5_BUCK_FF.pin1" />
      <trace from="C_V5_BUCK_FF.pin2" to="U_V5_BUCK.FB" />
      {(["C_V5_BUCK_OUT_A", "C_V5_BUCK_OUT_B"] as const).map((name) => (
        <group key={name}>
          <trace from={`net.V5`} to={`${name}.pin1`} />
          <trace from={`${name}.pin2`} to="net.APP_GND" />
        </group>
      ))}
      <trace from="net.V5" to="TP_V5.V5" />
      <trace from="net.V5" to="U_APP_REGULATOR.VIN" />
      <trace from="U_APP_REGULATOR.VIN" to="U_APP_REGULATOR.EN_UVLO" />
      <trace from="U_APP_REGULATOR.VIN" to="C_APP_REG_IN.pin1" />
      <trace from="U_APP_REGULATOR.VIN" to="C_APP_REG_IN_HF.pin1" />
      <trace from="C_APP_REG_IN.pin2" to="net.APP_GND" />
      <trace from="C_APP_REG_IN_HF.pin2" to="net.APP_GND" />
      <trace from="U_APP_REGULATOR.MODE_SYNC" to="U_APP_REGULATOR.VCC" />
      <trace from="U_APP_REGULATOR.VCC" to="C_APP_REG_VCC.pin1" />
      <trace from="C_APP_REG_VCC.pin2" to="net.APP_GND" />
      <trace from="U_APP_REGULATOR.BOOT" to="C_APP_REG_BOOT.pin1" />
      <trace from="C_APP_REG_BOOT.pin2" to="U_APP_REGULATOR.SW" />
      <trace from="U_APP_REGULATOR.SW" to="L_APP_REGULATOR.SW" />
      <trace from="L_APP_REGULATOR.APP_3V3" to="net.APP_3V3" />
      <trace from="U_APP_REGULATOR.VOUT_FB" to="net.APP_3V3" />
      <trace from="U_APP_REGULATOR.APP_GND" to="net.APP_GND" />
      {(["A", "B", "C"] as const).map((suffix) => (
        <group key={suffix}>
          <trace from="net.APP_3V3" to={`C_APP_REG_OUT_${suffix}.pin1`} />
          <trace from={`C_APP_REG_OUT_${suffix}.pin2`} to="net.APP_GND" />
        </group>
      ))}
      <trace from="net.APP_3V3" to="R_APP_REG_DISCHARGE.pin1" />
      <trace from="R_APP_REG_DISCHARGE.pin2" to="net.APP_GND" />
      <trace from="net.APP_3V3" to="TP_APP_3V3.APP_3V3" />
      <trace from="net.V5" to="TP_SCORING_REFERENCE.V5_ANALOG" />
    </group>
  )
}

export default P0UsbPower
