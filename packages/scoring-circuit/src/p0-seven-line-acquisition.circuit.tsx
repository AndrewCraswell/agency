import { Fragment, type ReactElement } from "react"
import {
  P0Ada4177Footprint,
  P0Ads8881Footprint,
  P0Ref5025Footprint,
  P0Sn74Hcs595Footprint,
  P0T521BFootprint,
  P0Tpd4e05u06Footprint,
  P0Tps60400Footprint,
  P0Tmux1208Footprint
} from "./p0-acquisition-footprints.js"
import { p0SevenLineAcquisition } from "./p0-seven-line-acquisition.js"

const esdPortByLine = new Map(
  p0SevenLineAcquisition.conductors.map(({ line }, index) => [
    line,
    `U_ESD_${Math.floor(index / 4) + 1}.LINE_${(index % 4) + 1}`
  ])
)

const acquisitionPlacement = {
  muxes: {
    source: { pcbX: -38, pcbY: -20 },
    sink: { pcbX: -38, pcbY: 8 },
    sense: { pcbX: 4, pcbY: -4 }
  },
  phaseControls: {
    first: { pcbX: -15, pcbY: 37 },
    second: { pcbX: 10, pcbY: 37 },
    outputEnablePullup: { pcbX: 4, pcbY: 29 }
  },
  sharedAnalog: {
    sar: { pcbX: 30, pcbY: -4 },
    sarInputResistor: { pcbX: 22, pcbY: -4 },
    sarInputCapacitor: { pcbX: 22, pcbY: 2 },
    sarAvddCapacitor: { pcbX: 37, pcbY: -8 },
    sarDvddCapacitor: { pcbX: 37, pcbY: 0 },
    reference: { pcbX: 50, pcbY: -15 },
    referenceInputCapacitor: { pcbX: 42, pcbY: -22 },
    referenceRegulator: { pcbX: 58, pcbY: -15 },
    referenceRegulatorHfCapacitor: { pcbX: 58, pcbY: -22 },
    referenceSarResistor: { pcbX: 42, pcbY: -15 },
    referenceSarCapacitor: { pcbX: 42, pcbY: -8 },
    negativeRail: { pcbX: 50, pcbY: 15 },
    negativeInputCapacitor: { pcbX: 42, pcbY: 15 },
    negativeFlyCapacitor: { pcbX: 50, pcbY: 22 },
    negativeOutputCapacitor: { pcbX: 58, pcbY: 15 }
  },
  esd: [
    { pcbX: -70, pcbY: -14 },
    { pcbX: -70, pcbY: 14 }
  ],
  conductors: [
    {
      line: { pcbX: -58, pcbY: -24 },
      source: { pcbX: -27, pcbY: -29 },
      sink: { pcbX: -27, pcbY: -2 },
      sense: null
    },
    {
      line: { pcbX: -58, pcbY: -16 },
      source: { pcbX: -27, pcbY: -25.5 },
      sink: { pcbX: -27, pcbY: 0.5 },
      sense: { pcbX: 13, pcbY: -22, positive: { pcbX: 20, pcbY: -18.2 }, negative: { pcbX: 20, pcbY: -25.8 } }
    },
    {
      line: { pcbX: -58, pcbY: -8 },
      source: { pcbX: -27, pcbY: -22 },
      sink: { pcbX: -27, pcbY: 3 },
      sense: { pcbX: 13, pcbY: -13, positive: { pcbX: 20, pcbY: -9.2 }, negative: { pcbX: 20, pcbY: -16.8 } }
    },
    {
      line: { pcbX: -58, pcbY: 0 },
      source: { pcbX: -27, pcbY: -18.5 },
      sink: { pcbX: -27, pcbY: 5.5 },
      sense: null
    },
    {
      line: { pcbX: -58, pcbY: 8 },
      source: { pcbX: -27, pcbY: -15 },
      sink: { pcbX: -27, pcbY: 8 },
      sense: { pcbX: 13, pcbY: -4, positive: { pcbX: 20, pcbY: -0.2 }, negative: { pcbX: 20, pcbY: -7.8 } }
    },
    {
      line: { pcbX: -58, pcbY: 16 },
      source: { pcbX: -27, pcbY: -11.5 },
      sink: { pcbX: -27, pcbY: 10.5 },
      sense: { pcbX: 13, pcbY: 5, positive: { pcbX: 20, pcbY: 8.8 }, negative: { pcbX: 20, pcbY: 1.2 } }
    },
    {
      line: { pcbX: -58, pcbY: 24 },
      source: { pcbX: -27, pcbY: -8 },
      sink: { pcbX: -27, pcbY: 13 },
      sense: { pcbX: 13, pcbY: 14, positive: { pcbX: 20, pcbY: 17.8 }, negative: { pcbX: 20, pcbY: 10.2 } }
    }
  ]
} as const

function PhaseControl({
  index,
  pcbX,
  pcbY
}: {
  readonly index: 1 | 2
  readonly pcbX: number
  readonly pcbY: number
}): ReactElement {
  const outputs =
    index === 1
      ? ["SOURCE_A0", "SOURCE_A1", "SOURCE_A2", "SOURCE_EN", "SINK_A0", "SINK_A1", "SINK_A2", "SINK_EN"]
      : ["SENSE_A0", "SENSE_A1", "SENSE_A2", "SENSE_EN", "UNUSED_4", "UNUSED_5", "UNUSED_6", "UNUSED_7"]
  return (
    <>
      <P0Sn74Hcs595Footprint name={`U_PHASE_CONTROL_${index}`} pcbX={pcbX} pcbY={pcbY} />
      <capacitor
        name={`C_PHASE_CONTROL_${index}`}
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX + 6}
        pcbY={pcbY}
      />
      <trace from={`U_PHASE_CONTROL_${index}.APP_3V3`} to="net.APP_3V3" />
      <trace from={`U_PHASE_CONTROL_${index}.APP_GND`} to="net.APP_GND" />
      <trace from={`U_PHASE_CONTROL_${index}.APP_RESET_N`} to="net.APP_RESET_N" />
      <trace from={`U_PHASE_CONTROL_${index}.APP_SPI_SCK`} to="net.APP_SPI_SCK" />
      <trace from={`U_PHASE_CONTROL_${index}.SOURCE_LATCH`} to="net.SOURCE_LATCH" />
      <trace from={`U_PHASE_CONTROL_${index}.SOURCE_OE_N`} to="net.SOURCE_OE_N" />
      <trace from={`U_PHASE_CONTROL_${index}.APP_3V3`} to={`C_PHASE_CONTROL_${index}.pin1`} />
      <trace from={`C_PHASE_CONTROL_${index}.pin2`} to="net.APP_GND" />
      {outputs.map((net, bit) =>
        net.startsWith("UNUSED_") ? null : (
          <Fragment key={net}>
            <trace from={`U_PHASE_CONTROL_${index}.Q${bit}`} to={`net.${net}`} />
          </Fragment>
        )
      )}
    </>
  )
}

export function P0SevenLineAcquisition({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group
      name="P0_PHASED_SEVEN_CONDUCTOR_ACQUISITION"
      pcbX={pcbX}
      pcbY={pcbY}
      pcbPositionMode="relative_to_board_anchor"
      pcbPack={false}
    >
      <P0Tmux1208Footprint name="U_SOURCE_MUX" {...acquisitionPlacement.muxes.source} />
      <P0Tmux1208Footprint name="U_SINK_MUX" {...acquisitionPlacement.muxes.sink} />
      <P0Tmux1208Footprint name="U_SENSE_MUX" {...acquisitionPlacement.muxes.sense} />
      {(["SOURCE", "SINK", "SENSE"] as const).map((role) => {
        const rolePlacement = {
          SOURCE: { capacitor: { pcbX: -29, pcbY: -20 }, enablePull: { pcbX: -46, pcbY: -20 } },
          SINK: { capacitor: { pcbX: -29, pcbY: 8 }, enablePull: { pcbX: -46, pcbY: 8 } },
          SENSE: { capacitor: { pcbX: 12, pcbY: -4 }, enablePull: { pcbX: -2, pcbY: -4 } }
        }[role]
        return (
          <Fragment key={role}>
            <capacitor
              name={`C_${role}_MUX`}
              manufacturerPartNumber="C0603C104K3RACTU"
              capacitance="100nF"
              footprint="0603"
              {...rolePlacement.capacitor}
            />
            <trace from={`U_${role}_MUX.APP_3V3`} to="net.APP_3V3" />
            <trace from={`U_${role}_MUX.SCORING_SGND`} to="net.SCORING_SGND" />
            <trace from={`U_${role}_MUX.APP_3V3`} to={`C_${role}_MUX.pin1`} />
            <trace from={`C_${role}_MUX.pin2`} to="net.SCORING_SGND" />
            <trace from={`U_${role}_MUX.A0`} to={`net.${role}_A0`} />
            <trace from={`U_${role}_MUX.A1`} to={`net.${role}_A1`} />
            <trace from={`U_${role}_MUX.A2`} to={`net.${role}_A2`} />
            <trace from={`U_${role}_MUX.EN`} to={`net.${role}_EN`} />
            <resistor
              name={`R_${role}_EN_PD`}
              manufacturerPartNumber="CRCW0603100KFKEAHP"
              resistance="100k"
              tolerance="1%"
              footprint="0603"
              {...rolePlacement.enablePull}
            />
            <trace from={`net.${role}_EN`} to={`R_${role}_EN_PD.pin1`} />
            <trace from={`R_${role}_EN_PD.pin2`} to="net.SCORING_SGND" />
          </Fragment>
        )
      })}

      <PhaseControl index={1} {...acquisitionPlacement.phaseControls.first} />
      <PhaseControl index={2} {...acquisitionPlacement.phaseControls.second} />
      <resistor
        name="R_PHASE_OE_PULLUP"
        manufacturerPartNumber="CRCW0603100KFKEAHP"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
        {...acquisitionPlacement.phaseControls.outputEnablePullup}
      />
      <trace from="net.SOURCE_OE_N" to="R_PHASE_OE_PULLUP.pin1" />
      <trace from="R_PHASE_OE_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="net.APP_SPI_MOSI" to="U_PHASE_CONTROL_1.SERIAL_IN" />
      <trace from="U_PHASE_CONTROL_1.SERIAL_OUT" to="U_PHASE_CONTROL_2.SERIAL_IN" />

      <P0Ref5025Footprint name="U_REF" {...acquisitionPlacement.sharedAnalog.reference} />
      <capacitor
        name="C_REF_IN"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.referenceInputCapacitor}
      />
      <P0T521BFootprint name="C_REF_REG" {...acquisitionPlacement.sharedAnalog.referenceRegulator} />
      <capacitor
        name="C_REF_REG_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.referenceRegulatorHfCapacitor}
      />
      <resistor
        name="R_REF_SAR"
        manufacturerPartNumber="RCWE0603R220FKEA"
        resistance="0.22"
        tolerance="1%"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.referenceSarResistor}
      />
      <capacitor
        name="C_REF_SAR"
        manufacturerPartNumber="GRM21BR71A106KE51L"
        capacitance="10uF"
        footprint="0805"
        {...acquisitionPlacement.sharedAnalog.referenceSarCapacitor}
      />
      <trace from="U_REF.V5_ANALOG" to="net.V5_ANALOG" />
      <trace from="U_REF.SCORING_SGND" to="net.SCORING_SGND" />
      <trace from="U_REF.V5_ANALOG" to="C_REF_IN.pin1" />
      <trace from="C_REF_IN.pin2" to="net.SCORING_SGND" />
      <trace from="U_REF.VREF_2V5" to="net.VREF_2V5" />
      <trace from="U_REF.VREF_2V5" to="C_REF_REG.pin2" />
      <trace from="U_REF.VREF_2V5" to="C_REF_REG_HF.pin1" />
      <trace from="C_REF_REG.pin1" to="net.SCORING_SGND" />
      <trace from="C_REF_REG_HF.pin2" to="net.SCORING_SGND" />
      <trace from="net.VREF_2V5" to="U_SOURCE_MUX.D" />

      <P0Tps60400Footprint name="U_NEGATIVE_RAIL" {...acquisitionPlacement.sharedAnalog.negativeRail} />
      <capacitor
        name="C_NEG_IN"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.negativeInputCapacitor}
      />
      <capacitor
        name="C_NEG_FLY"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.negativeFlyCapacitor}
      />
      <capacitor
        name="C_NEG_OUT"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.negativeOutputCapacitor}
      />
      <trace from="U_NEGATIVE_RAIL.V5_ANALOG" to="net.V5_ANALOG" />
      <trace from="U_NEGATIVE_RAIL.SCORING_SGND" to="net.SCORING_SGND" />
      <trace from="U_NEGATIVE_RAIL.VNEG_ANALOG" to="net.VNEG_ANALOG" />
      <trace from="U_NEGATIVE_RAIL.V5_ANALOG" to="C_NEG_IN.pin1" />
      <trace from="C_NEG_IN.pin2" to="net.SCORING_SGND" />
      <trace from="U_NEGATIVE_RAIL.CFLY_NEG" to="C_NEG_FLY.pin1" />
      <trace from="U_NEGATIVE_RAIL.CFLY_POS" to="C_NEG_FLY.pin2" />
      <trace from="U_NEGATIVE_RAIL.VNEG_ANALOG" to="C_NEG_OUT.pin1" />
      <trace from="C_NEG_OUT.pin2" to="net.SCORING_SGND" />

      {[1, 2].map((index) => (
        <P0Tpd4e05u06Footprint key={index} name={`U_ESD_${index}`} {...acquisitionPlacement.esd[index - 1]} />
      ))}
      <trace from="U_ESD_1.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_1.SCORING_SGND_8" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_8" to="net.SCORING_SGND" />

      {p0SevenLineAcquisition.conductors.map(({ line, muxChannel, senseBuffer }, index) => {
        const esdPort = esdPortByLine.get(line)
        if (esdPort === undefined) throw new RangeError(`No ESD port for ${line}`)
        const placement = acquisitionPlacement.conductors[index]
        if (placement === undefined) throw new RangeError(`No placement for ${line}`)
        if ((senseBuffer === null) !== (placement.sense === null)) {
          throw new RangeError(`Sense-buffer placement does not match ${line}`)
        }
        const protectedNet = `${line}_PROTECTED`
        return (
          <Fragment key={line}>
            <resistor
              name={`R_LINE_${index + 1}`}
              manufacturerPartNumber="CRCW060322R0FKEAHP"
              resistance="22"
              tolerance="1%"
              footprint="0603"
              {...placement.line}
            />
            <resistor
              name={`R_SOURCE_${index + 1}`}
              manufacturerPartNumber="TNPW0603470RBEEA"
              resistance="470"
              tolerance="0.1%"
              footprint="0603"
              {...placement.source}
            />
            <resistor
              name={`R_SINK_${index + 1}`}
              manufacturerPartNumber="TNPW0603470RBEEA"
              resistance="470"
              tolerance="0.1%"
              footprint="0603"
              {...placement.sink}
            />
            <trace from={`net.${line}`} to={esdPort} />
            <trace from={`net.${line}`} to={`R_LINE_${index + 1}.pin1`} />
            <trace from={`R_LINE_${index + 1}.pin2`} to={`net.${protectedNet}`} />
            <trace from={`net.${protectedNet}`} to={`R_SOURCE_${index + 1}.pin1`} />
            <trace from={`R_SOURCE_${index + 1}.pin2`} to={`U_SOURCE_MUX.S${muxChannel}`} />
            <trace from={`net.${protectedNet}`} to={`R_SINK_${index + 1}.pin1`} />
            <trace from={`R_SINK_${index + 1}.pin2`} to={`U_SINK_MUX.S${muxChannel}`} />
            {senseBuffer === null ? null : (
              <>
                <P0Ada4177Footprint name={senseBuffer} pcbX={placement.sense?.pcbX} pcbY={placement.sense?.pcbY} />
                <capacitor
                  name={`C_SENSE_POS_${index + 1}`}
                  manufacturerPartNumber="C0603C104K3RACTU"
                  capacitance="100nF"
                  footprint="0603"
                  {...(placement.sense?.positive ?? {})}
                />
                <capacitor
                  name={`C_SENSE_NEG_${index + 1}`}
                  manufacturerPartNumber="C0603C104K3RACTU"
                  capacitance="100nF"
                  footprint="0603"
                  {...(placement.sense?.negative ?? {})}
                />
                <trace from={`net.${protectedNet}`} to={`${senseBuffer}.INPUT`} />
                <trace from={`${senseBuffer}.OUTPUT`} to={`${senseBuffer}.INVERTING`} />
                <trace from={`${senseBuffer}.OUTPUT`} to={`U_SENSE_MUX.S${muxChannel}`} />
                <trace from={`${senseBuffer}.V5_ANALOG`} to="net.V5_ANALOG" />
                <trace from={`${senseBuffer}.VNEG_ANALOG`} to="net.VNEG_ANALOG" />
                <trace from={`${senseBuffer}.V5_ANALOG`} to={`C_SENSE_POS_${index + 1}.pin1`} />
                <trace from={`C_SENSE_POS_${index + 1}.pin2`} to="net.SCORING_SGND" />
                <trace from={`${senseBuffer}.VNEG_ANALOG`} to={`C_SENSE_NEG_${index + 1}.pin1`} />
                <trace from={`C_SENSE_NEG_${index + 1}.pin2`} to="net.SCORING_SGND" />
              </>
            )}
          </Fragment>
        )
      })}

      <trace from="U_SINK_MUX.D" to="net.SCORING_SGND" />
      <resistor
        name="R_SAR"
        manufacturerPartNumber="CRCW060320R0FKEAHP"
        resistance="20"
        tolerance="1%"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.sarInputResistor}
      />
      <capacitor
        name="C_SAR"
        manufacturerPartNumber="C0603C102J5GACTU"
        capacitance="1nF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.sarInputCapacitor}
      />
      <P0Ads8881Footprint name="U_SAR" {...acquisitionPlacement.sharedAnalog.sar} />
      <capacitor
        name="C_SAR_AVDD"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.sarAvddCapacitor}
      />
      <capacitor
        name="C_SAR_DVDD"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        {...acquisitionPlacement.sharedAnalog.sarDvddCapacitor}
      />
      <trace from="U_SENSE_MUX.D" to="R_SAR.pin1" />
      <trace from="R_SAR.pin2" to="U_SAR.AINP" />
      <trace from="R_SAR.pin2" to="C_SAR.pin1" />
      <trace from="C_SAR.pin2" to="net.SCORING_SGND" />
      <trace from="U_SAR.AINN" to="net.SCORING_SGND" />
      <trace from="U_SAR.SCORING_SGND" to="net.SCORING_SGND" />
      <trace from="U_SAR.AVDD_3V3" to="net.APP_3V3" />
      <trace from="U_SAR.DVDD_3V3" to="net.APP_3V3" />
      <trace from="U_SAR.AVDD_3V3" to="C_SAR_AVDD.pin1" />
      <trace from="C_SAR_AVDD.pin2" to="net.SCORING_SGND" />
      <trace from="U_SAR.DVDD_3V3" to="C_SAR_DVDD.pin1" />
      <trace from="C_SAR_DVDD.pin2" to="net.SCORING_SGND" />
      <trace from="net.VREF_2V5" to="R_REF_SAR.pin1" />
      <trace from="R_REF_SAR.pin2" to="U_SAR.REF_2V5" />
      <trace from="R_REF_SAR.pin2" to="C_REF_SAR.pin1" />
      <trace from="C_REF_SAR.pin2" to="net.SCORING_SGND" />
      <trace from="U_SAR.SAR_CONVST" to="net.SAR_CONVST" />
      <trace from="U_SAR.SAR_SCLK" to="net.SAR_SCLK" />
      <trace from="U_SAR.SAR_DOUT" to="net.SAR_DOUT" />
      <trace from="U_SAR.SAR_DIN" to="net.SCORING_SGND" />
    </group>
  )
}

export default function P0SevenLineAcquisitionCircuit(): ReactElement {
  return (
    <board title="P0-03 phased seven-conductor acquisition" width="180mm" height="120mm" layers={4}>
      <P0SevenLineAcquisition pcbX={0} pcbY={0} />
    </board>
  )
}
