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
import { DurableWebhookDispatcher } from "../webhooks/service"
import { QueuedRunDispatcher } from "./dispatcher"
import { PlanningRunExecutor } from "./planningExecutor"
import { createProcessHealthServer } from "./processHealth"
import { ReviewLoopProviderActions } from "./reviewLoopActions"
import { ReviewLoopExecutor } from "./reviewLoopExecutor"
import { ScrumMasterScheduler } from "./scrumMasterScheduler"
import { WorkerEnvironmentSchema } from "./workerEnvironment"

const runtimeEnvironment = await resolveRuntimeSecrets(process.env, [
  "POSTGRES_API_URL",
  "DAYTONA_API_KEY",
  "LINEAR_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "OPENROUTER_API_KEY",
  "WORKSPACE_SECRET_KEY"
])
Object.assign(process.env, runtimeEnvironment)
const environment = WorkerEnvironmentSchema.parse(runtimeEnvironment)
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
    return runWorker({
      assignment,
      approvedRepository: `${environment.AGENT_REPOSITORY_OWNER}/${environment.AGENT_REPOSITORY_NAME}`,
      workspaceSecretKey: environment.WORKSPACE_SECRET_KEY,
      artifactRoot,
      artifactStore: artifactStoreFactory.forRun(assignment.runId, artifactRoot),
      signal,
      cleanupMode: "stop",
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
    artifactStoreFactory,
    modelProviderApiKey: environment.OPENROUTER_API_KEY,
    workspaceSecretKey: environment.WORKSPACE_SECRET_KEY
  })
)
const scrumMasterScheduler = new ScrumMasterScheduler(linear, runtime.store, {
  repositoryOwner: environment.AGENT_REPOSITORY_OWNER,
  repositoryName: environment.AGENT_REPOSITORY_NAME
})
const webhookDispatcher = new DurableWebhookDispatcher(runtime.webhookStore, new DurableWebhookRouter(runtime.store))

function reportFailure(component: string, error: unknown): void {
  const message = error instanceof Error ? error.message : `Unknown ${component} failure`
  process.stderr.write(`[${component}] ${message}\n`)
}

const dispatch = () => {
  void Promise.all([
    dispatcher.dispatchPending(),
    reviewLoop.dispatchPending(),
    webhookDispatcher.dispatchPending()
  ]).catch((error: unknown) => reportFailure("dispatch", error))
}
const schedule = () => {
  void scrumMasterScheduler.schedule().catch((error: unknown) => reportFailure("scrum-master", error))
}
const dispatchTimer = setInterval(dispatch, environment.DISPATCH_INTERVAL_MS)
const scrumMasterTimer = setInterval(schedule, environment.SCRUM_MASTER_INTERVAL_MS)
dispatchTimer.unref()
scrumMasterTimer.unref()
dispatch()
schedule()

const healthServer = createProcessHealthServer()
healthServer.listen(environment.WORKER_HEALTH_PORT, "0.0.0.0", () => {
  process.stdout.write(
    `Worker ready on port ${environment.WORKER_HEALTH_PORT}; database=${runtime.provider}; checkpoints=${checkpointRuntime.provider}; artifacts=${artifactStoreFactory.provider}; secrets=${runtimeEnvironment.SECRET_PROVIDER ?? "environment"}; workspaces=daytona\n`
  )
})

async function shutdown(): Promise<void> {
  clearInterval(dispatchTimer)
  clearInterval(scrumMasterTimer)
  healthServer.close()
  await Promise.all([runtime.close(), checkpointRuntime.close()])
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
