import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const firmwareRoot = new URL("../", import.meta.url)
const buildRoot = new URL("../out/host-native/", import.meta.url)
const scoringAppRoot = new URL("../../../", import.meta.url)
const fixtureCheck = new URL("generate-golden-fixture.mjs", import.meta.url)
const transportFixtureCheck = new URL("generate-transport-fixture.mjs", import.meta.url)
const isWindows = process.platform === "win32"

function run(command, args, environment = process.env) {
  const result = spawnSync(command, args, {
    env: environment,
    stdio: "inherit"
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}`)
  }
}

function runPnpm(args) {
  if (isWindows) {
    const pnpmEntrypoint = join(dirname(process.execPath), "node_modules", "corepack", "dist", "pnpm.js")

    if (!existsSync(pnpmEntrypoint)) {
      throw new Error(`Corepack pnpm entrypoint is unavailable at ${pnpmEntrypoint}`)
    }

    run(process.execPath, [pnpmEntrypoint, "--dir", scoringAppRootPath, ...args])
    return
  }

  run("pnpm", ["--dir", scoringAppRootPath, ...args])
}

function findWindowsMingwBin() {
  const packageRoot = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages")

  if (!existsSync(packageRoot)) {
    throw new Error("No LLVM-MinGW host toolchain is installed")
  }

  const packageName = readdirSync(packageRoot).find((name) => name.startsWith("MartinStorsjo.LLVM-MinGW.UCRT_"))

  if (!packageName) {
    throw new Error("No LLVM-MinGW host toolchain is installed")
  }

  const packagePath = join(packageRoot, packageName)
  const toolchainName = readdirSync(packagePath).find(
    (name) => name.startsWith("llvm-mingw-") && name.includes("x86_64")
  )

  if (!toolchainName) {
    throw new Error("LLVM-MinGW host toolchain has no x86_64 directory")
  }

  const binPath = join(packagePath, toolchainName, "bin")

  if (!existsSync(join(binPath, "clang.exe")) || !existsSync(join(binPath, "mingw32-make.exe"))) {
    throw new Error(`LLVM-MinGW host toolchain is incomplete at ${binPath}`)
  }

  return binPath
}

const firmwareRootPath = fileURLToPath(firmwareRoot)
const buildRootPath = fileURLToPath(buildRoot)
const scoringAppRootPath = fileURLToPath(scoringAppRoot)
const configureArgs = ["-S", firmwareRootPath, "-B", buildRootPath, "-DCMAKE_BUILD_TYPE=Release"]
let toolchainEnvironment = process.env

if (isWindows) {
  const mingwBin = findWindowsMingwBin()
  toolchainEnvironment = { ...process.env, PATH: `${mingwBin};${process.env.PATH ?? ""}` }
  configureArgs.push(
    "-G",
    "MinGW Makefiles",
    `-DCMAKE_C_COMPILER=${join(mingwBin, "clang.exe")}`,
    `-DCMAKE_MAKE_PROGRAM=${join(mingwBin, "mingw32-make.exe")}`
  )
}

mkdirSync(buildRootPath, { recursive: true })
runPnpm(["check:golden-vectors"])
run("node", [fileURLToPath(fixtureCheck), "--check"])
run("node", [fileURLToPath(transportFixtureCheck), "--check"])
run("cmake", configureArgs, toolchainEnvironment)
run("cmake", ["--build", buildRootPath, "--config", "Release"], toolchainEnvironment)
run("ctest", ["--test-dir", buildRootPath, "--build-config", "Release", "--output-on-failure"], toolchainEnvironment)
