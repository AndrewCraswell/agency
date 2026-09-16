import { z } from "zod"
import { createMcpApplication } from "./application.js"
import { close, createMcpServer, listen } from "./server.js"

try {
  const port = z.coerce.number().int().min(1).max(65535).default(3000).parse(process.env.PORT)
  const application = createMcpApplication(process.env)
  const server = createMcpServer(application)
  let shutdown: Promise<void> | undefined
  const stop = () => {
    if (shutdown !== undefined) return
    const deadline = setTimeout(() => {
      server.closeAllConnections()
      process.exit(1)
    }, 10_000)
    deadline.unref()
    shutdown ??= close(server, application)
    void shutdown.then(
      () => clearTimeout(deadline),
      () => {
        process.stderr.write("MCP shutdown failed\n")
        process.exitCode = 1
      }
    )
  }
  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
  try {
    await listen(server, port)
  } catch (error) {
    await close(server, application)
    throw error
  }
} catch {
  process.stderr.write("MCP startup failed; check configuration and port availability\n")
  process.exitCode = 1
}
