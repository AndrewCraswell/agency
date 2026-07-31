/*
 * Drops Shopify documents for notifications that none of this store's 46 templates happen to read.
 *
 * `observedNotificationDrops` is evidence from templates, so it can only ever contain names someone
 * already used. This is the other half of the question: names Shopify's own notification variables
 * reference lists, which the probe should therefore ask about even though nothing here reads them.
 *
 * Source: help.shopify.com/en/manual/fulfillment/setup/notifications/email-variables. Only the
 * roots are listed. Anything the page shows as a path — `shipping_method.title`, `line.quantity`,
 * `payment_schedule.due_at` — arrives inside its root and `json` will dump it there.
 *
 * That page is documentation for a dialect Shopify does not otherwise specify, so treat it as a
 * claim rather than a schema: it says every variable is available in every template, which is
 * plainly not how the stock templates are written. The probe is what settles it.
 */
export const documentedNotificationDrops = [
  "amount_due_now",
  "attributes",
  "buyer_action_required",
  "buyer_pending_payment_instructions",
  "cancelled",
  "cancelled_at",
  "company",
  "confirmation_number",
  "consolidated_estimated_delivery_time",
  "created_at",
  "customer_order_url",
  "delivery_instructions",
  "destination",
  "discounts",
  "discounts_amount",
  "discounts_savings",
  "has_multiple_delivery_methods",
  "has_pending_payment",
  "id",
  "landing_site",
  "landing_site_ref",
  "line_item_groups",
  "location",
  "metafields",
  "number",
  "order_number",
  "payment_methods",
  "prepared_package_line_items",
  "referring_site",
  "reserve_inventory_until",
  "service_name",
  "subscription_contract_billing_cycle",
  "tags",
  "tax_lines",
  "unique_gateways",
  "user"
] as const satisfies readonly string[]

/*
 * Documented, and documented as deprecated. Asked about anyway: a deprecated drop that still
 * arrives is a drop a template can still read, and knowing it is empty is worth one line.
 */
export const deprecatedNotificationDrops = [
  "fulfilled_line_items",
  "has_high_risks?",
  "items_to_fulfill",
  "items_to_fulfill_count",
  "unfulfilled_line_items"
] as const satisfies readonly string[]
