import { log, note, outro } from "@clack/prompts"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as build from "./build.ts"
import * as config from "./config.ts"
import * as shopifyCli from "./shopifyCli.ts"
import * as store from "./store.ts"
import type { StoreSource } from "./store.ts"
import * as storeSetup from "./storeSetup.ts"
import { runWizard } from "./wizard.ts"

/* Every prompt is answered from this queue, in the order the wizard reaches them. */
const answers = vi.hoisted(() => [] as unknown[])

vi.mock("@clack/prompts", () => ({
  cancel: vi.fn<(...args: never[]) => void>(),
  intro: vi.fn<(...args: never[]) => void>(),
  log: {
    error: vi.fn<(...args: never[]) => void>(),
    info: vi.fn<(...args: never[]) => void>(),
    step: vi.fn<(...args: never[]) => void>(),
    success: vi.fn<(...args: never[]) => void>(),
    warn: vi.fn<(...args: never[]) => void>()
  },
  note: vi.fn<(...args: never[]) => void>(),
  outro: vi.fn<(...args: never[]) => void>(),
  select: vi.fn<(...args: never[]) => Promise<unknown>>(async () => answers.shift()),
  spinner: () => ({ error: () => undefined, start: () => undefined, stop: () => undefined }),
  text: vi.fn<(...args: never[]) => Promise<unknown>>(async () => answers.shift())
}))

const DOMAIN = "8f3f5f-3.myshopify.com"
const SHOP = {
  contactEmail: null,
  currencyCode: "USD",
  currencyFormats: { moneyFormat: "${{amount}}", moneyWithCurrencyFormat: "${{amount}} USD" },
  description: null,
  email: "support@fencing.club",
  id: "gid://shopify/Shop/84825276713",
  myshopifyDomain: DOMAIN,
  name: "Fencing Club",
  primaryDomain: { host: "fencing.club", url: "https://fencing.club" },
  shopAddress: null,
  shopPolicies: [],
  url: "https://fencing.club"
}

const oneStore = () => {
  vi.spyOn(config, "listStores").mockResolvedValue({ active: DOMAIN, stores: [DOMAIN] })
  vi.spyOn(config, "setActiveStore").mockResolvedValue(DOMAIN)
  vi.spyOn(storeSetup, "chooseStore").mockResolvedValue(DOMAIN)
  vi.spyOn(storeSetup, "readShop").mockResolvedValue(SHOP)
}

afterEach(() => {
  answers.length = 0
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("runWizard", () => {
  it("authorises a store when none is set up, and remembers the one it proved", async () => {
    vi.spyOn(config, "listStores").mockResolvedValue({ active: undefined, stores: [] })
    vi.spyOn(storeSetup, "askDomain").mockResolvedValue(DOMAIN)
    vi.spyOn(storeSetup, "readShop").mockResolvedValue(SHOP)
    const authorised = vi.spyOn(shopifyCli, "authenticateStore").mockResolvedValue()
    const remembered = vi.spyOn(config, "rememberStore").mockResolvedValue(DOMAIN)
    answers.push("done")

    await runWizard()

    expect(authorised).toHaveBeenCalledWith(DOMAIN)
    expect(remembered).toHaveBeenCalledWith(DOMAIN)
    expect(note).toHaveBeenCalledWith(expect.stringContaining("Fencing Club"), "Connected")
  })

  it("reads nothing from a store the session never asked about", async () => {
    oneStore()
    const opened = vi.spyOn(store, "createStoreSource")
    answers.push("done")

    await runWizard()

    expect(opened).not.toHaveBeenCalled()
    expect(outro).toHaveBeenCalled()
  })

  it("says why an order list is empty rather than writing a fixture of nothing", async () => {
    oneStore()
    const loadOrderVariables = vi.fn<StoreSource["loadOrderVariables"]>()
    vi.spyOn(store, "createStoreSource").mockResolvedValue({
      domain: DOMAIN,
      loadOrderVariables,
      searchCustomers: async () => [],
      searchOrders: async () => ({ next: undefined, orders: [] }),
      shop: async () => {
        throw new Error("not asked")
      }
    })
    answers.push("pull", "done")

    await runWizard()

    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("read_all_orders"))
    expect(loadOrderVariables).not.toHaveBeenCalled()
  })

  it("reports a step that failed and comes back to the menu, rather than ending the session", async () => {
    oneStore()
    vi.spyOn(build, "buildTemplates").mockRejectedValue(new Error("dist is not writable"))
    answers.push("build", "done")

    await runWizard()

    expect(log.error).toHaveBeenCalledWith("dist is not writable")
    expect(outro).toHaveBeenCalled()
  })
})
