import sanitizeHtml from "sanitize-html"

/**
 * The tag set the editor can produce. Shopify renders article bodies as raw HTML on the storefront,
 * so anything outside this list is dropped before it reaches the database or the Admin API.
 */
const allowedTags = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "u",
  "s",
  "mark",
  "sub",
  "sup",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "caption",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "iframe"
]

/** The toolbar only ever writes these three values, so alignment is pinned rather than left open to arbitrary CSS. */
const alignmentStyles = { "text-align": [/^(?:left|center|right|justify)$/] }

/*
 * Embeds are deliberately host agnostic: merchants paste players from whatever service they use. The danger in an
 * iframe is script execution in the storefront page, not the host, so the two vectors that grant it stay shut.
 * `srcdoc` is absent from the allow list, which matters because an `about:srcdoc` frame inherits the embedding
 * origin and would turn pasted markup into same-origin script. `allowedSchemesByTag` then pins `src` to https, so a
 * `javascript:` or `data:` frame cannot load either. Everything left is inert layout and playback metadata.
 */
const embedAttributes = [
  "src",
  "title",
  "width",
  "height",
  "allow",
  "allowfullscreen",
  "frameborder",
  "loading",
  "referrerpolicy"
]

/** Tiptap round-trips column widths through `colwidth`; it is inert markup that browsers never act on. */
const cellAttributes = ["colspan", "rowspan", "colwidth"]

const options: sanitizeHtml.IOptions = {
  allowedTags,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: embedAttributes,
    th: cellAttributes,
    td: cellAttributes,
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    h5: ["style"],
    h6: ["style"],
    p: ["style"],
    mark: ["style"]
  },
  allowedStyles: {
    h1: alignmentStyles,
    h2: alignmentStyles,
    h3: alignmentStyles,
    h4: alignmentStyles,
    h5: alignmentStyles,
    h6: alignmentStyles,
    p: alignmentStyles,
    mark: { "background-color": [/^(?:#(?:[0-9a-f]{3}|[0-9a-f]{6})|rgba?\([\d\s.,%]+\))$/i] }
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { iframe: ["https"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: attribs.target === undefined ? attribs : { ...attribs, rel: "noopener noreferrer" }
    })
  },
  disallowedTagsMode: "discard"
}

/** Removes scripts, styles, event handlers, and unsupported markup from editor or model authored HTML. */
export function sanitizeArticleHtml(html: string) {
  return sanitizeHtml(html, options).trim()
}

/** Media that carries an article on its own, so a body holding only one of these still counts as written. */
const standaloneMedia = /<(?:img|iframe|table)\b/i

/** Reports whether sanitized body HTML carries any text or media, so empty editor markup is not saved as content. */
export function isArticleHtmlEmpty(html: string) {
  const sanitized = sanitizeArticleHtml(html)
  if (standaloneMedia.test(sanitized)) {
    return false
  }
  return (
    sanitizeHtml(sanitized, { allowedTags: [], allowedAttributes: {} })
      .replace(/&nbsp;/g, " ")
      .trim() === ""
  )
}

const blockBoundaries = /<\/(?:p|h[1-6]|li|blockquote|pre|caption|th|td|tr)>|<br\s*\/?>|<hr\s*\/?>/gi
const escapedEntities = /&(?:amp|lt|gt|quot|#39|nbsp);/g
const entityText: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " "
}

/**
 * Flattens article HTML into the text a reader sees, one line per block.
 * Version comparisons run on this text so a markup-only change never reads as a content change.
 */
export function articleHtmlToText(html: string) {
  const separated = sanitizeArticleHtml(html).replace(blockBoundaries, "\n")
  return sanitizeHtml(separated, { allowedTags: [], allowedAttributes: {} })
    .replace(escapedEntities, (entity) => entityText[entity] ?? entity)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n")
}
