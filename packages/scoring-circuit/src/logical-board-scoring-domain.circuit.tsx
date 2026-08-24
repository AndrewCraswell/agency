import { weaponInputTopology, WeaponInputTraces } from "./weapon-input-topology.js"

const weaponConnectorPins = { pin1: "A", pin2: "B", pin3: "C" } as const
const weaponConnectorEndpointLabels = { a: "A", b: "B", c: "C" } as const

function WeaponInput({ side, x }: { side: "L" | "R"; x: number }) {
  const topology = weaponInputTopology({
    connectorReference: `J_${side}`,
    connectorEndpointLabels: weaponConnectorEndpointLabels
  })
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
        name={topology.esd.name}
        manufacturerPartNumber={topology.esd.manufacturerPartNumber}
        doNotPlace
        pinLabels={topology.esd.pinLabels}
        pcbX={0}
        pcbY={-6}
      />
      <chip
        name={topology.frontend.name}
        manufacturerPartNumber={topology.frontend.manufacturerPartNumber}
        doNotPlace
        footprint={[]}
        pinLabels={topology.frontend.pinLabels}
        pcbX={0}
        pcbY={-13}
      />
      <WeaponInputTraces topology={topology} />
    </group>
  )
}

/** Scoring-side weapon inputs, piste protection, controller, and isolated scoring supply. */
export function LogicalBoardScoringDomain() {
  return (
    <>
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
    </>
  )
}
