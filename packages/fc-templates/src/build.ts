import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { GROUP_SOURCE_DIRS, STORE_HANDLE, templates } from "./registry.ts"
import { templateSourcePath } from "./render.ts"

/*
 * Shopify exposes no API for notification or Order Printer templates — the Asset API covers theme
 * files only. So "publish" is a human paste, and the best this package can do is assemble every
 * template into one folder and hand over the exact admin URL for each one.
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const distDir = join(packageRoot, "dist")

export async function build(): Promise<string[]> {
  await rm(distDir, { recursive: true, force: true })

  const written: string[] = []
  for (const template of templates) {
    const groupDir = join(distDir, GROUP_SOURCE_DIRS[template.group])
    await mkdir(groupDir, { recursive: true })
    const target = join(groupDir, `${template.id}.liquid`)
    await writeFile(target, await readFile(templateSourcePath(template), "utf8"))
    written.push(target)
  }
  return written
}

const written = await build()

const lines = [
  `Wrote ${written.length} templates to dist/`,
  "",
  `Customer notifications  https://admin.shopify.com/store/${STORE_HANDLE}/settings/notifications`,
  `Printouts               https://admin.shopify.com/store/${STORE_HANDLE}/apps/order-printer`,
  "",
  "Marketing emails are authored in the Shopify Email app; paste the HTML into a custom-code section.",
  ""
]
process.stdout.write(`${lines.join("\n")}\n`)
