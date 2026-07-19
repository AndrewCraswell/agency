import { join } from "node:path"
import { z } from "zod"
import { resolveRuntimeSecrets } from "../azure/secretProvider"
import { createLinearClientFromEnvironment } from "../linear/client"
import { workflowArtifactRoot } from "../orchestrator/runtime"
import { createControlPlaneRuntime } from "../persistence/controlPlaneRuntime"
import { DurableWebhookRouter } from "../webhooks/router"
import { GitHubWebhookService } from "../webhooks/service"
import { createControlPlaneServer } from "./server"
import { ControlPlaneService } from "./service"
import { FileTaskInventoryCache } from "./taskInventoryCache"

const ApiEnvironmentSchema = z.object({
  CONTROL_PLANE_HOST: z.string().default("0.0.0.0"),
  CONTROL_PLANE_PORT: z.coerce.number().int().positive().max(65_535).default(3_000),
  CONTROL_PLANE_WEB_ORIGIN: z.url(),
  AGENT_REPOSITORY_OWNER: z.string().trim().min(1),
  AGENT_REPOSITORY_NAME: z.string().trim().min(1),
  LINEAR_API_KEY: z.string().min(1),
  LINEAR_TEAM_ID: z.string().trim().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_WEBHOOK_ASSIGNMENT_LABEL: z.string().trim().min(1).default("agency-agent"),
  GITHUB_APP_BOT_LOGIN: z.string().trim().min(1).optional()
})

const runtimeEnvironment = await resolveRuntimeSecrets(process.env, [
  "POSTGRES_API_URL",
  "LINEAR_API_KEY",
  "GITHUB_WEBHOOK_SECRET"
])
const environment = ApiEnvironmentSchema.parse(runtimeEnvironment)
const runtime = await createControlPlaneRuntime(runtimeEnvironment)
const linear = createLinearClientFromEnvironment(runtimeEnvironment)
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
const webhookService = new GitHubWebhookService({
  secret: environment.GITHUB_WEBHOOK_SECRET,
  assignmentLabel: environment.GITHUB_WEBHOOK_ASSIGNMENT_LABEL,
  ...(environment.GITHUB_APP_BOT_LOGIN === undefined ? {} : { botLogin: environment.GITHUB_APP_BOT_LOGIN }),
  store: runtime.webhookStore,
  router: new DurableWebhookRouter(runtime.store)
})
const server = createControlPlaneServer(service, environment.CONTROL_PLANE_WEB_ORIGIN, webhookService)

server.listen(environment.CONTROL_PLANE_PORT, environment.CONTROL_PLANE_HOST, () => {
  process.stdout.write(
    `API listening at http://${environment.CONTROL_PLANE_HOST}:${environment.CONTROL_PLANE_PORT}; database=${runtime.provider}; secrets=${runtimeEnvironment.SECRET_PROVIDER ?? "environment"}\n`
  )
})

async function shutdown(): Promise<void> {
  server.close()
  await runtime.close()
}

process.once("SIGINT", () => void shutdown())
process.once("SIGTERM", () => void shutdown())
