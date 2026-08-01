import { mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { register } from "tsx/esm/api"
import { compileSubject, compileTemplate, type TemplateDefinition } from "../template.ts"

/*
 * Turning a folder of React definitions into the files a human pastes into the Shopify admin.
 *
 * Shopify exposes no API for notification templates — the Asset API covers theme files only — so
 * publishing is a paste, and the most this can do is produce exactly what goes in each field.
 * Subject and body are separate fields in that editor, which is why one definition emits two files
 * rather than one.
 *
 * Definitions are loaded through tsx so a consumer needs no bundler step of its own: the point of
 * shipping this command is that a template folder is the whole build configuration.
 */

type AnyTemplate = TemplateDefinition<Record<string, unknown>>

const isTemplateDefinition = (value: unknown): value is AnyTemplate =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "id") === "string" &&
  typeof Reflect.get(value, "type") === "string" &&
  typeof Reflect.get(value, "subject") === "function" &&
  typeof Reflect.get(value, "render") === "function"

const isDefinitionModule = (name: string): boolean =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".d.ts") && !/\.(test|spec|stories)\./.test(name)

const collectDefinitions = async (dir: string): Promise<AnyTemplate[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const found = new Map<string, AnyTemplate>()
  /* Node's own loader hook, so a definition importing this package reaches the copy already
   * running rather than a second one with its own render mode. */
  const unregister = register()

  try {
    for (const entry of entries) {
      if (!entry.isFile() || !isDefinitionModule(entry.name)) {
        continue
      }
      const modulePath = join(entry.parentPath, entry.name)
      const loaded: Record<string, unknown> = await import(pathToFileURL(modulePath).href)
      for (const exported of Object.values(loaded)) {
        if (!isTemplateDefinition(exported)) {
          continue
        }
        /* Two definitions sharing an id would quietly overwrite each other in the output folder. */
        if (found.has(exported.id)) {
          throw new Error(`Two templates both claim the id "${exported.id}". Ids name the file Shopify receives.`)
        }
        found.set(exported.id, exported)
      }
    }
  } finally {
    await unregister()
  }

  return [...found.values()]
}

export type BuildOptions = {
  readonly dir: string
  readonly out: string
}

export type BuiltTemplate = {
  readonly id: string
  readonly body: string
  readonly subject: string
  /** The compiled body's size, which is a floor: a loop is one line here and many in the inbox. */
  readonly bytes: number
}

/*
 * Gmail stops rendering a message past this and hangs a "View entire message" link off the cut,
 * taking the unsubscribe footer and any tracking pixel with it. Shopify's own header counts against
 * it too, so a template that only just fits here does not fit there.
 */
export const GMAIL_CLIP_BYTES = 102_400

export const buildTemplates = async ({ dir, out }: BuildOptions): Promise<BuiltTemplate[]> => {
  const sourceDir = resolve(dir)
  const outDir = resolve(out)
  const templates = await collectDefinitions(sourceDir)

  if (templates.length === 0) {
    throw new Error(`No template definitions were exported from ${sourceDir}`)
  }

  /* Cleared first, so a renamed or deleted template cannot leave a stale file to be pasted. */
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const built: BuiltTemplate[] = []
  for (const template of templates) {
    const body = join(outDir, `${template.id}.liquid`)
    const subject = join(outDir, `${template.id}.subject.txt`)
    const liquid = await compileTemplate(template, { pretty: true })
    await writeFile(body, liquid, "utf8")
    await writeFile(subject, `${compileSubject(template)}\n`, "utf8")
    built.push({ id: template.id, body, subject, bytes: Buffer.byteLength(liquid, "utf8") })
  }

  return built
}
