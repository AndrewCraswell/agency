import { manufacturerFootprintProps } from "./manufacturer-footprint-adapter.js"
import { isolatedInterboardPinLabels, physicalBoardContract } from "./physical-board-contract.js"

const weaponPins = { pin1: "A", pin2: "B", pin3: "C" } as const

function WeaponInput({ side, x }: { readonly side: "L" | "R"; readonly x: number }) {
  return (
    <group name={`G_SCORING_WEAPON_${side}`} pcbX={x} pcbY={25}>
      <chip
        name={`J_WEAPON_HARNESS_${side}`}
        manufacturerPartNumber="WEAPON-HARNESS-CONNECTOR-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={weaponPins}
      />
      <chip
        name={`U_ESD_${side}`}
        manufacturerPartNumber="TPD4E05U06DQAR"
        {...manufacturerFootprintProps("TPD4E05U06DQAR")}
        footprint={[]}
        pinLabels={{ pin1: "CH_A", pin2: "CH_B", pin3: "CH_C", pin4: "SPARE", pin5: "ESD_RETURN" }}
      />
      <chip
        name={`U_FRONTEND_${side}`}
        manufacturerPartNumber="ANALOG-FRONT-END-TBD"
        doNotPlace
        footprint={[]}
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
      />
      <trace from={`J_WEAPON_HARNESS_${side}.A`} to={`U_ESD_${side}.CH_A`} />
      <trace from={`J_WEAPON_HARNESS_${side}.B`} to={`U_ESD_${side}.CH_B`} />
      <trace from={`J_WEAPON_HARNESS_${side}.C`} to={`U_ESD_${side}.CH_C`} />
      <trace from={`U_ESD_${side}.CH_A`} to={`U_FRONTEND_${side}.RAW_A`} />
      <trace from={`U_ESD_${side}.CH_B`} to={`U_FRONTEND_${side}.RAW_B`} />
      <trace from={`U_ESD_${side}.CH_C`} to={`U_FRONTEND_${side}.RAW_C`} />
      <trace from={`U_ESD_${side}.ESD_RETURN`} to="net.ESD_RETURN" />
      <trace from={`U_FRONTEND_${side}.SGND`} to="net.SGND" />
      <trace from={`U_FRONTEND_${side}.S3_3`} to="net.S3_3" />
    </group>
  )
}

/** Separate physical planning model; no generated outline or connector footprint is a release artifact. */
export default function ScoringIoBoardCircuit() {
  const board = physicalBoardContract.scoringIoBoard
  return (
    <board title={board.title} width={`${board.widthMm}mm`} height={`${board.heightMm}mm`} layers={board.layers}>
      <WeaponInput side="L" x={-125} />
      <WeaponInput side="R" x={-95} />
      <chip
        name="J_PISTE_HARNESS"
        manufacturerPartNumber="PISTE-HARNESS-CONNECTOR-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "PISTE", pin2: "SHIELD" }}
        pcbX={-60}
        pcbY={25}
      />
      <chip
        name="U_PISTE_FRONTEND"
        manufacturerPartNumber="PISTE-PROTECTION-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "RAW_PISTE", pin2: "SHIELD", pin3: "SGND", pin4: "S3_3", pin5: "SENSE_PISTE" }}
        pcbX={-55}
        pcbY={10}
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
          pin25: "ESP_HEARTBEAT",
          pin26: "SWDIO",
          pin27: "SWCLK"
        }}
        pcbX={-20}
        pcbY={0}
      />
      <chip
        name="U_VREF"
        manufacturerPartNumber="REF5025AQDRQ1"
        footprint="soic8"
        pinLabels={{ pin1: "VIN", pin2: "SGND", pin6: "VOUT" }}
        pcbX={-45}
        pcbY={-10}
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
        pcbX={-40}
        pcbY={-25}
      />
      <chip
        name="U_STM_SUPERVISOR"
        manufacturerPartNumber="TPS389033DSER"
        {...manufacturerFootprintProps("TPS389033DSER")}
        footprint={[]}
        pinLabels={{ pin1: "SENSE", pin2: "SGND", pin3: "MR", pin4: "S3_3", pin5: "CT", pin6: "RESET" }}
        pcbX={-20}
        pcbY={-25}
      />
      <resistor name="R_STM_WD_CWD" resistance="10k" tolerance="1%" footprint="0603" />
      <capacitor name="C_STM_WD_BYPASS" capacitance="100nF" footprint="0603" />
      <capacitor
        name="C_STM_SUPERVISOR_CT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <capacitor
        name="C_STM_SUPERVISOR_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
      />
      <chip
        name="U_ISOLATED_POWER"
        manufacturerPartNumber="NXE1S0505MC"
        footprint="dip6"
        pinLabels={{ pin1: "V5", pin2: "GND", pin4: "SGND", pin6: "S5" }}
        pcbX={15}
        pcbY={-25}
      />
      <chip
        name="U_SCORING_LDO"
        manufacturerPartNumber="LOW-NOISE-LDO-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{ pin1: "S5", pin2: "SGND", pin3: "ENABLE", pin5: "S3_3" }}
        pcbX={35}
        pcbY={-25}
      />
      {(["SOURCE_A", "SOURCE_B", "SINK_A", "SINK_B"] as const).map((bank, index) => (
        <chip
          key={bank}
          name={`U_LINE_${bank}`}
          manufacturerPartNumber="TMUX1112PWR"
          {...manufacturerFootprintProps("TMUX1112PWR")}
          footprint={[]}
          pinLabels={{ pin1: "S3_3", pin2: "SGND", pin3: "CH1", pin4: "CH2", pin5: "CH3", pin6: "CH4" }}
          pcbX={-5 + index * 18}
          pcbY={-25}
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
        pcbX={70}
        pcbY={-10}
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
        pcbX={70}
        pcbY={15}
      />
      <chip
        name="J_ISO_APP_BOUNDARY"
        manufacturerPartNumber="ISOLATED-INTERBOARD-CONNECTOR-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={isolatedInterboardPinLabels}
        pcbX={110}
        pcbY={0}
      />
      <pinheader
        name="J_STM_SWD"
        pinCount={5}
        pinLabels={["S3_3", "SWDIO", "SWCLK", "NRST", "SGND"]}
        pcbX={-15}
        pcbY={25}
      />
      <trace from="U_FRONTEND_L.SENSE_A" to="U_STM32.LEFT_A" />
      <trace from="U_FRONTEND_L.SENSE_B" to="U_STM32.LEFT_B" />
      <trace from="U_FRONTEND_L.SENSE_C" to="U_STM32.LEFT_C" />
      <trace from="U_FRONTEND_R.SENSE_A" to="U_STM32.RIGHT_A" />
      <trace from="U_FRONTEND_R.SENSE_B" to="U_STM32.RIGHT_B" />
      <trace from="U_FRONTEND_R.SENSE_C" to="U_STM32.RIGHT_C" />
      <chip
        name="U_PRIMARY_OUTPUT_DRIVER"
        manufacturerPartNumber="PRIMARY-LAMP-BUZZER-DRIVER-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "LAMP_RED_IN",
          pin2: "LAMP_GREEN_IN",
          pin3: "LAMP_WHITE_L_IN",
          pin4: "LAMP_WHITE_R_IN",
          pin5: "BUZZER_IN",
          pin6: "S3_3",
          pin7: "SGND",
          pin8: "LAMP_RED_OUT",
          pin9: "LAMP_GREEN_OUT",
          pin10: "LAMP_WHITE_L_OUT",
          pin11: "LAMP_WHITE_R_OUT",
          pin12: "BUZZER_OUT"
        }}
        pcbX={10}
        pcbY={25}
      />
      <chip
        name="J_PRIMARY_OUTPUTS_HARNESS"
        manufacturerPartNumber="PRIMARY-OUTPUT-HARNESS-CONNECTOR-TBD"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "LAMP_RED",
          pin2: "LAMP_GREEN",
          pin3: "LAMP_WHITE_L",
          pin4: "LAMP_WHITE_R",
          pin5: "BUZZER",
          pin6: "RETURN"
        }}
        pcbX={45}
        pcbY={25}
      />
      <trace from="J_PISTE_HARNESS.PISTE" to="U_PISTE_FRONTEND.RAW_PISTE" />
      <trace from="J_PISTE_HARNESS.SHIELD" to="U_PISTE_FRONTEND.SHIELD" />
      <trace from="U_PISTE_FRONTEND.SHIELD" to="net.ESD_RETURN" />
      <trace from="U_PISTE_FRONTEND.SGND" to="net.SGND" />
      <trace from="U_PISTE_FRONTEND.S3_3" to="net.S3_3" />
      <trace from="U_PISTE_FRONTEND.SENSE_PISTE" to="U_STM32.PISTE" />
      <trace from="U_VREF.VOUT" to="U_STM32.VREF" />
      <trace from="U_VREF.VIN" to="net.S5" />
      <trace from="U_VREF.SGND" to="net.SGND" />
      <trace from="U_STM32.WD_KICK" to="U_STM_WATCHDOG.WDI" />
      <trace from="U_STM_WATCHDOG.EN" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.SET1" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.CWD" to="R_STM_WD_CWD.pin1" />
      <trace from="R_STM_WD_CWD.pin2" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.ENOUT" to="U_STM_WATCHDOG.RESET" />
      <trace from="C_STM_WD_BYPASS.pin1" to="net.S3_3" />
      <trace from="C_STM_WD_BYPASS.pin2" to="net.SGND" />
      <trace from="U_STM_WATCHDOG.RESET" to="U_STM32.NRST" />
      <trace from="U_STM_WATCHDOG.S3_3" to="net.S3_3" />
      <trace from="U_STM_WATCHDOG.SGND" to="net.SGND" />
      <trace from="U_STM_SUPERVISOR.SENSE" to="net.S3_3" />
      <trace from="U_STM_SUPERVISOR.MR" to="net.S3_3" />
      <trace from="U_STM_SUPERVISOR.CT" to="C_STM_SUPERVISOR_CT.pin1" />
      <trace from="C_STM_SUPERVISOR_CT.pin2" to="net.SGND" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin1" to="net.S3_3" />
      <trace from="C_STM_SUPERVISOR_BYPASS.pin2" to="net.SGND" />
      <trace from="U_STM_SUPERVISOR.RESET" to="U_STM32.NRST" />
      <trace from="U_STM_SUPERVISOR.S3_3" to="net.S3_3" />
      <trace from="U_STM_SUPERVISOR.SGND" to="net.SGND" />
      <trace from="U_STM32.S3_3" to="net.S3_3" />
      <trace from="U_STM32.SGND" to="net.SGND" />
      <trace from="U_ISOLATED_POWER.S5" to="net.S5" />
      <trace from="U_ISOLATED_POWER.SGND" to="net.SGND" />
      <trace from="U_SCORING_LDO.ENABLE" to="net.S5" />
      <trace from="U_SCORING_LDO.S5" to="net.S5" />
      <trace from="U_SCORING_LDO.S3_3" to="net.S3_3" />
      <trace from="U_SCORING_LDO.SGND" to="net.SGND" />
      {(["SOURCE_A", "SOURCE_B", "SINK_A", "SINK_B"] as const).flatMap((bank) => [
        <trace key={`${bank}-supply`} from={`U_LINE_${bank}.S3_3`} to="net.S3_3" />,
        <trace key={`${bank}-return`} from={`U_LINE_${bank}.SGND`} to="net.SGND" />
      ])}
      <trace from="U_STM32.SPI_SCK" to="U_ISO_MAIN.S_SCK" />
      <trace from="U_STM32.SPI_MOSI" to="U_ISO_MAIN.S_MOSI" />
      <trace from="U_STM32.SPI_CS" to="U_ISO_MAIN.S_CS" />
      <trace from="U_STM32.SPI_MISO" to="U_ISO_MAIN.S_MISO" />
      <trace from="U_STM32.ESP_RESET" to="U_ISO_MAIN.S_ESP_RESET_ASSERT" />
      <trace from="U_STM32.HEARTBEAT" to="U_ISO_AUX.S_HEARTBEAT" />
      <trace from="J_ISO_APP_BOUNDARY.V5_PRIMARY" to="U_ISOLATED_POWER.V5" />
      <trace from="J_ISO_APP_BOUNDARY.APP_GND_PRIMARY" to="U_ISOLATED_POWER.GND" />
      <trace from="J_ISO_APP_BOUNDARY.V3_3_APP" to="U_ISO_MAIN.V3_3" />
      <trace from="J_ISO_APP_BOUNDARY.V3_3_APP" to="U_ISO_AUX.V3_3" />
      <trace from="J_ISO_APP_BOUNDARY.APP_GND_LOGIC" to="U_ISO_MAIN.GND" />
      <trace from="J_ISO_APP_BOUNDARY.APP_GND_LOGIC" to="U_ISO_AUX.GND" />
      <trace from="U_ISO_MAIN.A_SCK" to="J_ISO_APP_BOUNDARY.SCORE_SCK" />
      <trace from="U_ISO_MAIN.A_MOSI" to="J_ISO_APP_BOUNDARY.SCORE_MOSI" />
      <trace from="U_ISO_MAIN.A_MISO" to="J_ISO_APP_BOUNDARY.SCORE_MISO" />
      <trace from="U_ISO_MAIN.A_CS" to="J_ISO_APP_BOUNDARY.SCORE_CS" />
      <trace from="U_ISO_MAIN.A_ESP_RESET_ASSERT" to="J_ISO_APP_BOUNDARY.ESP_RESET_ASSERT" />
      <trace from="U_ISO_AUX.A_HEARTBEAT" to="J_ISO_APP_BOUNDARY.STM_HEARTBEAT" />
      <trace from="U_ISO_MAIN.A_ESP_HEARTBEAT" to="J_ISO_APP_BOUNDARY.ESP_HEARTBEAT" />
      <trace from="U_ISO_MAIN.S_ESP_HEARTBEAT" to="U_STM32.ESP_HEARTBEAT" />
      <trace from="U_ISO_MAIN.S3_3" to="net.S3_3" />
      <trace from="U_ISO_MAIN.SGND" to="net.SGND" />
      <trace from="U_ISO_AUX.S3_3" to="net.S3_3" />
      <trace from="U_ISO_AUX.SGND" to="net.SGND" />
      <trace from="J_STM_SWD.S3_3" to="net.S3_3" />
      <trace from="J_STM_SWD.SGND" to="net.SGND" />
      <trace from="J_STM_SWD.NRST" to="U_STM32.NRST" />
      <trace from="J_STM_SWD.SWDIO" to="U_STM32.SWDIO" />
      <trace from="J_STM_SWD.SWCLK" to="U_STM32.SWCLK" />
      <trace from="U_STM32.LAMP_RED" to="U_PRIMARY_OUTPUT_DRIVER.LAMP_RED_IN" />
      <trace from="U_STM32.LAMP_GREEN" to="U_PRIMARY_OUTPUT_DRIVER.LAMP_GREEN_IN" />
      <trace from="U_STM32.LAMP_WHITE_L" to="U_PRIMARY_OUTPUT_DRIVER.LAMP_WHITE_L_IN" />
      <trace from="U_STM32.LAMP_WHITE_R" to="U_PRIMARY_OUTPUT_DRIVER.LAMP_WHITE_R_IN" />
      <trace from="U_STM32.BUZZER" to="U_PRIMARY_OUTPUT_DRIVER.BUZZER_IN" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.S3_3" to="net.S3_3" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.SGND" to="net.SGND" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.LAMP_RED_OUT" to="J_PRIMARY_OUTPUTS_HARNESS.LAMP_RED" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.LAMP_GREEN_OUT" to="J_PRIMARY_OUTPUTS_HARNESS.LAMP_GREEN" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.LAMP_WHITE_L_OUT" to="J_PRIMARY_OUTPUTS_HARNESS.LAMP_WHITE_L" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.LAMP_WHITE_R_OUT" to="J_PRIMARY_OUTPUTS_HARNESS.LAMP_WHITE_R" />
      <trace from="U_PRIMARY_OUTPUT_DRIVER.BUZZER_OUT" to="J_PRIMARY_OUTPUTS_HARNESS.BUZZER" />
      <trace from="J_PRIMARY_OUTPUTS_HARNESS.RETURN" to="net.SGND" />
    </board>
  )
}
