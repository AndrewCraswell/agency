/*
 * The drop vocabulary Shopify actually hands to notification templates.
 *
 * Shopify publishes no schema for this. Its Liquid reference explicitly excludes notifications:
 * "Shopify also uses slightly different versions of Liquid to render dynamic content for the
 * following features. These variations aren't included in this reference. Notification templates,
 * Shopify Flow, Order printer templates, Packing slip templates." So the reference describes
 * neighbouring objects, not ours, and agreeing with it proves nothing.
 *
 * This list is instead the free variables of the 46 notification templates the store already
 * sends: every identifier they read without first binding it through `assign`, `capture`, or a
 * `for` alias. Shopify's own stock templates only reference drops Shopify populates, so a name
 * appearing here is evidence that Shopify supplies it.
 *
 * Treat it as a floor, not a ceiling. Absence means nobody has used a drop yet, not that it does
 * not exist, and no static reading of templates can reveal a drop nobody references. `buildProbe`
 * exists to settle those cases against a live send.
 */
export const observedNotificationDrops = [
  "account_link",
  "added_line_items",
  "added_total",
  "amount",
  "apc_currency_converted?",
  "apc_wallet_app_name",
  "apc_wallet_name",
  "b2b?",
  "billing_address",
  "cancel_reason",
  "checkout_payment_collection_url",
  "checkout_url",
  "company_location",
  "currency",
  "custom_message",
  "customer",
  "delivery_agreements",
  "delivery_method",
  "delivery_method_for_subtotal",
  "discount_applications",
  "display_name",
  "email",
  "email_confirmation_url",
  "exchange_total",
  "financial_status",
  "fulfillment",
  "fulfillment_status",
  "gift_card",
  "invoice_url",
  "issued_store_credit",
  "item_count",
  "line_items",
  "line_items_including_zero_quantity",
  "location_name",
  "name",
  "new_email",
  "note",
  "open_tracking_block",
  "order",
  "order_name",
  "order_status_url",
  "original_presentment_currency",
  "payment_schedule",
  "payment_terms",
  "pickup_methods",
  "po_number",
  "previous_email",
  "refund_line_items",
  "requested_edit",
  "requires_shipping",
  "retail_delivery_only",
  "return",
  "return_label",
  "return_line_items",
  "return_total",
  "routes",
  "shipping_address",
  "shipping_method",
  "shipping_methods",
  "shipping_price",
  "shop",
  "shop_app_tracking_button_variant_key",
  "shop_app_tracking_url",
  "shop_link",
  "shop_name",
  "subtotal_line_items",
  "subtotal_price",
  "tax_price",
  "total_discounts",
  "total_duties",
  "total_outstanding",
  "total_price",
  "total_tip",
  "transaction_id",
  "transactions",
  "unsubscribe_link",
  "url",
  "void_transactions"
] as const satisfies readonly string[]
