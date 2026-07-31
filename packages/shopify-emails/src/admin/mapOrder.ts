import { z } from "zod"
import { lineItemsSample, placedOrderSample } from "../samples/order.ts"
import { customerSample, shopSample } from "../samples/store.ts"
import type { Transaction } from "../variables/order.ts"
import type { OrderAddress } from "../variables/primitives.ts"
import type { OrderVariables } from "../variables/shared.ts"

/*
 * Admin API order to the variables a notification is rendered with.
 *
 * These are two different data models wearing similar names, and the gaps are what this file is
 * for. The Admin API returns money as a decimal string in the shop's currency; notification Liquid
 * receives an integer count of the currency's subunit, so every amount is multiplied by 100. Miss
 * that and a template renders every price a hundred times too low while still looking plausible.
 *
 * The other gaps: status enums arrive screaming and Liquid compares them lower-cased, images are
 * nested objects here and flat strings there, and cards expose a masked number rather than the last
 * four digits on their own.
 *
 * Shopify only fills many of these in as it sends, so whatever the Admin API cannot answer keeps
 * the sample's value. A live order overrides what it knows and nothing more.
 */

const money = z.object({ shopMoney: z.object({ amount: z.string() }) })

/** Decimal string in the shop's currency to the integer subunit count Liquid compares against. */
const subunits = (value: z.infer<typeof money> | null | undefined): number => {
  const amount = Number(value?.shopMoney.amount ?? 0)
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

const addressSchema = z
  .object({
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    address1: z.string().nullable(),
    address2: z.string().nullable(),
    city: z.string().nullable(),
    province: z.string().nullable(),
    provinceCode: z.string().nullable(),
    zip: z.string().nullable(),
    country: z.string().nullable(),
    countryCodeV2: z.string().nullable(),
    phone: z.string().nullable()
  })
  .nullable()

const orderSchema = z.object({
  order: z
    .object({
      name: z.string(),
      statusPageUrl: z.string(),
      displayFinancialStatus: z.string().nullable(),
      requiresShipping: z.boolean(),
      subtotalPriceSet: money.nullable(),
      totalDiscountsSet: money.nullable(),
      totalTaxSet: money.nullable(),
      totalPriceSet: money.nullable(),
      totalShippingPriceSet: money.nullable(),
      customer: z
        .object({
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          displayName: z.string().nullable(),
          defaultEmailAddress: z.object({ emailAddress: z.string().nullable() }).nullable()
        })
        .nullable(),
      shippingAddress: addressSchema,
      billingAddress: addressSchema,
      shippingLine: z.object({ title: z.string(), originalPriceSet: money.nullable() }).nullable(),
      lineItems: z.object({
        nodes: z.array(
          z.object({
            title: z.string(),
            variantTitle: z.string().nullable(),
            quantity: z.number(),
            image: z.object({ url: z.string() }).nullable(),
            originalTotalSet: money.nullable(),
            discountedTotalSet: money.nullable(),
            product: z
              .object({
                title: z.string(),
                featuredMedia: z
                  .object({ preview: z.object({ image: z.object({ url: z.string() }).nullable() }).nullable() })
                  .nullable()
              })
              .nullable()
          })
        )
      }),
      transactions: z.array(
        z.object({
          kind: z.string(),
          status: z.string(),
          gateway: z.string().nullable(),
          formattedGateway: z.string().nullable(),
          amountSet: money.nullable(),
          paymentDetails: z
            .object({
              company: z.string().nullable().optional(),
              number: z.string().nullable().optional(),
              paymentMethodName: z.string().nullable().optional()
            })
            .nullable()
        })
      )
    })
    .nullable()
})

const shopSchema = z.object({
  shop: z.object({
    name: z.string(),
    email: z.string(),
    url: z.string(),
    shopAddress: z
      .object({
        address1: z.string().nullable(),
        city: z.string().nullable(),
        provinceCode: z.string().nullable(),
        zip: z.string().nullable(),
        country: z.string().nullable()
      })
      .nullable()
  })
})

export const orderResponse = orderSchema
export const shopResponse = shopSchema

type AdminOrder = NonNullable<z.infer<typeof orderSchema>["order"]>
type AdminShop = z.infer<typeof shopSchema>["shop"]
type AdminAddress = z.infer<typeof addressSchema>

const text = (value: string | null | undefined): string => value ?? ""

const mapAddress = (address: AdminAddress): OrderAddress => ({
  ...placedOrderSample.shipping_address,
  first_name: text(address?.firstName),
  last_name: text(address?.lastName),
  name: `${text(address?.firstName)} ${text(address?.lastName)}`.trim(),
  address1: text(address?.address1),
  address2: address?.address2 ?? null,
  city: text(address?.city),
  province: text(address?.province),
  province_code: text(address?.provinceCode),
  zip: text(address?.zip),
  country: text(address?.country),
  country_code: text(address?.countryCodeV2),
  phone: address?.phone ?? null
})

/** Cards come back masked, as `•••• •••• •••• 4242`, so the digits Liquid wants are the tail. */
const lastFour = (masked: string | null | undefined): string => (masked ?? "").replace(/\D/g, "").slice(-4)

const transactionKinds = ["authorization", "capture", "change", "refund", "sale", "void"] as const
const transactionStatuses = ["error", "failure", "pending", "success"] as const

/** The Admin API screams its enums and can name kinds Liquid never sees, so anything unknown falls back. */
const transactionKind = (kind: string): Transaction["kind"] =>
  transactionKinds.find((known) => known === kind.toLowerCase()) ?? "sale"

const transactionStatus = (status: string): Transaction["status"] =>
  transactionStatuses.find((known) => known === status.toLowerCase()) ?? "success"

export const mapOrderToVariables = (order: AdminOrder, shop: AdminShop): OrderVariables => {
  const lineItems = order.lineItems.nodes.map((line) => ({
    ...lineItemsSample[0]!,
    title: line.title,
    variant_title: line.variantTitle ?? null,
    quantity: line.quantity,
    image: text(line.image?.url),
    original_line_price: subunits(line.originalTotalSet),
    final_line_price: subunits(line.discountedTotalSet),
    product: {
      ...lineItemsSample[0]!.product,
      title: text(line.product?.title),
      featured_image: text(line.product?.featuredMedia?.preview?.image?.url)
    },
    /*
     * The Admin API reports discounts per allocation, but the notification only ever shows a
     * title and an amount, so the line's own shortfall is the honest total to attribute.
     */
    discount_allocations: []
  }))

  return {
    ...placedOrderSample,
    custom_message: "",
    delivery_method_for_subtotal: text(order.shippingLine?.title),

    name: order.name,
    order_name: order.name,
    order_status_url: order.statusPageUrl,
    customer_order_url: order.statusPageUrl,
    order: { ...placedOrderSample.order, name: order.name, order_status_url: order.statusPageUrl },

    shop: {
      ...shopSample,
      name: shop.name,
      email: shop.email,
      url: shop.url,
      address: {
        ...shopSample.address,
        address1: text(shop.shopAddress?.address1),
        city: text(shop.shopAddress?.city),
        province: text(shop.shopAddress?.provinceCode),
        zip: text(shop.shopAddress?.zip),
        country: text(shop.shopAddress?.country)
      }
    },
    shop_name: shop.name,

    customer: {
      ...customerSample,
      first_name: text(order.customer?.firstName),
      last_name: text(order.customer?.lastName),
      name: text(order.customer?.displayName),
      email: text(order.customer?.defaultEmailAddress?.emailAddress)
    },
    email: text(order.customer?.defaultEmailAddress?.emailAddress),

    shipping_address: mapAddress(order.shippingAddress),
    billing_address: mapAddress(order.billingAddress),

    requires_shipping: order.requiresShipping,
    line_items: lineItems,
    subtotal_line_items: lineItems,
    unfulfilled_line_items: lineItems,
    item_count: lineItems.reduce((total, line) => total + line.quantity, 0),

    shipping_method: {
      ...placedOrderSample.shipping_method,
      title: text(order.shippingLine?.title),
      price: subunits(order.shippingLine?.originalPriceSet)
    },
    shipping_price: subunits(order.totalShippingPriceSet),
    subtotal_price: subunits(order.subtotalPriceSet),
    total_discounts: subunits(order.totalDiscountsSet),
    discounts_amount: subunits(order.totalDiscountsSet),
    discounts_savings: -subunits(order.totalDiscountsSet),
    tax_price: subunits(order.totalTaxSet),
    total_price: subunits(order.totalPriceSet),
    financial_status: text(order.displayFinancialStatus).toLowerCase(),

    transactions: order.transactions.map((transaction) => ({
      ...placedOrderSample.transactions[0]!,
      kind: transactionKind(transaction.kind),
      status: transactionStatus(transaction.status),
      amount: subunits(transaction.amountSet),
      gateway_display_name: text(transaction.formattedGateway ?? transaction.gateway),
      payment_details: {
        ...placedOrderSample.transactions[0]!.payment_details,
        credit_card_company: text(transaction.paymentDetails?.company),
        credit_card_last_four_digits: lastFour(transaction.paymentDetails?.number)
      }
    }))
  }
}
