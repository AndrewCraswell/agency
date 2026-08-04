/** @jsxRuntime automatic */
/* The loader that runs the build command takes its JSX settings from the consumer's tsconfig, which
 * says nothing about this package's own files, so each one states the runtime it needs. */
import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { assertFiltersApply, filtersIn } from "../filters/validate.ts"
import type { LiquidCondition } from "../refs/expression.ts"
import { literalRef, pathOf, binding, isMarkupRef, type MarkupRef, type PathRef } from "../refs/path.ts"
import { encodeLiquid } from "../token.ts"
import {
  bindValue,
  highlightEnabled,
  isSuppliedDrop,
  plainTextOutput,
  resolveExpression,
  valueEnvironment,
  withBindings
} from "./environment.ts"
import { highlightedText, markAttributeDrop } from "./highlight.tsx"
import { isLiquidTruthy, toText } from "./mode.ts"

/*
 * Liquid tags expressed as React elements, rendered one of two ways from the same tree.
 *
 * Compile mode emits a token stream, because Liquid is a token stream: `{% else %}` is a separator,
 * not a container. Value mode resolves the tree against real data instead, which needs the opposite
 * shape, since a branch has to know which children belong to it. Tree-shaped tags satisfy both: an
 * `<Else>` that emits its marker and then its children produces the same flat Liquid it always did.
 */

const outputTag = (expression: string): string => encodeLiquid(`{{ ${expression} }}`, "value")

/*
 * A drop is data, and Liquid hands data through untouched where React escapes it. Left alone the
 * two paths disagree on the one case that matters: a preview would show a customer's own text as
 * inert while the delivered email treats it as markup. Compiling asks Liquid for React's behaviour.
 *
 * Positions opt out. A `Capture` binds rendered markup, so escaping it would print the tags rather
 * than apply them; the subject line is not HTML at all; and Shopify will not accept a body that
 * puts a filter on a drop it writes itself, such as a merchant's `custom_message`.
 */
const dropTag = (expression: string, raw: boolean): string =>
  outputTag(raw || plainTextOutput() ? expression : `${expression} | escape`)

const statementTag = (statement: string): string => encodeLiquid(`{% ${statement} %}`, "raw")

const expressionFor = (ref: PathRef<unknown>, filters: readonly string[]): string => {
  const path = pathOf(ref)
  assertFiltersApply(filters, path)
  return [path, ...filters].join(" | ")
}

/* Attribute drops carry their expression inline, for `decorateAttributeDrops` to lift out later. */
const resolvedText = (expression: string): string => {
  const text = toText(resolveExpression(expression))
  return highlightEnabled() ? markAttributeDrop(expression, text) : text
}

const isElementOf = <TProps,>(node: ReactNode, component: (props: TProps) => ReactNode): node is ReactElement<TProps> =>
  isValidElement(node) && node.type === component

export type VarProps = {
  readonly path: PathRef<unknown>
  readonly filters?: readonly string[]
  /* Shopify rejects a notification body that filters a merchant-written drop, so those read bare. */
  readonly raw?: boolean
}

/*
 * Preview-only decoration, so a reader can see which words on the page came from a drop and which
 * were typed. An empty drop would otherwise be invisible, which is the case most worth seeing, so
 * it shows its own expression instead of nothing.
 */

/* For attribute positions, where a React element cannot go, use `liquidValue` instead. */
export const Var = ({ path, filters = [], raw = false }: VarProps): ReactNode => {
  const expression = expressionFor(path, filters)
  const unescaped = raw || isMarkupRef(path)
  if (!valueEnvironment()) {
    return dropTag(expression, unescaped)
  }
  const text = toText(resolveExpression(expression))
  /* A captured name already holds rendered markup, including whatever its own drops highlighted. */
  if (unescaped) {
    return encodeLiquid(text, "raw")
  }
  return highlightEnabled() ? highlightedText(expression, text) : text
}

/*
 * Attribute positions, resolved in place rather than deferred, because the ambient environment is
 * readable from a plain function where React context is not.
 */
export const liquidValue = (ref: PathRef<unknown>, filters: readonly string[] = []): string => {
  /* An attribute is quoted text, so markup in one is never what was meant and would ship escaped. */
  if (isMarkupRef(ref)) {
    throw new Error(`\`${pathOf(ref)}\` holds markup, which an attribute cannot carry. Read it with \`Var\`.`)
  }
  const expression = expressionFor(ref, filters)
  return valueEnvironment() ? resolvedText(expression) : dropTag(expression, false)
}

/** For output that no drop stands behind, such as the copyright year's `'now' | date: '%Y'`. */
export const liquidExpression = (expression: string): string => {
  assertFiltersApply(filtersIn(expression), expression)
  return valueEnvironment() ? resolvedText(expression) : outputTag(expression)
}

export type ConditionProps = {
  readonly test: LiquidCondition
  readonly children?: ReactNode
}

export type BranchProps = {
  readonly test: LiquidCondition
  readonly children?: ReactNode
}

/* Liquid spells this `elsif`; `elseif` is silently treated as plain text by Shopify. */
export const ElseIf = ({ test, children }: BranchProps) => (
  <>
    {statementTag(`elsif ${test}`)}
    {children}
  </>
)

export const Else = ({ children }: { readonly children?: ReactNode }) => (
  <>
    {statementTag("else")}
    {children}
  </>
)

type Branch = { test?: LiquidCondition; nodes: ReactNode[] }

const branchesOf = (test: LiquidCondition, children: ReactNode): Branch[] => {
  let current: Branch = { test, nodes: [] }
  const branches = [current]
  for (const child of Children.toArray(children)) {
    if (isElementOf<BranchProps>(child, ElseIf)) {
      current = { test: child.props.test, nodes: [child.props.children] }
      branches.push(current)
      continue
    }
    if (isElementOf<{ children?: ReactNode }>(child, Else)) {
      current = { nodes: [child.props.children] }
      branches.push(current)
      continue
    }
    current.nodes.push(child)
  }
  return branches
}

const selectBranch = (branches: readonly Branch[], negateFirst: boolean): ReactNode => {
  for (const [index, branch] of branches.entries()) {
    if (branch.test === undefined) {
      return branch.nodes
    }
    const holds = isLiquidTruthy(resolveExpression(branch.test))
    if (index === 0 && negateFirst ? !holds : holds) {
      return branch.nodes
    }
  }
  return null
}

export const If = ({ test, children }: ConditionProps) => {
  if (valueEnvironment()) {
    return <>{selectBranch(branchesOf(test, children), false)}</>
  }
  return (
    <>
      {statementTag(`if ${test}`)}
      {children}
      {statementTag("endif")}
    </>
  )
}

export const Unless = ({ test, children }: ConditionProps) => {
  if (valueEnvironment()) {
    return <>{selectBranch(branchesOf(test, children), true)}</>
  }
  return (
    <>
      {statementTag(`unless ${test}`)}
      {children}
      {statementTag("endunless")}
    </>
  )
}

export type ForLoop = {
  readonly first: boolean
  readonly last: boolean
  readonly index: number
  readonly index0: number
  readonly rindex: number
  readonly rindex0: number
  readonly length: number
}

export type ForProps<TItem> = {
  readonly each: PathRef<readonly TItem[]>
  readonly limit?: number
  readonly children: (item: PathRef<TItem>, loop: PathRef<ForLoop>) => ReactNode
}

/*
 * Derived rather than named by the caller: a chosen name that collides with a drop shadows it in the
 * compiled template while value mode still resolves the drop, so the modes disagree only in the
 * artifact nobody previews. The path also makes nested loops distinct, since an inner collection's
 * path already contains the outer alias.
 *
 * Deriving narrows that risk without closing it, so the one name Shopify could also be using is
 * checked rather than assumed.
 */
const derivedName = (collection: string, suffix: string): string => {
  const name = `${collection.replace(/\W/g, "_")}_${suffix}`
  if (isSuppliedDrop(name)) {
    throw new Error(`Iterating \`${collection}\` needs the name \`${name}\`, which Shopify already supplies.`)
  }
  return name
}

const aliasFor = (collection: string) => derivedName(collection, "item")

/*
 * Liquid's own `forloop`, handed to the body rather than read from the surrounding variables. Compile
 * mode points it at the real drop; value mode bakes the iteration in as literals, because the body's
 * elements render after the loop has moved on and so cannot read a binding that is still standing.
 */
const compileLoop = binding<ForLoop>("forloop")

const valueLoop = (index: number, length: number): PathRef<ForLoop> =>
  literalRef<ForLoop>({
    first: String(index === 0),
    last: String(index === length - 1),
    index: String(index + 1),
    index0: String(index),
    rindex: String(length - index),
    rindex0: String(length - index - 1),
    length: String(length)
  })

/* Hand-written Liquid resolves eagerly, while the iteration is still current, so it reads bindings. */
const loopBindings = (index: number, length: number) => ({
  first: index === 0,
  last: index === length - 1,
  index: index + 1,
  index0: index,
  rindex: length - index,
  rindex0: length - index - 1,
  length
})

export const For = <TItem,>({ each, limit, children }: ForProps<TItem>) => {
  const path = pathOf(each)
  const alias = aliasFor(path)
  if (valueEnvironment()) {
    const collection = resolveExpression(path)
    const items = Array.isArray(collection) ? collection : []
    const visible = limit === undefined ? items : items.slice(0, limit)
    return (
      <>
        {visible.map((item: unknown, index) => (
          <Fragment key={`${path}-${index}`}>
            {withBindings({ [alias]: item, forloop: loopBindings(index, visible.length) }, () =>
              children(binding<TItem>(`${path}[${index}]`), valueLoop(index, visible.length))
            )}
          </Fragment>
        ))}
      </>
    )
  }
  return (
    <>
      {statementTag(`for ${alias} in ${path}${limit === undefined ? "" : ` limit: ${limit}`}`)}
      {children(binding<TItem>(alias), compileLoop)}
      {statementTag("endfor")}
    </>
  )
}

export type FindProps<TItem> = {
  readonly each: PathRef<readonly TItem[]>
  readonly match: (item: PathRef<TItem>) => LiquidCondition
  readonly children: (item: PathRef<TItem>) => ReactNode
}

/*
 * The one item in a collection that a condition picks out — the transaction that was charged, the
 * fulfillment being announced. Liquid cannot say that directly: `where` and `find` belong to the
 * theme dialect, and Shopify's reference excludes notification templates, so this
 * compiles to the loop the stock notification templates use for the same job.
 *
 * No `break`, because not one of the stock templates uses one and the dialect is undocumented, so a
 * later match overwrites an earlier one and the last wins. Value mode takes the last too, since the
 * two paths have to agree. Match on something unique and the distinction never arises.
 */
export const Find = <TItem,>({ each, match, children }: FindProps<TItem>) => {
  const path = pathOf(each)
  const alias = aliasFor(path)
  const found = derivedName(path, "found")
  if (valueEnvironment()) {
    const collection = resolveExpression(path)
    const items = Array.isArray(collection) ? collection : []
    const index = items.findLastIndex((_item: unknown, at: number) =>
      isLiquidTruthy(resolveExpression(match(binding<TItem>(`${path}[${at}]`))))
    )
    return <>{index === -1 ? null : children(binding<TItem>(`${path}[${index}]`))}</>
  }
  return (
    <>
      {statementTag(`assign ${found} = nil`)}
      {statementTag(`for ${alias} in ${path}`)}
      {statementTag(`if ${match(binding<TItem>(alias))}`)}
      {statementTag(`assign ${found} = ${alias}`)}
      {statementTag("endif")}
      {statementTag("endfor")}
      {statementTag(`if ${found}`)}
      {children(binding<TItem>(found))}
      {statementTag("endif")}
    </>
  )
}

export type WhenProps = {
  readonly value: string
  readonly children?: ReactNode
}

export const When = ({ value, children }: WhenProps) => (
  <>
    {statementTag(`when '${value}'`)}
    {children}
  </>
)

export type CaseProps = {
  readonly on: PathRef<unknown>
  readonly children?: ReactNode
}

export const Case = ({ on, children }: CaseProps) => {
  if (valueEnvironment()) {
    const actual = toText(resolveExpression(pathOf(on)))
    const match = Children.toArray(children).find(
      (child) => isElementOf<WhenProps>(child, When) && child.props.value === actual
    )
    return <>{isElementOf<WhenProps>(match, When) ? match.props.children : null}</>
  }
  return (
    <>
      {statementTag(`case ${pathOf(on)}`)}
      {children}
      {statementTag("endcase")}
    </>
  )
}

/*
 * Both bind a name that later parts of the template read. Value mode writes into the ambient
 * environment as the render passes through, which matches Liquid, with one caveat that `renderValues` reports:
 * a bare `liquidValue` or `liquidExpression` call is evaluated while the surrounding JSX is built,
 * so it runs ahead of an `<Assign>` alongside it. Reading through `<Var>` renders in order.
 *
 * Both take the ref from `binding` rather than the name itself, so the write and every later read
 * are the same declaration and a misspelt read no longer renders a silent blank.
 */
export type AssignProps<T> = {
  readonly to: PathRef<T>
  readonly value: string
}

export const Assign = <T,>({ to, value }: AssignProps<T>) => {
  const name = pathOf(to)
  if (valueEnvironment()) {
    bindValue(name, resolveExpression(value))
    return null
  }
  return statementTag(`assign ${name} = ${value}`)
}

/* Always a string: what it binds is rendered markup. */
export type CaptureProps = {
  readonly to: MarkupRef
  readonly children?: ReactNode
}

export const Capture = ({ to, children }: CaptureProps) => {
  const name = pathOf(to)
  if (valueEnvironment()) {
    bindValue(name, renderToStaticMarkup(<>{children}</>))
    return null
  }
  return (
    <>
      {statementTag(`capture ${name}`)}
      {children}
      {statementTag("endcapture")}
    </>
  )
}

export const Raw = ({ children }: { readonly children?: ReactNode }) => {
  if (valueEnvironment()) {
    return <>{children}</>
  }
  return (
    <>
      {statementTag("raw")}
      {children}
      {statementTag("endraw")}
    </>
  )
}
