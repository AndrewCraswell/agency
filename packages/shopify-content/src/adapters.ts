import { z } from "zod"
import type { AdminClient } from "./client.ts"
import type { AdapterRegistry, InstalledResource, ResourceAdapter } from "./installer.ts"
import * as queries from "./queries.ts"
import {
  assignmentSchema,
  definitionSchema,
  entrySchema,
  fieldDefinitionSchema,
  menuSchema,
  pageSchema,
  remoteSchema,
  resultSchema
} from "./schemas.ts"
import { storefrontAdapters } from "./storefront-resources.ts"

const object = z.record(z.string(), z.unknown())
const connection = z.object({
  resources: z.object({ nodes: z.array(remoteSchema), pageInfo: z.object({ hasNextPage: z.boolean() }) })
})

export function installedResource(input: unknown, kind: string): InstalledResource {
  const resource = remoteSchema.parse(input)
  let url: string | undefined
  if (kind === "page") {
    url = `/pages/${z.string().parse(resource.handle)}`
  }
  if (kind === "metaobject" && resource.definition) {
    const definition = z
      .object({
        capabilities: z.object({
          onlineStore: z
            .object({ enabled: z.boolean(), data: z.object({ urlHandle: z.string() }).nullable() })
            .nullable()
        })
      })
      .parse(resource.definition)
    const online = definition.capabilities.onlineStore
    if (online?.enabled && online.data) {
      url = `/pages/${online.data.urlHandle}/${z.string().parse(resource.handle)}`
    }
  }
  return { id: resource.id, url, state: resource }
}

export async function mutate(client: AdminClient, query: string, variables: Record<string, unknown>, kind: string) {
  const result = resultSchema.parse(await client(query, variables, true)).result
  if (result.userErrors.length) {
    throw new Error(result.userErrors.map((error) => error.message).join("; "))
  }
  if (!result.resource) {
    throw new Error("Shopify returned no resource.")
  }
  return installedResource(result.resource, kind)
}

function validationsMatch(expected: { name: string; value: unknown }[], actual: unknown) {
  const received = z.array(z.object({ name: z.string(), value: z.string() })).parse(actual ?? [])
  return expected.every((wanted) => received.some((item) => item.name === wanted.name && item.value === wanted.value))
}

export function definitionConflict(existing: InstalledResource, input: Record<string, unknown>) {
  const desired = definitionSchema.parse(input)
  const remote = z
    .object({
      displayNameKey: z.string().nullable(),
      access: z.object({ storefront: z.string() }),
      capabilities: z.record(z.string(), z.unknown()),
      fieldDefinitions: z.array(
        z.object({
          key: z.string(),
          required: z.boolean(),
          type: z.object({ name: z.string() }),
          validations: z.unknown()
        })
      )
    })
    .parse(existing.state)
  if (remote.access.storefront !== desired.access.storefront) {
    return "Definition is not available to the storefront."
  }
  if (desired.displayNameKey && remote.displayNameKey !== desired.displayNameKey) {
    return "Definition display-name field differs."
  }
  for (const field of desired.fieldDefinitions) {
    const found = remote.fieldDefinitions.find((candidate) => candidate.key === field.key)
    if (
      !found ||
      found.type.name !== field.type ||
      found.required !== (field.required ?? false) ||
      !validationsMatch(field.validations ?? [], found.validations)
    ) {
      return `Incompatible definition field: ${field.key}.`
    }
  }
  for (const field of remote.fieldDefinitions) {
    if (field.required && !desired.fieldDefinitions.some((wanted) => wanted.key === field.key)) {
      return `Unexpected required field: ${field.key}.`
    }
  }
  for (const [key, capability] of Object.entries(desired.capabilities ?? {})) {
    const found = object.parse(remote.capabilities[key] ?? {})
    if (found.enabled !== capability.enabled) {
      return `Incompatible capability: ${key}.`
    }
    if (key === "onlineStore" && "data" in capability && capability.data && "urlHandle" in capability.data) {
      if (object.parse(found.data ?? {}).urlHandle !== capability.data.urlHandle) {
        return "Chart URL prefix differs."
      }
    }
  }
  return undefined
}

export function createResourceAdapters(client: AdminClient): AdapterRegistry {
  const single = async (query: string, variables: Record<string, unknown>, kind: string) => {
    const response = z.object({ resource: remoteSchema.nullable() }).parse(await client(query, variables))
    return response.resource ? installedResource(response.resource, kind) : undefined
  }
  const findHandle = async (query: string, handle: string, kind: string) => {
    const response = connection.parse(await client(query, { query: `handle:${handle}` })).resources
    if (response.pageInfo.hasNextPage || response.nodes.length > 1) {
      throw new Error(`Ambiguous ${kind} handle: ${handle}.`)
    }
    const resource = response.nodes[0]
    if (resource && resource.handle !== handle) {
      throw new Error(`Shopify returned a different ${kind} handle for ${handle}.`)
    }
    return resource ? installedResource(resource, kind) : undefined
  }
  const createWithHandle = async (query: string, variables: Record<string, unknown>, kind: string, handle: string) => {
    const result = await mutate(client, query, variables, kind)
    if (object.parse(result.state).handle !== handle) {
      throw new Error(`Shopify changed the requested handle ${handle}; inspect the created resource before retrying.`)
    }
    return result
  }
  const findMenu = async (handle: string) => {
    let after: string | undefined
    let match: InstalledResource | undefined
    const seen = new Set<string>()
    const schema = z.object({
      resources: z.object({
        nodes: z.array(remoteSchema.extend({ handle: z.string() })),
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable().optional() })
      })
    })
    while (true) {
      const result = schema.parse(await client(queries.menusQuery, { after })).resources
      for (const menu of result.nodes) {
        if (menu.handle !== handle) {
          continue
        }
        if (match) {
          throw new Error(`Ambiguous menu handle: ${handle}.`)
        }
        match = installedResource(menu, "menu")
      }
      if (!result.pageInfo.hasNextPage) {
        return match
      }
      const cursor = result.pageInfo.endCursor
      if (!cursor || seen.has(cursor)) {
        throw new Error("Menu pagination did not advance.")
      }
      seen.add(cursor)
      after = cursor
    }
  }
  const entryInput = (data: Record<string, unknown>) => {
    const parsed = entrySchema.parse(data)
    const fields = Object.entries(parsed.fields).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value)
    }))
    return {
      type: parsed.type,
      handle: parsed.handle,
      fields,
      ...(parsed.status ? { capabilities: { publishable: { status: parsed.status } } } : {})
    }
  }
  const metaobject: ResourceAdapter = {
    validate: (data) => {
      entrySchema.parse(data)
    },
    identity: (data) => `${data.type}/${data.handle}`,
    find: (data) => single(queries.entryQuery, { handle: { type: data.type, handle: data.handle } }, "metaobject"),
    create: (data) =>
      createWithHandle(queries.entryCreate, { input: entryInput(data) }, "metaobject", String(data.handle)),
    replace: (existing, data) => {
      const { type: _type, ...input } = entryInput(data)
      return mutate(client, queries.entryUpdate, { id: existing.id, input }, "metaobject")
    }
  }
  return {
    ...storefrontAdapters(client),
    "metaobject-definition": {
      validate: (data) => {
        definitionSchema.parse(data)
      },
      identity: (data) => String(data.type),
      find: (data) => single(queries.definitionQuery, { type: data.type }, "definition"),
      conflict: definitionConflict,
      create: (data) => mutate(client, queries.definitionCreate, { input: definitionSchema.parse(data) }, "definition")
    },
    "product-metafield-definition": {
      validate: (data) => {
        fieldDefinitionSchema.parse(data)
      },
      identity: (data) => `${data.namespace}.${data.key}`,
      find: async (data) => {
        const result = connection.parse(
          await client(queries.fieldDefinitionQuery, { namespace: data.namespace, key: data.key })
        ).resources
        if (result.nodes.length > 1 || result.pageInfo.hasNextPage) {
          throw new Error("Ambiguous product metafield definition.")
        }
        return result.nodes[0] ? installedResource(result.nodes[0], "definition") : undefined
      },
      conflict: (existing, data) => {
        const desired = fieldDefinitionSchema.parse(data)
        const found = z.object({ type: z.object({ name: z.string() }), validations: z.unknown() }).parse(existing.state)
        if (found.type.name !== desired.type || !validationsMatch(desired.validations ?? [], found.validations)) {
          return "Incompatible product metafield definition."
        }
        return undefined
      },
      create: (data) =>
        mutate(client, queries.fieldDefinitionCreate, { input: fieldDefinitionSchema.parse(data) }, "definition")
    },
    metaobject,
    page: {
      validate: (data) => {
        pageSchema.parse(data)
      },
      identity: (data) => String(data.handle),
      find: (data) => findHandle(queries.pagesQuery, String(data.handle), "page"),
      create: (data) =>
        createWithHandle(queries.pageCreate, { input: pageSchema.parse(data) }, "page", String(data.handle)),
      replace: (existing, data) =>
        mutate(client, queries.pageUpdate, { id: existing.id, input: pageSchema.parse(data) }, "page")
    },
    menu: {
      validate: (data) => {
        const parsed = menuSchema.parse(data)
        const check = (items: typeof parsed.items, depth: number) => {
          if (depth > 3 && items.length) {
            throw new Error("Shopify menus support at most three levels.")
          }
          for (const item of items) {
            if (item.type === "HTTP" && !item.url) {
              throw new Error("HTTP menu links need a URL.")
            }
            if (typeof item.url === "string" && !/^\/(?!\/)|^https?:\/\//.test(item.url)) {
              throw new Error("Menu URLs must be relative storefront paths or HTTP(S) URLs.")
            }
            if (["PAGE", "COLLECTION", "PRODUCT", "BLOG", "ARTICLE"].includes(item.type) && !item.resourceId) {
              throw new Error(`${item.type} menu links need a resource reference.`)
            }
            check(item.items ?? [], depth + 1)
          }
        }
        check(parsed.items, 1)
      },
      identity: (data) => String(data.handle),
      find: (data) => findMenu(String(data.handle)),
      create: (data) => createWithHandle(queries.menuCreate, menuSchema.parse(data), "menu", String(data.handle)),
      replace: (existing, data) => {
        const parsed = menuSchema.parse(data)
        return mutate(client, queries.menuUpdate, { id: existing.id, title: parsed.title, items: parsed.items }, "menu")
      }
    },
    "product-chart-assignment": assignmentAdapter(client)
  }
}

function assignmentAdapter(client: AdminClient): ResourceAdapter {
  const product = async (data: Record<string, unknown>) => {
    const parsed = assignmentSchema.parse(data)
    const result = z
      .object({
        product: z
          .object({
            id: z.string(),
            metafield: z
              .object({ id: z.string(), type: z.string(), value: z.string(), compareDigest: z.string().nullable() })
              .nullable()
          })
          .nullable()
      })
      .parse(
        await client(queries.productQuery, {
          identifier: { handle: parsed.productHandle },
          namespace: parsed.namespace,
          key: parsed.key
        })
      )
    if (!result.product) {
      throw new Error(`Product not found: ${parsed.productHandle}. No assignment was guessed.`)
    }
    return result.product
  }
  const write = async (data: Record<string, unknown>, expected?: InstalledResource) => {
    const parsed = assignmentSchema.parse(data)
    const current = await product(data)
    if (!expected && current.metafield) {
      throw new Error("Product assignment changed before writing.")
    }
    const previous = expected ? z.object({ compareDigest: z.string().nullable() }).parse(expected.state) : undefined
    const result = z
      .object({
        metafieldsSet: z.object({
          metafields: z.array(z.object({ id: z.string(), value: z.string() })).nullable(),
          userErrors: z.array(z.object({ message: z.string() }))
        })
      })
      .parse(
        await client(
          queries.setMetafields,
          {
            metafields: [
              {
                ownerId: current.id,
                namespace: parsed.namespace,
                key: parsed.key,
                type: "metaobject_reference",
                value: z.string().parse(parsed.value),
                compareDigest: previous?.compareDigest ?? null
              }
            ]
          },
          true
        )
      ).metafieldsSet
    if (result.userErrors.length) {
      throw new Error(result.userErrors.map((error) => error.message).join("; "))
    }
    const field = result.metafields?.[0]
    if (!field) {
      throw new Error("Shopify returned no product assignment.")
    }
    return { id: field.id, state: field }
  }
  return {
    validate: (data) => {
      assignmentSchema.parse(data)
    },
    identity: (data) => `${data.productHandle}/${data.namespace}.${data.key}`,
    find: async (data) => {
      const found = await product(data)
      return found.metafield ? { id: found.metafield.id, state: found.metafield } : undefined
    },
    conflict: (existing) =>
      object.parse(existing.state).type === "metaobject_reference"
        ? undefined
        : "Product field is not a metaobject reference.",
    create: (data) => write(data),
    replace: (existing, data) => write(data, existing)
  }
}
