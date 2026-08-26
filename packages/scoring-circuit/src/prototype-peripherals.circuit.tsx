import { Fragment, type ReactElement } from "react"

const irReceiverFootprint = (
  <footprint name="TSOP38438_INLINE_FOOTPRINT" originalLayer="top">
    {["OUT", "GND", "VS"].map((signal, index) => (
      <Fragment key={signal}>
        <platedhole
          name={String(index + 1)}
          shape="circular_hole_with_rect_pad"
          pcbX={(index - 1) * 2.54}
          pcbY={0}
          holeDiameter="1.1mm"
          rectPadWidth="2.2mm"
          rectPadHeight="2.2mm"
          rectBorderRadius={index === 0 ? "0mm" : "1.1mm"}
          portHints={[`pin${index + 1}`, signal]}
        />
      </Fragment>
    ))}
    <silkscreenrect pcbX={0} pcbY={-2.4} width="7mm" height="4.8mm" strokeWidth="0.15mm" filled={false} />
    <courtyardrect pcbX={0} pcbY={-2.4} width="8mm" height="5.8mm" strokeWidth="0.05mm" />
  </footprint>
)

export function PrototypePeripherals(): ReactElement {
  return (
    <group name="PROTOTYPE_PERIPHERALS" pcbX={0} pcbY={0} pcbPack={false}>
      <chip
        name="U_IR_RECEIVER"
        manufacturerPartNumber="TSOP38438"
        pinLabels={{ pin1: "OUT", pin2: "GND", pin3: "VS" }}
        footprint={irReceiverFootprint}
        pcbX={67}
        pcbY={36}
        pcbRotation={180}
        cadModel={{
          jscad: {
            type: "colorize",
            color: [0.08, 0.08, 0.08, 1],
            shape: { type: "cuboid", size: [7, 4.8, 5], center: [0, 0, 2.5] }
          }
        }}
      />
      <resistor
        name="R_IR_SUPPLY"
        manufacturerPartNumber="RC0603FR-07100RL"
        resistance="100ohm"
        tolerance="1%"
        footprint="0603"
        pcbX={58}
        pcbY={36}
      />
      <capacitor
        name="C_IR_SUPPLY"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={58}
        pcbY={32}
      />
      <resistor
        name="R_IR_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={52}
        pcbY={36}
      />

      <pinheader name="J_DISPLAY" pinCount={3} pinLabels={["V5", "DISPLAY_DATA", "APP_GND"]} pcbX={67} pcbY={8} />
      <resistor
        name="R_DISPLAY_DATA"
        manufacturerPartNumber="RC0805FR-07330RL"
        resistance="330ohm"
        tolerance="1%"
        footprint="0805"
        pcbX={56}
        pcbY={8}
      />

      <pinheader name="J_BUZZER" pinCount={2} pinLabels={["V5", "BUZZER_SWITCHED_GND"]} pcbX={67} pcbY={-12} />
      <chip
        name="Q_BUZZER"
        manufacturerPartNumber="BSS138-7-F"
        pinLabels={{ pin1: "GATE", pin2: "SOURCE", pin3: "DRAIN" }}
        footprint="sot23"
        pcbX={55}
        pcbY={-12}
      />
      <resistor
        name="R_BUZZER_GATE"
        manufacturerPartNumber="RC0603FR-071KL"
        resistance="1kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={-10}
      />
      <resistor
        name="R_BUZZER_GATE_PULLDOWN"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={-15}
      />

      <capacitor
        name="C_V5_BULK"
        manufacturerPartNumber="C2012X5R0J226M125AC"
        capacitance="22uF"
        footprint="0805"
        pcbX={-48}
        pcbY={36}
      />
      <capacitor
        name="C_V5_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={-43}
        pcbY={36}
      />

      <trace from="net.APP_3V3" to="R_IR_SUPPLY.pin1" />
      <trace from="R_IR_SUPPLY.pin2" to="U_IR_RECEIVER.VS" />
      <trace from="R_IR_SUPPLY.pin2" to="C_IR_SUPPLY.pin1" />
      <trace from="C_IR_SUPPLY.pin2" to="net.APP_GND" />
      <trace from="U_IR_RECEIVER.GND" to="net.APP_GND" />
      <trace from="U_IR_RECEIVER.OUT" to="net.IR_RX" />
      <trace from="U_IR_RECEIVER.OUT" to="R_IR_PULLUP.pin1" />
      <trace from="R_IR_PULLUP.pin2" to="net.APP_3V3" />

      <trace from="net.V5" to="J_DISPLAY.V5" />
      <trace from="net.APP_GND" to="J_DISPLAY.APP_GND" />
      <trace from="net.DISPLAY_DATA" to="R_DISPLAY_DATA.pin1" />
      <trace from="R_DISPLAY_DATA.pin2" to="J_DISPLAY.DISPLAY_DATA" />

      <trace from="net.V5" to="J_BUZZER.V5" />
      <trace from="J_BUZZER.BUZZER_SWITCHED_GND" to="Q_BUZZER.DRAIN" />
      <trace from="Q_BUZZER.SOURCE" to="net.APP_GND" />
      <trace from="net.BUZZER_DRIVE" to="R_BUZZER_GATE.pin1" />
      <trace from="R_BUZZER_GATE.pin2" to="Q_BUZZER.GATE" />
      <trace from="Q_BUZZER.GATE" to="R_BUZZER_GATE_PULLDOWN.pin1" />
      <trace from="R_BUZZER_GATE_PULLDOWN.pin2" to="net.APP_GND" />

      <trace from="net.V5" to="C_V5_BULK.pin1" />
      <trace from="C_V5_BULK.pin2" to="net.APP_GND" />
      <trace from="net.V5" to="C_V5_BYPASS.pin1" />
      <trace from="C_V5_BYPASS.pin2" to="net.APP_GND" />
    </group>
  )
}
