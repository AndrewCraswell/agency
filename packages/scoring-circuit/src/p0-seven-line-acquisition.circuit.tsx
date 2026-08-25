import { type ReactElement } from "react"
import { p0SevenLineAcquisition } from "./p0-seven-line-acquisition.js"

type Channel = (typeof p0SevenLineAcquisition.channels)[number]

const esdPortByLine = new Map(
  p0SevenLineAcquisition.esdLaneAssignment.assigned.map(({ lane, line, protector }) => [
    line,
    `${protector}.LINE_${lane}`
  ])
)

/**
 * P0-03 is an electrically named circuit block, not a footprint or fabrication
 * release. The retained IC package geometries remain intentionally DNP here
 * until their independently reviewed footprints can be accepted.
 */
function P0SevenLineCell({ channel }: { readonly channel: Channel }): ReactElement {
  const index = channel.chainIndex
  const x = -92 + (index % 2) * 94
  const y = 58 - Math.floor((index - 1) / 2) * 36
  const referenceNet = `REF_2V5_${index}`
  const switchPackage = Math.floor((index - 1) / 4) + 1
  const switchLane = ((index - 1) % 4) + 1
  const sourceEnableNet = p0SevenLineAcquisition.sourceControl.outputs[index - 1]?.net
  if (sourceEnableNet === undefined) throw new RangeError(`P0 cell ${channel.line} has no source-control output`)
  const linePort = esdPortByLine.get(channel.line)
  if (linePort === undefined) throw new RangeError(`P0 cell ${channel.line} has no assigned TPD4E05U06 lane`)

  return (
    <group name={`P0_ACQUISITION_CELL_${index}`}>
      <chip
        name={`U_REF_${index}`}
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="REF5025AQDRQ1"
        pinLabels={{ pin2: "V5_ANALOG", pin4: "SCORING_SGND", pin6: "VREF_2V5" }}
        pcbX={x - 8}
        pcbY={y + 12}
      />
      <capacitor
        name={`C_REF_IN_${index}`}
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={x - 17}
        pcbY={y + 12}
      />
      <capacitor
        name={`C_REF_REG_${index}`}
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="T521B106M025ATE100"
        capacitance="10uF"
        pcbX={x + 1}
        pcbY={y + 15}
      />
      <capacitor
        name={`C_REF_REG_HF_${index}`}
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={x + 2}
        pcbY={y + 9}
      />
      <resistor
        name={`R_REF_SAR_${index}`}
        manufacturerPartNumber="RCWE0603R220FKEA"
        resistance="0.22"
        tolerance="1%"
        footprint="0603"
        pcbX={x + 12}
        pcbY={y + 11}
      />
      <capacitor
        name={`C_REF_${index}`}
        manufacturerPartNumber="GRM21BR71A106KE51L"
        capacitance="10uF"
        footprint="0805"
        pcbX={x + 19}
        pcbY={y + 11}
      />
      <resistor
        name={`R_SOURCE_${index}`}
        manufacturerPartNumber="ERA3AEB2491V"
        resistance="2.49k"
        tolerance="0.1%"
        footprint="0603"
        pcbX={x - 6}
        pcbY={y + 2}
      />
      <resistor
        name={`R_SOURCE_PD_${index}`}
        manufacturerPartNumber="CRCW0603100KFKEAHP"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
        pcbX={x - 8}
        pcbY={y - 11}
      />
      <resistor
        name={`R_ESD_${index}`}
        manufacturerPartNumber="CRCW060322R0FKEAHP"
        resistance="22"
        tolerance="1%"
        footprint="0603"
        pcbX={x - 17}
        pcbY={y + 3}
      />
      <chip
        name={`U_OVP_BUFFER_${index}`}
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="ADA4177-1ARZ"
        pinLabels={{
          pin2: "BUFFER_INVERTING",
          pin3: "BUFFER_INPUT",
          pin4: "VNEG_ANALOG",
          pin6: "BUFFER_OUTPUT",
          pin7: "V5_ANALOG"
        }}
        pcbX={x + 18}
        pcbY={y - 2}
      />
      <capacitor
        name={`C_BUFFER_POS_${index}`}
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={x + 15}
        pcbY={y - 9}
      />
      <capacitor
        name={`C_BUFFER_NEG_${index}`}
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={x + 22}
        pcbY={y - 9}
      />
      <resistor
        name={`R_SAR_${index}`}
        manufacturerPartNumber="CRCW060320R0FKEAHP"
        resistance="20"
        tolerance="1%"
        footprint="0603"
        pcbX={x + 29}
        pcbY={y + 2}
      />
      <capacitor
        name={`C_SAR_${index}`}
        manufacturerPartNumber="C0603C102J5GACTU"
        capacitance="1nF"
        footprint="0603"
        pcbX={x + 33}
        pcbY={y - 6}
      />
      <chip
        name={channel.adc}
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
        pcbX={x + 34}
        pcbY={y - 14}
      />
      <capacitor
        name={`C_SAR_AVDD_${index}`}
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={x + 43}
        pcbY={y - 11}
      />
      <capacitor
        name={`C_SAR_DVDD_${index}`}
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={x + 43}
        pcbY={y - 17}
      />

      <trace from={`net.${channel.line}`} to={linePort} />
      <trace from={linePort} to={`R_ESD_${index}.pin1`} />
      <trace from={`R_ESD_${index}.pin2`} to={`U_OVP_BUFFER_${index}.BUFFER_INPUT`} />
      <trace from={`U_OVP_BUFFER_${index}.BUFFER_OUTPUT`} to={`U_OVP_BUFFER_${index}.BUFFER_INVERTING`} />
      <trace from={`U_OVP_BUFFER_${index}.BUFFER_OUTPUT`} to={`R_SAR_${index}.pin1`} />
      <trace from={`R_SAR_${index}.pin2`} to={`${channel.adc}.AINP`} />
      <trace from={`R_SAR_${index}.pin2`} to={`C_SAR_${index}.pin1`} />
      <trace from={`C_SAR_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`${channel.adc}.AINN`} to="net.SCORING_SGND" />
      <trace from={`U_REF_${index}.V5_ANALOG`} to="net.V5_ANALOG" />
      <trace from={`U_REF_${index}.SCORING_SGND`} to="net.SCORING_SGND" />
      <trace from={`U_REF_${index}.V5_ANALOG`} to={`C_REF_IN_${index}.pin1`} />
      <trace from={`C_REF_IN_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`U_REF_${index}.VREF_2V5`} to={`R_SOURCE_${index}.pin1`} />
      <trace from={`U_REF_${index}.VREF_2V5`} to={`C_REF_REG_${index}.pin1`} />
      <trace from={`U_REF_${index}.VREF_2V5`} to={`C_REF_REG_HF_${index}.pin1`} />
      <trace from={`U_REF_${index}.VREF_2V5`} to={`R_REF_SAR_${index}.pin1`} />
      <trace from={`U_REF_${index}.VREF_2V5`} to={`net.${referenceNet}`} />
      <trace from={`C_REF_REG_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`C_REF_REG_HF_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`R_REF_SAR_${index}.pin2`} to={`${channel.adc}.REF_2V5`} />
      <trace from={`R_REF_SAR_${index}.pin2`} to={`C_REF_${index}.pin1`} />
      <trace from={`C_REF_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`R_SOURCE_${index}.pin2`} to={`U_SOURCE_SWITCH_${switchPackage}.D${switchLane}`} />
      <trace from={`U_SOURCE_SWITCH_${switchPackage}.S${switchLane}`} to={`net.${channel.line}`} />
      <trace from={`U_SOURCE_SWITCH_${switchPackage}.SEL${switchLane}`} to={`net.${sourceEnableNet}`} />
      <trace from={`net.${sourceEnableNet}`} to={`R_SOURCE_PD_${index}.pin1`} />
      <trace from={`R_SOURCE_PD_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`U_OVP_BUFFER_${index}.V5_ANALOG`} to="net.V5_ANALOG" />
      <trace from={`U_OVP_BUFFER_${index}.VNEG_ANALOG`} to="net.VNEG_ANALOG" />
      <trace from={`U_OVP_BUFFER_${index}.V5_ANALOG`} to={`C_BUFFER_POS_${index}.pin1`} />
      <trace from={`C_BUFFER_POS_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`U_OVP_BUFFER_${index}.VNEG_ANALOG`} to={`C_BUFFER_NEG_${index}.pin1`} />
      <trace from={`C_BUFFER_NEG_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`${channel.adc}.SCORING_SGND`} to="net.SCORING_SGND" />
      <trace from={`${channel.adc}.AVDD_3V3`} to="net.APP_3V3" />
      <trace from={`${channel.adc}.DVDD_3V3`} to="net.APP_3V3" />
      <trace from={`${channel.adc}.AVDD_3V3`} to={`C_SAR_AVDD_${index}.pin1`} />
      <trace from={`C_SAR_AVDD_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`${channel.adc}.DVDD_3V3`} to={`C_SAR_DVDD_${index}.pin1`} />
      <trace from={`C_SAR_DVDD_${index}.pin2`} to="net.SCORING_SGND" />
      <trace from={`${channel.adc}.SAR_CONVST`} to="net.SAR_CONVST" />
      <trace from={`${channel.adc}.SAR_SCLK`} to="net.SAR_SCLK" />
    </group>
  )
}

/** Seven-cell acquisition block; all named IC package instances are DNP pending footprint acceptance. */
export function P0SevenLineAcquisition({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="P0_SEVEN_LINE_ACQUISITION" pcbX={pcbX} pcbY={pcbY}>
      {[1, 2].map((switchIndex) => (
        <group key={switchIndex} name={`P0_SOURCE_SWITCH_PACKAGE_${switchIndex}`}>
          <chip
            name={`U_SOURCE_SWITCH_${switchIndex}`}
            doNotPlace
            footprint={[]}
            manufacturerPartNumber="TMUX1112PWR"
            pinLabels={{
              pin1: "SEL1",
              pin2: "D1",
              pin3: "S1",
              pin5: "SCORING_SGND",
              pin6: "S4",
              pin7: "D4",
              pin8: "SEL4",
              pin9: "SEL3",
              pin10: "D3",
              pin11: "S3",
              pin13: "APP_3V3",
              pin14: "S2",
              pin15: "D2",
              pin16: "SEL2"
            }}
          />
          <capacitor
            name={`C_MUX_${switchIndex}`}
            manufacturerPartNumber="C0603C104K3RACTU"
            capacitance="100nF"
            footprint="0603"
          />
          <trace from={`U_SOURCE_SWITCH_${switchIndex}.APP_3V3`} to="net.APP_3V3" />
          <trace from={`U_SOURCE_SWITCH_${switchIndex}.SCORING_SGND`} to="net.SCORING_SGND" />
          <trace from={`U_SOURCE_SWITCH_${switchIndex}.APP_3V3`} to={`C_MUX_${switchIndex}.pin1`} />
          <trace from={`C_MUX_${switchIndex}.pin2`} to="net.SCORING_SGND" />
          {switchIndex === 2 ? <trace from="U_SOURCE_SWITCH_2.SEL4" to="net.SCORING_SGND" /> : null}
        </group>
      ))}
      <chip
        name="U_SOURCE_CONTROL"
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
          pin7: "Q7_NC",
          pin8: "APP_GND",
          pin9: "SERIAL_OUT_NC",
          pin10: "APP_RESET_N",
          pin11: "APP_SPI_SCK",
          pin12: "SOURCE_LATCH",
          pin13: "SOURCE_OE_N",
          pin14: "APP_SPI_MOSI",
          pin15: "Q0",
          pin16: "APP_3V3"
        }}
      />
      <capacitor
        name="C_SOURCE_CONTROL"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <resistor
        name="R_SOURCE_OE_PULLUP"
        manufacturerPartNumber="CRCW0603100KFKEAHP"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
      />
      <trace from="U_SOURCE_CONTROL.APP_3V3" to="net.APP_3V3" />
      <trace from="U_SOURCE_CONTROL.APP_GND" to="net.APP_GND" />
      <trace from="U_SOURCE_CONTROL.APP_SPI_SCK" to="net.APP_SPI_SCK" />
      <trace from="U_SOURCE_CONTROL.APP_SPI_MOSI" to="net.APP_SPI_MOSI" />
      <trace from="U_SOURCE_CONTROL.SOURCE_LATCH" to="net.SOURCE_LATCH" />
      <trace from="U_SOURCE_CONTROL.SOURCE_OE_N" to="net.SOURCE_OE_N" />
      <trace from="U_SOURCE_CONTROL.APP_RESET_N" to="net.APP_RESET_N" />
      <trace from="U_SOURCE_CONTROL.SOURCE_OE_N" to="R_SOURCE_OE_PULLUP.pin1" />
      <trace from="R_SOURCE_OE_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="U_SOURCE_CONTROL.APP_3V3" to="C_SOURCE_CONTROL.pin1" />
      <trace from="C_SOURCE_CONTROL.pin2" to="net.APP_GND" />
      {p0SevenLineAcquisition.sourceControl.outputs.map(({ bit, net }) => (
        <trace key={net} from={`U_SOURCE_CONTROL.Q${bit}`} to={`net.${net}`} />
      ))}
      <chip
        name="U_NEGATIVE_RAIL"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="TPS60400DBVR"
        pinLabels={{ pin1: "VNEG_ANALOG", pin2: "V5_ANALOG", pin3: "CFLY_NEG", pin4: "SCORING_SGND", pin5: "CFLY_POS" }}
        pcbX={-8}
        pcbY={-58}
      />
      <capacitor
        name="C_NEG_IN"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={-18}
        pcbY={-53}
      />
      <capacitor
        name="C_NEG_FLY"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={-18}
        pcbY={-61}
      />
      <capacitor
        name="C_NEG_OUT"
        manufacturerPartNumber="CGA3E3X7R1H105K080AB"
        capacitance="1uF"
        footprint="0603"
        pcbX={2}
        pcbY={-61}
      />

      <chip
        name="U_ESD_1"
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
      <chip
        name="U_ESD_2"
        doNotPlace
        footprint={[]}
        manufacturerPartNumber="TPD4E05U06DQAR"
        pinLabels={{
          pin1: "LINE_1",
          pin2: "LINE_2",
          pin3: "SCORING_SGND_3",
          pin4: "LINE_3",
          pin5: "UNUSED_NO_CONNECT",
          pin8: "SCORING_SGND_8"
        }}
      />
      <trace from="U_ESD_1.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_1.SCORING_SGND_8" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_3" to="net.SCORING_SGND" />
      <trace from="U_ESD_2.SCORING_SGND_8" to="net.SCORING_SGND" />

      {p0SevenLineAcquisition.channels.map((channel) => (
        <P0SevenLineCell key={channel.line} channel={channel} />
      ))}
      <trace from="U_NEGATIVE_RAIL.V5_ANALOG" to="net.V5_ANALOG" />
      <trace from="U_NEGATIVE_RAIL.SCORING_SGND" to="net.SCORING_SGND" />
      <trace from="U_NEGATIVE_RAIL.V5_ANALOG" to="C_NEG_IN.pin1" />
      <trace from="C_NEG_IN.pin2" to="net.SCORING_SGND" />
      <trace from="U_NEGATIVE_RAIL.CFLY_NEG" to="C_NEG_FLY.pin1" />
      <trace from="U_NEGATIVE_RAIL.CFLY_POS" to="C_NEG_FLY.pin2" />
      <trace from="U_NEGATIVE_RAIL.VNEG_ANALOG" to="C_NEG_OUT.pin1" />
      <trace from="C_NEG_OUT.pin2" to="net.SCORING_SGND" />
      <trace from="U_SAR_1.SAR_DIN" to="net.SCORING_SGND" />
      {p0SevenLineAcquisition.channels.slice(0, -1).map((channel) => (
        <trace key={channel.adc} from={`${channel.adc}.SAR_DOUT`} to={`U_SAR_${channel.chainIndex + 1}.SAR_DIN`} />
      ))}
      <trace from="U_SAR_7.SAR_DOUT" to="net.SAR_DOUT" />
    </group>
  )
}

export function P0SevenLineAcquisitionCircuit(): ReactElement {
  return (
    <board title="P0-03 seven-line ESP32 acquisition" width="240mm" height="160mm" layers={4}>
      <P0SevenLineAcquisition pcbX={0} pcbY={0} />
    </board>
  )
}

export default P0SevenLineAcquisitionCircuit
