import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

const executableCandidates = [
  process.env.NGSPICE_BIN,
  join(process.env.LOCALAPPDATA ?? "", "Programs", "ngspice-47", "Spice64", "bin", "ngspice_con.exe"),
  "ngspice_con.exe",
  "ngspice"
].filter(Boolean)
const executable = executableCandidates.find((candidate) => (candidate.includes("\\") ? existsSync(candidate) : true))

if (!executable) {
  throw new Error("ngspice was not found. Set NGSPICE_BIN to the console executable.")
}

const template = await readFile("spice/line-sense.cir", "utf8")
const outputDirectory = "dist/analog-sim"
await mkdir(outputDirectory, { recursive: true })

const resistanceBoundariesOhms = [
  0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500
]
const nominalComponents = {
  adcCapacitancePf: 470,
  adcSeriesOhms: 1_000,
  protectionOhms: 22,
  sourceOhms: 2_490,
  switchOhms: 2
}

const boundaryCases = resistanceBoundariesOhms.map((loadOhms) => ({
  ...nominalComponents,
  budgetUs: loadOhms <= 100 ? 10 : 50,
  capacitance: "500p",
  capacitancePf: 500,
  contactWidthUs: 100,
  family: "resistance-boundary",
  id: `resistance-${loadOhms}-ohm`,
  loadOhms
}))
const capacitanceCases = [2_000, 5_000, 10_000].flatMap((capacitancePf) =>
  [100, 500].map((loadOhms) => ({
    ...nominalComponents,
    budgetUs: loadOhms <= 100 ? 10 : 50,
    capacitance: `${capacitancePf}p`,
    capacitancePf,
    contactWidthUs: 100,
    family: "line-capacitance",
    id: `capacitance-${capacitancePf}-pf-${loadOhms}-ohm`,
    loadOhms
  }))
)
const pulseCases = [50, 1_000, 2_000, 10_000, 14_000].map((contactWidthUs) => ({
  ...nominalComponents,
  budgetUs: 10,
  capacitance: "10n",
  capacitancePf: 10_000,
  contactWidthUs,
  family: "pulse-width",
  id: `pulse-${contactWidthUs}-us`,
  loadOhms: 100
}))
const resistanceCornerCases = [100, 250, 450, 475, 500].map((loadOhms) => ({
  adcCapacitancePf: 494,
  adcSeriesOhms: 1_010,
  budgetUs: loadOhms <= 100 ? 10 : 50,
  capacitance: "10n",
  capacitancePf: 10_000,
  contactWidthUs: 100,
  family: "slow-resistance-corner-proxy",
  id: `slow-corner-${loadOhms}-ohm`,
  loadOhms,
  protectionOhms: 23.1,
  sourceOhms: 2_491.25,
  switchOhms: 4
}))
const cases = [...boundaryCases, ...capacitanceCases, ...pulseCases, ...resistanceCornerCases]

const results = []
for (const [index, simulationCase] of cases.entries()) {
  const contactWidthUs = simulationCase.contactWidthUs
  const stopTimeUs = Math.max(140, 20 + contactWidthUs)
  const simulatedLoadOhms = Math.max(simulationCase.loadOhms, 0.001)
  const replacements = {
    ADC_CAPACITANCE: `${simulationCase.adcCapacitancePf}p`,
    ADC_SERIES_OHMS: String(simulationCase.adcSeriesOhms),
    CONTACT_SAMPLE_TIME: `${10 + Math.min(contactWidthUs * 0.8, 70)}u`,
    CONTACT_PERIOD: `${stopTimeUs + 100}u`,
    CONTACT_WIDTH: `${contactWidthUs}u`,
    LINE_CAPACITANCE: simulationCase.capacitance,
    LOAD_OHMS: String(simulatedLoadOhms),
    PROTECTION_OHMS: String(simulationCase.protectionOhms),
    SOURCE_OHMS: String(simulationCase.sourceOhms),
    STOP_TIME: `${stopTimeUs}u`,
    SWITCH_OHMS: String(simulationCase.switchOhms)
  }
  const netlist = Object.entries(replacements).reduce(
    (source, [name, value]) => source.replaceAll(`{{${name}}}`, value),
    template
  )
  const netlistPath = join(outputDirectory, `case-${index + 1}.cir`)
  const logPath = join(outputDirectory, `case-${index + 1}.log`)
  await writeFile(netlistPath, netlist)
  execFileSync(executable, ["-b", "-o", logPath, netlistPath], { stdio: "ignore" })
  const log = await readFile(logPath, "utf8")
  const crossingSeconds = Number(/t_cross\s*=\s*([\d.e+-]+)/i.exec(log)?.[1])
  const contactVoltage = Number(/v_contact\s*=\s*([\d.e+-]+)/i.exec(log)?.[1])
  const responseUs = crossingSeconds * 1_000_000 - 10
  const expectedContactVoltage =
    (2.5 * simulatedLoadOhms) /
    (simulationCase.sourceOhms + simulationCase.switchOhms + simulationCase.protectionOhms + simulatedLoadOhms)
  const steadyStateErrorMv = Math.abs(contactVoltage - expectedContactVoltage) * 1_000

  if (!Number.isFinite(responseUs) || !Number.isFinite(contactVoltage)) {
    throw new Error(`ngspice did not return measurements for case ${index + 1}`)
  }

  results.push({
    budgetUs: simulationCase.budgetUs,
    capacitancePf: simulationCase.capacitancePf,
    contactVoltage,
    contactWidthUs,
    expectedContactVoltage,
    family: simulationCase.family,
    id: simulationCase.id,
    loadOhms: simulationCase.loadOhms,
    responseUs,
    steadyStateErrorMv
  })
}

const acceptance = {
  maximumSteadyStateErrorMv: 2,
  passed: results.every(
    (result) => result.responseUs >= 0 && result.responseUs <= result.budgetUs && result.steadyStateErrorMv <= 2
  )
}
const coverage = {
  capacitancePf: [...new Set(results.map((result) => result.capacitancePf))].sort((left, right) => left - right),
  caseCount: results.length,
  families: [...new Set(results.map((result) => result.family))],
  loadOhms: [...new Set(results.map((result) => result.loadOhms))].sort((left, right) => left - right),
  pulseWidthUs: [...new Set(results.map((result) => result.contactWidthUs))].sort((left, right) => left - right)
}
await writeFile(
  join(outputDirectory, "summary.json"),
  `${JSON.stringify(
    {
      acceptance,
      coverage,
      modelLimitations: [
        "The switch and protection devices use resistance-corner proxies rather than vendor temperature and charge-injection models",
        "The model does not include PCB parasitics, cable coupling, ADC sampling kickback, ESD clamps, or MCU rail injection",
        "Long pulse cases prove settling only; rule qualification and lockout remain digital scoring-core tests"
      ],
      results
    },
    null,
    2
  )}\n`
)

if (!acceptance.passed) {
  throw new Error("The analog transient model exceeded its response-time budget")
}

console.log(JSON.stringify({ acceptance, coverage }, null, 2))
