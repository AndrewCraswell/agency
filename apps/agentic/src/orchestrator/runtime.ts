import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { GitHubAppPublisher } from "../github/githubAppPublisher"
import { runPhase1 } from "../prototype/runner"
import { createPhase2Graph } from "./graph"

const Phase2EnvironmentSchema = z.object({
  DAYTONA_API_KEY: z.string().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1)
})

const artifactsDirectory = fileURLToPath(new URL("../../artifacts/", import.meta.url))

export function phase2ArtifactRoot(runId: string): string {
  return join(artifactsDirectory, runId)
}

export function createLivePhase2Workflow(environmentInput: NodeJS.ProcessEnv = process.env) {
  const environment = Phase2EnvironmentSchema.parse(environmentInput)
  const publisher = new GitHubAppPublisher({
    appId: environment.GITHUB_APP_ID,
    installationId: environment.GITHUB_APP_INSTALLATION_ID,
    privateKey: environment.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n")
  })
  return createPhase2Graph({
    artifactRoot: phase2ArtifactRoot,
    runWorker: async ({ assignment, artifactRoot, signal }) => {
      const githubToken = await publisher.installationToken()
      const startedAt = Date.now()
      return runPhase1({
        assignment,
        artifactRoot,
        signal,
        cleanupMode: "stop",
        onProgress: (message) => {
          const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000)
          process.stderr.write(`[phase-2 +${elapsedSeconds}s] ${message}\n`)
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
