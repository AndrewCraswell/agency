import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

export const scoringConductorChannels = [
  { conductor: "LEFT_A", driver: "DRIVE_LEFT_A", resistanceOhms: 33 },
  { conductor: "LEFT_B", driver: "DRIVE_LEFT_B", resistanceOhms: 470, sense: "SENSE_LEFT_B" },
  { conductor: "LEFT_C", driver: "DRIVE_LEFT_C", resistanceOhms: 470, sense: "SENSE_LEFT_C" },
  { conductor: "RIGHT_A", driver: "DRIVE_RIGHT_A", resistanceOhms: 33 },
  { conductor: "RIGHT_B", driver: "DRIVE_RIGHT_B", resistanceOhms: 470, sense: "SENSE_RIGHT_B" },
  { conductor: "RIGHT_C", driver: "DRIVE_RIGHT_C", resistanceOhms: 470, sense: "SENSE_RIGHT_C" },
  { conductor: "PISTE", driver: "DRIVE_PISTE", resistanceOhms: 470, sense: "SENSE_PISTE" }
] as const

export function ScoringConductorInterface({
  pcbX,
  pcbY
}: {
  readonly pcbX: number
  readonly pcbY: number
}): ReactElement {
  return (
    <group name="SCORING_CONDUCTOR_INTERFACE" pcbX={pcbX} pcbY={pcbY} pcbPack={false}>
      {scoringConductorChannels.map((channel, index) => (
        <Fragment key={channel.conductor}>
          <resistor
            name={`R_${channel.conductor}_DRIVE`}
            manufacturerPartNumber={channel.resistanceOhms === 33 ? "RC0805FR-0733RL" : "RC0805FR-07470RL"}
            resistance={`${channel.resistanceOhms}ohm`}
            tolerance="1%"
            footprint="0805"
            pcbX={0}
            pcbY={-18 + index * 6}
            cadModel={cadModels.resistor0805}
          />
          <trace from={`net.${channel.driver}`} to={`R_${channel.conductor}_DRIVE.pin1`} />
          <trace from={`R_${channel.conductor}_DRIVE.pin2`} to={`net.${channel.conductor}`} />
          {"sense" in channel ? (
            <>
              <resistor
                name={`R_${channel.conductor}_SENSE`}
                manufacturerPartNumber="RC0805FR-071KL"
                resistance="1kohm"
                tolerance="1%"
                footprint="0805"
                pcbX={10}
                pcbY={-18 + index * 6}
                cadModel={cadModels.resistor0805}
              />
              <trace from={`net.${channel.conductor}`} to={`R_${channel.conductor}_SENSE.pin1`} />
              <trace from={`R_${channel.conductor}_SENSE.pin2`} to={`net.${channel.sense}`} />
            </>
          ) : null}
        </Fragment>
      ))}
    </group>
  )
}
