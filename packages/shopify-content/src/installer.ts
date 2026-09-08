import { createHash } from "node:crypto"
import { orderResources, resolveReferences, type ContentResource } from "./dependencies.ts"

export type InstalledResource = { id: string; url?: string; state: unknown }
export type ResourceAdapter = {
  validate: (data: Record<string, unknown>) => void
  identity: (data: Record<string, unknown>) => string
  find: (data: Record<string, unknown>) => Promise<InstalledResource | undefined>
  conflict?: (existing: InstalledResource, data: Record<string, unknown>) => string | undefined
  create: (data: Record<string, unknown>) => Promise<InstalledResource>
  replace?: (existing: InstalledResource, data: Record<string, unknown>) => Promise<InstalledResource>
}
export type AdapterRegistry = Record<string, ResourceAdapter>
export type InstallationProgress = {
  phase: "plan" | "check" | "apply"
  key: string
  position: number
  total: number
}
export type PlanItem = {
  resource: ContentResource
  action: "create" | "keep" | "replace" | "conflict"
  reason?: string
  existing?: InstalledResource
  sourceFingerprint: string
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)])
    )
  }
  return value
}

function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)) ?? "undefined")
    .digest("hex")
}

function adapterFor(registry: AdapterRegistry, kind: string) {
  const adapter = Object.hasOwn(registry, kind) ? registry[kind] : undefined
  if (!adapter) {
    throw new Error(`Unsupported resource kind: ${kind}.`)
  }
  return adapter
}

function resolvedData(resource: ContentResource, installed: Map<string, InstalledResource>) {
  const data = resolveReferences(resource.data, installed)
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`Invalid data: ${resource.key}.`)
  }
  return Object.fromEntries(Object.entries(data))
}

export async function planInstallation(
  resources: ContentResource[],
  registry: AdapterRegistry,
  replaceKeys: string[] = [],
  onProgress?: (progress: InstallationProgress) => void
) {
  const ordered = orderResources(resources)
  const identities = new Set<string>()
  for (const resource of ordered) {
    const adapter = adapterFor(registry, resource.kind)
    adapter.validate(resource.data)
    const identity = `${resource.kind}:${adapter.identity(resource.data)}`
    if (identities.has(identity)) {
      throw new Error(`Duplicate resource identity: ${identity}.`)
    }
    identities.add(identity)
  }
  for (const key of replaceKeys) {
    if (!ordered.some((resource) => resource.key === key)) {
      throw new Error(`Unknown replacement key: ${key}.`)
    }
  }
  const installed = new Map<string, InstalledResource>()
  const plan: PlanItem[] = []
  for (const [index, resource] of ordered.entries()) {
    onProgress?.({ phase: "plan", key: resource.key, position: index + 1, total: ordered.length })
    const adapter = adapterFor(registry, resource.kind)
    const existing = await adapter.find(resource.data)
    const sourceFingerprint = fingerprint({ resource, identity: adapter.identity(resource.data) })
    installed.set(
      resource.key,
      existing ?? { id: `pending:${resource.key}`, url: `pending:${resource.key}:url`, state: null }
    )
    if (!existing) {
      plan.push({ resource, action: "create", sourceFingerprint })
      continue
    }
    const conflict = adapter.conflict?.(existing, resolvedData(resource, installed))
    if (conflict) {
      plan.push({ resource, existing, action: "conflict", reason: conflict, sourceFingerprint })
    } else if (replaceKeys.includes(resource.key)) {
      if (!adapter.replace) {
        plan.push({
          resource,
          existing,
          action: "conflict",
          reason: "This resource does not support replacement.",
          sourceFingerprint
        })
      } else {
        plan.push({ resource, existing, action: "replace", sourceFingerprint })
      }
    } else {
      plan.push({ resource, existing, action: "keep", reason: "Preserve existing store content.", sourceFingerprint })
    }
  }
  return plan
}

export async function applyInstallation(
  plan: PlanItem[],
  registry: AdapterRegistry,
  onApplied?: (key: string) => void,
  onProgress?: (progress: InstallationProgress) => void
) {
  const conflicts = plan.filter((item) => item.action === "conflict")
  if (conflicts.length) {
    throw new Error(`Resolve conflicts before applying: ${conflicts.map((item) => item.resource.key).join(", ")}.`)
  }
  for (const [index, item] of plan.entries()) {
    onProgress?.({ phase: "check", key: item.resource.key, position: index + 1, total: plan.length })
    const adapter = adapterFor(registry, item.resource.kind)
    if (
      fingerprint({ resource: item.resource, identity: adapter.identity(item.resource.data) }) !==
      item.sourceFingerprint
    ) {
      throw new Error(`Manifest inputs changed: ${item.resource.key}. Plan again.`)
    }
    const current = await adapter.find(item.resource.data)
    if (fingerprint(current) !== fingerprint(item.existing)) {
      throw new Error(`Store changed since planning: ${item.resource.key}. Plan again.`)
    }
  }
  const installed = new Map<string, InstalledResource>()
  for (const [index, item] of plan.entries()) {
    onProgress?.({ phase: "apply", key: item.resource.key, position: index + 1, total: plan.length })
    const adapter = adapterFor(registry, item.resource.kind)
    if (
      fingerprint({ resource: item.resource, identity: adapter.identity(item.resource.data) }) !==
      item.sourceFingerprint
    ) {
      throw new Error(`Manifest inputs changed: ${item.resource.key}. Plan again.`)
    }
    const current = await adapter.find(item.resource.data)
    if (fingerprint(current) !== fingerprint(item.existing)) {
      throw new Error(`Store changed during installation: ${item.resource.key}. Plan again.`)
    }
    if (item.action === "keep" && current) {
      installed.set(item.resource.key, current)
      continue
    }
    const data = resolvedData(item.resource, installed)
    let result: InstalledResource
    try {
      if (item.action === "replace" && current && adapter.replace) {
        result = await adapter.replace(current, data)
      } else {
        result = await adapter.create(data)
      }
    } catch (error) {
      throw new Error(
        `Installation stopped at ${item.resource.key}. Earlier resources were retained; plan again to resume.`,
        { cause: error }
      )
    }
    installed.set(item.resource.key, result)
    onApplied?.(item.resource.key)
  }
  return installed
}
