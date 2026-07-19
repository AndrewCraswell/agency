import { z } from "zod"

export const WorkerEnvironmentSchema = z.object({
  DAYTONA_API_KEY: z.string().min(1),
  AGENT_REPOSITORY_OWNER: z.string().trim().min(1),
  AGENT_REPOSITORY_NAME: z.string().trim().min(1),
  LINEAR_API_KEY: z.string().min(1),
  LINEAR_TEAM_ID: z.string().trim().min(1),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  WORKSPACE_SECRET_KEY: z.string().min(32),
  SCRUM_MASTER_MODEL: z.string().trim().min(1).default("openai/gpt-5.6"),
  DISPATCH_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
  SCRUM_MASTER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(30 * 60 * 1_000),
  MAX_CONCURRENT_RUNS: z.coerce.number().int().positive().max(10).default(10),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().max(65_535).default(3_001)
})
