/**
 * The scoring-to-application isolation boundary.
 *
 * Components and traces are rendered in separate sections so the parent can
 * retain the original source order around the remaining application circuitry.
 */
export function IsolationComponents() {
  return (
    <>
      <chip
        name="U_ISO_MAIN"
        manufacturerPartNumber="ISO7762FDWR"
        footprint="soic16_w10.3mm"
        pinLabels={{
          pin1: "S3_3",
          pin2: "S_SCK",
          pin3: "S_MOSI",
          pin4: "S_CS",
          pin5: "S_ESP_RESET_ASSERT",
          pin6: "S_MISO",
          pin7: "S_ESP_HEARTBEAT",
          pin8: "SGND",
          pin9: "GND",
          pin10: "A_ESP_HEARTBEAT",
          pin11: "A_MISO",
          pin12: "A_ESP_RESET_ASSERT",
          pin13: "A_CS",
          pin14: "A_MOSI",
          pin15: "A_SCK",
          pin16: "V3_3"
        }}
        pcbX={-10}
        pcbY={0}
      />
      <chip
        name="U_ISO_AUX"
        manufacturerPartNumber="ISO7721FDR"
        footprint="soic8"
        pinLabels={{
          pin1: "S3_3",
          pin2: "S_HEARTBEAT",
          pin3: "S_SPARE_IN",
          pin4: "SGND",
          pin5: "GND",
          pin6: "A_SPARE_OUT",
          pin7: "A_HEARTBEAT",
          pin8: "V3_3"
        }}
        pcbX={-10}
        pcbY={17}
      />
    </>
  )
}

/** The isolated SPI, reset-request, and heartbeat interconnects. */
export function IsolationTraces() {
  return (
    <>
      <trace from="U_STM32.SPI_SCK" to="U_ISO_MAIN.S_SCK" />
      <trace from="U_STM32.SPI_MOSI" to="U_ISO_MAIN.S_MOSI" />
      <trace from="U_STM32.SPI_CS" to="U_ISO_MAIN.S_CS" />
      <trace from="U_STM32.SPI_MISO" to="U_ISO_MAIN.S_MISO" />
      <trace from="U_STM32.ESP_RESET" to="R_STM_RESET_ISO_SERIES.pin1" />
      <trace from="R_STM_RESET_ISO_SERIES.pin2" to="U_ISO_MAIN.S_ESP_RESET_ASSERT" />
      <trace from="U_ISO_MAIN.S_ESP_RESET_ASSERT" to="R_STM_RESET_ISO_PD.pin1" />
      <trace from="R_STM_RESET_ISO_PD.pin2" to="net.SGND" />
      <trace from="U_STM32.HEARTBEAT" to="U_ISO_AUX.S_HEARTBEAT" />
      <trace from="U_ISO_MAIN.A_SCK" to="U_ESP32.SCORE_SCK" />
      <trace from="U_ISO_MAIN.A_MOSI" to="U_ESP32.SCORE_MOSI" />
      <trace from="U_ISO_MAIN.A_CS" to="U_ESP32.SCORE_CS" />
      <trace from="U_ISO_MAIN.A_MISO" to="U_ESP32.SCORE_MISO" />
      <trace from="U_ISO_MAIN.A_ESP_RESET_ASSERT" to="TP_ESP_RESET_REQUEST.RESET_REQUEST" />
      <trace from="U_ISO_MAIN.A_ESP_RESET_ASSERT" to="R_STM_RESET_GATE.pin1" />
      <trace from="R_STM_RESET_GATE.pin2" to="Q_ESP_RESET_STM.G" />
      <trace from="Q_ESP_RESET_STM.G" to="R_STM_RESET_GATE_PD.pin1" />
      <trace from="R_STM_RESET_GATE_PD.pin2" to="net.GND" />
      <trace from="U_ISO_AUX.A_HEARTBEAT" to="U_ESP32.STM_HEARTBEAT" />
      <trace from="U_ESP32.ESP_HEARTBEAT" to="U_ISO_MAIN.A_ESP_HEARTBEAT" />
      <trace from="U_ISO_MAIN.S_ESP_HEARTBEAT" to="U_STM32.ESP_HEARTBEAT" />
    </>
  )
}
