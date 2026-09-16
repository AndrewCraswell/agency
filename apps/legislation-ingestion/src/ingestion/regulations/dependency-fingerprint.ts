import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { parseDocument } from "yaml"
import { z } from "zod"

const dependencyMap = z.record(z.string(), z.string()).default({})
const declaration = z.object({ version: z.string().min(1) }).passthrough()
const snapshotSchema = z.object({ dependencies: dependencyMap, optionalDependencies: dependencyMap }).passthrough()
const lockSchema = z.object({
  lockfileVersion: z.literal("9.0"),
  importers: z.record(
    z.string(),
    z.object({
      dependencies: z.record(z.string(), declaration).default({}),
      devDependencies: z.record(z.string(), declaration).default({}),
      optionalDependencies: z.record(z.string(), declaration).default({})
    })
  ),
  packages: z.record(z.string(), z.record(z.string(), z.unknown())),
  snapshots: z.record(z.string(), snapshotSchema),
  patchedDependencies: z.record(z.string(), z.unknown()).default({})
})

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sorted)
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sorted(item)])
    )
  }
  return value
}

/** Bind the scanner's complete dependency closure, without invalidation from unrelated workspace lock changes. */
export function regulatoryDependencyFingerprint(lockText: string, importerId: string, roots: readonly string[]) {
  const document = parseDocument(lockText)
  invariant(document.errors.length === 0, "shape_dependency_lock_invalid")
  const lock = lockSchema.parse(document.toJS())
  const importer = lock.importers[importerId]
  invariant(importer && roots.length > 0 && new Set(roots).size === roots.length, "shape_dependency_roots_invalid")
  const declarations = { ...importer.devDependencies, ...importer.dependencies, ...importer.optionalDependencies }
  const selectedRoots: Record<string, z.infer<typeof declaration>> = {}
  const snapshots: Record<string, z.infer<typeof snapshotSchema>> = {}
  const packages: Record<string, Record<string, unknown>> = {}
  const patches: Record<string, unknown> = {}
  const pending = roots.map((name) => {
    const item = declarations[name]
    invariant(item, "shape_dependency_root_missing")
    selectedRoots[name] = item
    return { name, version: item.version }
  })
  while (pending.length > 0) {
    const item = pending.pop()
    invariant(item, "shape_dependency_cursor")
    // Local/tarball/alias roots need an explicit resolver before they can be accepted as reproducible evidence.
    invariant(/^\d+\.\d+\.\d+(?:[-+(].*)?$/.test(item.version), "shape_dependency_reference_unsupported")
    const key = `${item.name}@${item.version}`
    if (Object.hasOwn(snapshots, key)) {
      continue
    }
    const snapshot = lock.snapshots[key]
    const packageKey = key.split("(")[0]
    invariant(packageKey, "shape_dependency_package_missing")
    const metadata = lock.packages[packageKey]
    invariant(snapshot && metadata, "shape_dependency_package_missing")
    snapshots[key] = snapshot
    packages[packageKey] = metadata
    if (Object.hasOwn(lock.patchedDependencies, packageKey)) {
      patches[packageKey] = lock.patchedDependencies[packageKey]
    }
    for (const [name, version] of Object.entries({ ...snapshot.dependencies, ...snapshot.optionalDependencies })) {
      pending.push({ name, version })
    }
  }
  return digest(
    JSON.stringify(
      sorted({ lockfileVersion: lock.lockfileVersion, roots: selectedRoots, snapshots, packages, patches })
    )
  )
}
