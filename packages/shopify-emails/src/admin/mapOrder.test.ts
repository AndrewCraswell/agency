import { describe, expect, it } from "vitest"
import { mapOrderToVariables, orderResponse, shopResponse } from "./mapOrder.ts"

const shop = shopResponse.parse({
  shop: {
    name: "Fencing Club",
    email: "support@fencing.club",
    url: "https://fencing.club",
    shopAddress: {
      address1: "17190 128th Pl NE",
      city: "Woodinville",
      provinceCode: "WA",
      zip: "98072",
      country: "United States"
    }
  }
}).shop

const money = (amount: string) => ({ shopMoney: { amount } })

const { order } = orderResponse.parse({
  order: {
    name: "#FC-1042",
    statusPageUrl: "https://fencing.club/orders/abc",
    displayFinancialStatus: "PAID",
    requiresShipping: true,
    subtotalPriceSet: money("170.10"),
    totalDiscountsSet: money("18.90"),
    totalTaxSet: money("11.38"),
    totalPriceSet: money("181.48"),
    totalShippingPriceSet: money("0.00"),
    customer: {
      firstName: "Alex",
      lastName: "Morgan",
      displayName: "Alex Morgan",
      defaultEmailAddress: { emailAddress: "alex@example.com" }
    },
    shippingAddress: {
      firstName: "Alex",
      lastName: "Morgan",
      address1: "125 Main Street",
      address2: null,
      city: "Boston",
      province: "Massachusetts",
      provinceCode: "MA",
      zip: "02110",
      country: "United States",
      countryCodeV2: "US",
      phone: null
    },
    billingAddress: null,
    shippingLine: { title: "Free shipping", originalPriceSet: money("0.00") },
    lineItems: {
      nodes: [
        {
          title: "Epee Body Screws - 10 Pack",
          variantTitle: "Standard",
          quantity: 2,
          image: { url: "https://cdn.shopify.com/screws.png" },
          originalTotalSet: money("189.00"),
          discountedTotalSet: money("170.10"),
          product: {
            title: "Epee Body Screws - 10 Pack",
            featuredMedia: { preview: { image: { url: "https://cdn.shopify.com/featured.png" } } }
          }
        }
      ]
    },
    transactions: [
      {
        kind: "SALE",
        status: "SUCCESS",
        gateway: "shopify_payments",
        formattedGateway: "Shopify Payments",
        amountSet: money("181.48"),
        paymentDetails: { company: "Visa", number: "•••• •••• •••• 4242", paymentMethodName: "visa" }
      }
    ]
  }
})

describe("mapOrderToVariables", () => {
  const vars = mapOrderToVariables(order!, shop)

  it("converts every amount to the integer subunit Liquid compares against", () => {
    expect(vars.total_price).toBe(18_148)
    expect(vars.subtotal_price).toBe(17_010)
    expect(vars.total_discounts).toBe(1890)
    expect(vars.tax_price).toBe(1138)
    expect(vars.line_items[0].original_line_price).toBe(18_900)
    expect(vars.line_items[0].final_line_price).toBe(17_010)
    expect(vars.transactions[0].amount).toBe(18_148)
  })

  it("lower-cases the status enums the templates compare as strings", () => {
    expect(vars.financial_status).toBe("paid")
    expect(vars.transactions[0].kind).toBe("sale")
    expect(vars.transactions[0].status).toBe("success")
  })

  it("flattens images to the plain URLs the templates interpolate", () => {
    expect(vars.line_items[0].image).toBe("https://cdn.shopify.com/screws.png")
    expect(vars.line_items[0].product.featured_image).toBe("https://cdn.shopify.com/featured.png")
  })

  it("recovers the last four digits from the masked card number", () => {
    expect(vars.transactions[0].payment_details.credit_card_last_four_digits).toBe("4242")
    expect(vars.transactions[0].gateway_display_name).toBe("Shopify Payments")
  })

  it("counts items by quantity rather than by line", () => {
    expect(vars.item_count).toBe(2)
  })

  it("keeps a missing address present, blank where Liquid prints it and null where Shopify sends null", () => {
    expect(vars.billing_address.city).toBe("")
    expect(vars.shipping_address.city).toBe("Boston")
    expect(vars.shipping_address.address2).toBeNull()
  })
})
