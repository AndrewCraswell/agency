/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"

const outputChannels = [
  {
    signal: "ESP32_GPIO7_PRIMARY_LAMP_RED",
    driverInput: "IN1",
    driverOutput: "OUT1",
    pulldown: "R_P0_RED_INPUT_PD",
    ballast: "R_P0_RED_BALLAST",
    load: "D_P0_RED",
    loadMpn: "WP7113ID",
    connectorCircuit: "CIRCUIT_1_RED"
  },
  {
    signal: "ESP32_GPIO15_PRIMARY_LAMP_GREEN",
    driverInput: "IN2",
    driverOutput: "OUT2",
    pulldown: "R_P0_GREEN_INPUT_PD",
    ballast: "R_P0_GREEN_BALLAST",
    load: "D_P0_GREEN",
    loadMpn: "WP7113SGD",
    connectorCircuit: "CIRCUIT_2_GREEN"
  },
  {
    signal: "ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
    driverInput: "IN3",
    driverOutput: "OUT3",
    pulldown: "R_P0_WHITE_LEFT_INPUT_PD",
    ballast: "R_P0_WHITE_LEFT_BALLAST",
    load: "D_P0_WHITE_LEFT",
    loadMpn: "WP7113QWC/D",
    connectorCircuit: "CIRCUIT_3_WHITE_LEFT"
  },
  {
    signal: "ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
    driverInput: "IN4",
    driverOutput: "OUT4",
    pulldown: "R_P0_WHITE_RIGHT_INPUT_PD",
    ballast: "R_P0_WHITE_RIGHT_BALLAST",
    load: "D_P0_WHITE_RIGHT",
    loadMpn: "WP7113QWC/D",
    connectorCircuit: "CIRCUIT_4_WHITE_RIGHT"
  },
  {
    signal: "ESP32_GPIO11_PRIMARY_BUZZER",
    driverInput: "IN5",
    driverOutput: "OUT5",
    pulldown: "R_P0_BUZZER_INPUT_PD",
    ballast: undefined,
    load: "BZ_P0",
    loadMpn: "CMI-9605-0580T",
    connectorCircuit: "CIRCUIT_5_BUZZER"
  }
] as const

const sourceDriverFootprint = (
  <footprint name="P0_TBD62783AFWG_TSSOP18" originalLayer="top">
    {Array.from({ length: 18 }, (_, index) => {
      const pin = index + 1
      const leftSide = pin <= 9
      return (
        <Fragment key={pin}>
          <smtpad
            name={`pin${pin}`}
            pcbX={leftSide ? -2.8 : 2.8}
            pcbY={`${(leftSide ? pin - 5 : 14 - pin) * 0.65}mm`}
            shape="rect"
            width="1.5mm"
            height="0.35mm"
            portHints={[`pin${pin}`]}
          />
        </Fragment>
      )
    })}
  </footprint>
)

const esdFootprint = (
  <footprint name="P0_TPD6E05U06RVZR_DQA" originalLayer="top">
    {Array.from({ length: 7 }, (_, index) => {
      const pin = index + 1
      return (
        <Fragment key={pin}>
          <smtpad
            name={`pin${pin}`}
            pcbX={pin <= 3 ? -1.4 : 1.4}
            pcbY={`${(pin <= 3 ? pin - 2 : 5 - pin) * 0.65}mm`}
            shape="rect"
            width="0.9mm"
            height="0.35mm"
            portHints={[`pin${pin}`]}
          />
        </Fragment>
      )
    })}
  </footprint>
)

const ledFootprint = (
  <footprint name="P0_T1_3_4_LED" originalLayer="top">
    <platedhole
      name="pin1"
      shape="circular_hole_with_rect_pad"
      pcbX="-1.27mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin1"]}
    />
    <platedhole
      name="pin2"
      shape="circular_hole_with_rect_pad"
      pcbX="1.27mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin2"]}
    />
  </footprint>
)

const buzzerFootprint = (
  <footprint name="P0_CMI_9605_TH" originalLayer="top">
    <platedhole
      name="pin1"
      shape="circular_hole_with_rect_pad"
      pcbX="-2mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin1"]}
    />
    <platedhole
      name="pin2"
      shape="circular_hole_with_rect_pad"
      pcbX="2mm"
      pcbY={0}
      holeDiameter="0.9mm"
      rectPadWidth="1.8mm"
      rectPadHeight="1.8mm"
      rectBorderRadius="0.25mm"
      portHints={["pin2"]}
    />
  </footprint>
)

const connectorFootprint = (
  <footprint name="P0_MOLEX_39_29_1067_MINI_FIT_JR_2X3" originalLayer="top">
    {Array.from({ length: 6 }, (_, index) => {
      const pin = index + 1
      return (
        <Fragment key={pin}>
          <platedhole
            name={`pin${pin}`}
            shape="circular_hole_with_rect_pad"
            pcbX={`${(index % 2) * 4.2 - 2.1}mm`}
            pcbY={`${Math.floor(index / 2) * 4.2 - 4.2}mm`}
            holeDiameter="1.4mm"
            rectPadWidth="2.4mm"
            rectPadHeight="2.4mm"
            rectBorderRadius="0.35mm"
            portHints={[`pin${pin}`]}
          />
        </Fragment>
      )
    })}
  </footprint>
)

export const p0PrimaryOutputsCircuitContract = Object.freeze({
  sourceDriver: "TBD62783AFWG",
  branchPptc: "1206L020YR",
  esdProtection: "TPD6E05U06RVZR",
  connector: "39-29-1067",
  gpioOrder: outputChannels.map(({ signal }) => signal),
  unusedDriverPins: ["IN6_NC", "IN7_NC", "IN8_NC", "OUT6_NC", "OUT7_NC", "OUT8_NC"],
  resetState: "off: five 100 kilohm input pull-downs hold the source-driver inputs low"
})

/** Placeable P0 lamp and buzzer output circuit. */
export function P0PrimaryOutputs({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="P0_PRIMARY_OUTPUTS" pcbX={pcbX} pcbY={pcbY}>
      <chip
        name="U_P0_OUTPUT_DRIVER"
        manufacturerPartNumber="TBD62783AFWG"
        footprint={sourceDriverFootprint}
        pinLabels={{
          pin1: "IN1",
          pin2: "IN2",
          pin3: "IN3",
          pin4: "IN4",
          pin5: "IN5",
          pin6: "IN6_NC",
          pin7: "IN7_NC",
          pin8: "IN8_NC",
          pin9: "APP_GND",
          pin10: "OUT8_NC",
          pin11: "OUT7_NC",
          pin12: "OUT6_NC",
          pin13: "OUT5",
          pin14: "OUT4",
          pin15: "OUT3",
          pin16: "OUT2",
          pin17: "OUT1",
          pin18: "V5_PRIMARY_OUTPUTS"
        }}
        pcbX={-40}
        pcbY={0}
      />
      <chip
        name="F_P0_OUTPUTS"
        manufacturerPartNumber="1206L020YR"
        footprint="1206"
        pinLabels={{ pin1: "V5", pin2: "V5_PRIMARY_OUTPUTS" }}
        pcbX={-58}
        pcbY={-22}
      />
      <chip
        name="U_P0_OUTPUT_ESD"
        manufacturerPartNumber="TPD6E05U06RVZR"
        footprint={esdFootprint}
        pinLabels={{
          pin1: "CH1_RED",
          pin2: "CH2_GREEN",
          pin3: "CH3_WHITE_LEFT",
          pin4: "APP_GND",
          pin5: "CH4_WHITE_RIGHT",
          pin6: "CH5_BUZZER",
          pin7: "CH6_NC"
        }}
        pcbX={0}
        pcbY={0}
      />
      <pinheader
        name="J_PRIMARY_OUTPUTS"
        manufacturerPartNumber="39-29-1067"
        pinCount={6}
        doubleRow
        footprint={connectorFootprint}
        pinLabels={{
          pin1: "CIRCUIT_1_RED",
          pin2: "CIRCUIT_2_GREEN",
          pin3: "CIRCUIT_3_WHITE_LEFT",
          pin4: "CIRCUIT_4_WHITE_RIGHT",
          pin5: "CIRCUIT_5_BUZZER",
          pin6: "APP_GND_RETURN"
        }}
        pcbX={26}
        pcbY={0}
      />

      {outputChannels.map((channel, index) => (
        <Fragment key={channel.signal}>
          <resistor
            name={channel.pulldown}
            manufacturerPartNumber="RC0603FR-07100KL"
            resistance="100k"
            tolerance="1%"
            footprint="0603"
            pcbX={-58}
            pcbY={-12 + index * 6}
          />
          {channel.ballast === undefined ? (
            <chip
              name={channel.load}
              manufacturerPartNumber={channel.loadMpn}
              footprint={buzzerFootprint}
              pinLabels={{ pin1: "POSITIVE", pin2: "APP_GND" }}
              pcbX={59}
              pcbY={12}
            />
          ) : (
            <Fragment>
              <resistor
                name={channel.ballast}
                manufacturerPartNumber="RC1206FR-07180RL"
                resistance="180"
                tolerance="1%"
                footprint="1206"
                pcbX={43}
                pcbY={-18 + index * 10}
              />
              <chip
                name={channel.load}
                manufacturerPartNumber={channel.loadMpn}
                footprint={ledFootprint}
                pinLabels={{ pin1: "ANODE", pin2: "CATHODE" }}
                pcbX={59}
                pcbY={-18 + index * 10}
              />
            </Fragment>
          )}
        </Fragment>
      ))}

      <trace from="net.V5" to="F_P0_OUTPUTS.V5" />
      <trace from="F_P0_OUTPUTS.V5_PRIMARY_OUTPUTS" to="U_P0_OUTPUT_DRIVER.V5_PRIMARY_OUTPUTS" />
      <trace from="U_P0_OUTPUT_DRIVER.APP_GND" to="net.APP_GND" />
      {outputChannels.map((channel, index) => {
        const esdChannel = `CH${index + 1}_${index === 0 ? "RED" : index === 1 ? "GREEN" : index === 2 ? "WHITE_LEFT" : index === 3 ? "WHITE_RIGHT" : "BUZZER"}`
        return (
          <Fragment key={channel.signal}>
            <trace from={`net.${channel.signal}`} to={`U_P0_OUTPUT_DRIVER.${channel.driverInput}`} />
            <trace from={`U_P0_OUTPUT_DRIVER.${channel.driverInput}`} to={`${channel.pulldown}.pin1`} />
            <trace from={`${channel.pulldown}.pin2`} to="net.APP_GND" />
            <trace from={`U_P0_OUTPUT_DRIVER.${channel.driverOutput}`} to={`U_P0_OUTPUT_ESD.${esdChannel}`} />
            <trace
              from={`U_P0_OUTPUT_DRIVER.${channel.driverOutput}`}
              to={`J_PRIMARY_OUTPUTS.${channel.connectorCircuit}`}
            />
            {channel.ballast === undefined ? (
              <Fragment>
                <trace from={`J_PRIMARY_OUTPUTS.${channel.connectorCircuit}`} to={`${channel.load}.POSITIVE`} />
                <trace from={`${channel.load}.APP_GND`} to="net.APP_GND" />
              </Fragment>
            ) : (
              <Fragment>
                <trace from={`J_PRIMARY_OUTPUTS.${channel.connectorCircuit}`} to={`${channel.ballast}.pin1`} />
                <trace from={`${channel.ballast}.pin2`} to={`${channel.load}.ANODE`} />
                <trace from={`${channel.load}.CATHODE`} to="net.APP_GND" />
              </Fragment>
            )}
          </Fragment>
        )
      })}
      <trace from="U_P0_OUTPUT_ESD.APP_GND" to="net.APP_GND" />
      <trace from="J_PRIMARY_OUTPUTS.APP_GND_RETURN" to="net.APP_GND" />
    </group>
  )
}

export function P0PrimaryOutputsCircuit(): ReactElement {
  return (
    <board title="P0 primary lamp and buzzer outputs" width="150mm" height="75mm" layers={2}>
      <P0PrimaryOutputs pcbX={0} pcbY={0} />
    </board>
  )
}

export default P0PrimaryOutputsCircuit
