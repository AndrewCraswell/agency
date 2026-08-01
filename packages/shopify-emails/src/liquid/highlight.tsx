/** @jsxRuntime automatic */
/* The loader that runs the build command takes its JSX settings from the consumer's tsconfig, which
 * says nothing about this package's own files, so each one states the runtime it needs. */
import type { ReactElement } from "react"

/*
 * Preview-only decoration that shows which words on the page came from a drop.
 *
 * Text positions can be wrapped in an element as they render. Attribute positions cannot: an
 * attribute is a string, and it is built before the element exists, so there is nothing to wrap and
 * nothing to attach to. Those are marked in place with control characters instead and resolved
 * afterwards, once the markup is a string and the element around each mark can be found.
 */

const MARK_OPEN = "\u0001"
const MARK_CLOSE = "\u0002"
const MARK = new RegExp(`${MARK_OPEN}([^${MARK_CLOSE}]*)${MARK_CLOSE}`, "g")

const SURFACE = "#fff4d6"
const EDGE = "#d9b45a"
/* Stated rather than inherited: the pale surface hides light text where a drop sits on a dark panel. */
const INK = "#3d2f08"
/* An element ring has no surface behind it to carry the mark, so it is stronger than the text edge. */
const RING = "#d97706"

export const highlightedText = (expression: string, text: string): ReactElement => {
  if (text === "") {
    return (
      <span
        style={{ backgroundColor: SURFACE, color: "#8a6d1f", fontStyle: "italic", outline: `1px dashed ${EDGE}` }}
        title={expression}
      >
        {expression}
      </span>
    )
  }
  return (
    <span style={{ backgroundColor: SURFACE, color: INK, outline: `1px dashed ${EDGE}` }} title={expression}>
      {text}
    </span>
  )
}

export const markAttributeDrop = (expression: string, text: string): string =>
  `${MARK_OPEN}${expression}${MARK_CLOSE}${text}`

const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")

/** Where an attribute can be added to the tag that owns a mark: just past its name. */
const afterTagName = (html: string, tagStart: number): number => {
  const name = /^<[a-zA-Z][^\s/>]*/.exec(html.slice(tagStart, tagStart + 64))
  return name === null ? -1 : tagStart + name[0].length
}

type Edit = {
  readonly at: number
  readonly remove: number
  readonly insert: string
}

export const decorateAttributeDrops = (html: string): string => {
  const edits: Edit[] = []
  const byTag = new Map<number, string[]>()

  for (const match of html.matchAll(MARK)) {
    const at = match.index
    edits.push({ at, insert: "", remove: match[0].length })
    const tagStart = html.lastIndexOf("<", at)
    const existing = byTag.get(tagStart)
    if (existing) {
      existing.push(match[1] ?? "")
    } else {
      byTag.set(tagStart, [match[1] ?? ""])
    }
  }

  if (edits.length === 0) {
    return html
  }

  for (const [tagStart, expressions] of byTag) {
    const at = afterTagName(html, tagStart)
    if (at !== -1) {
      edits.push({ at, insert: ` data-liquid="${escapeAttribute(expressions.join(", "))}"`, remove: 0 })
    }
  }

  const decorated = edits
    .toSorted((left, right) => right.at - left.at)
    .reduce((carry, edit) => carry.slice(0, edit.at) + edit.insert + carry.slice(edit.at + edit.remove), html)

  /* Two-tone because buttons and the logo sit on near-black bands, where a single amber line is
   * lost. White carries the ring there, amber against the page, and both follow the element's own
   * `border-radius`. `box-shadow` rather than `outline` so a client's `img { outline: none }` and
   * the element's corners are both respected, and neither ring takes up space. */
  return `${decorated}<style>[data-liquid]{box-shadow:0 0 0 2px #fff,0 0 0 4px ${RING};outline:0}</style>`
}
