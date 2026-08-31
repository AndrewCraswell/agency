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

const hub75DataFootprint = (
  <footprint name="HUB75_2X08_P2_54MM" originalLayer="top">
    {Array.from({ length: 16 }, (_, index) => {
      const pinNumber = index + 1
      const row = Math.floor(index / 2)
      return (
        <Fragment key={pinNumber}>
          <platedhole
            name={String(pinNumber)}
            shape="circular_hole_with_rect_pad"
            pcbX={index % 2 === 0 ? -1.27 : 1.27}
            pcbY={8.89 - row * 2.54}
            holeDiameter="1mm"
            rectPadWidth="1.8mm"
            rectPadHeight="1.8mm"
            rectBorderRadius={pinNumber === 1 ? "0mm" : "0.9mm"}
            portHints={[`pin${pinNumber}`]}
          />
        </Fragment>
      )
    })}
    <silkscreenrect pcbX={0} pcbY={0} width="10.16mm" height="25.4mm" strokeWidth="0.2mm" filled={false} />
    <silkscreentext text="HUB75" pcbX={0} pcbY={11.5} fontSize="0.9mm" />
    <courtyardrect pcbX={0} pcbY={0} width="10.8mm" height="26mm" strokeWidth="0.05mm" />
  </footprint>
)

const hub75PowerFootprint = (
  <footprint name="WR_WTB_645004114822" originalLayer="top">
    {Array.from({ length: 4 }, (_, index) => (
      <Fragment key={index + 1}>
        <platedhole
          name={String(index + 1)}
          shape="circular_hole_with_rect_pad"
          pcbX={(index - 1.5) * 3.96}
          pcbY={0}
          holeDiameter="1.4mm"
          rectPadWidth="2.8mm"
          rectPadHeight="2.8mm"
          rectBorderRadius={index === 0 ? "0mm" : "1.4mm"}
          portHints={[`pin${index + 1}`]}
        />
      </Fragment>
    ))}
    <silkscreenrect pcbX={0} pcbY={0} width="15.78mm" height="10.9mm" strokeWidth="0.2mm" filled={false} />
    <silkscreentext text="HUB75 5V" pcbX={0} pcbY={4.6} fontSize="0.8mm" />
    <courtyardrect pcbX={0} pcbY={0} width="16.4mm" height="11.5mm" strokeWidth="0.05mm" />
  </footprint>
)

export const prototypeSounder = {
  driveGpio: "GPIO48",
  driveFrequencyHz: 4000,
  manufacturerPartNumber: "PS1240P02BT",
  ratedDrive: "3V(0-p) square wave",
  supply: "APP_3V3"
} as const

export const hub75Display = {
  connector: "TST-108-02-G-D",
  geometry: "64x32",
  scan: "1/16",
  powerConnector: "645004114822",
  signals: ["R1", "G1", "B1", "R2", "G2", "B2", "A", "B", "C", "D", "CLK", "LAT", "OE"]
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
        pcbY={46}
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
        pcbY={44}
        cadModel={cadModels.resistor0603}
      />
      <capacitor
        name="C_IR_SUPPLY"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={58}
        pcbY={40}
        cadModel={cadModels.capacitor0603}
      />
      <chip
        name="J_HUB75_DATA"
        manufacturerPartNumber={hub75Display.connector}
        pinLabels={{
          pin1: "R1",
          pin2: "G1",
          pin3: "B1",
          pin4: "GND_1",
          pin5: "R2",
          pin6: "G2",
          pin7: "B2",
          pin8: "GND_2",
          pin9: "A",
          pin10: "B",
          pin11: "C",
          pin12: "D",
          pin13: "CLK",
          pin14: "LAT",
          pin15: "OE",
          pin16: "GND_3"
        }}
        footprint={hub75DataFootprint}
        pcbX={15}
        pcbY={42}
        pcbRotation={90}
        cadModel={cadModels.hub75DataHeader}
      />
      <chip
        name="J_HUB75_POWER"
        manufacturerPartNumber={hub75Display.powerConnector}
        pinLabels={{ pin1: "V5_1", pin2: "V5_2", pin3: "GND_1", pin4: "GND_2" }}
        footprint={hub75PowerFootprint}
        pcbX={38}
        pcbY={42}
        pcbRotation={90}
        cadModel={cadModels.hub75PowerHeader}
      />

      <chip
        name="BZ_SCORING"
        manufacturerPartNumber={prototypeSounder.manufacturerPartNumber}
        pinLabels={{ pin1: "POSITIVE", pin2: "SWITCHED_GROUND" }}
        footprint={scoringSounderFootprint}
        pcbX={68}
        pcbY={16}
        cadModel={cadModels.scoringSounder}
      />
      <chip
        name="Q_BUZZER"
        manufacturerPartNumber="BSS138-7-F"
        pinLabels={{ pin1: "GATE", pin2: "SOURCE", pin3: "DRAIN" }}
        footprint="sot23"
        pcbX={55}
        pcbY={10}
        cadModel={cadModels.sot23}
      />
      <resistor
        name="R_BUZZER_GATE"
        manufacturerPartNumber="RC0603FR-071KL"
        resistance="1kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={12}
        cadModel={cadModels.resistor0603}
      />
      <resistor
        name="R_BUZZER_GATE_PULLDOWN"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100kohm"
        tolerance="1%"
        footprint="0603"
        pcbX={47}
        pcbY={7}
        cadModel={cadModels.resistor0603}
      />

      <capacitor
        name="C_V5_BULK"
        manufacturerPartNumber="C2012X5R1A226M085AC"
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

      {hub75Display.signals.map((signal) => (
        <Fragment key={signal}>
          <trace from={`net.HUB75_${signal}`} to={`J_HUB75_DATA.${signal}`} />
        </Fragment>
      ))}
      <trace from="net.APP_GND" to="J_HUB75_DATA.GND_1" />
      <trace from="net.APP_GND" to="J_HUB75_DATA.GND_2" />
      <trace from="net.APP_GND" to="J_HUB75_DATA.GND_3" />
      <trace from="net.V5" to="J_HUB75_POWER.V5_1" width="1mm" />
      <trace from="net.V5" to="J_HUB75_POWER.V5_2" width="1mm" />
      <trace from="net.APP_GND" to="J_HUB75_POWER.GND_1" width="1mm" />
      <trace from="net.APP_GND" to="J_HUB75_POWER.GND_2" width="1mm" />

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
