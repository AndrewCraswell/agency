import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { WorkflowStateSchema, type WorkflowState } from "./state"

export function workflowStatePath(artifactRoot: string): string {
  return join(artifactRoot, "workflow", "state.json")
}

export function cancellationRequestPath(artifactRoot: string): string {
  return join(artifactRoot, "workflow", "cancel.request")
}

export async function writeWorkflowState(artifactRoot: string, state: WorkflowState): Promise<string> {
  const path = workflowStatePath(artifactRoot)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(WorkflowStateSchema.parse(state), null, 2)}\n`, "utf8")
  return path
}

export async function readWorkflowState(artifactRoot: string): Promise<WorkflowState> {
  return WorkflowStateSchema.parse(JSON.parse(await readFile(workflowStatePath(artifactRoot), "utf8")))
}

export async function requestWorkflowCancellation(artifactRoot: string): Promise<string> {
  const path = cancellationRequestPath(artifactRoot)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${new Date().toISOString()}\n`, "utf8")
  return path
}

export async function hasWorkflowCancellationRequest(artifactRoot: string): Promise<boolean> {
  try {
    await access(cancellationRequestPath(artifactRoot))
    return true
  } catch {
    return false
  }
}

export async function clearWorkflowCancellationRequest(artifactRoot: string): Promise<void> {
  await rm(cancellationRequestPath(artifactRoot), { force: true })
}
