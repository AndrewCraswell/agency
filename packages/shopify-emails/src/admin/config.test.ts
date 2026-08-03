import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/*
 * This is the boundary that decides which host a store query is sent to, so it is tested for what
 * it refuses rather than only for what it accepts.
 */
describe("parseStoreDomain", () => {
  it("accepts the handle on its own, which is all anyone is asked for", async () => {
    const { parseStoreDomain } = await import("./config.ts")
    expect(parseStoreDomain("shop")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("  8f3f5f-3  ")).toBe("8f3f5f-3.myshopify.com")
  })

  it("accepts what a merchant is likely to paste around it", async () => {
    const { parseStoreDomain } = await import("./config.ts")
    expect(parseStoreDomain("shop.myshopify.com")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("  Shop.MyShopify.com  ")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("https://shop.myshopify.com/admin")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("https://admin.shopify.com/store/shop")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("https://admin.shopify.com/store/shop/orders")).toBe("shop.myshopify.com")
  })

  it("refuses a host that only looks like Shopify", async () => {
    const { parseStoreDomain } = await import("./config.ts")
    expect(() => parseStoreDomain("shop.myshopify.com.evil.test")).toThrow(/not a store handle/)
    expect(() => parseStoreDomain("evil.test")).toThrow(/not a store handle/)
    expect(() => parseStoreDomain("myshopify.com")).toThrow(/not a store handle/)
  })

  it("refuses credentials and ports smuggled into the authority", async () => {
    const { parseStoreDomain } = await import("./config.ts")
    expect(() => parseStoreDomain("https://shop.myshopify.com@evil.test")).toThrow(/not a store handle/)
    expect(() => parseStoreDomain("shop.myshopify.com:8443")).toThrow(/not a store handle/)
  })

  it("refuses a suffix with nothing in front of it", async () => {
    const { parseStoreDomain } = await import("./config.ts")
    expect(() => parseStoreDomain(".myshopify.com")).toThrow(/not a store handle/)
    expect(() => parseStoreDomain("https://admin.shopify.com/store/")).toThrow(/not a store handle/)
  })
})

/*
 * `configPath` is resolved once when the module loads, so the tests that care where it lands have to
 * re-import after stubbing the environment.
 */
const load = () => {
  vi.resetModules()
  return import("./config.ts")
}

describe("configPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const pathOn = async (platform: string) => {
    vi.stubGlobal("process", { ...process, platform })
    return (await load()).configPath
  }

  it("uses the roaming profile on Windows", async () => {
    vi.stubEnv("APPDATA", join("C:", "Users", "test", "AppData", "Roaming"))
    expect(await pathOn("win32")).toBe(
      join("C:", "Users", "test", "AppData", "Roaming", "shopify-emails", "config.json")
    )
  })

  it("uses Application Support on macOS", async () => {
    expect(await pathOn("darwin")).toContain(join("Library", "Application Support", "shopify-emails", "config.json"))
  })

  it("honours XDG_CONFIG_HOME elsewhere", async () => {
    vi.stubEnv("XDG_CONFIG_HOME", join("/tmp", "xdg"))
    expect(await pathOn("linux")).toBe(join("/tmp", "xdg", "shopify-emails", "config.json"))
  })
})

/*
 * Which store a command reads when none is named. It used to be whichever was set up first, which a
 * second login changed invisibly, so the choice is now written down and can be revisited.
 */
describe("choosing between stores", () => {
  let directory: string
  let config: typeof import("./config.ts")

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "shopify-emails-config-"))
    vi.stubEnv("APPDATA", directory)
    vi.stubEnv("XDG_CONFIG_HOME", directory)
    vi.stubEnv("SHOPIFY_STORE", "")
    config = await load()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(directory, { force: true, recursive: true })
  })

  it("has nothing to offer before a store is set up", async () => {
    expect(await config.listStores()).toEqual({ active: undefined, stores: [] })
    await expect(config.resolveStore()).rejects.toThrow(/No store is set up/)
  })

  it("keeps no secret on disk, only the choice", async () => {
    await config.rememberStore("one")
    expect(JSON.parse(await readFile(config.configPath, "utf8"))).toEqual({
      active: "one.myshopify.com",
      stores: ["one.myshopify.com"]
    })
  })

  it("makes the store just set up the active one", async () => {
    await config.rememberStore("one")
    await config.rememberStore("two")
    expect(await config.resolveStore()).toBe("two.myshopify.com")
    expect(await config.listStores()).toEqual({
      active: "two.myshopify.com",
      stores: ["one.myshopify.com", "two.myshopify.com"]
    })
  })

  it("switches back to a store already set up", async () => {
    await config.rememberStore("one")
    await config.rememberStore("two")
    expect(await config.setActiveStore("one")).toBe("one.myshopify.com")
    expect(await config.resolveStore()).toBe("one.myshopify.com")
  })

  it("refuses to activate a store nobody set up", async () => {
    await config.rememberStore("one")
    await expect(config.setActiveStore("two")).rejects.toThrow(/two.myshopify.com has not been set up/)
  })

  it("moves the choice on when the active store is forgotten", async () => {
    await config.rememberStore("one")
    await config.rememberStore("two")
    expect(await config.forgetStore("two")).toBe("two.myshopify.com")
    expect(await config.listStores()).toEqual({ active: "one.myshopify.com", stores: ["one.myshopify.com"] })
  })

  it("leaves the choice alone when another store is forgotten", async () => {
    await config.rememberStore("one")
    await config.rememberStore("two")
    await config.forgetStore("one")
    expect(await config.resolveStore()).toBe("two.myshopify.com")
  })

  it("refuses to forget a store nobody set up", async () => {
    await expect(config.forgetStore("one")).rejects.toThrow(/has not been set up/)
  })

  it("lets the environment name a store without any config at all", async () => {
    vi.stubEnv("SHOPIFY_STORE", "ci")
    expect(await config.resolveStore()).toBe("ci.myshopify.com")
  })

  it("still prefers a store named outright", async () => {
    await config.rememberStore("one")
    expect(await config.resolveStore("two")).toBe("two.myshopify.com")
  })
})

describe("storeHandle", () => {
  it("drops the suffix nobody typed", async () => {
    const { storeHandle } = await import("./config.ts")
    expect(storeHandle("8f3f5f-3.myshopify.com")).toBe("8f3f5f-3")
  })
})
