import { Liquid } from "liquidjs"
import { filterCatalog, filterRefusal } from "./catalog.ts"
import { shopifyFilterShims, type ShimOptions } from "./shims.ts"

export type ShopifyEngineOptions = Partial<ShimOptions>

const refuse = (reason: string) => () => {
  throw new Error(reason)
}

/*
 * A Liquid engine that previews the way Shopify renders.
 *
 * Beyond adding Shopify's own filters it takes two away. liquidjs carries Jekyll's filters and a
 * handful of its own extensions, and Shopify has none of them; left in place they would let a
 * template preview perfectly and then print nothing in a customer's inbox. Theme-only filters go
 * the same way, for the same reason.
 */
export const createShopifyEngine = ({
  currency = "USD",
  locale = "en-US",
  timeZone
}: ShopifyEngineOptions = {}): Liquid => {
  const engine = new Liquid({ lenientIf: true, strictFilters: true, strictVariables: false })

  for (const name of Object.keys(engine.filters)) {
    if (!filterCatalog.has(name)) {
      engine.registerFilter(name, refuse(`"${name}" is a liquidjs filter that Shopify does not provide`))
    }
  }

  for (const [name, entry] of filterCatalog) {
    if (entry.status === "unavailable") {
      engine.registerFilter(name, refuse(filterRefusal(name) ?? name))
    }
  }

  const shims = shopifyFilterShims({ currency, locale, timeZone })
  for (const [name, implementation] of Object.entries(shims)) {
    engine.registerFilter(name, implementation)
  }
  /* Shopify documents the filter as `translate` and its notification templates spell it `t`. */
  engine.registerFilter("translate", shims.t)

  return engine
}
