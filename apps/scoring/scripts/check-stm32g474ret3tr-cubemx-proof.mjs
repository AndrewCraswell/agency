import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const scoringRoot = resolve(scriptDirectory, "..")
const cubeRoot = resolve(scoringRoot, "firmware/stm32/.cache/STM32CubeG4")
const packageManifest = resolve(cubeRoot, "package.xml")
const deviceHeader = resolve(cubeRoot, "Drivers/CMSIS/Device/ST/STM32G4xx/Include/stm32g474xx.h")
const gpioHeader = resolve(cubeRoot, "Drivers/STM32G4xx_HAL_Driver/Inc/stm32g4xx_hal_gpio_ex.h")
const dmaHeader = resolve(cubeRoot, "Drivers/STM32G4xx_HAL_Driver/Inc/stm32g4xx_hal_dma.h")
const cubeSpiExample = resolve(
  cubeRoot,
  "Projects/NUCLEO-G474RE/Examples/SPI/SPI_FullDuplex_ComDMA_Master/SPI_FullDuplex_ComDMA_Master.ioc"
)
const cubeTim3Example = resolve(cubeRoot, "Projects/NUCLEO-G474RE/Examples/TIM/TIM_Encoder/Src/stm32g4xx_hal_msp.c")
const cubeTim1Example = resolve(cubeRoot, "Projects/NUCLEO-G474RE/Examples/TIM/TIM_PWMOutput/Src/stm32g4xx_hal_msp.c")
const committedAllocation = resolve(scoringRoot, "../../packages/scoring-circuit/src/stm32-pin-allocation.ts")

const alternateFunctionAssignments = [
  { pad: "PA4", pin: 18, signal: "TIM3_CH2", allocationNet: "SAR0_CONVST_TIM3_CH2", macro: "GPIO_AF2_TIM3", af: 2 },
  { pad: "PA5", pin: 19, signal: "SPI1_SCK", allocationNet: "SAR0_SCLK_SPI1_SCK", macro: "GPIO_AF5_SPI1", af: 5 },
  { pad: "PA6", pin: 20, signal: "SPI1_MISO", allocationNet: "SAR0_DOUT_SPI1_MISO", macro: "GPIO_AF5_SPI1", af: 5 },
  {
    pad: "PA8",
    pin: 42,
    signal: "TIM1_CH1",
    allocationNet: "PRIMARY_LAMP_RED_TIM1_CH1",
    macro: "GPIO_AF6_TIM1",
    af: 6
  },
  {
    pad: "PA9",
    pin: 43,
    signal: "TIM1_CH2",
    allocationNet: "PRIMARY_LAMP_GREEN_TIM1_CH2",
    macro: "GPIO_AF6_TIM1",
    af: 6
  },
  {
    pad: "PA10",
    pin: 44,
    signal: "TIM1_CH3",
    allocationNet: "PRIMARY_LAMP_LEFT_WHITE_TIM1_CH3",
    macro: "GPIO_AF6_TIM1",
    af: 6
  },
  {
    pad: "PA11",
    pin: 45,
    signal: "TIM1_CH4",
    allocationNet: "PRIMARY_LAMP_RIGHT_WHITE_TIM1_CH4",
    macro: "GPIO_AF6_TIM1",
    af: 6
  },
  {
    pad: "PA12",
    pin: 46,
    signal: "TIM16_CH1",
    allocationNet: "PRIMARY_BUZZER_TIM16_CH1",
    macro: "GPIO_AF1_TIM16",
    af: 1
  },
  { pad: "PA13", pin: 49, signal: "SWDIO", allocationNet: "SWDIO", macro: "GPIO_AF0_SWJ", af: 0 },
  { pad: "PA14", pin: 50, signal: "SWCLK", allocationNet: "SWCLK", macro: "GPIO_AF0_SWJ", af: 0 },
  { pad: "PA15", pin: 51, signal: "SPI3_NSS", allocationNet: "SCORE_CS_N_SPI3_NSS", macro: "GPIO_AF6_SPI3", af: 6 },
  { pad: "PC10", pin: 52, signal: "SPI3_SCK", allocationNet: "SCORE_SCK_SPI3_SCK", macro: "GPIO_AF6_SPI3", af: 6 },
  { pad: "PC11", pin: 53, signal: "SPI3_MISO", allocationNet: "SCORE_MISO_SPI3_MISO", macro: "GPIO_AF6_SPI3", af: 6 },
  { pad: "PC12", pin: 54, signal: "SPI3_MOSI", allocationNet: "SCORE_MOSI_SPI3_MOSI", macro: "GPIO_AF6_SPI3", af: 6 }
]

const gpioAssignments = {
  PC0: "LEFT_A_SOURCE_EN",
  PC1: "LEFT_A_SINK_EN",
  PC2: "LEFT_B_SOURCE_EN",
  PC3: "LEFT_B_SINK_EN",
  PB0: "LEFT_C_SOURCE_EN",
  PB1: "LEFT_C_SINK_EN",
  PB2: "RIGHT_A_SOURCE_EN",
  PB10: "RIGHT_A_SINK_EN",
  PB11: "RIGHT_B_SOURCE_EN",
  PB12: "RIGHT_B_SINK_EN",
  PB13: "RIGHT_C_SOURCE_EN",
  PB14: "RIGHT_C_SINK_EN",
  PB15: "PISTE_SOURCE_EN",
  PC6: "PISTE_SINK_EN",
  PC9: "SCORING_WATCHDOG_WDI",
  PB3: "STM32_HEARTBEAT_ISOLATED",
  PB4: "ESP32_HEARTBEAT_ISOLATED",
  PB5: "ESP32_RESET_ASSERT_ISOLATED"
}

const dmaRequests = [
  ["DMA_REQUEST_SPI1_RX", 10],
  ["DMA_REQUEST_SPI3_RX", 14],
  ["DMA_REQUEST_TIM1_CH1", 42],
  ["DMA_REQUEST_TIM1_CH2", 43],
  ["DMA_REQUEST_TIM1_CH3", 44],
  ["DMA_REQUEST_TIM1_CH4", 45],
  ["DMA_REQUEST_TIM3_CH2", 62],
  ["DMA_REQUEST_TIM16_CH1", 82]
]

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function requireMatch(source, expression, message) {
  if (!expression.test(source)) throw new Error(message)
}

function requireDistinct(values, message) {
  if (new Set(values).size !== values.length) throw new Error(message)
}

function readAfMacro(source, macro) {
  const expression = new RegExp(
    `^#define\\s+${escapeRegularExpression(macro)}\\s+\\(\\(uint8_t\\)0x([0-9A-Fa-f]+)\\)`,
    "m"
  )
  const match = source.match(expression)
  if (match === null) throw new Error(`STM32CubeG4 HAL header does not define ${macro}`)
  return Number.parseInt(match[1], 16)
}

function readDmaRequest(source, macro) {
  const expression = new RegExp(`^#define\\s+${escapeRegularExpression(macro)}\\s+(\\d+)U`, "m")
  const match = source.match(expression)
  if (match === null) throw new Error(`STM32CubeG4 HAL header does not define ${macro}`)
  return Number.parseInt(match[1], 10)
}

function readCommittedAllocation(source) {
  const entries = []
  for (const match of source.matchAll(/^\s*\[(\d+), "([A-Z0-9+_-]+)", "([A-Z0-9_]+)"\],?$/gm)) {
    entries.push([match[2], { pin: Number.parseInt(match[1], 10), net: match[3] }])
  }
  if (entries.length !== 64) throw new Error("Cannot read exactly 64 committed LQFP64 pads")
  return new Map(entries)
}

async function main() {
  const [
    packageXml,
    cmsisHeader,
    halGpioHeader,
    halDmaHeader,
    cubeExample,
    tim3Example,
    tim1Example,
    allocationSource
  ] = await Promise.all([
    readFile(packageManifest, "utf8"),
    readFile(deviceHeader, "utf8"),
    readFile(gpioHeader, "utf8"),
    readFile(dmaHeader, "utf8"),
    readFile(cubeSpiExample, "utf8"),
    readFile(cubeTim3Example, "utf8"),
    readFile(cubeTim1Example, "utf8"),
    readFile(committedAllocation, "utf8")
  ])
  const allocation = readCommittedAllocation(allocationSource)

  requireMatch(
    packageXml,
    /Release="FW\.G4\.1\.6\.0" Patch="FW\.G4\.1\.6\.3"/,
    "Unexpected STM32CubeG4 package release"
  )
  requireMatch(cubeExample, /^Mcu\.CPN=STM32G474RET3$/m, "CubeMX sample is not the committed STM32G474RET3")
  requireMatch(cubeExample, /^Mcu\.Package=LQFP64$/m, "CubeMX sample is not LQFP64")
  requireMatch(cubeExample, /^MxCube\.Version=6\.10\.0$/m, "CubeMX sample version drifted")
  requireMatch(cubeExample, /^MxDb\.Version=DB\.6\.0\.100$/m, "CubeMX database version drifted")
  requireMatch(
    cubeExample,
    /^Dma\.SPI1_RX\.1\.Instance=DMA1_Channel2$/m,
    "CubeMX sample no longer proves SPI1 RX DMAMUX routing"
  )
  requireMatch(
    cubeExample,
    /^Dma\.SPI1_RX\.1\.Direction=DMA_PERIPH_TO_MEMORY$/m,
    "CubeMX sample no longer proves SPI1 RX direction"
  )
  requireMatch(
    tim3Example,
    /PA4\s+------> TIM3_CH2[\s\S]{0,600}GPIO_AF2_TIM3/,
    "CubeG4 TIM3 example no longer proves PA4 TIM3 CH2 AF2"
  )
  requireMatch(
    tim1Example,
    /PA8\s+------> TIM1_CH1[\s\S]{0,600}PA11\s+------> TIM1_CH4[\s\S]{0,600}GPIO_AF6_TIM1/,
    "CubeG4 TIM1 example no longer proves PA8 through PA11 TIM1 AF6"
  )

  for (const marker of [
    "#define SPI1_BASE",
    "#define SPI3_BASE",
    "#define TIM1_BASE",
    "#define TIM3_BASE",
    "#define TIM16_BASE",
    "#define ADC1_BASE",
    "#define ADC5_BASE",
    "#define COMP1_BASE",
    "#define COMP7_BASE",
    "#define DMA1_Channel8_BASE",
    "#define DMA2_Channel8_BASE",
    "#define DMAMUX1_Channel9_BASE"
  ]) {
    requireMatch(
      cmsisHeader,
      new RegExp(`^${escapeRegularExpression(marker)}`, "m"),
      `CMSIS device header lacks ${marker}`
    )
  }

  requireDistinct(
    alternateFunctionAssignments.map(({ pad }) => pad),
    "An STM32 pad is assigned more than one alternate function"
  )
  requireDistinct(
    alternateFunctionAssignments.map(({ pin }) => pin),
    "An LQFP64 pin is assigned more than one alternate function"
  )
  requireDistinct(
    alternateFunctionAssignments.map(({ signal }) => signal),
    "A peripheral signal is assigned to more than one pad"
  )
  requireDistinct(Object.keys(gpioAssignments), "A plain GPIO pad is assigned more than once")
  requireDistinct(Object.values(gpioAssignments), "A plain GPIO net is assigned more than once")

  const alternatePads = new Set(alternateFunctionAssignments.map(({ pad }) => pad))
  for (const pad of Object.keys(gpioAssignments)) {
    if (alternatePads.has(pad)) throw new Error(`GPIO ${pad} conflicts with an alternate-function assignment`)
  }

  for (const assignment of alternateFunctionAssignments) {
    const committed = allocation.get(assignment.pad)
    if (committed?.pin !== assignment.pin || committed.net !== assignment.allocationNet) {
      throw new Error(`${assignment.pad} no longer matches the committed ${assignment.allocationNet} allocation`)
    }
    if (readAfMacro(halGpioHeader, assignment.macro) !== assignment.af) {
      throw new Error(`${assignment.signal} no longer matches ${assignment.macro} AF${assignment.af}`)
    }
  }
  for (const [pad, net] of Object.entries(gpioAssignments)) {
    if (allocation.get(pad)?.net !== net)
      throw new Error(`${pad} no longer matches the committed ${net} GPIO allocation`)
  }

  const observedDmaRequests = dmaRequests.map(([macro]) => [macro, readDmaRequest(halDmaHeader, macro)])
  for (const [index, [, expected]] of dmaRequests.entries()) {
    if (observedDmaRequests[index][1] !== expected) throw new Error(`Unexpected DMAMUX request at index ${index}`)
  }
  requireDistinct(
    observedDmaRequests.map(([, value]) => value),
    "The candidate peripheral requests share a DMAMUX request number"
  )

  const report = {
    workUnit: "M0-08",
    status: "partial-fail-closed",
    device: "STM32G474RET3",
    package: "LQFP64",
    cubeProvenance: {
      package: "STM32CubeG4 FW.G4.1.6.0 Patch FW.G4.1.6.3",
      sample: "NUCLEO-G474RE SPI_FullDuplex_ComDMA_Master",
      cubeVersion: "6.10.0",
      databaseVersion: "DB.6.0.100"
    },
    alternateFunctionAssignments,
    dma: {
      controller: "DMAMUX1",
      validatedRequestIds: Object.fromEntries(observedDmaRequests),
      channelAllocation: "none: M0-08 does not claim DMA-channel ownership before generated CubeMX evidence"
    },
    analog: {
      adc: "none allocated to BP-100 conductors",
      comparators: "none allocated to BP-100 conductors"
    },
    closure: {
      generatedCubeMxProject: false,
      reason:
        "STM32CubeMX and its pin database are not installed; the checked STM32CubeG4 package contains samples but no generated project for this allocation."
    }
  }
  console.log(JSON.stringify(report, null, 2))

  if (process.argv.includes("--require-closure")) {
    throw new Error(
      "M0-08 remains blocked until STM32CubeMX imports the candidate .ioc and generates an exact STM32G474RET3 LQFP64 project"
    )
  }
}

await main()
