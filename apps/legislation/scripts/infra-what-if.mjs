import { spawnSync } from "node:child_process"

const environment = process.argv[2] ?? "development"
const shortEnvironment = { development: "dev", production: "prd", staging: "stg" }[environment]
if (shortEnvironment === undefined) {
  throw new Error("Environment must be development, staging, or production")
}

const requiredEnvironment = [
  "CONGRESS_API_KEY",
  "DATABASE_URL",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LEGISLATION_N8N_ENCRYPTION_KEY",
  "OPENROUTER_API_KEY"
]
const missing = requiredEnvironment.filter((name) => !process.env[name]?.trim())
if (missing.length > 0) {
  throw new Error(`Missing secure what-if inputs: ${missing.join(", ")}`)
}

const databaseUrl = new URL(process.env.DATABASE_URL)
if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
  throw new Error("DATABASE_URL must be a PostgreSQL connection URL")
}

const parameters = [`infra/bicep/environments/${environment}.bicepparam`]
const result = spawnSync(
  process.platform === "win32" ? "az.cmd" : "az",
  [
    "deployment",
    "group",
    "what-if",
    "--resource-group",
    `legislation-${shortEnvironment}`,
    "--template-file",
    "infra/bicep/main.bicep",
    "--parameters",
    ...parameters,
    "--only-show-errors"
  ],
  {
    encoding: "utf8",
    stdio: "inherit",
    env: {
      ...process.env,
      LEGISLATION_N8N_DATABASE_HOST: databaseUrl.hostname,
      LEGISLATION_N8N_DATABASE_PORT: databaseUrl.port || "5432",
      LEGISLATION_N8N_DATABASE_NAME: databaseUrl.pathname.slice(1),
      LEGISLATION_N8N_DATABASE_USER: decodeURIComponent(databaseUrl.username),
      LEGISLATION_N8N_DATABASE_PASSWORD: decodeURIComponent(databaseUrl.password)
    }
  }
)
if (result.error !== undefined) {
  throw result.error
}
process.exitCode = result.status ?? 1
