import type { ReactElement } from "react"
import { Bp033Tpd2eusb30drtrDrtProjectFootprint } from "./bp033-tpd2eusb30drtr-drt-project-footprint.js"
import { Bp033UsbCProjectFootprint } from "./bp033-usb-c-project-footprint.js"
import { P0ApplicationInductorFootprint, P0Lmr43620Footprint } from "./p0-usb-power-footprints.js"

/**
 * The prototype receives regulated 5 V from an off-board wired assembly:
 * SparkFun DEV-15801 PD module -> Pololu D36V50F5 regulator module. The
 * carrier contains only the connector, a replaceable 5 V fuse, and the
 * retained application 3.3 V regulator. Neither module's internal circuit
 * is copied into this board model.
 */
export type P0UsbPowerProps = {
  readonly pcbX: number
  readonly pcbY: number
}

const powerInputFootprint = (
  <footprint name="P0_5V_POWER_INPUT_SCREW_TERMINAL" originalLayer="top">
    <silkscreenline x1={-1.75} y1={-1.75} x2={5.25} y2={-1.75} strokeWidth="0.2mm" />
    <silkscreenline x1={5.25} y1={-1.75} x2={5.25} y2={1.75} strokeWidth="0.2mm" />
    <silkscreenline x1={5.25} y1={1.75} x2={-1.75} y2={1.75} strokeWidth="0.2mm" />
    <silkscreenline x1={-1.75} y1={1.75} x2={-1.75} y2={-1.75} strokeWidth="0.2mm" />
    <platedhole
      name="1"
      shape="circular_hole_with_rect_pad"
      pcbX={0}
      pcbY={0}
      holeDiameter="1.2mm"
      rectPadWidth="2.032mm"
      rectPadHeight="2.032mm"
      rectBorderRadius="0mm"
      portHints={["1", "V5_INPUT"]}
    />
    <platedhole
      name="2"
      shape="circular_hole_with_rect_pad"
      pcbX={3.5}
      pcbY={0}
      holeDiameter="1.2mm"
      rectPadWidth="2.032mm"
      rectPadHeight="2.032mm"
      rectBorderRadius="1mm"
      portHints={["2", "APP_GND"]}
    />
  </footprint>
)

function P0UsbPower({ pcbX, pcbY }: P0UsbPowerProps): ReactElement {
  return (
    <group name="P0_USB_POWER" pcbX={pcbX} pcbY={pcbY} pcbPositionMode="relative_to_board_anchor" pcbPack={false}>
      {/* USB-C is for ESP32 diagnostics/data only; it is not the power input. */}
      <Bp033UsbCProjectFootprint name="J_USB_C" pcbX={-34} pcbY={0} pcbPositionMode="relative_to_board_anchor" />
      <Bp033Tpd2eusb30drtrDrtProjectFootprint name="U_USB_DATA_PROTECT" pcbX={-22} pcbY={-8} />
      <resistor
        name="R_USB_CC1_RD"
        manufacturerPartNumber="RC0603FR-075K1L"
        resistance="5.1k"
        tolerance="1%"
        footprint="0603"
        pcbX={-30}
        pcbY={8}
      />
      <resistor
        name="R_USB_CC2_RD"
        manufacturerPartNumber="RC0603FR-075K1L"
        resistance="5.1k"
        tolerance="1%"
        footprint="0603"
        pcbX={-24}
        pcbY={8}
      />

      {/* Off-board SparkFun + Pololu assembly enters as already-regulated 5 V. */}
      <chip
        name="J_POWER_INPUT"
        manufacturerPartNumber="OSTVN02A150"
        pinLabels={{ pin1: "V5_INPUT", pin2: "APP_GND" }}
        footprint={powerInputFootprint}
        pcbX={-8}
        pcbY={-18}
      />
      <chip
        name="F_MAIN_5V"
        manufacturerPartNumber="0451003.NRL"
        pinLabels={{ pin1: "V5_INPUT", pin2: "V5_FUSED" }}
        footprint="1206"
        pcbX={3}
        pcbY={-18}
      />

      {/* The only rail checks needed before the rest of the prototype is populated. */}
      <pinheader name="TP_V5" pinCount={1} pinLabels={["V5"]} pcbX={14} pcbY={-26} />
      <pinheader name="TP_APP_3V3" pinCount={1} pinLabels={["APP_3V3"]} pcbX={39} pcbY={15} />

      {/* Existing 5 V to application 3.3 V regulator remains on the carrier. */}
      <P0Lmr43620Footprint name="U_APP_REGULATOR" pcbX={22} pcbY={15} />
      <P0ApplicationInductorFootprint name="L_APP_REGULATOR" pcbX={29} pcbY={15} />
      <capacitor
        name="C_APP_REG_IN"
        manufacturerPartNumber="C2012X7R1E475K125AB"
        capacitance="4.7uF"
        footprint="0805"
        pcbX={15}
        pcbY={8}
      />
      <capacitor
        name="C_APP_REG_IN_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={21}
        pcbY={8}
      />
      <capacitor
        name="C_APP_REG_VCC"
        manufacturerPartNumber="885012206052"
        capacitance="1uF"
        footprint="0603"
        pcbX={27}
        pcbY={22}
      />
      <capacitor
        name="C_APP_REG_BOOT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={27}
        pcbY={8}
      />
      {(["A", "B", "C"] as const).map((suffix, index) => (
        <capacitor
          key={suffix}
          name={`C_APP_REG_OUT_${suffix}`}
          manufacturerPartNumber="C2012X7S1A226M125AC"
          capacitance="22uF"
          footprint="0805"
          pcbX={15 + index * 6}
          pcbY={28}
        />
      ))}
      <resistor
        name="R_APP_REG_DISCHARGE"
        manufacturerPartNumber="RC0603FR-071KL"
        resistance="1k"
        tolerance="1%"
        footprint="0603"
        pcbX={33}
        pcbY={22}
      />

      <trace from="J_USB_C.Dp1" to="U_USB_DATA_PROTECT.pin1" />
      <trace from="J_USB_C.Dp2" to="U_USB_DATA_PROTECT.pin1" />
      <trace from="J_USB_C.Dn1" to="U_USB_DATA_PROTECT.pin2" />
      <trace from="J_USB_C.Dn2" to="U_USB_DATA_PROTECT.pin2" />
      <trace from="U_USB_DATA_PROTECT.pin1" to="net.USB_DP" />
      <trace from="U_USB_DATA_PROTECT.pin2" to="net.USB_DN" />
      <trace from="U_USB_DATA_PROTECT.pin3" to="net.APP_GND" />
      <trace from="J_USB_C.GND" to="net.APP_GND" />
      <trace from="J_USB_C.CC1" to="R_USB_CC1_RD.pin1" />
      <trace from="R_USB_CC1_RD.pin2" to="net.APP_GND" />
      <trace from="J_USB_C.CC2" to="R_USB_CC2_RD.pin1" />
      <trace from="R_USB_CC2_RD.pin2" to="net.APP_GND" />

      <trace from="J_POWER_INPUT.V5_INPUT" to="F_MAIN_5V.V5_INPUT" width="1.9mm" />
      <trace from="F_MAIN_5V.V5_FUSED" to="net.V5" width="1.9mm" />
      <trace from="J_POWER_INPUT.APP_GND" to="net.APP_GND" width="1.9mm" />
      <trace from="net.V5" to="TP_V5.V5" />

      <trace from="net.V5" to="U_APP_REGULATOR.VIN" width="0.3mm" />
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
      <trace from="L_APP_REGULATOR.APP_3V3" to="net.APP_3V3" width="0.3mm" />
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
    </group>
  )
}

export default P0UsbPower
