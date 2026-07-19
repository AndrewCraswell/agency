import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { createArtifactStoreFactory } from "../azure/artifactStore"
import { resolveRuntimeSecrets } from "../azure/secretProvider"
import { GitHubAppPublisher } from "../github/githubAppPublisher"
import { createControlPlaneRuntime } from "../persistence/controlPlaneRuntime"
import { runWorker } from "../prototype/runner"
import { createCheckpointRuntime } from "./checkpointRuntime"
import { createWorkflowGraph } from "./graph"

const WorkflowEnvironmentSchema = z
  .object({
    DAYTONA_API_KEY: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_INSTALLATION_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    AGENT_REPOSITORY_OWNER: z.string().trim().min(1),
    AGENT_REPOSITORY_NAME: z.string().trim().min(1),
    WORKSPACE_SECRET_KEY: z.string().min(32),
    LANGSMITH_TRACING: z.enum(["true", "false"]).default("false"),
    LANGSMITH_API_KEY: z.string().min(1).optional(),
    LANGSMITH_WORKSPACE_ID: z.uuid().optional(),
    LANGSMITH_PROJECT: z.string().trim().min(1).optional()
  })
  .superRefine((environment, context) => {
    if (environment.LANGSMITH_TRACING !== "true") return
    for (const name of ["LANGSMITH_API_KEY", "LANGSMITH_WORKSPACE_ID", "LANGSMITH_PROJECT"] as const) {
      if (environment[name] === undefined) {
        context.addIssue({ code: "custom", message: `${name} is required when LANGSMITH_TRACING=true`, path: [name] })
      }
    }
  })

const artifactsDirectory =
  process.env.AGENT_ARTIFACT_ROOT ?? fileURLToPath(new URL("../../artifacts/", import.meta.url))

export function workflowArtifactRoot(runId: string): string {
  return join(artifactsDirectory, runId)
}

export async function createLiveWorkflow(environmentInput: NodeJS.ProcessEnv = process.env) {
  const runtimeEnvironment = await resolveRuntimeSecrets(environmentInput)
  Object.assign(process.env, runtimeEnvironment)
  const environment = WorkflowEnvironmentSchema.parse(runtimeEnvironment)
  const artifactStoreFactory = createArtifactStoreFactory(runtimeEnvironment)
  await artifactStoreFactory.assertReady()
  const publisher = new GitHubAppPublisher({
    appId: environment.GITHUB_APP_ID,
    installationId: environment.GITHUB_APP_INSTALLATION_ID,
    privateKey: environment.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n")
  })
  const checkpointRuntime = await createCheckpointRuntime(runtimeEnvironment)
  const controlPlaneRuntime =
    runtimeEnvironment.POSTGRES_API_URL === undefined ? null : await createControlPlaneRuntime(runtimeEnvironment)
  const workflow = createWorkflowGraph({
    artifactRoot: workflowArtifactRoot,
    checkpointer: checkpointRuntime.checkpointer,
    ...(controlPlaneRuntime === null ? {} : { controlPlaneStore: controlPlaneRuntime.store }),
    runWorker: async ({ assignment, artifactRoot, signal }) => {
      const githubToken = await publisher.installationToken()
      const startedAt = Date.now()
      return runWorker({
        assignment,
        approvedRepository: `${environment.AGENT_REPOSITORY_OWNER}/${environment.AGENT_REPOSITORY_NAME}`,
        workspaceSecretKey: environment.WORKSPACE_SECRET_KEY,
        artifactRoot,
        artifactStore: artifactStoreFactory.forRun(assignment.runId, artifactRoot),
        signal,
        cleanupMode: "stop",
        onProgress: (message) => {
          const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000)
          process.stderr.write(`[workflow +${elapsedSeconds}s] ${message}\n`)
        },
        secrets: {
          githubToken,
          modelProviderApiKey: environment.OPENROUTER_API_KEY
        }
      })
    },
    publisher
  })
  return {
    ...workflow,
    checkpointProvider: checkpointRuntime.provider,
    artifactProvider: artifactStoreFactory.provider,
    async close(): Promise<void> {
      await Promise.all([checkpointRuntime.close(), controlPlaneRuntime?.close()])
    }
  }
}
