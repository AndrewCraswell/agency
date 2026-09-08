import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Command } from "commander"
import { z } from "zod"
import { createResourceAdapters } from "./adapters.ts"
import { loadManifest, packManifest, validateManifest } from "./bundle.ts"
import { finalizeCatalog } from "./catalog-finalize.ts"
import { importCatalog } from "./catalog-import.ts"
import { loadBundleCaptures } from "./catalog-setup.ts"
import { snapshotCatalog } from "./catalog-snapshot.ts"
import { createCliClient, storeSchema } from "./client.ts"
import { createFileAdapter } from "./files.ts"
import { applyInstallation, planInstallation, type InstallationProgress } from "./installer.ts"
import { applyThemeConfiguration } from "./theme-configuration.ts"

const program = new Command().name("shopify-content").description("Plan and install portable Shopify content.")
const reportProgress = ({ phase, key, position, total }: InstallationProgress) => {
  process.stderr.write(`[${phase} ${position}/${total}] ${key}\n`)
}
const optionsSchema = z.object({
  store: storeSchema,
  replace: z.array(z.string()).default([]),
  confirmStore: z.string().optional()
})

program
  .command("snapshot-catalog")
  .requiredOption("--store <domain>", "Explicit read-only source.myshopify.com domain.")
  .requiredOption("--out <file>", "New snapshot file; must not already exist.")
  .description("Read product data without customers, orders, credentials or inventory quantities.")
  .action(async (input: unknown) => {
    const options = z.object({ store: storeSchema, out: z.string() }).parse(input)
    const snapshot = await snapshotCatalog(createCliClient(options.store), options.store, (count) => {
      process.stderr.write(`Read ${count} products\n`)
    })
    await writeFile(options.out, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx", mode: 0o600 })
    process.stdout.write(`Saved ${snapshot.products.length} products from ${snapshot.shop.name}.\n`)
  })

program
  .command("import-catalog")
  .argument("<snapshot>")
  .requiredOption("--store <domain>", "Contoso destination domain.")
  .option(
    "--confirm-store <domain>",
    "Repeat the destination to create missing draft products; omit for a read-only plan."
  )
  .description("Rehearse a Fencing Club catalog import into Contoso without replacing existing products.")
  .action(async (path: string, input: unknown) => {
    const options = z.object({ store: storeSchema, confirmStore: storeSchema.optional() }).parse(input)
    if (options.confirmStore && options.confirmStore !== options.store) {
      throw new Error("Destination confirmation differs.")
    }
    const snapshot: unknown = JSON.parse(await readFile(path, "utf8"))
    const result = await importCatalog(
      snapshot,
      createCliClient(options.store, !!options.confirmStore),
      options.store,
      !!options.confirmStore,
      (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
    )
    process.stdout.write(`${JSON.stringify(result)}\n`)
  })

program
  .command("finalize-catalog")
  .argument("<snapshot>")
  .requiredOption("--content <file>", "Captured collection content.")
  .requiredOption("--bundles <directory>", "Directory containing migration-bundle-*.json captures.")
  .requiredOption("--assignments <file>", "Explicit product-to-chart handle mapping.")
  .requiredOption("--store <domain>", "Contoso destination domain.")
  .requiredOption("--confirm-store <domain>", "Repeat the destination to authorize setup.")
  .requiredOption("--location <id>", "Destination location for controlled test stock.")
  .requiredOption("--publication <id>", "Destination Online Store publication.")
  .description("Verify imported drafts, restore bundles and sizing, then activate the Contoso catalog.")
  .action(async (path: string, input: unknown) => {
    const options = z
      .object({
        content: z.string(),
        bundles: z.string(),
        assignments: z.string(),
        store: storeSchema,
        confirmStore: storeSchema,
        location: z.string(),
        publication: z.string()
      })
      .parse(input)
    if (options.store !== options.confirmStore) {
      throw new Error("Destination confirmation differs.")
    }
    const read = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, "utf8"))
    const snapshot = await read(path)
    const bundles = await loadBundleCaptures(snapshot, (filename) => read(join(options.bundles, filename)))
    const result = await finalizeCatalog(
      createCliClient(options.store, true),
      snapshot,
      await read(options.content),
      bundles,
      await read(options.assignments),
      options.store,
      options.location,
      options.publication,
      (event) => process.stdout.write(`${JSON.stringify(event)}\n`)
    )
    process.stdout.write(`${JSON.stringify(result)}\n`)
  })

program
  .command("configure-theme")
  .argument("<configuration>")
  .requiredOption("--store <domain>", "Explicit destination store.")
  .requiredOption("--theme <id>", "Unpublished destination theme ID.")
  .requiredOption("--backup <file>", "New backup file written before applying any settings.")
  .option("--confirm-store <domain>", "Repeat the destination to apply; omit for a read-only plan.")
  .description("Attach installed menus and ordered sizing groups without replacing unrelated settings.")
  .action(async (path: string, input: unknown) => {
    const options = z
      .object({ store: storeSchema, theme: z.string(), backup: z.string(), confirmStore: storeSchema.optional() })
      .parse(input)
    if (options.confirmStore && options.confirmStore !== options.store) {
      throw new Error("Destination confirmation differs.")
    }
    const configuration: unknown = JSON.parse(await readFile(path, "utf8"))
    const client = createCliClient(options.store, !!options.confirmStore)
    const planned = await applyThemeConfiguration(client, options.theme, configuration, false)
    await writeFile(options.backup, `${JSON.stringify(planned, null, 2)}\n`, { flag: "wx", mode: 0o600 })
    if (options.confirmStore) {
      await applyThemeConfiguration(client, options.theme, configuration, true)
    }
    process.stdout.write(
      `${options.confirmStore ? "Configured" : "Planned"} ${planned.files.length} theme files. No theme was published.\n`
    )
  })

program
  .command("validate")
  .argument("<manifest>")
  .description("Validate a content package locally without Shopify access.")
  .action(async (path: string) => {
    const { manifest, directory } = await loadManifest(path)
    validateManifest(manifest, directory)
    process.stdout.write(`Valid: ${manifest.name} (${manifest.resources.length} resources).\n`)
  })

program
  .command("pack")
  .argument("<manifest>")
  .requiredOption("--out <directory>", "New bundle directory; must not already exist.")
  .description("Bundle a manifest and its files, without store-specific IDs or credentials.")
  .action(async (path: string, input: unknown) => {
    const { out } = z.object({ out: z.string() }).parse(input)
    process.stdout.write(`${await packManifest(path, out)}\n`)
  })

for (const mode of ["plan", "apply"]) {
  const command = program
    .command(mode)
    .argument("<manifest>")
    .requiredOption("--store <domain>", "Explicit destination.myshopify.com domain.")
    .option("--replace <keys...>", "Explicit resource keys whose existing content may be replaced.")
  if (mode === "apply") {
    command.requiredOption("--confirm-store <domain>", "Repeat the destination to authorize writes.")
  }
  command.action(async (path: string, input: unknown) => {
    const options = optionsSchema.parse(input)
    const isApply = mode === "apply"
    if (isApply && options.confirmStore !== options.store) {
      throw new Error("--confirm-store must exactly match --store.")
    }
    const { manifest, directory } = await loadManifest(path)
    validateManifest(manifest, directory)
    const client = createCliClient(options.store, isApply)
    const registry = { ...createResourceAdapters(client), file: createFileAdapter(client, directory) }
    const plan = await planInstallation(manifest.resources, registry, options.replace, reportProgress)
    process.stdout.write(
      `${JSON.stringify(
        {
          store: options.store,
          manifest: manifest.name,
          resources: plan.map((item) => ({
            key: item.resource.key,
            kind: item.resource.kind,
            action: item.action,
            reason: item.reason
          }))
        },
        null,
        2
      )}\n`
    )
    if (plan.some((item) => item.action === "conflict")) {
      throw new Error("Conflicts found. Nothing was written.")
    }
    if (isApply) {
      await applyInstallation(plan, registry, (key) => process.stdout.write(`Applied ${key}\n`), reportProgress)
      process.stdout.write("Content installed. No theme was published.\n")
    }
  })
}

try {
  await program.parseAsync()
} catch (error) {
  let current: unknown = error
  while (current instanceof Error) {
    process.stderr.write(`${current.message}\n`)
    current = current.cause
  }
  process.exitCode = 1
}
