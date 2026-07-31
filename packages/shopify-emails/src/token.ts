/*
 * React escapes `&`, `<` and `>` in text and quotes inside attributes, which corrupts Liquid such
 * as `{% if total > 5 %}` or `{{ 'now' | date: '%Y' }}` on the way through the renderer. Components
 * therefore emit tokens drawn from an alphabet React never rewrites, and compilation swaps them
 * back for the real source afterwards.
 *
 * The Liquid source travels inside the token rather than in a side table, so encoding stays
 * order-independent and safe across concurrent renders.
 */

export type LiquidTokenKind = "value" | "raw"

export type LiquidToken = {
  readonly kind: LiquidTokenKind
  readonly source: string
}

const KIND_CODES: Record<LiquidTokenKind, string> = { value: "v", raw: "r" }
const CODE_KINDS: Record<string, LiquidTokenKind> = { v: "value", r: "raw" }

/* Hex pairs keep the token free of every character React escapes, in text and in attributes. */
const TOKEN_PATTERN = /__LQ_([vr])((?:[0-9a-f]{2})*)_LQ__/g

const toHex = (source: string): string => {
  let hex = ""
  for (const byte of new TextEncoder().encode(source)) {
    hex += byte.toString(16).padStart(2, "0")
  }
  return hex
}

const fromHex = (hex: string): string => {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

export const encodeLiquid = (source: string, kind: LiquidTokenKind = "raw"): string =>
  `__LQ_${KIND_CODES[kind]}${toHex(source)}_LQ__`

export const replaceLiquidTokens = (markup: string, replace: (token: LiquidToken) => string): string =>
  markup.replace(TOKEN_PATTERN, (_match, code: string, hex: string) =>
    replace({ kind: CODE_KINDS[code], source: fromHex(hex) })
  )

export const toLiquidSource = (markup: string): string => replaceLiquidTokens(markup, (token) => token.source)
