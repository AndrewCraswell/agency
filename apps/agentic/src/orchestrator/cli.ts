import { readFile } from "node:fs/promises"
import { AssignmentSchema } from "../contracts/assignment"
import { createLiveWorkflow, workflowArtifactRoot } from "./runtime"
import {
  clearWorkflowCancellationRequest,
  hasWorkflowCancellationRequest,
  readWorkflowState,
  requestWorkflowCancellation,
  writeWorkflowState
} from "./store"

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function requiredArgument(name: string): string {
  const value = argument(name)
  if (value === undefined) {
    throw new Error(`Missing required argument ${name}`)
  }
  return value
}

const command = process.argv[2]
if (command === "run") {
  const assignmentPath = requiredArgument("--assignment")
  const assignment = AssignmentSchema.parse(JSON.parse(await readFile(assignmentPath, "utf8")))
  const workflow = await createLiveWorkflow()
  const artifactRoot = workflowArtifactRoot(assignment.runId)
  const cancellationWatcher = setInterval(() => {
    void hasWorkflowCancellationRequest(artifactRoot).then((isCancellationRequested) => {
      if (isCancellationRequested) {
        workflow.cancel(assignment.runId)
      }
    })
  }, 250)
  cancellationWatcher.unref()
  let state
  try {
    state = await workflow.invoke(assignment)
  } finally {
    clearInterval(cancellationWatcher)
    try {
      await clearWorkflowCancellationRequest(artifactRoot)
    } finally {
      await workflow.close()
    }
  }
  await writeWorkflowState(artifactRoot, state)
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`)
  process.exitCode = state.terminalStatus === "published" ? 0 : 1
} else if (command === "inspect") {
  const runId = requiredArgument("--run-id")
  const state = await readWorkflowState(workflowArtifactRoot(runId))
  process.stdout.write(`${JSON.stringify(state, null, 2)}\n`)
} else if (command === "cancel") {
  const runId = requiredArgument("--run-id")
  const path = await requestWorkflowCancellation(workflowArtifactRoot(runId))
  process.stdout.write(`${JSON.stringify({ runId, cancellationRequest: path }, null, 2)}\n`)
} else {
  throw new Error(
    "Usage: pnpm workflow run --assignment <path> | pnpm workflow inspect --run-id <uuid> | pnpm workflow cancel --run-id <uuid>"
  )
}
