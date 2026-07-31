import { filterRefusal } from "./catalog.ts"

/*
 * A filter Shopify does not have prints nothing and reports nothing, so it has to be refused here.
 *
 * `assertFiltersApply` runs where a filter is named, which is the only point that still knows which
 * drop it was applied to. The source-wide pass is the net beneath it: `Raw` puts Liquid into a
 * template that no ref ever passed through, and a template nobody previewed still has to fail the
 * build rather than the send.
 */

const TAGS = /\{\{(.*?)\}\}|\{%(.*?)%\}/gs
const FILTERS = /\|\s*([a-z_][a-z_0-9]*)/g
const STRINGS = /'[^']*'|"[^"]*"/g

/** The filters named in one Liquid expression, in the order Shopify would apply them. */
export const filtersIn = (expression: string): readonly string[] =>
  /* A filter name cannot come from inside a quoted argument, and `|` is legal text there. */
  [...expression.replace(STRINGS, "").matchAll(FILTERS)].map((match) => match[1])

/** Every filter named in a compiled template, in the order Shopify would apply them. */
export const filterNamesIn = (source: string): readonly string[] =>
  [...source.matchAll(TAGS)].flatMap((tag) => filtersIn(tag[1] ?? tag[2] ?? ""))

const refusalsFor = (names: readonly string[]): readonly string[] =>
  [...new Set(names)].map(filterRefusal).filter((reason) => reason !== undefined)

/** A `filters` entry carries its arguments too, as in `date: '%B %e, %Y'`; only the name is checked. */
const filterName = (filter: string): string => filter.split(":")[0].trim()

/** Refuses a filter at the point it is named, where the expression it belongs to is still known. */
export const assertFiltersApply = (filters: readonly string[], expression: string): void => {
  const refusals = refusalsFor(filters.map(filterName))
  if (refusals.length > 0) {
    throw new Error(`\`${expression}\` uses a filter it cannot: ${refusals.join("; ")}`)
  }
}

export const assertFiltersAreAvailable = (source: string, templateId: string): void => {
  const refusals = refusalsFor(filterNamesIn(source))
  if (refusals.length > 0) {
    throw new Error(`${templateId} uses a filter it cannot: ${refusals.join("; ")}`)
  }
}
