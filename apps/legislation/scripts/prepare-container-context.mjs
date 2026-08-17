import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, rmSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const applicationRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(applicationRoot, "..", "..")
const contextPath = resolve(repositoryRoot, ".container", "legislation")
const commandEnvironment = { ...process.env }
const pnpmCli = process.env.npm_execpath

if (pnpmCli === undefined) {
  throw new Error("Run this script through pnpm container:prepare")
}

for (const name of Object.keys(commandEnvironment)) {
  if (["npm_config_confirm_modules_purge", "npm_config_recursive"].includes(name.toLowerCase())) {
    delete commandEnvironment[name]
  }
}
Object.assign(commandEnvironment, {
  CI: "true",
  npm_config_confirm_modules_purge: "false",
  npm_config_recursive: "false"
})

if (contextPath !== resolve(repositoryRoot, ".container", "legislation")) {
  throw new Error("Refusing to prepare an unexpected container context")
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: applicationRoot,
    encoding: "utf8",
    stdio: "inherit",
    env: commandEnvironment
  })
  if (result.error !== undefined) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`)
  }
}

rmSync(contextPath, { force: true, recursive: true })
run(process.execPath, [pnpmCli, "run", "build"])
run(process.execPath, [pnpmCli, "--filter", "legislation", "deploy", "--prod", "--legacy", "--force", contextPath])

const environmentFile = resolve(contextPath, ".env")
if (existsSync(environmentFile)) {
  rmSync(environmentFile)
}
copyFileSync(resolve(applicationRoot, "Dockerfile"), resolve(contextPath, "Dockerfile"))
