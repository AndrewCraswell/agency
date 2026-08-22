import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const firmwareRoot = fileURLToPath(new URL("../", import.meta.url))
const targetRoot = join(firmwareRoot, "target")
const manifest = JSON.parse(readFileSync(join(targetRoot, "toolchain-manifest.json"), "utf8"))
const cacheArgument = process.argv.indexOf("--cache")
const cacheRoot = cacheArgument === -1 ? join(firmwareRoot, ".cache") : resolve(process.argv[cacheArgument + 1] ?? "")

if (cacheArgument !== -1 && !process.argv[cacheArgument + 1]) {
  throw new Error("--cache requires a directory path")
}

const archivePath = join(cacheRoot, manifest.armGnuToolchain.archive)
const compilerPath = join(cacheRoot, "bin", "arm-none-eabi-gcc.exe")
const cubeRoot = join(cacheRoot, "STM32CubeG4")
const deviceRoot = join(cubeRoot, "Drivers", "CMSIS", "Device", "ST", "STM32G4xx")
const deviceHeader = join(deviceRoot, "Include", "stm32g474xx.h")

function run(command, args, cwd = firmwareRoot) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" })

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

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase()
}

function downloadArchive() {
  const temporaryPath = `${archivePath}.partial`
  run("curl.exe", ["--fail", "--location", "--output", temporaryPath, manifest.armGnuToolchain.url])

  if (digest(temporaryPath) !== manifest.armGnuToolchain.sha256) {
    rmSync(temporaryPath, { force: true })
    throw new Error("downloaded Arm GNU Toolchain digest does not match the pinned manifest")
  }

  renameSync(temporaryPath, archivePath)
}

function verifyCubeCheckout() {
  if (capture("git", ["rev-parse", "HEAD"], cubeRoot) !== manifest.stm32CubeG4.commit) {
    throw new Error("STM32CubeG4 checkout does not match the pinned manifest commit")
  }

  if (capture("git", ["rev-parse", "HEAD"], deviceRoot) !== manifest.stm32CubeG4.cmsisDeviceCommit) {
    throw new Error("STM32CubeG4 CMSIS device checkout does not match the pinned manifest commit")
  }
}

mkdirSync(cacheRoot, { recursive: true })

if (!existsSync(archivePath)) {
  downloadArchive()
}

if (digest(archivePath) !== manifest.armGnuToolchain.sha256) {
  throw new Error("cached Arm GNU Toolchain archive digest does not match the pinned manifest")
}

if (!existsSync(compilerPath)) {
  run("tar", ["-xf", archivePath, "-C", cacheRoot])
}

if (!existsSync(compilerPath)) {
  throw new Error("Arm GNU Toolchain archive did not provide bin/arm-none-eabi-gcc.exe")
}

if (!existsSync(cubeRoot)) {
  run("git", ["clone", "--depth", "1", "--branch", manifest.stm32CubeG4.tag, manifest.stm32CubeG4.url, cubeRoot])
}

if (!existsSync(deviceHeader)) {
  run("git", ["submodule", "update", "--init", "--depth", "1", "Drivers/CMSIS/Device/ST/STM32G4xx"], cubeRoot)
}

verifyCubeCheckout()

process.stdout.write(
  `${JSON.stringify({
    cache: cacheRoot,
    toolchain: manifest.armGnuToolchain.version,
    sdk: `${manifest.stm32CubeG4.tag} (${manifest.stm32CubeG4.commit})`,
    cmsisDevice: manifest.stm32CubeG4.cmsisDeviceCommit
  })}\n`
)
