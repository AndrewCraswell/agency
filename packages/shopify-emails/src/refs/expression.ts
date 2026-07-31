import { isPathRef, pathOf, type PathRef } from "./path.ts"

/*
 * Liquid conditions, built from refs so a renamed drop fails to compile rather than silently
 * evaluating false. Liquid has no parentheses in conditions and evaluates them right to left, so
 * `and` and `or` are deliberately flat: mix them and Shopify will not group them the way you read it.
 */

/* Phantom only: it makes a condition unforgeable, so `test` cannot be handed a hand-written string. */
declare const CONDITION: unique symbol

export type LiquidCondition = string & { readonly [CONDITION]: true }

const condition = (source: string): LiquidCondition => source as LiquidCondition

export type Operand = PathRef<unknown> | string | number | boolean

const operandFor = (value: Operand): string => {
  if (isPathRef(value)) {
    return pathOf(value)
  }
  if (typeof value === "string") {
    /* The backslash goes first, or escaping the quote would produce a second escape to undo it. */
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
  }
  return String(value)
}

/** True for anything Liquid considers filled in: not nil, not an empty string, not an empty array. */
export const isPresent = (ref: PathRef<unknown>): LiquidCondition => condition(`${pathOf(ref)} != blank`)

export const isBlank = (ref: PathRef<unknown>): LiquidCondition => condition(`${pathOf(ref)} == blank`)

/** Bare truthiness, which in Liquid means anything other than `nil` and `false`. */
export const isTruthy = (ref: PathRef<unknown>): LiquidCondition => condition(pathOf(ref))

export const eq = (left: Operand, right: Operand): LiquidCondition =>
  condition(`${operandFor(left)} == ${operandFor(right)}`)

export const neq = (left: Operand, right: Operand): LiquidCondition =>
  condition(`${operandFor(left)} != ${operandFor(right)}`)

export const gt = (left: Operand, right: Operand): LiquidCondition =>
  condition(`${operandFor(left)} > ${operandFor(right)}`)

export const lt = (left: Operand, right: Operand): LiquidCondition =>
  condition(`${operandFor(left)} < ${operandFor(right)}`)

export const and = (...tests: readonly LiquidCondition[]): LiquidCondition => condition(tests.join(" and "))

export const or = (...tests: readonly LiquidCondition[]): LiquidCondition => condition(tests.join(" or "))
