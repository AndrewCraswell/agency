import { fileURLToPath } from "node:url"
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { z } from "zod"
import { resolveRuntimeSecrets } from "../azure/secretProvider"
import { postgresRuntimeConfiguration } from "./postgres"
import { bootstrapPostgresRuntimeRoles, parseRuntimeIdentities } from "./postgresRoles"

const environment = await resolveRuntimeSecrets(process.env, ["POSTGRES_API_URL"])
const migrationEnvironment = z
  .object({ POSTGRES_RUNTIME_IDENTITIES_JSON: z.string().min(1).optional() })
  .parse(environment)
const configuration = postgresRuntimeConfiguration(environment, 1)
const pool = new pg.Pool(configuration.pool)

try {
  const database = drizzle(pool)
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url))
  await migrate(database, { migrationsFolder, migrationsSchema: "agentic", migrationsTable: "migrations" })
  const checkpointer = new PostgresSaver(pool, undefined, { schema: "langgraph" })
  await checkpointer.setup()

  if (configuration.provider === "azure") {
    const identityInput = z.string().min(1).parse(migrationEnvironment.POSTGRES_RUNTIME_IDENTITIES_JSON)
    const client = await pool.connect()
    try {
      await bootstrapPostgresRuntimeRoles(client, parseRuntimeIdentities(identityInput))
    } finally {
      client.release()
    }
  }
  process.stdout.write("Applied agentic and LangGraph migrations and provisioned runtime roles.\n")
} finally {
  await pool.end()
}
