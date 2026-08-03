import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createStoreSource } from "./store.ts"

/*
 * The environment path is used rather than a stored token, so nothing here reads or writes the
 * OS config directory.
 */
const answers: Record<string, unknown> = {}
let sent: string[] = []

const fetched = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
    const body = String((init as RequestInit).body)
    const operation = /query (\w+)/.exec(body)?.[1] ?? ""
    sent.push(body)
    return Promise.resolve(
      new Response(JSON.stringify({ data: answers[operation] }), { headers: { "content-type": "application/json" } })
    )
  })

beforeEach(() => {
  sent = []
  vi.stubEnv("SHOPIFY_STORE", "fencing.myshopify.com")
  vi.stubEnv("SHOPIFY_ADMIN_TOKEN", "shpat_secret")
  answers.Shop = {
    shop: {
      id: "gid://shopify/Shop/84825276713",
      name: "Fencing Club",
      email: "hello@fencing.club",
      contactEmail: null,
      description: null,
      url: "https://fencing.club",
      myshopifyDomain: "fencing.myshopify.com",
      currencyCode: "USD",
      currencyFormats: { moneyFormat: "${{amount}}", moneyWithCurrencyFormat: "${{amount}} USD" },
      primaryDomain: { host: "fencing.club", url: "https://fencing.club" },
      shopPolicies: [],
      shopAddress: {
        address1: "1 Piste Way",
        address2: null,
        city: "Boston",
        province: "Massachusetts",
        provinceCode: "MA",
        zip: "02110",
        country: "US",
        phone: null
      }
    },
    giftCards: { nodes: [] },
    abandonedCheckouts: { nodes: [] }
  }
  fetched()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("createStoreSource", () => {
  it("reports the domain it is connected to", async () => {
    expect((await createStoreSource()).domain).toBe("fencing.myshopify.com")
  })

  it("asks for the shop once, however many orders are mapped", async () => {
    const store = await createStoreSource()

    await store.shop()
    await store.shop()

    expect(sent.filter((body) => body.includes("query Shop"))).toHaveLength(1)
  })

  it("lower-cases financial status, because that is how a template compares it", async () => {
    answers.Orders = {
      orders: {
        pageInfo: { hasNextPage: true, endCursor: "eyJsYXN0X2lkIjox" },
        nodes: [
          {
            id: "gid://shopify/Order/1",
            name: "#1001",
            createdAt: "2026-01-05T10:00:00Z",
            displayFinancialStatus: "PAID",
            currentSubtotalLineItemsQuantity: 3,
            customer: { displayName: "Alex Kim" },
            totalPriceSet: { shopMoney: { amount: "181.48", currencyCode: "USD" } }
          }
        ]
      }
    }
    const store = await createStoreSource()

    expect(await store.searchOrders({ query: "financial_status:paid" })).toEqual({
      next: "eyJsYXN0X2lkIjox",
      orders: [
        {
          id: "gid://shopify/Order/1",
          name: "#1001",
          createdAt: "2026-01-05T10:00:00Z",
          financialStatus: "paid",
          items: 3,
          customer: "Alex Kim",
          total: "181.48",
          currency: "USD"
        }
      ]
    })
  })

  it("fills in the fields the API may leave null, so a picker has something to show", async () => {
    answers.Orders = {
      orders: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            id: "gid://shopify/Order/2",
            name: "#1002",
            createdAt: "2026-01-06T10:00:00Z",
            displayFinancialStatus: null,
            currentSubtotalLineItemsQuantity: 1,
            customer: null,
            totalPriceSet: null
          }
        ]
      }
    }
    const store = await createStoreSource()

    expect(await store.searchOrders()).toEqual({
      next: undefined,
      orders: [
        {
          id: "gid://shopify/Order/2",
          name: "#1002",
          createdAt: "2026-01-06T10:00:00Z",
          financialStatus: "",
          items: 1,
          customer: "",
          total: "0",
          currency: ""
        }
      ]
    })
    expect(sent[0]).toContain(`"first":20`)
  })

  it("turns a customer into the summary a picker shows", async () => {
    answers.Customers = {
      customers: {
        nodes: [
          {
            id: "gid://shopify/Customer/1",
            displayName: "Alex Rivera",
            numberOfOrders: "3",
            defaultEmailAddress: { emailAddress: "alex@fencing.club" }
          },
          { id: "gid://shopify/Customer/2", displayName: null, numberOfOrders: "0", defaultEmailAddress: null }
        ]
      }
    }
    const store = await createStoreSource()

    expect(await store.searchCustomers("alex@")).toEqual([
      { id: "gid://shopify/Customer/1", name: "Alex Rivera", email: "alex@fencing.club", orderCount: 3 },
      { id: "gid://shopify/Customer/2", name: "", email: "", orderCount: 0 }
    ])
  })

  it("names the permission when an order cannot be read, rather than reporting nothing found", async () => {
    answers.Order = { order: null }
    const store = await createStoreSource()

    await expect(store.loadOrderVariables("gid://shopify/Order/9")).rejects.toThrow(/read_all_orders/)
  })
})
