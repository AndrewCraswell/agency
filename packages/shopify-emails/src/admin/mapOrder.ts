import { z } from "zod"
import { lineItemsSample, placedOrderSample } from "../samples/order.ts"
import { customerSample, shopSample } from "../samples/store.ts"
import { templateSamples } from "../samples/templates.ts"
import type { AbandonmentVariables } from "../variables/campaign.ts"
import type { Fulfillment } from "../variables/fulfillment.ts"
import type { DiscountApplication, LineItem, TaxLine, Transaction } from "../variables/order.ts"
import type { GiftCard, IssuedStoreCredit, PaymentSchedule, PaymentTerms } from "../variables/payments.ts"
import type { Cents, CustomerAddress, LiquidTime, OrderAddress } from "../variables/primitives.ts"
import type { Product, ProductVariant } from "../variables/product.ts"
import type { RefundLineItem, ReturnDelivery, ReturnDrop } from "../variables/returns.ts"
import type { OrderVariables } from "../variables/shared.ts"
import type { CompanyLocation, ShopPolicy } from "../variables/store.ts"

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
const cents = (amount: string | null | undefined): number => {
  const value = Number(amount ?? 0)
  return Number.isFinite(value) ? Math.round(value * 100) : 0
}

const subunits = (value: z.infer<typeof money> | null | undefined): number => cents(value?.shopMoney.amount)

/** `gid://shopify/ProductVariant/44101223119`, of which Liquid receives only the number. */
const idNumber = (gid: string | null | undefined): number => Number(gid?.split("/").at(-1)) || 0

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

const taxLineSchema = z.object({
  title: z.string(),
  rate: z.number().nullable(),
  ratePercentage: z.number().nullable(),
  priceSet: money.nullable()
})

const lineItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  variantTitle: z.string().nullable(),
  sku: z.string().nullable(),
  vendor: z.string().nullable(),
  quantity: z.number(),
  currentQuantity: z.number(),
  requiresShipping: z.boolean(),
  taxable: z.boolean(),
  image: z.object({ url: z.string() }).nullable(),
  originalUnitPriceSet: money.nullable(),
  discountedUnitPriceSet: money.nullable(),
  originalTotalSet: money.nullable(),
  discountedTotalSet: money.nullable(),
  customAttributes: z.array(z.object({ key: z.string(), value: z.string().nullable() })),
  taxLines: z.array(taxLineSchema),
  variant: z
    .object({
      id: z.string(),
      title: z.string(),
      sku: z.string().nullable(),
      barcode: z.string().nullable(),
      availableForSale: z.boolean(),
      taxable: z.boolean(),
      price: z.string(),
      compareAtPrice: z.string().nullable(),
      selectedOptions: z.array(z.object({ name: z.string(), value: z.string() }))
    })
    .nullable(),
  product: z
    .object({
      id: z.string(),
      title: z.string(),
      handle: z.string(),
      vendor: z.string(),
      productType: z.string(),
      onlineStoreUrl: z.string().nullable(),
      featuredMedia: z
        .object({ preview: z.object({ image: z.object({ url: z.string() }).nullable() }).nullable() })
        .nullable()
    })
    .nullable()
})

const orderSchema = z.object({
  order: z
    .object({
      id: z.string(),
      name: z.string(),
      createdAt: z.string(),
      confirmationNumber: z.string().nullable(),
      poNumber: z.string().nullable(),
      tags: z.array(z.string()),
      cancelReason: z.string().nullable(),
      cancelledAt: z.string().nullable(),
      paymentGatewayNames: z.array(z.string()),
      customAttributes: z.array(z.object({ key: z.string(), value: z.string().nullable() })),
      statusPageUrl: z.string(),
      displayFinancialStatus: z.string().nullable(),
      displayFulfillmentStatus: z.string().nullable(),
      requiresShipping: z.boolean(),
      subtotalPriceSet: money.nullable(),
      totalDiscountsSet: money.nullable(),
      totalTaxSet: money.nullable(),
      totalPriceSet: money.nullable(),
      totalShippingPriceSet: money.nullable(),
      totalOutstandingSet: money.nullable(),
      totalTipReceivedSet: money.nullable(),
      currentTotalDutiesSet: money.nullable(),
      taxLines: z.array(taxLineSchema),
      shippingLines: z.object({
        nodes: z.array(z.object({ title: z.string(), originalPriceSet: money.nullable() }))
      }),
      discountApplications: z.object({
        nodes: z.array(
          z.object({
            allocationMethod: z.string(),
            code: z.string().optional(),
            targetSelection: z.string(),
            targetType: z.string(),
            title: z.string().optional(),
            value: z.object({
              __typename: z.string(),
              amount: z.string().optional(),
              percentage: z.number().optional()
            })
          })
        )
      }),
      fulfillments: z.array(
        z.object({
          id: z.string(),
          status: z.string(),
          createdAt: z.string(),
          estimatedDeliveryAt: z.string().nullable(),
          requiresShipping: z.boolean(),
          trackingInfo: z.array(
            z.object({
              company: z.string().nullable(),
              number: z.string().nullable(),
              url: z.string().nullable()
            })
          ),
          fulfillmentLineItems: z.object({
            nodes: z.array(z.object({ quantity: z.number(), lineItem: z.object({ id: z.string() }) }))
          })
        })
      ),
      fulfillmentOrders: z.object({
        nodes: z.array(z.object({ assignedLocation: z.object({ name: z.string().nullable() }).nullable() }))
      }),
      paymentTerms: z
        .object({
          paymentTermsName: z.string().nullable(),
          paymentTermsType: z.string(),
          dueInDays: z.number().nullable(),
          translatedName: z.string(),
          paymentSchedules: z.object({
            nodes: z.array(
              z.object({
                issuedAt: z.string().nullable(),
                dueAt: z.string().nullable(),
                completedAt: z.string().nullable(),
                balanceDue: z.object({ amount: z.string() })
              })
            )
          })
        })
        .nullable(),
      purchasingEntity: z
        .object({
          company: z.object({ name: z.string() }).optional(),
          location: z.object({ name: z.string() }).optional()
        })
        .nullable(),
      returns: z.object({
        nodes: z.array(
          z.object({
            returnLineItems: z.object({
              nodes: z.array(
                z.object({
                  quantity: z.number(),
                  withCodeDiscountedTotalPriceSet: money.nullish(),
                  fulfillmentLineItem: z.object({ lineItem: z.object({ id: z.string() }) }).nullish()
                })
              )
            }),
            exchangeLineItems: z.object({
              nodes: z.array(z.object({ quantity: z.number(), lineItems: z.array(z.object({ id: z.string() })) }))
            }),
            reverseFulfillmentOrders: z.object({
              nodes: z.array(
                z.object({
                  reverseDeliveries: z.object({
                    nodes: z.array(
                      z.object({
                        deliverable: z
                          .object({
                            label: z.object({ publicFileUrl: z.string().nullable() }).nullish(),
                            tracking: z
                              .object({
                                carrierName: z.string().nullable(),
                                number: z.string().nullable(),
                                url: z.string().nullable()
                              })
                              .nullish()
                          })
                          .nullable()
                      })
                    )
                  })
                })
              )
            })
          })
        )
      }),
      refunds: z.array(
        z.object({
          totalRefundedSet: money.nullable(),
          refundLineItems: z.object({
            nodes: z.array(
              z.object({
                quantity: z.number(),
                restockType: z.string().nullable(),
                subtotalSet: money.nullable(),
                lineItem: z.object({ id: z.string() })
              })
            )
          })
        })
      ),
      customer: z
        .object({
          id: z.string(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
          displayName: z.string().nullable(),
          note: z.string().nullable(),
          tags: z.array(z.string()),
          taxExempt: z.boolean(),
          verifiedEmail: z.boolean(),
          state: z.string(),
          createdAt: z.string(),
          numberOfOrders: z.string(),
          amountSpent: z.object({ amount: z.string() }),
          defaultPhoneNumber: z.object({ phoneNumber: z.string() }).nullable(),
          defaultEmailAddress: z.object({ emailAddress: z.string().nullable(), marketingState: z.string() }).nullable(),
          defaultAddress: addressSchema,
          addressesV2: z.object({ nodes: z.array(addressSchema) }),
          storeCreditAccounts: z.object({
            nodes: z.array(
              z.object({
                balance: z.object({ amount: z.string() }),
                transactions: z.object({
                  nodes: z.array(
                    z.object({
                      amount: z.object({ amount: z.string() }),
                      balanceAfterTransaction: z.object({ amount: z.string() }),
                      expiresAt: z.string().nullish()
                    })
                  )
                })
              })
            )
          })
        })
        .nullable(),
      shippingAddress: addressSchema,
      billingAddress: addressSchema,
      shippingLine: z.object({ title: z.string(), originalPriceSet: money.nullable() }).nullable(),
      lineItems: z.object({ nodes: z.array(lineItemSchema) }),
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
    id: z.string(),
    name: z.string(),
    email: z.string(),
    contactEmail: z.string().nullable(),
    description: z.string().nullable(),
    url: z.string(),
    myshopifyDomain: z.string(),
    currencyCode: z.string(),
    currencyFormats: z.object({ moneyFormat: z.string(), moneyWithCurrencyFormat: z.string() }),
    primaryDomain: z.object({ host: z.string(), url: z.string() }),
    shopPolicies: z.array(z.object({ type: z.string(), title: z.string(), body: z.string(), url: z.string() })),
    shopAddress: z
      .object({
        address1: z.string().nullable(),
        address2: z.string().nullable(),
        city: z.string().nullable(),
        province: z.string().nullable(),
        provinceCode: z.string().nullable(),
        zip: z.string().nullable(),
        country: z.string().nullable(),
        phone: z.string().nullable()
      })
      .nullable()
  }),
  giftCards: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        maskedCode: z.string().nullable(),
        lastCharacters: z.string(),
        note: z.string().nullable(),
        expiresOn: z.string().nullable(),
        balance: z.object({ amount: z.string(), currencyCode: z.string() }),
        initialValue: z.object({ amount: z.string() }),
        customer: z
          .object({
            displayName: z.string().nullable(),
            defaultEmailAddress: z.object({ emailAddress: z.string().nullable() }).nullable(),
            defaultPhoneNumber: z.object({ phoneNumber: z.string() }).nullable()
          })
          .nullable()
      })
    )
  }),
  abandonedCheckouts: z.object({
    nodes: z.array(
      z.object({
        abandonedCheckoutUrl: z.string(),
        lineItems: z.object({
          nodes: z.array(
            z.object({
              title: z.string().nullable(),
              variantTitle: z.string().nullable(),
              quantity: z.number(),
              image: z.object({ url: z.string() }).nullable()
            })
          )
        })
      })
    )
  })
})

export const orderResponse = orderSchema
export const shopResponse = shopSchema

/*
 * What the pull knows beyond a plain order confirmation: the shipment, return, refund, gift card,
 * abandoned cart, business buyer and payment schedule the other notification families are rendered
 * against. Each is optional and omitted rather than nulled where the store has none, because a
 * missing name leaves that template on its sample while a null would blank it.
 */
type PulledExtras = {
  readonly abandoned_visit: AbandonmentVariables["abandoned_visit"]
  readonly added_line_items: readonly LineItem[]
  readonly added_total: Cents
  readonly amount: Cents
  readonly company_location: CompanyLocation
  readonly exchange_total: Cents
  readonly fulfillment: Fulfillment
  readonly gift_card: GiftCard
  readonly issued_store_credit: IssuedStoreCredit
  readonly items_to_fulfill: readonly LineItem[]
  readonly items_to_fulfill_count: number
  readonly line_items_including_zero_quantity: readonly LineItem[]
  readonly location_name: string
  readonly payment_schedule: PaymentSchedule
  readonly payment_terms: PaymentTerms
  readonly po_number: string
  readonly refund_line_items: readonly RefundLineItem[]
  readonly return: ReturnDrop
  readonly return_line_items: readonly LineItem[]
  readonly return_total: Cents
  readonly service_name: string
}

export type PulledOrder = OrderVariables & Partial<PulledExtras>

type AdminOrder = NonNullable<z.infer<typeof orderSchema>["order"]>
type AdminStore = z.infer<typeof shopSchema>
type AdminShop = AdminStore["shop"]
type AdminAddress = z.infer<typeof addressSchema>
type AdminLineItem = z.infer<typeof lineItemSchema>
type AdminPolicy = AdminShop["shopPolicies"][number]
type AdminDiscount = AdminOrder["discountApplications"]["nodes"][number]
type AdminFulfillment = AdminOrder["fulfillments"][number]
type AdminReturn = AdminOrder["returns"]["nodes"][number]
type AdminRefund = AdminOrder["refunds"][number]
type AdminGiftCard = AdminStore["giftCards"]["nodes"][number]

const text = (value: string | null | undefined): string => value ?? ""

/* Ruby's `Time#to_a`, which is the shape every timestamp reaches a template in. */
const liquidTime = (iso: string): LiquidTime => {
  const at = new Date(iso)
  const year = at.getFullYear()
  const days = (Date.UTC(year, at.getMonth(), at.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000
  /* Summer time is whichever half of the year has the smaller offset from UTC. */
  const winter = Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset())
  const zone = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(at)
  return [
    at.getSeconds(),
    at.getMinutes(),
    at.getHours(),
    at.getDate(),
    at.getMonth() + 1,
    year,
    at.getDay(),
    days + 1,
    at.getTimezoneOffset() < winter,
    zone.find((part) => part.type === "timeZoneName")?.value ?? ""
  ]
}

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

/* A saved address carries ids on top of an order's, and neither is worth a query of its own. */
const mapCustomerAddress = (address: AdminAddress, customerId: number): CustomerAddress => ({
  ...mapAddress(address),
  customer_id: customerId,
  id: 0
})

const mapTaxLine = (tax: z.infer<typeof taxLineSchema>): TaxLine => ({
  price: subunits(tax.priceSet),
  rate: tax.rate ?? 0,
  rate_percentage: tax.ratePercentage ?? 0,
  title: tax.title
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

/* Liquid reads a variant's options positionally, which is how a theme names a colour and a size. */
const option = (line: AdminLineItem, index: number): string | null =>
  line.variant?.selectedOptions[index]?.value ?? null

const mapVariant = (line: AdminLineItem): ProductVariant => ({
  ...lineItemsSample[0]!.variant,
  available: line.variant?.availableForSale ?? true,
  barcode: line.variant?.barcode ?? null,
  compare_at_price: line.variant?.compareAtPrice ? cents(line.variant.compareAtPrice) : null,
  featured_image: null,
  id: idNumber(line.variant?.id),
  name: [text(line.product?.title), line.variantTitle].filter(Boolean).join(" - "),
  option1: option(line, 0),
  option2: option(line, 1),
  option3: option(line, 2),
  options: line.variant?.selectedOptions.map((selected) => selected.value) ?? [],
  price: cents(line.variant?.price),
  public_title: line.variantTitle,
  requires_shipping: line.requiresShipping,
  sku: text(line.sku),
  taxable: line.taxable,
  title: text(line.variant?.title),
  weight: 0
})

const mapProduct = (line: AdminLineItem, variant: ProductVariant): Product => {
  const image = text(line.product?.featuredMedia?.preview?.image?.url)
  return {
    ...lineItemsSample[0]!.product,
    available: variant.available,
    /* The description is not queried, and a sample one would read as this store's own words. */
    content: "",
    description: "",
    featured_image: image,
    handle: text(line.product?.handle),
    id: idNumber(line.product?.id),
    images: image ? [image] : [],
    media: [],
    options: line.variant?.selectedOptions.map((selected) => selected.name) ?? [],
    price: variant.price,
    price_max: variant.price,
    price_min: variant.price,
    price_varies: false,
    selling_plan_groups: [],
    tags: [],
    title: text(line.product?.title),
    type: text(line.product?.productType),
    variants: [variant],
    vendor: text(line.vendor ?? line.product?.vendor)
  }
}

const mapLineItem = (line: AdminLineItem): LineItem => {
  const variant = mapVariant(line)
  const product = mapProduct(line, variant)
  const handle = product.handle
  return {
    ...lineItemsSample[0]!,
    current_quantity: line.currentQuantity,
    /*
     * The Admin API reports discounts per allocation, but the notification only ever shows a
     * title and an amount, so the line's own shortfall is the honest total to attribute.
     */
    discount_allocations: [],
    final_line_price: subunits(line.discountedTotalSet),
    gift_card: false,
    grams: 0,
    groups: [],
    id: idNumber(line.id),
    image: text(line.image?.url),
    line_price: subunits(line.discountedTotalSet),
    original_line_price: subunits(line.originalTotalSet),
    presentment_title: line.title,
    price: subunits(line.originalUnitPriceSet),
    product,
    properties: line.customAttributes.map((attribute) => ({ first: attribute.key, last: text(attribute.value) })),
    quantity: line.quantity,
    requires_shipping: line.requiresShipping,
    selling_plan_allocation: null,
    sku: text(line.sku),
    tax_lines: line.taxLines.map(mapTaxLine),
    taxable: line.taxable,
    title: line.title,
    title_without_variant: text(line.product?.title) || line.title,
    unit_price: null,
    unit_price_measurement: null,
    url: handle ? `/products/${handle}?variant=${variant.id}` : "",
    variant,
    variant_id: variant.id,
    variant_title: line.variantTitle,
    vendor: product.vendor
  }
}

/* Liquid hands a policy a path and the footer puts `shop.url` in front of it, so the origin goes. */
const policyPath = (url: string): string => url.replace(/^https?:\/\/[^/]+/, "")

const mapPolicy = (policy: AdminPolicy): ShopPolicy => ({
  body: policy.body,
  title: policy.title,
  url: policyPath(policy.url)
})

/** Nothing published under that heading, which the footer renders as a link back to the store. */
const noPolicy: ShopPolicy = { body: "", title: "", url: "" }

const findPolicy = (policies: readonly AdminPolicy[], type: string): ShopPolicy => {
  const found = policies.find((policy) => policy.type === type)
  return found ? mapPolicy(found) : noPolicy
}

const discountSelections = ["all", "entitled", "explicit"] as const
const discountTargets = ["line_item", "shipping_line"] as const

const discountSelection = (value: string): DiscountApplication["target_selection"] =>
  discountSelections.find((known) => known === value.toLowerCase()) ?? "explicit"

const discountTarget = (value: string): DiscountApplication["target_type"] =>
  discountTargets.find((known) => known === value.toLowerCase()) ?? "line_item"

const mapDiscount = (discount: AdminDiscount): DiscountApplication => ({
  ...placedOrderSample.discount_applications[0]!,
  target_selection: discountSelection(discount.targetSelection),
  target_type: discountTarget(discount.targetType),
  /* The Admin API names a code discount but not an automatic one, and Liquid shows whichever it has. */
  title: discount.code ?? discount.title ?? "",
  total_allocated_amount: cents(discount.value.amount),
  value: String(discount.value.percentage ?? discount.value.amount ?? "0"),
  value_type: discount.value.percentage === undefined ? "fixed_amount" : "percentage"
})

const mapFulfillment = (fulfillment: AdminFulfillment, lines: readonly LineItem[]): Fulfillment => {
  const byId = new Map(lines.map((line) => [line.id, line]))
  const shipped = fulfillment.fulfillmentLineItems.nodes.flatMap((node) => {
    const line = byId.get(idNumber(node.lineItem.id))
    return line ? [{ line_item: line, quantity: node.quantity }] : []
  })
  return {
    created_at: liquidTime(fulfillment.createdAt),
    estimated_delivery_at: fulfillment.estimatedDeliveryAt ? liquidTime(fulfillment.estimatedDeliveryAt) : null,
    fulfillment_line_items: shipped,
    item_count: shipped.reduce((total, item) => total + item.quantity, 0),
    name: null,
    requires_shipping: fulfillment.requiresShipping,
    tracking_company: fulfillment.trackingInfo[0]?.company ?? null,
    tracking_numbers: fulfillment.trackingInfo.flatMap((info) => (info.number ? [info.number] : [])),
    tracking_url: fulfillment.trackingInfo[0]?.url ?? null,
    tracking_urls: fulfillment.trackingInfo.flatMap((info) => (info.url ? [info.url] : []))
  }
}

const paymentTermsTypes = ["fixed", "fulfillment", "net", "receipt"] as const

const paymentTermsType = (value: string): PaymentTerms["type"] =>
  paymentTermsTypes.find((known) => known === value.toLowerCase()) ?? "net"

const mapPaymentTerms = (terms: NonNullable<AdminOrder["paymentTerms"]>): PaymentTerms => ({
  ...templateSamples.draft_order_invoice.payment_terms,
  due_in_days: terms.dueInDays,
  payment_terms_name: terms.paymentTermsName,
  translated_name: terms.translatedName,
  type: paymentTermsType(terms.paymentTermsType)
})

const DAY = 86_400_000

const mapPaymentSchedule = (
  schedule: NonNullable<AdminOrder["paymentTerms"]>["paymentSchedules"]["nodes"][number],
  dueAt: string
): PaymentSchedule => {
  /* Liquid reports overdue days rather than a date difference, so it is counted here the same way. */
  const overdue = Math.floor((Date.now() - new Date(dueAt).getTime()) / DAY)
  return {
    amount_due: cents(schedule.balanceDue.amount),
    completed_at: schedule.completedAt ? liquidTime(schedule.completedAt) : null,
    due_at: liquidTime(dueAt),
    "due_later?": overdue < 0,
    issued_at: schedule.issuedAt ? liquidTime(schedule.issuedAt) : null,
    number_of_days_overdue: Math.max(overdue, 0),
    "overdue?": overdue > 0
  }
}

const mapCompanyLocation = (entity: AdminOrder["purchasingEntity"]): CompanyLocation | undefined =>
  entity?.company && entity.location
    ? { company: { name: entity.company.name }, name: entity.location.name }
    : undefined

type ReverseDelivery = AdminReturn["reverseFulfillmentOrders"]["nodes"][number]["reverseDeliveries"]["nodes"][number]

const mapReturnDelivery = (delivery: ReverseDelivery): ReturnDelivery => ({
  carrier_name: delivery.deliverable?.tracking?.carrierName ?? null,
  return_label: delivery.deliverable?.label?.publicFileUrl
    ? { public_file_url: delivery.deliverable.label.publicFileUrl }
    : null,
  tracking_number: delivery.deliverable?.tracking?.number ?? null,
  tracking_url: delivery.deliverable?.tracking?.url ?? null,
  type: delivery.deliverable?.label ? "shopify_label" : "manual"
})

type LinesById = ReadonlyMap<number, LineItem>

const returnedLines = (returned: AdminReturn, byId: LinesById): readonly LineItem[] =>
  returned.returnLineItems.nodes.flatMap((node) => {
    const line = byId.get(idNumber(node.fulfillmentLineItem?.lineItem.id))
    return line ? [line] : []
  })

const exchangedLines = (returned: AdminReturn, byId: LinesById): readonly LineItem[] =>
  returned.exchangeLineItems.nodes.flatMap((node) =>
    node.lineItems.flatMap((item) => {
      const line = byId.get(idNumber(item.id))
      return line ? [line] : []
    })
  )

/* Negative, because Liquid states a return as what it takes off the order rather than as a charge. */
const returnedTotal = (returned: AdminReturn): Cents =>
  -returned.returnLineItems.nodes.reduce((total, node) => total + subunits(node.withCodeDiscountedTotalPriceSet), 0)

const mapReturn = (returned: AdminReturn, byId: LinesById, outstanding: Cents): ReturnDrop => ({
  ...templateSamples.return_created.return,
  deliveries: returned.reverseFulfillmentOrders.nodes.flatMap((order) =>
    order.reverseDeliveries.nodes.map(mapReturnDelivery)
  ),
  exchange_line_items: exchangedLines(returned, byId),
  /* Nulled rather than left on the sample: the pull does not read them, and a wrong figure is worse. */
  fees: [],
  line_items: returnedLines(returned, byId),
  line_items_subtotal_price: returnedTotal(returned),
  order_total_outstanding: outstanding,
  pre_return_order_total_outstanding: null,
  total_tax_price: null
})

const mapRefundLines = (refund: AdminRefund, byId: LinesById): readonly RefundLineItem[] =>
  refund.refundLineItems.nodes.flatMap((node) => {
    const line = byId.get(idNumber(node.lineItem.id))
    return line
      ? [
          {
            line_item: line,
            quantity: node.quantity,
            restock_type: node.restockType?.toLowerCase() ?? null,
            subtotal: subunits(node.subtotalSet)
          }
        ]
      : []
  })

/*
 * The raw code, its URL and the QR identifier are never returned by the Admin API — Shopify shows
 * a card's code once, at issue — so those three keep the sample's and only the amounts are live.
 */
const mapGiftCard = (card: AdminGiftCard): GiftCard => ({
  ...templateSamples.gift_card_confirmation.gift_card,
  balance: cents(card.balance.amount),
  currency: card.balance.currencyCode,
  customer: card.customer
    ? {
        email: card.customer.defaultEmailAddress?.emailAddress ?? null,
        name: card.customer.displayName,
        phone: card.customer.defaultPhoneNumber?.phoneNumber ?? null
      }
    : null,
  expires_on: card.expiresOn,
  initial_value: cents(card.initialValue.amount),
  last_four_characters: card.lastCharacters.toLowerCase(),
  masked_code: card.maskedCode,
  message: card.note
})

const mapAbandonedVisit = (
  checkout: AdminStore["abandonedCheckouts"]["nodes"][number]
): AbandonmentVariables["abandoned_visit"] => ({
  products_added_to_cart: checkout.lineItems.nodes.map((line) => ({
    image_url: text(line.image?.url),
    quantity: line.quantity,
    title: text(line.title),
    variant_title: text(line.variantTitle)
  })),
  /* Shopify trims the list as it sends, so nothing is held back here and none is left over. */
  remaining_cart_products_count: 0,
  url: checkout.abandonedCheckoutUrl
})

type StoreCreditTransaction = NonNullable<
  AdminOrder["customer"]
>["storeCreditAccounts"]["nodes"][number]["transactions"]["nodes"][number]

const mapStoreCredit = (transaction: StoreCreditTransaction): IssuedStoreCredit => ({
  amount: cents(transaction.amount.amount),
  balance_after_transaction: cents(transaction.balanceAfterTransaction.amount),
  expires_at: transaction.expiresAt ? liquidTime(transaction.expiresAt) : null
})

export const mapOrderToVariables = (order: AdminOrder, store: AdminStore): PulledOrder => {
  const { shop } = store
  const allLines = order.lineItems.nodes.map(mapLineItem)
  /* An edit can take a line to nothing, and only the history notifications still list those. */
  const lineItems = allLines.filter((line) => line.current_quantity > 0)
  const byId: LinesById = new Map(allLines.map((line) => [line.id, line]))
  const fulfillments = order.fulfillments.map((fulfillment) => mapFulfillment(fulfillment, allLines))
  /* A line counts as fulfilled once any shipment covers it, which is how Liquid splits the two lists. */
  const shippedIds = new Set(
    fulfillments.flatMap((fulfillment) => fulfillment.fulfillment_line_items.map((item) => item.line_item.id))
  )
  const unfulfilled = lineItems.filter((line) => !shippedIds.has(line.id))
  const customerId = idNumber(order.customer?.id)
  const outstanding = subunits(order.totalOutstandingSet)

  const returned = order.returns.nodes[0]
  const refund = order.refunds[0]
  const giftCard = store.giftCards.nodes[0]
  const abandoned = store.abandonedCheckouts.nodes[0]
  const schedule = order.paymentTerms?.paymentSchedules.nodes.find((node) => node.dueAt !== null)
  const credit = order.customer?.storeCreditAccounts.nodes[0]?.transactions.nodes[0]
  const location = order.fulfillmentOrders.nodes.find((node) => node.assignedLocation?.name)?.assignedLocation?.name
  const companyLocation = mapCompanyLocation(order.purchasingEntity)

  const extras: Partial<PulledExtras> = {
    ...(fulfillments.at(-1) && {
      /* Liquid renders one shipment at a time, and the latest is the one a notification just sent. */
      fulfillment: fulfillments.at(-1),
      items_to_fulfill: unfulfilled,
      items_to_fulfill_count: unfulfilled.reduce((total, line) => total + line.quantity, 0),
      service_name: text(order.shippingLine?.title)
    }),
    /* Shopify always sets this on an edited order, so it is written even when nothing was removed. */
    line_items_including_zero_quantity: allLines,
    ...(order.poNumber && { po_number: order.poNumber }),
    ...(location && { location_name: location }),
    ...(companyLocation && { company_location: companyLocation }),
    ...(order.paymentTerms && { payment_terms: mapPaymentTerms(order.paymentTerms) }),
    ...(schedule?.dueAt && { payment_schedule: mapPaymentSchedule(schedule, schedule.dueAt) }),
    ...(returned && {
      added_line_items: exchangedLines(returned, byId),
      added_total: -returnedTotal(returned),
      exchange_total: 0,
      return: mapReturn(returned, byId, outstanding),
      return_line_items: returnedLines(returned, byId),
      return_total: returnedTotal(returned)
    }),
    ...(refund && { amount: subunits(refund.totalRefundedSet), refund_line_items: mapRefundLines(refund, byId) }),
    ...(giftCard && { gift_card: mapGiftCard(giftCard) }),
    ...(abandoned && { abandoned_visit: mapAbandonedVisit(abandoned) }),
    ...(credit && { issued_store_credit: mapStoreCredit(credit) })
  }

  return {
    ...placedOrderSample,
    ...extras,
    custom_message: "",
    delivery_method_for_subtotal: text(order.shippingLine?.title),

    id: idNumber(order.id),
    name: order.name,
    order_name: order.name,
    /* `#8493` without the prefix a merchant may have set, which is what `order_number` means. */
    order_number: Number(order.name.replace(/\D/g, "")) || 0,
    confirmation_number: text(order.confirmationNumber),
    tags: order.tags,
    attributes: Object.fromEntries(order.customAttributes.map((entry) => [entry.key, text(entry.value)])),
    created_at: liquidTime(order.createdAt),
    cancelled: order.cancelledAt !== null,
    cancelled_at: order.cancelledAt ? liquidTime(order.cancelledAt) : null,
    cancel_reason: order.cancelReason ? order.cancelReason.toLowerCase() : null,
    order_status_url: order.statusPageUrl,
    customer_order_url: order.statusPageUrl,
    order: { ...placedOrderSample.order, name: order.name, order_status_url: order.statusPageUrl },
    "b2b?": companyLocation !== undefined,

    shop: {
      ...shopSample,
      id: idNumber(shop.id),
      name: shop.name,
      email: shop.email,
      contact_email: shop.contactEmail,
      description: text(shop.description),
      url: shop.url,
      currency: shop.currencyCode,
      money_format: shop.currencyFormats.moneyFormat,
      money_with_currency_format: shop.currencyFormats.moneyWithCurrencyFormat,
      domain: shop.primaryDomain.host,
      permanent_domain: shop.myshopifyDomain,
      secure_url: shop.primaryDomain.url,
      phone: text(shop.shopAddress?.phone),
      policies: shop.shopPolicies.map(mapPolicy),
      privacy_policy: findPolicy(shop.shopPolicies, "PRIVACY_POLICY"),
      refund_policy: findPolicy(shop.shopPolicies, "REFUND_POLICY"),
      shipping_policy: findPolicy(shop.shopPolicies, "SHIPPING_POLICY"),
      terms_of_service: findPolicy(shop.shopPolicies, "TERMS_OF_SERVICE"),
      address: {
        ...shopSample.address,
        address1: text(shop.shopAddress?.address1),
        address2: shop.shopAddress?.address2 ?? null,
        city: text(shop.shopAddress?.city),
        province: text(shop.shopAddress?.provinceCode),
        zip: text(shop.shopAddress?.zip),
        country: text(shop.shopAddress?.country),
        phone: shop.shopAddress?.phone ?? null
      }
    },
    shop_name: shop.name,

    customer: {
      ...customerSample,
      id: customerId,
      first_name: text(order.customer?.firstName),
      last_name: text(order.customer?.lastName),
      name: text(order.customer?.displayName),
      email: text(order.customer?.defaultEmailAddress?.emailAddress),
      phone: order.customer?.defaultPhoneNumber?.phoneNumber ?? null,
      accepts_marketing: order.customer?.defaultEmailAddress?.marketingState === "SUBSCRIBED",
      addresses: (order.customer?.addressesV2.nodes ?? []).map((address) => mapCustomerAddress(address, customerId)),
      default_address: order.customer?.defaultAddress
        ? mapCustomerAddress(order.customer.defaultAddress, customerId)
        : null,
      created_at: order.customer?.createdAt ?? null,
      has_account: order.customer?.state === "ENABLED",
      note: order.customer?.note ?? null,
      orders_count: Number(order.customer?.numberOfOrders ?? 0),
      state: order.customer?.state.toLowerCase() ?? null,
      tags: order.customer?.tags ?? [],
      tax_exempt: order.customer?.taxExempt ?? false,
      total_spent: cents(order.customer?.amountSpent.amount),
      verified_email: order.customer?.verifiedEmail ?? null
    },
    email: text(order.customer?.defaultEmailAddress?.emailAddress),

    shipping_address: mapAddress(order.shippingAddress),
    billing_address: mapAddress(order.billingAddress),

    requires_shipping: order.requiresShipping,
    line_items: lineItems,
    subtotal_line_items: lineItems,
    fulfilled_line_items: lineItems.filter((line) => shippedIds.has(line.id)),
    unfulfilled_line_items: unfulfilled,
    item_count: lineItems.reduce((total, line) => total + line.quantity, 0),

    shipping_method: {
      ...placedOrderSample.shipping_method,
      title: text(order.shippingLine?.title),
      price: subunits(order.shippingLine?.originalPriceSet)
    },
    shipping_methods: order.shippingLines.nodes.map((line) => ({
      ...placedOrderSample.shipping_method,
      title: line.title,
      price: subunits(line.originalPriceSet)
    })),
    shipping_price: subunits(order.totalShippingPriceSet),
    subtotal_price: subunits(order.subtotalPriceSet),
    total_discounts: subunits(order.totalDiscountsSet),
    discounts_amount: subunits(order.totalDiscountsSet),
    discounts_savings: -subunits(order.totalDiscountsSet),
    discount_applications: order.discountApplications.nodes.map(mapDiscount),
    tax_lines: order.taxLines.map(mapTaxLine),
    tax_price: subunits(order.totalTaxSet),
    total_price: subunits(order.totalPriceSet),
    total_duties: subunits(order.currentTotalDutiesSet),
    total_outstanding: subunits(order.totalOutstandingSet),
    total_tip: subunits(order.totalTipReceivedSet),
    unique_gateways: order.paymentGatewayNames,
    financial_status: text(order.displayFinancialStatus).toLowerCase(),
    fulfillment_status: text(order.displayFulfillmentStatus).toLowerCase(),

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
