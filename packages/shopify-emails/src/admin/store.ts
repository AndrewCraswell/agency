import { z } from "zod"
import { connectToStore } from "./connect.ts"
import { mapOrderToVariables, orderResponse, type PulledOrder, shopResponse } from "./mapOrder.ts"
import { CUSTOMERS_QUERY, ORDER_QUERY, ORDERS_QUERY, SHOP_QUERY } from "./queries.ts"

/*
 * Read access to a live store, so a preview can browse real orders instead of exporting fixtures.
 *
 * Queries go out through the Shopify CLI, which is a Node-only entry point kept apart from the
 * template DSL, which has to stay bundlable for the browser.
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
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
        displayFinancialStatus: z.string().nullable(),
        currentSubtotalLineItemsQuantity: z.number(),
        customer: z.object({ displayName: z.string() }).nullable(),
        totalPriceSet: z.object({ shopMoney: z.object({ amount: z.string(), currencyCode: z.string() }) }).nullable()
      })
    )
  })
})

/* Inferred rather than restated, so the public type cannot drift from what the API is parsed into. */
export type ShopSummary = z.infer<typeof shopResponse>["shop"]

/** The shop plus the store-wide records the notifications that carry no order are rendered with. */
type StoreSummary = z.infer<typeof shopResponse>

export type OrderSummary = {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly financialStatus: string
  readonly items: number
  readonly customer: string
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
  /** The cursor a previous page ended on, which is how the next one is asked for. */
  readonly after?: string
}

export type OrderPage = {
  readonly orders: readonly OrderSummary[]
  /** Where to carry on from, absent once there is nothing left to read. */
  readonly next: string | undefined
}

export type StoreSource = {
  readonly domain: string
  readonly shop: () => Promise<ShopSummary>
  readonly searchOrders: (search?: OrderSearch) => Promise<OrderPage>
  readonly searchCustomers: (query: string) => Promise<readonly CustomerSummary[]>
  readonly loadOrderVariables: (id: string) => Promise<PulledOrder>
}

export const createStoreSource = async (store?: string): Promise<StoreSource> => {
  const { client, domain } = await connectToStore(store)

  // Every order mapped from this source needs the shop, and it never changes mid-session.
  let pending: Promise<StoreSummary> | undefined
  const readStore = (): Promise<StoreSummary> => {
    pending ??= client({ query: SHOP_QUERY, schema: shopResponse })
    return pending
  }

  return {
    domain,
    shop: async () => (await readStore()).shop,

    searchOrders: async ({ query, first = 20, after } = {}) => {
      const { orders } = await client({
        query: ORDERS_QUERY,
        variables: { query: query || undefined, first, after },
        schema: ordersResponse
      })
      return {
        next: orders.pageInfo.hasNextPage ? (orders.pageInfo.endCursor ?? undefined) : undefined,
        orders: orders.nodes.map((node) => ({
          id: node.id,
          name: node.name,
          createdAt: node.createdAt,
          // Liquid compares these lower-cased, so the picker shows them the way a template sees them.
          financialStatus: (node.displayFinancialStatus ?? "").toLowerCase(),
          items: node.currentSubtotalLineItemsQuantity,
          customer: node.customer?.displayName ?? "",
          total: node.totalPriceSet?.shopMoney.amount ?? "0",
          currency: node.totalPriceSet?.shopMoney.currencyCode ?? ""
        }))
      }
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
      return mapOrderToVariables(order, await readStore())
    }
  }
}
