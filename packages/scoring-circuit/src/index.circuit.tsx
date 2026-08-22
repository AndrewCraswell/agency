const weaponConnectorPins = { pin1: "A", pin2: "B", pin3: "C" } as const

function WeaponInput({ side, x }: { side: "L" | "R"; x: number }) {
  return (
    <group>
      <pinheader
        name={`J_${side}`}
        pinCount={3}
        pinLabels={weaponConnectorPins}
        gender="female"
        pcbX={x}
        pcbY={35}
        pcbRotation={90}
        showSilkscreenPinLabels
      />
      <chip
        name={`U_FRONTEND_${side}`}
        manufacturerPartNumber="ANALOG-FRONT-END-TBD"
        doNotPlace
        footprint="soic16"
        pinLabels={{
          pin1: "RAW_A",
          pin2: "RAW_B",
          pin3: "RAW_C",
          pin4: "SGND",
          pin5: "S3_3",
          pin6: "SENSE_A",
          pin7: "SENSE_B",
          pin8: "SENSE_C"
        }}
        pcbX={x}
        pcbY={22}
      />
      <trace from={`J_${side}.A`} to={`U_FRONTEND_${side}.RAW_A`} />
      <trace from={`J_${side}.B`} to={`U_FRONTEND_${side}.RAW_B`} />
      <trace from={`J_${side}.C`} to={`U_FRONTEND_${side}.RAW_C`} />
      <trace from={`U_FRONTEND_${side}.SGND`} to="net.SGND" />
      <trace from={`U_FRONTEND_${side}.S3_3`} to="net.S3_3" />
    </group>
  )
}

function ScoringCircuit() {
  return (
    <board title="Competition scoring apparatus architecture" width="160mm" height="100mm" layers={4}>
      <WeaponInput side="L" x={-68} />
      <WeaponInput side="R" x={-48} />
      <pinheader
        name="J_PISTE"
        pinCount={2}
        pinLabels={{ pin1: "PISTE", pin2: "SHIELD" }}
        gender="female"
        pcbX={-28}
        pcbY={36}
      />
      <chip
        name="U_PISTE_FRONTEND"
        manufacturerPartNumber="PISTE-PROTECTION-TBD"
        doNotPlace
        footprint="soic8"
        pinLabels={{ pin1: "RAW_PISTE", pin2: "SHIELD", pin3: "SGND", pin4: "S3_3", pin5: "SENSE_PISTE" }}
        pcbX={-28}
        pcbY={25}
      />

      <chip
        name="U_STM32"
        manufacturerPartNumber="STM32G474RET3TR"
        footprint="lqfp64"
        pinLabels={{
          pin1: "S3_3",
          pin2: "SGND",
          pin3: "LEFT_A",
          pin4: "LEFT_B",
          pin5: "LEFT_C",
          pin6: "RIGHT_A",
          pin7: "RIGHT_B",
          pin8: "RIGHT_C",
          pin9: "PISTE",
          pin10: "SPI_SCK",
          pin11: "SPI_MOSI",
          pin12: "SPI_MISO",
          pin13: "SPI_CS",
          pin14: "EVENT_IRQ",
          pin15: "HEARTBEAT",
          pin16: "ESP_RESET",
          pin17: "LAMP_RED",
          pin18: "LAMP_GREEN",
          pin19: "LAMP_WHITE_L",
          pin20: "LAMP_WHITE_R",
          pin21: "BUZZER",
          pin22: "WD_KICK",
          pin23: "VREF",
          pin24: "NRST"
        }}
        pcbX={-45}
        pcbY={0}
      />
      <chip
        name="U_VREF"
        manufacturerPartNumber="REF5025AQDRQ1"
        footprint="soic8"
        pinLabels={{ pin1: "VIN", pin2: "SGND", pin6: "VOUT" }}
        pcbX={-67}
        pcbY={2}
      />
      <chip
        name="U_STM_WATCHDOG"
        manufacturerPartNumber="TPS3431SDRBR"
        footprint="qfn8"
        pinLabels={{ pin1: "S3_3", pin2: "SGND", pin3: "WDI", pin4: "RESET" }}
        pcbX={-66}
        pcbY={-12}
      />
      <chip
        name="U_STM_SUPERVISOR"
        manufacturerPartNumber="TPS389018DSER"
        footprint="wson6"
        pinLabels={{ pin1: "SENSE", pin2: "SGND", pin3: "RESET", pin4: "S3_3" }}
        pcbX={-66}
        pcbY={-22}
      />
      <chip
        name="U_ISOLATED_POWER"
        manufacturerPartNumber="NXE1S0505MC"
        footprint="dip6"
        pinLabels={{ pin1: "V5", pin2: "GND", pin4: "SGND", pin6: "S5" }}
        pcbX={-25}
        pcbY={-36}
      />
      <chip
        name="U_SCORING_LDO"
        manufacturerPartNumber="LOW-NOISE-LDO-TBD"
        doNotPlace
        footprint="sot23_5"
        pinLabels={{ pin1: "S5", pin2: "SGND", pin3: "ENABLE", pin5: "S3_3" }}
        pcbX={-42}
        pcbY={-36}
      />

      <chip
        name="U_ISO_MAIN"
        manufacturerPartNumber="ISO7762FDWR"
        footprint="soic16_w10.3mm"
        pinLabels={{
          pin1: "S3_3",
          pin2: "S_SCK",
          pin3: "S_MOSI",
          pin4: "S_CS",
          pin5: "S_IRQ",
          pin6: "S_MISO",
          pin7: "S_RESET",
          pin8: "SGND",
          pin9: "GND",
          pin10: "A_RESET",
          pin11: "A_MISO",
          pin12: "A_IRQ",
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

      <chip
        name="U_ESP32"
        manufacturerPartNumber="ESP32-S3-WROOM-1U-N16R2"
        doNotPlace
        pinLabels={{
          pin1: "V3_3",
          pin2: "GND",
          pin3: "SCORE_SCK",
          pin4: "SCORE_MOSI",
          pin5: "SCORE_MISO",
          pin6: "SCORE_CS",
          pin7: "SCORE_IRQ",
          pin8: "STM_RESET",
          pin9: "STM_HEARTBEAT",
          pin10: "ETH_SCK",
          pin11: "ETH_MOSI",
          pin12: "ETH_MISO",
          pin13: "ETH_CS",
          pin14: "ETH_IRQ",
          pin15: "DISPLAY_DATA",
          pin16: "AUDIO",
          pin17: "I2C_SDA",
          pin18: "I2C_SCL",
          pin19: "WD_KICK",
          pin20: "EN_RESET"
        }}
        pcbX={18}
        pcbY={0}
      />
      <chip
        name="U_ESP_WATCHDOG"
        manufacturerPartNumber="TPS3431SDRBR"
        footprint="qfn8"
        pinLabels={{ pin1: "V3_3", pin2: "GND", pin3: "WDI", pin4: "RESET" }}
        pcbX={13}
        pcbY={-19}
      />
      <chip
        name="U_ESP_SUPERVISOR"
        manufacturerPartNumber="TPS389018DSER"
        footprint="wson6"
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "RESET", pin4: "V3_3" }}
        pcbX={26}
        pcbY={-19}
      />

      <chip
        name="U_ETHERNET"
        manufacturerPartNumber="W5500"
        footprint="qfn48"
        pinLabels={{
          pin1: "V3_3",
          pin2: "GND",
          pin3: "SCK",
          pin4: "MOSI",
          pin5: "MISO",
          pin6: "CS",
          pin7: "IRQ",
          pin8: "TXP",
          pin9: "TXN",
          pin10: "RXP",
          pin11: "RXN"
        }}
        pcbX={48}
        pcbY={25}
      />
      <pinheader
        name="J_ETHERNET_MAGJACK"
        pinCount={8}
        pinLabels={["TXP", "TXN", "RXP", "RXN", "LED_A", "LED_B", "SHIELD", "CHASSIS"]}
        pcbX={70}
        pcbY={28}
        pcbRotation={90}
      />
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
      <chip
        name="U_DISPLAY_BUFFER_A"
        manufacturerPartNumber="SN74AHCT245PWR"
        footprint="tssop20"
        pinLabels={{ pin1: "DIR", pin2: "DATA_IN", pin10: "GND", pin18: "DATA_OUT", pin19: "OE", pin20: "V5" }}
        pcbX={15}
        pcbY={29}
      />
      <chip
        name="U_DISPLAY_BUFFER_B"
        manufacturerPartNumber="SN74AHCT245PWR"
        footprint="tssop20"
        pinLabels={{ pin1: "DIR", pin2: "DATA_IN", pin10: "GND", pin18: "DATA_OUT", pin19: "OE", pin20: "V5" }}
        pcbX={28}
        pcbY={29}
      />
      <pinheader
        name="J_HUB75"
        pinCount={16}
        doubleRow
        pinLabels={["R1", "G1", "B1", "GND1", "R2", "G2", "B2", "GND2", "A", "B", "C", "D", "CLK", "LAT", "OE", "GND3"]}
        pcbX={3}
        pcbY={39}
      />
      <chip
        name="U_AUDIO"
        manufacturerPartNumber="TAS2505QDCARQ1"
        footprint="tssop24"
        pinLabels={{ pin1: "V5", pin2: "GND", pin3: "DIN", pin4: "SCLK", pin5: "SPK_P", pin6: "SPK_N", pin7: "FAULT" }}
        pcbX={48}
        pcbY={-20}
      />
      <pinheader name="J_SPEAKER" pinCount={2} pinLabels={["SPK_P", "SPK_N"]} pcbX={68} pcbY={-20} />
      <pinheader
        name="J_STM_SWD"
        pinCount={5}
        pinLabels={["S3_3", "SWDIO", "SWCLK", "NRST", "SGND"]}
        pcbX={-62}
        pcbY={-32}
      />
      <pinheader
        name="J_ESP_DEBUG"
        pinCount={6}
        pinLabels={["V3_3", "TX", "RX", "EN_RESET", "BOOT", "GND"]}
        pcbX={34}
        pcbY={-29}
      />

      <connector name="J_USB_C" standard="usb_c" pcbX={70} pcbY={-39} />
      <chip
        name="U_PD_SINK"
        manufacturerPartNumber="STUSB4500QTR"
        footprint="qfn24"
        pinLabels={{ pin1: "VBUS", pin2: "GND", pin3: "CC1", pin4: "CC2", pin5: "PD_OK", pin6: "POWER_EN" }}
        pcbX={51}
        pcbY={-38}
      />
      <chip
        name="U_EFUSE"
        manufacturerPartNumber="TPS259474LRPWR"
        footprint="qfn10"
        pinLabels={{ pin1: "VIN", pin2: "GND", pin3: "EN", pin4: "FAULT", pin5: "VOUT" }}
        pcbX={36}
        pcbY={-38}
      />
      <chip
        name="U_BUCK_BOOST"
        manufacturerPartNumber="TPS55288RPMR"
        footprint="qfn26"
        pinLabels={{ pin1: "VIN", pin2: "GND", pin3: "VOUT", pin4: "SDA", pin5: "SCL", pin6: "FAULT" }}
        pcbX={20}
        pcbY={-38}
      />
      <chip
        name="U_POWER_MONITOR"
        manufacturerPartNumber="INA238AIDGSR"
        footprint="vssop10"
        pinLabels={{ pin1: "VIN_P", pin2: "VIN_N", pin3: "GND", pin4: "SDA", pin5: "SCL", pin10: "V3_3" }}
        pcbX={4}
        pcbY={-38}
      />

      <trace from="U_FRONTEND_L.SENSE_A" to="U_STM32.LEFT_A" />
      <trace from="U_FRONTEND_L.SENSE_B" to="U_STM32.LEFT_B" />
      <trace from="U_FRONTEND_L.SENSE_C" to="U_STM32.LEFT_C" />
      <trace from="U_FRONTEND_R.SENSE_A" to="U_STM32.RIGHT_A" />
      <trace from="U_FRONTEND_R.SENSE_B" to="U_STM32.RIGHT_B" />
      <trace from="U_FRONTEND_R.SENSE_C" to="U_STM32.RIGHT_C" />
      <trace from="J_PISTE.PISTE" to="U_PISTE_FRONTEND.RAW_PISTE" />
      <trace from="U_PISTE_FRONTEND.SENSE_PISTE" to="U_STM32.PISTE" />
      <trace from="U_VREF.VOUT" to="U_STM32.VREF" />
      <trace from="U_STM32.WD_KICK" to="U_STM_WATCHDOG.WDI" />
      <trace from="U_STM_WATCHDOG.RESET" to="U_STM32.NRST" />
      <trace from="U_STM_SUPERVISOR.RESET" to="U_STM32.NRST" />
      <trace from="J_STM_SWD.NRST" to="U_STM32.NRST" />

      <trace from="U_STM32.SPI_SCK" to="U_ISO_MAIN.S_SCK" />
      <trace from="U_STM32.SPI_MOSI" to="U_ISO_MAIN.S_MOSI" />
      <trace from="U_STM32.SPI_CS" to="U_ISO_MAIN.S_CS" />
      <trace from="U_STM32.EVENT_IRQ" to="U_ISO_MAIN.S_IRQ" />
      <trace from="U_STM32.SPI_MISO" to="U_ISO_MAIN.S_MISO" />
      <trace from="U_STM32.ESP_RESET" to="U_ISO_MAIN.S_RESET" />
      <trace from="U_STM32.HEARTBEAT" to="U_ISO_AUX.S_HEARTBEAT" />
      <trace from="U_ISO_MAIN.A_SCK" to="U_ESP32.SCORE_SCK" />
      <trace from="U_ISO_MAIN.A_MOSI" to="U_ESP32.SCORE_MOSI" />
      <trace from="U_ISO_MAIN.A_CS" to="U_ESP32.SCORE_CS" />
      <trace from="U_ISO_MAIN.A_IRQ" to="U_ESP32.SCORE_IRQ" />
      <trace from="U_ISO_MAIN.A_MISO" to="U_ESP32.SCORE_MISO" />
      <trace from="U_ISO_MAIN.A_RESET" to="U_ESP32.STM_RESET" />
      <trace from="U_ISO_AUX.A_HEARTBEAT" to="U_ESP32.STM_HEARTBEAT" />

      <trace from="U_ESP32.ETH_SCK" to="U_ETHERNET.SCK" />
      <trace from="U_ESP32.ETH_MOSI" to="U_ETHERNET.MOSI" />
      <trace from="U_ESP32.ETH_MISO" to="U_ETHERNET.MISO" />
      <trace from="U_ESP32.ETH_CS" to="U_ETHERNET.CS" />
      <trace from="U_ESP32.ETH_IRQ" to="U_ETHERNET.IRQ" />
      <trace from="U_ETHERNET.TXP" to="J_ETHERNET_MAGJACK.TXP" />
      <trace from="U_ETHERNET.TXN" to="J_ETHERNET_MAGJACK.TXN" />
      <trace from="U_ETHERNET.RXP" to="J_ETHERNET_MAGJACK.RXP" />
      <trace from="U_ETHERNET.RXN" to="J_ETHERNET_MAGJACK.RXN" />
      <trace from="U_ESP32.DISPLAY_DATA" to="U_DISPLAY_BUFFER_A.DATA_IN" />
      <trace from="U_DISPLAY_BUFFER_A.DATA_OUT" to="J_HUB75.R1" />
      <trace from="U_AUDIO.SPK_P" to="J_SPEAKER.SPK_P" />
      <trace from="U_AUDIO.SPK_N" to="J_SPEAKER.SPK_N" />
      <trace from="U_ESP32.WD_KICK" to="U_ESP_WATCHDOG.WDI" />
      <trace from="U_ESP_WATCHDOG.RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_ESP32.EN_RESET" />
      <trace from="J_ESP_DEBUG.EN_RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP32.I2C_SDA" to="U_RTC.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_RTC.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_SECURE_ELEMENT.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_SECURE_ELEMENT.SCL" />

      <trace from="U_ISOLATED_POWER.GND" to="net.GND" />
      <trace from="U_ISOLATED_POWER.SGND" to="net.SGND" />
      <trace from="U_ISOLATED_POWER.S5" to="U_SCORING_LDO.S5" />
      <trace from="U_SCORING_LDO.S3_3" to="net.S3_3" />
      <trace from="U_STM32.SGND" to="net.SGND" />
      <trace from="U_STM32.S3_3" to="net.S3_3" />
      <trace from="U_ESP32.GND" to="net.GND" />
      <trace from="U_ESP32.V3_3" to="net.V3_3" />

      <hole name="H1" diameter="3.2mm" pcbX={-75} pcbY={-45} />
      <hole name="H2" diameter="3.2mm" pcbX={75} pcbY={-45} />
      <hole name="H3" diameter="3.2mm" pcbX={-75} pcbY={45} />
      <hole name="H4" diameter="3.2mm" pcbX={75} pcbY={45} />
    </board>
  )
}

export default ScoringCircuit
