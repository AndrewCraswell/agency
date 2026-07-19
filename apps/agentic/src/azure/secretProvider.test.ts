import { afterEach, describe, expect, it, vi } from "vitest"
import { AzureKeyVaultSecretProvider, EnvironmentSecretProvider, resolveRuntimeSecrets } from "./secretProvider"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("secret providers", () => {
  it("caches Key Vault values only for the configured duration", async () => {
    let now = 1_000
    const getSecret = vi.fn(async () => ({ value: `secret-${getSecret.mock.calls.length}` }))
    const provider = new AzureKeyVaultSecretProvider({ getSecret }, 1_000, () => now)

    await expect(provider.get("github-app-private-key")).resolves.toBe("secret-1")
    await expect(provider.get("github-app-private-key")).resolves.toBe("secret-1")
    now = 2_001
    await expect(provider.get("github-app-private-key")).resolves.toBe("secret-2")
    expect(getSecret).toHaveBeenCalledTimes(2)
  })

  it("does not fall back when an environment secret is absent", async () => {
    const provider = new EnvironmentSecretProvider({})
    await expect(provider.get("LINEAR_API_KEY")).rejects.toThrow("LINEAR_API_KEY")
  })

  it("keeps an explicitly configured environment value", async () => {
    const provider = new EnvironmentSecretProvider({ POSTGRES_API_URL: "postgresql://configured" })
    await expect(provider.get("POSTGRES_API_URL")).resolves.toBe("postgresql://configured")
  })

  it("rejects malformed names and empty Key Vault values", async () => {
    const provider = new AzureKeyVaultSecretProvider({ getSecret: vi.fn(async () => ({})) })

    await expect(provider.get("invalid secret name")).rejects.toThrow()
    await expect(provider.get("linear-api-key")).rejects.toThrow("has no enabled value")
  })

  it("returns an independent environment snapshot when Key Vault is disabled", async () => {
    const environment = { SECRET_PROVIDER: "environment", LINEAR_API_KEY: "configured" }
    const resolved = await resolveRuntimeSecrets(environment, ["LINEAR_API_KEY"])

    expect(resolved).toEqual(environment)
    expect(resolved).not.toBe(environment)
  })

  it("resolves missing and traced secrets with configured Key Vault names", async () => {
    const get = vi.fn(async (name: string) => `value-for-${name}`)
    vi.spyOn(AzureKeyVaultSecretProvider, "fromManagedIdentity").mockReturnValue({ get } as never)

    const resolved = await resolveRuntimeSecrets(
      {
        SECRET_PROVIDER: "azure-key-vault",
        AZURE_KEY_VAULT_URL: "https://example.vault.azure.net",
        AZURE_CLIENT_ID: "client-id",
        AZURE_SECRET_CACHE_TTL_MS: "60000",
        AZURE_SECRET_NAME_LINEAR_API_KEY: "custom-linear-key",
        LANGSMITH_TRACING: "true",
        AZURE_SECRET_NAME_LANGSMITH_API_KEY: "custom-langsmith-key",
        POSTGRES_API_URL: "postgresql://configured"
      },
      ["POSTGRES_API_URL", "LINEAR_API_KEY"]
    )

    expect(resolved.POSTGRES_API_URL).toBe("postgresql://configured")
    expect(resolved.LINEAR_API_KEY).toBe("value-for-custom-linear-key")
    expect(resolved.LANGSMITH_API_KEY).toBe("value-for-custom-langsmith-key")
    expect(get).toHaveBeenCalledTimes(2)
    expect(AzureKeyVaultSecretProvider.fromManagedIdentity).toHaveBeenCalledWith({
      vaultUrl: "https://example.vault.azure.net",
      cacheTtlMs: 60_000,
      managedIdentityClientId: "client-id"
    })
  })
})
