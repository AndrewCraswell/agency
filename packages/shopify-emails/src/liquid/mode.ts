/*
 * Templates render two ways from one tree. Compile mode emits Liquid for Shopify to run; value mode
 * resolves the same tree against real data so a preview shows "$181.48" rather than the expression
 * that produces it.
 *
 * The engine stays injected rather than imported here so that value mode depends on an interface
 * rather than on liquidjs. `createShopifyEngine` supplies the one this package builds.
 *
 * Which mode is active is ambient rather than contextual. See `environment.ts`.
 */

export type LiquidEvaluator = {
  readonly evalValueSync: (expression: string, scope: object) => unknown
}

export type TemplateValues = Record<string, unknown>

/** Liquid treats only `false` and `nil` as falsy, so an empty string or zero takes the true branch. */
export const isLiquidTruthy = (value: unknown): boolean => value !== false && value !== null && value !== undefined

/** Liquid prints nothing for a missing drop, where `String()` would print "null" into the email. */
export const toText = (value: unknown): string => (value === null || value === undefined ? "" : String(value))
