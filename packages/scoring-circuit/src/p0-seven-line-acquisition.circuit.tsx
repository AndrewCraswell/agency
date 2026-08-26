import { type ReactElement } from "react"
import { p0SevenLineAcquisition } from "./p0-seven-line-acquisition.js"

const esdPortByLine = new Map(
  p0SevenLineAcquisition.conductors.map(({ line }, index) => [
    line,
    `U_ESD_${Math.floor(index / 4) + 1}.LINE_${(index % 4) + 1}`
  ])
)

const tmux1208Pins = {
  pin1: "A0",
  pin2: "EN",
  pin3: "NC",
  pin4: "S1",
  pin5: "S2",
  pin6: "S3",
  pin7: "S4",
  pin8: "D",
  pin9: "S8",
  pin10: "S7",
  pin11: "S6",
  pin12: "S5",
  pin13: "APP_3V3",
  pin14: "SCORING_SGND",
  pin15: "A2",
  pin16: "A1"
} as const

function PhaseControl({ index }: { readonly index: 1 | 2 }): ReactElement {
  const outputs =
    index === 1
      ? ["SOURCE_A0", "SOURCE_A1", "SOURCE_A2", "SOURCE_EN", "SINK_A0", "SINK_A1", "SINK_A2", "SINK_EN"]
      : ["SENSE_A0", "SENSE_A1", "SENSE_A2", "SENSE_EN", "UNUSED_4", "UNUSED_5", "UNUSED_6", "UNUSED_7"]
  return (
    <group name={`P0_PHASE_CONTROL_${index}`}>
      <chip
        name={`U_PHASE_CONTROL_${index}`}
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="SN74HCS595PWR"
        pinLabels={{
          pin1: "Q1",
          pin2: "Q2",
          pin3: "Q3",
          pin4: "Q4",
          pin5: "Q5",
          pin6: "Q6",
          pin7: "Q7",
          pin8: "APP_GND",
          pin9: "SERIAL_OUT",
          pin10: "APP_RESET_N",
          pin11: "APP_SPI_SCK",
          pin12: "SOURCE_LATCH",
          pin13: "SOURCE_OE_N",
          pin14: "SERIAL_IN",
          pin15: "Q0",
          pin16: "APP_3V3"
        }}
      />
      <capacitor
        name={`C_PHASE_CONTROL_${index}`}
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
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
          <trace key={net} from={`U_PHASE_CONTROL_${index}.Q${bit}`} to={`net.${net}`} />
        )
      )}
    </group>
  )
}

export function P0SevenLineAcquisition({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="P0_PHASED_SEVEN_CONDUCTOR_ACQUISITION" pcbX={pcbX} pcbY={pcbY}>
      <chip
        name="U_SOURCE_MUX"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="TMUX1208PWR"
        pinLabels={tmux1208Pins}
      />
      <chip name="U_SINK_MUX" doNotPlace footprint={[]} manufacturerPartNumber="TMUX1208PWR" pinLabels={tmux1208Pins} />
      <chip
        name="U_SENSE_MUX"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="TMUX1208PWR"
        pinLabels={tmux1208Pins}
      />
      {(["SOURCE", "SINK", "SENSE"] as const).map((role) => (
        <group key={role} name={`${role}_MUX_SUPPORT`}>
          <capacitor
            name={`C_${role}_MUX`}
            manufacturerPartNumber="C0603C104K3RACTU"
            capacitance="100nF"
            footprint="0603"
          />
          <trace from={`U_${role}_MUX.APP_3V3`} to="net.APP_3V3" />
          <trace from={`U_${role}_MUX.SCORING_SGND`} to="net.SCORING_SGND" />
          <trace from={`U_${role}_MUX.APP_3V3`} to={`C_${role}_MUX.pin1`} />
          <trace from={`C_${role}_MUX.pin2`} to="net.SCORING_SGND" />
          <trace from={`U_${role}_MUX.A0`} to={`net.${role}_A0`} />
          <trace from={`U_${role}_MUX.A1`} to={`net.${role}_A1`} />
          <trace from={`U_${role}_MUX.A2`} to={`net.${role}_A2`} />
          <trace from={`U_${role}_MUX.EN`} to={`net.${role}_EN`} />
        </group>
      ))}

      <PhaseControl index={1} />
      <PhaseControl index={2} />
      <resistor
        name="R_PHASE_OE_PULLUP"
        manufacturerPartNumber="CRCW0603100KFKEAHP"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
      />
      <trace from="net.SOURCE_OE_N" to="R_PHASE_OE_PULLUP.pin1" />
      <trace from="R_PHASE_OE_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="net.APP_SPI_MOSI" to="U_PHASE_CONTROL_1.SERIAL_IN" />
      <trace from="U_PHASE_CONTROL_1.SERIAL_OUT" to="U_PHASE_CONTROL_2.SERIAL_IN" />

      <chip
        name="U_REF"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="REF5025AQDRQ1"
        pinLabels={{ pin2: "V5_ANALOG", pin4: "SCORING_SGND", pin6: "VREF_2V5" }}
      />
      <capacitor name="C_REF_IN" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
      <capacitor
        name="C_REF_REG"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="T521B106M025ATE100"
        capacitance="10uF"
      />
      <capacitor name="C_REF_REG_HF" manufacturerPartNumber="C0603C104K3RACTU" capacitance="100nF" footprint="0603" />
      <resistor
        name="R_REF_SAR"
        manufacturerPartNumber="RCWE0603R220FKEA"
        resistance="0.22"
        tolerance="1%"
        footprint="0603"
      />
      <capacitor name="C_REF_SAR" manufacturerPartNumber="GRM21BR71A106KE51L" capacitance="10uF" footprint="0805" />
      <trace from="U_REF.V5_ANALOG" to="net.V5_ANALOG" />
      <trace from="U_REF.SCORING_SGND" to="net.SCORING_SGND" />
      <trace from="U_REF.V5_ANALOG" to="C_REF_IN.pin1" />
      <trace from="C_REF_IN.pin2" to="net.SCORING_SGND" />
      <trace from="U_REF.VREF_2V5" to="net.VREF_2V5" />
      <trace from="U_REF.VREF_2V5" to="C_REF_REG.pin1" />
      <trace from="U_REF.VREF_2V5" to="C_REF_REG_HF.pin1" />
      <trace from="C_REF_REG.pin2" to="net.SCORING_SGND" />
      <trace from="C_REF_REG_HF.pin2" to="net.SCORING_SGND" />
      <trace from="net.VREF_2V5" to="U_SOURCE_MUX.D" />

      <chip
        name="U_NEGATIVE_RAIL"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="TPS60400DBVR"
        pinLabels={{ pin1: "VNEG_ANALOG", pin2: "V5_ANALOG", pin3: "CFLY_NEG", pin4: "SCORING_SGND", pin5: "CFLY_POS" }}
      />
      <capacitor name="C_NEG_IN" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
      <capacitor name="C_NEG_FLY" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
      <capacitor name="C_NEG_OUT" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
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
        <chip
          key={index}
          name={`U_ESD_${index}`}
          doNotPlace
          footprint={[]}
          manufacturerPartNumber="TPD4E05U06DQAR"
          pinLabels={{
            pin1: "LINE_1",
            pin2: "LINE_2",
            pin3: "SCORING_SGND_3",
            pin4: "LINE_3",
            pin5: "LINE_4",
            pin8: "SCORING_SGND_8"
          }}
        />
      ))}
      <trace from="U_ESD_1.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_1.SCORING_SGND_8" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_8" to="net.SCORING_SGND" />

      {p0SevenLineAcquisition.conductors.map(({ line, muxChannel, senseBuffer }, index) => {
        const esdPort = esdPortByLine.get(line)
        if (esdPort === undefined) throw new RangeError(`No ESD port for ${line}`)
        const protectedNet = `${line}_PROTECTED`
        return (
          <group key={line} name={`${line}_PHASE_INTERFACE`}>
            <resistor
              name={`R_LINE_${index + 1}`}
              manufacturerPartNumber="CRCW060322R0FKEAHP"
              resistance="22"
              tolerance="1%"
              footprint="0603"
            />
            <resistor name={`R_SOURCE_${index + 1}`} resistance="470" tolerance="0.1%" footprint="0603" />
            <resistor name={`R_SINK_${index + 1}`} resistance="470" tolerance="0.1%" footprint="0603" />
            <trace from={`net.${line}`} to={esdPort} />
            <trace from={`net.${line}`} to={`R_LINE_${index + 1}.pin1`} />
            <trace from={`R_LINE_${index + 1}.pin2`} to={`net.${protectedNet}`} />
            <trace from={`net.${protectedNet}`} to={`R_SOURCE_${index + 1}.pin1`} />
            <trace from={`R_SOURCE_${index + 1}.pin2`} to={`U_SOURCE_MUX.S${muxChannel}`} />
            <trace from={`net.${protectedNet}`} to={`R_SINK_${index + 1}.pin1`} />
            <trace from={`R_SINK_${index + 1}.pin2`} to={`U_SINK_MUX.S${muxChannel}`} />
            {senseBuffer === null ? null : (
              <>
                <chip
                  name={senseBuffer}
                  doNotPlace
                  footprint={[]}
                  manufacturerPartNumber="ADA4177-1ARZ"
                  pinLabels={{
                    pin2: "INVERTING",
                    pin3: "INPUT",
                    pin4: "VNEG_ANALOG",
                    pin6: "OUTPUT",
                    pin7: "V5_ANALOG"
                  }}
                />
                <capacitor
                  name={`C_SENSE_POS_${index + 1}`}
                  manufacturerPartNumber="C0603C104K3RACTU"
                  capacitance="100nF"
                  footprint="0603"
                />
                <capacitor
                  name={`C_SENSE_NEG_${index + 1}`}
                  manufacturerPartNumber="C0603C104K3RACTU"
                  capacitance="100nF"
                  footprint="0603"
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
          </group>
        )
      })}

      <trace from="U_SINK_MUX.D" to="net.SCORING_SGND" />
      <resistor
        name="R_SAR"
        manufacturerPartNumber="CRCW060320R0FKEAHP"
        resistance="20"
        tolerance="1%"
        footprint="0603"
      />
      <capacitor name="C_SAR" manufacturerPartNumber="C0603C102J5GACTU" capacitance="1nF" footprint="0603" />
      <chip
        name="U_SAR"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="ADS8881IDGS"
        pinLabels={{
          pin1: "REF_2V5",
          pin2: "AVDD_3V3",
          pin3: "AINP",
          pin4: "AINN",
          pin5: "SCORING_SGND",
          pin6: "SAR_CONVST",
          pin7: "SAR_DOUT",
          pin8: "SAR_SCLK",
          pin9: "SAR_DIN",
          pin10: "DVDD_3V3"
        }}
      />
      <capacitor name="C_SAR_AVDD" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
      <capacitor name="C_SAR_DVDD" manufacturerPartNumber="CGA3E3X7R1H105K080AB" capacitance="1uF" footprint="0603" />
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
