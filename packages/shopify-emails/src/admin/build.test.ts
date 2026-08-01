import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { buildTemplates, GMAIL_CLIP_BYTES } from "./build.ts"

/*
 * The fixtures live inside the package rather than in the OS temp folder, because a definition's
 * own imports resolve from where the file sits and a folder outside the workspace can reach no
 * `node_modules`.
 */
const root = join(import.meta.dirname, "..", "..")
const made: string[] = []

afterAll(async () => {
  await Promise.all(made.map((dir) => rm(dir, { recursive: true, force: true })))
})

const workspace = async (files: Record<string, string>) => {
  const dir = await mkdtemp(join(root, ".build-fixture-"))
  made.push(dir)
  for (const [name, source] of Object.entries(files)) {
    await writeFile(join(dir, name), source, "utf8")
  }
  return { dir, out: join(dir, "out") }
}

/*
 * The fixtures declare a template as a plain object rather than importing `defineTemplate`, because
 * the loader transpiles what it loads and would pull a second, unexercised copy of the source into
 * the coverage report. What is under test here is the file plumbing, not the compiler.
 */
const definition = (id: string, greeting = "Thanks") => `
  export const template = {
    id: ${JSON.stringify(id)},
    type: "campaign",
    subject: () => ${JSON.stringify(`${greeting} for your order`)},
    render: () => <p>${greeting}</p>
  }
`

describe("buildTemplates", () => {
  it("writes a body and a subject per definition, named by id", async () => {
    const { dir, out } = await workspace({ "welcome.tsx": definition("welcome") })

    const [built, ...rest] = await buildTemplates({ dir, out })

    expect(rest).toEqual([])
    expect(built!.id).toBe("welcome")
    expect(await readFile(built!.body, "utf8")).toContain("<p>Thanks</p>")
    expect(await readFile(built!.subject, "utf8")).toBe("Thanks for your order\n")
  })

  it("reports the compiled size, which is what a clipping client measures", async () => {
    const { dir, out } = await workspace({ "welcome.tsx": definition("welcome") })

    const [built] = await buildTemplates({ dir, out })

    expect(built!.bytes).toBe(Buffer.byteLength(await readFile(built!.body, "utf8"), "utf8"))
    expect(built!.bytes).toBeLessThan(GMAIL_CLIP_BYTES)
  })

  /*
   * Vitest resolves the definition's import through its own graph rather than the registered
   * loader, so this render crosses a module boundary the CLI does not have. If the render mode did
   * not survive that crossing, the subject would compile with `| escape` it must not carry.
   */
  it("leaves a subject drop unescaped, though the definition reaches the package by another route", async () => {
    const { dir, out } = await workspace({
      "welcome.tsx": `
        import { liquidValue, Var } from "../src/index.ts"

        export const template = {
          id: "welcome",
          type: "campaign",
          subject: (v) => \`Order \${liquidValue(v.name)}\`,
          render: (v) => <p><Var path={v.name} /></p>
        }
      `
    })

    const [built] = await buildTemplates({ dir, out })

    expect(await readFile(built!.subject, "utf8")).toBe("Order {{ name }}\n")
    expect(await readFile(built!.body, "utf8")).toContain("{{ name | escape }}")
  })

  it("refuses two definitions that claim one id, which would overwrite each other", async () => {
    const { dir, out } = await workspace({
      "one.tsx": definition("welcome"),
      "two.tsx": definition("welcome", "Welcome")
    })

    await expect(buildTemplates({ dir, out })).rejects.toThrow(/both claim the id/)
  })

  it("reports a folder that exports no definitions rather than emptying the output", async () => {
    const { dir, out } = await workspace({ "notes.md": "# not a template" })

    await expect(buildTemplates({ dir, out })).rejects.toThrow(/No template definitions/)
  })

  it("ignores tests and stories sitting beside the definitions", async () => {
    const stale = `export const template = { id: "stale", type: "campaign", subject: () => "", render: () => null }`
    const { dir, out } = await workspace({
      "welcome.tsx": definition("welcome"),
      "welcome.test.tsx": stale,
      "welcome.stories.tsx": stale
    })

    const built = await buildTemplates({ dir, out })

    expect(built.map((template) => template.id)).toEqual(["welcome"])
  })

  it("clears the output first, so a renamed template leaves nothing stale to paste", async () => {
    const { dir, out } = await workspace({ "welcome.tsx": definition("welcome") })
    await buildTemplates({ dir, out })

    await rm(join(dir, "welcome.tsx"))
    await writeFile(join(dir, "greeting.tsx"), definition("greeting"), "utf8")
    const built = await buildTemplates({ dir, out })

    expect(built.map((template) => template.id)).toEqual(["greeting"])
    await expect(readFile(join(out, "welcome.liquid"), "utf8")).rejects.toThrow(/ENOENT/)
  })
})
