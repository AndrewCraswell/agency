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

const cases = [
  { budgetUs: 10, capacitance: "500p", capacitancePf: 500, contactWidth: "50u", loadOhms: 100 },
  { budgetUs: 10, capacitance: "2n", capacitancePf: 2_000, contactWidth: "100u", loadOhms: 100 },
  { budgetUs: 10, capacitance: "10n", capacitancePf: 10_000, contactWidth: "100u", loadOhms: 100 },
  { budgetUs: 50, capacitance: "5n", capacitancePf: 5_000, contactWidth: "100u", loadOhms: 500 },
  { budgetUs: 50, capacitance: "10n", capacitancePf: 10_000, contactWidth: "100u", loadOhms: 500 }
]

const results = []
for (const [index, simulationCase] of cases.entries()) {
  const contactWidthUs = Number.parseFloat(simulationCase.contactWidth)
  const replacements = {
    ADC_CAPACITANCE: "470p",
    ADC_SERIES_OHMS: "1000",
    CONTACT_SAMPLE_TIME: `${10 + Math.min(contactWidthUs * 0.8, 70)}u`,
    CONTACT_WIDTH: simulationCase.contactWidth,
    LINE_CAPACITANCE: simulationCase.capacitance,
    LOAD_OHMS: String(simulationCase.loadOhms),
    PROTECTION_OHMS: "22",
    SOURCE_OHMS: "2490",
    STOP_TIME: `${Math.max(140, 20 + contactWidthUs)}u`,
    SWITCH_OHMS: "2"
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

  if (!Number.isFinite(responseUs) || !Number.isFinite(contactVoltage)) {
    throw new Error(`ngspice did not return measurements for case ${index + 1}`)
  }

  results.push({ ...simulationCase, contactVoltage, responseUs })
}

const acceptance = {
  passed: results.every((result) => result.responseUs >= 0 && result.responseUs <= result.budgetUs)
}
await writeFile(join(outputDirectory, "summary.json"), `${JSON.stringify({ acceptance, results }, null, 2)}\n`)

if (!acceptance.passed) {
  throw new Error("The analog transient model exceeded its response-time budget")
}

console.log(JSON.stringify({ acceptance, results }, null, 2))
