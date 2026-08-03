import { describe, expect, it } from "vitest"
import { mapOrderToVariables, orderResponse, shopResponse } from "./mapOrder.ts"

const store = shopResponse.parse({
  shop: {
    id: "gid://shopify/Shop/84825276713",
    name: "Fencing Club",
    email: "support@fencing.club",
    contactEmail: "hello@fencing.club",
    description: "Gear for fencers.",
    url: "https://fencing.club",
    myshopifyDomain: "8f3f5f-3.myshopify.com",
    currencyCode: "USD",
    currencyFormats: { moneyFormat: "${{amount}}", moneyWithCurrencyFormat: "${{amount}} USD" },
    primaryDomain: { host: "fencing.club", url: "https://fencing.club" },
    shopPolicies: [
      {
        type: "REFUND_POLICY",
        title: "Refund policy",
        body: "<p>Thirty days.</p>",
        url: "https://fencing.club/policies/refund-policy"
      }
    ],
    shopAddress: {
      address1: "17190 128th Pl NE",
      address2: null,
      city: "Woodinville",
      province: "Washington",
      provinceCode: "WA",
      zip: "98072",
      country: "United States",
      phone: "(425) 312-3746"
    }
  },
  giftCards: {
    nodes: [
      {
        id: "gid://shopify/GiftCard/661",
        maskedCode: "••••••••••••7g8h",
        lastCharacters: "7G8H",
        note: "Happy fencing.",
        expiresOn: "2027-01-01",
        balance: { amount: "75.00", currencyCode: "USD" },
        initialValue: { amount: "100.00" },
        customer: {
          displayName: "Alex Morgan",
          defaultEmailAddress: { emailAddress: "alex@example.com" },
          defaultPhoneNumber: { phoneNumber: "+15555550142" }
        }
      }
    ]
  },
  abandonedCheckouts: {
    nodes: [
      {
        abandonedCheckoutUrl: "https://fencing.club/checkouts/cn/abc/recover",
        lineItems: {
          nodes: [
            {
              title: "Standard Epee Body Cord",
              variantTitle: "Standard",
              quantity: 3,
              image: { url: "https://cdn.shopify.com/cord.png" }
            }
          ]
        }
      }
    ]
  }
})

const money = (amount: string) => ({ shopMoney: { amount } })

const { order } = orderResponse.parse({
  order: {
    id: "gid://shopify/Order/5511122233",
    name: "#FC-1042",
    createdAt: "2026-03-03T10:14:00-08:00",
    confirmationNumber: "4KPQZ1RTM",
    poNumber: null,
    tags: ["club"],
    cancelReason: null,
    cancelledAt: null,
    paymentGatewayNames: ["shopify_payments"],
    customAttributes: [{ key: "Club", value: "Salle Green" }],
    statusPageUrl: "https://fencing.club/orders/abc",
    displayFinancialStatus: "PAID",
    displayFulfillmentStatus: "UNFULFILLED",
    requiresShipping: true,
    subtotalPriceSet: money("170.10"),
    totalDiscountsSet: money("18.90"),
    totalTaxSet: money("11.38"),
    totalPriceSet: money("181.48"),
    totalShippingPriceSet: money("0.00"),
    totalOutstandingSet: money("0.00"),
    totalTipReceivedSet: money("0.00"),
    currentTotalDutiesSet: null,
    taxLines: [{ title: "State Tax", rate: 0.0625, ratePercentage: 6.25, priceSet: money("11.38") }],
    shippingLines: { nodes: [{ title: "Free shipping", originalPriceSet: money("0.00") }] },
    discountApplications: {
      nodes: [
        {
          allocationMethod: "ACROSS",
          code: "CLUB10",
          targetSelection: "ALL",
          targetType: "LINE_ITEM",
          value: { __typename: "PricingPercentageValue", percentage: 10 }
        }
      ]
    },
    fulfillments: [
      {
        id: "gid://shopify/Fulfillment/771",
        status: "SUCCESS",
        createdAt: "2026-03-04T09:00:00-08:00",
        estimatedDeliveryAt: "2026-03-07T17:00:00-08:00",
        requiresShipping: true,
        trackingInfo: [{ company: "UPS", number: "1Z999", url: "https://ups.com/1Z999" }],
        fulfillmentLineItems: {
          nodes: [{ quantity: 2, lineItem: { id: "gid://shopify/LineItem/15923884113" } }]
        }
      }
    ],
    fulfillmentOrders: { nodes: [{ assignedLocation: { name: "Woodinville" } }] },
    paymentTerms: {
      paymentTermsName: "Net 7",
      paymentTermsType: "NET",
      dueInDays: 7,
      translatedName: "Net 7",
      paymentSchedules: {
        nodes: [
          {
            issuedAt: "2026-03-03T10:14:00-08:00",
            dueAt: "2026-03-10T00:00:00-08:00",
            completedAt: null,
            balanceDue: { amount: "181.48" }
          }
        ]
      }
    },
    purchasingEntity: { company: { name: "Piste Academy" }, location: { name: "Boston" } },
    returns: {
      nodes: [
        {
          returnLineItems: {
            nodes: [
              {
                quantity: 1,
                withCodeDiscountedTotalPriceSet: money("85.05"),
                fulfillmentLineItem: { lineItem: { id: "gid://shopify/LineItem/15923884113" } }
              }
            ]
          },
          exchangeLineItems: { nodes: [] },
          reverseFulfillmentOrders: {
            nodes: [
              {
                reverseDeliveries: {
                  nodes: [
                    {
                      deliverable: {
                        label: { publicFileUrl: "https://fencing.club/labels/1.pdf" },
                        tracking: { carrierName: "UPS", number: "1Z888", url: "https://ups.com/1Z888" }
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
    },
    refunds: [
      {
        totalRefundedSet: money("85.05"),
        refundLineItems: {
          nodes: [
            {
              quantity: 1,
              restockType: "RETURN",
              subtotalSet: money("85.05"),
              lineItem: { id: "gid://shopify/LineItem/15923884113" }
            }
          ]
        }
      }
    ],
    customer: {
      id: "gid://shopify/Customer/6612334",
      firstName: "Alex",
      lastName: "Morgan",
      displayName: "Alex Morgan",
      note: null,
      tags: ["coach"],
      taxExempt: false,
      verifiedEmail: true,
      state: "ENABLED",
      createdAt: "2025-09-01T10:00:00-07:00",
      numberOfOrders: "4",
      amountSpent: { amount: "612.40" },
      defaultPhoneNumber: { phoneNumber: "+15555550142" },
      defaultEmailAddress: { emailAddress: "alex@example.com", marketingState: "SUBSCRIBED" },
      defaultAddress: {
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
      addressesV2: { nodes: [] },
      storeCreditAccounts: {
        nodes: [
          {
            balance: { amount: "110.00" },
            transactions: {
              nodes: [{ amount: { amount: "10.00" }, balanceAfterTransaction: { amount: "110.00" }, expiresAt: null }]
            }
          }
        ]
      }
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
          id: "gid://shopify/LineItem/15923884113",
          title: "Epee Body Screws - 10 Pack",
          variantTitle: "Standard",
          sku: "EBS-10",
          vendor: "Fencing Club",
          quantity: 2,
          currentQuantity: 2,
          requiresShipping: true,
          taxable: true,
          image: { url: "https://cdn.shopify.com/screws.png" },
          originalUnitPriceSet: money("94.50"),
          originalTotalSet: money("189.00"),
          discountAllocations: [
            {
              allocatedAmountSet: money("18.90"),
              discountApplication: {
                allocationMethod: "ACROSS",
                targetSelection: "ENTITLED",
                targetType: "LINE_ITEM",
                title: "Club rate",
                value: { __typename: "PricingPercentageValue", percentage: 10 }
              }
            }
          ],
          customAttributes: [{ key: "Engraving", value: "A.M." }],
          taxLines: [{ title: "State Tax", rate: 0.0625, ratePercentage: 6.25, priceSet: money("11.38") }],
          variant: {
            id: "gid://shopify/ProductVariant/44101223119",
            title: "Standard",
            sku: "EBS-10",
            barcode: null,
            availableForSale: true,
            taxable: true,
            price: "94.50",
            compareAtPrice: "105.00",
            selectedOptions: [{ name: "Size", value: "Standard" }]
          },
          product: {
            id: "gid://shopify/Product/8412334991",
            title: "Epee Body Screws - 10 Pack",
            handle: "epee-body-screws",
            vendor: "Fencing Club",
            productType: "Spares",
            onlineStoreUrl: "https://fencing.club/products/epee-body-screws",
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
  const vars = mapOrderToVariables(order!, store)

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

  it("carries the variant a template names beside the title, rather than the sample's", () => {
    const line = vars.line_items[0]!
    expect(line.variant_title).toBe("Standard")
    expect(line.variant.title).toBe("Standard")
    expect(line.variant.option1).toBe("Standard")
    expect(line.variant.id).toBe(44_101_223_119)
    expect(line.price).toBe(9450)
    expect(line.variant.price).toBe(9450)
    expect(line.variant.compare_at_price).toBe(10_500)
  })

  it("names the product the way a link and a vendor line read it", () => {
    const line = vars.line_items[0]!
    expect(line.sku).toBe("EBS-10")
    expect(line.vendor).toBe("Fencing Club")
    expect(line.product.handle).toBe("epee-body-screws")
    expect(line.product.type).toBe("Spares")
    expect(line.url).toBe("/products/epee-body-screws?variant=44101223119")
    expect(line.properties).toEqual([{ first: "Engraving", last: "A.M." }])
  })

  it("reads the store's own domains, which a footer and an unsubscribe link print", () => {
    expect(vars.shop.domain).toBe("fencing.club")
    expect(vars.shop.permanent_domain).toBe("8f3f5f-3.myshopify.com")
    expect(vars.shop.secure_url).toBe("https://fencing.club")
  })

  it("hands the date over as the array Ruby's Time#to_a produces", () => {
    const [second, minute, , day, month, year] = vars.created_at
    expect([second, minute, day, month, year]).toEqual([0, 14, 3, 3, 2026])
  })

  it("keeps a missing address present, blank where Liquid prints it and null where Shopify sends null", () => {
    expect(vars.billing_address.city).toBe("")
    expect(vars.shipping_address.city).toBe("Boston")
    expect(vars.shipping_address.address2).toBeNull()
  })

  it("reads the policies a footer links to, as the paths Liquid puts the store URL in front of", () => {
    expect(vars.shop.refund_policy).toEqual({
      body: "<p>Thirty days.</p>",
      title: "Refund policy",
      url: "/policies/refund-policy"
    })
    expect(vars.shop.privacy_policy.url).toBe("")
    expect(vars.shop.policies).toHaveLength(1)
  })

  it("takes the store's own contact details rather than the sample's", () => {
    expect(vars.shop.phone).toBe("(425) 312-3746")
    expect(vars.shop.contact_email).toBe("hello@fencing.club")
    expect(vars.shop.money_format).toBe("${{amount}}")
    expect(vars.shop.id).toBe(84_825_276_713)
  })

  it("reads the customer's own history, which a receipt prints beside the addresses", () => {
    expect(vars.customer.id).toBe(6_612_334)
    expect(vars.customer.phone).toBe("+15555550142")
    expect(vars.customer.orders_count).toBe(4)
    expect(vars.customer.total_spent).toBe(61_240)
    expect(vars.customer.accepts_marketing).toBe(true)
    expect(vars.customer.has_account).toBe(true)
    expect(vars.customer.default_address?.city).toBe("Boston")
  })

  it("splits the lines by what a shipment actually covers, rather than calling them all unfulfilled", () => {
    expect(vars.fulfilled_line_items).toHaveLength(1)
    expect(vars.unfulfilled_line_items).toHaveLength(0)
  })

  it("carries the shipment the seven tracking notifications are rendered against", () => {
    expect(vars.fulfillment?.tracking_company).toBe("UPS")
    expect(vars.fulfillment?.tracking_numbers).toEqual(["1Z999"])
    expect(vars.fulfillment?.item_count).toBe(2)
    expect(vars.fulfillment?.estimated_delivery_at?.[3]).toBe(7)
  })

  it("takes the order's own totals and attributes rather than leaving the sample's in place", () => {
    expect(vars.confirmation_number).toBe("4KPQZ1RTM")
    expect(vars.tags).toEqual(["club"])
    expect(vars.attributes).toEqual({ Club: "Salle Green" })
    expect(vars.unique_gateways).toEqual(["shopify_payments"])
    expect(vars.total_outstanding).toBe(0)
    expect(vars.total_duties).toBe(0)
    expect(vars.tax_lines).toEqual([{ price: 1138, rate: 0.0625, rate_percentage: 6.25, title: "State Tax" }])
    expect(vars.shipping_methods).toHaveLength(1)
  })

  it("reports a percentage discount as the value type Liquid branches on", () => {
    expect(vars.discount_applications[0]).toMatchObject({
      target_selection: "all",
      target_type: "line_item",
      title: "CLUB10",
      value: "10",
      value_type: "percentage"
    })
  })

  it("reads the return the four return notifications describe", () => {
    expect(vars.return?.line_items).toHaveLength(1)
    expect(vars.return?.line_items_subtotal_price).toBe(-8505)
    expect(vars.return?.deliveries[0]).toEqual({
      carrier_name: "UPS",
      return_label: { public_file_url: "https://fencing.club/labels/1.pdf" },
      tracking_number: "1Z888",
      tracking_url: "https://ups.com/1Z888",
      type: "shopify_label"
    })
    expect(vars.return_total).toBe(-8505)
  })

  it("reads the refund a refund notification states an amount for", () => {
    expect(vars.amount).toBe(8505)
    expect(vars.refund_line_items?.[0]).toMatchObject({ quantity: 1, restock_type: "return", subtotal: 8505 })
  })

  it("names the business buyer a B2B notification is addressed to", () => {
    expect(vars["b2b?"]).toBe(true)
    expect(vars.company_location).toEqual({ company: { name: "Piste Academy" }, name: "Boston" })
    expect(vars.location_name).toBe("Woodinville")
  })

  it("reads the schedule a payment reminder counts overdue days from", () => {
    expect(vars.payment_terms).toMatchObject({ due_in_days: 7, translated_name: "Net 7", type: "net" })
    expect(vars.payment_schedule?.amount_due).toBe(18_148)
    expect(vars.payment_schedule?.due_at[3]).toBe(10)
  })

  it("reads the store's own gift card, keeping the code Shopify never returns twice", () => {
    expect(vars.gift_card?.balance).toBe(7500)
    expect(vars.gift_card?.initial_value).toBe(10_000)
    expect(vars.gift_card?.last_four_characters).toBe("7g8h")
    expect(vars.gift_card?.message).toBe("Happy fencing.")
    expect(vars.gift_card?.customer?.name).toBe("Alex Morgan")
  })

  it("reads the cart an abandonment automation is chasing", () => {
    expect(vars.abandoned_visit?.url).toBe("https://fencing.club/checkouts/cn/abc/recover")
    expect(vars.abandoned_visit?.products_added_to_cart[0]).toEqual({
      image_url: "https://cdn.shopify.com/cord.png",
      quantity: 3,
      title: "Standard Epee Body Cord",
      variant_title: "Standard"
    })
  })

  it("reads the credit the store credit notification reports", () => {
    expect(vars.issued_store_credit).toEqual({ amount: 1000, balance_after_transaction: 11_000, expires_at: null })
  })

  it("leaves a name out where the order has none, so that template keeps its sample", () => {
    expect(vars).not.toHaveProperty("po_number")
  })

  it("writes every line to the edited-order drop, which Shopify sets whether or not one was removed", () => {
    expect(vars.line_items_including_zero_quantity).toEqual(vars.line_items)
  })
})
