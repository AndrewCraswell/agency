/*
 * Every document here has been checked against the 2026-04 Admin schema. Two fields are not the
 * obvious ones: `Shop.billingAddress` is deprecated in favour of `shopAddress`, and card details
 * expose a masked `number` rather than a last-four field, so the digits are derived when mapping.
 */

export const SHOP_QUERY = `
  query Shop {
    shop {
      id
      name
      email
      contactEmail
      description
      url
      myshopifyDomain
      currencyCode
      currencyFormats { moneyFormat moneyWithCurrencyFormat }
      primaryDomain { host url }
      shopPolicies { type title body url }
      shopAddress {
        address1
        address2
        city
        province
        provinceCode
        zip
        country
        phone
      }
    }
    giftCards(first: 1, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        maskedCode
        lastCharacters
        note
        expiresOn
        balance { amount currencyCode }
        initialValue { amount }
        customer {
          displayName
          defaultEmailAddress { emailAddress }
          defaultPhoneNumber { phoneNumber }
        }
      }
    }
    abandonedCheckouts(first: 1, sortKey: CREATED_AT, reverse: true) {
      nodes {
        abandonedCheckoutUrl
        lineItems(first: 20) { nodes { title variantTitle quantity image { url } } }
      }
    }
  }
`

export const CUSTOMERS_QUERY = `
  query Customers($query: String!) {
    customers(first: 20, query: $query) {
      nodes {
        id
        displayName
        firstName
        lastName
        numberOfOrders
        defaultEmailAddress { emailAddress }
      }
    }
  }
`

export const ORDERS_QUERY = `
  query Orders($query: String, $first: Int!, $after: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        currentSubtotalLineItemsQuantity
        customer { displayName }
        totalPriceSet { shopMoney { amount currencyCode } }
      }
    }
  }
`

export const ORDER_QUERY = `
  fragment Addr on MailingAddress {
    firstName
    lastName
    address1
    address2
    city
    province
    provinceCode
    zip
    country
    countryCodeV2
    phone
  }

  query Order($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      confirmationNumber
      poNumber
      tags
      cancelReason
      cancelledAt
      paymentGatewayNames
      customAttributes { key value }
      statusPageUrl
      displayFinancialStatus
      displayFulfillmentStatus
      requiresShipping
      subtotalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalOutstandingSet { shopMoney { amount } }
      totalTipReceivedSet { shopMoney { amount } }
      currentTotalDutiesSet { shopMoney { amount } }
      taxLines { title rate ratePercentage priceSet { shopMoney { amount } } }
      shippingLines(first: 10) { nodes { title originalPriceSet { shopMoney { amount } } } }
      discountApplications(first: 10) {
        nodes {
          allocationMethod
          targetSelection
          targetType
          value {
            __typename
            ... on MoneyV2 { amount }
            ... on PricingPercentageValue { percentage }
          }
          ... on DiscountCodeApplication { code }
          ... on AutomaticDiscountApplication { title }
          ... on ManualDiscountApplication { title }
          ... on ScriptDiscountApplication { title }
        }
      }
      fulfillments(first: 10) {
        id
        status
        createdAt
        estimatedDeliveryAt
        requiresShipping
        trackingInfo { company number url }
        fulfillmentLineItems(first: 100) { nodes { quantity lineItem { id } } }
      }
      fulfillmentOrders(first: 5) { nodes { assignedLocation { name } } }
      paymentTerms {
        paymentTermsName
        paymentTermsType
        dueInDays
        translatedName
        paymentSchedules(first: 10) {
          nodes { issuedAt dueAt completedAt balanceDue { amount } }
        }
      }
      purchasingEntity {
        ... on PurchasingCompany {
          company { name }
          location { name }
        }
      }
      returns(first: 5) {
        nodes {
          returnLineItems(first: 50) {
            nodes {
              quantity
              ... on ReturnLineItem {
                withCodeDiscountedTotalPriceSet { shopMoney { amount } }
                fulfillmentLineItem { lineItem { id } }
              }
            }
          }
          exchangeLineItems(first: 50) { nodes { quantity lineItems { id } } }
          reverseFulfillmentOrders(first: 5) {
            nodes {
              reverseDeliveries(first: 5) {
                nodes {
                  deliverable {
                    ... on ReverseDeliveryShippingDeliverable {
                      label { publicFileUrl }
                      tracking { carrierName number url }
                    }
                  }
                }
              }
            }
          }
        }
      }
      refunds(first: 5) {
        totalRefundedSet { shopMoney { amount } }
        refundLineItems(first: 50) {
          nodes {
            quantity
            restockType
            subtotalSet { shopMoney { amount } }
            lineItem { id }
          }
        }
      }
      customer {
        id
        firstName
        lastName
        displayName
        note
        tags
        taxExempt
        verifiedEmail
        state
        createdAt
        numberOfOrders
        amountSpent { amount }
        defaultPhoneNumber { phoneNumber }
        defaultEmailAddress { emailAddress marketingState }
        defaultAddress { ...Addr }
        addressesV2(first: 10) { nodes { ...Addr } }
        storeCreditAccounts(first: 1) {
          nodes {
            balance { amount }
            transactions(first: 1) {
              nodes {
                amount { amount }
                balanceAfterTransaction { amount }
                ... on StoreCreditAccountCreditTransaction { expiresAt }
              }
            }
          }
        }
      }
      shippingAddress { ...Addr }
      billingAddress { ...Addr }
      shippingLine { title originalPriceSet { shopMoney { amount } } }
      lineItems(first: 100) {
        nodes {
          id
          title
          variantTitle
          sku
          vendor
          quantity
          currentQuantity
          requiresShipping
          taxable
          image { url }
          originalUnitPriceSet { shopMoney { amount } }
          originalTotalSet { shopMoney { amount } }
          discountAllocations {
            allocatedAmountSet { shopMoney { amount } }
            discountApplication {
              allocationMethod
              targetSelection
              targetType
              value {
                __typename
                ... on MoneyV2 { amount }
                ... on PricingPercentageValue { percentage }
              }
              ... on DiscountCodeApplication { code }
              ... on AutomaticDiscountApplication { title }
              ... on ManualDiscountApplication { title }
              ... on ScriptDiscountApplication { title }
            }
          }
          customAttributes { key value }
          taxLines { title rate ratePercentage priceSet { shopMoney { amount } } }
          variant {
            id
            title
            sku
            barcode
            availableForSale
            taxable
            price
            compareAtPrice
            selectedOptions { name value }
          }
          product {
            id
            title
            handle
            vendor
            productType
            onlineStoreUrl
            featuredMedia { preview { image { url } } }
          }
        }
      }
      transactions {
        kind
        status
        gateway
        formattedGateway
        amountSet { shopMoney { amount } }
        paymentDetails {
          ... on CardPaymentDetails { company number paymentMethodName }
        }
      }
    }
  }
`
