import { z } from "zod"

const optionalSecret = z.string().trim().min(1).optional()
const configSchema = z
  .object({
    auth: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("disabled") }),
      z.object({
        apiAudience: z.string().trim().min(1),
        clientId: z.string().trim().min(1),
        issuer: z.url({ protocol: /^https$/ }),
        jwksUrl: z.url({ protocol: /^https$/ }),
        mcpAudience: z.string().trim().min(1),
        mode: z.literal("workos"),
        userSession: z.object({
          clientId: z.string().trim().min(1),
          issuer: z.url({ protocol: /^https$/ }),
          jwksUrl: z.url({ protocol: /^https$/ })
        })
      })
    ]),
    backfill: z.object({
      // Derived Trigger workers are intentionally restricted to one database
      // connection each. This leaves safe headroom below PostgreSQL's
      // 100-connection ceiling even when documents later fan out to 64 shards.
      derivedDatabaseMaxConnections: z.coerce.number().int().min(1).max(1),
      documentHostAcquireTimeoutMs: z.coerce.number().int().min(1_000).max(300_000),
      documentHostDefaultSlots: z.coerce.number().int().min(1).max(8),
      documentHostLeaseMs: z.coerce.number().int().min(30_000).max(600_000)
    }),
    azure: z.object({
      federalSourceContainer: z.string().trim().min(1),
      normalizedDocumentContainer: z.string().trim().min(1),
      reportContainer: z.string().trim().min(1),
      stateSourceContainer: z.string().trim().min(1),
      storageAccount: z.string().trim().min(1).optional()
    }),
    database: z.object({
      apiStatementTimeoutMs: z.coerce.number().int().min(1_000).max(60_000),
      connectionTimeoutMs: z.coerce.number().int().positive(),
      idleTimeoutMs: z.coerce.number().int().positive(),
      maxConnections: z.coerce.number().int().positive(),
      url: z.url({ protocol: /^postgres(?:ql)?$/ })
    }),
    environment: z.enum(["development", "test", "production"]),
    ingestion: z.object({
      congressApiKey: optionalSecret,
      congressApiUrl: z.url({ protocol: /^https$/ }),
      concurrency: z.coerce.number().int().min(1).max(32),
      federalEndCongress: z.coerce.number().int().min(1),
      federalStartCongress: z.coerce.number().int().min(1),
      govInfoApiKey: optionalSecret,
      govInfoApiUrl: z.url({ protocol: /^https$/ }),
      maxAttempts: z.coerce.number().int().min(1).max(10),
      openStatesApiKey: optionalSecret,
      openStatesApiUrl: z.url({ protocol: /^https$/ }),
      requestTimeoutMs: z.coerce.number().int().min(1000).max(300_000),
      sourceDirectory: z.string().trim().min(1)
    }),
    logging: z.object({
      level: z.enum(["debug", "info", "warn", "error"])
    }),
    legalApi: z.object({ allowedOrganizationIds: z.array(z.string().min(1).max(256)).max(1000) }),
    model: z.object({
      apiKey: optionalSecret,
      baseUrl: z.url({ protocol: /^https$/ }),
      researchAnswerModel: optionalSecret
    }),
    observability: z.object({
      langfuseBaseUrl: z.url({ protocol: /^https$/ }),
      langfusePublicKey: optionalSecret,
      langfuseSecretKey: optionalSecret
    }),
    ocr: z.object({
      endpoint: z.url({ protocol: /^https$/ }).optional(),
      maximumAttempts: z.preprocess((value) => {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? Math.min(parsed, 5) : value
      }, z.number().int().min(1).max(5))
    }),
    passageSearch: z.discriminatedUnion("enabled", [
      z.object({ enabled: z.literal(false) }),
      z.object({
        database: z.object({
          apiStatementTimeoutMs: z.coerce.number().int().min(1_000).max(15_000),
          connectionTimeoutMs: z.coerce.number().int().positive(),
          idleTimeoutMs: z.coerce.number().int().positive(),
          maxConnections: z.coerce.number().int().min(1).max(10),
          url: z.url({ protocol: /^postgres(?:ql)?$/ })
        }),
        enabled: z.literal(true),
        rankingGeneration: z.string().trim().min(1).max(128)
      })
    ]),
    security: z.object({
      idempotencyEncryptionKey: optionalSecret,
      webhookSecretEncryptionKey: optionalSecret
    }),
    server: z.object({
      host: z.string().trim().min(1),
      port: z.coerce.number().int().min(1).max(65_535),
      publicApiBaseUrl: z.url({ protocol: /^https?$/ }),
      requestBodyBytes: z.coerce.number().int().min(1024).max(10_485_760),
      shutdownTimeoutMs: z.coerce.number().int().min(1000).max(120_000)
    })
  })
  .superRefine((config, context) => {
    if (config.ingestion.federalStartCongress > config.ingestion.federalEndCongress) {
      context.addIssue({
        code: "custom",
        message: "FEDERAL_START_CONGRESS must not exceed FEDERAL_END_CONGRESS",
        path: ["ingestion", "federalStartCongress"]
      })
    }
    if (
      config.passageSearch.enabled &&
      postgresDatabaseIdentity(config.passageSearch.database.url) === postgresDatabaseIdentity(config.database.url)
    ) {
      context.addIssue({
        code: "custom",
        message: "PASSAGE_SEARCH_DATABASE_URL must identify a separate database",
        path: ["passageSearch", "database", "url"]
      })
    }
    const hasLangfusePublicKey = config.observability.langfusePublicKey !== undefined
    const hasLangfuseSecretKey = config.observability.langfuseSecretKey !== undefined
    if (hasLangfusePublicKey !== hasLangfuseSecretKey) {
      context.addIssue({
        code: "custom",
        message: "Langfuse public and secret keys must be configured together",
        path: ["observability"]
      })
    }
    if (config.environment === "production" && config.security.idempotencyEncryptionKey === undefined) {
      context.addIssue({
        code: "custom",
        message: "LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET is required in production",
        path: ["security", "idempotencyEncryptionKey"]
      })
    }
    if (config.environment === "production" && config.security.webhookSecretEncryptionKey === undefined) {
      context.addIssue({
        code: "custom",
        message: "LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY is required in production",
        path: ["security", "webhookSecretEncryptionKey"]
      })
    }
    if (
      config.security.idempotencyEncryptionKey !== undefined &&
      !isAes256Key(config.security.idempotencyEncryptionKey)
    ) {
      context.addIssue({
        code: "custom",
        message: "LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET must be a base64 or base64url-encoded 32-byte key",
        path: ["security", "idempotencyEncryptionKey"]
      })
    }
    if (
      config.security.webhookSecretEncryptionKey !== undefined &&
      !isAes256Key(config.security.webhookSecretEncryptionKey)
    ) {
      context.addIssue({
        code: "custom",
        message: "LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY must be a base64 or base64url-encoded 32-byte key",
        path: ["security", "webhookSecretEncryptionKey"]
      })
    }
  })

function postgresDatabaseIdentity(value: string): string {
  const url = new URL(value)
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}${url.pathname}`
}

export type LegislationConfig = z.infer<typeof configSchema>

export class ConfigurationError extends Error {
  readonly issues: string[]

  constructor(error: z.ZodError) {
    const issues = error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`)
    super(`Invalid legislation configuration: ${issues.join("; ")}`)
    this.name = "ConfigurationError"
    this.issues = issues
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): LegislationConfig {
  const auth =
    (environment.AUTH_MODE ?? "disabled") === "workos"
      ? {
          apiAudience: environment.WORKOS_API_AUDIENCE,
          clientId: environment.WORKOS_CLIENT_ID,
          issuer: environment.WORKOS_ISSUER,
          jwksUrl: environment.WORKOS_JWKS_URL,
          mcpAudience: environment.WORKOS_MCP_AUDIENCE,
          mode: "workos" as const,
          userSession: {
            clientId: environment.WORKOS_CLIENT_ID,
            issuer: environment.WORKOS_SESSION_ISSUER,
            jwksUrl: environment.WORKOS_SESSION_JWKS_URL
          }
        }
      : { mode: environment.AUTH_MODE ?? "disabled" }
  const passageSearchEnabled = environment.PASSAGE_SEARCH_API_ENABLED ?? "false"
  let passageSearch: unknown
  if (passageSearchEnabled === "true") {
    passageSearch = {
      database: {
        apiStatementTimeoutMs: environment.PASSAGE_SEARCH_API_STATEMENT_TIMEOUT_MS ?? "10000",
        connectionTimeoutMs: environment.PASSAGE_SEARCH_CONNECTION_TIMEOUT_MS ?? "5000",
        idleTimeoutMs: environment.PASSAGE_SEARCH_IDLE_TIMEOUT_MS ?? "30000",
        maxConnections: environment.PASSAGE_SEARCH_MAX_CONNECTIONS ?? "5",
        url: environment.PASSAGE_SEARCH_DATABASE_URL
      },
      enabled: true,
      rankingGeneration: environment.PASSAGE_SEARCH_RANKING_GENERATION
    }
  } else if (passageSearchEnabled === "false") {
    passageSearch = { enabled: false }
  } else {
    passageSearch = { enabled: passageSearchEnabled }
  }
  const result = configSchema.safeParse({
    auth,
    backfill: {
      derivedDatabaseMaxConnections: environment.DERIVED_BACKFILL_DATABASE_MAX_CONNECTIONS ?? "1",
      documentHostAcquireTimeoutMs: environment.DOCUMENT_HOST_ACQUIRE_TIMEOUT_MS ?? "120000",
      documentHostDefaultSlots: environment.DOCUMENT_HOST_DEFAULT_SLOTS ?? "2",
      documentHostLeaseMs: environment.DOCUMENT_HOST_LEASE_MS ?? "90000"
    },
    azure: {
      federalSourceContainer: environment.AZURE_FEDERAL_SOURCE_CONTAINER ?? "federal-sources",
      normalizedDocumentContainer: environment.AZURE_NORMALIZED_DOCUMENT_CONTAINER ?? "normalized-documents",
      reportContainer: environment.AZURE_REPORT_CONTAINER ?? "reports",
      stateSourceContainer: environment.AZURE_STATE_SOURCE_CONTAINER ?? "state-sources",
      storageAccount: environment.AZURE_STORAGE_ACCOUNT
    },
    database: {
      apiStatementTimeoutMs: environment.DATABASE_API_STATEMENT_TIMEOUT_MS ?? "15000",
      connectionTimeoutMs: environment.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
      idleTimeoutMs: environment.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
      maxConnections: environment.DATABASE_MAX_CONNECTIONS ?? "10",
      url: environment.DATABASE_URL ?? "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
    },
    environment: environment.NODE_ENV ?? "development",
    ingestion: {
      congressApiKey: environment.CONGRESS_API_KEY,
      congressApiUrl: environment.CONGRESS_API_URL ?? "https://api.congress.gov/v3",
      concurrency: environment.INGESTION_CONCURRENCY ?? "4",
      federalEndCongress: environment.FEDERAL_END_CONGRESS ?? "119",
      federalStartCongress: environment.FEDERAL_START_CONGRESS ?? "113",
      govInfoApiKey: environment.GOVINFO_API_KEY,
      govInfoApiUrl: environment.GOVINFO_API_URL ?? "https://api.govinfo.gov",
      maxAttempts: environment.INGESTION_MAX_ATTEMPTS ?? "4",
      openStatesApiKey: environment.OPENSTATES_API_KEY,
      openStatesApiUrl: environment.OPENSTATES_API_URL ?? "https://v3.openstates.org",
      requestTimeoutMs: environment.INGESTION_REQUEST_TIMEOUT_MS ?? "30000",
      sourceDirectory: environment.LEGISLATION_SOURCE_DIRECTORY ?? ".data/sources"
    },
    logging: { level: environment.LOG_LEVEL ?? "info" },
    legalApi: {
      allowedOrganizationIds: (environment.LEGISLATION_LEGAL_API_ORGANIZATIONS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    },
    model: {
      apiKey: environment.OPENROUTER_API_KEY,
      baseUrl: environment.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      researchAnswerModel: environment.RESEARCH_ANSWER_MODEL
    },
    observability: {
      langfuseBaseUrl: environment.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      langfusePublicKey: environment.LANGFUSE_PUBLIC_KEY,
      langfuseSecretKey: environment.LANGFUSE_SECRET_KEY
    },
    ocr: {
      endpoint: environment.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      maximumAttempts: environment.OCR_MAXIMUM_ATTEMPTS ?? "5"
    },
    passageSearch,
    security: {
      idempotencyEncryptionKey: environment.LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET,
      webhookSecretEncryptionKey: environment.LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY
    },
    server: {
      host: environment.LEGISLATION_HOST ?? (environment.PORT === undefined ? "127.0.0.1" : "0.0.0.0"),
      port: environment.PORT ?? environment.LEGISLATION_PORT ?? "3100",
      publicApiBaseUrl:
        environment.LEGISLATION_PUBLIC_API_BASE_URL ??
        (environment.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3100"),
      requestBodyBytes: environment.LEGISLATION_REQUEST_BODY_BYTES ?? "1048576",
      shutdownTimeoutMs: environment.LEGISLATION_SHUTDOWN_TIMEOUT_MS ?? "30000"
    }
  })

  if (!result.success) {
    throw new ConfigurationError(result.error)
  }
  return result.data
}

export function decodeIdempotencyEncryptionKey(value: string): Buffer {
  const isBase64 = /^[A-Za-z0-9+/]{43}=?$/.test(value)
  const isBase64Url = /^[A-Za-z0-9_-]{43}=?$/.test(value)
  if (!isBase64 && !isBase64Url) {
    throw new Error("Idempotency encryption key is not valid base64 or base64url.")
  }
  try {
    const decoded = Buffer.from(value, isBase64Url ? "base64url" : "base64")
    const supplied = value.endsWith("=") ? value.slice(0, -1) : value
    const canonical = isBase64Url ? decoded.toString("base64url") : decoded.toString("base64").slice(0, -1)
    if (decoded.byteLength !== 32 || canonical !== supplied) {
      throw new Error("Idempotency encryption key must contain exactly 32 bytes.")
    }
    return decoded
  } catch {
    throw new Error("Idempotency encryption key is not valid base64 or base64url.")
  }
}

function isAes256Key(value: string): boolean {
  try {
    decodeIdempotencyEncryptionKey(value)
    return true
  } catch {
    return false
  }
}
