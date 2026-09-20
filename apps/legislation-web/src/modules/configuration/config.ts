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
        mode: z.literal("workos"),
        userSession: z.object({
          clientId: z.string().trim().min(1),
          issuer: z.url({ protocol: /^https$/ }),
          jwksUrl: z.url({ protocol: /^https$/ })
        })
      })
    ]),
    database: z.object({
      apiStatementTimeoutMs: z.coerce.number().int().min(1_000).max(60_000),
      connectionTimeoutMs: z.coerce.number().int().positive(),
      directUrl: z.url({ protocol: /^postgres(?:ql)?$/ }).optional(),
      idleTimeoutMs: z.coerce.number().int().positive(),
      maxConnections: z.coerce.number().int().positive(),
      url: z.url({ protocol: /^postgres(?:ql)?$/ })
    }),
    environment: z.enum(["development", "test", "production"]),
    geocodio: z.object({
      apiKey: optionalSecret,
      baseUrl: z.url({ protocol: /^https$/ }).refine((value) => {
        const url = new URL(value)
        return !url.username && !url.password && !url.search && !url.hash
      }, "Geocodio base URL must not contain credentials, a query, or a fragment")
    }),
    logging: z.object({
      level: z.enum(["debug", "info", "warn", "error"])
    }),
    legalApi: z.object({ allowedOrganizationIds: z.array(z.string().min(1).max(256)).max(1000) }),
    model: z.object({
      apiKey: optionalSecret,
      baseUrl: z.url({ protocol: /^https$/ }),
      embeddingTimeoutMs: z.coerce.number().int().min(1).max(300_000),
      generationTimeoutMs: z.coerce.number().int().min(1).max(300_000),
      rerankTimeoutMs: z.coerce.number().int().min(1).max(300_000),
      researchAnswerModel: optionalSecret
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
      publicApiBaseUrl: z.url({ protocol: /^https?$/ }),
      requestBodyBytes: z.coerce.number().int().min(1024).max(10_485_760)
    })
  })
  .superRefine((config, context) => {
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

export function loadConfig(environment: Readonly<Record<string, string | undefined>> = process.env): LegislationConfig {
  const auth =
    (environment.AUTH_MODE ?? "disabled") === "workos"
      ? {
          apiAudience: environment.WORKOS_API_AUDIENCE,
          clientId: environment.WORKOS_CLIENT_ID,
          issuer: environment.WORKOS_ISSUER,
          jwksUrl: environment.WORKOS_JWKS_URL,
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
    database: {
      apiStatementTimeoutMs: environment.DATABASE_API_STATEMENT_TIMEOUT_MS ?? "15000",
      connectionTimeoutMs: environment.DATABASE_CONNECTION_TIMEOUT_MS ?? "10000",
      directUrl: environment.DATABASE_DIRECT_URL?.trim() || undefined,
      idleTimeoutMs: environment.DATABASE_IDLE_TIMEOUT_MS ?? "30000",
      maxConnections: environment.DATABASE_MAX_CONNECTIONS ?? "10",
      url: environment.DATABASE_URL ?? "postgresql://legislation:legislation@127.0.0.1:55432/legislation"
    },
    environment: environment.NODE_ENV ?? "development",
    geocodio: {
      apiKey: environment.GEOCODIO_API_KEY?.trim() || undefined,
      baseUrl: environment.GEOCODIO_BASE_URL?.trim() || "https://api.geocod.io/v2"
    },
    logging: { level: environment.LOG_LEVEL ?? "info" },
    legalApi: {
      allowedOrganizationIds: (environment.LEGISLATION_LEGAL_API_ORGANIZATIONS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    },
    model: {
      apiKey: environment.OPENROUTER_API_KEY?.trim() || undefined,
      baseUrl: environment.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      embeddingTimeoutMs: environment.OPENROUTER_EMBEDDING_TIMEOUT_MS ?? "30000",
      generationTimeoutMs: environment.OPENROUTER_GENERATION_TIMEOUT_MS ?? "30000",
      rerankTimeoutMs: environment.OPENROUTER_RERANK_TIMEOUT_MS ?? "30000",
      researchAnswerModel: environment.RESEARCH_ANSWER_MODEL
    },
    passageSearch,
    security: {
      idempotencyEncryptionKey: environment.LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET,
      webhookSecretEncryptionKey: environment.LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY
    },
    server: {
      publicApiBaseUrl:
        environment.LEGISLATION_PUBLIC_API_BASE_URL ??
        (environment.NODE_ENV === "production" ? undefined : "http://127.0.0.1:3100"),
      requestBodyBytes: environment.LEGISLATION_REQUEST_BODY_BYTES ?? "1048576"
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
