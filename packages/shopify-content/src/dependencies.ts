export type ResourceReference = { $ref: string; field?: "id" | "url" }

export type ContentResource = {
  key: string
  kind: string
  dependsOn?: string[]
  data: Record<string, unknown>
}

export function isReference(value: unknown): value is ResourceReference {
  return typeof value === "object" && value !== null && "$ref" in value && typeof value.$ref === "string"
}

export function referencesIn(value: unknown): string[] {
  if (isReference(value)) {
    return [value.$ref]
  }
  if (Array.isArray(value)) {
    return value.flatMap(referencesIn)
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(referencesIn)
  }
  return []
}

export function orderResources(resources: ContentResource[]) {
  const byKey = new Map(resources.map((resource) => [resource.key, resource]))
  if (byKey.size !== resources.length) {
    throw new Error("Resource keys must be unique.")
  }
  const active = new Set<string>()
  const complete = new Set<string>()
  const ordered: ContentResource[] = []

  function visit(key: string) {
    if (complete.has(key)) {
      return
    }
    if (active.has(key)) {
      throw new Error(`Resource dependency cycle at ${key}.`)
    }
    const resource = byKey.get(key)
    if (!resource) {
      throw new Error(`Unknown resource reference: ${key}.`)
    }
    active.add(key)
    for (const dependency of [...(resource.dependsOn ?? []), ...referencesIn(resource.data)]) {
      visit(dependency)
    }
    active.delete(key)
    complete.add(key)
    ordered.push(resource)
  }

  for (const resource of resources) {
    visit(resource.key)
  }
  return ordered
}

export function resolveReferences(value: unknown, resources: Map<string, { id: string; url?: string }>): unknown {
  if (isReference(value)) {
    const resource = resources.get(value.$ref)
    const resolved = resource?.[value.field ?? "id"]
    if (!resolved) {
      throw new Error(`Unresolved ${value.field ?? "id"} reference: ${value.$ref}.`)
    }
    return resolved
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveReferences(item, resources))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveReferences(item, resources)]))
  }
  return value
}
