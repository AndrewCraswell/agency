/**
 * M4 single-channel analog characterization coupon.
 *
 * This standalone board definition is intentionally not imported by the
 * product build. Its connection map is the reviewable coupon schematic, not
 * a released production board, fabrication package, or seven-channel design.
 */
export default function AnalogCouponCircuit() {
  return (
    <board title="M4 single-channel analog characterization coupon" width="70mm" height="60mm" layers={4}>
      <pinheader
        name="J_FIXTURE"
        pinCount={3}
        pinLabels={{ pin1: "LINE", pin2: "SGND", pin3: "ESD_RETURN" }}
        gender="female"
        pcbX={-28}
        pcbY={22}
      />
      <pinheader
        name="J_GUARDED_FORCE"
        pinCount={2}
        pinLabels={{ pin1: "FORCE", pin2: "SGND" }}
        gender="female"
        pcbX={-28}
        pcbY={12}
      />
      <pinheader
        name="J_POWER"
        pinCount={2}
        pinLabels={{ pin1: "S3_3", pin2: "SGND" }}
        gender="male"
        pcbX={-28}
        pcbY={2}
      />
      <pinheader
        name="J_CONTROL"
        pinCount={3}
        pinLabels={{ pin1: "SOURCE_EN", pin2: "SINK_EN", pin3: "SGND" }}
        gender="male"
        pcbX={-28}
        pcbY={-10}
      />
      <pinheader
        name="J_FIXTURE_STATUS"
        pinCount={8}
        pinLabels={{
          pin1: "FIXTURE_PERMIT_OBS",
          pin2: "FORCE_RELAY_OBS",
          pin3: "SOURCE_GATE_OBS",
          pin4: "SINK_GATE_OBS",
          pin5: "CURRENT_TRIP_ARMED_OBS",
          pin6: "WATCHDOG_OK_OBS",
          pin7: "DWELL_TIMER_OK_OBS",
          pin8: "FIXTURE_POWER_GOOD_OBS"
        }}
        gender="male"
        pcbX={-25}
        pcbY={-20}
      />

      <chip
        name="U_ESD"
        manufacturerPartNumber="TPD4E05U06DQAR"
        footprint="uson10"
        pinLabels={{ pin1: "LINE", pin2: "ESD_RETURN", pin3: "PROTECTED_LINE" }}
        pcbX={-10}
        pcbY={22}
      />
      <resistor
        name="R_ESD"
        manufacturerPartNumber="CRCW060322R0FKEAHP"
        resistance="22"
        tolerance="1%"
        footprint="0603"
        pcbX={0}
        pcbY={22}
      />
      <resistor name="R_FAULT_GUARD" resistance="56k" tolerance="1%" footprint="1206" pcbX={-10} pcbY={12} />

      <chip
        name="U_SWITCH"
        manufacturerPartNumber="TMUX1112PWR"
        footprint="tssop16"
        pinLabels={{
          pin1: "S3_3",
          pin2: "SGND",
          pin3: "SOURCE_EN",
          pin4: "SINK_EN",
          pin5: "SOURCE_PATH",
          pin6: "SINK_PATH",
          pin7: "SENSE"
        }}
        pcbX={0}
        pcbY={5}
      />
      <chip
        name="U_REF"
        manufacturerPartNumber="REF5025AQDRQ1"
        footprint="soic8"
        pinLabels={{ pin1: "S3_3", pin2: "SGND", pin6: "REF_2V5" }}
        pcbX={10}
        pcbY={15}
      />
      <resistor name="R_SOURCE" resistance="2.49k" tolerance="0.05%" footprint="0603" pcbX={12} pcbY={6} />
      <resistor name="R_SOURCE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={-8} pcbY={-3} />
      <resistor name="R_SINK_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={-8} pcbY={-8} />
      <resistor
        name="R_ADC"
        manufacturerPartNumber="CRCW06031K00FKEAHP"
        resistance="1k"
        tolerance="1%"
        footprint="0603"
        pcbX={10}
        pcbY={-3}
      />
      <capacitor name="C_ADC" capacitance="470pF" footprint="0603" pcbX={20} pcbY={-8} />
      <chip
        name="D_POS"
        manufacturerPartNumber="BAV199-7-F"
        footprint="sot23"
        pinLabels={{ pin1: "ADC_PAD", pin2: "CLAMP_2V048" }}
        pcbX={20}
        pcbY={2}
      />
      <diode name="D_NEG" manufacturerPartNumber="BAT54T1G" footprint="sod523" pcbX={20} pcbY={8} />
      <chip
        name="U_CLAMP"
        manufacturerPartNumber="LM4040C20QDBZR"
        footprint="sot23"
        pinLabels={{ pin1: "CLAMP_2V048", pin2: "SGND" }}
        pcbX={28}
        pcbY={2}
      />
      <resistor name="R_CLAMP_BIAS" resistance="10k" tolerance="1%" footprint="0603" pcbX={28} pcbY={10} />
      <chip
        name="U_MCU"
        manufacturerPartNumber="STM32G474RET3TR"
        footprint="lqfp64"
        pinLabels={{
          pin1: "S3_3",
          pin2: "SGND",
          pin3: "VDDA",
          pin4: "VSSA",
          pin5: "VREF_PLUS",
          pin6: "ADC_IN",
          pin7: "COMP_IN"
        }}
        pcbX={30}
        pcbY={-15}
      />

      <pinheader name="TP_LINE" pinCount={1} pinLabels={["LINE"]} pcbX={-18} pcbY={28} />
      <pinheader name="TP_FORCE_UPSTREAM" pinCount={1} pinLabels={["FORCE_UPSTREAM"]} pcbX={-22} pcbY={18} />
      <pinheader name="TP_POST_TPD" pinCount={1} pinLabels={["POST_TPD"]} pcbX={-2} pcbY={28} />
      <pinheader name="TP_QUIET" pinCount={1} pinLabels={["QUIET"]} pcbX={8} pcbY={28} />
      <pinheader name="TP_ADC_PAD" pinCount={1} pinLabels={["ADC_PAD"]} pcbX={18} pcbY={28} />
      <pinheader name="TP_CLAMP" pinCount={1} pinLabels={["CLAMP_2V048"]} pcbX={28} pcbY={28} />
      <pinheader name="TP_REF" pinCount={1} pinLabels={["REF_2V5"]} pcbX={18} pcbY={18} />
      <pinheader name="TP_S3_3" pinCount={1} pinLabels={["S3_3"]} pcbX={-18} pcbY={-22} />
      <pinheader name="TP_SGND" pinCount={1} pinLabels={["SGND"]} pcbX={-8} pcbY={-22} />
      <pinheader name="TP_SINK_DNP" pinCount={1} pinLabels={["SINK_DNP"]} pcbX={0} pcbY={-16} />

      <trace from="J_FIXTURE.LINE" to="U_ESD.LINE" />
      <trace from="J_FIXTURE.ESD_RETURN" to="U_ESD.ESD_RETURN" />
      <trace from="J_GUARDED_FORCE.FORCE" to="R_FAULT_GUARD.pin1" />
      <trace from="J_GUARDED_FORCE.FORCE" to="TP_FORCE_UPSTREAM.FORCE_UPSTREAM" />
      <trace from="R_FAULT_GUARD.pin2" to="U_ESD.LINE" />
      <trace from="J_FIXTURE.SGND" to="net.SGND" />
      <trace from="J_GUARDED_FORCE.SGND" to="net.SGND" />
      <trace from="U_ESD.PROTECTED_LINE" to="R_ESD.pin1" />
      <trace from="R_ESD.pin2" to="U_SWITCH.SENSE" />
      <trace from="U_SWITCH.SENSE" to="R_ADC.pin1" />
      <trace from="R_ADC.pin2" to="U_MCU.ADC_IN" />
      <trace from="R_ADC.pin2" to="U_MCU.COMP_IN" />
      <trace from="R_ADC.pin2" to="C_ADC.pin1" />
      <trace from="C_ADC.pin2" to="net.SGND" />
      <trace from="R_ADC.pin2" to="D_POS.ADC_PAD" />
      <trace from="D_POS.CLAMP_2V048" to="U_CLAMP.CLAMP_2V048" />
      <trace from="R_ADC.pin2" to="D_NEG.pin2" />
      <trace from="D_NEG.pin1" to="net.SGND" />
      <trace from="J_POWER.S3_3" to="net.S3_3" />
      <trace from="J_POWER.SGND" to="net.SGND" />
      <trace from="net.S3_3" to="U_SWITCH.S3_3" />
      <trace from="net.SGND" to="U_SWITCH.SGND" />
      <trace from="net.S3_3" to="U_REF.S3_3" />
      <trace from="net.SGND" to="U_REF.SGND" />
      <trace from="U_REF.REF_2V5" to="R_SOURCE.pin1" />
      <trace from="R_SOURCE.pin2" to="U_SWITCH.SOURCE_PATH" />
      <trace from="J_CONTROL.SOURCE_EN" to="U_SWITCH.SOURCE_EN" />
      <trace from="J_CONTROL.SINK_EN" to="U_SWITCH.SINK_EN" />
      <trace from="J_CONTROL.SGND" to="net.SGND" />
      <trace from="U_SWITCH.SOURCE_EN" to="R_SOURCE_PD.pin1" />
      <trace from="R_SOURCE_PD.pin2" to="net.SGND" />
      <trace from="U_SWITCH.SINK_EN" to="R_SINK_PD.pin1" />
      <trace from="R_SINK_PD.pin2" to="net.SGND" />
      <trace from="U_SWITCH.SINK_PATH" to="TP_SINK_DNP.SINK_DNP" />
      <trace from="net.S3_3" to="U_MCU.S3_3" />
      <trace from="net.SGND" to="U_MCU.SGND" />
      <trace from="net.S3_3" to="U_MCU.VDDA" />
      <trace from="net.SGND" to="U_MCU.VSSA" />
      <trace from="U_REF.REF_2V5" to="U_MCU.VREF_PLUS" />
      <trace from="net.S3_3" to="R_CLAMP_BIAS.pin1" />
      <trace from="R_CLAMP_BIAS.pin2" to="U_CLAMP.CLAMP_2V048" />
      <trace from="U_CLAMP.SGND" to="net.SGND" />
      <trace from="U_ESD.LINE" to="TP_LINE.LINE" />
      <trace from="U_ESD.PROTECTED_LINE" to="TP_POST_TPD.POST_TPD" />
      <trace from="U_SWITCH.SENSE" to="TP_QUIET.QUIET" />
      <trace from="R_ADC.pin2" to="TP_ADC_PAD.ADC_PAD" />
      <trace from="U_CLAMP.CLAMP_2V048" to="TP_CLAMP.CLAMP_2V048" />
      <trace from="U_REF.REF_2V5" to="TP_REF.REF_2V5" />
      <trace from="net.S3_3" to="TP_S3_3.S3_3" />
      <trace from="net.SGND" to="TP_SGND.SGND" />
    </board>
  )
}
