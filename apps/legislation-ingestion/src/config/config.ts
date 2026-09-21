import { z } from "zod"

const optionalSecret = z.string().trim().min(1).optional()
const configSchema = z
  .object({
    backfill: z.object({
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
      storageAccount: optionalSecret
    }),
    database: z.object({
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
      senateVoteBaseUrl: z.url({ protocol: /^https$/ }),
      sourceDirectory: z.string().trim().min(1)
    }),
    logging: z.object({ level: z.enum(["debug", "info", "warn", "error"]) }),
    model: z.object({ apiKey: optionalSecret, baseUrl: z.url({ protocol: /^https$/ }) }),
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
      (config.observability.langfusePublicKey === undefined) !==
      (config.observability.langfuseSecretKey === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Langfuse public and secret keys must be configured together",
        path: ["observability"]
      })
    }
  })

export type LegislationConfig = z.infer<typeof configSchema>

export class ConfigurationError extends Error {
  readonly issues: string[]

  constructor(error: z.ZodError) {
    const issues = error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`)
    super(`Invalid ingestion configuration: ${issues.join("; ")}`)
    this.name = "ConfigurationError"
    this.issues = issues
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): LegislationConfig {
  const result = configSchema.safeParse({
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
      senateVoteBaseUrl: environment.SENATE_VOTE_BASE_URL ?? "https://www.senate.gov/",
      sourceDirectory: environment.LEGISLATION_SOURCE_DIRECTORY ?? ".data/sources"
    },
    logging: { level: environment.LOG_LEVEL ?? "info" },
    model: {
      apiKey: environment.OPENROUTER_API_KEY,
      baseUrl: environment.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
    },
    observability: {
      langfuseBaseUrl: environment.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      langfusePublicKey: environment.LANGFUSE_PUBLIC_KEY,
      langfuseSecretKey: environment.LANGFUSE_SECRET_KEY
    },
    ocr: {
      endpoint: environment.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      maximumAttempts: environment.OCR_MAXIMUM_ATTEMPTS ?? "5"
    }
  })
  if (!result.success) throw new ConfigurationError(result.error)
  return result.data
}
