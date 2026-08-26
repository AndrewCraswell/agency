import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { dirname, extname, join, normalize, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const firmwareRoot = resolve(scriptDirectory, "..")
const scoringRoot = resolve(firmwareRoot, "..")
const repositoryRoot = resolve(scoringRoot, "..", "..")
const coverageRoot = resolve(firmwareRoot, "out", "coverage")
const sourceExtensions = new Set([".c", ".cc", ".cpp", ".cxx"])
const excludedDirectoryNames = new Set([".cache", "generated", "out", "tests", "vendor"])

export const CORE_SOURCES = Object.freeze(["stm32/core/stm32_scoring_core.c"])

export const COVERAGE_POLICY = Object.freeze({
  core: Object.freeze({ lines: 100, functions: 100, branches: 100 }),
  other: Object.freeze({ lines: 80, functions: 80, branches: 80 })
})

const projects = Object.freeze([
  {
    name: "stm32",
    sourceDirectory: join(firmwareRoot, "stm32")
  },
  {
    name: "esp32",
    sourceDirectory: join(firmwareRoot, "esp32")
  },
  {
    name: "product-update",
    sourceDirectory: join(firmwareRoot, "product-update")
  }
])

function commandOrThrow(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: "pipe",
    ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${arguments_.join(" ")} failed (${result.status})\n${result.stdout}${result.stderr}`)
  }
  return result.stdout
}

function commandPath(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", stdio: "ignore" })
  return result.error === undefined && result.status === 0 ? command : undefined
}

function buildDomainArtifacts() {
  const compiler = join(repositoryRoot, "node_modules", "typescript", "lib", "tsc.js")
  if (!existsSync(compiler)) throw new Error(`TypeScript compiler is required at ${compiler}`)
  commandOrThrow(process.execPath, [compiler, "-p", join(scoringRoot, "tsconfig.build.json")], {
    cwd: scoringRoot
  })
}

function findWindowsLlvmBin() {
  if (process.env.SCORING_LLVM_BIN) return resolve(process.env.SCORING_LLVM_BIN)
  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return undefined
  const packages = join(localAppData, "Microsoft", "WinGet", "Packages")
  if (!existsSync(packages)) return undefined
  const llvmPackage = readdirSync(packages).find((entry) => entry.startsWith("MartinStorsjo.LLVM-MinGW.UCRT_"))
  if (!llvmPackage) return undefined
  const packageRoot = join(packages, llvmPackage)
  const toolchain = readdirSync(packageRoot).find(
    (entry) => entry.startsWith("llvm-mingw-") && entry.includes("x86_64")
  )
  return toolchain ? join(packageRoot, toolchain, "bin") : undefined
}

function findNinja() {
  if (process.platform !== "win32") return commandPath("ninja")
  const localAppData = process.env.LOCALAPPDATA
  const candidate =
    localAppData &&
    join(
      localAppData,
      "Microsoft",
      "WinGet",
      "Packages",
      "Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "ninja.exe"
    )
  return candidate && existsSync(candidate) ? candidate : commandPath("ninja")
}

function resolveToolchain() {
  if (process.platform === "win32") {
    const bin = findWindowsLlvmBin()
    if (!bin) throw new Error("LLVM-MinGW is required; set SCORING_LLVM_BIN or install the pinned LLVM-MinGW toolchain")
    const clang = join(bin, "clang.exe")
    const llvmCov = join(bin, "llvm-cov.exe")
    const llvmProfdata = join(bin, "llvm-profdata.exe")
    const ninja = findNinja()
    if (![clang, llvmCov, llvmProfdata, ninja].every((entry) => entry && existsSync(entry))) {
      throw new Error("LLVM-MinGW clang, llvm-cov, llvm-profdata, and Ninja are all required for coverage")
    }
    return {
      clang,
      llvmCov,
      llvmProfdata,
      ninja,
      environment: { ...process.env, PATH: `${bin};${process.env.PATH ?? ""}` }
    }
  }
  const clang = commandPath("clang")
  const llvmCov = commandPath("llvm-cov")
  const llvmProfdata = commandPath("llvm-profdata")
  const ninja = findNinja()
  if (!clang || !llvmCov || !llvmProfdata || !ninja) {
    throw new Error("clang, llvm-cov, llvm-profdata, and Ninja are required for coverage")
  }
  return { clang, llvmCov, llvmProfdata, ninja, environment: process.env }
}

function removeCoverageOutput() {
  const expected = resolve(firmwareRoot, "out", "coverage")
  if (coverageRoot !== expected || relative(firmwareRoot, coverageRoot).startsWith("..")) {
    throw new Error(`Refusing to remove an unexpected coverage directory: ${coverageRoot}`)
  }
  rmSync(coverageRoot, { force: true, recursive: true })
  mkdirSync(coverageRoot, { recursive: true })
}

function hostTestExecutables(buildDirectory) {
  const executableExtension = process.platform === "win32" ? ".exe" : ""
  return readdirSync(buildDirectory)
    .filter(
      (entry) =>
        entry.startsWith("scoring_") &&
        (entry.endsWith(`test${executableExtension}`) || entry.endsWith(`tests${executableExtension}`))
    )
    .map((entry) => join(buildDirectory, entry))
}

function collectFirstPartySources(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!excludedDirectoryNames.has(entry.name)) collectFirstPartySources(entryPath, output)
    } else if (sourceExtensions.has(extname(entry.name))) {
      output.push(resolve(entryPath))
    }
  }
  return output
}

export function metricPercent(metric) {
  if (!metric || typeof metric.count !== "number" || typeof metric.covered !== "number") {
    throw new Error("Coverage metric is missing")
  }
  if (metric.count === 0) return 100
  return (metric.covered * 100) / metric.count
}

export function summarizeCoverageExport(coverageExport) {
  if (!coverageExport || !Array.isArray(coverageExport.data)) throw new Error("llvm-cov export has no data array")
  const byFile = new Map()
  for (const dataSet of coverageExport.data) {
    if (!Array.isArray(dataSet.files)) throw new Error("llvm-cov export data has no files array")
    for (const file of dataSet.files) {
      if (typeof file.filename !== "string" || !file.summary) throw new Error("llvm-cov export file is malformed")
      const filename = normalize(resolve(file.filename))
      if (byFile.has(filename)) throw new Error(`llvm-cov export reported duplicate source file: ${filename}`)
      byFile.set(filename, {
        branches: metricPercent(file.summary.branches),
        functions: metricPercent(file.summary.functions),
        lines: metricPercent(file.summary.lines)
      })
    }
  }
  return byFile
}

export function evaluateCoverage(expectedSources, measurements) {
  const failures = []
  for (const source of expectedSources) {
    const normalizedSource = normalize(resolve(source))
    const threshold = CORE_SOURCES.includes(relative(firmwareRoot, normalizedSource).replaceAll("\\", "/"))
      ? COVERAGE_POLICY.core
      : COVERAGE_POLICY.other
    const measurement = measurements.get(normalizedSource)
    if (!measurement) {
      failures.push(`${relative(scoringRoot, normalizedSource)}: missing coverage mapping`)
      continue
    }
    for (const metric of ["lines", "functions", "branches"]) {
      if (measurement[metric] + Number.EPSILON < threshold[metric]) {
        failures.push(
          `${relative(scoringRoot, normalizedSource)}: ${metric} ${measurement[metric].toFixed(2)}% < ${threshold[metric]}%`
        )
      }
    }
  }
  return failures
}

function buildAndMeasure(project, toolchain) {
  const buildDirectory = join(coverageRoot, project.name)
  const profileDirectory = join(buildDirectory, "profiles")
  mkdirSync(profileDirectory, { recursive: true })
  const configure = [
    "-G",
    "Ninja",
    "-S",
    project.sourceDirectory,
    "-B",
    buildDirectory,
    "-DCMAKE_BUILD_TYPE=Debug",
    `-DCMAKE_MAKE_PROGRAM=${toolchain.ninja}`,
    `-DCMAKE_C_COMPILER=${toolchain.clang}`,
    "-DSCORING_ENABLE_LLVM_COVERAGE=ON"
  ]
  commandOrThrow("cmake", configure, { env: toolchain.environment })
  commandOrThrow("cmake", ["--build", buildDirectory, "--config", "Debug"], { env: toolchain.environment })
  commandOrThrow("ctest", ["--test-dir", buildDirectory, "--build-config", "Debug", "--output-on-failure"], {
    env: { ...toolchain.environment, LLVM_PROFILE_FILE: join(profileDirectory, "%m-%p.profraw") }
  })
  const profiles = readdirSync(profileDirectory)
    .filter((entry) => entry.endsWith(".profraw"))
    .map((entry) => join(profileDirectory, entry))
  if (profiles.length === 0) throw new Error(`${project.name}: tests generated no LLVM profiles`)
  const profileData = join(buildDirectory, "coverage.profdata")
  commandOrThrow(toolchain.llvmProfdata, ["merge", "-sparse", ...profiles, "-o", profileData], {
    env: toolchain.environment
  })
  const objects = hostTestExecutables(buildDirectory)
  if (objects.length === 0 || !objects.every(existsSync))
    throw new Error(`${project.name}: no native host test executable was built`)
  const exportArguments = ["export", objects[0], "--instr-profile", profileData]
  for (const object of objects.slice(1)) exportArguments.push("--object", object)
  return JSON.parse(commandOrThrow(toolchain.llvmCov, exportArguments, { env: toolchain.environment }))
}

function run() {
  buildDomainArtifacts()
  const toolchain = resolveToolchain()
  removeCoverageOutput()
  const measurements = new Map()
  for (const project of projects) {
    const projectMeasurements = summarizeCoverageExport(buildAndMeasure(project, toolchain))
    for (const [filename, measurement] of projectMeasurements) measurements.set(filename, measurement)
  }
  const expectedSources = collectFirstPartySources(firmwareRoot).sort()
  const failures = evaluateCoverage(expectedSources, measurements)
  for (const source of expectedSources) {
    const measurement = measurements.get(normalize(resolve(source)))
    if (measurement) {
      console.log(
        `${relative(scoringRoot, source)} lines=${measurement.lines.toFixed(2)} functions=${measurement.functions.toFixed(2)} branches=${measurement.branches.toFixed(2)}`
      )
    }
  }
  if (failures.length > 0) throw new Error(`C/C++ coverage gate failed:\n${failures.join("\n")}`)
  console.log("C/C++ coverage gate passed")
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
