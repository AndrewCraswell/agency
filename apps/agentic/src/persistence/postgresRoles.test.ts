import { describe, expect, it, vi } from "vitest"
import { bootstrapPostgresRuntimeRoles, parseRuntimeIdentities } from "./postgresRoles"

const identities: Parameters<typeof bootstrapPostgresRuntimeRoles>[1] = [
  {
    access: "api",
    name: "agentic-production-api-id",
    objectId: "d55dd61a-725c-4601-b233-d9bf7ac6c133"
  },
  {
    access: "worker",
    name: "agentic-production-worker-id",
    objectId: "f5c27312-d7aa-408a-af91-994a3e1b3f95"
  },
  {
    access: "reconciler",
    name: "agentic-production-reconciler-id",
    objectId: "7d7c23d7-6dde-4fa1-85d0-504cefc9e87e"
  }
]

describe("parseRuntimeIdentities", () => {
  it("parses the three distinct runtime access identities", () => {
    expect(parseRuntimeIdentities(JSON.stringify(identities))).toEqual(identities)
  })

  it("rejects duplicate access scopes", () => {
    const duplicate = identities.map((identity, index) => (index === 2 ? { ...identity, access: "worker" } : identity))
    expect(() => parseRuntimeIdentities(JSON.stringify(duplicate))).toThrow(
      "Runtime identity access values must be unique"
    )
  })

  it("rejects malformed identity JSON", () => {
    expect(() => parseRuntimeIdentities("not-json")).toThrow("POSTGRES_RUNTIME_IDENTITIES_JSON must contain valid JSON")
  })
})

describe("bootstrapPostgresRuntimeRoles", () => {
  it("creates missing principals and grants each bounded access profile", async () => {
    const queries: Array<{ text: string; values: unknown[] | undefined }> = []
    const query = vi.fn(async (text: string, values?: unknown[]) => {
      queries.push({ text, values })
      if (text.includes("current_database")) {
        return { rows: [{ databaseName: "agentic" }] }
      }
      if (text.includes("pgaadauth_list_principals")) {
        return { rows: [] }
      }
      return { rows: [] }
    })

    await bootstrapPostgresRuntimeRoles({ query } as never, identities)

    expect(queries.map(({ text }) => text)).toEqual(
      expect.arrayContaining([
        "begin",
        "commit",
        'grant select, insert, update on table agentic.workflow_runs to "agentic-production-api-id"',
        'grant select, insert, update on all tables in schema agentic to "agentic-production-worker-id"',
        'grant select, update on table agentic.webhook_deliveries to "agentic-production-reconciler-id"'
      ])
    )
    expect(queries.filter(({ text }) => text.includes("pgaadauth_create_principal_with_oid"))).toHaveLength(3)
  })

  it("keeps a matching principal and rolls back a mismatched principal", async () => {
    const matchingQuery = vi.fn(async (text: string, values?: unknown[]) => {
      if (text.includes("current_database")) {
        return { rows: [{ databaseName: "agentic" }] }
      }
      if (text.includes("pgaadauth_list_principals")) {
        const identity = identities.find(({ name }) => name === values?.[0])
        return {
          rows:
            identity === undefined
              ? []
              : [{ roleName: identity.name, objectId: identity.objectId, principalType: "service" }]
        }
      }
      return { rows: [] }
    })

    await bootstrapPostgresRuntimeRoles({ query: matchingQuery } as never, identities)

    expect(matchingQuery).not.toHaveBeenCalledWith(
      expect.stringContaining("pgaadauth_create_principal_with_oid"),
      expect.anything()
    )

    const mismatchedQuery = vi.fn(async (text: string) => {
      if (text.includes("current_database")) {
        return { rows: [{ databaseName: "agentic" }] }
      }
      if (text.includes("pgaadauth_list_principals")) {
        return { rows: [{ roleName: identities[0]?.name, objectId: identities[0]?.objectId, principalType: "user" }] }
      }
      return { rows: [] }
    })

    await expect(bootstrapPostgresRuntimeRoles({ query: mismatchedQuery } as never, identities)).rejects.toThrow(
      "mapped to a different Microsoft Entra principal"
    )
    expect(mismatchedQuery).toHaveBeenCalledWith("rollback")
    expect(mismatchedQuery).not.toHaveBeenCalledWith("commit")
  })
})
