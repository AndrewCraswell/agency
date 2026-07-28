import { afterEach, describe, expect, it, vi } from "vitest"

const synchronizeShopifyStore = vi.hoisted(() =>
  vi.fn<() => Promise<{ tenantId: string; resources: unknown[] }>>(async () => ({
    tenantId: "10000000-0000-4000-8000-000000000001",
    resources: [{}, {}, {}]
  }))
)
const admin = vi.hoisted(() => vi.fn<(shop: string) => Promise<{ admin: { graphql: () => Promise<Response> } }>>())

vi.mock("../shopify-sync/synchronize.server", () => ({ synchronizeShopifyStore }))
vi.mock("../shopify.server", () => ({ unauthenticated: { admin } }))

const { action } = await import("./internal.sync-store")

const secret = "correct-horse-battery-staple"

function request(body: unknown, headers: Record<string, string> = { Authorization: `Bearer ${secret}` }) {
  return new Request("https://example.test/internal/sync-store", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  })
}

function invoke(sent: Request) {
  return action({
    request: sent,
    params: {},
    context: {} as never,
    url: new URL(sent.url),
    pattern: "/internal/sync-store"
  })
}

async function statusOf(sent: Request) {
  const result = await invoke(sent)
  if (result instanceof Response) {
    return result.status
  }
  return "init" in result ? result.init?.status : 200
}

afterEach(() => {
  vi.unstubAllEnvs()
  synchronizeShopifyStore.mockClear()
  admin.mockReset()
  admin.mockResolvedValue({ admin: { graphql: vi.fn<() => Promise<Response>>() } })
})

describe("the single store sync endpoint", () => {
  it("refuses everyone when no secret is configured", async () => {
    // A deployment that forgets to set this should lose its scheduled sync, not publish an endpoint that reads any
    // store for anyone who finds the address.
    vi.stubEnv("INTERNAL_TASK_TOKEN", "")

    await expect(statusOf(request({ shop_domain: "contosocamp.myshopify.com" }))).resolves.toBe(401)
    expect(synchronizeShopifyStore).not.toHaveBeenCalled()
  })

  it("refuses a caller without the secret", async () => {
    vi.stubEnv("INTERNAL_TASK_TOKEN", secret)
    const body = { shop_domain: "contosocamp.myshopify.com" }

    await expect(statusOf(request(body, {}))).resolves.toBe(401)
    await expect(statusOf(request(body, { Authorization: "Bearer wrong-horse-battery-staple" }))).resolves.toBe(401)
    await expect(statusOf(request(body, { Authorization: "Bearer correct" }))).resolves.toBe(401)
    expect(synchronizeShopifyStore).not.toHaveBeenCalled()
  })

  it("refuses anything that is not a shop address", async () => {
    // Knowing the secret buys the right to ask for a sync, not the right to point the app at an arbitrary host.
    vi.stubEnv("INTERNAL_TASK_TOKEN", secret)

    await expect(statusOf(request({}))).resolves.toBe(400)
    await expect(statusOf(request({ shop_domain: "evil.example.com" }))).resolves.toBe(400)
    await expect(statusOf(request({ shop_domain: "https://contosocamp.myshopify.com" }))).resolves.toBe(400)
    expect(synchronizeShopifyStore).not.toHaveBeenCalled()
  })

  it("syncs the named store and reports the tenant it landed in", async () => {
    vi.stubEnv("INTERNAL_TASK_TOKEN", secret)

    await expect(invoke(request({ shop_domain: "ContosoCamp.myshopify.com" }))).resolves.toEqual({
      shop_domain: "contosocamp.myshopify.com",
      tenant_id: "10000000-0000-4000-8000-000000000001",
      resource_count: 3
    })
    expect(admin).toHaveBeenCalledWith("contosocamp.myshopify.com")
  })

  it("writes nothing for a store the app cannot open", async () => {
    // The token is checked before any row is touched, so a shop the app was never installed on leaves no trace.
    vi.stubEnv("INTERNAL_TASK_TOKEN", secret)
    admin.mockRejectedValue(new Error("No offline session"))

    await expect(invoke(request({ shop_domain: "stranger.myshopify.com" }))).rejects.toThrow("No offline session")
    expect(synchronizeShopifyStore).not.toHaveBeenCalled()
  })

  it("does the work only for a POST", async () => {
    vi.stubEnv("INTERNAL_TASK_TOKEN", secret)
    const sent = new Request("https://example.test/internal/sync-store", {
      method: "PUT",
      headers: { Authorization: `Bearer ${secret}` }
    })

    await expect(statusOf(sent)).resolves.toBe(405)
    expect(synchronizeShopifyStore).not.toHaveBeenCalled()
  })
})
