import type { TemplateVariables } from "../../types.ts"

/*
 * The identity layer every template shares: who the store is, who the customer is, and where the
 * order is going. Template-specific variable files spread these in rather than restating them.
 */

export const shop = {
  name: "Fencing Club",
  email: "support@fencing.club",
  phone: "(425) 312-3746",
  url: "https://fencing.club",
  domain: "fencing.club",
  address: {
    address1: "17190 128th Pl NE",
    city: "Woodinville",
    province: "Washington",
    province_code: "WA",
    zip: "98072",
    country: "United States"
  },
  email_accent_color: "#101012",
  refund_policy: {
    body: "Returns are accepted according to the Fencing Club return policy."
  }
}

export const customer = {
  first_name: "Alex",
  last_name: "Morgan",
  name: "Alex Morgan",
  email: "alex@example.com",
  reset_password_url: "https://fencing.club/account/reset/FC1042TEST",
  account_activation_url: "https://fencing.club/account/activate/FC1042TEST",
  subscribe_url: "https://fencing.club/account/subscribe/FC1042TEST"
}

export const shippingAddress = {
  first_name: "Alex",
  last_name: "Morgan",
  address1: "125 Main Street",
  address2: "Suite 4",
  city: "Boston",
  province: "Massachusetts",
  province_code: "MA",
  zip: "02110",
  country: "United States",
  country_code: "US",
  phone: "+1 617-555-0142"
}

export const billingAddress = {
  first_name: "Alex",
  last_name: "Morgan",
  address1: "125 Main Street",
  address2: "Suite 4",
  city: "Boston",
  province: "Massachusetts",
  province_code: "MA",
  zip: "02110",
  country: "United States",
  country_code: "US"
}

export const baseVariables: TemplateVariables = {
  shop,
  customer,
  email: customer.email,
  display_name: customer.name,
  shipping_address: shippingAddress,
  billing_address: billingAddress,
  currency: "USD",
  presentment_currency: "USD"
}
