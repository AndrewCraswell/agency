/*
 * Typed paths into a template's variables. Every property access on a ref records another path
 * segment, so `vars.shipping_address.city` carries the string "shipping_address.city" while the
 * compiler checks each step against the type the template declared.
 */

/* Phantom only: it never exists at runtime, and carries the referenced type so `For` can infer items. */
declare const REF: unique symbol

/*
 * A ref has no way to say "this might not be here": every read compiles to a drop, and Liquid prints
 * a missing drop as nothing. So an optional variable would type as present and go blank in the
 * mail with no error anywhere. Naming it here turns that into a compile error at the first read.
 */
type OptionalVariable<K extends string> = {
  readonly __optionalVariable: `"${K}" is optional. A drop is either sampled or absent, so give it a value.`
}

type IsOptional<T, K extends keyof T> = Omit<T, K> extends T ? true : false

/* Liquid publishes `size`, `first` and `last` on a collection; everything else needs a `for`. */
type PathMembers<T> = T extends readonly (infer TItem)[]
  ? { readonly size: PathRef<number>; readonly first: PathRef<TItem>; readonly last: PathRef<TItem> }
  : T extends object
    ? {
        readonly [K in keyof T & string]-?: IsOptional<T, K> extends true
          ? OptionalVariable<K>
          : PathRef<NonNullable<T[K]>>
      }
    : unknown

export type PathRef<T> = { readonly [REF]: T } & PathMembers<T>

/*
 * Registered rather than unique, because a ref has to be readable across module instances. A
 * consumer can reach this package through a second graph — a bundler, a test runner, a mixed
 * CJS and ESM tree — and a plain `Symbol()` would make each copy blind to the other's refs.
 */
const PATH = Symbol.for("@repo/shopify-emails/path")
const MARKUP = Symbol.for("@repo/shopify-emails/markup")

const refFor = (path: string, markup = false): unknown =>
  new Proxy(
    {},
    {
      get: (_target, key) => {
        if (key === PATH) {
          return path
        }
        if (key === MARKUP) {
          return markup
        }
        /* React and the test runner probe well-known symbols; none of them name a Liquid property. */
        if (typeof key === "symbol") {
          return undefined
        }
        return refFor(path === "" ? key : `${path}.${key}`)
      }
    }
  )

/** The root of a template's variables. Shopify notifications put the order's own drops at this level. */
export const rootRef = <T extends object>(): PathRef<T> => refFor("") as PathRef<T>

/*
 * A name the template binds for itself with `Assign` or `Capture`, rather than one Shopify passed
 * in. Declaring it once gives the binding and every read of it a single spelling the compiler
 * checks. Liquid values are text unless you say otherwise, so the type argument is rarely needed.
 */
export const binding = <T = string>(name: string): PathRef<T> => refFor(name) as PathRef<T>

/* Phantom only, so a name holding markup cannot be passed where a name holding data is expected. */
declare const MARKUP_REF: unique symbol

export type MarkupRef = PathRef<string> & { readonly [MARKUP_REF]: true }

/*
 * A name `Capture` binds to rendered markup rather than to data. Reading one is the single place a
 * drop must not be escaped: escaping it would print the tags instead of applying them. Keeping the
 * two kinds of name apart in the type means no read has to remember which it is holding.
 */
export const markupBinding = (name: string): MarkupRef => refFor(name, true) as MarkupRef

export const isMarkupRef = (ref: PathRef<unknown>): boolean => (ref as Record<symbol, unknown>)[MARKUP] === true

/*
 * A ref whose members are fixed Liquid literals rather than paths. It stands in for variables that
 * Liquid builds during its own render and that therefore have no address a later pass could look up.
 */
export const literalRef = <T extends object>(literals: Readonly<Record<string, string>>): PathRef<T> =>
  new Proxy(
    {},
    {
      get: (_target, key) => (typeof key === "symbol" ? undefined : refFor(literals[key] ?? "nil"))
    }
  ) as PathRef<T>

export const pathOf = (ref: PathRef<unknown>): string => {
  const path = (ref as Record<symbol, unknown>)[PATH]
  if (typeof path !== "string" || path === "") {
    throw new Error("Expected a property of the template's variables, not the whole set")
  }
  return path
}

export const isPathRef = (value: unknown): value is PathRef<unknown> =>
  typeof value === "object" && value !== null && typeof (value as Record<symbol, unknown>)[PATH] === "string"
