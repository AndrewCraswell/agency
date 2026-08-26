/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"
import {
  p0BuzzerFootprint,
  p0EsdProtectionFootprint,
  p0LampFootprint,
  p0PrimaryConnectorFootprint,
  p0SourceDriverFootprint
} from "./p0-primary-outputs-footprints.js"
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
        footprint={p0SourceDriverFootprint}
        pinLabels={{
          pin1: "IN1",
          pin2: "IN2",
          pin3: "IN3",
          pin4: "IN4",
          pin5: "IN5",
          pin6: "IN6_NC",
          pin7: "IN7_NC",
          pin8: "IN8_NC",
          pin9: "V5_PRIMARY_OUTPUTS",
          pin10: "APP_GND",
          pin11: "OUT8_NC",
          pin12: "OUT7_NC",
          pin13: "OUT6_NC",
          pin14: "OUT5",
          pin15: "OUT4",
          pin16: "OUT3",
          pin17: "OUT2",
          pin18: "OUT1"
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
        footprint={p0EsdProtectionFootprint}
        pinLabels={{
          pin1: "NC1",
          pin2: "NC2",
          pin3: "NC3",
          pin4: "NC4",
          pin5: "APP_GND",
          pin6: "NC6",
          pin7: "NC7",
          pin8: "NC8",
          pin9: "CH5_BUZZER",
          pin10: "APP_GND",
          pin11: "CH4_WHITE_RIGHT",
          pin12: "CH3_WHITE_LEFT",
          pin13: "CH2_GREEN",
          pin14: "CH1_RED"
        }}
        pcbX={0}
        pcbY={0}
      />
      <pinheader
        name="J_PRIMARY_OUTPUTS"
        manufacturerPartNumber="39-29-1067"
        pinCount={6}
        doubleRow
        footprint={p0PrimaryConnectorFootprint}
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
              footprint={p0BuzzerFootprint}
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
                footprint={p0LampFootprint}
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
