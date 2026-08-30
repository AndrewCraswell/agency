import { note, select, text } from "@clack/prompts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as config from "./config.ts"
import { connectToStore } from "./connect.ts"
import { authenticateStore } from "./shopifyCli.ts"
import {
  ADD_STORE,
  answered,
  askDomain,
  CANCELLED,
  chooseStore,
  login,
  logout,
  readShop,
  requireTty
} from "./storeSetup.ts"

vi.mock("@clack/prompts", () => ({
  note: vi.fn<(...args: never[]) => void>(),
  select: vi.fn<(...args: never[]) => void>(),
  text: vi.fn<(...args: never[]) => void>()
}))
vi.mock("./connect.ts", () => ({ connectToStore: vi.fn<(...args: never[]) => void>() }))
vi.mock("./shopifyCli.ts", () => ({ authenticateStore: vi.fn<(...args: never[]) => void>() }))

const DOMAIN = "fencing.myshopify.com"
const SHOP = {
  contactEmail: null,
  currencyCode: "USD",
  currencyFormats: { moneyFormat: "${{amount}}", moneyWithCurrencyFormat: "${{amount}} USD" },
  description: null,
  email: "support@fencing.club",
  id: "gid://shopify/Shop/1",
  myshopifyDomain: DOMAIN,
  name: "Fencing Club",
  primaryDomain: { host: "fencing.club", url: "https://fencing.club" },
  shopAddress: null,
  shopPolicies: [],
  url: "https://fencing.club"
}
const SHOP_RESPONSE = { abandonedCheckouts: { nodes: [] }, giftCards: { nodes: [] }, shop: SHOP }

let written = ""
let originalTty: boolean | undefined

beforeEach(() => {
  vi.resetAllMocks()
  written = ""
  originalTty = process.stdin.isTTY
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    written += String(chunk)
    return true
  })
})

afterEach(() => {
  Reflect.set(process.stdin, "isTTY", originalTty)
  vi.restoreAllMocks()
})

describe("prompt helpers", () => {
  it("requires a named store outside a terminal and permits an interactive one", () => {
    Reflect.set(process.stdin, "isTTY", undefined)
    expect(() => requireTty("login")).toThrow("login needs --store")

    Reflect.set(process.stdin, "isTTY", true)
    expect(() => requireTty("login")).not.toThrow()
  })

  it("returns answers and turns cancellation symbols into a shared cancellation error", () => {
    expect(answered("store")).toBe("store")
    expect(() => answered(Symbol("cancel"))).toThrow(CANCELLED)
  })

  it("explains and validates the store handle prompt", async () => {
    vi.mocked(text).mockImplementation(async (options) => {
      const validate = options.validate
      expect(typeof validate).toBe("function")
      if (typeof validate !== "function") {
        throw new Error("The store prompt has no validator")
      }
      expect(await validate("fencing.club")).toContain("not a store handle")
      expect(await validate("fencing")).toBeUndefined()
      return "Fencing.MyShopify.com"
    })

    await expect(askDomain()).resolves.toBe(DOMAIN)
    expect(note).toHaveBeenCalledWith(expect.stringContaining("admin.shopify.com/store"), "Which store?")
  })

  it("marks the active store and appends caller-provided choices", async () => {
    vi.mocked(select).mockResolvedValue(DOMAIN)

    await expect(
      chooseStore("Which store?", { active: DOMAIN, stores: [DOMAIN, "other.myshopify.com"] }, [
        { label: "Add", value: ADD_STORE }
      ])
    ).resolves.toBe(DOMAIN)

    const options = vi.mocked(select).mock.calls[0]![0].options
    expect(options).toHaveLength(3)
    expect(options[0]).toMatchObject({ hint: expect.any(String), value: DOMAIN })
    expect(options[1]).toMatchObject({ hint: undefined, value: "other.myshopify.com" })
  })
})

describe("readShop", () => {
  it("verifies access by reading and validating the shop", async () => {
    vi.mocked(connectToStore).mockResolvedValue({
      client: async (request) => request.schema.parse(SHOP_RESPONSE),
      domain: DOMAIN
    })

    await expect(readShop(DOMAIN)).resolves.toEqual(SHOP)
  })
})

describe("login", () => {
  beforeEach(() => {
    Reflect.set(process.stdin, "isTTY", true)
    vi.spyOn(config, "rememberStore").mockResolvedValue(DOMAIN)
    vi.spyOn(config, "setActiveStore").mockResolvedValue(DOMAIN)
    vi.mocked(authenticateStore).mockResolvedValue()
    vi.mocked(connectToStore).mockResolvedValue({
      client: async (request) => request.schema.parse(SHOP_RESPONSE),
      domain: DOMAIN
    })
  })

  it("sets up a store named on the command line", async () => {
    await login("fencing")

    expect(authenticateStore).toHaveBeenCalledWith(DOMAIN)
    expect(config.rememberStore).toHaveBeenCalledWith(DOMAIN)
    expect(written).toContain(`Set up Fencing Club (${DOMAIN})`)
  })

  it("asks for a first store when none are known", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: undefined, stores: [] })
    vi.mocked(text).mockResolvedValue("fencing")

    await login()

    expect(authenticateStore).toHaveBeenCalledWith(DOMAIN)
  })

  it("adds another store from the known-store menu", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: DOMAIN, stores: [DOMAIN] })
    vi.mocked(select).mockResolvedValue(ADD_STORE)
    vi.mocked(text).mockResolvedValue("other")

    await login()

    expect(authenticateStore).toHaveBeenCalledWith("other.myshopify.com")
  })

  it("selects and remembers an already authorised store", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: undefined, stores: [DOMAIN] })
    vi.mocked(select).mockResolvedValue(DOMAIN)

    await login()

    expect(authenticateStore).not.toHaveBeenCalled()
    expect(config.setActiveStore).toHaveBeenCalledWith(DOMAIN)
    expect(written).toContain(`Using Fencing Club (${DOMAIN})`)
  })
})

describe("logout", () => {
  beforeEach(() => {
    Reflect.set(process.stdin, "isTTY", true)
    vi.spyOn(config, "forgetStore").mockResolvedValue(DOMAIN)
  })

  it("forgets a named store and explains how to revoke its Shopify grant", async () => {
    await logout("fencing")

    expect(config.forgetStore).toHaveBeenCalledWith("fencing")
    expect(written).toContain("shopify auth logout")
    expect(written).toContain("login --store fencing")
  })

  it("reports when there is no configured store to forget", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: undefined, stores: [] })

    await expect(logout()).rejects.toThrow("No store is set up")
  })

  it("forgets the store selected from the interactive list", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: DOMAIN, stores: [DOMAIN] })
    vi.mocked(select).mockResolvedValue(DOMAIN)

    await logout()

    expect(config.forgetStore).toHaveBeenCalledWith(DOMAIN)
    expect(written).toContain(`Forgot ${DOMAIN}`)
  })
})
