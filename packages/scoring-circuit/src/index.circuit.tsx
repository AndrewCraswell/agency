const connectorPinLabels = ["A", "B", "C"]
const stm32PinLabels = [
  "V3_3",
  "GND",
  "LEFT_A",
  "LEFT_B",
  "LEFT_C",
  "RIGHT_A",
  "RIGHT_B",
  "RIGHT_C",
  "PISTE",
  "SPI_SCK",
  "SPI_MOSI",
  "SPI_MISO",
  "SPI_CS",
  "EVENT_IRQ",
  "HEARTBEAT",
  "ESP_RESET"
]
const esp32PinLabels = [
  "V3_3",
  "GND",
  "SPI_SCK",
  "SPI_MOSI",
  "SPI_MISO",
  "SPI_CS",
  "SCORING_IRQ",
  "STM32_HEARTBEAT",
  "STM32_RESET"
]

type FrontEndProps = {
  connectorX: number
  prefix: "L" | "R"
  signalX: number
}

function EpeeFrontEnd({ connectorX, prefix, signalX }: FrontEndProps) {
  const connectorName = `J_${prefix}`

  return (
    <group>
      <pinheader
        name={connectorName}
        pinCount={3}
        pinLabels={connectorPinLabels}
        gender="female"
        pitch="2.54mm"
        pcbX={connectorX}
        pcbY={16}
        pcbRotation={90}
        showSilkscreenPinLabels
      />
      {(["A", "B", "C"] as const).map((line, index) => {
        const y = 11 - index * 7
        const resistorName = `R_${prefix}_${line}_SERIES`
        const pullName = `R_${prefix}_${line}_PULL`
        const capacitorName = `C_${prefix}_${line}_FILTER`
        const signalNet = `${prefix}_${line}`

        return (
          <group key={line}>
            <resistor name={resistorName} resistance="4.7k" footprint="0603" pcbX={signalX} pcbY={y} />
            <resistor name={pullName} resistance="100k" footprint="0603" pcbX={signalX + 8} pcbY={y + 2} />
            <capacitor name={capacitorName} capacitance="1nF" footprint="0603" pcbX={signalX + 8} pcbY={y - 2} />
            <trace from={`${connectorName}.${line}`} to={`${resistorName}.pin1`} />
            <trace from={`${resistorName}.pin2`} to={`net.${signalNet}`} />
            <trace from={`${pullName}.pin1`} to={`net.${signalNet}`} />
            <trace from={`${pullName}.pin2`} to="net.GND" />
            <trace from={`${capacitorName}.pin1`} to={`net.${signalNet}`} />
            <trace from={`${capacitorName}.pin2`} to="net.GND" />
          </group>
        )
      })}
    </group>
  )
}

function ScoringCircuit() {
  return (
    <board title="STM32 dual épée scoring prototype" width="88mm" height="66mm" layers={2}>
      <EpeeFrontEnd prefix="L" connectorX={-36} signalX={-27} />
      <EpeeFrontEnd prefix="R" connectorX={36} signalX={19} />

      <pinheader
        name="J_PISTE"
        pinCount={1}
        pinLabels={["PISTE"]}
        gender="female"
        pcbX={0}
        pcbY={27}
        showSilkscreenPinLabels
      />

      <pinheader
        name="J_STM32"
        pinCount={16}
        pinLabels={stm32PinLabels}
        gender="female"
        pitch="2.54mm"
        pcbX={-14}
        pcbY={-26}
        showSilkscreenPinLabels
      />

      <pinheader
        name="J_ESP32"
        pinCount={9}
        pinLabels={esp32PinLabels}
        gender="female"
        pitch="2.54mm"
        pcbX={24}
        pcbY={-26}
        showSilkscreenPinLabels
      />

      <trace from="J_STM32.GND" to="net.GND" />
      <trace from="J_ESP32.GND" to="net.GND" />
      <trace from="J_STM32.V3_3" to="J_ESP32.V3_3" />
      <trace from="J_STM32.LEFT_A" to="net.L_A" />
      <trace from="J_STM32.LEFT_B" to="net.L_B" />
      <trace from="J_STM32.LEFT_C" to="net.L_C" />
      <trace from="J_STM32.RIGHT_A" to="net.R_A" />
      <trace from="J_STM32.RIGHT_B" to="net.R_B" />
      <trace from="J_STM32.RIGHT_C" to="net.R_C" />
      <trace from="J_STM32.PISTE" to="J_PISTE.PISTE" />
      <trace from="J_STM32.SPI_SCK" to="J_ESP32.SPI_SCK" />
      <trace from="J_STM32.SPI_MOSI" to="J_ESP32.SPI_MOSI" />
      <trace from="J_STM32.SPI_MISO" to="J_ESP32.SPI_MISO" />
      <trace from="J_STM32.SPI_CS" to="J_ESP32.SPI_CS" />
      <trace from="J_STM32.EVENT_IRQ" to="J_ESP32.SCORING_IRQ" />
      <trace from="J_STM32.HEARTBEAT" to="J_ESP32.STM32_HEARTBEAT" />
      <trace from="J_STM32.ESP_RESET" to="J_ESP32.STM32_RESET" />

      <capacitor name="C_POWER" capacitance="100nF" footprint="0603" pcbX={-4} pcbY={-19} />
      <trace from="C_POWER.pin1" to="J_STM32.V3_3" />
      <trace from="C_POWER.pin2" to="net.GND" />

      <hole name="H1" diameter="3.2mm" pcbX={-40} pcbY={-29} />
      <hole name="H2" diameter="3.2mm" pcbX={40} pcbY={-29} />
      <hole name="H3" diameter="3.2mm" pcbX={-40} pcbY={29} />
      <hole name="H4" diameter="3.2mm" pcbX={40} pcbY={29} />
    </board>
  )
}

export default ScoringCircuit
