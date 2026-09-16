import { spawn } from "node:child_process"
import { readdir } from "node:fs/promises"
import { dirname, extname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const toolsDirectory = resolve(appDirectory, "tools")
const supportedExtensions = new Set([".mjs", ".ts"])

function isRunnableTool(path) {
  const name = path.slice(0, -extname(path).length)
  return !name.endsWith(".test") && !name.endsWith("-worker")
}

async function collectTools(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const tools = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        return collectTools(path)
      }
      return supportedExtensions.has(extname(entry.name)) && isRunnableTool(path) ? [path] : []
    })
  )
  return tools.flat()
}

function toolName(path) {
  const extension = extname(path)
  return relative(toolsDirectory, path).slice(0, -extension.length).split(sep).join("/")
}

async function discoverTools() {
  try {
    return await collectTools(toolsDirectory)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

function printUsage(tools) {
  process.stdout.write(`Usage: pnpm tool <name> [arguments]\n\nAvailable tools:\n${tools.join("\n")}\n`)
}

const [requestedTool, ...toolArguments] = process.argv.slice(2)
const toolPaths = await discoverTools()
const tools = toolPaths.map(toolName).sort()

if (requestedTool === undefined || requestedTool === "--help" || requestedTool === "--list") {
  printUsage(tools)
  process.exitCode = requestedTool === undefined ? 1 : 0
} else if (!tools.includes(requestedTool)) {
  process.stderr.write(`Unknown tool: ${requestedTool}\n`)
  printUsage(tools)
  process.exitCode = 1
} else {
  const toolPath = toolPaths.find((candidate) => toolName(candidate) === requestedTool)
  if (toolPath === undefined) {
    throw new Error(`Tool disappeared during discovery: ${requestedTool}`)
  }
  const runtimeArguments = ["--env-file-if-exists=.env"]
  if (extname(toolPath) === ".ts") {
    runtimeArguments.push("--import", "tsx")
  }
  runtimeArguments.push(toolPath, ...toolArguments)

  const child = spawn(process.execPath, runtimeArguments, {
    cwd: appDirectory,
    env: process.env,
    stdio: "inherit"
  })
  child.once("exit", (code, signal) => {
    if (signal !== null) {
      process.kill(process.pid, signal)
    }
    process.exitCode = code ?? 1
  })
}
