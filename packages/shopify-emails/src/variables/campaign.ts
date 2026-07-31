import type { Customer, Shop } from "./store.ts"

/*
 * A marketing send rather than a notification. Shopify Email is a separate product from the
 * notification templates: nothing triggers the message, so there is no order to describe, and the
 * platform adds the unsubscribe link every bulk send is required to carry.
 *
 * Unlike the notification types, none of this was probed. Shopify Email ships no stock Liquid to
 * read and no preview endpoint to ask, and its Liquid support is documented only as a short
 * allow-list in help articles. These three are what our own campaigns read, and a live send is the
 * only thing that settles whether Shopify populates them.
 */
export type CampaignVariables = {
  readonly customer: Customer
  readonly shop: Shop
  /** Named `_url` here and `unsubscribe_link` in notifications, which is Shopify's own drift. */
  readonly unsubscribe_url: string
}

/** A line the shopper left behind, which the abandonment variables flatten rather than nesting a product. */
export type AbandonedProduct = {
  readonly image_url: string
  readonly quantity: number
  readonly title: string
  readonly variant_title: string
}

/** An abandonment automation is a campaign that also knows the visit it is chasing. */
export type AbandonmentVariables = CampaignVariables & {
  readonly abandoned_visit: {
    readonly products_added_to_cart: readonly AbandonedProduct[]
    /** What the message had no room to list, which the copy usually renders as "and N more". */
    readonly remaining_cart_products_count: number
    readonly url: string
  }
}
