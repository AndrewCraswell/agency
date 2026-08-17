import { readdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"

const directory = resolve("workflows")
const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort()
if (files.length !== 11) {
  throw new Error(`Expected eleven exported workflows, found ${files.length}`)
}

const workflowIds = new Set()
const requiredEnvironment = [
  "NODE_ENV",
  "DATABASE_URL",
  "AZURE_STORAGE_ACCOUNT",
  "AZURE_CLIENT_ID",
  "CORRELATION_ID",
  "WORKFLOW_EXECUTION_ID"
]

for (const file of files) {
  const workflow = JSON.parse(await readFile(resolve(directory, file), "utf8"))
  if (typeof workflow.id !== "string" || !workflow.id.startsWith("legislation-")) {
    throw new Error(`${file} must have a stable legislation workflow ID`)
  }
  if (workflow.id.length > 36) {
    throw new Error(`${file} workflow ID exceeds n8n's 36-character database limit`)
  }
  if (workflowIds.has(workflow.id)) {
    throw new Error(`${file} duplicates workflow ID ${workflow.id}`)
  }
  workflowIds.add(workflow.id)
  if (workflow.active !== false) {
    throw new Error(`${file} must remain inactive until its bounded validation passes`)
  }
  const starts = workflow.nodes?.filter(
    (node) =>
      node.type === "n8n-nodes-base.httpRequest" &&
      node.parameters?.method === "POST" &&
      node.parameters?.url?.includes("/start?api-version=")
  )
  if (!Array.isArray(starts) || starts.length === 0) {
    throw new Error(`${file} has no Azure job start node`)
  }
  if (file !== "bootstrap-orchestration.json" && starts.length !== 1) {
    throw new Error(`${file} must start exactly one application job`)
  }
  for (const start of starts) {
    validateJobStart(file, start)
  }
  if (file === "bootstrap-orchestration.json") {
    validateBootstrapWorkflow(workflow, starts)
  }
}

function validateJobStart(file, start) {
  if (start.parameters?.body === undefined || !start.parameters.body.startsWith("=")) {
    throw new Error(`${file} node ${start.name} has no raw Azure job start body`)
  }
  const template = JSON.parse(start.parameters.body.slice(1))
  if (template.template !== undefined || !Array.isArray(template.containers) || template.containers.length !== 1) {
    throw new Error(`${file} node ${start.name} must send a complete JobExecutionTemplate directly`)
  }
  const container = template.containers[0]
  const environment = new Map(container.env?.map((entry) => [entry.name, entry]))
  for (const name of requiredEnvironment) {
    if (!environment.has(name)) {
      throw new Error(`${file} node ${start.name} omits required job environment variable ${name}`)
    }
  }
  if (environment.get("WORKFLOW_EXECUTION_ID")?.value !== "{{ $execution.id }}") {
    throw new Error(`${file} node ${start.name} must propagate the n8n execution ID to the ingestion job`)
  }
  if (environment.get("CORRELATION_ID")?.value !== "{{ $workflow.id }}:{{ $execution.id }}") {
    throw new Error(`${file} node ${start.name} must propagate the stable workflow and execution correlation ID`)
  }
  if (environment.get("DATABASE_URL")?.secretRef !== "database-url") {
    throw new Error(`${file} node ${start.name} must reference the configured database-url secret`)
  }
  const command = container.args?.[1]
  if (typeof command !== "string") {
    throw new Error(`${file} node ${start.name} has no application command`)
  }
  if (command.startsWith("congress:") && environment.get("CONGRESS_API_KEY")?.secretRef !== "congress-api-key") {
    throw new Error(`${file} node ${start.name} must reference the configured Congress API secret`)
  }
  if (command === "embeddings:run" && environment.get("OPENROUTER_API_KEY")?.secretRef !== "openrouter-api-key") {
    throw new Error(`${file} node ${start.name} must reference the configured OpenRouter secret`)
  }
}

function validateBootstrapWorkflow(workflow, starts) {
  const expectedPhases = [
    {
      command: "openstates:bootstrap",
      inspect: "Inspect Open States execution",
      next: "Start GovInfo bootstrap",
      running: "Open States still running",
      start: "Start Open States bootstrap",
      succeeded: "Open States succeeded",
      wait: "Wait for Open States"
    },
    {
      command: "govinfo:import",
      inspect: "Inspect GovInfo execution",
      next: "Start document processing",
      running: "GovInfo still running",
      start: "Start GovInfo bootstrap",
      succeeded: "GovInfo succeeded",
      wait: "Wait for GovInfo"
    },
    {
      command: "documents:process",
      inspect: "Inspect document execution",
      next: "Start embedding refresh",
      running: "Documents still running",
      start: "Start document processing",
      succeeded: "Documents succeeded",
      wait: "Wait for documents"
    },
    {
      command: "embeddings:run",
      inspect: "Inspect embedding execution",
      next: "Start coverage report",
      running: "Embeddings still running",
      start: "Start embedding refresh",
      succeeded: "Embeddings succeeded",
      wait: "Wait for embeddings"
    },
    {
      command: "coverage:report",
      inspect: "Inspect coverage execution",
      next: "Retain orchestration evidence",
      running: "Coverage still running",
      start: "Start coverage report",
      succeeded: "Coverage succeeded",
      wait: "Wait for coverage"
    }
  ]
  if (starts.length !== expectedPhases.length) {
    throw new Error(`bootstrap-orchestration.json must start ${expectedPhases.length} ordered application jobs`)
  }
  if (workflow.nodes.some((node) => node.type === "n8n-nodes-base.code")) {
    throw new Error("bootstrap-orchestration.json must not embed application logic in Code nodes")
  }
  if (!workflow.nodes.some((node) => node.type === "n8n-nodes-base.manualTrigger")) {
    throw new Error("bootstrap-orchestration.json must remain a manually triggered operation")
  }
  if (workflow.nodes.some((node) => node.type === "n8n-nodes-base.scheduleTrigger")) {
    throw new Error("bootstrap-orchestration.json must not add a schedule before the D2 and D3 gates pass")
  }
  if (workflow.settings?.saveDataSuccessExecution !== "all" || workflow.settings?.saveDataErrorExecution !== "all") {
    throw new Error("bootstrap-orchestration.json must retain successful and failed execution evidence")
  }

  const inputNode = nodeByName(workflow, "Bootstrap inputs")
  const inputs = new Map(
    inputNode.parameters?.assignments?.assignments?.map((assignment) => [assignment.name, assignment.value])
  )
  for (const [name, value] of [
    ["endCongress", "={{ $env.FEDERAL_END_CONGRESS }}"],
    ["openStatesManifestBlob", "manifests/openstates/session-json-2017-onward-2026-08-17.json"],
    ["startCongress", "={{ $env.FEDERAL_START_CONGRESS }}"]
  ]) {
    if (inputs.get(name) !== value) {
      throw new Error(`bootstrap-orchestration.json must expose the bounded ${name} input`)
    }
  }

  for (const phase of expectedPhases) {
    const start = nodeByName(workflow, phase.start)
    const template = JSON.parse(start.parameters.body.slice(1))
    if (template.containers[0]?.args?.[1] !== phase.command) {
      throw new Error(`${phase.start} must invoke ${phase.command}`)
    }
    const wait = nodeByName(workflow, phase.wait)
    if (wait.type !== "n8n-nodes-base.wait" || wait.parameters?.amount !== 30 || wait.parameters?.unit !== "seconds") {
      throw new Error(`${phase.wait} must poll on a bounded 30-second interval`)
    }
    const inspect = nodeByName(workflow, phase.inspect)
    if (
      inspect.parameters?.method === "POST" ||
      !inspect.parameters?.url?.includes(`$('${phase.start}').first().json.id`)
    ) {
      throw new Error(`${phase.inspect} must inspect the exact execution returned by ${phase.start}`)
    }
    assertTargets(workflow, phase.start, 0, [phase.wait])
    assertTargets(workflow, phase.wait, 0, [phase.inspect])
    assertTargets(workflow, phase.inspect, 0, [phase.succeeded])
    assertTargets(workflow, phase.succeeded, 0, [phase.next])
    assertTargets(workflow, phase.succeeded, 1, [phase.running])
    assertTargets(workflow, phase.running, 0, [phase.wait])
    assertTargets(workflow, phase.running, 1, ["Stop failed bootstrap"])
    assertCondition(workflow, phase.succeeded, "Succeeded")
    assertCondition(workflow, phase.running, "Running")
  }

  const summary = nodeByName(workflow, "Retain orchestration evidence")
  const summaryFields = new Set(summary.parameters?.assignments?.assignments?.map((assignment) => assignment.name))
  for (const name of [
    "correlationId",
    "coverageBlobPath",
    "coverageExecutionId",
    "documentExecutionId",
    "embeddingExecutionId",
    "govInfoExecutionId",
    "openStatesExecutionId",
    "status",
    "workflowExecutionId"
  ]) {
    if (!summaryFields.has(name)) {
      throw new Error(`bootstrap-orchestration.json evidence summary omits ${name}`)
    }
  }
}

function nodeByName(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name)
  if (node === undefined) {
    throw new Error(`${workflow.id} omits required node ${name}`)
  }
  return node
}

function assertTargets(workflow, source, output, expected) {
  const targets = workflow.connections?.[source]?.main?.[output]?.map((connection) => connection.node) ?? []
  if (JSON.stringify(targets) !== JSON.stringify(expected)) {
    throw new Error(`${workflow.id} node ${source} output ${output} must connect to ${expected.join(", ")}`)
  }
}

function assertCondition(workflow, name, expected) {
  const conditions = nodeByName(workflow, name).parameters?.conditions?.conditions
  if (!Array.isArray(conditions) || conditions.length !== 1 || conditions[0]?.rightValue !== expected) {
    throw new Error(`${workflow.id} node ${name} must test Azure execution status ${expected}`)
  }
}

process.stdout.write(`${JSON.stringify({ files: files.length, status: "valid" })}\n`)
