import { execFile } from "node:child_process"
import { writeFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createCliClient, READ_SCOPES } from "./shopifyCli.ts"

vi.mock("node:child_process", () => ({
  execFile: vi.fn<(...args: never[]) => void>(),
  spawn: vi.fn<(...args: never[]) => void>()
}))

/*
 * The subprocess is the whole transport, so what matters is that a query reaches it intact and that
 * a failure says something a person can act on.
 */
type Callback = (error: unknown, stdout: string, stderr: string) => void
type Options = { env: Record<string, string> }

const run = vi.mocked(execFile) as unknown as ReturnType<typeof vi.fn>

const isOptions = (value: unknown): value is Options => typeof value === "object" && value !== null && "env" in value
const isCallback = (value: unknown): value is Callback => typeof value === "function"

/* Windows shells the CLI, so the words arrive as one string and the options shift along by one. */
const optionsOf = (args: readonly unknown[]): Options => {
  const found = args.find(isOptions)
  if (!found) {
    throw new Error("execFile was given no options")
  }
  return found
}

const callbackOf = (args: readonly unknown[]): Callback => {
  const found = args.find(isCallback)
  if (!found) {
    throw new Error("execFile was given no callback")
  }
  return found
}

const invoked = (args: readonly unknown[]): string =>
  [args[0], ...(Array.isArray(args[1]) ? args[1] : [])].join(" ").trim()

const schema = z.object({ shop: z.object({ name: z.string() }) })
const ask = () => createCliClient("fencing.myshopify.com")({ query: "query Shop { shop { name } }", schema })

/** The CLI writes its answer to the file it was handed, so the double stands in for that. */
const answers = (body: unknown) => {
  const flags: Record<string, string>[] = []
  run.mockImplementation((...args: unknown[]) => {
    const { env } = optionsOf(args)
    flags.push(env)
    writeFileSync(env.SHOPIFY_FLAG_OUTPUT_FILE!, JSON.stringify(body), "utf8")
    callbackOf(args)(null, "", "")
  })
  return flags
}

afterEach(() => {
  vi.resetAllMocks()
})

describe("createCliClient", () => {
  it("hands the query over as an environment flag, never as an argument", async () => {
    const flags = answers({ shop: { name: "Fencing Club" } })

    expect(await ask()).toEqual({ shop: { name: "Fencing Club" } })
    expect(invoked(run.mock.calls[0]!)).toBe("shopify store execute")
    expect(flags[0]!.SHOPIFY_FLAG_QUERY).toBe("query Shop { shop { name } }")
    expect(flags[0]!.SHOPIFY_FLAG_STORE).toBe("fencing.myshopify.com")
  })

  it("passes variables as JSON and pins the API version", async () => {
    const flags = answers({ shop: { name: "Fencing Club" } })
    await createCliClient("fencing.myshopify.com")({
      query: "query Shop { shop { name } }",
      variables: { id: "gid://shopify/Order/7" },
      schema
    })

    expect(JSON.parse(flags[0]!.SHOPIFY_FLAG_VARIABLES!)).toEqual({ id: "gid://shopify/Order/7" })
    expect(flags[0]!.SHOPIFY_FLAG_VERSION).toMatch(/^\d{4}-\d{2}$/)
  })

  it("reads an answer the CLI already unwrapped, and one it did not", async () => {
    answers({ shop: { name: "Unwrapped" } })
    expect(await ask()).toEqual({ shop: { name: "Unwrapped" } })

    answers({ data: { shop: { name: "Wrapped" } } })
    expect(await ask()).toEqual({ shop: { name: "Wrapped" } })
  })

  it("reports a rejected query rather than failing to parse it", async () => {
    answers({ errors: [{ message: "Field 'nope' doesn't exist" }] })
    await expect(ask()).rejects.toThrow(/rejected the query: Field 'nope' doesn't exist/)
  })

  it("says how to get the CLI when it is not installed", async () => {
    run.mockImplementation((...args: unknown[]) => {
      callbackOf(args)(Object.assign(new Error("spawn shopify ENOENT"), { code: "ENOENT" }), "", "")
    })
    await expect(ask()).rejects.toThrow(/`shopify` command was not found.*npm install -g @shopify\/cli/s)
  })

  it("passes the CLI's own complaint through, since it explains itself", async () => {
    run.mockImplementation((...args: unknown[]) => {
      const failure = Object.assign(new Error("exited"), { code: 1, stderr: "No authenticated session for this store" })
      callbackOf(args)(failure, "", "")
    })
    await expect(ask()).rejects.toThrow(/No authenticated session for this store/)
  })

  it("sends you back to login when the grant predates a scope this reads", async () => {
    run.mockImplementation((...args: unknown[]) => {
      const stderr = '{"errors":[{"message":"Access denied for fulfillmentOrders field."}]}'
      callbackOf(args)(Object.assign(new Error("exited"), { code: 1, stderr }), "", "")
    })
    await expect(ask()).rejects.toThrow(/`fulfillmentOrders` was refused.*Run login again/s)
  })
})

describe("READ_SCOPES", () => {
  it("asks for reading and nothing else", () => {
    expect(READ_SCOPES.split(",").every((scope) => scope.startsWith("read_"))).toBe(true)
  })

  it("asks for the policies a footer links to and the shipments a tracking email is about", () => {
    expect(READ_SCOPES).toContain("read_legal_policies")
    expect(READ_SCOPES).toContain("read_merchant_managed_fulfillment_orders")
  })
})
