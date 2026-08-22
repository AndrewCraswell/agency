import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const firmwareRoot = fileURLToPath(new URL("../", import.meta.url))
const targetRoot = join(firmwareRoot, "target")
const cacheRoot = process.env.SCORING_STM32_TARGET_CACHE ?? join(firmwareRoot, ".cache")
const staticCheckScript = fileURLToPath(new URL("check-target-static.mjs", import.meta.url))
const bootstrapScript = fileURLToPath(new URL("bootstrap-target-dependencies.mjs", import.meta.url))
const manifest = JSON.parse(readFileSync(join(targetRoot, "toolchain-manifest.json"), "utf8"))
const armRoot = cacheRoot
const cubeRoot = join(cacheRoot, "STM32CubeG4")
const buildRoot = join(firmwareRoot, "out", "stm32g474re-release")
const toolchainFile = join(targetRoot, "arm-none-eabi-gcc.cmake")
const cmake = process.platform === "win32" ? "cmake.exe" : "cmake"

function findNinja() {
  if (process.env.SCORING_NINJA && existsSync(process.env.SCORING_NINJA)) {
    return process.env.SCORING_NINJA
  }

  const packageRoot = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages")
  const packageName = existsSync(packageRoot)
    ? readdirSync(packageRoot).find((name) => name.startsWith("Ninja-build.Ninja_"))
    : undefined

  if (packageName) {
    const ninjaPath = join(packageRoot, packageName, "ninja.exe")

    if (existsSync(ninjaPath)) {
      return ninjaPath
    }
  }

  throw new Error(
    "Ninja is required for the STM32 target build. Install Ninja-build.Ninja 1.13.2 with winget or set SCORING_NINJA to ninja.exe."
  )
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: firmwareRoot, stdio: "inherit" })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}`)
  }
}

function capture(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}: ${result.stderr}`)
  }

  return result.stdout.trim()
}

const archivePath = join(cacheRoot, manifest.armGnuToolchain.archive)

if (!existsSync(staticCheckScript)) {
  throw new Error("STM32 target static-check script is missing")
}

run(process.execPath, [bootstrapScript, "--cache", cacheRoot])

const archiveDigest = createHash("sha256").update(readFileSync(archivePath)).digest("hex").toUpperCase()

if (archiveDigest !== manifest.armGnuToolchain.sha256) {
  throw new Error("pinned Arm GNU Toolchain archive digest does not match the manifest")
}

if (capture("git", ["rev-parse", "HEAD"], cubeRoot) !== manifest.stm32CubeG4.commit) {
  throw new Error("STM32CubeG4 checkout does not match the pinned manifest commit")
}

const deviceRoot = join(cubeRoot, "Drivers", "CMSIS", "Device", "ST", "STM32G4xx")

if (capture("git", ["rev-parse", "HEAD"], deviceRoot) !== manifest.stm32CubeG4.cmsisDeviceCommit) {
  throw new Error("STM32CubeG4 CMSIS device checkout does not match the pinned manifest commit")
}

const configureArguments = [
  "--fresh",
  "-S",
  firmwareRoot,
  "-B",
  buildRoot,
  `-DCMAKE_TOOLCHAIN_FILE=${toolchainFile}`,
  "-DSCORING_BUILD_STM32G474RE_TARGET=ON",
  "-DCMAKE_BUILD_TYPE=Release",
  `-DSCORING_ARM_GNU_TOOLCHAIN_ROOT=${armRoot}`,
  `-DSCORING_STM32CUBE_G4_ROOT=${cubeRoot}`
]

configureArguments.push("-G", "Ninja", `-DCMAKE_MAKE_PROGRAM=${findNinja()}`)

run(cmake, configureArguments)
run(cmake, ["--build", buildRoot, "--target", "scoring_stm32g474re_static_check"])

const evidencePath = join(buildRoot, "scoring_stm32g474re.static-check.json")

if (!existsSync(evidencePath)) {
  throw new Error("target static-check evidence was not produced")
}

const evidence = JSON.parse(readFileSync(evidencePath, "utf8"))

if (evidence.staticChecks !== "passed") {
  throw new Error("target static checks did not pass")
}

process.stdout.write(
  `${JSON.stringify({
    target: "STM32G474RE",
    sdk: `${manifest.stm32CubeG4.tag} (${manifest.stm32CubeG4.commit})`,
    toolchain: manifest.armGnuToolchain.version,
    staticChecks: evidence.staticChecks
  })}\n`
)
