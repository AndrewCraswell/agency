const weaponConnectorPins = { pin1: "A", pin2: "B", pin3: "C" } as const

function WeaponInput({ side, x }: { side: "L" | "R"; x: number }) {
  return (
    <group name={`G_WEAPON_${side}`} pcbX={x} pcbY={35}>
      <pinheader
        name={`J_${side}`}
        pinCount={3}
        pinLabels={weaponConnectorPins}
        gender="female"
        pcbX={0}
        pcbY={0}
        pcbRotation={90}
        showSilkscreenPinLabels
      />
      <chip
        name={`U_ESD_${side}`}
        manufacturerPartNumber="TPD4E05U06DQAR"
        doNotPlace
        pinLabels={{ pin1: "CH_A", pin2: "CH_B", pin3: "CH_C", pin4: "SPARE", pin5: "ESD_RETURN" }}
        pcbX={0}
        pcbY={-6}
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
        pcbX={0}
        pcbY={-13}
      />
      <trace from={`J_${side}.A`} to={`U_ESD_${side}.CH_A`} />
      <trace from={`J_${side}.B`} to={`U_ESD_${side}.CH_B`} />
      <trace from={`J_${side}.C`} to={`U_ESD_${side}.CH_C`} />
      <trace from={`U_ESD_${side}.CH_A`} to={`U_FRONTEND_${side}.RAW_A`} />
      <trace from={`U_ESD_${side}.CH_B`} to={`U_FRONTEND_${side}.RAW_B`} />
      <trace from={`U_ESD_${side}.CH_C`} to={`U_FRONTEND_${side}.RAW_C`} />
      <trace from={`U_ESD_${side}.ESD_RETURN`} to="net.ESD_RETURN" />
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
          pin24: "NRST",
          pin25: "ESP_HEARTBEAT"
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
      {(["SOURCE_A", "SOURCE_B", "SINK_A", "SINK_B"] as const).map((bank, index) => (
        <chip
          key={bank}
          name={`U_LINE_${bank}`}
          manufacturerPartNumber="TMUX1112PWR"
          footprint="tssop16"
          pinLabels={{ pin1: "S3_3", pin2: "SGND", pin3: "CH1", pin4: "CH2", pin5: "CH3", pin6: "CH4" }}
          pcbX={-63 + index * 11}
          pcbY={-29}
        />
      ))}

      <chip
        name="U_ISO_MAIN"
        manufacturerPartNumber="ISO7762FDWR"
        footprint="soic16_w10.3mm"
        pinLabels={{
          pin1: "S3_3",
          pin2: "S_SCK",
          pin3: "S_MOSI",
          pin4: "S_CS",
          pin5: "S_ESP_RESET_ASSERT_N",
          pin6: "S_MISO",
          pin7: "S_ESP_HEARTBEAT",
          pin8: "SGND",
          pin9: "GND",
          pin10: "A_ESP_HEARTBEAT",
          pin11: "A_MISO",
          pin12: "A_ESP_RESET_ASSERT_N",
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
        cadModel={{
          glbUrl: "https://www.espressif.com/sites/default/files/3dmodel/ESP32-S3-WROOM-1U_20220720.glb"
        }}
        pinLabels={{
          pin1: "GND",
          pin2: ["3V3", "V3_3"],
          pin3: ["EN", "EN_RESET"],
          pin4: ["IO4", "SCORE_SCK"],
          pin5: ["IO5", "SCORE_MOSI"],
          pin6: ["IO6", "SCORE_MISO"],
          pin7: ["IO7", "SCORE_CS"],
          pin8: ["IO15", "ESP_HEARTBEAT"],
          pin9: ["IO16", "HUB75_R2"],
          pin10: ["IO17", "STM_HEARTBEAT"],
          pin11: ["IO18", "APP_SPI_SCK"],
          pin12: ["IO8", "APP_SPI_MOSI"],
          pin13: ["IO19", "USB_DN"],
          pin14: ["IO20", "USB_DP"],
          pin15: ["IO3", "STRAP_RESERVED"],
          pin16: ["IO46", "HUB75_CLK"],
          pin17: ["IO9", "APP_SPI_MISO"],
          pin18: ["IO10", "I2C_SDA"],
          pin19: ["IO11", "I2C_SCL"],
          pin20: ["IO12", "WD_KICK"],
          pin21: ["IO13", "HUB75_R1"],
          pin22: ["IO14", "HUB75_G1"],
          pin23: ["IO21", "HUB75_B1"],
          pin24: ["IO47", "FRAM_CS"],
          pin25: ["IO48", "HUB75_LAT"],
          pin26: ["IO45", "HUB75_D"],
          pin27: "IO0",
          pin28: ["IO35", "I2S_BCLK"],
          pin29: ["IO36", "I2S_WCLK"],
          pin30: ["IO37", "I2S_DIN"],
          pin31: ["IO38", "HUB75_G2"],
          pin32: ["IO39", "HUB75_B2"],
          pin33: ["IO40", "HUB75_A"],
          pin34: ["IO41", "HUB75_B"],
          pin35: ["IO42", "HUB75_C"],
          pin36: "RXD0",
          pin37: "TXD0",
          pin38: ["IO2", "ETH_CS"],
          pin39: ["IO1", "HUB75_OE_N"],
          pin40: "GND_2",
          pin41: "EPAD_GND"
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
        footprint="lqfp48"
        pinLabels={{
          pin1: "TXN",
          pin2: "TXP",
          pin3: "AGND1",
          pin4: "AVDD1",
          pin5: "RXN",
          pin6: "RXP",
          pin7: "DNC",
          pin8: "AVDD2",
          pin9: "AGND2",
          pin10: "EXRES1",
          pin11: "AVDD3",
          pin12: "NC1",
          pin13: "NC2",
          pin14: "AGND3",
          pin15: "AVDD4",
          pin16: "AGND4",
          pin17: "AVDD5",
          pin18: "VBG",
          pin19: "AGND5",
          pin20: "TOCAP",
          pin21: "AVDD6",
          pin22: "1V2O",
          pin23: "RSVD1",
          pin24: "SPDLED",
          pin25: "LINKLED",
          pin26: "DUPLED",
          pin27: "ACTLED",
          pin28: ["VDD", "V3_3"],
          pin29: "GND",
          pin30: "XI",
          pin31: "XO",
          pin32: ["SCSn", "CS"],
          pin33: ["SCLK", "SCK"],
          pin34: "MISO",
          pin35: "MOSI",
          pin36: ["INTn", "IRQ"],
          pin37: "RSTn",
          pin38: "RSVD2",
          pin39: "RSVD3",
          pin40: "RSVD4",
          pin41: "RSVD5",
          pin42: "RSVD6",
          pin43: "PMODE2",
          pin44: "PMODE1",
          pin45: "PMODE0",
          pin46: "NC3",
          pin47: "NC4",
          pin48: "AGND6"
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
        manufacturerPartNumber="TAS2505TRGERQ1"
        footprint="vqfn24"
        pinLabels={{
          pin1: "SPI_SEL",
          pin2: "RESET_N",
          pin6: "AVSS",
          pin9: "SPK_N",
          pin10: "V5",
          pin11: "GND",
          pin12: "SPK_P",
          pin13: "I2S_DIN",
          pin14: "I2S_WCLK",
          pin15: "I2S_BCLK",
          pin19: "I2C_SCL",
          pin20: "I2C_SDA",
          pin22: "V3_3",
          pin23: "DVDD",
          pin24: "DVSS"
        }}
        pcbX={48}
        pcbY={-20}
      />
      <pinheader name="J_SPEAKER" pinCount={2} pinLabels={["SPK_P", "SPK_N"]} pcbX={68} pcbY={-20} />
      <pinheader
        name="J_STM_SWD"
        pinCount={5}
        pinLabels={["S3_3", "SWDIO", "SWCLK", "NRST", "SGND"]}
        pcbX={-62}
        pcbY={-41}
      />
      <pinheader
        name="J_ESP_DEBUG"
        pinCount={6}
        pinLabels={["V3_3", "TX", "RX", "EN_RESET", "BOOT", "GND"]}
        pcbX={34}
        pcbY={-29}
      />
      <pinheader name="TP_ESP_RESET_REQUEST_N" pinCount={1} pinLabels={["RESET_REQUEST_N"]} pcbX={5} pcbY={-11} />

      <connector
        name="J_USB_C"
        standard="usb_c"
        pinLabels={{
          pin1: "USB_DN",
          pin2: "USB_DP",
          pin3: "CC1",
          pin4: "CC2",
          pin5: "VBUS",
          pin6: "GND",
          pin7: "SHIELD"
        }}
        pcbX={52}
        pcbY={-46}
        pcbRotation={180}
      />
      <pinheader name="J_POWER_24V" pinCount={3} pinLabels={["V24_IN", "GND", "CHASSIS"]} pcbX={67} pcbY={-31} />
      <chip
        name="U_EFUSE"
        manufacturerPartNumber="TPS26631PWPT"
        footprint="tssop20"
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
      <trace from="J_PISTE.PISTE" to="U_ESD_L.SPARE" />
      <trace from="U_ESD_L.SPARE" to="U_PISTE_FRONTEND.RAW_PISTE" />
      <trace from="J_POWER_24V.CHASSIS" to="net.ESD_RETURN" />
      <trace from="U_PISTE_FRONTEND.SENSE_PISTE" to="U_STM32.PISTE" />
      <trace from="U_VREF.VOUT" to="U_STM32.VREF" />
      <trace from="U_STM32.WD_KICK" to="U_STM_WATCHDOG.WDI" />
      <trace from="U_STM_WATCHDOG.RESET" to="U_STM32.NRST" />
      <trace from="U_STM_SUPERVISOR.RESET" to="U_STM32.NRST" />
      <trace from="J_STM_SWD.NRST" to="U_STM32.NRST" />

      <trace from="U_STM32.SPI_SCK" to="U_ISO_MAIN.S_SCK" />
      <trace from="U_STM32.SPI_MOSI" to="U_ISO_MAIN.S_MOSI" />
      <trace from="U_STM32.SPI_CS" to="U_ISO_MAIN.S_CS" />
      <trace from="U_STM32.SPI_MISO" to="U_ISO_MAIN.S_MISO" />
      <trace from="U_STM32.ESP_RESET" to="U_ISO_MAIN.S_ESP_RESET_ASSERT_N" />
      <trace from="U_STM32.HEARTBEAT" to="U_ISO_AUX.S_HEARTBEAT" />
      <trace from="U_ISO_MAIN.A_SCK" to="U_ESP32.SCORE_SCK" />
      <trace from="U_ISO_MAIN.A_MOSI" to="U_ESP32.SCORE_MOSI" />
      <trace from="U_ISO_MAIN.A_CS" to="U_ESP32.SCORE_CS" />
      <trace from="U_ISO_MAIN.A_MISO" to="U_ESP32.SCORE_MISO" />
      <trace from="U_ISO_MAIN.A_ESP_RESET_ASSERT_N" to="TP_ESP_RESET_REQUEST_N.RESET_REQUEST_N" />
      <trace from="U_ISO_AUX.A_HEARTBEAT" to="U_ESP32.STM_HEARTBEAT" />
      <trace from="U_ESP32.ESP_HEARTBEAT" to="U_ISO_MAIN.A_ESP_HEARTBEAT" />
      <trace from="U_ISO_MAIN.S_ESP_HEARTBEAT" to="U_STM32.ESP_HEARTBEAT" />

      <trace from="U_ESP32.USB_DN" to="J_USB_C.USB_DN" />
      <trace from="U_ESP32.USB_DP" to="J_USB_C.USB_DP" />

      <trace from="U_ESP32.APP_SPI_SCK" to="U_ETHERNET.SCK" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="U_ETHERNET.MOSI" />
      <trace from="U_ESP32.APP_SPI_MISO" to="U_ETHERNET.MISO" />
      <trace from="U_ESP32.ETH_CS" to="U_ETHERNET.CS" />
      <trace from="U_ETHERNET.TXP" to="J_ETHERNET_MAGJACK.TXP" />
      <trace from="U_ETHERNET.TXN" to="J_ETHERNET_MAGJACK.TXN" />
      <trace from="U_ETHERNET.RXP" to="J_ETHERNET_MAGJACK.RXP" />
      <trace from="U_ETHERNET.RXN" to="J_ETHERNET_MAGJACK.RXN" />
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
      <trace from="U_DISPLAY_BUFFER_A.DIR_TO_PANEL" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_B.DIR_TO_PANEL" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N" to="net.GND" />
      <trace from="U_DISPLAY_BUFFER_B.BUFFER_ENABLE_N" to="net.GND" />
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
      <trace from="U_ESP32.I2C_SDA" to="U_POWER_MONITOR.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_POWER_MONITOR.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_BUCK_BOOST.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_BUCK_BOOST.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_AUDIO.I2C_SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_AUDIO.I2C_SCL" />
      <trace from="U_ESP32.I2S_BCLK" to="U_AUDIO.I2S_BCLK" />
      <trace from="U_ESP32.I2S_WCLK" to="U_AUDIO.I2S_WCLK" />
      <trace from="U_ESP32.I2S_DIN" to="U_AUDIO.I2S_DIN" />
      <trace from="U_ESP32.APP_SPI_SCK" to="U_FRAM.SCK" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="U_FRAM.MOSI" />
      <trace from="U_ESP32.APP_SPI_MISO" to="U_FRAM.MISO" />
      <trace from="U_ESP32.FRAM_CS" to="U_FRAM.CS" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_ETHERNET.RSTn" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_AUDIO.RESET_N" />

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
