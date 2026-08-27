import { Fragment, type ReactElement } from "react"
import { cadModels } from "./cad-models.js"

export const scoringConductorChannels = [
  { conductor: "LEFT_A", gpio: "SCORING_LEFT_A", resistanceOhms: 33 },
  { conductor: "LEFT_B", gpio: "SCORING_LEFT_B", resistanceOhms: 470 },
  { conductor: "LEFT_C", gpio: "SCORING_LEFT_C", resistanceOhms: 470 },
  { conductor: "RIGHT_A", gpio: "SCORING_RIGHT_A", resistanceOhms: 33 },
  { conductor: "RIGHT_B", gpio: "SCORING_RIGHT_B", resistanceOhms: 470 },
  { conductor: "RIGHT_C", gpio: "SCORING_RIGHT_C", resistanceOhms: 470 },
  { conductor: "PISTE", gpio: "SCORING_PISTE", resistanceOhms: 470 }
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
            name={`R_${channel.conductor}_SERIES`}
            manufacturerPartNumber={channel.resistanceOhms === 33 ? "RC0805FR-0733RL" : "RC0805FR-07470RL"}
            resistance={`${channel.resistanceOhms}ohm`}
            tolerance="1%"
            footprint="0805"
            pcbX={0}
            pcbY={-18 + index * 6}
            cadModel={cadModels.resistor0805}
          />
          <trace from={`net.${channel.gpio}`} to={`R_${channel.conductor}_SERIES.pin1`} />
          <trace from={`R_${channel.conductor}_SERIES.pin2`} to={`net.${channel.conductor}`} />
        </Fragment>
      ))}
    </group>
  )
}
