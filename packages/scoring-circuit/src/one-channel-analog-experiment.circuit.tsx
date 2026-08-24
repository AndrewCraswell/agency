/**
 * One-channel protected acquisition experiment. This standalone board is DNP
 * and is never imported by the apparatus build.
 */
export default function OneChannelAnalogExperimentCircuit() {
  return (
    <board title="One-channel protected analog experiment" width="78mm" height="62mm" layers={4}>
      <pinheader
        name="J_FIXTURE"
        pinCount={3}
        pinLabels={{ pin1: "LINE", pin2: "SGND", pin3: "ESD_RETURN_RESERVED_NC" }}
        gender="male"
        pcbX={-32}
        pcbY={23}
      />
      <pinheader
        name="J_GUARDED_FORCE"
        pinCount={2}
        pinLabels={{ pin1: "FORCE", pin2: "SGND" }}
        gender="male"
        pcbX={-32}
        pcbY={12}
      />
      <pinheader
        name="J_UPSTREAM_5V"
        pinCount={2}
        pinLabels={{ pin1: "SYSTEM_5V", pin2: "SYSTEM_GND" }}
        gender="male"
        pcbX={-32}
        pcbY={0}
      />
      <pinheader
        name="J_CONTROL"
        pinCount={2}
        pinLabels={{ pin1: "SOURCE_EN", pin2: "SGND" }}
        gender="male"
        pcbX={-32}
        pcbY={-10}
      />
      <pinheader
        name="J_ADC_IO"
        pinCount={4}
        pinLabels={{ pin1: "SPI_CONVST", pin2: "SPI_DOUT", pin3: "SPI_SCLK", pin4: "SPI_DIN" }}
        gender="male"
        pcbX={26}
        pcbY={-27}
      />
      <pinheader
        name="J_FIXTURE_STATUS"
        pinCount={5}
        pinLabels={{
          pin1: "FIXTURE_PERMIT_OBS",
          pin2: "FORCE_RELAY_OBS",
          pin3: "SOURCE_GATE_OBS",
          pin4: "MUTEX_OBS",
          pin5: "WATCHDOG_OK_OBS"
        }}
        gender="male"
        pcbX={-28}
        pcbY={-22}
      />

      <chip
        name="U_ISO"
        manufacturerPartNumber="NXE1S0505MC"
        footprint="sip7"
        pinLabels={{ pin1: "SYSTEM_5V", pin2: "SYSTEM_GND", pin6: "S5V_ISO", pin7: "SGND" }}
        pcbX={-16}
        pcbY={0}
      />
      <capacitor
        name="C_ISO_IN"
        manufacturerPartNumber="GRM188R71A225KE15D"
        capacitance="2.2uF"
        footprint="0603"
        pcbX={-25}
        pcbY={-4}
      />
      <capacitor
        name="C_ISO_OUT"
        manufacturerPartNumber="GRM188R71A225KE15D"
        capacitance="2.2uF"
        footprint="0603"
        pcbX={-11}
        pcbY={5}
      />
      <chip
        name="U_NEGATIVE_RAIL"
        manufacturerPartNumber="TPS60400DBVR"
        footprint="sot23-5"
        pinLabels={{ pin1: "S5V_NEG", pin2: "S5V_ISO", pin3: "CFLY_NEG", pin4: "SGND", pin5: "CFLY_POS" }}
        pcbX={-5}
        pcbY={-6}
      />
      <chip
        name="U_3V3"
        manufacturerPartNumber="TPS7A2033PDBVR"
        footprint="sot23-5"
        pinLabels={{ pin1: "S5V_ISO", pin2: "SGND", pin3: "ENABLE_S5V", pin4: "NC", pin5: "S3V3_ISO" }}
        pcbX={-5}
        pcbY={2}
      />
      <chip
        name="U_REF"
        manufacturerPartNumber="REF5025AQDRQ1"
        footprint="soic8"
        pinLabels={{ pin2: "S5V_ISO", pin4: "SGND", pin6: "REF_2V5" }}
        pcbX={7}
        pcbY={16}
      />
      <capacitor
        name="C_REF_IN"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={1}
        pcbY={16}
      />
      <capacitor
        name="C_REF_REG_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={12}
        pcbY={16}
      />
      <capacitor
        name="C_REF_REG"
        manufacturerPartNumber="T521B106M025ATE100"
        capacitance="10uF"
        footprint="1411"
        pcbX={13}
        pcbY={19}
      />

      <chip
        name="U_ESD"
        manufacturerPartNumber="TPD4E05U06DQAR"
        footprint="uson10"
        pinLabels={{ pin1: "LINE_SHUNT", pin3: "SGND_3", pin8: "SGND_8" }}
        pcbX={-17}
        pcbY={22}
      />
      <resistor
        name="R_ESD"
        manufacturerPartNumber="CRCW060322R0FKEAHP"
        resistance="22"
        tolerance="1%"
        footprint="0603"
        pcbX={-6}
        pcbY={22}
      />
      <resistor
        name="R_FAULT_GUARD"
        manufacturerPartNumber="CRCW120656K0FKEAHP"
        resistance="56k"
        tolerance="1%"
        footprint="1206"
        pcbX={-17}
        pcbY={12}
      />
      <chip
        name="U_SOURCE_SWITCH"
        manufacturerPartNumber="TMUX1112PWR"
        footprint="tssop16"
        pinLabels={{
          pin1: "SOURCE_EN",
          pin2: "QUIET",
          pin3: "SOURCE_PATH",
          pin4: "NC",
          pin5: "SGND",
          pin6: "UNUSED_S4",
          pin7: "UNUSED_D4",
          pin8: "UNUSED_SEL4",
          pin9: "UNUSED_SEL3",
          pin10: "UNUSED_D3",
          pin11: "UNUSED_S3",
          pin12: "NC",
          pin13: "S3V3_ISO",
          pin14: "UNUSED_S2",
          pin15: "UNUSED_D2",
          pin16: "UNUSED_SEL2"
        }}
        pcbX={5}
        pcbY={5}
      />
      <resistor
        name="R_SOURCE"
        manufacturerPartNumber="ERA3AEB2491V"
        resistance="2.49k"
        tolerance="0.1%"
        footprint="0603"
        pcbX={15}
        pcbY={7}
      />
      <resistor name="R_SOURCE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={0} pcbY={-14} />

      <chip
        name="U_OVP_BUFFER"
        manufacturerPartNumber="ADA4177-1BRZ"
        footprint="soic8"
        pinLabels={{
          pin2: "BUFFER_INVERTING",
          pin3: "BUFFER_INPUT",
          pin4: "S5V_NEG",
          pin6: "BUFFER_OUTPUT",
          pin7: "S5V_ISO"
        }}
        pcbX={20}
        pcbY={0}
      />
      <capacitor
        name="C_BUFFER_POS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={17}
        pcbY={-5}
      />
      <capacitor
        name="C_BUFFER_NEG"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={24}
        pcbY={-5}
      />
      <resistor
        name="R_SAR"
        manufacturerPartNumber="CRCW060320R0FKEAHP"
        resistance="20"
        tolerance="1%"
        footprint="0603"
        pcbX={30}
        pcbY={2}
      />
      <capacitor
        name="C_SAR"
        manufacturerPartNumber="C0603C102J5GACTU"
        capacitance="1nF"
        footprint="0603"
        pcbX={34}
        pcbY={-4}
      />
      <chip
        name="U_SAR"
        manufacturerPartNumber="ADS8881IDGS"
        footprint="vssop10"
        pinLabels={{
          pin1: "REF_2V5",
          pin2: "AVDD_3V3",
          pin3: "AINP",
          pin4: "AINN",
          pin5: "SGND",
          pin6: "SPI_CONVST",
          pin7: "SPI_DOUT",
          pin8: "SPI_SCLK",
          pin9: "SPI_DIN",
          pin10: "DVDD_3V3"
        }}
        pcbX={34}
        pcbY={-15}
      />
      <capacitor
        name="C_REF"
        manufacturerPartNumber="GRM21BR71A106KE51L"
        capacitance="10uF"
        footprint="0805"
        pcbX={18}
        pcbY={-17}
      />
      <resistor
        name="R_REF_SAR"
        manufacturerPartNumber="RCWE0603R220FKEA"
        resistance="0.22ohm"
        footprint="0603"
        pcbX={24}
        pcbY={-17}
      />
      <capacitor
        name="C_SAR_AVDD"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={43}
        pcbY={-12}
      />
      <capacitor
        name="C_SAR_DVDD"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={43}
        pcbY={-18}
      />
      <capacitor
        name="C_MUX"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={5}
        pcbY={-5}
      />
      <capacitor
        name="C_NEG_FLY"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={-10}
        pcbY={-12}
      />
      <capacitor
        name="C_NEG_IN"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={-10}
        pcbY={-6}
      />
      <capacitor
        name="C_NEG_OUT"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={-10}
        pcbY={-18}
      />
      <capacitor
        name="C_3V3_IN"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={-4}
        pcbY={8}
      />
      <capacitor
        name="C_3V3_OUT"
        manufacturerPartNumber="GRM188R71A105KA12D"
        capacitance="1uF"
        footprint="0603"
        pcbX={4}
        pcbY={8}
      />

      <pinheader name="TP_LINE" pinCount={1} pinLabels={["LINE"]} pcbX={-25} pcbY={29} />
      <pinheader name="TP_QUIET" pinCount={1} pinLabels={["QUIET"]} pcbX={7} pcbY={29} />
      <pinheader name="TP_BUFFER_IN" pinCount={1} pinLabels={["BUFFER_INPUT"]} pcbX={19} pcbY={29} />
      <pinheader name="TP_BUFFER_OUT" pinCount={1} pinLabels={["BUFFER_OUTPUT"]} pcbX={30} pcbY={29} />
      <pinheader name="TP_AINP" pinCount={1} pinLabels={["AINP"]} pcbX={36} pcbY={29} />
      <pinheader name="TP_AINN" pinCount={1} pinLabels={["AINN"]} pcbX={41} pcbY={29} />
      <pinheader name="TP_REF" pinCount={1} pinLabels={["REF_2V5"]} pcbX={13} pcbY={29} />
      <pinheader name="TP_S5V_NEG" pinCount={1} pinLabels={["S5V_NEG"]} pcbX={-2} pcbY={-25} />

      <trace from="J_FIXTURE.LINE" to="U_ESD.LINE_SHUNT" />
      <trace from="J_FIXTURE.SGND" to="net.SGND" />
      <trace from="U_ESD.SGND_3" to="net.SGND" />
      <trace from="U_ESD.SGND_8" to="net.SGND" />
      <trace from="J_GUARDED_FORCE.SGND" to="net.SGND" />
      <trace from="J_GUARDED_FORCE.FORCE" to="R_FAULT_GUARD.pin1" />
      <trace from="R_FAULT_GUARD.pin2" to="J_FIXTURE.LINE" />
      <trace from="J_FIXTURE.LINE" to="R_ESD.pin1" />
      <trace from="R_ESD.pin2" to="U_SOURCE_SWITCH.QUIET" />
      <trace from="U_SOURCE_SWITCH.QUIET" to="U_OVP_BUFFER.BUFFER_INPUT" />
      <trace from="U_SOURCE_SWITCH.QUIET" to="TP_QUIET.QUIET" />
      <trace from="U_OVP_BUFFER.BUFFER_INPUT" to="TP_BUFFER_IN.BUFFER_INPUT" />
      <trace from="U_OVP_BUFFER.BUFFER_OUTPUT" to="U_OVP_BUFFER.BUFFER_INVERTING" />
      <trace from="U_OVP_BUFFER.BUFFER_OUTPUT" to="R_SAR.pin1" />
      <trace from="U_OVP_BUFFER.BUFFER_OUTPUT" to="TP_BUFFER_OUT.BUFFER_OUTPUT" />
      <trace from="R_SAR.pin2" to="U_SAR.AINP" />
      <trace from="R_SAR.pin2" to="C_SAR.pin1" />
      <trace from="C_SAR.pin2" to="net.SGND" />
      <trace from="U_SAR.AINP" to="TP_AINP.AINP" />
      <trace from="U_SAR.AINN" to="net.SGND" />
      <trace from="U_SAR.AINN" to="TP_AINN.AINN" />
      <trace from="U_SAR.SPI_CONVST" to="J_ADC_IO.SPI_CONVST" />
      <trace from="U_SAR.SPI_DOUT" to="J_ADC_IO.SPI_DOUT" />
      <trace from="U_SAR.SPI_SCLK" to="J_ADC_IO.SPI_SCLK" />
      <trace from="U_SAR.SPI_DIN" to="J_ADC_IO.SPI_DIN" />
      <trace from="J_UPSTREAM_5V.SYSTEM_5V" to="U_ISO.SYSTEM_5V" />
      <trace from="J_UPSTREAM_5V.SYSTEM_GND" to="U_ISO.SYSTEM_GND" />
      <trace from="U_ISO.SYSTEM_5V" to="C_ISO_IN.pin1" />
      <trace from="C_ISO_IN.pin2" to="U_ISO.SYSTEM_GND" />
      <trace from="U_ISO.S5V_ISO" to="U_NEGATIVE_RAIL.S5V_ISO" />
      <trace from="U_ISO.S5V_ISO" to="U_3V3.S5V_ISO" />
      <trace from="U_ISO.S5V_ISO" to="U_REF.S5V_ISO" />
      <trace from="U_ISO.SGND" to="net.SGND" />
      <trace from="U_ISO.S5V_ISO" to="C_ISO_OUT.pin1" />
      <trace from="C_ISO_OUT.pin2" to="net.SGND" />
      <trace from="U_NEGATIVE_RAIL.SGND" to="net.SGND" />
      <trace from="U_NEGATIVE_RAIL.S5V_ISO" to="C_NEG_IN.pin1" />
      <trace from="C_NEG_IN.pin2" to="net.SGND" />
      <trace from="U_NEGATIVE_RAIL.CFLY_NEG" to="C_NEG_FLY.pin1" />
      <trace from="U_NEGATIVE_RAIL.CFLY_POS" to="C_NEG_FLY.pin2" />
      <trace from="U_NEGATIVE_RAIL.S5V_NEG" to="C_NEG_OUT.pin1" />
      <trace from="C_NEG_OUT.pin2" to="net.SGND" />
      <trace from="U_NEGATIVE_RAIL.S5V_NEG" to="U_OVP_BUFFER.S5V_NEG" />
      <trace from="U_NEGATIVE_RAIL.S5V_NEG" to="TP_S5V_NEG.S5V_NEG" />
      <trace from="U_OVP_BUFFER.S5V_NEG" to="C_BUFFER_NEG.pin1" />
      <trace from="C_BUFFER_NEG.pin2" to="net.SGND" />
      <trace from="U_3V3.SGND" to="net.SGND" />
      <trace from="U_3V3.S5V_ISO" to="U_3V3.ENABLE_S5V" />
      <trace from="U_3V3.S5V_ISO" to="C_3V3_IN.pin1" />
      <trace from="C_3V3_IN.pin2" to="net.SGND" />
      <trace from="U_3V3.S3V3_ISO" to="U_SOURCE_SWITCH.S3V3_ISO" />
      <trace from="U_3V3.S3V3_ISO" to="U_SAR.AVDD_3V3" />
      <trace from="U_3V3.S3V3_ISO" to="U_SAR.DVDD_3V3" />
      <trace from="U_3V3.S3V3_ISO" to="C_3V3_OUT.pin1" />
      <trace from="C_3V3_OUT.pin2" to="net.SGND" />
      <trace from="U_REF.SGND" to="net.SGND" />
      <trace from="U_REF.S5V_ISO" to="C_REF_IN.pin1" />
      <trace from="C_REF_IN.pin2" to="net.SGND" />
      <trace from="U_REF.REF_2V5" to="R_SOURCE.pin1" />
      <trace from="U_REF.REF_2V5" to="C_REF_REG.pin1" />
      <trace from="U_REF.REF_2V5" to="C_REF_REG_HF.pin1" />
      <trace from="U_REF.REF_2V5" to="R_REF_SAR.pin1" />
      <trace from="R_REF_SAR.pin2" to="U_SAR.REF_2V5" />
      <trace from="R_REF_SAR.pin2" to="C_REF.pin1" />
      <trace from="C_REF_REG.pin2" to="net.SGND" />
      <trace from="C_REF.pin2" to="net.SGND" />
      <trace from="C_REF_REG_HF.pin2" to="net.SGND" />
      <trace from="R_REF_SAR.pin2" to="TP_REF.REF_2V5" />
      <trace from="R_SOURCE.pin2" to="U_SOURCE_SWITCH.SOURCE_PATH" />
      <trace from="J_CONTROL.SOURCE_EN" to="U_SOURCE_SWITCH.SOURCE_EN" />
      <trace from="J_CONTROL.SGND" to="net.SGND" />
      <trace from="U_SOURCE_SWITCH.SOURCE_EN" to="R_SOURCE_PD.pin1" />
      <trace from="R_SOURCE_PD.pin2" to="net.SGND" />
      <trace from="U_SOURCE_SWITCH.S3V3_ISO" to="C_MUX.pin1" />
      <trace from="C_MUX.pin2" to="net.SGND" />
      <trace from="U_OVP_BUFFER.S5V_ISO" to="C_BUFFER_POS.pin1" />
      <trace from="C_BUFFER_POS.pin2" to="net.SGND" />
      <trace from="U_SOURCE_SWITCH.UNUSED_SEL2" to="net.SGND" />
      <trace from="U_SOURCE_SWITCH.UNUSED_SEL3" to="net.SGND" />
      <trace from="U_SOURCE_SWITCH.UNUSED_SEL4" to="net.SGND" />
      <trace from="U_SAR.AVDD_3V3" to="C_SAR_AVDD.pin1" />
      <trace from="C_SAR_AVDD.pin2" to="net.SGND" />
      <trace from="U_SAR.DVDD_3V3" to="C_SAR_DVDD.pin1" />
      <trace from="C_SAR_DVDD.pin2" to="net.SGND" />
      <trace from="J_FIXTURE.LINE" to="TP_LINE.LINE" />
    </board>
  )
}
