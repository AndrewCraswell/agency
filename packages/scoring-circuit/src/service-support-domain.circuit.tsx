/**
 * Application service support that sits behind the communications boundary.
 *
 * The three render sections are intentionally split to keep the source-order
 * contract of the parent circuit: components are emitted with the other
 * application components, while each trace section remains beside its
 * neighboring bus traces.
 */
export function ServiceSupportComponents() {
  return (
    <>
      <chip
        name="U_FIELD_SERIAL"
        manufacturerPartNumber="ISO1410BDWR"
        footprint="soic16_w10.3mm"
        pinLabels={{
          pin1: "V3_3",
          pin2: "TX",
          pin3: "RX",
          pin4: "GND",
          pin9: "FIELD_GND",
          pin10: "B",
          pin11: "A",
          pin16: "FIELD_VCC"
        }}
        pcbX={50}
        pcbY={8}
      />
      <pinheader name="J_FIELD_SERIAL" pinCount={4} pinLabels={["A", "B", "FIELD_GND", "SHIELD"]} pcbX={70} pcbY={8} />
      <chip
        name="U_FRAM"
        manufacturerPartNumber="CY15B104Q-LHXIT"
        footprint="qfn8"
        pinLabels={{
          pin1: "CS",
          pin2: "MISO",
          pin3: "WP",
          pin4: "GND",
          pin5: "MOSI",
          pin6: "SCK",
          pin7: "HOLD",
          pin8: "V3_3"
        }}
        pcbX={40}
        pcbY={-5}
      />
      <chip
        name="U_RTC"
        manufacturerPartNumber="RV-3028-C7"
        footprint="qfn8"
        pinLabels={{ pin1: "CLKOUT", pin2: "INT", pin3: "SCL", pin4: "SDA", pin5: "GND", pin8: "V3_3" }}
        pcbX={51}
        pcbY={-5}
      />
      <chip
        name="U_SECURE_ELEMENT"
        manufacturerPartNumber="STSAFE-A110"
        footprint="qfn8"
        pinLabels={{ pin1: "SDA", pin2: "SCL", pin3: "GND", pin4: "V3_3" }}
        pcbX={62}
        pcbY={-5}
      />
    </>
  )
}

/** I2C service-bus traces, kept beside the neighboring application traces. */
export function ServiceSupportI2cTraces() {
  return (
    <>
      <trace from="U_ESP32.I2C_SDA" to="U_RTC.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_RTC.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_SECURE_ELEMENT.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_SECURE_ELEMENT.SCL" />
    </>
  )
}

/** FRAM persistence-bus traces, kept beside the other application SPI traces. */
export function ServiceSupportFramTraces() {
  return (
    <>
      <trace from="U_ESP32.APP_SPI_SCK" to="U_FRAM.SCK" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="U_FRAM.MOSI" />
      <trace from="U_ESP32.APP_SPI_MISO" to="U_FRAM.MISO" />
      <trace from="U_ESP32.FRAM_CS" to="U_FRAM.CS" />
    </>
  )
}
