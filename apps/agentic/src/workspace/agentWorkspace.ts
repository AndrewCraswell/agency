import { z } from "zod"

const IsoTimestampSchema = z.iso.datetime({ offset: true })

export const ProviderWorkspaceHandleSchema = z
  .object({
    schemaVersion: z.literal("1"),
    provider: z.enum(["daytona", "azure"]),
    workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u),
    lifecycleState: z.enum(["creating", "running", "stopped", "archived", "deleted", "failed"]),
    labels: z.record(z.string(), z.string()),
    createdAt: IsoTimestampSchema.nullable(),
    lastActivityAt: IsoTimestampSchema.nullable()
  })
  .strict()

export const ExecutionHandleSchema = z
  .object({
    schemaVersion: z.literal("1"),
    provider: z.enum(["daytona", "azure"]),
    workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u),
    executionId: z.string().min(1),
    status: z.enum(["running", "completed", "failed", "cancelled", "timed_out"]),
    startedAt: IsoTimestampSchema,
    endedAt: IsoTimestampSchema.nullable()
  })
  .strict()

export type ProviderWorkspaceHandle = z.infer<typeof ProviderWorkspaceHandleSchema>
export type ExecutionHandle = z.infer<typeof ExecutionHandleSchema>

export type WorkspaceCreateOptions = {
  image: string
  resources: {
    cpu: number
    memory: number
    disk: number
  }
  labels: Readonly<Record<string, string>>
  retention: {
    autoArchiveMinutes: number
    autoDeleteMinutes: number
  }
  environment?: Readonly<Record<string, string>>
  createTimeoutMs: number
}

export type WorkspaceExecutionOptions = {
  executionId: string
  command: string
  timeoutMs: number
}

export type WorkspaceCommandOptions = {
  commandId: string
  command: string
  workingDirectory: string
  environment?: Readonly<Record<string, string>>
  timeoutMs: number
}

export type WorkspaceCommandResult = {
  exitCode: number | null
  output: string
  timedOut: boolean
}

export type AgentWorkspace = {
  create(options: WorkspaceCreateOptions): Promise<ProviderWorkspaceHandle>
  start(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle>
  execute(handle: ProviderWorkspaceHandle, options: WorkspaceExecutionOptions): Promise<ExecutionHandle>
  executeCommand(handle: ProviderWorkspaceHandle, options: WorkspaceCommandOptions): Promise<WorkspaceCommandResult>
  upload(handle: ProviderWorkspaceHandle, content: Uint8Array, remotePath: string, timeoutMs: number): Promise<void>
  download(handle: ProviderWorkspaceHandle, remotePath: string, timeoutMs: number): Promise<Uint8Array>
  stop(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle>
  archive(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle>
  destroy(handle: ProviderWorkspaceHandle, timeoutMs: number): Promise<ProviderWorkspaceHandle>
}
