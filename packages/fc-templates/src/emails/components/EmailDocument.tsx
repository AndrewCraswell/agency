import { liquidExpression } from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { Body, Container, Head, Html, Preview } from "react-email"
import { color, darkColor, font } from "./tokens.ts"

/*
 * Roughly a quarter of clients load a web font, and only through `@font-face` — a `<link>` reaches
 * half as many and Gmail honours neither. `mso-font-alt` matters more than the font itself: without
 * it Outlook on Windows discards the whole stack and renders Times New Roman.
 *
 * All three are variable fonts, so every weight points at one file, which is what Google's own
 * stylesheet does. The URLs are the latin subset. Geist Mono is here because the gift card code and
 * the tracking numbers are set in it, and a family named in a style but never loaded silently falls
 * back.
 */
const webFonts = [
  {
    family: "Archivo",
    url: "https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2",
    weights: [400, 700],
    alt: "Arial",
    generic: "swiss"
  },
  {
    family: "Inter",
    url: "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
    weights: [400, 600, 700],
    alt: "Arial",
    generic: "swiss"
  },
  {
    family: "Geist Mono",
    url: "https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmg.woff2",
    weights: [400, 600],
    alt: "Courier New",
    generic: "modern"
  }
]

const fontFaceCss = webFonts
  .flatMap(({ family, url, weights, alt, generic }) =>
    weights.map(
      (weight) => `
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  mso-font-alt: '${alt}';
  mso-generic-font-family: ${generic};
  src: url(${url}) format('woff2');
}`
    )
  )
  .join("")

/*
 * Everything an email needs before its first word: client resets, the mobile rules, and the dark
 * scheme. None of it can be inlined — a media query has no element to sit on — so it stays in a
 * single `<style>` and the elements opt in through the `dk-` and layout class names.
 *
 * `[data-ogsb]` and `[data-ogsc]` are what Outlook.com rewrites an element to when it inverts a
 * message, so the dark rules are written twice: once for clients that report a scheme and once for
 * the client that just recolours the markup.
 */
const documentCss = `${fontFaceCss}
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${color.bg}; }
a { text-decoration: none; }
.appleLinks a, .appleLinks a:visited { color: inherit !important; text-decoration: none !important; }
.btn a { mso-line-height-rule: exactly; }

@media only screen and (max-width: 620px) {
  .wrapper { width: 100% !important; max-width: 100% !important; }
  /* React Email moves a section's padding onto its inner cell, so the gutter is narrowed there. */
  .px > tbody > tr > td { padding-left: 20px !important; padding-right: 20px !important; }
  .h1 { font-size: 26px !important; line-height: 32px !important; letter-spacing: -0.4px !important; }
  /* Marketing heroes start larger than a notification title, so they step down to their own size. */
  .h1-lg { font-size: 30px !important; line-height: 34px !important; letter-spacing: -0.6px !important; }
  .big-stat { font-size: 36px !important; }
  .fluid { width: 100% !important; max-width: 100% !important; height: auto !important; }
  .sub { width: 100% !important; }
  .stack { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; }
  /* The gap the two halves lose when they stop sitting side by side. */
  .stack + .stack { padding-top: 18px !important; }
}

@media (prefers-color-scheme: dark) {
  body, .dk-page { background-color: ${darkColor.bg} !important; }
  .dk-card { background-color: ${darkColor.bg} !important; }
  .dk-band { background-color: ${darkColor.band} !important; }
  .dk-surface { background-color: ${darkColor.surface} !important; }
  .dk-border { border-color: ${darkColor.line} !important; }
  .dk-text, .dk-text a { color: ${color.onDark} !important; }
  .dk-muted, .dk-muted a { color: ${color.onDarkSoft} !important; }
  .dk-chip { background-color: ${color.onDark} !important; color: ${color.ink} !important; }
  .dk-btn { background-color: ${color.bg} !important; }
  .dk-btn a { color: ${color.ink} !important; }
  .dk-num { background-color: ${color.onDark} !important; color: ${color.ink} !important; }
  .dk-icon { background-color: ${darkColor.icon} !important; }
}

[data-ogsb] .dk-page, [data-ogsc] .dk-page { background-color: ${darkColor.bg} !important; }
[data-ogsb] .dk-card { background-color: ${darkColor.bg} !important; }
[data-ogsb] .dk-band { background-color: ${darkColor.band} !important; }
[data-ogsb] .dk-surface { background-color: ${darkColor.surface} !important; }
[data-ogsb] .dk-border, [data-ogsc] .dk-border { border-color: ${darkColor.line} !important; }
[data-ogsc] .dk-text, [data-ogsc] .dk-text a { color: ${color.onDark} !important; }
[data-ogsc] .dk-muted, [data-ogsc] .dk-muted a { color: ${color.onDarkSoft} !important; }
[data-ogsb] .dk-chip { background-color: ${color.onDark} !important; }
[data-ogsc] .dk-chip { color: ${color.ink} !important; }
[data-ogsb] .dk-btn { background-color: ${color.bg} !important; }
[data-ogsc] .dk-btn a { color: ${color.ink} !important; }
[data-ogsb] .dk-icon { background-color: ${darkColor.icon} !important; }
`

export type EmailDocumentProps = {
  /** The line the inbox shows beside the subject. A drop belongs here as `liquidValue`. */
  readonly preview: string
  readonly title: string
  readonly children: ReactNode
}

export const EmailDocument = ({ preview, title, children }: EmailDocumentProps) => (
  <Html lang="en">
    <Head>
      <title>{title}</title>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta content="telephone=no, date=no, address=no, email=no" name="format-detection" />
      <meta content="light dark" name="color-scheme" />
      <meta content="light dark" name="supported-color-schemes" />
      {/* oxlint-disable-next-line no-danger -- a style element's text is CSS, and React would escape it. */}
      <style dangerouslySetInnerHTML={{ __html: documentCss }} />
    </Head>
    <Preview>{preview}</Preview>
    <Body className="dk-page" style={{ backgroundColor: color.bg, fontFamily: font.body, margin: 0, padding: 0 }}>
      <Container
        className="wrapper dk-card"
        style={{ backgroundColor: color.bg, margin: "0 auto", maxWidth: 600, width: "100%" }}
      >
        {children}
        {/*
         * Shopify substitutes its open-rate pixel here. It renders nothing, so a template that
         * forgot it would look correct and silently report no opens: it belongs to the document.
         */}
        {liquidExpression("open_tracking_block")}
      </Container>
    </Body>
  </Html>
)
