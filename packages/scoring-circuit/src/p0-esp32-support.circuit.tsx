import { Fragment, type ReactElement } from "react"
import { P0Esp32SupervisorFootprint, P0Esp32WatchdogFootprint } from "./p0-esp32-support-footprints.js"
import P0Esp32Wroom1Footprint from "./p0-esp32-wroom-1-footprint.js"

const assignedBoundarySignals = [
  "SAR_SCLK",
  "SAR_DOUT",
  "SAR_CONVST",
  "LAMP_RED",
  "LAMP_GREEN",
  "HUB75_R2",
  "LAMP_WHITE_LEFT",
  "APP_SPI_SCK",
  "APP_SPI_MOSI",
  "HUB75_CLK",
  "APP_SPI_MISO",
  "LAMP_WHITE_RIGHT",
  "BUZZER",
  "HUB75_R1",
  "HUB75_G1",
  "HUB75_B1",
  "SOURCE_LATCH",
  "SOURCE_OE_N",
  "HUB75_LAT",
  "HUB75_D",
  "IR_RX",
  "HUB75_G2",
  "HUB75_B2",
  "HUB75_A",
  "HUB75_B",
  "HUB75_C",
  "ETH_CS_N",
  "HUB75_OE_N"
] as const

const testPads = ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"] as const

export type P0Esp32SupportCircuitProps = {
  readonly pcbX: number
  readonly pcbY: number
}

/** P0 ESP32 support block. It records connectivity and review geometry, not fabrication authority. */
export function P0Esp32SupportCircuit({ pcbX, pcbY }: P0Esp32SupportCircuitProps): ReactElement {
  return (
    <group name="P0_ESP32_SUPPORT" pcbX={0} pcbY={0} pcbPositionMode="relative_to_board_anchor">
      <P0Esp32Wroom1Footprint pcbX={pcbX} pcbY={pcbY} />

      <capacitor
        name="C_ESP_3V3_HF"
        manufacturerPartNumber="GCM188R71H104KA57D"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX - 30}
        pcbY={pcbY - 22}
      />
      <capacitor
        name="C_ESP_3V3_BULK"
        manufacturerPartNumber="GCM32EC71A476KE02L"
        capacitance="47uF"
        footprint="1210"
        pcbX={pcbX - 24}
        pcbY={pcbY - 22}
      />
      <resistor
        name="R_ESP_BOOT_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX + 28}
        pcbY={pcbY - 22}
      />
      <resistor
        name="R_ESP_EN_PULLUP"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX + 34}
        pcbY={pcbY - 22}
      />
      <capacitor
        name="C_ESP_EN_DELAY"
        manufacturerPartNumber="C1608X5R1A105K080AC"
        capacitance="1uF"
        footprint="0603"
        pcbX={pcbX + 40}
        pcbY={pcbY - 22}
      />

      <P0Esp32SupervisorFootprint pcbX={pcbX - 45} pcbY={pcbY - 32} />
      <P0Esp32WatchdogFootprint pcbX={pcbX - 29} pcbY={pcbY - 32} />
      <resistor
        name="R_APP_WD_CWD"
        manufacturerPartNumber="RC0603FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX - 38}
        pcbY={pcbY - 32}
      />
      <resistor
        name="R_APP_WDI_PULLUP"
        manufacturerPartNumber="RC0603FR-07100KL"
        resistance="100k"
        tolerance="1%"
        footprint="0603"
        pcbX={pcbX - 31}
        pcbY={pcbY - 38}
      />
      <capacitor
        name="C_APP_SUPERVISOR_CT"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX - 24}
        pcbY={pcbY - 32}
      />
      <capacitor
        name="C_APP_SUPERVISOR_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX - 17}
        pcbY={pcbY - 32}
      />
      <capacitor
        name="C_APP_WD_BYPASS"
        manufacturerPartNumber="C0603C104K3RACTU"
        capacitance="100nF"
        footprint="0603"
        pcbX={pcbX - 10}
        pcbY={pcbY - 32}
      />

      {testPads.map((signal, index) => (
        <testpoint
          key={signal}
          name={signal === "APP_3V3" ? "TP_RECOVERY_APP_3V3" : `TP_${signal}`}
          footprintVariant="pad"
          padShape="circle"
          padDiameter="1mm"
          pcbX={pcbX - 45 + index * 5}
          pcbY={pcbY - 42}
        />
      ))}

      <trace from="U_APP.APP_3V3" to="net.APP_3V3" />
      <trace from="U_APP.APP_GND" to="net.APP_GND" />
      <trace from="U_APP.pin40" to="net.APP_GND" />
      <trace from="U_APP.pin41" to="net.APP_GND" />
      <trace from="U_APP.APP_3V3" to="C_ESP_3V3_HF.pin1" />
      <trace from="C_ESP_3V3_HF.pin2" to="net.APP_GND" />
      <trace from="U_APP.APP_3V3" to="C_ESP_3V3_BULK.pin1" />
      <trace from="C_ESP_3V3_BULK.pin2" to="net.APP_GND" />

      <trace from="U_APP.BOOT_N" to="R_ESP_BOOT_PULLUP.pin1" />
      <trace from="R_ESP_BOOT_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="U_APP.BOOT_N" to="TP_BOOT_N.pin1" />
      <trace from="U_APP.EN_RESET" to="R_ESP_EN_PULLUP.pin1" />
      <trace from="R_ESP_EN_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="U_APP.EN_RESET" to="C_ESP_EN_DELAY.pin1" />
      <trace from="C_ESP_EN_DELAY.pin2" to="net.APP_GND" />
      <trace from="U_APP.EN_RESET" to="net.APP_RESET_N" />
      <trace from="U_APP.EN_RESET" to="TP_EN_RESET.pin1" />

      <trace from="U_APP_SUPERVISOR.SENSE" to="net.APP_3V3" />
      <trace from="U_APP_SUPERVISOR.APP_3V3" to="net.APP_3V3" />
      <trace from="U_APP_SUPERVISOR.APP_GND" to="net.APP_GND" />
      <trace from="U_APP_SUPERVISOR.APP_RESET_N" to="net.APP_RESET_N" />
      <trace from="U_APP_SUPERVISOR.CT" to="C_APP_SUPERVISOR_CT.pin1" />
      <trace from="C_APP_SUPERVISOR_CT.pin2" to="net.APP_GND" />
      <trace from="U_APP_WATCHDOG.APP_3V3" to="net.APP_3V3" />
      <trace from="U_APP_WATCHDOG.pin4" to="net.APP_GND" />
      <trace from="U_APP_WATCHDOG.APP_RESET_N" to="net.APP_RESET_N" />
      <trace from="U_APP_WATCHDOG.CWD" to="R_APP_WD_CWD.pin1" />
      <trace from="R_APP_WD_CWD.pin2" to="net.APP_3V3" />
      <trace from="U_APP.APP_WD_KICK" to="U_APP_WATCHDOG.APP_WD_KICK" />
      <trace from="U_APP.APP_WD_KICK" to="R_APP_WDI_PULLUP.pin1" />
      <trace from="R_APP_WDI_PULLUP.pin2" to="net.APP_3V3" />
      <trace from="U_APP.APP_WD_KICK" to="net.APP_WD_KICK" />
      <trace from="C_APP_SUPERVISOR_BYPASS.pin1" to="net.APP_3V3" />
      <trace from="C_APP_SUPERVISOR_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_APP_WD_BYPASS.pin1" to="net.APP_3V3" />
      <trace from="C_APP_WD_BYPASS.pin2" to="net.APP_GND" />

      <trace from="U_APP.USB_DN" to="net.USB_DN" />
      <trace from="U_APP.USB_DP" to="net.USB_DP" />

      <trace from="U_APP.UART0_RX" to="TP_UART0_RX.pin1" />
      <trace from="U_APP.UART0_TX" to="TP_UART0_TX.pin1" />
      <trace from="TP_RECOVERY_APP_3V3.pin1" to="net.APP_3V3" />
      <trace from="TP_APP_GND.pin1" to="net.APP_GND" />

      {assignedBoundarySignals.map((signal) => (
        <Fragment key={signal}>
          <trace from={`U_APP.${signal}`} to={`net.${signal}`} />
        </Fragment>
      ))}
    </group>
  )
}
