import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

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

const scoringSounderFootprint = (
  <footprint name="TDK_PS1240P02BT_D12_2MM" originalLayer="top">
    <platedhole
      name="POSITIVE"
      shape="circular_hole_with_rect_pad"
      pcbX={-2.5}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="0mm"
      portHints={["1", "pin1", "positive", "pos"]}
    />
    <platedhole
      name="SWITCHED_GROUND"
      shape="circular_hole_with_rect_pad"
      pcbX={2.5}
      pcbY={0}
      holeDiameter="1mm"
      rectPadWidth="2mm"
      rectPadHeight="2mm"
      rectBorderRadius="1mm"
      portHints={["2", "pin2", "negative", "neg"]}
    />
    <silkscreencircle pcbX={0} pcbY={0} radius="6.1mm" strokeWidth="0.2mm" isOutline />
    <silkscreencircle pcbX={-2.5} pcbY={0} radius="1.25mm" strokeWidth="0.2mm" isOutline />
    <courtyardrect pcbX={0} pcbY={0} width="12.7mm" height="12.7mm" strokeWidth="0.05mm" />
  </footprint>
)

export const prototypeSounder = {
  driveGpio: "GPIO39",
  driveFrequencyHz: 4000,
  manufacturerPartNumber: "PS1240P02BT",
  ratedDrive: "3V(0-p) square wave",
  supply: "APP_3V3"
} as const

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
        cadModel={cadModels.irReceiver}
      />
      <resistor
        name="R_IR_SUPPLY"
        manufacturerPartNumber="RC0603FR-07100RL"
        resistance="100ohm"
        tolerance="1%"
        footprint="0603"
        pcbX={58}
        pcbY={36}
        cadModel={cadModels.resistor0603}
      />
      <capacitor
        name="C_IR_SUPPLY"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={58}
        pcbY={32}
        cadModel={cadModels.capacitor0603}
      />
      <pinheader
        name="J_DISPLAY"
        pinCount={3}
        pinLabels={["V5", "DISPLAY_DATA", "APP_GND"]}
        pcbX={55}
        pcbY={2}
        cadModel={cadModels.pinHeader1x03}
      />
      <resistor
        name="R_DISPLAY_DATA"
        manufacturerPartNumber="RC0805FR-07330RL"
        resistance="330ohm"
        tolerance="1%"
        footprint="0805"
        pcbX={48}
        pcbY={2}
        cadModel={cadModels.resistor0805}
      />

      <chip
        name="BZ_SCORING"
        manufacturerPartNumber={prototypeSounder.manufacturerPartNumber}
        pinLabels={{ pin1: "POSITIVE", pin2: "SWITCHED_GROUND" }}
        footprint={scoringSounderFootprint}
        pcbX={68}
        pcbY={-6}
        cadModel={cadModels.scoringSounder}
      />
      <chip
        name="Q_BUZZER"
        manufacturerPartNumber="BSS138-7-F"
        pinLabels={{ pin1: "GATE", pin2: "SOURCE", pin3: "DRAIN" }}
        footprint="sot23"
        pcbX={55}
        pcbY={-12}
        cadModel={cadModels.sot23}
      />
      <resistor
        name="R_BUZZER_GATE"
        manufacturerPartNumber="RC0603FR-071KL"
        resistance="1kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={-10}
        cadModel={cadModels.resistor0603}
      />
      <resistor
        name="R_BUZZER_GATE_PULLDOWN"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={-15}
        cadModel={cadModels.resistor0603}
      />

      <capacitor
        name="C_V5_BULK"
        manufacturerPartNumber="C2012X5R0J226M125AC"
        capacitance="22uF"
        footprint="0805"
        pcbX={-17}
        pcbY={39}
        cadModel={cadModels.capacitor0805}
      />
      <capacitor
        name="C_V5_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={-13}
        pcbY={39}
        cadModel={cadModels.capacitor0603}
      />

      <trace from="net.APP_3V3" to="R_IR_SUPPLY.pin1" />
      <trace from="R_IR_SUPPLY.pin2" to="U_IR_RECEIVER.VS" />
      <trace from="R_IR_SUPPLY.pin2" to="C_IR_SUPPLY.pin1" />
      <trace from="C_IR_SUPPLY.pin2" to="net.APP_GND" />
      <trace from="U_IR_RECEIVER.GND" to="net.APP_GND" />
      <trace from="U_IR_RECEIVER.OUT" to="net.IR_RX" />

      <trace from="net.V5" to="J_DISPLAY.V5" />
      <trace from="net.APP_GND" to="J_DISPLAY.APP_GND" />
      <trace from="net.DISPLAY_DATA" to="R_DISPLAY_DATA.pin1" />
      <trace from="R_DISPLAY_DATA.pin2" to="J_DISPLAY.DISPLAY_DATA" />

      <trace from="net.APP_3V3" to="BZ_SCORING.POSITIVE" />
      <trace from="BZ_SCORING.SWITCHED_GROUND" to="Q_BUZZER.DRAIN" />
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
