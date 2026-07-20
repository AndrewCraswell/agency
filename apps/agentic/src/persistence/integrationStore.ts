import { and, asc, eq } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import {
  IntegrationConnectionStatusSchema,
  IntegrationProviderSchema,
  IntegrationResourceTypeSchema,
  type IntegrationProvider
} from "../integrations/contracts"
import { integrationConnections, integrationResources } from "./schema"

const IntegrationConnectionRecordSchema = createSelectSchema(integrationConnections, {
  provider: IntegrationProviderSchema,
  status: IntegrationConnectionStatusSchema
})
const IntegrationResourceRecordSchema = createSelectSchema(integrationResources, {
  resourceType: IntegrationResourceTypeSchema,
  stale: z
    .number()
    .int()
    .transform((value) => value === 1)
})

export type IntegrationConnectionRecord = z.infer<typeof IntegrationConnectionRecordSchema>
export type IntegrationResourceRecord = z.infer<typeof IntegrationResourceRecordSchema>

export interface IntegrationConnectionStore {
  listConnections(): Promise<IntegrationConnectionRecord[]>
  getConnection(connectionId: string): Promise<IntegrationConnectionRecord | null>
  upsertConnection(input: {
    provider: IntegrationProvider
    providerConfigKey: string
    nangoConnectionId: string
    displayName: string | null
    status: "connected" | "degraded"
    errorCode: string | null
    checkedAt: Date
  }): Promise<IntegrationConnectionRecord>
  updateConnectionHealth(
    connectionId: string,
    status: "connected" | "degraded" | "disconnected",
    errorCode: string | null,
    checkedAt: Date
  ): Promise<void>
  listResources(connectionId: string): Promise<IntegrationResourceRecord[]>
  replaceDiscoveredResources(
    connectionId: string,
    resourceType: "repository" | "team",
    resources: Array<{ externalId: string; name: string }>,
    discoveredAt: Date
  ): Promise<void>
}

type IntegrationDatabase = NodePgDatabase<{
  integrationConnections: typeof integrationConnections
  integrationResources: typeof integrationResources
}>

export class PostgresIntegrationConnectionStore implements IntegrationConnectionStore {
  readonly #database: IntegrationDatabase

  constructor(database: IntegrationDatabase) {
    this.#database = database
  }

  async listConnections(): Promise<IntegrationConnectionRecord[]> {
    const rows = await this.#database
      .select()
      .from(integrationConnections)
      .orderBy(asc(integrationConnections.provider))
    return rows.map((row) => IntegrationConnectionRecordSchema.parse(row))
  }

  async getConnection(connectionId: string): Promise<IntegrationConnectionRecord | null> {
    const rows = await this.#database
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.connectionId, z.uuid().parse(connectionId)))
      .limit(1)
    const row = rows[0]
    return row === undefined ? null : IntegrationConnectionRecordSchema.parse(row)
  }

  async upsertConnection(input: {
    provider: IntegrationProvider
    providerConfigKey: string
    nangoConnectionId: string
    displayName: string | null
    status: "connected" | "degraded"
    errorCode: string | null
    checkedAt: Date
  }): Promise<IntegrationConnectionRecord> {
    const now = input.checkedAt
    const rows = await this.#database
      .insert(integrationConnections)
      .values({
        ...input,
        lastCheckedAt: input.checkedAt,
        disconnectedAt: null,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [integrationConnections.providerConfigKey, integrationConnections.nangoConnectionId],
        set: {
          displayName: input.displayName,
          status: input.status,
          errorCode: input.errorCode,
          lastCheckedAt: input.checkedAt,
          disconnectedAt: null,
          updatedAt: now
        }
      })
      .returning()
    return IntegrationConnectionRecordSchema.parse(rows[0])
  }

  async updateConnectionHealth(
    connectionId: string,
    status: "connected" | "degraded" | "disconnected",
    errorCode: string | null,
    checkedAt: Date
  ): Promise<void> {
    await this.#database
      .update(integrationConnections)
      .set({
        status,
        errorCode,
        lastCheckedAt: checkedAt,
        disconnectedAt: status === "disconnected" ? checkedAt : null,
        updatedAt: checkedAt
      })
      .where(eq(integrationConnections.connectionId, z.uuid().parse(connectionId)))
  }

  async listResources(connectionId: string): Promise<IntegrationResourceRecord[]> {
    const rows = await this.#database
      .select()
      .from(integrationResources)
      .where(eq(integrationResources.connectionId, z.uuid().parse(connectionId)))
      .orderBy(asc(integrationResources.name))
    return rows.map((row) => IntegrationResourceRecordSchema.parse(row))
  }

  async replaceDiscoveredResources(
    connectionIdInput: string,
    resourceType: "repository" | "team",
    resources: Array<{ externalId: string; name: string }>,
    discoveredAt: Date
  ): Promise<void> {
    const connectionId = z.uuid().parse(connectionIdInput)
    await this.#database.transaction(async (transaction) => {
      await transaction
        .update(integrationResources)
        .set({ stale: 1, updatedAt: discoveredAt })
        .where(
          and(eq(integrationResources.connectionId, connectionId), eq(integrationResources.resourceType, resourceType))
        )
      for (const resource of resources) {
        await transaction
          .insert(integrationResources)
          .values({ connectionId, resourceType, ...resource, lastDiscoveredAt: discoveredAt, updatedAt: discoveredAt })
          .onConflictDoUpdate({
            target: [
              integrationResources.connectionId,
              integrationResources.resourceType,
              integrationResources.externalId
            ],
            set: { name: resource.name, stale: 0, lastDiscoveredAt: discoveredAt, updatedAt: discoveredAt }
          })
      }
    })
  }
}
