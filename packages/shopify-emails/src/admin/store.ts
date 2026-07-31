import { z } from "zod"
import type { OrderVariables } from "../variables/shared.ts"
import { createAdminClient } from "./client.ts"
import { resolveCredentials } from "./credentials.ts"
import { mapOrderToVariables, orderResponse, shopResponse } from "./mapOrder.ts"
import { CUSTOMERS_QUERY, ORDER_QUERY, ORDERS_QUERY, SHOP_QUERY } from "./queries.ts"

/*
 * Read access to a live store, so a preview can browse real orders instead of exporting fixtures.
 *
 * This reads a token from the OS config directory and talks to the Admin API, so it is a Node-only
 * entry point kept apart from the template DSL, which has to stay bundlable for the browser.
 */

const customersResponse = z.object({
  customers: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        displayName: z.string().nullable(),
        numberOfOrders: z.string(),
        defaultEmailAddress: z.object({ emailAddress: z.string().nullable() }).nullable()
      })
    )
  })
})

const ordersResponse = z.object({
  orders: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
        displayFinancialStatus: z.string().nullable(),
        totalPriceSet: z.object({ shopMoney: z.object({ amount: z.string(), currencyCode: z.string() }) }).nullable()
      })
    )
  })
})

/* Inferred rather than restated, so the public type cannot drift from what the API is parsed into. */
export type ShopSummary = z.infer<typeof shopResponse>["shop"]

export type OrderSummary = {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly financialStatus: string
  readonly total: string
  readonly currency: string
}

export type CustomerSummary = {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly orderCount: number
}

export type OrderSearch = {
  readonly query?: string
  readonly first?: number
}

export type StoreSource = {
  readonly domain: string
  readonly shop: () => Promise<ShopSummary>
  readonly searchOrders: (search?: OrderSearch) => Promise<readonly OrderSummary[]>
  readonly searchCustomers: (query: string) => Promise<readonly CustomerSummary[]>
  readonly loadOrderVariables: (id: string) => Promise<OrderVariables>
}

export const createStoreSource = async (store?: string): Promise<StoreSource> => {
  const credentials = await resolveCredentials(store)
  const client = createAdminClient(credentials)

  // Every order mapped from this source needs the shop, and it never changes mid-session.
  let pendingShop: Promise<ShopSummary> | undefined
  const shop = (): Promise<ShopSummary> => {
    pendingShop ??= client({ query: SHOP_QUERY, schema: shopResponse }).then((body) => body.shop)
    return pendingShop
  }

  return {
    domain: credentials.store,
    shop,

    searchOrders: async ({ query, first = 20 } = {}) => {
      const { orders } = await client({
        query: ORDERS_QUERY,
        variables: { query: query || undefined, first },
        schema: ordersResponse
      })
      return orders.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        // Liquid compares these lower-cased, so the picker shows them the way a template sees them.
        financialStatus: (node.displayFinancialStatus ?? "").toLowerCase(),
        total: node.totalPriceSet?.shopMoney.amount ?? "0",
        currency: node.totalPriceSet?.shopMoney.currencyCode ?? ""
      }))
    },

    searchCustomers: async (query) => {
      const { customers } = await client({ query: CUSTOMERS_QUERY, variables: { query }, schema: customersResponse })
      return customers.nodes.map((node) => ({
        id: node.id,
        name: node.displayName ?? "",
        email: node.defaultEmailAddress?.emailAddress ?? "",
        orderCount: Number(node.numberOfOrders)
      }))
    },

    loadOrderVariables: async (id) => {
      const { order } = await client({ query: ORDER_QUERY, variables: { id }, schema: orderResponse })
      if (!order) {
        throw new Error(`No order ${id} is readable. Only the last 60 days are, without read_all_orders.`)
      }
      return mapOrderToVariables(order, await shop())
    }
  }
}
