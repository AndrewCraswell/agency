import type { ReactNode } from "react"
import { Button, Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type CtaBandProps = {
  readonly kicker?: string
  /** The pill above the headline, translucent so the band still reads as one surface. */
  readonly chip?: string
  readonly headline: ReactNode
  readonly support?: ReactNode
  /** A discount the band is reminding someone they already hold. */
  readonly code?: { readonly value: string; readonly note: string }
  readonly href: string
  readonly label: string
}

/*
 * The dark band that closes a marketing email. Its button is white on black, which is the reverse
 * of `EmailButton`, so it is written here rather than reusing that component with a variant nothing
 * else would want.
 */
export const CtaBand = ({ chip, code, headline, href, kicker, label, support }: CtaBandProps) => (
  <Section
    className="px dk-band"
    style={{ backgroundColor: color.surfaceDark, padding: `40px ${gutter}px`, textAlign: "center" }}
  >
    {chip !== undefined && (
      <div style={{ paddingBottom: 12 }}>
        <span
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 20,
            color: color.onDark,
            display: "inline-block",
            fontFamily: font.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            lineHeight: "14px",
            padding: "5px 12px"
          }}
        >
          {chip}
        </span>
      </div>
    )}
    {kicker !== undefined && (
      <div
        style={{
          color: color.onDarkSoft,
          fontFamily: font.display,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 2.4,
          lineHeight: "16px"
        }}
      >
        {kicker}
      </div>
    )}
    <div
      className="h1-lg"
      style={{
        color: color.onDark,
        fontFamily: font.display,
        fontSize: 32,
        fontWeight: 700,
        letterSpacing: -0.6,
        lineHeight: "36px",
        paddingTop: kicker === undefined ? 0 : 10
      }}
    >
      {headline}
    </div>
    {support !== undefined && (
      <div
        className="sub"
        style={{
          color: color.onDarkSoft,
          fontFamily: font.body,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: "22px",
          margin: "14px auto 0",
          maxWidth: 400
        }}
      >
        {support}
      </div>
    )}
    {code !== undefined && (
      <div style={{ paddingTop: 16 }}>
        <span
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
            color: color.onDark,
            display: "inline-block",
            fontFamily: font.mono,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
            lineHeight: "16px",
            padding: "6px 14px"
          }}
        >
          {code.value}
        </span>
        <span
          style={{
            color: color.onDarkSoft,
            fontFamily: font.body,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: "18px",
            paddingLeft: 10
          }}
        >
          {code.note}
        </span>
      </div>
    )}
    <div className="btn" style={{ paddingTop: 24 }}>
      <Button
        href={href}
        style={{
          backgroundColor: color.bg,
          borderRadius: radius,
          color: color.ink,
          fontFamily: font.body,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: "18px",
          padding: "14px 28px",
          textDecoration: "none"
        }}
      >
        {label}
      </Button>
    </div>
  </Section>
)
