import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const directory = resolve("workflows")
const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort()
if (files.length !== 9) {
  throw new Error(`Expected nine exported workflows, found ${files.length}`)
}

const workflowIds = new Set()

for (const file of files) {
  const workflow = JSON.parse(await readFile(resolve(directory, file), "utf8"))
  if (typeof workflow.id !== "string" || !workflow.id.startsWith("legislation-")) {
    throw new Error(`${file} must have a stable legislation workflow ID`)
  }
  if (workflowIds.has(workflow.id)) {
    throw new Error(`${file} duplicates workflow ID ${workflow.id}`)
  }
  workflowIds.add(workflow.id)
  if (workflow.active !== false) {
    throw new Error(`${file} must remain inactive until its bounded validation passes`)
  }
  const start = workflow.nodes?.find((node) => node.id === "start")
  if (start?.parameters?.body === undefined || !start.parameters.body.startsWith("=")) {
    throw new Error(`${file} has no raw Azure job start body`)
  }
  const template = JSON.parse(start.parameters.body.slice(1))
  if (template.template !== undefined || !Array.isArray(template.containers) || template.containers.length !== 1) {
    throw new Error(`${file} must send a complete JobExecutionTemplate directly`)
  }
  const container = template.containers[0]
  const environment = new Map(container.env?.map((entry) => [entry.name, entry]))
  for (const name of [
    "NODE_ENV",
    "DATABASE_URL",
    "AZURE_STORAGE_ACCOUNT",
    "AZURE_CLIENT_ID",
    "CORRELATION_ID",
    "WORKFLOW_EXECUTION_ID"
  ]) {
    if (!environment.has(name)) {
      throw new Error(`${file} omits required job environment variable ${name}`)
    }
  }
  if (environment.get("WORKFLOW_EXECUTION_ID")?.value !== "{{ $execution.id }}") {
    throw new Error(`${file} must propagate the n8n execution ID to the ingestion job`)
  }
  if (environment.get("CORRELATION_ID")?.value !== "{{ $workflow.id }}:{{ $execution.id }}") {
    throw new Error(`${file} must propagate the stable workflow and execution correlation ID`)
  }
  if (environment.get("DATABASE_URL")?.secretRef !== "database-url") {
    throw new Error(`${file} must reference the configured database-url secret`)
  }
  if (file.startsWith("congress-") && environment.get("CONGRESS_API_KEY")?.secretRef !== "congress-api-key") {
    throw new Error(`${file} must reference the configured Congress API secret`)
  }
  if (file === "embedding-refresh.json" && environment.get("OPENROUTER_API_KEY")?.secretRef !== "openrouter-api-key") {
    throw new Error(`${file} must reference the configured OpenRouter secret`)
  }
}

process.stdout.write(`${JSON.stringify({ files: files.length, status: "valid" })}\n`)
