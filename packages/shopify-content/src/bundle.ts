import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { createResourceAdapters } from "./adapters.ts"
import { createFileAdapter, localFile } from "./files.ts"
import type { AdapterRegistry } from "./installer.ts"
import { parseManifest } from "./manifest.ts"

export async function loadManifest(path: string) {
  const file = resolve(path)
  const raw: unknown = JSON.parse(await readFile(file, "utf8"))
  return { manifest: parseManifest(raw), directory: dirname(file) }
}

export function validateManifest(manifest: ReturnType<typeof parseManifest>, directory: string) {
  const noNetwork = async () => {
    throw new Error("Offline validation cannot access Shopify.")
  }
  const registry: AdapterRegistry = {
    ...createResourceAdapters(noNetwork),
    file: createFileAdapter(noNetwork, directory)
  }
  const identities = new Set<string>()
  for (const resource of manifest.resources) {
    const adapter = Object.hasOwn(registry, resource.kind) ? registry[resource.kind] : undefined
    if (!adapter) {
      throw new Error(`Unsupported resource kind: ${resource.kind}.`)
    }
    adapter.validate(resource.data)
    const identity = `${resource.kind}:${adapter.identity(resource.data)}`
    if (identities.has(identity)) {
      throw new Error(`Duplicate resource identity: ${identity}.`)
    }
    identities.add(identity)
  }
  return registry
}

export async function packManifest(path: string, output: string) {
  const { manifest, directory } = await loadManifest(path)
  validateManifest(manifest, directory)
  const destination = resolve(output)
  await mkdir(dirname(destination), { recursive: true })
  await mkdir(destination)
  try {
    await mkdir(join(destination, "media"))
    for (const resource of manifest.resources) {
      if (resource.kind !== "file") {
        continue
      }
      const local = localFile(resource.data, directory)
      await copyFile(resolve(directory, String(resource.data.path)), join(destination, "media", local.filename))
      resource.data.path = `media/${local.filename}`
    }
    await writeFile(join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  } catch (error) {
    await rm(destination, { recursive: true, force: true })
    throw error
  }
  return join(destination, "manifest.json")
}
