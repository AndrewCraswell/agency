import { DefaultAzureCredential } from "@azure/identity"
import type pg from "pg"
import { z } from "zod"

const PostgresEnvironmentSchema = z.object({
  POSTGRES_API_URL: z.string().regex(/^postgres(?:ql)?:\/\//u, "Expected a PostgreSQL connection URL"),
  POSTGRES_PROVIDER: z.enum(["local", "azure"]).default("local"),
  POSTGRES_AUTH_MODE: z.enum(["connection-string", "azure-entra"]).optional(),
  AZURE_CLIENT_ID: z.string().trim().min(1).optional(),
  POSTGRES_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  POSTGRES_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  POSTGRES_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
  POSTGRES_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(60_000),
  POSTGRES_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(60_000)
})

export type PostgresRuntimeConfiguration = {
  provider: "local" | "azure"
  authMode: "connection-string" | "azure-entra"
  connectionString: string
  pool: pg.PoolConfig
}

function serverOptions(environment: z.output<typeof PostgresEnvironmentSchema>): string {
  return [
    `-c statement_timeout=${environment.POSTGRES_STATEMENT_TIMEOUT_MS}`,
    `-c lock_timeout=${environment.POSTGRES_LOCK_TIMEOUT_MS}`,
    `-c idle_in_transaction_session_timeout=${environment.POSTGRES_IDLE_TRANSACTION_TIMEOUT_MS}`
  ].join(" ")
}

export function postgresRuntimeConfiguration(
  environmentInput: NodeJS.ProcessEnv,
  poolMaximum?: number
): PostgresRuntimeConfiguration {
  const environment = PostgresEnvironmentSchema.parse(environmentInput)
  const authMode =
    environment.POSTGRES_AUTH_MODE ?? (environment.POSTGRES_PROVIDER === "azure" ? "azure-entra" : "connection-string")
  const connectionUrl = new URL(environment.POSTGRES_API_URL)
  if (environment.POSTGRES_PROVIDER === "azure") {
    if (!connectionUrl.hostname.endsWith(".postgres.database.azure.com")) {
      throw new Error("Azure PostgreSQL provider requires an Azure Database for PostgreSQL hostname")
    }
    connectionUrl.searchParams.set("sslmode", "verify-full")
  }
  connectionUrl.searchParams.set(
    "connect_timeout",
    String(Math.ceil(environment.POSTGRES_CONNECTION_TIMEOUT_MS / 1_000))
  )
  connectionUrl.searchParams.set("application_name", "agency-agentic")
  connectionUrl.searchParams.set("options", serverOptions(environment))
  const connectionString = connectionUrl.toString()
  const credential =
    authMode === "azure-entra"
      ? new DefaultAzureCredential(
          environment.AZURE_CLIENT_ID === undefined ? {} : { managedIdentityClientId: environment.AZURE_CLIENT_ID }
        )
      : null
  return {
    provider: environment.POSTGRES_PROVIDER,
    authMode,
    connectionString,
    pool: {
      connectionString,
      max: poolMaximum ?? environment.POSTGRES_POOL_MAX,
      connectionTimeoutMillis: environment.POSTGRES_CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: environment.POSTGRES_IDLE_TIMEOUT_MS,
      ...(credential === null
        ? {}
        : {
            password: async () => {
              const token = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default")
              if (token === null) {
                throw new Error("Managed identity did not return an Azure PostgreSQL access token")
              }
              return token.token
            }
          }),
      ...(environment.POSTGRES_PROVIDER === "azure" ? { ssl: { rejectUnauthorized: true } } : {})
    }
  }
}
