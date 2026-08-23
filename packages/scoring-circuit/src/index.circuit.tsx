import { manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"

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

/**
 * Canonical end-to-end connectivity model. This is intentionally not one PCB:
 * use scoring-io-board.circuit.tsx and application-display-carrier.circuit.tsx
 * for the separate physical planning models.
 */
function ScoringCircuit() {
  return (
    <board title="Competition scoring apparatus logical connectivity" width="160mm" height="100mm" layers={4}>
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
        pinLabels={{
          pin1: "S3_3",
          pin2: "CWD",
          pin3: "EN",
          pin4: "SGND",
          pin5: "SET1",
          pin6: "WDI",
          pin7: "RESET",
          pin8: "ENOUT"
        }}
        pcbX={-66}
        pcbY={-12}
      />
      <chip
        name="U_STM_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        footprint="wson6"
        pinLabels={{ pin1: "SENSE", pin2: "SGND", pin3: "MR", pin4: "S3_3", pin5: "CT", pin6: "RESET" }}
        pcbX={-66}
        pcbY={-22}
      />
      <resistor name="R_STM_WD_CWD" resistance="10k" tolerance="1%" footprint="0603" pcbX={-72} pcbY={-12} />
      <capacitor name="C_STM_WD_BYPASS" capacitance="100nF" footprint="0603" pcbX={-75} pcbY={-12} />
      <capacitor
        name="C_STM_SUPERVISOR_CT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={-72}
        pcbY={-22}
      />
      <capacitor
        name="C_STM_SUPERVISOR_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={-75}
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
        pinLabels={{
          pin1: "V3_3",
          pin2: "CWD",
          pin3: "EN",
          pin4: "GND",
          pin5: "SET1",
          pin6: "WDI",
          pin7: "RESET",
          pin8: "ENOUT"
        }}
        pcbX={13}
        pcbY={-19}
      />
      <chip
        name="U_ESP_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        footprint="wson6"
        pinLabels={{ pin1: "SENSE", pin2: "GND", pin3: "MR", pin4: "V3_3", pin5: "CT", pin6: "RESET" }}
        pcbX={26}
        pcbY={-19}
      />
      <resistor
        name="R_ESP_EN_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
        pcbX={34}
        pcbY={-9}
      />
      <capacitor name="C_ESP_EN_DELAY" capacitance="1uF" footprint="0603" pcbX={39} pcbY={-9} />
      <chip
        name="Q_ESP_RESET_STM"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={31}
        pcbY={-2}
      />
      <chip
        name="Q_ESP_DEBUG_RESET"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={46}
        pcbY={-29}
      />
      <resistor name="R_STM_RESET_GATE" resistance="10k" tolerance="1%" footprint="0603" pcbX={24} pcbY={-2} />
      <resistor name="R_STM_RESET_GATE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={28} pcbY={3} />
      <resistor name="R_DEBUG_RESET_GATE" resistance="10k" tolerance="1%" footprint="0603" pcbX={42} pcbY={-29} />
      <resistor name="R_DEBUG_RESET_GATE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={46} pcbY={-25} />
      <resistor name="R_STM_RESET_ISO_SERIES" resistance="10k" tolerance="1%" footprint="0603" pcbX={-5} pcbY={-8} />
      <resistor name="R_STM_RESET_ISO_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={-1} pcbY={-8} />
      <resistor name="R_ESP_WD_CWD" resistance="10k" tolerance="1%" footprint="0603" pcbX={9} pcbY={-24} />
      <capacitor name="C_ESP_WD_BYPASS" capacitance="100nF" footprint="0603" pcbX={5} pcbY={-24} />
      <capacitor
        name="C_ESP_SUPERVISOR_CT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={30}
        pcbY={-25}
      />
      <capacitor
        name="C_ESP_SUPERVISOR_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={35}
        pcbY={-25}
      />
      <chip
        name="Q_DISPLAY_BUFFER_A_ENABLE"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={9}
        pcbY={24}
      />
      <chip
        name="Q_DISPLAY_BUFFER_B_ENABLE"
        manufacturerPartNumber="BSS138AKA"
        footprint="sot23"
        pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
        pcbX={35}
        pcbY={24}
      />
      <resistor name="R_BUFFER_A_ENABLE_PULLUP" resistance="10k" tolerance="1%" footprint="0603" pcbX={9} pcbY={20} />
      <resistor name="R_BUFFER_B_ENABLE_PULLUP" resistance="10k" tolerance="1%" footprint="0603" pcbX={35} pcbY={20} />
      <resistor name="R_BUFFER_A_GATE" resistance="10k" tolerance="1%" footprint="0603" pcbX={14} pcbY={24} />
      <resistor name="R_BUFFER_B_GATE" resistance="10k" tolerance="1%" footprint="0603" pcbX={40} pcbY={24} />
      <resistor name="R_BUFFER_A_GATE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={14} pcbY={28} />
      <resistor name="R_BUFFER_B_GATE_PD" resistance="100k" tolerance="1%" footprint="0603" pcbX={40} pcbY={28} />

      <chip
        name="J_CTRL_CARRIER"
        manufacturerPartNumber="Molex 43045-1200"
        doNotPlace
        pinLabels={{
          pin1: "GND_1",
          pin2: "W5500_SCK",
          pin3: "GND_2",
          pin4: "W5500_MOSI",
          pin5: "GND_3",
          pin6: "W5500_MISO",
          pin7: "GND_4",
          pin8: "W5500_CS_N",
          pin9: "W5500_INT_N",
          pin10: "COMM_RESET_ASSERT",
          pin11: "COMM_PRESENT_N",
          pin12: "GND_5"
        }}
        pcbX={55}
        pcbY={25}
      />
      {/*
       * The ESP32 has no spare GPIO for the communications-board status pins.
       * INT is therefore intentionally polling-only. Presence and reset stay
       * electrically fail-closed: an unplugged harness reads absent, while a
       * disconnected reset request cannot assert reset. Neither status signal
       * is silently repurposed as an ESP32 input.
       */}
      <resistor name="R_COMM_SCK_SERIES" resistance="33" tolerance="1%" footprint="0603" pcbX={45} pcbY={21} />
      <resistor name="R_COMM_MOSI_SERIES" resistance="33" tolerance="1%" footprint="0603" pcbX={45} pcbY={25} />
      <resistor name="R_COMM_CS_SERIES" resistance="33" tolerance="1%" footprint="0603" pcbX={45} pcbY={29} />
      <resistor name="R_COMM_SCK_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" pcbX={50} pcbY={21} />
      <resistor name="R_COMM_MOSI_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" pcbX={50} pcbY={25} />
      <resistor name="R_COMM_CS_N_DEFAULT_HIGH" resistance="100k" tolerance="1%" footprint="0603" pcbX={50} pcbY={29} />
      <resistor name="R_COMM_MISO_DEFAULT_LOW" resistance="100k" tolerance="1%" footprint="0603" pcbX={55} pcbY={21} />
      <resistor
        name="R_COMM_RESET_ASSERT_DEFAULT_LOW"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
        pcbX={60}
        pcbY={19}
      />
      <resistor
        name="R_COMM_PRESENT_N_ABSENT_PULLUP"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
        pcbX={64}
        pcbY={19}
      />
      <resistor name="R_COMM_INT_N_IDLE_PULLUP" resistance="100k" tolerance="1%" footprint="0603" pcbX={68} pcbY={19} />
      <pinheader name="TP_COMM_PRESENT_N" pinCount={1} pinLabels={["COMM_PRESENT_N"]} pcbX={67} pcbY={14} />
      <pinheader name="TP_COMM_INT_N" pinCount={1} pinLabels={["W5500_INT_N_POLLING_ONLY"]} pcbX={72} pcbY={14} />
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
        pinLabels={["V3_3", "TX", "RX", "MANUAL_RESET_ASSERT", "BOOT", "GND"]}
        pcbX={34}
        pcbY={-29}
      />
      <pinheader name="TP_ESP_RESET_REQUEST" pinCount={1} pinLabels={["RESET_REQUEST"]} pcbX={5} pcbY={-11} />

      <chip
        name="J_PWR_CARRIER"
        manufacturerPartNumber="Molex 43045-0400"
        // The same exact header is specified at both ends of the de-energized
        // J_PWR harness. Its land pattern remains deliberately absent from
        // fabrication output until the controlled Molex geometry is reviewed.
        {...manufacturerFootprintProps("Molex 43045-0400")}
        pinLabels={{ pin1: "V20_EFUSE_OUT_A", pin2: "GND_A", pin3: "V20_EFUSE_OUT_B", pin4: "GND_B" }}
        pcbX={52}
        pcbY={-46}
      />
      <chip
        name="J_USB2_CARRIER"
        manufacturerPartNumber="HSEC8-113-01-L-DV-A-L2"
        // The Samtec pair assignment, edge-card geometry, mask, paste, and
        // courtyard remain a controlled harness release gate.
        {...manufacturerFootprintProps("HSEC8-113-01-L-DV-A-L2")}
        pinLabels={{ pin1: "USB_DN", pin2: "USB_DP", pin3: "SHIELD" }}
        pcbX={44}
        pcbY={-46}
      />
      <chip
        name="R_USB_DN_CARRIER"
        manufacturerPartNumber="22R_1PCT_0402"
        footprint="0402"
        pinLabels={{ pin1: "USB_DN_FROM_COMM", pin2: "USB_DN" }}
        pcbX={38}
        pcbY={-44}
      />
      <chip
        name="R_USB_DP_CARRIER"
        manufacturerPartNumber="22R_1PCT_0402"
        footprint="0402"
        pinLabels={{ pin1: "USB_DP_FROM_COMM", pin2: "USB_DP" }}
        pcbX={38}
        pcbY={-48}
      />
      <chip
        name="U_V5_BUCK"
        manufacturerPartNumber="TPS56A37RPAR"
        // The RPA VQFN-HR exposed-pad geometry is not a generic qfn10.
        {...manufacturerFootprintProps("TPS56A37RPAR")}
        pinLabels={{
          pin1: "EN",
          pin2: "FB",
          pin3: "AGND",
          pin4: "PG",
          pin5: "SS",
          pin6: "SW",
          pin7: "BOOT",
          pin8: "VIN",
          pin9: "PGND",
          pin10: "MODE"
        }}
        pcbX={20}
        pcbY={-38}
      />
      <chip
        name="L_V5_BUCK"
        manufacturerPartNumber="744325330"
        // The WE-HCI land pattern must come from the exact manufacturer
        // drawing; the unresolved we-pad alias is not fabrication evidence.
        {...manufacturerFootprintProps("744325330")}
        pinLabels={{ pin1: "SW", pin2: "V5_SENSE_IN" }}
        pcbX={12}
        pcbY={-26}
      />
      <chip
        name="R_V5_SENSE"
        manufacturerPartNumber="CRE2512-FZ-R002E-3"
        // The high-current Kelvin shunt must not use a generic 2512 pattern.
        {...manufacturerFootprintProps("CRE2512-FZ-R002E-3")}
        pinLabels={{ pin1: "V5_SENSE_IN", pin2: "V5" }}
        pcbX={6}
        pcbY={-38}
      />
      <chip
        name="C_V5_BUCK_IN_A"
        manufacturerPartNumber="GRM32ER7YA106KA12L"
        {...manufacturerFootprintProps("GRM32ER7YA106KA12L")}
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
        pcbX={22}
        pcbY={-32}
      />
      <chip
        name="C_V5_BUCK_IN_B"
        manufacturerPartNumber="GRM32ER7YA106KA12L"
        {...manufacturerFootprintProps("GRM32ER7YA106KA12L")}
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
        pcbX={18}
        pcbY={-32}
      />
      <chip
        name="C_V5_BUCK_IN_HF"
        manufacturerPartNumber="885012206095"
        footprint="0603"
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
        pcbX={14}
        pcbY={-32}
      />
      <chip
        name="C_V5_BUCK_BOOT"
        manufacturerPartNumber="885012206095"
        footprint="0603"
        pinLabels={{ pin1: "BOOT", pin2: "SW" }}
        pcbX={10}
        pcbY={-32}
      />
      <chip
        name="C_V5_BUCK_OUT_A"
        manufacturerPartNumber="GRM32ER71E226KE15L"
        {...manufacturerFootprintProps("GRM32ER71E226KE15L")}
        pinLabels={{ pin1: "V5", pin2: "GND" }}
        pcbX={2}
        pcbY={-32}
      />
      <chip
        name="C_V5_BUCK_OUT_B"
        manufacturerPartNumber="GRM32ER71E226KE15L"
        {...manufacturerFootprintProps("GRM32ER71E226KE15L")}
        pinLabels={{ pin1: "V5", pin2: "GND" }}
        pcbX={-2}
        pcbY={-32}
      />
      <resistor name="R_V5_BUCK_EN_UP" resistance="88.7k" tolerance="1%" footprint="0603" pcbX={28} pcbY={-38} />
      <resistor name="R_V5_BUCK_EN_DOWN" resistance="6.04k" tolerance="1%" footprint="0603" pcbX={28} pcbY={-42} />
      <resistor name="R_V5_BUCK_MODE" resistance="52.3k" tolerance="1%" footprint="0603" pcbX={24} pcbY={-46} />
      <chip
        name="C_V5_BUCK_SS"
        manufacturerPartNumber="C1608X7R1H473K080AA"
        footprint="0603"
        pinLabels={{ pin1: "SS", pin2: "GND" }}
        pcbX={18}
        pcbY={-46}
      />
      <resistor name="R_V5_BUCK_FB_TOP" resistance="73.2k" tolerance="0.5%" footprint="0603" pcbX={2} pcbY={-46} />
      <resistor name="R_V5_BUCK_FB_BOTTOM" resistance="10k" tolerance="0.5%" footprint="0603" pcbX={-2} pcbY={-46} />
      <resistor name="R_V5_BUCK_FF" resistance="49.9" tolerance="0.5%" footprint="0603" pcbX={6} pcbY={-50} />
      <chip
        name="C_V5_BUCK_FF"
        manufacturerPartNumber="GRM1885C1H151JA01D"
        footprint="0603"
        pinLabels={{ pin1: "FF", pin2: "FB" }}
        pcbX={10}
        pcbY={-50}
      />
      <resistor name="R_V5_BUCK_PG_PULLUP" resistance="100k" tolerance="1%" footprint="0603" pcbX={14} pcbY={-50} />
      <pinheader name="TP_V5_BUCK_PG" pinCount={1} pinLabels={["V5_PG"]} pcbX={20} pcbY={-50} />
      <chip
        name="U_APP_REGULATOR"
        manufacturerPartNumber="LMR43620MSC3RPERQ1"
        // The 9-pin RPE VQFN-HR package needs its exact HotRod copper,
        // thermal-pad, mask, paste, and courtyard implementation.
        {...manufacturerFootprintProps("LMR43620MSC3RPERQ1")}
        pinLabels={{
          pin1: "MODE_SYNC",
          pin2: "PGOOD",
          pin3: "EN_UVLO",
          pin4: "VIN",
          pin5: "SW",
          pin6: "BOOT",
          pin7: "VCC",
          pin8: "VOUT_FB",
          pin9: "GND"
        }}
        pcbX={7}
        pcbY={-38}
      />
      <chip
        name="L_APP_REGULATOR"
        manufacturerPartNumber="XGL4030-222MEC"
        // Intentionally non-placeable until the exact Coilcraft XGL4030 land
        // pattern is imported and independently verified. A generic passive
        // footprint would make the generated fabrication output unsafe.
        {...manufacturerFootprintProps("XGL4030-222MEC")}
        pinLabels={{ pin1: "SW", pin2: "V3_3" }}
        pcbX={12}
        pcbY={-38}
      />
      <chip
        name="C_APP_REG_IN"
        manufacturerPartNumber="C2012X7R1E475K125AB"
        footprint="0805"
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
        pcbX={1}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_IN_HF"
        manufacturerPartNumber="C0603C104K3RACTU"
        {...manufacturerFootprintProps("C0603C104K3RACTU")}
        pinLabels={{ pin1: "VIN", pin2: "GND" }}
        pcbX={4}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_BOOT"
        manufacturerPartNumber="C0603C104K3RACTU"
        {...manufacturerFootprintProps("C0603C104K3RACTU")}
        pinLabels={{ pin1: "BOOT", pin2: "SW" }}
        pcbX={8}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_VCC"
        manufacturerPartNumber="GRM188R71A105KA61"
        {...manufacturerFootprintProps("GRM188R71A105KA61")}
        pinLabels={{ pin1: "VCC", pin2: "GND" }}
        pcbX={12}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_OUT_A"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        {...manufacturerFootprintProps("C2012X7S1A226M125AC")}
        pinLabels={{ pin1: "V3_3", pin2: "GND" }}
        pcbX={16}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_OUT_B"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        {...manufacturerFootprintProps("C2012X7S1A226M125AC")}
        pinLabels={{ pin1: "V3_3", pin2: "GND" }}
        pcbX={20}
        pcbY={-44}
      />
      <chip
        name="C_APP_REG_OUT_C"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        {...manufacturerFootprintProps("C2012X7S1A226M125AC")}
        pinLabels={{ pin1: "V3_3", pin2: "GND" }}
        pcbX={24}
        pcbY={-44}
      />
      <chip
        name="R_APP_REG_DISCHARGE"
        manufacturerPartNumber="RC0603FR-071KL"
        footprint="0603"
        pinLabels={{ pin1: "V3_3", pin2: "GND" }}
        pcbX={28}
        pcbY={-44}
      />
      <resistor
        name="R_APP_REG_PGOOD"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance={10000}
        tolerance="1%"
        footprint="0603"
        pcbX={32}
        pcbY={-44}
      />
      <pinheader name="TP_APP_REG_PGOOD" pinCount={1} pinLabels={["APP_PGOOD"]} pcbX={36} pcbY={-44} />
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
      <trace from="U_PISTE_FRONTEND.SENSE_PISTE" to="U_STM32.PISTE" />
      <trace from="U_VREF.VOUT" to="U_STM32.VREF" />
      <trace from="U_STM32.WD_KICK" to="U_STM_WATCHDOG.WDI" />
      <trace from="U_STM_WATCHDOG.EN" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.SET1" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.CWD" to="R_STM_WD_CWD.pin1" />
      <trace from="R_STM_WD_CWD.pin2" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.ENOUT" to="U_STM_WATCHDOG.RESET" />
      <trace from="C_STM_WD_BYPASS.pin1" to="net.S3_3" />
      <trace from="C_STM_WD_BYPASS.pin2" to="net.SGND" />
      <trace from="U_STM_WATCHDOG.RESET" to="U_STM32.NRST" />
      <trace from="U_STM_SUPERVISOR.SENSE" to="net.S3_3" />
      <trace from="U_STM_SUPERVISOR.MR" to="net.S3_3" />
      <trace from="U_STM_SUPERVISOR.CT" to="C_STM_SUPERVISOR_CT.pin1" />
      <trace from="C_STM_SUPERVISOR_CT.pin2" to="net.SGND" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin1" to="net.S3_3" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin2" to="net.SGND" />
      <trace from="U_STM_SUPERVISOR.RESET" to="U_STM32.NRST" />
      <trace from="J_STM_SWD.NRST" to="U_STM32.NRST" />

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

      <trace from="J_USB2_CARRIER.USB_DN" to="R_USB_DN_CARRIER.USB_DN_FROM_COMM" />
      <trace from="J_USB2_CARRIER.USB_DP" to="R_USB_DP_CARRIER.USB_DP_FROM_COMM" />
      <trace from="R_USB_DN_CARRIER.USB_DN" to="U_ESP32.USB_DN" />
      <trace from="R_USB_DP_CARRIER.USB_DP" to="U_ESP32.USB_DP" />
      <trace from="J_USB2_CARRIER.SHIELD" to="net.CHASSIS" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_A" to="U_V5_BUCK.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_B" to="U_V5_BUCK.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_A" to="C_V5_BUCK_IN_A.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_B" to="C_V5_BUCK_IN_B.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_A" to="C_V5_BUCK_IN_HF.VIN" />
      <trace from="J_PWR_CARRIER.V20_EFUSE_OUT_B" to="R_V5_BUCK_EN_UP.pin1" />
      <trace from="J_PWR_CARRIER.GND_A" to="net.GND" />
      <trace from="J_PWR_CARRIER.GND_B" to="net.GND" />
      <trace from="R_V5_BUCK_EN_UP.pin2" to="U_V5_BUCK.EN" />
      <trace from="U_V5_BUCK.EN" to="R_V5_BUCK_EN_DOWN.pin1" />
      <trace from="R_V5_BUCK_EN_DOWN.pin2" to="net.GND" />
      <trace from="U_V5_BUCK.AGND" to="net.GND" />
      <trace from="U_V5_BUCK.PGND" to="net.GND" />
      <trace from="C_V5_BUCK_IN_A.GND" to="net.GND" />
      <trace from="C_V5_BUCK_IN_B.GND" to="net.GND" />
      <trace from="C_V5_BUCK_IN_HF.GND" to="net.GND" />
      <trace from="U_V5_BUCK.BOOT" to="C_V5_BUCK_BOOT.BOOT" />
      <trace from="C_V5_BUCK_BOOT.SW" to="U_V5_BUCK.SW" />
      <trace from="U_V5_BUCK.MODE" to="R_V5_BUCK_MODE.pin1" />
      <trace from="R_V5_BUCK_MODE.pin2" to="net.GND" />
      <trace from="U_V5_BUCK.SS" to="C_V5_BUCK_SS.SS" />
      <trace from="C_V5_BUCK_SS.GND" to="net.GND" />
      <trace from="U_V5_BUCK.SW" to="L_V5_BUCK.SW" />
      <trace from="L_V5_BUCK.V5_SENSE_IN" to="R_V5_SENSE.V5_SENSE_IN" />
      <trace from="R_V5_SENSE.V5" to="net.V5" />
      <trace from="net.V5" to="C_V5_BUCK_OUT_A.V5" />
      <trace from="net.V5" to="C_V5_BUCK_OUT_B.V5" />
      <trace from="C_V5_BUCK_OUT_A.GND" to="net.GND" />
      <trace from="C_V5_BUCK_OUT_B.GND" to="net.GND" />
      <trace from="net.V5" to="R_V5_BUCK_FB_TOP.pin1" />
      <trace from="R_V5_BUCK_FB_TOP.pin2" to="U_V5_BUCK.FB" />
      <trace from="U_V5_BUCK.FB" to="R_V5_BUCK_FB_BOTTOM.pin1" />
      <trace from="R_V5_BUCK_FB_BOTTOM.pin2" to="net.GND" />
      <trace from="net.V5" to="R_V5_BUCK_FF.pin1" />
      <trace from="R_V5_BUCK_FF.pin2" to="C_V5_BUCK_FF.FF" />
      <trace from="C_V5_BUCK_FF.FB" to="U_V5_BUCK.FB" />
      <trace from="U_V5_BUCK.PG" to="TP_V5_BUCK_PG.V5_PG" />
      <trace from="U_V5_BUCK.PG" to="R_V5_BUCK_PG_PULLUP.pin1" />
      <trace from="R_V5_BUCK_PG_PULLUP.pin2" to="net.V3_3" />
      <trace from="L_V5_BUCK.V5_SENSE_IN" to="U_POWER_MONITOR.VIN_P" />
      <trace from="net.V5" to="U_POWER_MONITOR.VIN_N" />
      <trace from="U_POWER_MONITOR.GND" to="net.GND" />
      <trace from="U_POWER_MONITOR.V3_3" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.VIN" to="net.V5" />
      <trace from="U_APP_REGULATOR.EN_UVLO" to="net.V5" />
      <trace from="U_APP_REGULATOR.MODE_SYNC" to="U_APP_REGULATOR.VCC" />
      <trace from="U_APP_REGULATOR.PGOOD" to="R_APP_REG_PGOOD.pin1" />
      <trace from="U_APP_REGULATOR.PGOOD" to="TP_APP_REG_PGOOD.APP_PGOOD" />
      <trace from="R_APP_REG_PGOOD.pin2" to="net.V5" />
      <trace from="U_APP_REGULATOR.SW" to="L_APP_REGULATOR.SW" />
      <trace from="L_APP_REGULATOR.V3_3" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.BOOT" to="C_APP_REG_BOOT.BOOT" />
      <trace from="C_APP_REG_BOOT.SW" to="U_APP_REGULATOR.SW" />
      <trace from="U_APP_REGULATOR.VCC" to="C_APP_REG_VCC.VCC" />
      <trace from="U_APP_REGULATOR.VOUT_FB" to="net.V3_3" />
      <trace from="C_APP_REG_IN.VIN" to="U_APP_REGULATOR.VIN" />
      <trace from="C_APP_REG_IN_HF.VIN" to="U_APP_REGULATOR.VIN" />
      <trace from="C_APP_REG_OUT_A.V3_3" to="net.V3_3" />
      <trace from="C_APP_REG_OUT_B.V3_3" to="net.V3_3" />
      <trace from="C_APP_REG_OUT_C.V3_3" to="net.V3_3" />
      <trace from="R_APP_REG_DISCHARGE.V3_3" to="net.V3_3" />
      <trace from="U_APP_REGULATOR.GND" to="net.GND" />
      <trace from="C_APP_REG_IN.GND" to="net.GND" />
      <trace from="C_APP_REG_IN_HF.GND" to="net.GND" />
      <trace from="C_APP_REG_VCC.GND" to="net.GND" />
      <trace from="C_APP_REG_OUT_A.GND" to="net.GND" />
      <trace from="C_APP_REG_OUT_B.GND" to="net.GND" />
      <trace from="C_APP_REG_OUT_C.GND" to="net.GND" />
      <trace from="R_APP_REG_DISCHARGE.GND" to="net.GND" />

      <trace from="U_ESP32.APP_SPI_SCK" to="R_COMM_SCK_SERIES.pin1" />
      <trace from="R_COMM_SCK_SERIES.pin2" to="J_CTRL_CARRIER.W5500_SCK" />
      <trace from="J_CTRL_CARRIER.W5500_SCK" to="R_COMM_SCK_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_SCK_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="R_COMM_MOSI_SERIES.pin1" />
      <trace from="R_COMM_MOSI_SERIES.pin2" to="J_CTRL_CARRIER.W5500_MOSI" />
      <trace from="J_CTRL_CARRIER.W5500_MOSI" to="R_COMM_MOSI_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_MOSI_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.APP_SPI_MISO" to="J_CTRL_CARRIER.W5500_MISO" />
      <trace from="J_CTRL_CARRIER.W5500_MISO" to="R_COMM_MISO_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_MISO_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="U_ESP32.ETH_CS" to="R_COMM_CS_SERIES.pin1" />
      <trace from="R_COMM_CS_SERIES.pin2" to="J_CTRL_CARRIER.W5500_CS_N" />
      <trace from="J_CTRL_CARRIER.W5500_CS_N" to="R_COMM_CS_N_DEFAULT_HIGH.pin1" />
      <trace from="R_COMM_CS_N_DEFAULT_HIGH.pin2" to="net.V3_3" />
      {(["GND_1", "GND_2", "GND_3", "GND_4", "GND_5"] as const).map((pin) => (
        <trace key={pin} from={`J_CTRL_CARRIER.${pin}`} to="net.GND" />
      ))}
      <trace from="J_CTRL_CARRIER.COMM_RESET_ASSERT" to="R_COMM_RESET_ASSERT_DEFAULT_LOW.pin1" />
      <trace from="R_COMM_RESET_ASSERT_DEFAULT_LOW.pin2" to="net.GND" />
      <trace from="J_CTRL_CARRIER.COMM_PRESENT_N" to="R_COMM_PRESENT_N_ABSENT_PULLUP.pin1" />
      <trace from="R_COMM_PRESENT_N_ABSENT_PULLUP.pin2" to="net.V3_3" />
      <trace from="J_CTRL_CARRIER.COMM_PRESENT_N" to="TP_COMM_PRESENT_N.COMM_PRESENT_N" />
      <trace from="J_CTRL_CARRIER.W5500_INT_N" to="R_COMM_INT_N_IDLE_PULLUP.pin1" />
      <trace from="R_COMM_INT_N_IDLE_PULLUP.pin2" to="net.V3_3" />
      <trace from="J_CTRL_CARRIER.W5500_INT_N" to="TP_COMM_INT_N.W5500_INT_N_POLLING_ONLY" />
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
      <trace from="U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N" to="R_BUFFER_A_ENABLE_PULLUP.pin1" />
      <trace from="R_BUFFER_A_ENABLE_PULLUP.pin2" to="net.V5" />
      <trace from="U_DISPLAY_BUFFER_B.BUFFER_ENABLE_N" to="R_BUFFER_B_ENABLE_PULLUP.pin1" />
      <trace from="R_BUFFER_B_ENABLE_PULLUP.pin2" to="net.V5" />
      <trace from="U_ESP32.EN_RESET" to="R_ESP_EN_PULLUP.pin1" />
      <trace from="R_ESP_EN_PULLUP.pin2" to="net.V3_3" />
      <trace from="U_ESP32.EN_RESET" to="C_ESP_EN_DELAY.pin1" />
      <trace from="C_ESP_EN_DELAY.pin2" to="net.GND" />
      <trace from="Q_ESP_RESET_STM.D" to="U_ESP32.EN_RESET" />
      <trace from="Q_ESP_RESET_STM.S" to="net.GND" />
      <trace from="U_ESP32.EN_RESET" to="U_ESP_SUPERVISOR.RESET" />
      <trace from="J_ESP_DEBUG.MANUAL_RESET_ASSERT" to="R_DEBUG_RESET_GATE.pin1" />
      <trace from="R_DEBUG_RESET_GATE.pin2" to="Q_ESP_DEBUG_RESET.G" />
      <trace from="Q_ESP_DEBUG_RESET.G" to="R_DEBUG_RESET_GATE_PD.pin1" />
      <trace from="R_DEBUG_RESET_GATE_PD.pin2" to="net.GND" />
      <trace from="Q_ESP_DEBUG_RESET.D" to="U_ESP32.EN_RESET" />
      <trace from="Q_ESP_DEBUG_RESET.S" to="net.GND" />
      <trace from="Q_DISPLAY_BUFFER_A_ENABLE.D" to="U_DISPLAY_BUFFER_A.BUFFER_ENABLE_N" />
      <trace from="Q_DISPLAY_BUFFER_A_ENABLE.S" to="net.GND" />
      <trace from="Q_DISPLAY_BUFFER_B_ENABLE.D" to="U_DISPLAY_BUFFER_B.BUFFER_ENABLE_N" />
      <trace from="Q_DISPLAY_BUFFER_B_ENABLE.S" to="net.GND" />
      <trace from="U_ESP32.EN_RESET" to="R_BUFFER_A_GATE.pin1" />
      <trace from="R_BUFFER_A_GATE.pin2" to="Q_DISPLAY_BUFFER_A_ENABLE.G" />
      <trace from="Q_DISPLAY_BUFFER_A_ENABLE.G" to="R_BUFFER_A_GATE_PD.pin1" />
      <trace from="R_BUFFER_A_GATE_PD.pin2" to="net.GND" />
      <trace from="U_ESP32.EN_RESET" to="R_BUFFER_B_GATE.pin1" />
      <trace from="R_BUFFER_B_GATE.pin2" to="Q_DISPLAY_BUFFER_B_ENABLE.G" />
      <trace from="Q_DISPLAY_BUFFER_B_ENABLE.G" to="R_BUFFER_B_GATE_PD.pin1" />
      <trace from="R_BUFFER_B_GATE_PD.pin2" to="net.GND" />
      <trace from="U_AUDIO.SPK_P" to="J_SPEAKER.SPK_P" />
      <trace from="U_AUDIO.SPK_N" to="J_SPEAKER.SPK_N" />
      <trace from="U_ESP32.WD_KICK" to="U_ESP_WATCHDOG.WDI" />
      <trace from="U_ESP_WATCHDOG.EN" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.SET1" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.CWD" to="R_ESP_WD_CWD.pin1" />
      <trace from="R_ESP_WD_CWD.pin2" to="net.V3_3" />
      <trace from="U_ESP_WATCHDOG.ENOUT" to="U_ESP_WATCHDOG.RESET" />
      <trace from="C_ESP_WD_BYPASS.pin1" to="net.V3_3" />
      <trace from="C_ESP_WD_BYPASS.pin2" to="net.GND" />
      <trace from="U_ESP_SUPERVISOR.SENSE" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.MR" to="net.V3_3" />
      <trace from="U_ESP_SUPERVISOR.CT" to="C_ESP_SUPERVISOR_CT.pin1" />
      <trace from="C_ESP_SUPERVISOR_CT.pin2" to="net.GND" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin1" to="net.V3_3" />
      <trace from="C_ESP_SUPERVISOR_BYPASS.pin2" to="net.GND" />
      <trace from="U_ESP_WATCHDOG.RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP_SUPERVISOR.RESET" to="U_ESP32.EN_RESET" />
      <trace from="U_ESP32.I2C_SDA" to="U_RTC.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_RTC.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_SECURE_ELEMENT.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_SECURE_ELEMENT.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_POWER_MONITOR.SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_POWER_MONITOR.SCL" />
      <trace from="U_ESP32.I2C_SDA" to="U_AUDIO.I2C_SDA" />
      <trace from="U_ESP32.I2C_SCL" to="U_AUDIO.I2C_SCL" />
      <trace from="U_ESP32.I2S_BCLK" to="U_AUDIO.I2S_BCLK" />
      <trace from="U_ESP32.I2S_WCLK" to="U_AUDIO.I2S_WCLK" />
      <trace from="U_ESP32.I2S_DIN" to="U_AUDIO.I2S_DIN" />
      <trace from="U_ESP32.APP_SPI_SCK" to="U_FRAM.SCK" />
      <trace from="U_ESP32.APP_SPI_MOSI" to="U_FRAM.MOSI" />
      <trace from="U_ESP32.APP_SPI_MISO" to="U_FRAM.MISO" />
      <trace from="U_ESP32.FRAM_CS" to="U_FRAM.CS" />
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
