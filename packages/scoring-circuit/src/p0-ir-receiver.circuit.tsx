import type { ReactElement } from "react"
import { p0IrReceiverFootprint } from "./p0-ir-receiver-footprints.js"

export function P0IrReceiver({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="IR_RECEIVER">
      <chip
        name="U_IR_RX"
        manufacturerPartNumber="TSOP38438"
        pinLabels={{ pin1: "OUT", pin2: "GND", pin3: "VS" }}
        footprint={p0IrReceiverFootprint}
        pcbX={pcbX}
        pcbY={pcbY}
      />
      <resistor
        name="R_IR_VS"
        manufacturerPartNumber="RC0603FR-07100RL"
        resistance="100"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX + 9}
        pcbY={pcbY + 4}
      />
      <capacitor
        name="C_IR_VS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX + 9}
        pcbY={pcbY}
      />
      <resistor
        name="R_IR_OUT"
        manufacturerPartNumber="RC0603FR-07100RL"
        resistance="100"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX - 5}
        pcbY={pcbY + 4}
      />
      <resistor
        name="R_IR_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX - 5}
        pcbY={pcbY}
      />
      <pinheader name="TP_IR_RX" pinCount={1} pinLabels={["IR_RX_GPIO35"]} pcbX={pcbX - 10} pcbY={pcbY + 4} />

      <trace from="net.APP_3V3" to="R_IR_VS.pin1" />
      <trace from="R_IR_VS.pin2" to="U_IR_RX.VS" />
      <trace from="R_IR_VS.pin2" to="C_IR_VS.pin1" />
      <trace from="C_IR_VS.pin2" to="net.APP_GND" />
      <trace from="U_IR_RX.GND" to="net.APP_GND" />
      <trace from="U_IR_RX.OUT" to="R_IR_OUT.pin1" />
      <trace from="R_IR_OUT.pin2" to="TP_IR_RX.IR_RX_GPIO35" />
      <trace from="R_IR_OUT.pin2" to="R_IR_PULLUP.pin1" />
      <trace from="R_IR_PULLUP.pin2" to="net.APP_3V3" />
    </group>
  )
}

export default P0IrReceiver
