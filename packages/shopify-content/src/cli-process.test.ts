import { execFile } from "node:child_process"
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { afterEach, describe, expect, it } from "vitest"

const execute = promisify(execFile)
const launcher = fileURLToPath(new URL("./cli-process.mjs", import.meta.url))
const directories: string[] = []

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

async function bootstrapFixture(content: string) {
  const directory = await mkdtemp(join(tmpdir(), "shopify-launcher-test-"))
  directories.push(directory)
  const bootstrap = join(directory, "bootstrap.mjs")
  await writeFile(bootstrap, content)
  return { directory, bootstrap }
}

describe("Shopify command completion", () => {
  it("waits for the command and exits even when the CLI leaves handles open", async () => {
    const { directory, bootstrap } = await bootstrapFixture(`
      import { writeFile } from 'node:fs/promises';
      export default async function run(options) {
        setInterval(() => {}, 1000);
        await writeFile(process.argv[5], JSON.stringify({ options, args: process.argv.slice(2, 5) }));
      }
    `)
    const output = join(directory, "result.json")
    await execute(process.execPath, [launcher, bootstrap, "store", "execute", "--output-file", output], {
      timeout: 5000,
      killSignal: "SIGKILL"
    })
    expect(JSON.parse(await readFile(output, "utf8"))).toEqual({
      options: { development: false },
      args: ["store", "execute", "--output-file"]
    })
  })

  it("preserves a nonzero CLI status instead of treating an output file as success", async () => {
    const { directory, bootstrap } = await bootstrapFixture(`
      import { writeFile } from 'node:fs/promises';
      export default async function run() {
        await writeFile(process.argv[2], '{"partial":true}');
        process.exitCode = 7;
        setInterval(() => {}, 1000);
      }
    `)
    const output = join(directory, "partial.json")
    await expect(
      execute(process.execPath, [launcher, bootstrap, output], {
        timeout: 5000,
        killSignal: "SIGKILL"
      })
    ).rejects.toMatchObject({ code: 7 })
    await expect(access(output)).resolves.toBeUndefined()
  })

  it("exits unsuccessfully on an async error or missing bootstrap argument", async () => {
    const { bootstrap } = await bootstrapFixture(`
      export default async function run() {
        setInterval(() => {}, 1000);
        throw new Error('Command rejected');
      }
    `)
    await expect(
      execute(process.execPath, [launcher, bootstrap], { timeout: 5000, killSignal: "SIGKILL" })
    ).rejects.toMatchObject({ code: 1, stderr: "Command rejected\n" })
    await expect(execute(process.execPath, [launcher], { timeout: 5000, killSignal: "SIGKILL" })).rejects.toMatchObject(
      { code: 1, stderr: "Missing Shopify CLI bootstrap path.\n" }
    )
  })
})
