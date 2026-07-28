import { describe, expect, it } from "vitest"
import { articleHtmlToText, isArticleHtmlEmpty, sanitizeArticleHtml } from "./article-html.server"

describe("sanitizeArticleHtml", () => {
  it("keeps supported formatting", () => {
    const html = "<h2>Trail food</h2><p>Pack <strong>calories</strong>.</p><ul><li>Oats</li></ul>"
    expect(sanitizeArticleHtml(html)).toBe(html)
  })

  it("keeps every mark and block the editor toolbar can apply", () => {
    const html =
      "<h4>Gear</h4><p><em>Light</em> <u>and</u> <s>heavy</s> <code>kit</code></p>" +
      "<blockquote><p>Pack less.</p></blockquote><pre><code>tent</code></pre><hr /><ol><li>Tent</li></ol>"
    expect(sanitizeArticleHtml(html)).toBe(html)
  })

  it("removes scripts, styles, and event handlers", () => {
    const html = '<p onclick="steal()">Safe</p><script>steal()</script><style>p{color:red}</style>'
    expect(sanitizeArticleHtml(html)).toBe("<p>Safe</p>")
  })

  it("blocks javascript links and hardens external links", () => {
    expect(sanitizeArticleHtml('<p><a href="javascript:steal()">Tap</a></p>')).toBe("<p><a>Tap</a></p>")
    expect(sanitizeArticleHtml('<p><a href="https://example.com" target="_blank">Tap</a></p>')).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Tap</a></p>'
    )
  })

  it("keeps every heading level the formatting menu offers", () => {
    expect(sanitizeArticleHtml("<h1>Title</h1><h5>Aside</h5><h6>Note</h6>")).toBe(
      "<h1>Title</h1><h5>Aside</h5><h6>Note</h6>"
    )
  })
})

describe("isArticleHtmlEmpty", () => {
  it("treats blank editor markup as empty", () => {
    expect(isArticleHtmlEmpty("")).toBe(true)
    expect(isArticleHtmlEmpty("<p></p>")).toBe(true)
    expect(isArticleHtmlEmpty("<p>&nbsp;</p>")).toBe(true)
    expect(isArticleHtmlEmpty("<script>steal()</script>")).toBe(true)
  })

  it("treats text and images as content", () => {
    expect(isArticleHtmlEmpty("<p>Trail food</p>")).toBe(false)
    expect(isArticleHtmlEmpty('<p><img src="https://example.com/a.png" alt="Trail" /></p>')).toBe(false)
  })
})

describe("articleHtmlToText", () => {
  it("gives each block its own line", () => {
    const html = "<h2>Trail food</h2><p>Pack calories.</p><ul><li>Oats</li><li>Nuts</li></ul>"
    expect(articleHtmlToText(html)).toBe("Trail food\nPack calories.\nOats\nNuts")
  })

  it("reads markup-only differences as the same text", () => {
    expect(articleHtmlToText("<p>Pack <strong>calories</strong>.</p>")).toBe(articleHtmlToText("<p>Pack calories.</p>"))
  })

  it("restores entities and collapses stray whitespace", () => {
    expect(articleHtmlToText("<p>Rain &amp;   wind&nbsp;arrive</p>")).toBe("Rain & wind arrive")
  })

  it("drops markup that carries no reader text", () => {
    expect(articleHtmlToText("<script>steal()</script><p></p>")).toBe("")
  })
})
