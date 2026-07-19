import type pg from "pg"
import { z } from "zod"

const RuntimeIdentitySchema = z
  .object({
    access: z.enum(["api", "worker", "reconciler"]),
    name: z.string().regex(/^[a-z0-9-]{1,63}$/u),
    objectId: z.uuid()
  })
  .strict()

const RuntimeIdentitiesSchema = z
  .array(RuntimeIdentitySchema)
  .length(3)
  .superRefine((identities, context) => {
    for (const field of ["access", "name", "objectId"] as const) {
      if (new Set(identities.map((identity) => identity[field])).size !== identities.length) {
        context.addIssue({ code: "custom", message: `Runtime identity ${field} values must be unique` })
      }
    }
  })

type RuntimeIdentity = z.infer<typeof RuntimeIdentitySchema>
type ExistingPrincipal = {
  roleName: string
  objectId: string
  principalType: string
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`
}

export function parseRuntimeIdentities(value: string): RuntimeIdentity[] {
  let input: unknown
  try {
    input = JSON.parse(value)
  } catch (error) {
    throw new Error("POSTGRES_RUNTIME_IDENTITIES_JSON must contain valid JSON", { cause: error })
  }
  return RuntimeIdentitiesSchema.parse(input)
}

async function ensurePrincipal(client: pg.PoolClient, identity: RuntimeIdentity): Promise<void> {
  const result = await client.query<ExistingPrincipal>(
    `select rolename::text as "roleName", objectid as "objectId", principaltype as "principalType"
       from pg_catalog.pgaadauth_list_principals(false)
      where rolename = $1`,
    [identity.name]
  )
  const existing = result.rows[0]
  if (existing === undefined) {
    await client.query("select pg_catalog.pgaadauth_create_principal_with_oid($1, $2, 'service', false, false)", [
      identity.name,
      identity.objectId
    ])
    return
  }
  if (existing.objectId !== identity.objectId || existing.principalType !== "service") {
    throw new Error(`PostgreSQL role ${identity.name} is mapped to a different Microsoft Entra principal`)
  }
}

async function grantApiAccess(client: pg.PoolClient, role: string): Promise<void> {
  await client.query(`grant usage on schema agentic to ${role}`)
  await client.query(`grant select, insert, update on table agentic.workflow_runs to ${role}`)
  await client.query(`grant select, insert on table agentic.runtime_selections to ${role}`)
  await client.query(`grant select on table agentic.workflow_events to ${role}`)
  await client.query(`grant select, insert on table agentic.webhook_deliveries to ${role}`)
}

async function grantWorkerAccess(client: pg.PoolClient, role: string): Promise<void> {
  await client.query(`grant usage on schema agentic, langgraph to ${role}`)
  await client.query(`grant select, insert, update on all tables in schema agentic to ${role}`)
  await client.query(`grant select, insert, update, delete on all tables in schema langgraph to ${role}`)
  await client.query(`grant usage, select on all sequences in schema agentic, langgraph to ${role}`)
}

async function grantReconcilerAccess(client: pg.PoolClient, role: string): Promise<void> {
  await client.query(`grant usage on schema agentic to ${role}`)
  await client.query(`grant select, update on table agentic.webhook_deliveries to ${role}`)
}

export async function bootstrapPostgresRuntimeRoles(
  client: pg.PoolClient,
  identities: RuntimeIdentity[]
): Promise<void> {
  const parsedIdentities = RuntimeIdentitiesSchema.parse(identities)
  const databaseResult = await client.query<{ databaseName: string }>('select current_database() as "databaseName"')
  const databaseName = z.string().min(1).parse(databaseResult.rows[0]?.databaseName)

  await client.query("begin")
  try {
    await client.query(`revoke connect on database ${quoteIdentifier(databaseName)} from public`)
    for (const identity of parsedIdentities) {
      await ensurePrincipal(client, identity)
      const role = quoteIdentifier(identity.name)
      await client.query(`grant connect on database ${quoteIdentifier(databaseName)} to ${role}`)
      if (identity.access === "api") {
        await grantApiAccess(client, role)
      } else if (identity.access === "worker") {
        await grantWorkerAccess(client, role)
      } else {
        await grantReconcilerAccess(client, role)
      }
    }
    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  }
}
