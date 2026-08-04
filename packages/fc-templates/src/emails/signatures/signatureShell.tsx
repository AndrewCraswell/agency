/*
 * The shell every signature renders into, and the pieces that behave differently in the dark: the
 * logo, the contact glyphs, and the social glyphs all swap their cut, because a PNG cannot be
 * recoloured. Everything else is recoloured by the `dk-` classes this file's `<style>` defines.
 *
 * `[data-ogsc]`/`[data-ogsb]` repeat the dark rules for Outlook.com, which recolours the markup
 * instead of reporting a scheme — the same contract the emails use.
 */

import type { CSSProperties, ReactNode } from "react"
import { Body, Column, Head, Html, Img, Link, Row } from "react-email"
import { color, darkColor, font, shopLinks } from "../components/tokens.ts"
import { logo } from "./signatureData.ts"
import { glyph } from "./signatureIcons.ts"

const fontFace = [
  {
    family: "Archivo",
    weight: 700,
    url: "https://fonts.gstatic.com/s/archivo/v25/k3kPo8UDI-1M0wlSV9XAw6lQkqWY8Q82sLydOxI.woff2"
  },
  {
    family: "Inter",
    weight: 400,
    url: "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2"
  },
  {
    family: "Inter",
    weight: 700,
    url: "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2"
  }
]
  .map(
    ({ family, weight, url }) =>
      `\n@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; font-display: swap; src: url(${url}) format('woff2'); }`
  )
  .join("")

const signatureCss = `${fontFace}
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
body { margin: 0 !important; padding: 0 !important; }
a { text-decoration: none; }

/* The dark cut of every swapped image hides until a dark scheme calls for it. */
.dk-only-dark { display: none; }

@media (prefers-color-scheme: dark) {
  body, .dk-page { background-color: ${darkColor.bg} !important; }
  .dk-text, .dk-text a { color: ${color.onDark} !important; }
  .dk-muted, .dk-muted a { color: ${color.onDarkSoft} !important; }
  .dk-hairline { background-color: ${darkColor.line} !important; }
  .dk-border { border-color: ${darkColor.line} !important; }
  .dk-only-light { display: none !important; }
  .dk-only-dark { display: block !important; }
}

[data-ogsb] .dk-page { background-color: ${darkColor.bg} !important; }
[data-ogsc] .dk-text, [data-ogsc] .dk-text a { color: ${color.onDark} !important; }
[data-ogsc] .dk-muted, [data-ogsc] .dk-muted a { color: ${color.onDarkSoft} !important; }
[data-ogsb] .dk-hairline { background-color: ${darkColor.line} !important; }
[data-ogsc] .dk-border { border-color: ${darkColor.line} !important; }
[data-ogsc] .dk-only-light { display: none !important; }
[data-ogsc] .dk-only-dark { display: block !important; }
`

export type SignatureShellProps = {
  readonly title: string
  readonly children: ReactNode
}

export const SignatureShell = ({ title, children }: SignatureShellProps) => (
  <Html lang="en">
    <Head>
      <title>{title}</title>
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <meta content="telephone=no, date=no, address=no, email=no" name="format-detection" />
      <meta content="light dark" name="color-scheme" />
      <meta content="light dark" name="supported-color-schemes" />
      {/* oxlint-disable-next-line no-danger -- a style element's text is CSS, and React would escape it. */}
      <style dangerouslySetInnerHTML={{ __html: signatureCss }} />
    </Head>
    <Body className="dk-page" style={{ fontFamily: font.body, margin: 0, padding: 24 }}>
      {children}
    </Body>
  </Html>
)

/* Two cuts of one image, the dark one hidden until the scheme flips. */
const SwapImg = ({
  light,
  dark,
  alt,
  width,
  height,
  style
}: {
  readonly light: string
  readonly dark: string
  readonly alt: string
  readonly width: number
  readonly height: number
  readonly style?: CSSProperties
}) => (
  <>
    <Img
      alt={alt}
      className="dk-only-light"
      height={height}
      src={light}
      style={{ display: "block", ...style }}
      width={width}
    />
    <Img
      alt={alt}
      className="dk-only-dark"
      height={height}
      src={dark}
      style={{ display: "none", ...style }}
      width={width}
    />
  </>
)

/* The shield, sized by height, black on light and white on dark. */
export const SignatureLogo = ({ height }: { readonly height: number }) => (
  <SwapImg alt="Fencing Club" dark={logo.dark} height={height} light={logo.light} width={Math.round(height * 0.82)} />
)

type ContactIcon = "mail" | "globe" | "phone" | "mapPin"

/* One contact line: the muted glyph, then the value — a link where it is one. */
export const ContactRow = ({
  icon,
  iconSize,
  gap,
  fontSize,
  href,
  topGap = 0,
  children
}: {
  readonly icon: ContactIcon
  readonly iconSize: number
  readonly gap: number
  readonly fontSize: number
  readonly href?: string
  readonly topGap?: number
  readonly children: ReactNode
}) => {
  const textStyle: CSSProperties = {
    color: color.ink,
    fontFamily: font.body,
    fontSize,
    lineHeight: `${iconSize + 4}px`
  }
  return (
    <Row>
      <Column style={{ paddingRight: gap, paddingTop: topGap, verticalAlign: "middle", width: iconSize }}>
        <SwapImg alt="" dark={glyph[`${icon}Dark`]} height={iconSize} light={glyph[`${icon}Light`]} width={iconSize} />
      </Column>
      <Column className="dk-text" style={{ paddingTop: topGap, verticalAlign: "middle" }}>
        {href ? (
          <Link className="dk-text" href={href} style={{ ...textStyle, textDecoration: "none" }}>
            {children}
          </Link>
        ) : (
          <span className="dk-text" style={textStyle}>
            {children}
          </span>
        )}
      </Column>
    </Row>
  )
}

const socials = [
  { alt: "Instagram", href: shopLinks.instagram, dark: glyph.instagramWhite, light: glyph.instagramInk },
  { alt: "Facebook", href: shopLinks.facebook, dark: glyph.facebookWhite, light: glyph.facebookInk }
] as const

/* Instagram then Facebook, as the design's ink glyphs, white once the scheme flips. */
export const Socials = ({
  size,
  gap,
  style
}: {
  readonly size: number
  readonly gap: number
  readonly style?: CSSProperties
}) => (
  <Row style={{ width: "auto", ...style }}>
    {socials.map((item, index) => (
      <Column key={item.alt} style={{ paddingLeft: index === 0 ? 0 : gap }}>
        <Link href={item.href}>
          <SwapImg alt={item.alt} dark={item.dark} height={size} light={item.light} width={size} />
        </Link>
      </Column>
    ))}
  </Row>
)
