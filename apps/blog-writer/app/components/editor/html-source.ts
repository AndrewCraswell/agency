/**
 * The source view formats and colours the body HTML itself. What it shows is whatever the editor produced, which the
 * sanitizer holds to a small, known tag set, so a light tokenizer covers it and the app avoids taking on a syntax
 * highlighting dependency for one read-only panel.
 */

export type HtmlTokenKind = "attribute" | "punctuation" | "tag" | "text" | "value"

export interface HtmlToken {
  kind: HtmlTokenKind
  text: string
}

/** Elements that take a line of their own. Everything else is phrasing content and stays on the line it starts. */
const blockTags = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "img",
  "iframe",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td"
])

const voidTags = new Set(["br", "hr", "img"])

const tagPattern = /<(\/?)([a-z][a-z\d]*)([^<>]*?)(\s*\/?)>/gi
const attributePattern = /(\s+)([a-z][a-z\d-]*)(="[^"]*")?/gi

/** Breaks the single line the editor emits into indented block elements. */
export function formatArticleHtml(html: string) {
  const lines: string[] = []
  let line = ""
  let lineDepth = 0
  let depth = 0
  let isPreformatted = false

  const append = (text: string) => {
    if (line === "") {
      lineDepth = depth
    }
    line += text
  }

  const flush = () => {
    if (line !== "") {
      lines.push("  ".repeat(lineDepth) + line)
      line = ""
    }
  }

  const appendText = (raw: string) => {
    const text = raw.replace(/\s+/g, " ")
    if (text.trim() === "") {
      // A space between two inline tags is content, but the gaps around block tags are only layout.
      if (line !== "" && text !== "") {
        line += " "
      }
      return
    }
    append(line === "" ? text.trimStart() : text)
  }

  let index = 0
  for (const match of html.matchAll(tagPattern)) {
    const [tag, closing, name, , ending] = match
    const between = html.slice(index, match.index)
    index = match.index + tag.length
    const lowercase = name.toLowerCase()

    // Whitespace is content inside a code block, so the region is copied across exactly as it was written.
    if (isPreformatted) {
      line += between + tag
      if (lowercase === "pre" && closing === "/") {
        isPreformatted = false
        depth = Math.max(0, depth - 1)
        flush()
      }
      continue
    }

    appendText(between)

    if (!blockTags.has(lowercase)) {
      append(tag)
      continue
    }

    if (closing === "/") {
      depth = Math.max(0, depth - 1)
      append(tag)
      flush()
      continue
    }

    flush()
    append(tag)
    if (voidTags.has(lowercase) || ending.includes("/")) {
      flush()
    } else {
      depth += 1
      isPreformatted = lowercase === "pre"
    }
  }

  appendText(html.slice(index))
  flush()
  return lines.join("\n")
}

/** Splits source the writer can edit into the runs the view paints, leaving the text itself untouched. */
export function tokenizeHtml(source: string): HtmlToken[] {
  const tokens: HtmlToken[] = []

  const push = (kind: HtmlTokenKind, text: string | undefined) => {
    if (text !== undefined && text !== "") {
      tokens.push({ kind, text })
    }
  }

  let index = 0
  for (const match of source.matchAll(tagPattern)) {
    const [tag, closing, name, attributes, ending] = match
    push("text", source.slice(index, match.index))
    index = match.index + tag.length

    push("punctuation", `<${closing}`)
    push("tag", name)
    for (const attribute of attributes.matchAll(attributePattern)) {
      const [, space, attributeName, value] = attribute
      push("punctuation", space)
      push("attribute", attributeName)
      push("value", value)
    }
    push("punctuation", `${ending}>`)
  }

  push("text", source.slice(index))
  return tokens
}
