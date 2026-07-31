import type { CustomerAddress, ShopAddress } from "../variables/primitives.ts"
import type { Customer, Routes, Shop, ShopPolicy } from "../variables/store.ts"

/*
 * The shop and customer every template is previewed against. Deliberately generic: this ships with
 * the package, so a store's own data belongs in the CLI's live load rather than here.
 *
 * Values follow the shapes the probe read back from Shopify. Money is integer cents, addresses
 * carry both a name and its parts, and anything the platform leaves empty is null rather than
 * missing, because the drop still resolves.
 */

const shopAddress: ShopAddress = {
  address1: "500 Front Street",
  address2: null,
  city: "Seattle",
  country: "United States",
  first_name: null,
  last_name: null,
  phone: "+1 206 555 0142",
  province: "Washington",
  zip: "98109"
}

const policies: readonly ShopPolicy[] = [
  { title: "Refund policy", url: "/policies/refund-policy" },
  { title: "Privacy policy", url: "/policies/privacy-policy" },
  { title: "Terms of service", url: "/policies/terms-of-service" },
  { title: "Shipping policy", url: "/policies/shipping-policy" }
]

export const shopSample: Shop = {
  address: shopAddress,
  contact_email: null,
  currency: "USD",
  customer_accounts_enabled: true,
  description: "Gear built for the people who use it hardest.",
  domain: "example-store.com",
  email: "support@example-store.com",
  id: 84_825_276_713,
  locale: "en",
  metafields: {},
  money_format: "${{amount}}",
  money_with_currency_format: "${{amount}} USD",
  name: "Example Store",
  permanent_domain: "example-store.myshopify.com",
  phone: "+1 206 555 0142",
  policies,
  privacy_policy: "<p>We keep what you give us and nothing more.</p>",
  refund_policy: "<p>Thirty days, unworn, and we pay the return shipping.</p>",
  secure_url: "https://example-store.com",
  shipping_policy: "<p>Orders leave the warehouse within one business day.</p>",
  terms_of_service: "<p>The usual terms, written plainly.</p>",
  url: "https://example-store.com"
}

const customerAddress: CustomerAddress = {
  address1: "17190 128th Place NE",
  address2: null,
  city: "Woodinville",
  company: null,
  country: "United States",
  country_code: "US",
  customer_id: 115_310_627_314_723_950,
  first_name: "Alex",
  id: 872_310_998_231,
  last_name: "Rivera",
  latitude: 47.754_23,
  longitude: -122.163_11,
  name: "Alex Rivera",
  phone: null,
  province: "Washington",
  province_code: "WA",
  zip: "98072"
}

export const customerSample: Customer = {
  accepts_marketing: true,
  addresses: [customerAddress],
  "b2b?": false,
  created_at: null,
  currency: null,
  default_address: customerAddress,
  email: "alex@example.com",
  first_name: "Alex",
  has_account: true,
  id: 115_310_627_314_723_950,
  last_name: "Rivera",
  last_order: null,
  metafields: {},
  name: "Alex Rivera",
  note: null,
  orders_count: 4,
  phone: null,
  state: "enabled",
  tags: [],
  tax_exempt: false,
  total_spent: 61_240,
  verified_email: true
}

export const routesSample: Routes = {
  account_login_url: "/account/login",
  account_profile_url: "/account/profile",
  account_url: "/account",
  root_url: "/"
}
