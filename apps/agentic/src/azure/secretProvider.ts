import { DefaultAzureCredential } from "@azure/identity"
import { SecretClient } from "@azure/keyvault-secrets"
import { z } from "zod"

const SecretNameSchema = z.string().regex(/^[0-9A-Za-z-]{1,127}$/u)

export interface SecretProvider {
  provider: "environment" | "azure-key-vault"
  get(name: string): Promise<string>
}

interface SecretClientPort {
  getSecret(name: string): Promise<{ value?: string }>
}

export class EnvironmentSecretProvider implements SecretProvider {
  readonly provider = "environment" as const
  readonly #environment: NodeJS.ProcessEnv

  constructor(environment: NodeJS.ProcessEnv) {
    this.#environment = environment
  }

  async get(name: string): Promise<string> {
    const value = this.#environment[name]
    if (value === undefined || value.length === 0) {
      throw new Error(`Required environment secret ${name} is unavailable`)
    }
    return value
  }
}

export class AzureKeyVaultSecretProvider implements SecretProvider {
  readonly provider = "azure-key-vault" as const
  readonly #client: SecretClientPort
  readonly #cacheTtlMs: number
  readonly #now: () => number
  readonly #cache = new Map<string, { value: string; expiresAt: number }>()

  constructor(client: SecretClientPort, cacheTtlMs = 5 * 60 * 1_000, now: () => number = Date.now) {
    this.#client = client
    this.#cacheTtlMs = z
      .number()
      .int()
      .min(1_000)
      .max(60 * 60 * 1_000)
      .parse(cacheTtlMs)
    this.#now = now
  }

  static fromManagedIdentity(input: {
    vaultUrl: string
    cacheTtlMs?: number
    managedIdentityClientId?: string
  }): AzureKeyVaultSecretProvider {
    const credential = new DefaultAzureCredential(
      input.managedIdentityClientId === undefined ? {} : { managedIdentityClientId: input.managedIdentityClientId }
    )
    const client = new SecretClient(z.url().parse(input.vaultUrl), credential)
    return new AzureKeyVaultSecretProvider(client, input.cacheTtlMs)
  }

  async get(nameInput: string): Promise<string> {
    const name = SecretNameSchema.parse(nameInput)
    const cached = this.#cache.get(name)
    if (cached !== undefined && cached.expiresAt > this.#now()) {
      return cached.value
    }
    const secret = await this.#client.getSecret(name)
    if (secret.value === undefined || secret.value.length === 0) {
      throw new Error(`Azure Key Vault secret ${name} has no enabled value`)
    }
    this.#cache.set(name, { value: secret.value, expiresAt: this.#now() + this.#cacheTtlMs })
    return secret.value
  }
}

const runtimeSecretNames = {
  POSTGRES_API_URL: "postgres-api-url",
  DAYTONA_API_KEY: "daytona-api-key",
  LINEAR_API_KEY: "linear-api-key",
  NANGO_API_KEY: "nango-api-key",
  NANGO_WEBHOOK_SIGNING_KEY: "nango-webhook-signing-key",
  GITHUB_WEBHOOK_SECRET: "github-webhook-secret",
  OPENROUTER_API_KEY: "openrouter-api-key",
  WORKSPACE_SECRET_KEY: "workspace-secret-key"
} as const
export type RuntimeSecretName = keyof typeof runtimeSecretNames
const allRuntimeSecretNames: readonly RuntimeSecretName[] = [
  "POSTGRES_API_URL",
  "DAYTONA_API_KEY",
  "LINEAR_API_KEY",
  "NANGO_API_KEY",
  "NANGO_WEBHOOK_SIGNING_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "OPENROUTER_API_KEY",
  "WORKSPACE_SECRET_KEY"
]

const optionalRuntimeSecretNames = {
  LANGSMITH_API_KEY: "langsmith-api-key"
} as const

export async function resolveRuntimeSecrets(
  environment: NodeJS.ProcessEnv,
  requiredSecretNames: readonly RuntimeSecretName[] = allRuntimeSecretNames
): Promise<NodeJS.ProcessEnv> {
  const provider = z.enum(["environment", "azure-key-vault"]).default("environment").parse(environment.SECRET_PROVIDER)
  if (provider === "environment") {
    return { ...environment }
  }
  const secretProvider = AzureKeyVaultSecretProvider.fromManagedIdentity({
    vaultUrl: z.url().parse(environment.AZURE_KEY_VAULT_URL),
    cacheTtlMs: z.coerce.number().int().min(1_000).optional().parse(environment.AZURE_SECRET_CACHE_TTL_MS),
    ...(environment.AZURE_CLIENT_ID === undefined ? {} : { managedIdentityClientId: environment.AZURE_CLIENT_ID })
  })
  const resolved = { ...environment }
  await Promise.all(
    requiredSecretNames.map(async (environmentName) => {
      if (resolved[environmentName] !== undefined && resolved[environmentName]?.length !== 0) {
        return
      }
      const defaultSecretName = runtimeSecretNames[environmentName]
      const overrideName = environment[`AZURE_SECRET_NAME_${environmentName}`]
      resolved[environmentName] = await secretProvider.get(overrideName ?? defaultSecretName)
    })
  )
  if (environment.LANGSMITH_TRACING === "true") {
    await Promise.all(
      Object.entries(optionalRuntimeSecretNames).map(async ([environmentName, defaultSecretName]) => {
        const overrideName = environment[`AZURE_SECRET_NAME_${environmentName}`]
        resolved[environmentName] = await secretProvider.get(overrideName ?? defaultSecretName)
      })
    )
  }
  return resolved
}
