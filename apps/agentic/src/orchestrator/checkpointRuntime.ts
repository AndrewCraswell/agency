import { MemorySaver } from "@langchain/langgraph"
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint"
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
import pg from "pg"
import { z } from "zod"
import { postgresRuntimeConfiguration } from "../persistence/postgres"

const CheckpointEnvironmentSchema = z.object({
  POSTGRES_API_URL: z
    .string()
    .regex(/^postgres(?:ql)?:\/\//u, "Expected a PostgreSQL connection URL")
    .optional()
})

export type CheckpointRuntime = {
  checkpointer: BaseCheckpointSaver
  provider: "memory" | "postgres"
  close(): Promise<void>
}

export async function createCheckpointRuntime(
  environmentInput: NodeJS.ProcessEnv = process.env
): Promise<CheckpointRuntime> {
  const environment = CheckpointEnvironmentSchema.parse(environmentInput)
  if (environment.POSTGRES_API_URL === undefined) {
    return {
      checkpointer: new MemorySaver(),
      provider: "memory",
      close: async () => undefined
    }
  }

  const configuration = postgresRuntimeConfiguration(environmentInput)
  const checkpointer =
    configuration.authMode === "azure-entra"
      ? new PostgresSaver(new pg.Pool(configuration.pool), undefined, { schema: "langgraph" })
      : PostgresSaver.fromConnString(configuration.connectionString, { schema: "langgraph" })
  if (configuration.provider === "local") {
    await checkpointer.setup()
  }
  return {
    checkpointer,
    provider: "postgres",
    close: async () => checkpointer.end()
  }
}
