import { join } from "node:path"
import { z } from "zod"
import { createArtifactStoreFactory } from "../azure/artifactStore"
import { resolveRuntimeSecrets } from "../azure/secretProvider"
import { GitHubAppPublisher } from "../github/githubAppPublisher"
import { createLinearClientFromEnvironment } from "../linear/client"
import { createCheckpointRuntime } from "../orchestrator/checkpointRuntime"
import { createWorkflowGraph } from "../orchestrator/graph"
import { workflowArtifactRoot } from "../orchestrator/runtime"
import { ScrumMasterPlanner } from "../orchestrator/scrumMasterPlanner"
import { createControlPlaneRuntime } from "../persistence/controlPlaneRuntime"
import { runWorker } from "../prototype/runner"
import { DurableWebhookRouter } from "../webhooks/router"
import { GitHubWebhookService } from "../webhooks/service"
import { QueuedRunDispatcher } from "./dispatcher"
import { PlanningRunExecutor } from "./planningExecutor"
import { ReviewLoopProviderActions } from "./reviewLoopActions"
import { ReviewLoopExecutor } from "./reviewLoopExecutor"
import { ScrumMasterScheduler } from "./scrumMasterScheduler"
import { createControlPlaneServer } from "./server"
import { ControlPlaneService } from "./service"
import { FileTaskInventoryCache } from "./taskInventoryCache"

const ServerEnvironmentSchema = z.object({
  CONTROL_PLANE_HOST: z.string().default("127.0.0.1"),
  CONTROL_PLANE_PORT: z.coerce.number().int().positive().max(65_535).default(3_000),
  CONTROL_PLANE_WEB_ORIGIN: z.url().default("http://localhost:5173"),
  DAYTONA_API_KEY: z.string().min(1),
  AGENT_REPOSITORY_OWNER: z.string().trim().min(1).default("AndrewCraswell"),
  AGENT_REPOSITORY_NAME: z.string().trim().min(1).default("agency"),
  LINEAR_TEAM_ID: z.string().trim().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),
  GITHUB_WEBHOOK_ASSIGNMENT_LABEL: z.string().trim().min(1).default("agency-agent"),
  GITHUB_APP_BOT_LOGIN: z.string().trim().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1),
  WORKSPACE_SECRET_KEY: z.string().min(32),
  SCRUM_MASTER_MODEL: z.string().trim().min(1).default("openai/gpt-5.6"),
  DISPATCH_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
  SCRUM_MASTER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(30 * 60 * 1_000),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().max(10).default(10)
})

const runtimeEnvironment = await resolveRuntimeSecrets(process.env)
Object.assign(process.env, runtimeEnvironment)
const environment = ServerEnvironmentSchema.parse(runtimeEnvironment)
const artifactStoreFactory = createArtifactStoreFactory(runtimeEnvironment)
await artifactStoreFactory.assertReady()
const runtime = await createControlPlaneRuntime(runtimeEnvironment)
const checkpointRuntime = await createCheckpointRuntime(runtimeEnvironment)
const linear = createLinearClientFromEnvironment(runtimeEnvironment)
const github = new GitHubAppPublisher({
  appId: environment.GITHUB_APP_ID,
  installationId: environment.GITHUB_APP_INSTALLATION_ID,
  privateKey: environment.GITHUB_APP_PRIVATE_KEY.replaceAll("\\n", "\n")
})
const planner = new ScrumMasterPlanner({
  apiKey: environment.OPENROUTER_API_KEY,
  model: environment.SCRUM_MASTER_MODEL
})
const delivery = createWorkflowGraph({
  artifactRoot: workflowArtifactRoot,
  checkpointer: checkpointRuntime.checkpointer,
  controlPlaneStore: runtime.store,
  publisher: github,
  runWorker: async ({ assignment, artifactRoot, signal }) => {
    const githubToken = await github.installationToken()
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
        process.stderr.write(`[workflow:${assignment.runId} +${elapsedSeconds}s] ${message}\n`)
      },
      secrets: { githubToken, modelProviderApiKey: environment.OPENROUTER_API_KEY }
    })
  }
})
const dispatcher = new QueuedRunDispatcher(
  runtime.store,
  new PlanningRunExecutor({
    linear,
    github,
    planner,
    store: runtime.store,
    checkpointer: checkpointRuntime.checkpointer,
    delivery,
    team: environment.LINEAR_TEAM_ID
  }),
  { maxConcurrentRuns: environment.MAX_CONCURRENT_RUNS }
)
const reviewLoop = new ReviewLoopExecutor(
  runtime.store,
  new ReviewLoopProviderActions({
    store: runtime.store,
    github,
    linear,
    artifactRoot: workflowArtifactRoot,
    modelProviderApiKey: environment.OPENROUTER_API_KEY,
    workspaceSecretKey: environment.WORKSPACE_SECRET_KEY,
    artifactStoreFactory
  })
)
const service = new ControlPlaneService(
  linear,
  runtime.store,
  {
    repositoryOwner: environment.AGENT_REPOSITORY_OWNER,
    repositoryName: environment.AGENT_REPOSITORY_NAME
  },
  {
    taskInventoryCache: new FileTaskInventoryCache(
      join(workflowArtifactRoot("control-plane"), "linear-task-inventory.json")
    )
  }
)
const scrumMasterScheduler = new ScrumMasterScheduler(linear, runtime.store, {
  repositoryOwner: environment.AGENT_REPOSITORY_OWNER,
  repositoryName: environment.AGENT_REPOSITORY_NAME
})
const webhookService =
  environment.GITHUB_WEBHOOK_SECRET === undefined
    ? undefined
    : new GitHubWebhookService({
        secret: environment.GITHUB_WEBHOOK_SECRET,
        assignmentLabel: environment.GITHUB_WEBHOOK_ASSIGNMENT_LABEL,
        ...(environment.GITHUB_APP_BOT_LOGIN === undefined ? {} : { botLogin: environment.GITHUB_APP_BOT_LOGIN }),
        store: runtime.webhookStore,
        router: new DurableWebhookRouter(runtime.store)
      })
const server = createControlPlaneServer(service, environment.CONTROL_PLANE_WEB_ORIGIN, webhookService)
process.stdout.write(
  `Control plane providers: database=${runtime.provider}, checkpoints=${checkpointRuntime.provider}, artifacts=${artifactStoreFactory.provider}, secrets=${runtimeEnvironment.SECRET_PROVIDER ?? "environment"}, workspaces=daytona\n`
)
const dispatchTimer = setInterval(() => void dispatcher.dispatchPending(), environment.DISPATCH_INTERVAL_MS)
dispatchTimer.unref()
const dispatchReviews = () => {
  void reviewLoop.dispatchPending().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown review-loop dispatch failure"
    process.stderr.write(`[review-loop] ${message}\n`)
  })
}
const reviewDispatchTimer = setInterval(dispatchReviews, environment.DISPATCH_INTERVAL_MS)
reviewDispatchTimer.unref()
const scheduleScrumMaster = () => {
  void scrumMasterScheduler.schedule().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown scrum-master scheduling failure"
    process.stderr.write(`[scrum-master] ${message}\n`)
  })
}
const scrumMasterTimer = setInterval(scheduleScrumMaster, environment.SCRUM_MASTER_INTERVAL_MS)
scrumMasterTimer.unref()
scheduleScrumMaster()
void dispatcher.dispatchPending()
dispatchReviews()

server.listen(environment.CONTROL_PLANE_PORT, environment.CONTROL_PLANE_HOST, () => {
  process.stdout.write(
    `Control plane listening at http://${environment.CONTROL_PLANE_HOST}:${environment.CONTROL_PLANE_PORT}\n`
  )
})

async function shutdown(): Promise<void> {
  clearInterval(dispatchTimer)
  clearInterval(reviewDispatchTimer)
  clearInterval(scrumMasterTimer)
  server.close()
  await Promise.all([runtime.close(), checkpointRuntime.close()])
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
