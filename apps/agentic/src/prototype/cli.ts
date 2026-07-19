import { readFile } from "node:fs/promises"
import { AssignmentSchema } from "../contracts/assignment"
import type { CleanupMode } from "../daytona/workspace"
import { runWorker } from "./runner"

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

const assignmentPath = argument("--assignment")
if (assignmentPath === undefined) {
  throw new Error("Usage: pnpm prototype --assignment <path> [--cleanup stop|archive|delete]")
}

const cleanupValue = argument("--cleanup") ?? "stop"
if (cleanupValue !== "stop" && cleanupValue !== "archive" && cleanupValue !== "delete") {
  throw new Error(`Invalid cleanup mode ${cleanupValue}`)
}

const assignment = AssignmentSchema.parse(JSON.parse(await readFile(assignmentPath, "utf8")))
const approvedRepository = `${requiredEnvironment("AGENT_REPOSITORY_OWNER")}/${requiredEnvironment("AGENT_REPOSITORY_NAME")}`
const startedAt = Date.now()
const result = await runWorker({
  assignment,
  approvedRepository,
  workspaceSecretKey: requiredEnvironment("WORKSPACE_SECRET_KEY"),
  cleanupMode: cleanupValue satisfies CleanupMode,
  onProgress: (message) => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000)
    process.stderr.write(`[worker +${elapsedSeconds}s] ${message}\n`)
  },
  secrets: {
    githubToken: requiredEnvironment("GITHUB_TOKEN"),
    modelProviderApiKey: requiredEnvironment("OPENROUTER_API_KEY")
  }
})

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
if (result.status === "completed") {
  process.exitCode = 0
} else if (result.status === "blocked") {
  process.exitCode = 2
} else {
  process.exitCode = 1
}
