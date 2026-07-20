import { z } from "zod"

export const INTEGRATION_SCHEMA_VERSION = "2" as const
export const IntegrationProviderSchema = z.enum(["github", "linear"])
export const IntegrationConnectionStatusSchema = z.enum(["connected", "degraded", "disconnected"])
export const IntegrationResourceTypeSchema = z.enum(["repository", "team"])
export const IntegrationResourceCapabilitySchema = z.enum([
  "repository.read",
  "repository.write",
  "pull_request.write",
  "team.read",
  "issue.read",
  "issue.write"
])

export const IntegrationCatalogItemSchema = z
  .object({
    provider: IntegrationProviderSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    capabilities: z.array(z.string().min(1)).min(1)
  })
  .strict()

export const IntegrationResourceSchema = z
  .object({
    resourceType: IntegrationResourceTypeSchema,
    externalId: z.string().min(1),
    name: z.string().min(1),
    capabilities: z.array(IntegrationResourceCapabilitySchema).min(1),
    stale: z.boolean(),
    lastDiscoveredAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const IntegrationConnectionSchema = z
  .object({
    connectionId: z.uuid(),
    provider: IntegrationProviderSchema,
    providerAccount: z.string().min(1).nullable(),
    status: IntegrationConnectionStatusSchema,
    lastSuccessfulSyncAt: z.iso.datetime({ offset: true }).nullable(),
    latestError: z.string().min(1).nullable(),
    lastCheckedAt: z.iso.datetime({ offset: true }).nullable(),
    resourceCounts: z
      .object({
        total: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        stale: z.number().int().nonnegative()
      })
      .strict(),
    capabilities: z.array(IntegrationResourceCapabilitySchema),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    resources: z.array(IntegrationResourceSchema)
  })
  .strict()

export const IntegrationDisconnectImpactSchema = z
  .object({
    connectionId: z.uuid(),
    affectedWorkflowCount: z.number().int().nonnegative(),
    workflows: z.array(
      z
        .object({
          workflowId: z.uuid(),
          name: z.string().min(1),
          usesDraft: z.boolean(),
          usesPublishedVersion: z.boolean()
        })
        .strict()
    )
  })
  .strict()

export const IntegrationSettingsSchema = z
  .object({
    schemaVersion: z.literal(INTEGRATION_SCHEMA_VERSION),
    catalog: z.array(IntegrationCatalogItemSchema),
    connections: z.array(IntegrationConnectionSchema)
  })
  .strict()

export const IntegrationResourceInventoryRequestSchema = z
  .object({ capability: IntegrationResourceCapabilitySchema.optional() })
  .strict()

export const IntegrationResourceInventoryItemSchema = z
  .object({
    connectionId: z.uuid(),
    provider: IntegrationProviderSchema,
    resource: IntegrationResourceSchema
  })
  .strict()

export const IntegrationResourceInventorySchema = z
  .object({
    schemaVersion: z.literal(INTEGRATION_SCHEMA_VERSION),
    resources: z.array(IntegrationResourceInventoryItemSchema)
  })
  .strict()

export const StartAuthorizationRequestSchema = z.object({ provider: IntegrationProviderSchema }).strict()
export const StartReconnectRequestSchema = z.object({ connectionId: z.uuid() }).strict()
export const AuthorizationSessionSchema = z
  .object({
    provider: IntegrationProviderSchema,
    token: z.string().min(1),
    connectLink: z.url(),
    expiresAt: z.iso.datetime({ offset: true })
  })
  .strict()

export const CompleteAuthorizationRequestSchema = z
  .object({
    provider: IntegrationProviderSchema,
    providerConfigKey: z.string().min(1),
    nangoConnectionId: z.string().min(1)
  })
  .strict()

export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>
export type IntegrationResourceCapability = z.infer<typeof IntegrationResourceCapabilitySchema>
