import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const contractDirectory = new URL("../../docs/engineering/api/", import.meta.url)
const contractPages = [
  "legislative-records.md",
  "civic-graph-and-events.md",
  "search-and-diffs.md",
  "subscriptions-and-webhooks.md"
] as const
const supportedMethods = ["GET", "POST", "PATCH", "DELETE"] as const

type Method = (typeof supportedMethods)[number]
type InventoryOperation = Readonly<{
  access: "Authenticated" | "First-party" | "Operator" | "Public"
  method: Method
  path: string
  response: string
}>

const inventoryRow =
  /^\|\s*(GET|POST|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*(Authenticated|First-party|Operator|Public)\s*\|\s*`([^`]+)`\s*\|$/gm
const declaredOperation = /^(?:#{2,3}\s+|\|\s*)`((?:GET|POST|PATCH|DELETE) \/api\/[^`]+)`/gm

function document(name: string): string {
  return readFileSync(new URL(name, contractDirectory), "utf8")
}

function normalizedWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function isMethod(value: string): value is Method {
  return supportedMethods.some((method) => method === value)
}

function isAccess(value: string): value is InventoryOperation["access"] {
  return ["Authenticated", "First-party", "Operator", "Public"].includes(value)
}

function inventory(): InventoryOperation[] {
  return [...document("README.md").matchAll(inventoryRow)].map((match) => {
    const method = match[1]
    const access = match[3]
    if (!isMethod(method) || !isAccess(access)) {
      throw new Error("The HTTP API inventory contains an unsupported method or access label")
    }
    return { access, method, path: match[2], response: match[4] }
  })
}

function operationId(operation: Pick<InventoryOperation, "method" | "path">): string {
  const normalizedPath = operation.path
    .slice(1)
    .replaceAll("/", "__")
    .replaceAll("-", "_")
    .replaceAll(/\{([^}]+)\}/g, "by_$1")
  return `${operation.method.toLowerCase()}__${normalizedPath}`
}

describe("HTTP API documentation contract", () => {
  it("keeps all 81 inventory operations represented exactly once in their detailed contract pages", () => {
    const operations = inventory()
    const inventoryKeys = operations.map(({ method, path }) => `${method} ${path}`)
    const detailedKeys = contractPages.flatMap((page) =>
      [...document(page).matchAll(declaredOperation)].map((match) => match[1])
    )

    expect(operations).toHaveLength(81)
    expect(new Set(inventoryKeys)).toHaveProperty("size", 81)
    expect(new Set(detailedKeys)).toHaveProperty("size", 81)
    expect(new Set(detailedKeys)).toEqual(new Set(inventoryKeys))
  })

  it("keeps response envelopes, access labels, pagination, and error status rules centrally normative", () => {
    const operations = inventory()
    const readme = normalizedWhitespace(document("README.md"))
    const schemas = document("schemas.md")

    expect(operations.every(({ access }) => access === "Authenticated" || access === "First-party")).toBe(true)
    expect(operations.filter(({ response }) => response.startsWith("Page<"))).toHaveLength(41)
    expect(operations.filter(({ response }) => response.startsWith("SearchPage<"))).toHaveLength(4)
    expect(operations.filter(({ response }) => response.startsWith("BatchResponse<"))).toHaveLength(4)
    expect(readme).toContain("The HTTP API accepts configured WorkOS M2M bearer tokens")
    expect(readme).toContain("AuthKit sessions are API-only")
    expect(readme).toContain("The MCP resource accepts only M2M tokens for its configured resource audience.")
    expect(readme).toContain("Every authenticated operation declares `401`, `403`, and `500` with `ErrorResponse`.")
    expect(readme).not.toContain("`429`")
    expect(readme).toContain("Any operation accepting input declares `400` and `413`;")
    expect(readme).toContain("a path-resource operation declares `404`;")
    expect(readme).toContain("model-backed or provider-backed operations declare `422` and `503`;")
    expect(readme).toContain("mutation operations declare `409`;")
    expect(readme).toContain("mutations with `If-Match` also declare `412`;")
    expect(readme).toContain("cacheable GET operations declare `304`.")
    expect(schemas).toContain("type ResourceResponse<T>")
    expect(schemas).toContain("type Page<T>")
    expect(schemas).toContain("type SearchPage<T> = Page<T>")
    expect(schemas).toContain("A cursor binds the caller, filters, fields, and sort.")
    expect(schemas).toContain("Changing them returns `400 invalid_request`.")
    expect(schemas).not.toContain("`rate_limited`")
  })

  it("derives a unique stable OpenAPI operation ID for every documented operation", () => {
    const ids = inventory().map(operationId)

    expect(new Set(ids)).toHaveProperty("size", 81)
    expect(ids).toContain("get__api__changes__by_changeId")
    expect(ids).toContain("get__api__bills__by_billId__votes")
    expect(ids).toContain("post__api__webhooks__by_webhookId__rotate_secret")
    expect(ids).toContain("delete__api__subscriptions__by_subscriptionId")
  })
})
