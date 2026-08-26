import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const templatePath = join(packageDirectory, "spice", "reference-drive.cir")
const defaultOutputDirectory = join(packageDirectory, "dist", "reference-drive-sim")

const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const rounded = (value) => Number(value.toPrecision(12))

const corners = [
  {
    adcCapUf: 9,
    adcCapEsrOhms: 0.08,
    id: "cold-bounded",
    refOutputOhms: 0.075,
    refRegCapUf: 9,
    refRegEsrOhms: 0.1,
    temperatureC: -40
  },
  {
    adcCapUf: 10,
    adcCapEsrOhms: 0.05,
    id: "ambient-nominal",
    refOutputOhms: 0.05,
    refRegCapUf: 10,
    refRegEsrOhms: 0.05,
    temperatureC: 25
  },
  {
    adcCapUf: 8,
    adcCapEsrOhms: 0.1,
    id: "hot-bounded",
    refOutputOhms: 0.1,
    refRegCapUf: 8,
    refRegEsrOhms: 0.1,
    temperatureC: 125
  }
]

const scenarios = [
  {
    adcLoadSource: "PULSE(0 0.1 100u 1n 1n 1u 10m)",
    family: "single-conversion",
    measurements: [
      ".measure tran v_adc_pre FIND v(adcref) AT=90u",
      ".measure tran v_adc_min MIN v(adcref) FROM=99u TO=130u",
      ".measure tran v_refout_min MIN v(refout) FROM=99u TO=130u",
      ".measure tran v_adc_final FIND v(adcref) AT=240u"
    ],
    stopTime: "250u",
    supplySource: "PWL(0 5 250u 5)",
    timeStep: "0.02u"
  },
  {
    adcLoadSource: "PULSE(0 0.1 100u 1n 1n 1u 10u)",
    family: "sustained-burst",
    measurements: [
      ".measure tran v_adc_pre FIND v(adcref) AT=90u",
      ".measure tran v_adc_min MIN v(adcref) FROM=99u TO=291u",
      ".measure tran v_refout_min MIN v(refout) FROM=99u TO=291u",
      ".measure tran v_adc_final FIND v(adcref) AT=295u"
    ],
    stopTime: "300u",
    supplySource: "PWL(0 5 300u 5)",
    timeStep: "0.02u"
  },
  {
    adcLoadSource: "0",
    family: "startup",
    measurements: [
      ".measure tran t_adc_99 WHEN v(adcref)=2.475 RISE=1",
      ".measure tran v_adc_final FIND v(adcref) AT=290u",
      ".measure tran v_refout_final FIND v(refout) AT=290u"
    ],
    stopTime: "300u",
    supplySource: "PWL(0 0 50u 0 100u 5 300u 5)",
    timeStep: "0.05u"
  },
  {
    adcLoadSource: "0",
    family: "power-transition",
    measurements: [
      ".measure tran t_adc_10 WHEN v(adcref)=0.25 FALL=1",
      ".measure tran t_adc_recover_99 WHEN v(adcref)=2.475 RISE=2",
      ".measure tran v_adc_off_max MAX v(adcref) FROM=180u TO=200u",
      ".measure tran v_adc_final FIND v(adcref) AT=390u"
    ],
    stopTime: "400u",
    supplySource: "PWL(0 5 100u 5 101u 0 200u 0 201u 5 400u 5)",
    timeStep: "0.05u"
  }
]

export const referenceDriveSimulationManifest = {
  artifactKind: "bench-prototype-reference-transient-simulation",
  modelClass: "bounded-behavioral-screen",
  modelAuthority:
    "No official REF5025A-Q1 macromodel or ADS8881 conversion-phase REF-load model is claimed. Declared behavioral parameters exercise the selected passive network only.",
  selectedNetwork: {
    adcCapacitorMpn: "GRM21BR71A106KE51L",
    feedResistanceOhms: 0.22,
    feedResistorMpn: "RCWE0603R220FKEA",
    ref5025HighFrequencyCapacitorMpn: "C0603C104K3RACTU",
    ref5025InputCapacitorMpn: "GRM188R71A105KA12D",
    ref5025OutputCapacitorMpn: "T521B106M025ATE100",
    referenceMpn: "REF5025AQDRQ1"
  },
  declaredBehavioralInputs: {
    adcLoadPulseAmps: 0.1,
    adcLoadPulseChargeNc: 100,
    adcLoadPulseWidthUs: 1,
    feedResistanceOhms: 0.22,
    highFrequencyBypassUf: 0.1,
    inputBypassUf: 1,
    inputSourceResistanceOhms: 0.05,
    regulatorTargetVolts: 2.5,
    regulatorInputHeadroomVolts: 1
  },
  corners,
  scenarios: scenarios.map(({ family, stopTime, supplySource, adcLoadSource }) => ({
    adcLoadSource,
    family,
    stopTime,
    supplySource
  })),
  boundedAcceptance: {
    dynamicMaximumDroopMv: 30,
    dynamicMaximumFinalErrorMv: 3,
    powerOffMaximumResidualMv: 1,
    powerTransitionMaximumCollapseUs: 50,
    powerTransitionMaximumRecoveryUs: 50,
    startupMaximumTimeTo99PercentUs: 150
  },
  deniedClaims: [
    "REF5025A-Q1 silicon dynamic response",
    "ADS8881 conversion-phase reference load",
    "temperature-qualified capacitor bias, ESR, or ESL",
    "post-layout parasitics",
    "measured performance or simulation-to-bench correlation",
    "schematic, footprint, layout, or fabrication approval"
  ]
}

export const reviewedReferenceDriveExecution = {
  artifactDigests: {
    netlistTemplateSha256: "87be1beb2285c6adc1ab4b620f7139445cf06b451f57264a94508658f66894c2",
    normalizedResultsSha256: "f3a2997911b1b700babc4822093731aa54c3286de8e941748f8e9a5764b5d975",
    parameterManifestSha256: "5ca2d17e0664ace5c44ff4ed96113b1280b389591a2c1c03ba4ab17adce34f46",
    waveformManifestSha256: "1c708bcb507b3cbed63ddd416524c478dafef2409949362dba9f528a4e98f62f"
  },
  engineIdentity: "ngspice-47 : Circuit level simulation program",
  evidenceDigest: "79d700c8eddaf11a4a47ea1cd6e38ef29d8407effb30a1cef5cf6b2089b5599c"
}

function findExecutable() {
  const candidates = [
    process.env.NGSPICE_BIN,
    join(process.env.LOCALAPPDATA ?? "", "Programs", "ngspice-47", "Spice64", "bin", "ngspice_con.exe"),
    "ngspice_con.exe",
    "ngspice"
  ].filter(Boolean)
  return candidates.find(
    (candidate) => (!candidate.includes("\\") && !candidate.includes("/")) || existsSync(candidate)
  )
}

function applyTemplate(template, replacements) {
  const rendered = Object.entries(replacements).reduce(
    (source, [name, value]) => source.replaceAll(`{{${name}}}`, value),
    template
  )
  const unresolved = [...rendered.matchAll(/\{\{([^}]+)\}\}/gu)].map((match) => match[1])
  if (unresolved.length > 0)
    throw new Error(`Unresolved reference-drive netlist placeholders: ${unresolved.join(", ")}`)
  return rendered
}

function measurement(log, name) {
  const match = new RegExp(`^${name}\\s*=\\s*([\\d.e+-]+)`, "imu").exec(log)
  const value = Number(match?.[1])
  if (!Number.isFinite(value)) throw new Error(`ngspice did not return ${name}`)
  return value
}

function normalizedWaveformCsv(log) {
  const rows = log.split(/\r?\n/u).flatMap((line) => {
    const match =
      /^\s*\d+\s+([+-]?[\d.]+e[+-]\d+)\s+([+-]?[\d.]+e[+-]\d+)\s+([+-]?[\d.]+e[+-]\d+)\s+([+-]?[\d.]+e[+-]\d+)\s*$/iu.exec(
        line
      )
    return match ? [`${match[1]},${match[2]},${match[3]},${match[4]}`] : []
  })
  if (rows.length === 0) throw new Error("ngspice did not return raw reference-drive waveform rows")
  return `timeSeconds,inputVolts,refoutVolts,adcRefVolts\n${rows.join("\n")}\n`
}

function normalizeResult(simulationCase, log) {
  const common = {
    adcCapUf: simulationCase.adcCapUf,
    adcCapEsrOhms: simulationCase.adcCapEsrOhms,
    corner: simulationCase.corner,
    family: simulationCase.family,
    id: simulationCase.id,
    refOutputOhms: simulationCase.refOutputOhms,
    refRegCapUf: simulationCase.refRegCapUf,
    refRegEsrOhms: simulationCase.refRegEsrOhms,
    temperatureC: simulationCase.temperatureC
  }
  if (simulationCase.family === "single-conversion" || simulationCase.family === "sustained-burst") {
    const preVolts = measurement(log, "v_adc_pre")
    const minimumVolts = measurement(log, "v_adc_min")
    const finalVolts = measurement(log, "v_adc_final")
    return {
      ...common,
      adcDroopMv: rounded((preVolts - minimumVolts) * 1_000),
      adcFinalErrorMv: rounded(Math.abs(2.5 - finalVolts) * 1_000),
      adcMinimumVolts: rounded(minimumVolts),
      refoutMinimumVolts: rounded(measurement(log, "v_refout_min"))
    }
  }
  if (simulationCase.family === "startup") {
    return {
      ...common,
      adcFinalErrorMv: rounded(Math.abs(2.5 - measurement(log, "v_adc_final")) * 1_000),
      refoutFinalErrorMv: rounded(Math.abs(2.5 - measurement(log, "v_refout_final")) * 1_000),
      timeTo99PercentUs: rounded(measurement(log, "t_adc_99") * 1_000_000)
    }
  }
  const collapseAtUs = measurement(log, "t_adc_10") * 1_000_000
  const recoverAtUs = measurement(log, "t_adc_recover_99") * 1_000_000
  return {
    ...common,
    adcFinalErrorMv: rounded(Math.abs(2.5 - measurement(log, "v_adc_final")) * 1_000),
    collapseAfterPowerOffUs: rounded(collapseAtUs - 101),
    powerOffResidualMv: rounded(measurement(log, "v_adc_off_max") * 1_000),
    recoveryAfterPowerRestoreUs: rounded(recoverAtUs - 201)
  }
}

export async function runReferenceDriveSimulation({ outputDirectory = defaultOutputDirectory } = {}) {
  const executable = findExecutable()
  if (!executable) throw new Error("ngspice was not found. Set NGSPICE_BIN to the console executable.")
  const template = await readFile(templatePath, "utf8")
  await mkdir(outputDirectory, { recursive: true })

  const engineVersion = execFileSync(executable, ["-v"], { encoding: "utf8" })
  const engineIdentity = /^\*\* ngspice-\d+[^\r\n]*/mu.exec(engineVersion)?.[0].replace(/^\*\* /u, "")
  if (!engineIdentity) throw new Error("Unable to identify the ngspice engine version")

  const simulationCases = corners.flatMap((corner) =>
    scenarios.map((scenario) => ({ ...corner, ...scenario, corner: corner.id, id: `${scenario.family}-${corner.id}` }))
  )
  const results = []
  const waveformFiles = []
  for (const simulationCase of simulationCases) {
    const netlist = applyTemplate(template, {
      ADC_CAP_ESR_OHMS: String(simulationCase.adcCapEsrOhms),
      ADC_CAP_UF: String(simulationCase.adcCapUf),
      ADC_LOAD_SOURCE: simulationCase.adcLoadSource,
      FEED_OHMS: "0.22",
      INPUT_SOURCE_OHMS: "0.05",
      MEASUREMENTS: simulationCase.measurements.join("\n"),
      REF_INPUT_CAP_UF: "1",
      REF_OUTPUT_OHMS: String(simulationCase.refOutputOhms),
      REF_REG_CAP_UF: String(simulationCase.refRegCapUf),
      REF_REG_ESR_OHMS: String(simulationCase.refRegEsrOhms),
      STOP_TIME: simulationCase.stopTime,
      SUPPLY_SOURCE: simulationCase.supplySource,
      TIME_STEP: simulationCase.timeStep
    })
    const netlistPath = join(outputDirectory, `${simulationCase.id}.cir`)
    const logPath = join(outputDirectory, `${simulationCase.id}.log`)
    await writeFile(netlistPath, netlist)
    execFileSync(executable, ["-b", "-o", logPath, netlistPath], { stdio: "ignore" })
    const log = await readFile(logPath, "utf8")
    const waveformCsv = normalizedWaveformCsv(log)
    const waveformFile = `${simulationCase.id}.waveform.csv`
    await writeFile(join(outputDirectory, waveformFile), waveformCsv)
    waveformFiles.push({
      file: waveformFile,
      id: simulationCase.id,
      rowCount: waveformCsv.split("\n").length - 2,
      sha256: sha256(waveformCsv)
    })
    results.push(normalizeResult(simulationCase, log))
  }

  const limits = referenceDriveSimulationManifest.boundedAcceptance
  const failures = results.flatMap((result) => {
    if (result.family === "single-conversion" || result.family === "sustained-burst") {
      return [
        result.adcDroopMv <= limits.dynamicMaximumDroopMv ? null : `${result.id}: droop`,
        result.adcFinalErrorMv <= limits.dynamicMaximumFinalErrorMv ? null : `${result.id}: final error`
      ].filter(Boolean)
    }
    if (result.family === "startup") {
      return [
        result.timeTo99PercentUs <= limits.startupMaximumTimeTo99PercentUs ? null : `${result.id}: startup`,
        result.adcFinalErrorMv <= limits.dynamicMaximumFinalErrorMv ? null : `${result.id}: final error`
      ].filter(Boolean)
    }
    return [
      result.collapseAfterPowerOffUs <= limits.powerTransitionMaximumCollapseUs ? null : `${result.id}: collapse`,
      result.recoveryAfterPowerRestoreUs <= limits.powerTransitionMaximumRecoveryUs ? null : `${result.id}: recovery`,
      result.powerOffResidualMv <= limits.powerOffMaximumResidualMv ? null : `${result.id}: residual`,
      result.adcFinalErrorMv <= limits.dynamicMaximumFinalErrorMv ? null : `${result.id}: final error`
    ].filter(Boolean)
  })

  const templateSha256 = sha256(template)
  const parameterManifestJson = canonicalJson(referenceDriveSimulationManifest)
  const resultsJson = canonicalJson(results)
  const waveformManifestJson = canonicalJson(waveformFiles)
  const artifactDigests = {
    netlistTemplateSha256: templateSha256,
    normalizedResultsSha256: sha256(resultsJson),
    parameterManifestSha256: sha256(parameterManifestJson),
    waveformManifestSha256: sha256(waveformManifestJson)
  }
  const evidenceDigest = sha256(canonicalJson({ artifactDigests, engineIdentity }))
  const summary = {
    artifactDigests,
    boundedSimulationPassed: failures.length === 0,
    engineIdentity,
    evidenceDigest,
    modelClass: referenceDriveSimulationManifest.modelClass,
    performanceOrPhysicalAuthority: "deny",
    results
  }
  await writeFile(join(outputDirectory, "parameters.json"), parameterManifestJson)
  await writeFile(join(outputDirectory, "results.json"), resultsJson)
  await writeFile(join(outputDirectory, "waveforms.json"), waveformManifestJson)
  await writeFile(join(outputDirectory, "summary.json"), canonicalJson(summary))
  if (failures.length > 0) throw new Error(`Bounded reference-drive simulation failed: ${failures.join(", ")}`)
  if (
    canonicalJson({ artifactDigests, engineIdentity, evidenceDigest }) !==
    canonicalJson(reviewedReferenceDriveExecution)
  ) {
    throw new Error("Reference-drive simulation does not reproduce the reviewed engine and artifact digests")
  }
  return summary
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf("--output")
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error("--output requires a directory path")
  const outputDirectory = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1]) : defaultOutputDirectory
  console.log(JSON.stringify(await runReferenceDriveSimulation({ outputDirectory }), null, 2))
}
