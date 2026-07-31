/**
 * A Liquid render context. Shopify's drops are open-ended and differ per template, so the shape
 * stays open here rather than pretending we can model all of Shopify's variables.
 */
export type TemplateVariables = Record<string, unknown>
