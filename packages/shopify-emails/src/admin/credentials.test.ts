import { mkdtemp, readFile, rm } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseStoreDomain } from "./credentials.ts"

/*
 * `credentialsPath` is resolved once when the module loads, so the tests that care where the token
 * lands re-import the module with the environment already set.
 */
const load = async () => {
  vi.resetModules()
  return import("./credentials.ts")
}

const onPlatform = async (platform: string) => {
  const original = Object.getOwnPropertyDescriptor(process, "platform")!
  Object.defineProperty(process, "platform", { configurable: true, value: platform })
  try {
    return (await load()).credentialsPath
  } finally {
    Object.defineProperty(process, "platform", original)
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

/*
 * This is the boundary that decides which host a merchant's long-lived Admin API token is sent to,
 * so it is tested for what it refuses rather than only for what it accepts.
 */
describe("parseStoreDomain", () => {
  it("accepts what a merchant is likely to paste", () => {
    expect(parseStoreDomain("shop.myshopify.com")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("  Shop.MyShopify.com  ")).toBe("shop.myshopify.com")
    expect(parseStoreDomain("https://shop.myshopify.com/admin")).toBe("shop.myshopify.com")
  })

  it("refuses a host that only looks like Shopify", () => {
    expect(() => parseStoreDomain("shop.myshopify.com.evil.test")).toThrow(/not a myshopify.com store domain/)
    expect(() => parseStoreDomain("evil.test")).toThrow(/not a myshopify.com store domain/)
    expect(() => parseStoreDomain("myshopify.com")).toThrow(/not a myshopify.com store domain/)
  })

  it("refuses credentials and ports smuggled into the authority", () => {
    expect(() => parseStoreDomain("https://shop.myshopify.com@evil.test")).toThrow(/not a myshopify.com store domain/)
    expect(() => parseStoreDomain("shop.myshopify.com:8443")).toThrow(/not a myshopify.com store domain/)
  })
})

describe("credentialsPath", () => {
  it("uses the roaming profile on Windows", async () => {
    vi.stubEnv("APPDATA", join("C:", "Users", "test", "AppData", "Roaming"))
    expect(await onPlatform("win32")).toBe(
      join("C:", "Users", "test", "AppData", "Roaming", "shopify-emails", "credentials.json")
    )
  })

  it("falls back to the usual Windows location when APPDATA is unset", async () => {
    vi.stubEnv("APPDATA", undefined)
    expect(await onPlatform("win32")).toBe(join(homedir(), "AppData", "Roaming", "shopify-emails", "credentials.json"))
  })

  it("uses Application Support on macOS", async () => {
    expect(await onPlatform("darwin")).toBe(
      join(homedir(), "Library", "Application Support", "shopify-emails", "credentials.json")
    )
  })

  it("honours XDG_CONFIG_HOME elsewhere, and defaults to ~/.config without it", async () => {
    vi.stubEnv("XDG_CONFIG_HOME", join("/", "srv", "config"))
    expect(await onPlatform("linux")).toBe(join("/", "srv", "config", "shopify-emails", "credentials.json"))
    vi.stubEnv("XDG_CONFIG_HOME", undefined)
    expect(await onPlatform("linux")).toBe(join(homedir(), ".config", "shopify-emails", "credentials.json"))
  })
})

describe("storing and resolving a token", () => {
  let dir = ""
  let credentials: typeof import("./credentials.ts")

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "shopify-emails-credentials-"))
    vi.stubEnv("APPDATA", dir)
    vi.stubEnv("XDG_CONFIG_HOME", dir)
    vi.stubEnv("SHOPIFY_STORE", undefined)
    vi.stubEnv("SHOPIFY_ADMIN_TOKEN", undefined)
    credentials = await load()
  })

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true })
  })

  it("keeps the token under the store it belongs to, trimmed of what a paste carries", async () => {
    await credentials.saveToken("https://fencing-club.myshopify.com/admin", "  shpat_one  ")
    expect(JSON.parse(await readFile(credentials.credentialsPath, "utf8"))).toEqual({
      "fencing-club.myshopify.com": "shpat_one"
    })
  })

  it("adds a second store rather than replacing the first", async () => {
    await credentials.saveToken("one.myshopify.com", "shpat_one")
    await credentials.saveToken("two.myshopify.com", "shpat_two")
    expect(await credentials.resolveCredentials("two.myshopify.com")).toEqual({
      store: "two.myshopify.com",
      token: "shpat_two"
    })
  })

  it("reads the only logged-in store when none was named", async () => {
    await credentials.saveToken("one.myshopify.com", "shpat_one")
    expect(await credentials.resolveCredentials()).toEqual({ store: "one.myshopify.com", token: "shpat_one" })
  })

  it("prefers the environment, so CI never writes a token to disk", async () => {
    await credentials.saveToken("one.myshopify.com", "shpat_one")
    vi.stubEnv("SHOPIFY_STORE", "https://ci.myshopify.com")
    vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "shpat_ci")
    expect(await credentials.resolveCredentials()).toEqual({ store: "ci.myshopify.com", token: "shpat_ci" })
  })

  it("says how to log in when nothing is stored", async () => {
    await expect(credentials.resolveCredentials()).rejects.toThrow(/No store is logged in/)
  })

  it("names the store that is missing a token", async () => {
    await credentials.saveToken("one.myshopify.com", "shpat_one")
    await expect(credentials.resolveCredentials("two.myshopify.com")).rejects.toThrow(
      /No token stored for two.myshopify.com/
    )
  })

  it("treats an unreadable credentials file as no logins at all", async () => {
    await credentials.saveToken("one.myshopify.com", "shpat_one")
    await rm(credentials.credentialsPath)
    await expect(credentials.resolveCredentials()).rejects.toThrow(/No store is logged in/)
  })
})
