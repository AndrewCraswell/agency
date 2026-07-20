import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { runtimeSelectionFromEnvironment } from "../contracts/runtimeSelection"
import { PostgresControlPlaneStore } from "./controlPlaneStore"
import { PostgresIntegrationConnectionStore } from "./integrationStore"
import { postgresRuntimeConfiguration } from "./postgres"
import * as schema from "./schema"
import { PostgresWebhookDeliveryStore } from "./webhookStore"
import { PostgresWorkflowJournalStore } from "./workflowJournalStore"
import { PostgresWorkflowStore } from "./workflowStore"

export async function createControlPlaneRuntime(environmentInput: NodeJS.ProcessEnv = process.env) {
  const runtimeSelection = runtimeSelectionFromEnvironment(environmentInput)
  const configuration = postgresRuntimeConfiguration(environmentInput)
  const pool = new pg.Pool(configuration.pool)
  try {
    await pool.query("select 1")
  } catch (error) {
    await pool.end()
    throw error
  }
  const database = drizzle(pool, { schema })
  return {
    provider: configuration.provider,
    store: new PostgresControlPlaneStore(database, { runtimeSelection }),
    integrationStore: new PostgresIntegrationConnectionStore(database),
    webhookStore: new PostgresWebhookDeliveryStore(database),
    workflowJournalStore: new PostgresWorkflowJournalStore(database),
    workflowStore: new PostgresWorkflowStore(database),
    async close(): Promise<void> {
      await pool.end()
    }
  }
}
