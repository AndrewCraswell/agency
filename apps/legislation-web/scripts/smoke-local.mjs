import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const port = Number(process.env.LEGISLATION_SMOKE_PORT ?? "3199")
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError("LEGISLATION_SMOKE_PORT must be an integer between 1 and 65535")
}
const nextCliPath = createRequire(new URL("../package.json", import.meta.url)).resolve("next/dist/bin/next")
const child = spawn(process.execPath, [nextCliPath, "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: {
    ...process.env,
    AUTH_MODE: "disabled",
    LEGISLATION_HOST: "127.0.0.1",
    LEGISLATION_PORT: String(port),
    NODE_ENV: "development",
    PORT: String(port)
  },
  stdio: ["ignore", "pipe", "pipe"]
})
let diagnostics = ""
child.stdout.on("data", (chunk) => {
  diagnostics += chunk.toString()
})
child.stderr.on("data", (chunk) => {
  diagnostics += chunk.toString()
})

try {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming ready: ${diagnostics.slice(-2000)}`)
    }
    try {
      const [health, ready] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/health`),
        fetch(`http://127.0.0.1:${port}/ready`)
      ])
      if (health.ok && ready.ok) {
        process.stdout.write(`${JSON.stringify({ health: health.status, port, ready: ready.status })}\n`)
        break
      }
    } catch {
      // The process can take a moment to bind the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (Date.now() >= deadline) {
    throw new Error(`Server did not become ready: ${diagnostics.slice(-2000)}`)
  }
} finally {
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ])
}
