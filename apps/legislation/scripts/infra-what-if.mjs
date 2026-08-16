import { spawnSync } from "node:child_process"

const environment = process.argv[2] ?? "development"
const shortEnvironment = { development: "dev", production: "prd", staging: "stg" }[environment]
if (shortEnvironment === undefined) {
  throw new Error("Environment must be development, staging, or production")
}

const requiredEnvironment = [
  "CONGRESS_API_KEY",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LEGISLATION_N8N_ENCRYPTION_KEY",
  "LEGISLATION_POSTGRES_ADMIN_PASSWORD",
  "OPENROUTER_API_KEY"
]
const missing = requiredEnvironment.filter((name) => !process.env[name]?.trim())
if (missing.length > 0) {
  throw new Error(`Missing secure what-if inputs: ${missing.join(", ")}`)
}

const parameters = [
  `infra/bicep/environments/${environment}.bicepparam`,
  `postgresAdministratorPassword=${process.env.LEGISLATION_POSTGRES_ADMIN_PASSWORD}`,
  `n8nEncryptionKey=${process.env.LEGISLATION_N8N_ENCRYPTION_KEY}`,
  `congressApiKey=${process.env.CONGRESS_API_KEY}`,
  `openRouterApiKey=${process.env.OPENROUTER_API_KEY}`,
  `langfusePublicKey=${process.env.LANGFUSE_PUBLIC_KEY}`,
  `langfuseSecretKey=${process.env.LANGFUSE_SECRET_KEY}`
]
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
  { encoding: "utf8", stdio: "inherit" }
)
if (result.error !== undefined) {
  throw result.error
}
process.exitCode = result.status ?? 1
