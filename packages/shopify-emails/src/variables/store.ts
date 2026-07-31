import type { CustomerAddress, Cents, Metafields, OpaqueDrop, ShopAddress } from "./primitives.ts"

/*
 * `json` refuses both `customer` and `shop`, so every property below was probed by name. Anything
 * the sample data left empty is typed nullable rather than omitted, because the drop still resolves.
 */

export type Customer = {
  readonly accepts_marketing: boolean
  readonly addresses: readonly CustomerAddress[]
  readonly "b2b?": boolean | null
  readonly created_at: string | null
  readonly currency: string | null
  readonly default_address: CustomerAddress | null
  readonly email: string
  readonly first_name: string
  readonly has_account: boolean
  readonly id: number
  readonly last_name: string
  readonly last_order: OpaqueDrop | null
  readonly metafields: Metafields
  readonly name: string
  readonly note: string | null
  readonly orders_count: number
  readonly phone: string | null
  readonly state: string | null
  readonly tags: readonly string[]
  readonly tax_exempt: boolean
  readonly total_spent: Cents
  readonly verified_email: boolean | null
}

export type ShopPolicy = {
  readonly title: string
  readonly url: string
}

export type Shop = {
  readonly address: ShopAddress
  readonly contact_email: string | null
  readonly currency: string
  readonly customer_accounts_enabled: boolean
  readonly description: string
  readonly domain: string
  readonly email: string
  readonly id: number
  readonly locale: string
  readonly metafields: Metafields
  /** A pattern such as `${{amount}}`, meant for the `money` filter rather than for printing. */
  readonly money_format: string
  readonly money_with_currency_format: string
  readonly name: string
  readonly permanent_domain: string
  readonly phone: string
  /** Dumps as raw policy HTML, but each entry also answers `title` and `url`. */
  readonly policies: readonly ShopPolicy[]
  readonly privacy_policy: string
  readonly refund_policy: string
  readonly secure_url: string
  readonly shipping_policy: string
  readonly terms_of_service: string
  readonly url: string
}

/** Storefront paths, present only on the notifications that were built after Shopify added it. */
export type Routes = {
  readonly account_login_url: string
  readonly account_profile_url: string
  readonly account_url: string
  readonly root_url: string
}
