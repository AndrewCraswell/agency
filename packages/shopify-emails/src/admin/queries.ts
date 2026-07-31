/*
 * Every document here has been checked against the 2026-04 Admin schema. Two fields are not the
 * obvious ones: `Shop.billingAddress` is deprecated in favour of `shopAddress`, and card details
 * expose a masked `number` rather than a last-four field, so the digits are derived when mapping.
 */

export const SHOP_QUERY = `
  query Shop {
    shop {
      name
      email
      url
      shopAddress {
        address1
        city
        provinceCode
        zip
        country
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
  query Orders($query: String, $first: Int!) {
    orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
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
      name
      statusPageUrl
      displayFinancialStatus
      requiresShipping
      subtotalPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      totalTaxSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      customer {
        firstName
        lastName
        displayName
        defaultEmailAddress { emailAddress }
      }
      shippingAddress { ...Addr }
      billingAddress { ...Addr }
      shippingLine { title originalPriceSet { shopMoney { amount } } }
      lineItems(first: 100) {
        nodes {
          title
          variantTitle
          quantity
          image { url }
          originalTotalSet { shopMoney { amount } }
          discountedTotalSet { shopMoney { amount } }
          product { title featuredMedia { preview { image { url } } } }
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
