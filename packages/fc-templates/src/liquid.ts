import { createShopifyEngine } from "@repo/shopify-emails/liquid"

/*
 * The Liquid engine every template renders through. `createShopifyEngine` supplies Shopify's own
 * filters, which liquidjs does not have, and takes away the ones a notification cannot reach.
 * The .liquid sources are verbatim copies of what Shopify ships and are never modified on disk;
 * the handful of preview-only quirks are patched in memory by `sanitizeForPreview`.
 */

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/* The store the previews stand in for. */
export const engine = createShopifyEngine({ currency: "USD", locale: "en-US" })

/*
 * Preview-only shim: Shopify's Liquid accepts a few constructs that liquidjs rejects. We rewrite
 * them just before parsing so the canonical on-disk Shopify source is never modified.
 */
export function sanitizeForPreview(source: string): string {
  return source
    .replace(/\[\s*([^[\]]+?)\s*\]\.compact\.join\(\s*'[^']*'\s*\)/g, (_match, items: string) => {
      const first = items.split(",")[0].trim()
      return first || "''"
    })
    .replace(/\.tracking_url\)\s*\}\}/g, ".tracking_url }}")
    .replace(/\.tracking_number\)\s*\}\}/g, ".tracking_number }}")
}
