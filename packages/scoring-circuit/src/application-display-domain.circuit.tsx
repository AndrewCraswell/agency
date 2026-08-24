/**
 * Application display path for the logical scoring apparatus.
 *
 * These fragments intentionally retain the parent circuit's render order.
 * The display buffers, panel connector, bias network, and their traces are
 * a single domain, but remain split into component and trace sections so the
 * surrounding communications and reset paths keep their original positions.
 */
export function ApplicationDisplayComponents() {
  return (
    <>
      <chip
        name="U_DISPLAY_BUFFER_A"
        manufacturerPartNumber="SN74AHCT245PWR"
        footprint="tssop20"
        pinLabels={{
          pin1: "DIR_TO_PANEL",
          pin2: "R1_IN",
          pin3: "G1_IN",
          pin4: "B1_IN",
          pin5: "R2_IN",
          pin6: "G2_IN",
          pin7: "B2_IN",
          pin8: "A_IN",
          pin9: "B_IN",
          pin10: "GND",
          pin11: "B_OUT",
          pin12: "A_OUT",
          pin13: "B2_OUT",
          pin14: "G2_OUT",
          pin15: "R2_OUT",
          pin16: "B1_OUT",
          pin17: "G1_OUT",
          pin18: "R1_OUT",
          pin19: "BUFFER_ENABLE_N",
          pin20: "V5"
        }}
        pcbX={15}
        pcbY={29}
      />
      <chip
        name="U_DISPLAY_BUFFER_B"
        manufacturerPartNumber="SN74AHCT245PWR"
        footprint="tssop20"
        pinLabels={{
          pin1: "DIR_TO_PANEL",
          pin2: "C_IN",
          pin3: "D_IN",
          pin4: "CLK_IN",
          pin5: "LAT_IN",
          pin6: "OE_N_IN",
          pin10: "GND",
          pin14: "OE_N_OUT",
          pin15: "LAT_OUT",
          pin16: "CLK_OUT",
          pin17: "D_OUT",
          pin18: "C_OUT",
          pin19: "BUFFER_ENABLE_N",
          pin20: "V5"
        }}
        pcbX={28}
        pcbY={29}
      />
      <resistor name="R_HUB75_R1_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={8} pcbY={34} />
      <resistor name="R_HUB75_G1_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={11} pcbY={34} />
      <resistor name="R_HUB75_B1_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={14} pcbY={34} />
      <resistor name="R_HUB75_R2_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={17} pcbY={34} />
      <resistor name="R_HUB75_G2_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={20} pcbY={34} />
      <resistor name="R_HUB75_B2_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={23} pcbY={34} />
      <resistor name="R_HUB75_A_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={26} pcbY={34} />
      <resistor name="R_HUB75_B_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={29} pcbY={34} />
      <resistor name="R_HUB75_C_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={32} pcbY={34} />
      <resistor name="R_HUB75_D_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={35} pcbY={34} />
      <resistor name="R_HUB75_CLK_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={38} pcbY={34} />
      <resistor name="R_HUB75_LAT_PD" resistance="10k" tolerance="1%" footprint="0603" pcbX={41} pcbY={34} />
      <resistor name="R_HUB75_OE_PULLUP" resistance="10k" tolerance="1%" footprint="0603" pcbX={44} pcbY={34} />
      <resistor name="R_HUB75_PANEL_OE_PULLUP" resistance="10k" tolerance="1%" footprint="0603" pcbX={47} pcbY={34} />
      <pinheader
        name="J_HUB75"
        pinCount={16}
        doubleRow
        pinLabels={["R1", "G1", "B1", "GND1", "R2", "G2", "B2", "GND2", "A", "B", "C", "D", "CLK", "LAT", "OE", "GND3"]}
        pcbX={3}
        pcbY={39}
      />
    </>
  )
}

/** ESP32-to-buffer and buffer-to-panel display signal traces. */
export function ApplicationDisplayTraces() {
  return (
    <>
      <trace from="U_ESP32.HUB75_R1" to="U_DISPLAY_BUFFER_A.R1_IN" />
      <trace from="U_ESP32.HUB75_G1" to="U_DISPLAY_BUFFER_A.G1_IN" />
      <trace from="U_ESP32.HUB75_B1" to="U_DISPLAY_BUFFER_A.B1_IN" />
      <trace from="U_ESP32.HUB75_R2" to="U_DISPLAY_BUFFER_A.R2_IN" />
      <trace from="U_ESP32.HUB75_G2" to="U_DISPLAY_BUFFER_A.G2_IN" />
      <trace from="U_ESP32.HUB75_B2" to="U_DISPLAY_BUFFER_A.B2_IN" />
      <trace from="U_ESP32.HUB75_A" to="U_DISPLAY_BUFFER_A.A_IN" />
      <trace from="U_ESP32.HUB75_B" to="U_DISPLAY_BUFFER_A.B_IN" />
      <trace from="U_ESP32.HUB75_C" to="U_DISPLAY_BUFFER_B.C_IN" />
      <trace from="U_ESP32.HUB75_D" to="U_DISPLAY_BUFFER_B.D_IN" />
      <trace from="U_ESP32.HUB75_CLK" to="U_DISPLAY_BUFFER_B.CLK_IN" />
      <trace from="U_ESP32.HUB75_LAT" to="U_DISPLAY_BUFFER_B.LAT_IN" />
      <trace from="U_ESP32.HUB75_OE_N" to="U_DISPLAY_BUFFER_B.OE_N_IN" />
      <trace from="U_DISPLAY_BUFFER_A.R1_OUT" to="J_HUB75.R1" />
      <trace from="U_DISPLAY_BUFFER_A.G1_OUT" to="J_HUB75.G1" />
      <trace from="U_DISPLAY_BUFFER_A.B1_OUT" to="J_HUB75.B1" />
      <trace from="U_DISPLAY_BUFFER_A.R2_OUT" to="J_HUB75.R2" />
      <trace from="U_DISPLAY_BUFFER_A.G2_OUT" to="J_HUB75.G2" />
      <trace from="U_DISPLAY_BUFFER_A.B2_OUT" to="J_HUB75.B2" />
      <trace from="U_DISPLAY_BUFFER_A.A_OUT" to="J_HUB75.A" />
      <trace from="U_DISPLAY_BUFFER_A.B_OUT" to="J_HUB75.B" />
      <trace from="U_DISPLAY_BUFFER_B.C_OUT" to="J_HUB75.C" />
      <trace from="U_DISPLAY_BUFFER_B.D_OUT" to="J_HUB75.D" />
      <trace from="U_DISPLAY_BUFFER_B.CLK_OUT" to="J_HUB75.CLK" />
      <trace from="U_DISPLAY_BUFFER_B.LAT_OUT" to="J_HUB75.LAT" />
      <trace from="U_DISPLAY_BUFFER_B.OE_N_OUT" to="J_HUB75.OE" />
      <trace from="U_DISPLAY_BUFFER_A.R1_IN" to="R_HUB75_R1_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.G1_IN" to="R_HUB75_G1_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.B1_IN" to="R_HUB75_B1_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.R2_IN" to="R_HUB75_R2_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.G2_IN" to="R_HUB75_G2_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.B2_IN" to="R_HUB75_B2_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.A_IN" to="R_HUB75_A_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_A.B_IN" to="R_HUB75_B_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.C_IN" to="R_HUB75_C_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.D_IN" to="R_HUB75_D_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.CLK_IN" to="R_HUB75_CLK_PD.pin1" />
      <trace from="U_DISPLAY_BUFFER_B.LAT_IN" to="R_HUB75_LAT_PD.pin1" />
      <trace from="R_HUB75_R1_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_G1_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_B1_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_R2_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_G2_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_B2_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_A_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_B_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_C_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_D_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_CLK_PD.pin2" to="net.GND" />
      <trace from="R_HUB75_LAT_PD.pin2" to="net.GND" />
      <trace from="U_DISPLAY_BUFFER_B.OE_N_IN" to="R_HUB75_OE_PULLUP.pin1" />
      <trace from="R_HUB75_OE_PULLUP.pin2" to="net.V3_3" />
      <trace from="U_DISPLAY_BUFFER_B.OE_N_OUT" to="R_HUB75_PANEL_OE_PULLUP.pin1" />
      <trace from="R_HUB75_PANEL_OE_PULLUP.pin2" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_A.DIR_TO_PANEL" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_B.DIR_TO_PANEL" to="net.V5" />
    </>
  )
}

/** Reset-gated output-enable traces remain at their original later position. */
export function ApplicationDisplayEnableTraces() {
  return (
    <>
      <trace from="U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N" to="R_BUFFER_A_ENABLE_PULLUP.pin1" />
      <trace from="R_BUFFER_A_ENABLE_PULLUP.pin2" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_B.BUFFER_ENABLE_N" to="R_BUFFER_B_ENABLE_PULLUP.pin1" />
      <trace from="R_BUFFER_B_ENABLE_PULLUP.pin2" to="net.V5" />
    </>
  )
}
