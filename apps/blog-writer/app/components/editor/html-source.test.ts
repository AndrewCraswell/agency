import { describe, expect, it } from "vitest"
import { formatArticleHtml, tokenizeHtml } from "./html-source"

describe("formatArticleHtml", () => {
  it("puts every block element on its own indented line", () => {
    expect(formatArticleHtml("<h2>Trail food</h2><ul><li><p>Oats</p></li></ul>")).toBe(
      ["<h2>Trail food</h2>", "<ul>", "  <li>", "    <p>Oats</p>", "  </li>", "</ul>"].join("\n")
    )
  })

  it("keeps inline markup on the line it belongs to", () => {
    expect(formatArticleHtml('<p>Pack <strong>calories</strong> and a <a href="/map">map</a>.</p>')).toBe(
      '<p>Pack <strong>calories</strong> and a <a href="/map">map</a>.</p>'
    )
  })

  it("gives a self closing element a line without opening an indent", () => {
    expect(formatArticleHtml('<p>Above</p><img src="https://cdn.example/tent.jpg" /><p>Below</p>')).toBe(
      ["<p>Above</p>", '<img src="https://cdn.example/tent.jpg" />', "<p>Below</p>"].join("\n")
    )
  })

  it("leaves the whitespace inside a code block exactly as it was written", () => {
    expect(formatArticleHtml("<pre><code>const a = 1\n  const b = 2</code></pre>")).toBe(
      "<pre><code>const a = 1\n  const b = 2</code></pre>"
    )
  })
})

describe("tokenizeHtml", () => {
  it("names the parts of a tag so they can be coloured apart", () => {
    expect(tokenizeHtml('<a href="/map">Map</a>')).toStrictEqual([
      { kind: "punctuation", text: "<" },
      { kind: "tag", text: "a" },
      { kind: "punctuation", text: " " },
      { kind: "attribute", text: "href" },
      { kind: "value", text: '="/map"' },
      { kind: "punctuation", text: ">" },
      { kind: "text", text: "Map" },
      { kind: "punctuation", text: "</" },
      { kind: "tag", text: "a" },
      { kind: "punctuation", text: ">" }
    ])
  })

  it("paints back exactly what it was given, so the caret keeps its place", () => {
    const source = '<p>Half a tag <b>and</p>\n<img src="x" />'
    expect(
      tokenizeHtml(source)
        .map((token) => token.text)
        .join("")
    ).toBe(source)
  })
})
