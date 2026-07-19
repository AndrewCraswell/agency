import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { GitHubAppPublisher } from "../github/githubAppPublisher"
import { runWorker } from "../prototype/runner"
import { createWorkflowGraph } from "./graph"

const WorkflowEnvironmentSchema = z.object({
  DAYTONA_API_KEY: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1)
})

const artifactsDirectory = fileURLToPath(new URL("../../artifacts/", import.meta.url))

export function workflowArtifactRoot(runId: string): string {
  return join(artifactsDirectory, runId)
}

export function createLiveWorkflow(environmentInput: NodeJS.ProcessEnv = process.env) {
  const environment = WorkflowEnvironmentSchema.parse(environmentInput)
  const publisher = new GitHubAppPublisher({
    appId: environment.GITHUB_APP_ID,
    installationId: environment.GITHUB_APP_INSTALLATION_ID,
    privateKey: environment.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n")
  })
  return createWorkflowGraph({
    artifactRoot: workflowArtifactRoot,
    runWorker: async ({ assignment, artifactRoot, signal }) => {
      const githubToken = await publisher.installationToken()
      const startedAt = Date.now()
      return runWorker({
        assignment,
        artifactRoot,
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
}
