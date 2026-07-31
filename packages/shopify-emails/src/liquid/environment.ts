import { observedNotificationDrops } from "../samples/observedDrops.ts"
import type { LiquidEvaluator, TemplateValues } from "./mode.ts"

/*
 * Value mode's ambient environment.
 *
 * A React context cannot serve this, because the values that most need resolving sit in attributes,
 * and an attribute is a plain function call rather than a component. Attributes are also evaluated
 * eagerly, when the enclosing JSX is built, so they run before any sibling component renders. A
 * module-level environment is what lets both positions read the same data at the point they are
 * reached.
 *
 * The environment is installed around a single synchronous render and torn down afterwards, so two
 * renders can never observe each other.
 */

type ValueEnvironment = {
  readonly engine: LiquidEvaluator
  readonly values: TemplateValues
  /** Names `Assign` and `Capture` created, used to catch a read that ran before its binding. */
  readonly bound: Set<string>
  readonly missedReads: Map<string, string>
  readonly highlight: boolean
}

type ValueState = {
  current: ValueEnvironment | undefined
  /* The subject is not HTML, so a drop in it must not be escaped: an ampersand in a customer's name
   * belongs in the inbox as an ampersand, not as `&amp;`. */
  plainText: boolean
}

/*
 * Kept on a registered slot rather than in a module binding. The build command loads a consumer's
 * templates through jiti, which hands them their own copy of this module, and two copies would each
 * install an environment the other could not see.
 */
const STATE = Symbol.for("@repo/shopify-emails/value-state")

const isValueState = (value: unknown): value is ValueState =>
  typeof value === "object" && value !== null && "plainText" in value

const sharedState = (): ValueState => {
  const existing: unknown = Reflect.get(globalThis, STATE)
  if (isValueState(existing)) {
    return existing
  }
  const created: ValueState = { current: undefined, plainText: false }
  Reflect.set(globalThis, STATE, created)
  return created
}

const state = sharedState()

export const valueEnvironment = (): ValueEnvironment | undefined => state.current

export const highlightEnabled = (): boolean => state.current?.highlight === true

export const plainTextOutput = (): boolean => state.plainText

export const asPlainText = <T>(run: () => T): T => {
  state.plainText = true
  try {
    return run()
  } finally {
    state.plainText = false
  }
}

/** The leading name of an expression, which is the binding an unresolved read was looking for. */
const rootIdentifier = (expression: string): string | undefined => {
  const [subject = ""] = expression.split("|")
  const [name = ""] = subject.trim().split(/[.[\s]/)
  return /^[a-zA-Z_]\w*$/.test(name) ? name : undefined
}

/* Liquid's own words, which resolve to nothing by design and name no drop. */
const KEYWORDS = new Set(["blank", "empty", "false", "nil", "null", "true"])

/* Shopify hands these to every notification, so a template may read one the sample has no value for. */
const SUPPLIED = new Set<string>(observedNotificationDrops)

/** True for a name Shopify itself binds, which a template must not bind over. */
export const isSuppliedDrop = (name: string): boolean => SUPPLIED.has(name)

export const resolveExpression = (expression: string): unknown => {
  const environment = state.current
  if (!environment) {
    throw new Error(`\`${expression}\` was resolved outside a value render.`)
  }
  const value = environment.engine.evalValueSync(expression, environment.values)
  if (value === undefined || value === null) {
    const name = rootIdentifier(expression)
    /* Already named means the sample declares it and this order leaves it blank, which is data. */
    const declared =
      name === undefined ||
      KEYWORDS.has(name) ||
      SUPPLIED.has(name) ||
      environment.bound.has(name) ||
      name in environment.values
    if (name !== undefined && !declared && !environment.missedReads.has(name)) {
      environment.missedReads.set(name, expression)
    }
  }
  return value
}

export const bindValue = (name: string, value: unknown): void => {
  const environment = state.current
  if (!environment) {
    return
  }
  environment.values[name] = value
  environment.bound.add(name)
}

/** Bindings that live only while `run` builds its nodes, such as a loop's alias and `forloop`. */
export const withBindings = <T>(bindings: TemplateValues, run: () => T): T => {
  const environment = state.current
  if (!environment) {
    return run()
  }
  const shadowed = Object.keys(bindings).map((name): [string, unknown] => [name, environment.values[name]])
  Object.assign(environment.values, bindings)
  try {
    return run()
  } finally {
    for (const [name, previous] of shadowed) {
      if (previous === undefined) {
        delete environment.values[name]
      } else {
        environment.values[name] = previous
      }
    }
  }
}

export type ValueRenderResult<T> = {
  readonly result: T
  /** Expressions that resolved to nothing, then had their name bound later in the same render. */
  readonly readBeforeBound: readonly string[]
  /** Expressions naming something the values never held, which is a drop nobody sampled. */
  readonly unknownDrops: readonly string[]
}

export const runInValueMode = <T>(
  engine: LiquidEvaluator,
  values: TemplateValues,
  render: () => T,
  highlight = false
): ValueRenderResult<T> => {
  if (state.current) {
    throw new Error("A value render is already in progress. Value mode renders synchronously and cannot overlap.")
  }
  const environment: ValueEnvironment = {
    engine,
    values: { ...values },
    bound: new Set(),
    missedReads: new Map(),
    highlight
  }
  state.current = environment
  try {
    const result = render()
    const missed = [...environment.missedReads]
    const readBeforeBound = missed.filter(([name]) => environment.bound.has(name)).map(([, expression]) => expression)
    const unknownDrops = missed.filter(([name]) => !environment.bound.has(name)).map(([, expression]) => expression)
    return { result, readBeforeBound, unknownDrops }
  } finally {
    state.current = undefined
  }
}
