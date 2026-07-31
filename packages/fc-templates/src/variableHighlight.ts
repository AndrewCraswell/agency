import { escapeHtml } from "./liquid.ts"

/*
 * "Show variables" for the preview viewer.
 *
 * Once Liquid has rendered, a variable's output is indistinguishable from the literal text beside
 * it, so the two cannot be told apart after the fact. Instead every `{{ … }}` output is fenced with
 * private-use characters before parsing, and the fences are turned into markup afterwards. That
 * keeps the .liquid sources untouched — nothing in them knows this feature exists — and it covers
 * every template at once rather than asking each one to annotate itself.
 *
 * A fence reads `START <index> SEP <rendered value> END`, where the index addresses the source text
 * of the output that produced the value.
 */

const START = "\uE000"
const SEP = "\uE001"
const END = "\uE002"

/** Every marker, plus the index payload that follows an opening one. */
const MARKERS = new RegExp(`${START}\\d*${SEP}|[${START}${SEP}${END}]`, "g")

/** `{{`, an optional whitespace-control dash, the expression, another optional dash, `}}`. */
const OUTPUT = /\{\{(-?)([\s\S]*?)(-?)\}\}/g

/** Elements whose content is text or code, where a wrapper element would be shown, not applied. */
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"])

const SPECIAL = new Set([START, SEP, END, "<"])

export type MarkedSource = {
  /** The template, ready to parse, with every output fenced. */
  source: string
  /** The source text of each fenced output, addressed by the index its marker carries. */
  expressions: string[]
}

/**
 * Fences every `{{ … }}` output in a template so its rendered value can be found again.
 *
 * The markers are emitted as outputs of their own carrying the original whitespace-control dashes,
 * so a fenced template renders byte-for-byte what the bare one does apart from the markers.
 */
export function markVariableOutputs(source: string): MarkedSource {
  const expressions: string[] = []
  const marked = source.replace(OUTPUT, (_match, left: string, body: string, right: string) => {
    const expression = body.trim()
    const index = expressions.push(expression) - 1
    return `{{${left} '${START}${index}${SEP}' }}{{ ${expression} }}{{ '${END}' ${right}}}`
  })
  return { source: marked, expressions }
}

function stripMarkers(text: string): string {
  return text.replace(MARKERS, "")
}

type ScannedTag = {
  /** The tag, markers removed and the highlight attribute added if it held a variable. */
  text: string
  /** Index just past the tag's `>`. */
  end: number
  /** Lower-cased, or empty for anything that is not an element tag. */
  name: string
  closing: boolean
  selfClosing: boolean
}

/**
 * Reads one `<…>`. A variable inside a tag is part of an attribute, where a wrapper element cannot
 * go, so the element itself is flagged instead and the markers are dropped.
 */
function scanTag(html: string, start: number): ScannedTag {
  let index = start + 1
  let quote = ""
  let hasVariable = false
  let text = "<"

  while (index < html.length) {
    const char = html[index]
    if (char === START) {
      hasVariable = true
      const sep = html.indexOf(SEP, index + 1)
      index = sep === -1 ? index + 1 : sep + 1
      continue
    }
    if (char === SEP || char === END) {
      index += 1
      continue
    }
    if (quote !== "") {
      quote = char === quote ? "" : quote
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ">") {
      break
    }
    text += char
    index += 1
  }

  const name = /^<\/?([a-z][^\s/>]*)/i.exec(text)?.[1] ?? ""
  const closing = text.startsWith("</")
  const flag = hasVariable && name !== "" && !closing
  return {
    text: `${flag ? `${text.slice(0, name.length + 1)} data-fc-var${text.slice(name.length + 1)}` : text}>`,
    end: Math.min(index + 1, html.length),
    name: name.toLowerCase(),
    closing,
    selfClosing: text.endsWith("/")
  }
}

function wrapValue(expression: string, value: string): string {
  return `<span data-fc-var title="${escapeHtml(expression)}">${value}</span>`
}

/**
 * Turns the fences left by `markVariableOutputs` into markup: a `data-fc-var` span around a value
 * that landed in text, the attribute alone on an element whose attributes came from a variable, and
 * nothing at all where markup cannot go. A value that rendered blank is left unwrapped, because an
 * empty highlight marks a spot on the page that a reader has no way to connect to anything.
 */
export function highlightMarkedVariables(html: string, expressions: readonly string[]): string {
  const open: { index: number; parts: string[] }[] = []
  let parts: string[] = []
  let cursor = 0

  while (cursor < html.length) {
    const char = html[cursor]

    if (char === START) {
      const sep = html.indexOf(SEP, cursor + 1)
      if (sep === -1) {
        cursor += 1
        continue
      }
      open.push({ index: Number(html.slice(cursor + 1, sep)), parts })
      parts = []
      cursor = sep + 1
      continue
    }

    if (char === END) {
      const frame = open.pop()
      cursor += 1
      if (!frame) {
        continue
      }
      const value = parts.join("")
      parts = frame.parts
      parts.push(value.trim() === "" ? value : wrapValue(expressions[frame.index] ?? "", value))
      continue
    }

    if (char === SEP) {
      cursor += 1
      continue
    }

    if (char === "<") {
      if (html.startsWith("<!--", cursor)) {
        const close = html.indexOf("-->", cursor)
        const end = close === -1 ? html.length : close + 3
        parts.push(stripMarkers(html.slice(cursor, end)))
        cursor = end
        continue
      }
      const tag = scanTag(html, cursor)
      parts.push(tag.text)
      cursor = tag.end
      if (RAW_TEXT_ELEMENTS.has(tag.name) && !tag.closing && !tag.selfClosing) {
        const close = html.toLowerCase().indexOf(`</${tag.name}`, cursor)
        const end = close === -1 ? html.length : close
        parts.push(stripMarkers(html.slice(cursor, end)))
        cursor = end
      }
      continue
    }

    let plain = cursor
    while (plain < html.length && !SPECIAL.has(html[plain])) {
      plain += 1
    }
    parts.push(html.slice(cursor, plain))
    cursor = plain
  }

  // A fence the template never closed, because its value straddled a raw-text element or a tag.
  // Its text is still the page, so keep it and drop only the highlight.
  for (let frame = open.pop(); frame; frame = open.pop()) {
    const value = parts.join("")
    parts = frame.parts
    parts.push(value)
  }
  return parts.join("")
}

/*
 * Loud on purpose: the point of the mode is to see at a glance which parts of the page a merchant's
 * data drives. Highlights sit outside the page's own box model — a background and a ring on text, a
 * ring alone on an element whose attributes are variable-driven — so turning the mode on never
 * moves anything.
 *
 * The element ring is two-tone because buttons and the logo sit on near-black bands, where a single
 * amber line disappears. White carries it against those, amber against the white page, and the pair
 * follows whatever `border-radius` the element already has.
 */
const HIGHLIGHT_CSS = `
[data-fc-var] {
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #d97706;
  outline: 0;
}
span[data-fc-var] {
  background: rgba(253, 224, 71, 0.5);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(180, 83, 9, 0.65);
}
@media print {
  [data-fc-var] {
    box-shadow: none;
  }
  span[data-fc-var] {
    background: transparent;
  }
}`

/** Adds the highlight rules to a rendered document. */
export function withHighlightStyles(html: string): string {
  const style = `<style data-fc-var-styles>${HIGHLIGHT_CSS}</style>`
  return html.includes("</head>") ? html.replace("</head>", `${style}</head>`) : `${style}${html}`
}
