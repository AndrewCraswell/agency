import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

interface MeasurementLimit {
  readonly absolute?: boolean
  readonly maximum?: number
  readonly minimum?: number
  readonly name: string
  readonly unit: string
}

interface SimulationCase {
  readonly file: string
  readonly limits: readonly MeasurementLimit[]
  readonly title: string
}

const packageDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)))
const simulationDirectory = join(packageDirectory, "simulation")

const simulations: readonly SimulationCase[] = [
  {
    title: "New STM32 platform: continuity and reset-bias characterization (not complete weapon validation)",
    file: "stm32-sensing-interface.cir",
    limits: [
      { name: "open_input", maximum: 0.556, unit: "V" },
      { name: "weak_contact", minimum: 0.651, unit: "V" },
      { name: "weak_driver_current", absolute: true, maximum: 0.012, unit: "A" },
      { name: "nominal_zero", minimum: 0.651, unit: "V" },
      { name: "nominal_100", minimum: 0.651, unit: "V" },
      { name: "nominal_500", minimum: 0.651, unit: "V" },
      { name: "opposed_current", absolute: true, maximum: 0.012, unit: "A" },
      { name: "reset_disabled", minimum: 2, unit: "V" },
      { name: "reset_drive_low", maximum: 0.8, unit: "V" },
      { name: "active_clear_low", maximum: 0.556, unit: "V" },
      { name: "active_clear_delay", maximum: 20e-6, unit: "s" },
      // A characterization sanity bound, NOT an allowable scoring pulse extension.
      { name: "passive_release_tail", minimum: 50e-6, maximum: 100e-6, unit: "s" }
    ]
  },
  {
    title: "ESP32 scoring-conductor interface",
    file: "scoring-conductor-interface.cir",
    limits: [
      { name: "sense33_high", minimum: 2.475, unit: "V" },
      { name: "sense33_low", maximum: 0.825, unit: "V" },
      { name: "sense470_high", minimum: 2.475, unit: "V" },
      { name: "sense470_low", maximum: 0.825, unit: "V" },
      { name: "sense33_rise", maximum: 2e-6, unit: "s" },
      { name: "sense470_rise", maximum: 2e-6, unit: "s" },
      { name: "opposed_gpio_current", absolute: true, maximum: 0.028, unit: "A" },
      { name: "fie_500ohm_continuity_high", minimum: 2.475, unit: "V" },
      { name: "fie_100ohm_earth_high", minimum: 2.475, unit: "V" },
      { name: "fie_zero_ohm_fault_current", absolute: true, maximum: 0.028, unit: "A" },
      { name: "fie_450ohm_fault_current", absolute: true, maximum: 0.028, unit: "A" },
      { name: "fie_475ohm_fault_current", absolute: true, maximum: 0.028, unit: "A" }
    ]
  },
  {
    title: "Combined 5 V and HUB75 load",
    file: "display-power-load.cir",
    limits: [
      { name: "board_voltage_min", minimum: 4.75, unit: "V" },
      { name: "panel_voltage_min", minimum: 4.5, unit: "V" },
      { name: "regulator_current_peak", absolute: true, maximum: 5.5, unit: "A" }
    ]
  },
  {
    title: "Infrared receiver supply filter",
    file: "infrared-receiver-supply.cir",
    limits: [
      { name: "receiver_voltage_min", minimum: 2.7, unit: "V" },
      { name: "receiver_voltage_max", maximum: 3.6, unit: "V" }
    ]
  },
  {
    title: "Scoring sounder driver",
    file: "scoring-sounder-driver.cir",
    limits: [
      { name: "sounder_switch_on_max", maximum: 0.3, unit: "V" },
      { name: "sounder_gate_off_max", maximum: 0.3, unit: "V" },
      { name: "gpio_drive_current_peak", absolute: true, maximum: 0.004, unit: "A" }
    ]
  },
  {
    title: "FA-05 DATA-LINE transmitter",
    file: "favero-data-line-transmitter.cir",
    limits: [
      { name: "opto_led_current", absolute: true, minimum: 0.01, maximum: 0.02, unit: "A" },
      { name: "loop_current_on", absolute: true, minimum: 0.018, maximum: 0.03, unit: "A" },
      { name: "loop_voltage_on", maximum: 10, unit: "V" },
      { name: "loop_voltage_off", minimum: 12, unit: "V" },
      { name: "loop_release_time", maximum: 208.33e-6, unit: "s" }
    ]
  }
] as const

function executableCandidates(): readonly string[] {
  const configured = process.env.NGSPICE_BIN
  return [
    ...(configured ? [configured] : []),
    join(homedir(), ".local", "ngspice-47", "Spice64", "bin", "ngspice_con.exe"),
    "ngspice_con",
    "ngspice"
  ]
}

function findNgspice(): string {
  for (const candidate of executableCandidates()) {
    if (candidate.includes("\\") && !existsSync(candidate)) continue
    const result = spawnSync(candidate, ["-v"], { encoding: "utf8", windowsHide: true })
    if (!result.error && result.status === 0) return candidate
  }
  throw new Error("ngspice was not found. Install ngspice 47 or set NGSPICE_BIN to its console executable.")
}

function parseMeasurements(log: string): ReadonlyMap<string, number> {
  const measurements = new Map<string, number>()
  const expression = /^\s*([a-z][a-z0-9_]*)\s*=\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gim
  for (const match of log.matchAll(expression)) measurements.set(match[1], Number(match[2]))
  return measurements
}

function formatValue(value: number, unit: string): string {
  if (Math.abs(value) < 0.001 && value !== 0) return `${(value * 1e6).toFixed(2)} u${unit}`
  return `${value.toFixed(4)} ${unit}`
}

function run(): void {
  const executable = findNgspice()
  const outputDirectory = mkdtempSync(join(tmpdir(), "scoring-circuit-ngspice-"))
  let failedLimits = 0

  try {
    console.log(`ngspice: ${executable}`)
    for (const simulation of simulations) {
      const netlist = join(simulationDirectory, simulation.file)
      const logFile = join(outputDirectory, `${basename(simulation.file, ".cir")}.log`)
      const result = spawnSync(executable, ["-b", "-o", logFile, netlist], {
        cwd: simulationDirectory,
        encoding: "utf8",
        windowsHide: true
      })
      const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : `${result.stdout}\n${result.stderr}`
      if (result.error || result.status !== 0) {
        throw new Error(`${simulation.title} could not be simulated.\n${log.trim()}`)
      }

      const measurements = parseMeasurements(log)
      console.log(`\n${simulation.title}`)
      for (const limit of simulation.limits) {
        const measured = measurements.get(limit.name)
        if (measured === undefined || !Number.isFinite(measured)) {
          failedLimits += 1
          console.error(`  FAIL ${limit.name}: measurement missing`)
          continue
        }
        const compared = limit.absolute ? Math.abs(measured) : measured
        const passedMinimum = limit.minimum === undefined || compared >= limit.minimum
        const passedMaximum = limit.maximum === undefined || compared <= limit.maximum
        const status = passedMinimum && passedMaximum ? "PASS" : "FAIL"
        if (status === "FAIL") failedLimits += 1
        const range = [
          limit.minimum === undefined ? undefined : `>= ${formatValue(limit.minimum, limit.unit)}`,
          limit.maximum === undefined ? undefined : `<= ${formatValue(limit.maximum, limit.unit)}`
        ]
          .filter(Boolean)
          .join(" and ")
        console.log(`  ${status} ${limit.name}: ${formatValue(compared, limit.unit)} (${range})`)
      }
    }
  } finally {
    rmSync(outputDirectory, { force: true, recursive: true })
  }

  if (failedLimits > 0)
    throw new Error(`${failedLimits} electrical simulation limit${failedLimits === 1 ? "" : "s"} failed.`)
  console.log(`\nElectrical simulations passed: ${simulations.length} models.`)
}

run()
