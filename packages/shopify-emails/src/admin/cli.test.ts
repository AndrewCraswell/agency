import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { run } from "./cli.ts"

const root = join(import.meta.dirname, "..", "..")
const made: string[] = []
let written = ""

const fixtureDir = async () => {
  const dir = await mkdtemp(join(root, ".cli-fixture-"))
  made.push(dir)
  return dir
}

beforeEach(() => {
  written = ""
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written += String(chunk)
    return true
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

afterAll(async () => {
  await Promise.all(made.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("run", () => {
  it("prints the usage when asked for help, and when given nothing at all", async () => {
    await run(["--help"])
    expect(written).toContain("shopify-emails login --store")

    written = ""
    await run([])
    expect(written).toContain("shopify-emails build")
  })

  it("names the unknown command and shows what is available", async () => {
    await expect(run(["publish"])).rejects.toThrow(/Unknown command "publish"/)
  })

  it("refuses to log in without a store, since the token is sent to that host", async () => {
    await expect(run(["login"])).rejects.toThrow(/--store/)
  })

  it("refuses a store that is not a myshopify domain", async () => {
    await expect(run(["login", "--store", "fencing.club"])).rejects.toThrow(/not a myshopify.com store domain/)
  })
})

describe("run probe", () => {
  it("prints the notification probe by default", async () => {
    await run(["probe"])

    expect(written).toContain("Variable probe")
    expect(written).toContain(`"line_items": {{ line_items | json | escape | default: "null" }}`)
  })

  it("asks a campaign the marketing questions instead", async () => {
    await run(["probe", "--for", "marketing"])

    expect(written).toContain(`"unsubscribe_url": {{ unsubscribe_url | json`)
  })

  it("names the targets it knows when given one it does not", async () => {
    await expect(run(["probe", "--for", "printout"])).rejects.toThrow(/Use notification, marketing, or asset/)
  })

  it("probes only the names it is given, so a clipped run can be narrowed", async () => {
    await run(["probe", "--names", "note, line_items"])

    expect(written).toContain(`"note": {{ note | json`)
    expect(written).toContain(`"line_items": {{ line_items | json`)
    expect(written).not.toContain(`"customer"`)
  })

  it("writes to a file and reports where, rather than printing the whole template", async () => {
    const out = join(await fixtureDir(), "probe.liquid")

    await run(["probe", "--out", out])

    expect(await readFile(out, "utf8")).toContain("Variable probe")
    expect(written).not.toContain("line_items | json")
  })

  it("sorts a captured run into what a template can rely on", async () => {
    const capture = join(await fixtureDir(), "preview.html")
    await writeFile(
      capture,
      `<pre>{&quot;note&quot;: &quot;gift&quot;, &quot;order_name&quot;: &quot;&quot;, &quot;po_number&quot;: null}</pre>`,
      "utf8"
    )

    await run(["probe", "--capture", capture, "--names", "note,order_name,po_number,gift_card"])

    expect(written).toContain("Present (1)\n  note")
    expect(written).toContain("Empty for this order (1)\n  order_name")
    expect(written).toContain("Absent, yet a stock template reads it (1)\n  po_number")
    expect(written).toContain("Never answered, so the run was clipped (1)\n  gift_card")
  })
})

describe("run build", () => {
  /* Plain objects rather than `defineTemplate`, so the loader does not pull in a second copy of the source. */
  const definition = `
    export const template = {
      id: "welcome",
      type: "campaign",
      subject: () => "Thanks for your order",
      render: () => <p>Thanks</p>
    }
  `

  it("prints both files it wrote and how to use them", async () => {
    const dir = await fixtureDir()
    await writeFile(join(dir, "welcome.tsx"), definition, "utf8")

    await run(["build", "--dir", dir, "--out", join(dir, "out")])

    expect(written).toContain("welcome.liquid")
    expect(written).toContain("welcome.subject.txt")
    expect(written).toContain("1 template.")
  })

  it("warns when a template is past the size where Gmail clips a message", async () => {
    const dir = await fixtureDir()
    const filler = "x".repeat(110_000)
    await writeFile(
      join(dir, "big.tsx"),
      definition.replace("Thanks</p>", `${filler}</p>`).replace("welcome", "big"),
      "utf8"
    )

    await run(["build", "--dir", dir, "--out", join(dir, "out")])

    expect(written).toMatch(/big compiles to \d+ KB, past the 100 KB where Gmail clips a message/)
  })
})
