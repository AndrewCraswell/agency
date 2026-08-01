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

/*
 * A store policy. It dumps as its body HTML, which is why a probe of `shop.privacy_policy` read a
 * string back, but the drop answers `title` and `url` as well.
 */
export type ShopPolicy = {
  readonly body: string
  readonly title: string
  /** Relative, so mail has to put `shop.url` in front of it. */
  readonly url: string
}

/** A business buyer's location, which is who a B2B order and its store credit actually belong to. */
export type CompanyLocation = {
  readonly company: { readonly name: string }
  readonly name: string
}

export type Shop = {
  readonly address: ShopAddress
  readonly contact_email: string | null
  readonly currency: string
  readonly customer_accounts_enabled: boolean
  readonly description: string
  readonly domain: string
  readonly email: string
  /** The one colour the merchant picks in Customize email templates. There is no second one. */
  readonly email_accent_color: string
  /** Empty until the merchant uploads one, which is why the header keeps a logo of its own. */
  readonly email_logo_url: string | null
  /** Pixels, and width only: the height is whatever the aspect ratio makes it. */
  readonly email_logo_width: number | null
  readonly id: number
  readonly locale: string
  readonly metafields: Metafields
  /** A pattern such as `${{amount}}`, meant for the `money` filter rather than for printing. */
  readonly money_format: string
  readonly money_with_currency_format: string
  readonly name: string
  readonly permanent_domain: string
  readonly phone: string
  /** Only the policies the merchant actually published, in the order the settings list them. */
  readonly policies: readonly ShopPolicy[]
  readonly privacy_policy: ShopPolicy
  readonly refund_policy: ShopPolicy
  readonly secure_url: string
  readonly shipping_policy: ShopPolicy
  readonly terms_of_service: ShopPolicy
  readonly url: string
}

/** Storefront paths, present only on the notifications that were built after Shopify added it. */
export type Routes = {
  readonly account_login_url: string
  readonly account_profile_url: string
  readonly account_url: string
  readonly root_url: string
}
